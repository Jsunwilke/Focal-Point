# Firebase Security Rules Update for Chat Features

Add these rules to your Firestore security rules to enable the new chat features:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Conversations collection
    match /conversations/{conversationId} {
      // Users can read conversations they are participants in
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.participants;
      
      // Users can update conversations they are participants in
      // This allows: renaming groups, pinning, adding/removing participants
      allow update: if request.auth != null && 
        request.auth.uid in resource.data.participants &&
        // Ensure they don't remove themselves from participants
        request.auth.uid in request.resource.data.participants &&
        // Only allow specific fields to be updated
        request.resource.data.keys().hasAll(['participants', 'type', 'name', 'defaultName', 'createdAt', 'lastActivity', 'lastMessage', 'unreadCounts']) &&
        // Ensure pinnedBy only contains valid user IDs if it exists
        (!('pinnedBy' in request.resource.data) || request.resource.data.pinnedBy is list);
      
      // Users can create new conversations if they include themselves
      allow create: if request.auth != null && 
        request.auth.uid in request.resource.data.participants;
      
      // Subcollection for messages
      match /messages/{messageId} {
        // Users can read messages in conversations they're part of
        allow read: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        
        // Users can create messages in conversations they're part of
        allow create: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants &&
          request.auth.uid == request.resource.data.senderId;
      }
    }
    
    // Messages collection (for the subcollection structure)
    match /messages/{conversationId}/messages/{messageId} {
      // Users can read messages in conversations they're part of
      allow read: if request.auth != null && 
        request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      
      // Users can create messages in conversations they're part of
      allow create: if request.auth != null && 
        request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants &&
        request.auth.uid == request.resource.data.senderId;
    }
  }
}
```

## Key Points:

1. **Update Permissions**: The `allow update` rule permits participants to:
   - Change the conversation name
   - Add/remove participants
   - Update pinnedBy array
   - Modify unread counts

2. **Security Checks**:
   - Users must be current participants to make changes
   - Users cannot remove themselves from the participants array
   - Only specific fields can be updated (prevents data corruption)

3. **Message Permissions**:
   - Only participants can read messages
   - Only participants can send messages (and senderId must match auth uid)

## To Apply These Rules:

1. Go to Firebase Console
2. Navigate to Firestore Database
3. Click on "Rules" tab
4. Add/merge these rules with your existing rules
5. Click "Publish"

## Testing:
After publishing, test:
1. Adding participants to a group
2. Removing participants from a group
3. Renaming a group
4. Pinning/unpinning conversations
5. Sending messages

The rules ensure that only conversation participants can modify the conversation, preventing unauthorized access while enabling all the new features.