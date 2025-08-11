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
import dataCacheService from './dataCacheService';

class ChatService {
  // Create a new conversation
  async createConversation(participants, type = 'direct', customName = null) {
    try {
      // Validate participants
      if (!participants || !Array.isArray(participants)) {
        throw new Error('Invalid participants array');
      }
      
      const validParticipants = participants.filter(id => id && typeof id === 'string');
      if (validParticipants.length === 0) {
        throw new Error('No valid participants provided');
      }
      
      
      // Generate default name based on type and participants
      const defaultName = type === 'direct' 
        ? `Direct conversation` 
        : `Group chat`;
      
      const conversationData = {
        participants: validParticipants, // Use validated participants
        type,
        name: customName,
        defaultName,
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        lastMessage: null,
        unreadCounts: validParticipants.reduce((acc, userId) => {
          acc[userId] = 0;
          return acc;
        }, {})
      };
      
      // Use addDoc to create a new conversation with auto-generated ID
      const conversationRef = await addDoc(collection(firestore, 'conversations'), conversationData);
      
      return conversationRef.id;
    } catch (error) {
      throw error;
    }
  }

  // Send a message to a conversation
  async sendMessage(conversationId, senderId, text, type = 'text', fileUrl = null, senderName = 'Unknown User') {

    try {
      // Debug: Check if conversationId is valid
      if (!conversationId) {
        throw new Error('conversationId is empty or undefined');
      }
      
      
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
      
      
      // Create a new document reference in the subcollection
      let messageRef;
      try {
        
        const messagesCollectionRef = collection(firestore, 'messages', conversationId, 'messages');
        
        // Use addDoc to create a new document with auto-generated ID
        messageRef = await addDoc(messagesCollectionRef, messageData);
      } catch (collectionError) {
        throw collectionError;
      }
      
      // Update conversation with last message and activity
      const conversationRef = doc(firestore, 'conversations', conversationId);
      const lastMessageData = {
        text: type === 'file' ? '📎 File' : text,
        senderId,
        timestamp: serverTimestamp()
      };
      
      
      // Get current conversation to update unread counts
      const conversationDoc = await getDoc(conversationRef, 'chatService.sendMessage');
      if (conversationDoc.exists()) {
        const conversation = conversationDoc.data();
        
        const unreadCounts = { ...conversation.unreadCounts };
        
        // Increment unread count for all participants except sender
        conversation.participants.forEach(participantId => {
          if (participantId !== senderId) {
            unreadCounts[participantId] = (unreadCounts[participantId] || 0) + 1;
          }
        });
        
        
        // Update conversation document
        await updateDoc(conversationRef, {
          lastMessage: lastMessageData,
          lastActivity: serverTimestamp(),
          unreadCounts
        });
        
      } else {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      return messageRef.id;
    } catch (error) {
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
      throw error;
    }
  }

  // Toggle pin status for a conversation
  async togglePinConversation(conversationId, userId, isCurrentlyPinned) {
    try {
      
      const conversationRef = doc(firestore, 'conversations', conversationId);
      
      // First, check if the conversation has a pinnedBy field
      const conversationDoc = await getDoc(conversationRef, 'chatService.togglePinConversation');
      const conversationData = conversationDoc.data();
      
      if (!conversationData.pinnedBy) {
        // Initialize pinnedBy array if it doesn't exist
        await updateDoc(conversationRef, {
          pinnedBy: isCurrentlyPinned ? [] : [userId]
        });
      } else {
        if (isCurrentlyPinned) {
          // Remove user from pinnedBy array (unpin)
          await updateDoc(conversationRef, {
            pinnedBy: arrayRemove(userId)
          });
        } else {
          // Add user to pinnedBy array (pin)
          await updateDoc(conversationRef, {
            pinnedBy: arrayUnion(userId)
          });
        }
      }
      
    } catch (error) {
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
      throw error;
    }
  }

  // Admin delete conversation - permanently deletes conversation and all messages
  async adminDeleteConversation(conversationId, userId, userRole) {
    try {
      
      // Check if user is admin
      if (userRole !== 'admin') {
        throw new Error('Only administrators can delete conversations');
      }

      const conversationRef = doc(firestore, 'conversations', conversationId);
      
      // Get conversation to verify it exists
      const conversationDoc = await getDoc(conversationRef, 'chatService.adminDeleteConversation');
      if (!conversationDoc.exists()) {
        throw new Error('Conversation not found');
      }
      
      // Create batch for all deletions
      const batch = writeBatch(firestore);
      
      // Delete all messages in the conversation
      try {
        const messagesRef = collection(firestore, 'messages', conversationId, 'messages');
        const messagesSnapshot = await getDocs(messagesRef, 'chatService.adminDelete');
        
        messagesSnapshot.docs.forEach((messageDoc) => {
          batch.delete(messageDoc.ref);
        });
      } catch (msgError) {
        // Continue even if messages collection doesn't exist
      }
      
      // Delete the conversation document itself
      batch.delete(conversationRef);
      
      // Commit all deletions
      await batch.commit();
      
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Delete a conversation (for regular users - just leaves the conversation)
  async deleteConversation(conversationId, userId, userName = 'User') {
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
      
      // For regular users, just leave the conversation
      await this.leaveConversation(conversationId, userId, userName);
      return { success: true, action: 'left' };
    } catch (error) {
      throw error;
    }
  }

  // Real-time listeners
  subscribeToUserConversations(userId, callback) {
    
    const q = query(
      collection(firestore, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('lastActivity', 'desc'),
      limit(50)
    );
    
    return onSnapshot(q, 
      (querySnapshot) => {
        
        const conversations = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        
        callback(conversations);
      }, 
      (error) => {
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
        throw error;
      }
    }
  }

  // Get users in organization for employee selector
  async getOrganizationUsers(organizationId) {
    try {
      // First check if we have cached users
      const cachedUsers = dataCacheService.getCachedUsers(organizationId);
      if (cachedUsers && cachedUsers.length > 0) {
        return cachedUsers;
      }
      
      // Fall back to direct query if no cache
      const users = await getTeamMembers(organizationId);
      return users;
    } catch (error) {
      throw error;
    }
  }
}

export const chatService = new ChatService();
export default chatService;