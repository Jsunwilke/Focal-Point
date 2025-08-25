const functions = require('firebase-functions');
const admin = require('firebase-admin');
const StreamChat = require('stream-chat').StreamChat;

// Initialize Stream Chat with server-side credentials
const serverClient = StreamChat.getInstance(
  functions.config().stream.key,
  functions.config().stream.secret
);

/**
 * Cloud Function to sync users to Stream Chat
 * Can be called by any authenticated user to sync other users in their organization
 */
exports.syncUsersToStreamChat = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userIds } = data;
  
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'userIds array is required');
  }

  try {
    // Get the requesting user's organization
    const requestingUserDoc = await admin.firestore()
      .collection('users')
      .doc(context.auth.uid)
      .get();
    
    if (!requestingUserDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Requesting user not found');
    }

    const requestingUser = requestingUserDoc.data();
    const organizationId = requestingUser.organizationID;

    if (!organizationId) {
      throw new functions.https.HttpsError('failed-precondition', 'User must belong to an organization');
    }

    // Fetch all requested users from Firestore
    const userPromises = userIds.map(userId => 
      admin.firestore().collection('users').doc(userId).get()
    );
    
    const userDocs = await Promise.all(userPromises);
    
    // Filter users that exist and belong to the same organization
    const usersToSync = [];
    userDocs.forEach(doc => {
      if (doc.exists) {
        const userData = doc.data();
        if (userData.organizationID === organizationId) {
          usersToSync.push({
            id: doc.id,
            ...userData
          });
        }
      }
    });

    if (usersToSync.length === 0) {
      return { 
        success: false, 
        message: 'No valid users found to sync',
        syncedCount: 0 
      };
    }

    // Sync users to Stream Chat
    const syncPromises = usersToSync.map(async (user) => {
      try {
        const streamUserData = {
          id: user.id,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email,
          image: user.photoURL || user.originalPhotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=6366f1&color=fff&size=200`,
          role: user.role || 'user',
          organizationID: user.organizationID
        };

        // Upsert user in Stream Chat
        await serverClient.upsertUser(streamUserData);
        
        return { success: true, userId: user.id };
      } catch (error) {
        console.error(`Failed to sync user ${user.id}:`, error);
        return { success: false, userId: user.id, error: error.message };
      }
    });

    const results = await Promise.all(syncPromises);
    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      message: `Successfully synced ${successCount} out of ${usersToSync.length} users`,
      syncedCount: successCount,
      results: results
    };

  } catch (error) {
    console.error('Error in syncUsersToStreamChat:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function to create a chat channel with proper user sync
 */
exports.createChatChannel = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { channelType, channelId, members, channelData } = data;

  if (!channelType || !channelId || !members || !Array.isArray(members)) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
  }

  try {
    // First, ensure all members exist in Stream Chat
    const userDocs = await Promise.all(
      members.map(memberId => 
        admin.firestore().collection('users').doc(memberId).get()
      )
    );

    // Sync all members to Stream Chat
    const syncPromises = userDocs.map(async (doc) => {
      if (doc.exists) {
        const userData = doc.data();
        const streamUserData = {
          id: doc.id,
          name: userData.displayName || userData.email?.split('@')[0] || 'User',
          email: userData.email,
          image: userData.photoURL || userData.originalPhotoURL,
          role: userData.role || 'user',
          organizationID: userData.organizationID
        };

        try {
          await serverClient.upsertUser(streamUserData);
          return true;
        } catch (error) {
          console.error(`Failed to sync user ${doc.id}:`, error);
          return false;
        }
      }
      return false;
    });

    await Promise.all(syncPromises);

    // Create the channel with all members
    const channel = serverClient.channel(channelType, channelId, {
      ...channelData,
      members: members,
      created_by: context.auth.uid
    });

    await channel.create();

    return {
      success: true,
      channelId: channelId,
      message: 'Channel created successfully with all members'
    };

  } catch (error) {
    console.error('Error in createChatChannel:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});