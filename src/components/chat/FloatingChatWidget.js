import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import MessageThread from './MessageThread';
import MessageInput from './MessageInput';
import EmployeeSelector from './EmployeeSelector';
import UserAvatar from '../shared/UserAvatar';
import { MessageCircle, Minus, ChevronLeft, Users, Pin, Loader } from 'lucide-react';
import './FloatingChatWidget.css';

// Context provider for floating chat state
const FloatingChatContext = React.createContext();

const FloatingChatWidget = () => {
  const location = useLocation();
  const { conversations, unreadCounts, setActiveConversation, getConversationDisplayName, organizationUsers, togglePinConversation, markConversationAsRead } = useChat();
  const { userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [floatingActiveConversation, setFloatingActiveConversation] = useState(null);
  const [pinningConversationId, setPinningConversationId] = useState(null);
  const [optimisticPinStates, setOptimisticPinStates] = useState({});
  
  // Refs for auto-open functionality
  const previousUnreadCounts = useRef({});
  const lastClosedTime = useRef(null);
  const COOLDOWN_DURATION = 30000; // 30 seconds

  // Load saved state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('floatingChatState');
    if (savedState) {
      try {
        const { isOpen: savedIsOpen, isMinimized: savedIsMinimized } = JSON.parse(savedState);
        setIsOpen(savedIsOpen);
        setIsMinimized(savedIsMinimized);
      } catch (error) {
      }
    }
    
    // Initialize previousUnreadCounts
    previousUnreadCounts.current = unreadCounts;
  }, []);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('floatingChatState', JSON.stringify({ isOpen, isMinimized }));
  }, [isOpen, isMinimized]);
  
  // Monitor unread counts for auto-open functionality
  useEffect(() => {
    
    // Skip if widget is already open or on chat page
    if (isOpen || location.pathname === '/chat') {
      previousUnreadCounts.current = unreadCounts;
      return;
    }
    
    // Check if we're still in cooldown period
    if (lastClosedTime.current) {
      const timeSinceClose = Date.now() - lastClosedTime.current;
      if (timeSinceClose < COOLDOWN_DURATION) {
        previousUnreadCounts.current = unreadCounts;
        return;
      }
    }
    
    // Check for new unread messages
    let conversationWithNewMessage = null;
    Object.entries(unreadCounts).forEach(([convId, count]) => {
      const previousCount = previousUnreadCounts.current[convId] || 0;
      if (count > previousCount && count > 0) {
        conversationWithNewMessage = conversations.find(c => c.id === convId);
      }
    });
    
    // Auto-open to the conversation with new message
    if (conversationWithNewMessage) {
      setIsOpen(true);
      setFloatingActiveConversation(conversationWithNewMessage);
      setActiveConversation(conversationWithNewMessage);
    }
    
    // Update previous counts
    previousUnreadCounts.current = unreadCounts;
  }, [unreadCounts, isOpen, conversations, location.pathname, setActiveConversation]);

  // Calculate total unread messages
  const totalUnread = Object.entries(unreadCounts || {}).reduce((total, [convId, count]) => {
    if (convId !== floatingActiveConversation?.id) {
      return total + (count || 0);
    }
    return total;
  }, 0);
  

  const handleToggle = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
    } else {
      setIsOpen(false);
      setIsMinimized(false);
      setFloatingActiveConversation(null);
    }
  };

  const handleMinimize = () => {
    setIsOpen(false);
    setIsMinimized(false);
    setFloatingActiveConversation(null);
    lastClosedTime.current = Date.now(); // Record close time for cooldown
  };

  const handleConversationSelect = useCallback((conversation) => {
    setFloatingActiveConversation(conversation);
    // Set as active conversation in the main context
    setActiveConversation(conversation);
    
    // Mark messages as read for this conversation with optimistic updates
    if (userProfile?.id && conversation?.id) {
      markConversationAsRead(conversation.id);
    }
  }, [setActiveConversation, userProfile?.id, markConversationAsRead]);

  const handleNewConversation = () => {
    setShowNewConversationModal(true);
  };

  const handleBackToList = () => {
    setFloatingActiveConversation(null);
    setActiveConversation(null);
  };

  const handleConversationCreated = (conversation) => {
    setFloatingActiveConversation(conversation);
    setActiveConversation(conversation);
    setShowNewConversationModal(false);
  };
  
  const handlePinToggle = useCallback(async (e, conversation) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent conversation selection
    
    if (!conversation?.id || !userProfile?.id) {
      return;
    }
    
    // Prevent multiple clicks
    if (pinningConversationId === conversation.id) {
      return;
    }
    
    const currentPinState = optimisticPinStates[conversation.id] !== undefined 
      ? optimisticPinStates[conversation.id]
      : (conversation.pinnedBy?.includes(userProfile?.id) || false);
    
    
    setPinningConversationId(conversation.id);
    
    // Apply optimistic update immediately
    setOptimisticPinStates(prev => ({
      ...prev,
      [conversation.id]: !currentPinState
    }));
    
    try {
      await togglePinConversation(conversation.id, currentPinState);
    } finally {
      // Clear loading state after a short delay to allow the real-time update to process
      setTimeout(() => {
        setPinningConversationId(null);
        // Clear optimistic state to use real state from Firebase
        setOptimisticPinStates(prev => {
          const newState = { ...prev };
          delete newState[conversation.id];
          return newState;
        });
      }, 1000);
    }
  }, [userProfile?.id, togglePinConversation, getConversationDisplayName, pinningConversationId, optimisticPinStates]);

  const getConversationAvatar = (conversation) => {
    if (conversation.type === 'direct') {
      // For direct conversations, show the other user's avatar
      const otherUserId = conversation.participants.find(id => id !== userProfile?.id);
      const otherUser = organizationUsers.find(u => u.id === otherUserId);
      return otherUser ? <UserAvatar user={otherUser} size="small" /> : null;
    } else {
      // For group conversations, show a group icon
      return (
        <div className="floating-chat-widget__group-avatar">
          <Users size={20} />
        </div>
      );
    }
  };


  // Don't render if on the main chat page
  if (location.pathname === '/chat') {
    return null;
  }

  // Sort conversations - pinned first, then by last activity
  const sortedConversations = [...conversations].sort((a, b) => {
    // Check optimistic state first, then fall back to actual state
    const aPinned = optimisticPinStates[a.id] !== undefined 
      ? optimisticPinStates[a.id] 
      : (a.pinnedBy?.includes(userProfile?.id) || false);
    const bPinned = optimisticPinStates[b.id] !== undefined 
      ? optimisticPinStates[b.id] 
      : (b.pinnedBy?.includes(userProfile?.id) || false);
    
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    
    // Sort by last activity - handle both Date objects and Firestore Timestamps
    const getTime = (activity) => {
      if (!activity) return 0;
      if (activity.toDate) return activity.toDate().getTime();
      if (activity instanceof Date) return activity.getTime();
      if (typeof activity === 'number') return activity;
      return 0;
    };
    
    const aTime = getTime(a.lastActivity);
    const bTime = getTime(b.lastActivity);
    return bTime - aTime; // Most recent first
  });

  return ReactDOM.createPortal(
    <>
      {/* Floating button */}
      {!isOpen && (
        <button 
          className="floating-chat-button"
          onClick={handleToggle}
          title={totalUnread > 0 ? `${totalUnread} unread message${totalUnread === 1 ? '' : 's'}` : "Open chat"}
          aria-label={totalUnread > 0 ? `${totalUnread} unread messages` : "Open chat"}
        >
          <MessageCircle size={24} />
          {totalUnread > 0 && (
            <span className="floating-chat-button__badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
          )}
        </button>
      )}

      {/* Chat widget */}
      {isOpen && (
        <div className={`floating-chat-widget ${isMinimized ? 'floating-chat-widget--minimized' : ''}`}>
          <div className="floating-chat-widget__header">
            <div className="floating-chat-widget__header-title">
              {floatingActiveConversation && (
                <button 
                  className="floating-chat-widget__back-btn"
                  onClick={handleBackToList}
                  title="Back to conversations"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <h3>
                {floatingActiveConversation 
                  ? getConversationDisplayName(floatingActiveConversation)
                  : 'Messages'
                }
              </h3>
            </div>
            <div className="floating-chat-widget__header-actions">
              <button 
                className="floating-chat-widget__minimize-btn"
                onClick={handleMinimize}
                title="Close chat"
                aria-label="Close chat"
              >
                <Minus size={18} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div className="floating-chat-widget__body">
              {!floatingActiveConversation ? (
                <>
                  <div className="floating-chat-widget__new-chat">
                    <button 
                      className="floating-chat-widget__new-chat-btn"
                      onClick={handleNewConversation}
                    >
                      + New Conversation
                    </button>
                  </div>
                  <div className="floating-chat-widget__conversations">
                    {sortedConversations.map(conversation => {
                      const isPinned = optimisticPinStates[conversation.id] !== undefined 
                        ? optimisticPinStates[conversation.id]
                        : (conversation.pinnedBy?.includes(userProfile?.id) || false);
                      const unreadCount = unreadCounts?.[conversation.id] || 0;
                      
                      return (
                        <div
                          key={`${conversation.id}-${isPinned ? 'pinned' : 'unpinned'}`}
                          className={`floating-chat-widget__conversation-item ${
                            unreadCount > 0 ? 'floating-chat-widget__conversation-item--unread' : ''
                          } ${isPinned ? 'floating-chat-widget__conversation-item--pinned' : ''}`}
                          onClick={() => handleConversationSelect(conversation)}
                        >
                          <div className="floating-chat-widget__conversation-avatar">
                            {getConversationAvatar(conversation)}
                          </div>
                          <div className="floating-chat-widget__conversation-info">
                            <div className="floating-chat-widget__conversation-name">
                              {getConversationDisplayName(conversation)}
                            </div>
                            <div className="floating-chat-widget__conversation-preview">
                              {conversation.lastMessage?.text || 'No messages yet'}
                            </div>
                          </div>
                          <div className="floating-chat-widget__conversation-actions">
                            <button
                              className={`floating-chat-widget__pin-btn ${isPinned ? 'floating-chat-widget__pin-btn--active' : ''}`}
                              onClick={(e) => handlePinToggle(e, conversation)}
                              disabled={pinningConversationId === conversation.id}
                              title={isPinned ? 'Unpin conversation' : 'Pin conversation'}
                            >
                              {pinningConversationId === conversation.id ? (
                                <Loader size={14} className="floating-chat-widget__pin-loader" />
                              ) : (
                                <Pin size={14} />
                              )}
                            </button>
                            {unreadCount > 0 && (
                              <span className="floating-chat-widget__unread-badge">
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {conversations.length === 0 && (
                      <div className="floating-chat-widget__empty">
                        <p>No conversations yet</p>
                        <p className="floating-chat-widget__empty-hint">Start a new conversation to begin messaging</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <FloatingChatContext.Provider value={{ isFloatingChat: true }}>
                  <div className="floating-chat-widget__chat">
                    <div className="floating-chat-widget__messages">
                      <MessageThread />
                    </div>
                    <div className="floating-chat-widget__input">
                      <MessageInput />
                    </div>
                  </div>
                </FloatingChatContext.Provider>
              )}
            </div>
          )}
        </div>
      )}

      <EmployeeSelector
        isOpen={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
        onConversationCreated={handleConversationCreated}
      />
    </>,
    document.body
  );
};

export default FloatingChatWidget;