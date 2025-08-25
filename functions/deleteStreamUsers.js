const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { StreamChat } = require('stream-chat');

/**
 * Delete users from Stream Chat
 * This can be called by an admin to remove users from Stream Chat
 */
exports.deleteStreamChatUsers = onCall({
  cors: true,
  enforceAppCheck: false,
}, async (request) => {
  console.log('Starting Stream Chat user deletion');
  
  // Check authentication
  if (!request.auth) {
    console.error('No authentication provided');
    return { success: false, error: 'Authentication required' };
  }

  const { userIds, deleteAll } = request.data;

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
      return { success: false, error: 'Only admins can delete users' };
    }

    // Initialize Stream Chat with server credentials
    const apiKey = process.env.STREAM_KEY || 'fgxkbmk4kp9f';
    const apiSecret = process.env.STREAM_SECRET || 'bh9rb2p38b9xcv3gm2t2fe9s7htv6wxv5gcpkb2dc6v4e85zxpptmc5h4m4fjs23';
    
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);

    let usersToDelete = [];

    if (deleteAll && requestingUser.organizationID) {
      // Delete all users from the organization
      console.log('Fetching all organization users from Stream Chat');
      
      const response = await serverClient.queryUsers({
        organizationID: { $eq: requestingUser.organizationID }
      });
      
      usersToDelete = response.users.map(u => u.id);
      console.log(`Found ${usersToDelete.length} users to delete`);
    } else if (userIds && Array.isArray(userIds)) {
      // Delete specific users
      usersToDelete = userIds;
    } else {
      return { success: false, error: 'No users specified for deletion' };
    }

    // Delete users one by one
    let deletedCount = 0;
    const errors = [];

    for (const userId of usersToDelete) {
      try {
        // Skip the requesting user (don't delete yourself)
        if (userId === request.auth.uid) {
          console.log('Skipping deletion of requesting user');
          continue;
        }

        console.log(`Deleting user: ${userId}`);
        
        // Delete user from Stream Chat
        await serverClient.deleteUser(userId, {
          mark_messages_deleted: true, // Mark their messages as deleted
          hard_delete: false // Soft delete (can be recovered if needed)
        });
        
        deletedCount++;
        console.log(`Successfully deleted user: ${userId}`);
      } catch (error) {
        console.error(`Failed to delete user ${userId}:`, error.message);
        errors.push({
          userId: userId,
          error: error.message
        });
      }
    }

    console.log(`Deletion complete. Deleted ${deletedCount} out of ${usersToDelete.length} users`);

    return {
      success: true,
      message: `Successfully deleted ${deletedCount} users`,
      deletedCount: deletedCount,
      totalUsers: usersToDelete.length,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    console.error('Error in user deletion:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Hard delete a single user (permanent deletion)
 */
exports.hardDeleteStreamUser = onCall({
  cors: true,
  enforceAppCheck: false,
}, async (request) => {
  if (!request.auth) {
    return { success: false, error: 'Authentication required' };
  }

  const { userId } = request.data;

  if (!userId) {
    return { success: false, error: 'User ID is required' };
  }

  try {
    // Verify admin role
    const requestingUserDoc = await admin.firestore()
      .collection('users')
      .doc(request.auth.uid)
      .get();
    
    const requestingUser = requestingUserDoc.data();
    if (requestingUser.role !== 'admin') {
      return { success: false, error: 'Only admins can delete users' };
    }

    // Initialize Stream Chat
    const apiKey = process.env.STREAM_KEY || 'fgxkbmk4kp9f';
    const apiSecret = process.env.STREAM_SECRET || 'bh9rb2p38b9xcv3gm2t2fe9s7htv6wxv5gcpkb2dc6v4e85zxpptmc5h4m4fjs23';
    
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);

    // Hard delete the user (permanent)
    await serverClient.deleteUser(userId, {
      mark_messages_deleted: true,
      hard_delete: true // Permanent deletion
    });

    return {
      success: true,
      message: `User ${userId} has been permanently deleted from Stream Chat`
    };

  } catch (error) {
    console.error('Error in hard delete:', error);
    return { success: false, error: error.message };
  }
});