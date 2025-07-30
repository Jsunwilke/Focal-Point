import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  getDoc,
  setDoc,
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
  firestore
} from '../services/firestoreWrapper';
import { getTeamMembers } from '../firebase/firestore';

class ChatService {
  // Create a new conversation
  async createConversation(participants, type = 'direct', customName = null) {
    try {
      const batch = writeBatch(firestore);
      
      // Generate default name based on type and participants
      const defaultName = type === 'direct' 
        ? `Direct conversation` 
        : `Group chat`;
      
      // Create conversation document
      const conversationRef = doc(collection(firestore, 'conversations'));
      const conversationData = {
        participants,
        type,
        name: customName,
        defaultName,
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        lastMessage: null,
        unreadCounts: participants.reduce((acc, userId) => {
          acc[userId] = 0;
          return acc;
        }, {})
      };
      
      batch.set(conversationRef, conversationData);
      
      await batch.commit();
      return conversationRef.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  // Send a message to a conversation
  async sendMessage(conversationId, senderId, text, type = 'text', fileUrl = null, senderName = 'Unknown User') {
    console.log('[ChatService] Attempting to send message:', {
      conversationId,
      senderId,
      textLength: text?.length,
      type,
      senderName,
      timestamp: new Date().toISOString()
    });

    try {
      // Debug: Check if conversationId is valid
      if (!conversationId) {
        throw new Error('conversationId is empty or undefined');
      }
      
      console.log('[ChatService] Creating message for conversation:', conversationId);
      
      // Create message data
      const messageData = {
        senderId,
        senderName,
        text,
        type,
        fileUrl,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      };
      
      console.log('[ChatService] Message data prepared:', { 
        messageData: { ...messageData, timestamp: 'serverTimestamp()' }
      });
      
      // Create a new document reference in the subcollection
      let messageRef;
      try {
        console.log('[ChatService] About to create message doc ref with:', {
          firestore: !!firestore,
          conversationId,
          path: `messages/${conversationId}/messages`
        });
        
        const messagesCollectionRef = collection(firestore, 'messages', conversationId, 'messages');
        console.log('[ChatService] Messages collection ref created, adding document...');
        
        // Use addDoc to create a new document with auto-generated ID
        messageRef = await addDoc(messagesCollectionRef, messageData);
        console.log('[ChatService] Message added successfully with ID:', messageRef.id);
      } catch (collectionError) {
        console.error('[ChatService] Error creating message:', collectionError);
        throw collectionError;
      }
      
      // Update conversation with last message and activity
      const conversationRef = doc(firestore, 'conversations', conversationId);
      const lastMessageData = {
        text: type === 'file' ? '📎 File' : text,
        senderId,
        timestamp: serverTimestamp()
      };
      
      console.log('[ChatService] Fetching conversation for unread count update...');
      
      // Get current conversation to update unread counts
      const conversationDoc = await getDoc(conversationRef, 'chatService.sendMessage');
      if (conversationDoc.exists()) {
        const conversation = conversationDoc.data();
        console.log('[ChatService] Conversation found, participants:', conversation.participants);
        
        const unreadCounts = { ...conversation.unreadCounts };
        
        // Increment unread count for all participants except sender
        conversation.participants.forEach(participantId => {
          if (participantId !== senderId) {
            unreadCounts[participantId] = (unreadCounts[participantId] || 0) + 1;
          }
        });
        
        console.log('[ChatService] Updated unread counts:', unreadCounts);
        
        // Update conversation document
        await updateDoc(conversationRef, {
          lastMessage: lastMessageData,
          lastActivity: serverTimestamp(),
          unreadCounts
        });
        
        console.log('[ChatService] Conversation updated successfully');
      } else {
        console.error('[ChatService] Conversation not found:', conversationId);
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      console.log('[ChatService] Message sent successfully:', messageRef.id);
      return messageRef.id;
    } catch (error) {
      console.error('[ChatService] Error sending message:', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        conversationId,
        senderId
      });
      throw error;
    }
  }

  // Get conversations for a user
  async getUserConversations(userId) {
    try {
      const q = query(
        collection(firestore, 'conversations'),
        where('participants', 'array-contains', userId),
        orderBy('lastActivity', 'desc'),
        limit(50)
      );
      
      const querySnapshot = await getDocs(q, 'chatService');
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting user conversations:', error);
      throw error;
    }
  }

  // Get messages for a conversation with pagination
  async getConversationMessages(conversationId, limitCount = 20, lastDoc = null) {
    try {
      let q = query(
        collection(firestore, `messages/${conversationId}/messages`),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      
      const querySnapshot = await getDocs(q, 'chatService');
      const messages = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return {
        messages: messages.reverse(), // Reverse to show chronologically
        lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
        hasMore: querySnapshot.docs.length === limitCount
      };
    } catch (error) {
      console.error('Error getting conversation messages:', error);
      throw error;
    }
  }

  // Mark messages as read
  async markMessagesAsRead(conversationId, userId) {
    try {
      const conversationRef = doc(firestore, 'conversations', conversationId);
      const conversationDoc = await getDoc(conversationRef, 'chatService.markMessagesAsRead');
      
      if (conversationDoc.exists()) {
        const conversation = conversationDoc.data();
        const unreadCounts = { ...conversation.unreadCounts };
        unreadCounts[userId] = 0;
        
        await updateDoc(conversationRef, { unreadCounts });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  // Update conversation name
  async updateConversationName(conversationId, newName) {
    try {
      const conversationRef = doc(firestore, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        name: newName
      });
    } catch (error) {
      console.error('Error updating conversation name:', error);
      throw error;
    }
  }

  // Toggle pin status for a conversation
  async togglePinConversation(conversationId, userId, isCurrentlyPinned) {
    try {
      console.log('[chatService] togglePinConversation called with:', {
        conversationId,
        userId,
        isCurrentlyPinned,
        action: isCurrentlyPinned ? 'UNPIN' : 'PIN'
      });
      
      const conversationRef = doc(firestore, 'conversations', conversationId);
      
      // First, check if the conversation has a pinnedBy field
      const conversationDoc = await getDoc(conversationRef, 'chatService.togglePinConversation');
      const conversationData = conversationDoc.data();
      
      if (!conversationData.pinnedBy) {
        // Initialize pinnedBy array if it doesn't exist
        console.log('[chatService] Initializing pinnedBy array');
        await updateDoc(conversationRef, {
          pinnedBy: isCurrentlyPinned ? [] : [userId]
        });
      } else {
        if (isCurrentlyPinned) {
          // Remove user from pinnedBy array (unpin)
          console.log('[chatService] Removing user from pinnedBy array (unpinning)');
          await updateDoc(conversationRef, {
            pinnedBy: arrayRemove(userId)
          });
        } else {
          // Add user to pinnedBy array (pin)
          console.log('[chatService] Adding user to pinnedBy array (pinning)');
          await updateDoc(conversationRef, {
            pinnedBy: arrayUnion(userId)
          });
        }
      }
      
      console.log('[chatService] Pin toggle completed successfully');
    } catch (error) {
      console.error('Error toggling pin status:', error);
      throw error;
    }
  }

  // Add participants to a conversation
  async addParticipantsToConversation(conversationId, newParticipantIds, addedByUserId, addedByUserName) {
    try {
      const conversationRef = doc(firestore, 'conversations', conversationId);
      
      // Get current conversation data
      const conversationDoc = await getDoc(conversationRef, 'chatService.addParticipants');
      if (!conversationDoc.exists()) {
        throw new Error('Conversation not found');
      }
      
      const conversation = conversationDoc.data();
      const currentUnreadCounts = conversation.unreadCounts || {};
      
      // Initialize unread counts for new participants
      const updatedUnreadCounts = { ...currentUnreadCounts };
      newParticipantIds.forEach(participantId => {
        if (!updatedUnreadCounts[participantId]) {
          updatedUnreadCounts[participantId] = 0;
        }
      });
      
      // Update conversation with new participants
      await updateDoc(conversationRef, {
        participants: arrayUnion(...newParticipantIds),
        unreadCounts: updatedUnreadCounts
      });
      
      // Add system message about new participants
      const messagesCollectionRef = collection(firestore, 'messages', conversationId, 'messages');
      const systemMessageData = {
        type: 'system',
        systemAction: 'participants_added',
        addedBy: addedByUserId,
        addedByName: addedByUserName,
        addedParticipants: newParticipantIds,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      };
      
      await addDoc(messagesCollectionRef, systemMessageData);
    } catch (error) {
      console.error('Error adding participants:', error);
      throw error;
    }
  }

  // Remove a participant from a conversation
  async removeParticipantFromConversation(conversationId, participantId, removedByUserId, removedByUserName, removedUserName) {
    try {
      const conversationRef = doc(firestore, 'conversations', conversationId);
      
      // Get current conversation data
      const conversationDoc = await getDoc(conversationRef, 'chatService.removeParticipant');
      if (!conversationDoc.exists()) {
        throw new Error('Conversation not found');
      }
      
      const conversation = conversationDoc.data();
      const updatedUnreadCounts = { ...conversation.unreadCounts };
      
      // Remove unread count for the participant
      delete updatedUnreadCounts[participantId];
      
      // Update conversation
      await updateDoc(conversationRef, {
        participants: arrayRemove(participantId),
        unreadCounts: updatedUnreadCounts
      });
      
      // Add system message about participant removal
      const messagesCollectionRef = collection(firestore, 'messages', conversationId, 'messages');
      const systemMessageData = {
        type: 'system',
        systemAction: 'participant_removed',
        removedBy: removedByUserId,
        removedByName: removedByUserName,
        removedParticipant: participantId,
        removedParticipantName: removedUserName,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      };
      
      await addDoc(messagesCollectionRef, systemMessageData);
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }

  // Leave a conversation (removes user from participants)
  async leaveConversation(conversationId, userId, userName) {
    try {
      const conversationRef = doc(firestore, 'conversations', conversationId);
      
      // Get current conversation data
      const conversationDoc = await getDoc(conversationRef, 'chatService.leaveConversation');
      if (!conversationDoc.exists()) {
        throw new Error('Conversation not found');
      }
      
      const conversation = conversationDoc.data();
      
      // Check if user is a participant
      if (!conversation.participants.includes(userId)) {
        throw new Error('User is not a participant in this conversation');
      }
      
      // For direct conversations, we can't leave (would need to delete)
      if (conversation.type === 'direct') {
        throw new Error('Cannot leave direct conversations');
      }
      
      // Check if this would leave less than 2 participants
      if (conversation.participants.length <= 2) {
        throw new Error('Cannot leave group - would have less than 2 participants');
      }
      
      // Remove user from participants and unread counts
      const updatedUnreadCounts = { ...conversation.unreadCounts };
      delete updatedUnreadCounts[userId];
      
      await updateDoc(conversationRef, {
        participants: arrayRemove(userId),
        unreadCounts: updatedUnreadCounts
      });
      
      // Add system message about user leaving
      const messagesCollectionRef = collection(firestore, 'messages', conversationId, 'messages');
      const systemMessageData = {
        type: 'system',
        systemAction: 'participant_left',
        leftUserId: userId,
        leftUserName: userName,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      };
      
      await addDoc(messagesCollectionRef, systemMessageData);
    } catch (error) {
      console.error('Error leaving conversation:', error);
      throw error;
    }
  }

  // Delete a conversation (admin only or last participant in group)
  async deleteConversation(conversationId, userId) {
    try {
      const conversationRef = doc(firestore, 'conversations', conversationId);
      
      // Get conversation to check permissions
      const conversationDoc = await getDoc(conversationRef, 'chatService.deleteConversation');
      if (!conversationDoc.exists()) {
        throw new Error('Conversation not found');
      }
      
      const conversation = conversationDoc.data();
      
      // Check if user is a participant
      if (!conversation.participants.includes(userId)) {
        throw new Error('Not authorized to delete this conversation');
      }
      
      // For now, we'll just remove the user from the conversation
      // Full deletion would require admin permissions or additional logic
      // You could implement soft delete by adding a 'deletedBy' field
      if (conversation.type === 'direct') {
        // For direct conversations, we could implement soft delete
        // by adding a deletedBy array to hide it from specific users
        console.warn('Direct conversation deletion not fully implemented');
        throw new Error('Direct conversation deletion coming soon');
      } else {
        // For groups, just leave the conversation
        await this.leaveConversation(conversationId, userId, 'User');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  // Real-time listeners
  subscribeToUserConversations(userId, callback) {
    console.log('[ChatService] Setting up conversations listener for user:', userId);
    
    const q = query(
      collection(firestore, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('lastActivity', 'desc'),
      limit(50)
    );
    
    return onSnapshot(q, 
      (querySnapshot) => {
        console.log('[ChatService] Conversations snapshot received:', {
          size: querySnapshot.size,
          fromCache: querySnapshot.metadata.fromCache,
          hasPendingWrites: querySnapshot.metadata.hasPendingWrites
        });
        
        const conversations = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('[ChatService] Processed conversations:', 
          conversations.map(c => ({ 
            id: c.id, 
            participants: c.participants,
            lastActivity: c.lastActivity?.toDate?.() || c.lastActivity 
          }))
        );
        
        callback(conversations);
      }, 
      (error) => {
        console.error('[ChatService] Error in conversations listener:', {
          error: error.message,
          code: error.code,
          userId
        });
      }
    );
  }

  subscribeToConversationMessages(conversationId, callback, limitCount = 20, startAfterTimestamp = null) {
    let q = query(
      collection(firestore, `messages/${conversationId}/messages`),
      orderBy('timestamp', 'desc')
    );

    // If we have a timestamp to start after, only get newer messages
    if (startAfterTimestamp) {
      q = query(q, where('timestamp', '>', startAfterTimestamp));
    } else {
      // Otherwise, apply the limit for initial load
      q = query(q, limit(limitCount));
    }
    
    return onSnapshot(q, (querySnapshot) => {
      const messages = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).reverse(); // Reverse to show chronologically
      
      callback(messages, startAfterTimestamp !== null);
    }, (error) => {
      console.error('Error in messages listener:', error);
    });
  }

  // New method for optimized real-time listening with cache integration
  subscribeToNewMessages(conversationId, callback, latestCachedTimestamp = null) {
    if (!latestCachedTimestamp) {
      // If no cached timestamp, use the regular method
      return this.subscribeToConversationMessages(conversationId, callback);
    }

    // Listen only for messages newer than the latest cached message
    const q = query(
      collection(firestore, `messages/${conversationId}/messages`),
      where('timestamp', '>', latestCachedTimestamp),
      orderBy('timestamp', 'desc')
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const newMessages = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).reverse(); // Reverse to show chronologically
      
      // Only call callback if there are actually new messages
      if (newMessages.length > 0) {
        callback(newMessages, true); // true indicates these are incremental messages
      }
    }, (error) => {
      console.error('Error in new messages listener:', error);
    });
  }

  // Update user presence
  async updateUserPresence(userId, isOnline, conversationId = null) {
    try {
      const presenceRef = doc(firestore, 'userPresence', userId);
      const presenceData = {
        isOnline,
        lastSeen: serverTimestamp(),
        conversationId
      };
      
      // Use set with merge to create document if it doesn't exist
      await updateDoc(presenceRef, presenceData);
    } catch (error) {
      // If document doesn't exist, create it
      if (error.code === 'not-found') {
        const presenceRef = doc(firestore, 'userPresence', userId);
        await setDoc(presenceRef, {
          isOnline,
          lastSeen: serverTimestamp(),
          conversationId
        });
      } else {
        console.error('Error updating user presence:', error);
        throw error;
      }
    }
  }

  // Get users in organization for employee selector
  async getOrganizationUsers(organizationId) {
    try {
      // Use the cached getTeamMembers function instead of direct query
      const users = await getTeamMembers(organizationId);
      return users;
    } catch (error) {
      console.error('Error getting organization users:', error);
      throw error;
    }
  }
}

export const chatService = new ChatService();
export default chatService;