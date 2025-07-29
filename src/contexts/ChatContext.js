import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import chatService from '../services/chatService';
import chatCacheService from '../services/chatCacheService';
import { readCounter } from '../services/readCounter';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  
  // State
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [organizationUsers, setOrganizationUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Pagination state for messages
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [lastMessageDoc, setLastMessageDoc] = useState(null);
  
  // Real-time listeners
  const [conversationsUnsubscribe, setConversationsUnsubscribe] = useState(null);
  const [messagesUnsubscribe, setMessagesUnsubscribe] = useState(null);

  // Load organization users on mount
  useEffect(() => {
    const loadOrganizationUsers = async () => {
      if (userProfile?.organizationID) {
        try {
          const users = await chatService.getOrganizationUsers(userProfile.organizationID);
          setOrganizationUsers(users.filter(user => user.id !== userProfile.id));
        } catch (error) {
          console.error('Error loading organization users:', error);
          showToast('Failed to load team members', 'error');
        }
      }
    };

    loadOrganizationUsers();
  }, [userProfile, showToast]);

  // Set up conversations listener with cache-first loading
  useEffect(() => {
    if (!userProfile?.id) return;

    // Load conversations from cache first for instant display
    const cachedConversations = chatCacheService.getCachedConversations();
    if (cachedConversations) {
      setConversations(cachedConversations);
      setLoading(false);
      
      // Track cache hit
      readCounter.recordCacheHit('conversations', 'ChatContext', cachedConversations.length);
    } else {
      // Track cache miss
      readCounter.recordCacheMiss('conversations', 'ChatContext');
    }

    const unsubscribe = chatService.subscribeToUserConversations(
      userProfile.id,
      (updatedConversations) => {
        setConversations(updatedConversations);
        setLoading(false);
        
        // Cache the updated conversations
        chatCacheService.setCachedConversations(updatedConversations);
      }
    );

    setConversationsUnsubscribe(() => unsubscribe);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userProfile?.id]);

  // Set up messages listener for active conversation with cache-first loading
  useEffect(() => {
    if (!activeConversation?.id) {
      setMessages([]);
      setHasMoreMessages(false);
      setLastMessageDoc(null);
      return;
    }

    // Load messages from cache first for instant display
    const cachedMessages = chatCacheService.getCachedMessages(activeConversation.id);
    const latestCachedTimestamp = chatCacheService.getLatestCachedMessageTimestamp(activeConversation.id);
    
    if (cachedMessages && cachedMessages.length > 0) {
      setMessages(cachedMessages);
      setMessagesLoading(false);
      
      // Track cache hit
      readCounter.recordCacheHit('messages', 'ChatContext', cachedMessages.length);
    } else {
      // Track cache miss
      readCounter.recordCacheMiss('messages', 'ChatContext');
    }

    // Use optimized listener that only fetches new messages if we have cache
    let unsubscribe;
    if (latestCachedTimestamp) {
      // Listen only for messages newer than cached ones
      unsubscribe = chatService.subscribeToNewMessages(
        activeConversation.id,
        (newMessages, isIncremental) => {
          if (isIncremental) {
            // Append new messages to cached ones
            const updatedMessages = chatCacheService.appendNewMessages(activeConversation.id, newMessages);
            setMessages(updatedMessages);
          } else {
            // Full message set (fallback)
            setMessages(newMessages);
            chatCacheService.setCachedMessages(activeConversation.id, newMessages);
          }
          setMessagesLoading(false);
          
          // Mark messages as read when we receive them
          if (userProfile?.id) {
            chatService.markMessagesAsRead(activeConversation.id, userProfile.id);
          }
        },
        latestCachedTimestamp
      );
    } else {
      // No cache, use regular listener
      unsubscribe = chatService.subscribeToConversationMessages(
        activeConversation.id,
        (updatedMessages) => {
          setMessages(updatedMessages);
          setMessagesLoading(false);
          
          // Cache the messages
          chatCacheService.setCachedMessages(activeConversation.id, updatedMessages);
          
          // Mark messages as read when we receive them
          if (userProfile?.id) {
            chatService.markMessagesAsRead(activeConversation.id, userProfile.id);
          }
        }
      );
    }

    setMessagesUnsubscribe(() => unsubscribe);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [activeConversation?.id, userProfile?.id]);

  // Create new conversation
  const createConversation = useCallback(async (participantIds, type = 'direct', customName = null) => {
    try {
      if (!userProfile?.id) {
        throw new Error('User not authenticated');
      }

      // Include current user in participants
      const allParticipants = [userProfile.id, ...participantIds.filter(id => id !== userProfile.id)];
      
      // Check if direct conversation already exists
      if (type === 'direct' && allParticipants.length === 2) {
        const existingConversation = conversations.find(conv => 
          conv.type === 'direct' && 
          conv.participants.length === 2 &&
          conv.participants.every(p => allParticipants.includes(p))
        );
        
        if (existingConversation) {
          setActiveConversation(existingConversation);
          return existingConversation.id;
        }
      }

      const conversationId = await chatService.createConversation(allParticipants, type, customName);
      
      // Find the newly created conversation in our list
      const newConversation = conversations.find(conv => conv.id === conversationId);
      if (newConversation) {
        setActiveConversation(newConversation);
      }
      
      showToast('Conversation created successfully', 'success');
      return conversationId;
    } catch (error) {
      console.error('Error creating conversation:', error);
      showToast('Failed to create conversation', 'error');
      throw error;
    }
  }, [userProfile?.id, conversations, showToast]);

  // Send message
  const sendMessage = useCallback(async (text, type = 'text', fileUrl = null) => {
    if (!activeConversation?.id || !userProfile?.id || !text.trim()) {
      return;
    }

    setSendingMessage(true);
    try {
      // Get sender name for the message
      const senderName = userProfile.displayName || 
                        `${userProfile.firstName} ${userProfile.lastName}`.trim() || 
                        userProfile.email || 
                        'Unknown User';

      await chatService.sendMessage(
        activeConversation.id,
        userProfile.id,
        text.trim(),
        type,
        fileUrl,
        senderName
      );

      // Note: The real-time listener will handle updating the cache
      // when the new message comes through
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Failed to send message', 'error');
    } finally {
      setSendingMessage(false);
    }
  }, [activeConversation?.id, userProfile?.id, userProfile?.displayName, userProfile?.firstName, userProfile?.lastName, userProfile?.email, showToast]);

  // Load more messages (pagination) with cache integration
  const loadMoreMessages = useCallback(async () => {
    if (!activeConversation?.id || messagesLoading || !hasMoreMessages) {
      return;
    }

    setMessagesLoading(true);
    try {
      // Check if we can serve older messages from cache first
      const oldestCachedTimestamp = chatCacheService.getOldestCachedMessageTimestamp(activeConversation.id);
      
      if (oldestCachedTimestamp) {
        // Check cache for older messages before fetching from Firestore
        const cachedPage = chatCacheService.getCachedMessagePage(activeConversation.id, 20, oldestCachedTimestamp);
        
        if (cachedPage.messages.length > 0) {
          // We have older cached messages, use them
          const updatedMessages = [...cachedPage.messages, ...messages];
          setMessages(updatedMessages);
          setHasMoreMessages(cachedPage.hasMore);
          
          // Track cache hit
          readCounter.recordCacheHit('messages', 'ChatContext-pagination', cachedPage.messages.length);
          
          setMessagesLoading(false);
          return;
        }
      }

      // No cache or cache exhausted, fetch from Firestore
      readCounter.recordCacheMiss('messages', 'ChatContext-pagination');
      
      const { messages: olderMessages, lastDoc, hasMore } = await chatService.getConversationMessages(
        activeConversation.id,
        20,
        lastMessageDoc
      );

      // Merge with existing messages and update cache
      const updatedMessages = chatCacheService.prependOlderMessages(activeConversation.id, olderMessages);
      setMessages([...olderMessages, ...messages]);
      setLastMessageDoc(lastDoc);
      setHasMoreMessages(hasMore);
    } catch (error) {
      console.error('Error loading more messages:', error);
      showToast('Failed to load more messages', 'error');
    } finally {
      setMessagesLoading(false);
    }
  }, [activeConversation?.id, messagesLoading, hasMoreMessages, lastMessageDoc, messages, showToast]);

  // Update conversation name
  const updateConversationName = useCallback(async (conversationId, newName) => {
    try {
      await chatService.updateConversationName(conversationId, newName);
      showToast('Conversation name updated', 'success');
    } catch (error) {
      console.error('Error updating conversation name:', error);
      showToast('Failed to update conversation name', 'error');
    }
  }, [showToast]);

  // Get conversation display name
  const getConversationDisplayName = useCallback((conversation) => {
    if (!conversation || !userProfile?.id) return 'Unknown';

    // Use custom name if set
    if (conversation.name) {
      return conversation.name;
    }

    // For direct conversations, show the other person's name
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find(p => p !== userProfile.id);
      const otherUser = organizationUsers.find(user => user.id === otherParticipant);
      return otherUser ? `${otherUser.firstName} ${otherUser.lastName}` : 'Unknown User';
    }

    // For group conversations, show participant names or default name
    if (conversation.type === 'group') {
      const participantNames = conversation.participants
        .filter(p => p !== userProfile.id)
        .map(p => {
          const user = organizationUsers.find(user => user.id === p);
          return user ? user.firstName : 'Unknown';
        })
        .slice(0, 3); // Show max 3 names

      if (participantNames.length > 0) {
        return participantNames.join(', ') + (conversation.participants.length > 4 ? '...' : '');
      }
    }

    return conversation.defaultName || 'Conversation';
  }, [userProfile?.id, organizationUsers]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (conversationsUnsubscribe) {
        conversationsUnsubscribe();
      }
      if (messagesUnsubscribe) {
        messagesUnsubscribe();
      }
    };
  }, [conversationsUnsubscribe, messagesUnsubscribe]);

  const value = {
    // State
    conversations,
    activeConversation,
    messages,
    organizationUsers,
    loading,
    sendingMessage,
    messagesLoading,
    hasMoreMessages,

    // Actions
    setActiveConversation,
    createConversation,
    sendMessage,
    loadMoreMessages,
    updateConversationName,
    getConversationDisplayName,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};