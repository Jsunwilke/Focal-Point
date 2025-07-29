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

  // Force refresh conversations (bypasses cache)
  const forceRefreshConversations = useCallback(async () => {
    console.log('[ChatContext] Force refreshing conversations...');
    if (!userProfile?.id) return;
    
    try {
      // Clear cache first
      chatCacheService.clearConversationsCache();
      
      // Reload conversations directly
      const conversations = await chatService.getUserConversations(userProfile.id);
      setConversations(conversations);
      chatCacheService.setCachedConversations(conversations);
      
      console.log('[ChatContext] Force refresh complete, found', conversations.length, 'conversations');
    } catch (error) {
      console.error('[ChatContext] Error force refreshing conversations:', error);
      showToast('Failed to refresh conversations', 'error');
    }
  }, [userProfile?.id, showToast]);

  // Set up conversations listener with cache-first loading
  useEffect(() => {
    if (!userProfile?.id) {
      console.log('[ChatContext] No user profile, skipping conversation setup');
      return;
    }

    console.log('[ChatContext] Setting up conversations for user:', userProfile.id);

    // Load conversations from cache first for instant display
    const cachedConversations = chatCacheService.getCachedConversations();
    if (cachedConversations) {
      console.log('[ChatContext] Loading', cachedConversations.length, 'conversations from cache');
      setConversations(cachedConversations);
      setLoading(false);
      
      // Track cache hit
      readCounter.recordCacheHit('conversations', 'ChatContext', cachedConversations.length);
    } else {
      console.log('[ChatContext] No cached conversations found');
      // Track cache miss
      readCounter.recordCacheMiss('conversations', 'ChatContext');
    }

    const unsubscribe = chatService.subscribeToUserConversations(
      userProfile.id,
      (updatedConversations) => {
        console.log('[ChatContext] Received', updatedConversations.length, 'conversations from listener');
        setConversations(updatedConversations);
        setLoading(false);
        
        // Cache the updated conversations
        chatCacheService.setCachedConversations(updatedConversations);
      }
    );

    setConversationsUnsubscribe(() => unsubscribe);

    return () => {
      if (unsubscribe) {
        console.log('[ChatContext] Cleaning up conversations listener');
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
    console.log('[ChatContext] sendMessage called:', {
      hasActiveConversation: !!activeConversation?.id,
      activeConversationId: activeConversation?.id,
      hasUserProfile: !!userProfile?.id,
      userProfileId: userProfile?.id,
      textLength: text?.trim()?.length,
      textContent: text?.substring(0, 50) + '...'
    });

    if (!activeConversation?.id || !userProfile?.id || !text.trim()) {
      console.error('[ChatContext] Cannot send message - missing required data:', {
        activeConversation: activeConversation?.id,
        userProfile: userProfile?.id,
        textEmpty: !text.trim()
      });
      return;
    }

    setSendingMessage(true);
    try {
      // Get sender name for the message
      const senderName = userProfile.displayName || 
                        `${userProfile.firstName} ${userProfile.lastName}`.trim() || 
                        userProfile.email || 
                        'Unknown User';

      console.log('[ChatContext] Calling chatService.sendMessage with:', {
        conversationId: activeConversation.id,
        userId: userProfile.id,
        senderName,
        type
      });

      await chatService.sendMessage(
        activeConversation.id,
        userProfile.id,
        text.trim(),
        type,
        fileUrl,
        senderName
      );

      console.log('[ChatContext] Message sent successfully');
      // Note: The real-time listener will handle updating the cache
      // when the new message comes through
    } catch (error) {
      console.error('[ChatContext] Error sending message:', error);
      showToast(`Failed to send message: ${error.message}`, 'error');
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
      
      // Update local state
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId ? { ...conv, name: newName } : conv
      ));
      
      // Update active conversation if it's the one being renamed
      if (activeConversation?.id === conversationId) {
        setActiveConversation(prev => ({ ...prev, name: newName }));
      }
      
      showToast('Conversation name updated', 'success');
    } catch (error) {
      console.error('Error updating conversation name:', error);
      showToast('Failed to update conversation name', 'error');
    }
  }, [activeConversation?.id, showToast]);

  // Toggle pin conversation
  const togglePinConversation = useCallback(async (conversationId, isPinned) => {
    if (!userProfile?.id) return;
    
    try {
      await chatService.togglePinConversation(conversationId, userProfile.id, isPinned);
      
      // Update local state
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          const pinnedBy = conv.pinnedBy || [];
          if (isPinned) {
            return { ...conv, pinnedBy: [...pinnedBy, userProfile.id] };
          } else {
            return { ...conv, pinnedBy: pinnedBy.filter(id => id !== userProfile.id) };
          }
        }
        return conv;
      }));
      
      showToast(isPinned ? 'Conversation pinned' : 'Conversation unpinned', 'success');
    } catch (error) {
      console.error('Error toggling pin:', error);
      showToast('Failed to update pin status', 'error');
    }
  }, [userProfile?.id, showToast]);

  // Add participants to conversation
  const addParticipantsToConversation = useCallback(async (conversationId, newParticipants) => {
    try {
      const newParticipantIds = newParticipants.map(user => user.id);
      const addedByUserName = `${userProfile.firstName} ${userProfile.lastName}`;
      
      await chatService.addParticipantsToConversation(
        conversationId, 
        newParticipantIds, 
        userProfile.id,
        addedByUserName
      );
      
      // Update local state
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return { 
            ...conv, 
            participants: [...new Set([...conv.participants, ...newParticipantIds])]
          };
        }
        return conv;
      }));
      
      if (activeConversation?.id === conversationId) {
        setActiveConversation(prev => ({
          ...prev,
          participants: [...new Set([...prev.participants, ...newParticipantIds])]
        }));
      }
      
      showToast(`Added ${newParticipants.length} participant${newParticipants.length > 1 ? 's' : ''}`, 'success');
    } catch (error) {
      console.error('Error adding participants:', error);
      showToast('Failed to add participants', 'error');
    }
  }, [activeConversation?.id, userProfile?.id, userProfile?.firstName, userProfile?.lastName, showToast]);

  // Remove participant from conversation
  const removeParticipantFromConversation = useCallback(async (conversationId, participantId) => {
    try {
      const removedByUserName = `${userProfile.firstName} ${userProfile.lastName}`;
      
      // Get the name of the user being removed
      const removedUser = organizationUsers.find(u => u.id === participantId);
      const removedUserName = removedUser 
        ? `${removedUser.firstName} ${removedUser.lastName}`
        : 'Unknown User';
      
      await chatService.removeParticipantFromConversation(
        conversationId, 
        participantId,
        userProfile.id,
        removedByUserName,
        removedUserName
      );
      
      // Update local state
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return { 
            ...conv, 
            participants: conv.participants.filter(id => id !== participantId)
          };
        }
        return conv;
      }));
      
      if (activeConversation?.id === conversationId) {
        setActiveConversation(prev => ({
          ...prev,
          participants: prev.participants.filter(id => id !== participantId)
        }));
      }
      
      showToast('Participant removed', 'success');
    } catch (error) {
      console.error('Error removing participant:', error);
      showToast('Failed to remove participant', 'error');
    }
  }, [activeConversation?.id, organizationUsers, userProfile?.id, userProfile?.firstName, userProfile?.lastName, showToast]);

  // Leave a conversation
  const leaveConversation = useCallback(async (conversationId) => {
    try {
      const userName = `${userProfile.firstName} ${userProfile.lastName}`;
      await chatService.leaveConversation(conversationId, userProfile.id, userName);
      
      // Remove from local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // Clear active conversation if it's the one being left
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
        setMessages([]);
      }
      
      showToast('Left conversation', 'success');
    } catch (error) {
      console.error('Error leaving conversation:', error);
      showToast(error.message || 'Failed to leave conversation', 'error');
    }
  }, [activeConversation?.id, userProfile?.id, userProfile?.firstName, userProfile?.lastName, showToast]);

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
    forceRefreshConversations,
    togglePinConversation,
    addParticipantsToConversation,
    removeParticipantFromConversation,
    leaveConversation,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};