import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useDataCache } from './DataCacheContext';
import chatService from '../services/chatService';
import chatCacheService from '../services/chatCacheService';
import { readCounter } from '../services/readCounter';
import notificationService from '../services/notificationService';

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
  const { users: cachedUsers } = useDataCache();
  
  // State
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [organizationUsers, setOrganizationUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isMainChatView, setIsMainChatView] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [messageStatuses, setMessageStatuses] = useState({});
  
  // Pagination state for messages
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [lastMessageDoc, setLastMessageDoc] = useState(null);
  
  // Real-time listeners
  const [conversationsUnsubscribe, setConversationsUnsubscribe] = useState(null);
  const [messagesUnsubscribe, setMessagesUnsubscribe] = useState(null);

  // Use cached users from DataCacheContext
  useEffect(() => {
    if (cachedUsers && cachedUsers.length > 0 && userProfile?.id) {
      
      // Filter out current user and any users without IDs
      const validUsers = cachedUsers.filter(user => user.id && user.id !== userProfile.id);
      setOrganizationUsers(validUsers);
    } else if (userProfile?.organizationID && !cachedUsers) {
      // Only fetch if we don't have cached users
      const loadOrganizationUsers = async () => {
        try {
          const users = await chatService.getOrganizationUsers(userProfile.organizationID);
          
          // Filter out current user and any users without IDs
          const validUsers = users.filter(user => user.id && user.id !== userProfile.id);
          setOrganizationUsers(validUsers);
        } catch (error) {
          console.error('Error loading organization users:', error);
          showToast('Failed to load team members', 'error');
        }
      };
      
      loadOrganizationUsers();
    }
  }, [cachedUsers, userProfile, showToast]);

  // Force refresh conversations (bypasses cache)
  const forceRefreshConversations = useCallback(async () => {
    if (!userProfile?.id) return;
    
    console.log('ChatContext: Force refreshing conversations');
    
    try {
      // Clear cache first
      chatCacheService.clearConversationsCache();
      
      // Reload conversations directly
      const conversations = await chatService.getUserConversations(userProfile.id);
      
      // Extract fresh unread counts
      const freshUnreadCounts = {};
      conversations.forEach(conv => {
        if (conv.unreadCounts && conv.unreadCounts[userProfile.id] !== undefined) {
          freshUnreadCounts[conv.id] = conv.unreadCounts[userProfile.id];
        }
      });
      
      console.log('ChatContext: Force refresh - setting unread counts to:', freshUnreadCounts);
      setConversations(conversations);
      setUnreadCounts(freshUnreadCounts);
      chatCacheService.setCachedConversations(conversations);
      
    } catch (error) {
      console.error('ChatContext: Error force refreshing:', error);
      showToast('Failed to refresh conversations', 'error');
    }
  }, [userProfile?.id, showToast]);

  // Set up conversations listener with cache-first loading
  useEffect(() => {
    if (!userProfile?.id) {
      return;
    }

    console.log('ChatContext: Setting up conversations listener for user', userProfile.id);

    // Load conversations from cache first for instant display
    const cachedConversations = chatCacheService.getCachedConversations();
    if (cachedConversations) {
      setConversations(cachedConversations);
      setLoading(false);
      
      // Extract unread counts from cached conversations
      const cachedUnreadCounts = {};
      cachedConversations.forEach(conv => {
        if (conv.unreadCounts && conv.unreadCounts[userProfile.id] !== undefined) {
          cachedUnreadCounts[conv.id] = conv.unreadCounts[userProfile.id];
        }
      });
      setUnreadCounts(cachedUnreadCounts);
      
      // Track cache hit
      readCounter.recordCacheHit('conversations', 'ChatContext', cachedConversations.length);
    } else {
      // Track cache miss
      readCounter.recordCacheMiss('conversations', 'ChatContext');
    }

    let updateCount = 0;
    const unsubscribe = chatService.subscribeToUserConversations(
      userProfile.id,
      (updatedConversations) => {
        updateCount++;
        console.log(`ChatContext: Listener update #${updateCount} - Received ${updatedConversations.length} conversations`);
        setConversations(updatedConversations);
        setLoading(false);
        
        // Extract unread counts for current user
        const newUnreadCounts = {};
        updatedConversations.forEach(conv => {
          console.log(`ChatContext: Conv ${conv.id} full unreadCounts object:`, JSON.stringify(conv.unreadCounts));
          if (conv.unreadCounts && conv.unreadCounts[userProfile.id] !== undefined) {
            newUnreadCounts[conv.id] = conv.unreadCounts[userProfile.id];
            if (conv.unreadCounts[userProfile.id] > 0) {
              console.log(`ChatContext: ✅ Conversation ${conv.id} has ${conv.unreadCounts[userProfile.id]} unread messages`);
            }
          }
        });
        console.log('ChatContext: Final unread counts being set:', newUnreadCounts);
        setUnreadCounts(newUnreadCounts);
        
        // Cache the updated conversations
        chatCacheService.setCachedConversations(updatedConversations);
      }
    );

    console.log('ChatContext: Listener created successfully');
    setConversationsUnsubscribe(() => unsubscribe);

    // Set up periodic refresh as a workaround for listener issues
    const refreshInterval = setInterval(() => {
      console.log('ChatContext: Periodic refresh check');
      forceRefreshConversations();
    }, 10000); // Refresh every 10 seconds

    return () => {
      console.log('ChatContext: Cleaning up conversations listener');
      clearInterval(refreshInterval);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userProfile?.id, forceRefreshConversations]);

  // Update browser tab title with unread count
  useEffect(() => {
    const totalUnread = Object.values(unreadCounts || {}).reduce((sum, count) => sum + count, 0);
    console.log('ChatContext: unreadCounts state changed, total unread:', totalUnread, 'counts:', unreadCounts);
    notificationService.updateTabTitle(totalUnread);
  }, [unreadCounts]);

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
            
            // Update conversation's lastMessage if we have new messages
            if (newMessages.length > 0) {
              const latestMessage = newMessages[newMessages.length - 1];
              
              // Notify for new messages from others
              if (latestMessage.senderId !== userProfile?.id && !document.hasFocus()) {
                const conversationName = getConversationDisplayName(activeConversation);
                notificationService.notifyNewMessage(
                  latestMessage,
                  conversationName,
                  latestMessage.senderName || 'Someone'
                );
              }
              
              setConversations(prev => prev.map(conv => {
                if (conv.id === activeConversation.id) {
                  return {
                    ...conv,
                    lastMessage: {
                      text: latestMessage.text || '',
                      senderId: latestMessage.senderId,
                      senderName: latestMessage.senderName,
                      timestamp: latestMessage.timestamp
                    },
                    lastActivity: latestMessage.timestamp
                  };
                }
                return conv;
              }));
            }
          } else {
            // Full message set (fallback)
            setMessages(newMessages);
            chatCacheService.setCachedMessages(activeConversation.id, newMessages);
          }
          setMessagesLoading(false);
          
          // Mark messages as read when we receive them (only in main chat view)
          if (userProfile?.id && isMainChatView) {
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
          
          // Mark messages as read when we receive them (only in main chat view)
          if (userProfile?.id && isMainChatView) {
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
  }, [activeConversation?.id, userProfile?.id, isMainChatView]);


  // Create new conversation
  const createConversation = useCallback(async (participantIds, type = 'direct', customName = null) => {
    try {
      if (!userProfile?.id) {
        throw new Error('User not authenticated');
      }

      // Validate participant IDs
      const validParticipantIds = participantIds.filter(id => id && typeof id === 'string');
      if (validParticipantIds.length === 0) {
        throw new Error('No valid participant IDs provided');
      }

      // Include current user in participants
      const allParticipants = [userProfile.id, ...validParticipantIds.filter(id => id !== userProfile.id)];
      
      
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
  const sendMessage = useCallback(async (text, type = 'text', fileData = null) => {

    // For GIF messages, text can be empty
    if (!activeConversation?.id || !userProfile?.id || (type !== 'gif' && !text.trim())) {
      return;
    }

    setSendingMessage(true);
    try {
      // Get sender name for the message
      const senderName = userProfile.displayName || 
                        `${userProfile.firstName} ${userProfile.lastName}`.trim() || 
                        userProfile.email || 
                        'Unknown User';

      // For GIF messages, use a placeholder text
      const messageText = type === 'gif' ? 'GIF' : text.trim();

      await chatService.sendMessage(
        activeConversation.id,
        userProfile.id,
        messageText,
        type,
        fileData?.url || null,
        senderName,
        fileData
      );

      
      // Update local conversation state immediately for instant UI update
      const messagePreview = {
        text: type === 'gif' ? '🎬 GIF' : messageText,
        senderId: userProfile.id,
        senderName: senderName,
        timestamp: new Date()
      };
      
      setConversations(prev => {
        // Update the conversation
        const updated = prev.map(conv => {
          if (conv.id === activeConversation.id) {
            return {
              ...conv,
              lastMessage: messagePreview,
              lastActivity: new Date()
            };
          }
          return conv;
        });
        
        // Re-sort conversations by lastActivity (most recent first)
        return updated.sort((a, b) => {
          // Handle pinned conversations first
          const aPinned = a.pinnedBy?.includes(userProfile?.id) || false;
          const bPinned = b.pinnedBy?.includes(userProfile?.id) || false;
          
          if (aPinned && !bPinned) return -1;
          if (!aPinned && bPinned) return 1;
          
          // Then sort by lastActivity - handle both Date objects and Firestore Timestamps
          const getTime = (activity) => {
            if (!activity) return 0;
            if (activity.toDate) return activity.toDate().getTime();
            if (activity instanceof Date) return activity.getTime();
            if (typeof activity === 'number') return activity;
            return 0;
          };
          
          const aTime = getTime(a.lastActivity);
          const bTime = getTime(b.lastActivity);
          return bTime - aTime;
        });
      });
      
      // Note: The real-time listener will handle updating the cache
      // when the new message comes through
    } catch (error) {
      showToast(`Failed to send message: ${error.message}`, 'error');
    } finally {
      setSendingMessage(false);
    }
  }, [activeConversation?.id, userProfile?.id, userProfile?.displayName, userProfile?.firstName, userProfile?.lastName, userProfile?.email, showToast]);

  // Send file message
  const sendFileMessage = useCallback(async (fileData, fileName) => {
    if (!activeConversation?.id || !userProfile?.id) {
      showToast('No active conversation', 'error');
      return;
    }

    setSendingMessage(true);
    try {
      const senderName = userProfile.displayName || 
                        `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 
                        userProfile.email?.split('@')[0] || 
                        'Unknown User';

      // Create file message text
      const messageText = fileData.isImage 
        ? `📷 Image: ${fileName}` 
        : `📎 File: ${fileName}`;

      // Send message with file data
      await chatService.sendMessage(
        activeConversation.id, 
        userProfile.id, 
        messageText,
        'file',
        fileData.url,
        senderName,
        fileData
      );

      // Update local state
      const fileMessage = {
        text: messageText,
        senderId: userProfile.id,
        senderName: senderName,
        type: 'file',
        fileData: fileData,
        timestamp: new Date()
      };

      setConversations(prev => prev.map(conv => {
        if (conv.id === activeConversation.id) {
          return {
            ...conv,
            lastMessage: fileMessage,
            lastActivity: new Date()
          };
        }
        return conv;
      }));
    } catch (error) {
      showToast(`Failed to send file: ${error.message}`, 'error');
      throw error;
    } finally {
      setSendingMessage(false);
    }
  }, [activeConversation?.id, userProfile, showToast]);

  // Set user typing status
  const setUserTyping = useCallback(async (conversationId, userId, isTyping) => {
    if (!conversationId || !userId) return;

    try {
      // Update local state immediately
      setTypingUsers(prev => {
        const convTyping = prev[conversationId] || {};
        if (isTyping) {
          convTyping[userId] = Date.now();
        } else {
          delete convTyping[userId];
        }
        return { ...prev, [conversationId]: convTyping };
      });

      // Update Firebase
      await chatService.updateTypingStatus(conversationId, userId, isTyping);
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, []);

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
  const togglePinConversation = useCallback(async (conversationId, isCurrentlyPinned) => {
    if (!userProfile?.id) return;
    
    try {
      
      // Update Firebase - the real-time listener will update the local state
      await chatService.togglePinConversation(conversationId, userProfile.id, isCurrentlyPinned);
      
      // Don't update local state here - let the real-time listener handle it
      // This ensures consistency with the server state
      
      showToast(isCurrentlyPinned ? 'Conversation unpinned' : 'Conversation pinned', 'success');
    } catch (error) {
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

  // Mark messages as read with careful optimistic updates
  const markConversationAsRead = useCallback(async (conversationId) => {
    if (!userProfile?.id || !conversationId) return;
    
    console.log(`ChatContext: Marking conversation ${conversationId} as read`);
    
    try {
      // Immediately update local state for instant UI feedback
      setUnreadCounts(prev => {
        const newCounts = { ...prev, [conversationId]: 0 };
        console.log('ChatContext: Optimistically setting unread counts to:', newCounts);
        return newCounts;
      });
      
      // Also update conversations state for consistency
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            unreadCounts: {
              ...conv.unreadCounts,
              [userProfile.id]: 0
            }
          };
        }
        return conv;
      }));
      
      // Then update Firebase
      await chatService.markMessagesAsRead(conversationId, userProfile.id);
      console.log(`ChatContext: Successfully marked ${conversationId} as read in Firestore`);
      
      // The real-time listener will confirm this update or correct it if needed
    } catch (error) {
      console.error('ChatContext: Error marking conversation as read:', error);
    }
  }, [userProfile?.id]);

  // Mark messages as read when opening a conversation in main chat view
  useEffect(() => {
    if (activeConversation?.id && userProfile?.id && isMainChatView) {
      console.log(`ChatContext: Main chat view opened for conversation ${activeConversation.id}`);
      
      // Use markConversationAsRead for consistency
      markConversationAsRead(activeConversation.id);
    }
  }, [activeConversation?.id, userProfile?.id, isMainChatView, markConversationAsRead]);

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

  // Delete a conversation (admin only or leave for regular users)
  const deleteConversation = useCallback(async (conversationId) => {
    
    try {
      let result;
      
      // Check if user is admin
      if (userProfile?.role === 'admin') {
        // Admin can permanently delete
        result = await chatService.adminDeleteConversation(conversationId, userProfile.id, userProfile.role);
        showToast('Conversation permanently deleted', 'success');
      } else {
        // Regular users just leave the conversation
        const userName = `${userProfile.firstName} ${userProfile.lastName}`;
        result = await chatService.deleteConversation(conversationId, userProfile.id, userName);
        showToast('Left conversation', 'success');
      }
      
      // Remove from local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // Clear active conversation if it's the one being deleted
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
        setMessages([]);
      }
      
      // Clear cache for this conversation
      chatCacheService.clearConversationCache(conversationId);
      
      return result;
    } catch (error) {
      showToast(error.message || 'Failed to delete conversation', 'error');
      // Don't re-throw the error so the UI doesn't break
      return { success: false, error: error.message };
    }
  }, [activeConversation?.id, userProfile?.id, userProfile?.role, userProfile?.firstName, userProfile?.lastName, showToast]);

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
    unreadCounts,
    isMainChatView,
    typingUsers,
    messageStatuses,

    // Actions
    setActiveConversation,
    createConversation,
    sendMessage,
    sendFileMessage,
    setUserTyping,
    loadMoreMessages,
    updateConversationName,
    getConversationDisplayName,
    forceRefreshConversations,
    togglePinConversation,
    addParticipantsToConversation,
    removeParticipantFromConversation,
    leaveConversation,
    deleteConversation,
    setIsMainChatView,
    markConversationAsRead,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};