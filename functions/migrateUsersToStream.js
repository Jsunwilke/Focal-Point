const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { StreamChat } = require('stream-chat');

/**
 * Migrate all users from an organization to Stream Chat
 * This can be called by an admin to sync all users at once
 */
exports.migrateOrganizationUsersToStream = onCall({
  cors: true,
  enforceAppCheck: false,
}, async (request) => {
  console.log('Starting bulk user migration to Stream Chat');
  
  // Check authentication
  if (!request.auth) {
    console.error('No authentication provided');
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Get the requesting user's data
    const requestingUserDoc = await admin.firestore()
      .collection('users')
      .doc(request.auth.uid)
      .get();
    
    if (!requestingUserDoc.exists) {
      return { success: false, error: 'User not found' };
    }

    const requestingUser = requestingUserDoc.data();
    
    // Check if user is admin
    if (requestingUser.role !== 'admin') {
      return { success: false, error: 'Only admins can migrate users' };
    }

    const organizationId = requestingUser.organizationID;
    if (!organizationId) {
      return { success: false, error: 'User must belong to an organization' };
    }

    // Initialize Stream Chat with server credentials (using environment variables)
    const apiKey = process.env.STREAM_KEY || 'fgxkbmk4kp9f';
    const apiSecret = process.env.STREAM_SECRET || 'bh9rb2p38b9xcv3gm2t2fe9s7htv6wxv5gcpkb2dc6v4e85zxpptmc5h4m4fjs23';
    
    if (!apiKey || !apiSecret) {
      console.error('Stream Chat credentials not configured in Firebase Functions');
      return { success: false, error: 'Stream Chat credentials not configured' };
    }
    
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);

    // Fetch all users from the organization
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('organizationID', '==', organizationId)
      .where('isActive', '==', true)
      .get();

    if (usersSnapshot.empty) {
      return {
        success: false,
        message: 'No users found in organization',
        migratedCount: 0
      };
    }

    console.log(`Found ${usersSnapshot.size} users to migrate`);

    // Prepare users for Stream Chat
    const streamUsers = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      
      // Map Firebase roles to Stream Chat roles
      // Stream Chat only accepts 'user' or 'admin' by default
      let streamRole = 'user';
      if (userData.role === 'admin' || userData.role === 'owner') {
        streamRole = 'admin';
      }
      // Store the original role in a custom field
      
      streamUsers.push({
        id: doc.id,
        name: userData.displayName || userData.email?.split('@')[0] || 'User',
        email: userData.email,
        image: userData.photoURL || userData.originalPhotoURL || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.displayName || userData.email)}&background=6366f1&color=fff&size=200`,
        role: streamRole, // Use Stream Chat compatible role
        firebaseRole: userData.role, // Store original role as custom field
        organizationID: userData.organizationID,
        teams: [organizationId] // Add to organization team
      });
    });

    // Migrate users individually for better error tracking
    let totalMigrated = 0;
    const errors = [];
    const successfulUsers = [];

    console.log(`Attempting to migrate ${streamUsers.length} users to Stream Chat`);

    for (const user of streamUsers) {
      try {
        console.log(`Migrating user: ${user.id} (${user.email})`);
        
        // Upsert individual user to Stream Chat
        await serverClient.upsertUser(user);
        
        totalMigrated++;
        successfulUsers.push(user.id);
        console.log(`Successfully migrated user: ${user.id}`);
      } catch (error) {
        console.error(`Failed to migrate user ${user.id}:`, error.message || error);
        errors.push({
          userId: user.id,
          email: user.email,
          error: error.message || String(error)
        });
      }
    }

    console.log(`Migration complete. Migrated ${totalMigrated} out of ${streamUsers.length} users`);

    // Determine overall success
    const success = totalMigrated > 0;
    
    return {
      success: success,
      message: totalMigrated === streamUsers.length 
        ? `Successfully migrated all ${totalMigrated} users`
        : `Migrated ${totalMigrated} out of ${streamUsers.length} users`,
      migratedCount: totalMigrated,
      totalUsers: streamUsers.length,
      successfulUsers: successfulUsers,
      errors: errors.length > 0 ? errors : undefined,
      detailedStatus: {
        total: streamUsers.length,
        successful: totalMigrated,
        failed: errors.length
      }
    };

  } catch (error) {
    console.error('Error in user migration:', error);
    return { success: false, error: error.message };
  }
});