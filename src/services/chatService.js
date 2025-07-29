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
    try {
      const batch = writeBatch(firestore);
      
      // Add message to messages subcollection
      const messageRef = doc(collection(firestore, `messages/${conversationId}/messages`));
      const messageData = {
        senderId,
        senderName,
        text,
        type,
        fileUrl,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      };
      
      batch.set(messageRef, messageData);
      
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
        
        batch.update(conversationRef, {
          lastMessage: lastMessageData,
          lastActivity: serverTimestamp(),
          unreadCounts
        });
      }
      
      await batch.commit();
      return messageRef.id;
    } catch (error) {
      console.error('Error sending message:', error);
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

  // Real-time listeners
  subscribeToUserConversations(userId, callback) {
    const q = query(
      collection(firestore, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('lastActivity', 'desc'),
      limit(50)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const conversations = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(conversations);
    }, (error) => {
      console.error('Error in conversations listener:', error);
    });
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