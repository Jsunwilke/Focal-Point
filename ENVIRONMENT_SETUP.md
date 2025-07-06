# Environment Setup Guide

## Firebase Configuration

This application uses environment variables to securely manage Firebase credentials. **Never commit actual credentials to version control.**

### Initial Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Add your Firebase credentials to `.env.local`:**
   - Get your Firebase configuration from your Firebase Console
   - Replace all placeholder values in `.env.local` with your actual Firebase project values

3. **Required Environment Variables:**
   ```
   REACT_APP_FIREBASE_API_KEY=your_api_key_here
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id_here
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
   REACT_APP_FIREBASE_APP_ID=your_app_id_here
   REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id_here
   ```

### Security Features

- **No hardcoded credentials** - All sensitive data is in environment variables
- **Automatic validation** - App will not start if required variables are missing
- **Git protection** - `.env.local` is automatically ignored by Git
- **Clear error messages** - Helpful guidance if environment variables are missing

### For New Team Members

1. Ask a team administrator for the Firebase credentials
2. Copy `.env.example` to `.env.local`
3. Fill in the actual values (never share these in chat/email)
4. Start the development server with `npm start`

### Production Deployment

#### Firebase Hosting Deployment

Since Firebase Hosting serves static files, environment variables work differently:

**Option 1: Use Same Firebase Project (Recommended)**
```bash
# Build and deploy using production environment variables
npm run deploy
```

**Option 2: Separate Firebase Projects**
If you want separate development and production Firebase projects:

1. **Create a separate Firebase project for production**
2. **Update `.env.production` with production Firebase credentials**
3. **Deploy:**
   ```bash
   npm run deploy
   ```

#### Manual Deployment Steps

1. **Install Firebase CLI (if not already installed):**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase:**
   ```bash
   firebase login
   ```

3. **Initialize Firebase project (if not already done):**
   ```bash
   firebase init hosting
   ```

4. **Build and Deploy:**
   ```bash
   npm run build:prod  # Builds with production environment variables
   firebase deploy --only hosting
   ```

#### Environment Variable Handling

- **Development:** Uses `.env.local`
- **Production:** Uses `.env.production` 
- **Build Process:** Environment variables are embedded into the built JavaScript files
- **Security:** Since this is a client-side app, Firebase config values are not considered secrets

#### Deployment Scripts Available

```bash
npm run build:prod    # Build with production environment variables
npm run deploy        # Build and deploy to Firebase Hosting
npm run deploy:preview # Deploy to preview environment
```

#### Important Notes for Firebase Hosting

- Environment variables are embedded at **build time**, not runtime
- The same Firebase project can be used for both development and production
- Firebase configuration values (API keys, etc.) are safe to expose in client-side apps
- Database security is handled by Firestore security rules, not by hiding config values

### Troubleshooting

**Error: "Missing required environment variables"**
- Ensure `.env.local` exists and contains all required variables
- Check that variable names match exactly (case-sensitive)
- Restart your development server after adding variables

**Build/Start Issues:**
- Verify all environment variables are set correctly
- Clear cache: `npm start -- --reset-cache`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`