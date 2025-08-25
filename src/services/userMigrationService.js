import { getAllOrganizationUsers } from '../firebase/firestore';
import streamChatService from './streamChatService';
import { readCounter } from './readCounter';

class UserMigrationService {
  constructor() {
    this.migrationKey = 'focal_stream_user_migration';
    this.isMigrating = false;
  }

  // Check if migration has been completed for an organization
  hasMigrationCompleted(organizationID) {
    try {
      const migrations = JSON.parse(localStorage.getItem(this.migrationKey) || '{}');
      return migrations[organizationID]?.completed === true;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  // Mark migration as completed
  markMigrationComplete(organizationID) {
    try {
      const migrations = JSON.parse(localStorage.getItem(this.migrationKey) || '{}');
      migrations[organizationID] = {
        completed: true,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      localStorage.setItem(this.migrationKey, JSON.stringify(migrations));
    } catch (error) {
      console.error('Error marking migration complete:', error);
    }
  }

  // Reset migration status (for debugging/re-running)
  resetMigrationStatus(organizationID) {
    try {
      const migrations = JSON.parse(localStorage.getItem(this.migrationKey) || '{}');
      delete migrations[organizationID];
      localStorage.setItem(this.migrationKey, JSON.stringify(migrations));
    } catch (error) {
      console.error('Error resetting migration status:', error);
    }
  }

  // Migrate all users from Firebase to Stream Chat
  async migrateOrganizationUsers(organizationID, options = {}) {
    const { 
      dryRun = false, 
      onProgress = null,
      batchSize = 20 
    } = options;

    if (this.isMigrating) {
      console.log('Migration already in progress');
      return { success: false, error: 'Migration already in progress' };
    }

    this.isMigrating = true;
    const results = {
      success: true,
      totalUsers: 0,
      syncedUsers: 0,
      failedUsers: [],
      errors: []
    };

    try {
      console.log(`Starting user migration for organization ${organizationID}`);
      
      // Check if Stream Chat client is connected
      if (!streamChatService.isConnected()) {
        throw new Error('Stream Chat is not connected. Please wait for chat to load before syncing users.');
      }

      // Fetch all users from Firebase
      console.log('Fetching users from Firebase...');
      readCounter.recordRead('getAllOrganizationUsers', 'users', 'UserMigration', 1);
      const firebaseUsers = await getAllOrganizationUsers(organizationID);
      results.totalUsers = firebaseUsers.length;

      if (firebaseUsers.length === 0) {
        console.log('No users found to migrate');
        this.markMigrationComplete(organizationID);
        return results;
      }

      console.log(`Found ${firebaseUsers.length} users to migrate`);
      
      // Process users in batches
      for (let i = 0; i < firebaseUsers.length; i += batchSize) {
        const batch = firebaseUsers.slice(i, Math.min(i + batchSize, firebaseUsers.length));
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(firebaseUsers.length / batchSize);
        
        console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} users)`);
        
        if (onProgress) {
          onProgress({
            current: i,
            total: firebaseUsers.length,
            percentage: Math.round((i / firebaseUsers.length) * 100),
            message: `Syncing batch ${batchNumber} of ${totalBatches}`
          });
        }

        // Process each user in the batch
        const batchPromises = batch.map(async (firebaseUser) => {
          try {
            // Format user data for Stream Chat
            const streamUserData = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL || firebaseUser.originalPhotoURL,
              role: firebaseUser.role || 'user',
              organizationID: firebaseUser.organizationID,
              isActive: firebaseUser.isActive !== false
            };

            if (dryRun) {
              console.log(`[DRY RUN] Would sync user: ${streamUserData.email}`);
              return { success: true, user: streamUserData };
            }

            // Sync user to Stream Chat
            await streamChatService.upsertUser(streamUserData);
            results.syncedUsers++;
            
            console.log(`✓ Synced user: ${streamUserData.email}`);
            return { success: true, user: streamUserData };
          } catch (error) {
            console.error(`✗ Failed to sync user ${firebaseUser.email}:`, error.message);
            results.failedUsers.push({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              error: error.message
            });
            return { success: false, user: firebaseUser, error: error.message };
          }
        });

        // Wait for batch to complete
        await Promise.allSettled(batchPromises);
        
        // Add delay between batches to avoid rate limiting
        if (i + batchSize < firebaseUsers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Mark migration as complete if not in dry run mode
      if (!dryRun && results.failedUsers.length === 0) {
        this.markMigrationComplete(organizationID);
        console.log('Migration completed successfully');
      } else if (results.failedUsers.length > 0) {
        console.warn(`Migration completed with ${results.failedUsers.length} failures`);
        results.errors.push(`Failed to sync ${results.failedUsers.length} users`);
      }

      if (onProgress) {
        onProgress({
          current: results.totalUsers,
          total: results.totalUsers,
          percentage: 100,
          message: 'Migration complete'
        });
      }

    } catch (error) {
      console.error('Migration failed:', error);
      results.success = false;
      results.errors.push(error.message);
    } finally {
      this.isMigrating = false;
    }

    // Log summary
    console.log('Migration Summary:', {
      totalUsers: results.totalUsers,
      syncedUsers: results.syncedUsers,
      failedUsers: results.failedUsers.length,
      success: results.success
    });

    return results;
  }

  // Sync a single user (for on-demand sync)
  async syncSingleUser(firebaseUser) {
    try {
      // Skip if Stream Chat is not connected
      if (!streamChatService.isConnected()) {
        console.log('Stream Chat not connected, skipping user sync');
        return { success: false, error: 'Stream Chat not connected' };
      }

      const streamUserData = {
        uid: firebaseUser.uid || firebaseUser.id,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL || firebaseUser.originalPhotoURL,
        role: firebaseUser.role || 'user',
        organizationID: firebaseUser.organizationID,
        isActive: firebaseUser.isActive !== false
      };

      await streamChatService.upsertUser(streamUserData);
      console.log(`User synced to Stream Chat: ${streamUserData.email}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to sync user:', error);
      return { success: false, error: error.message };
    }
  }

  // Batch sync specific users
  async syncUsers(firebaseUsers) {
    const results = [];
    
    for (const user of firebaseUsers) {
      const result = await this.syncSingleUser(user);
      results.push({ user, ...result });
    }
    
    return results;
  }
}

// Create singleton instance
const userMigrationService = new UserMigrationService();
export default userMigrationService;