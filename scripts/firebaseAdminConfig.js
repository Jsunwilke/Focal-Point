const admin = require('firebase-admin');

// Firebase Admin SDK initialization
// Option 1: Using service account JSON file (recommended for production)
// Download from Firebase Console > Project Settings > Service Accounts
// const serviceAccount = require('./path-to-service-account-key.json');

// Option 2: Using default credentials (if running on Google Cloud)
// admin.initializeApp();

// Option 3: Initialize with project ID only (requires authentication)
// You'll need to authenticate using: firebase login
const initializeAdmin = () => {
  if (!admin.apps.length) {
    try {
      // Try to use service account if available
      const serviceAccount = require('./serviceAccountKey.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'focal-point-c452c'
      });
      console.log('✅ Initialized with service account');
    } catch (error) {
      // Fallback to default credentials
      try {
        admin.initializeApp({
          projectId: 'focal-point-c452c'
        });
        console.log('✅ Initialized with default credentials');
      } catch (err) {
        console.error('❌ Failed to initialize Firebase Admin SDK');
        console.error('Please ensure you have either:');
        console.error('1. A service account key file (serviceAccountKey.json) in the scripts directory');
        console.error('2. Or are authenticated with Firebase CLI (run: firebase login)');
        process.exit(1);
      }
    }
  }

  return {
    admin,
    firestore: admin.firestore(),
    auth: admin.auth()
  };
};

module.exports = { initializeAdmin };