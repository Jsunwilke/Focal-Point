import React, { useState, useMemo } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCw, Pin, Users, Trash2, LogOut, MoreVertical } from 'lucide-react';
import UserAvatar from '../shared/UserAvatar';
import './ConversationList.css';

const ConversationList = ({ onNewConversation }) => {
  const { 
    conversations, 
    activeConversation, 
    setActiveConversation, 
    getConversationDisplayName,
    loading,
    forceRefreshConversations,
    togglePinConversation,
    organizationUsers,
    markConversationAsRead,
    deleteConversation
  } = useChat();
  const { userProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showOptionsFor, setShowOptionsFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const getLastMessagePreview = (lastMessage) => {
    if (!lastMessage) return 'No messages yet';
    
    if (lastMessage.text) {
      return lastMessage.text.length > 50 
        ? lastMessage.text.substring(0, 50) + '...'
        : lastMessage.text;
    }
    
    return 'No messages yet';
  };

  const getUnreadCount = (conversation) => {
    if (!conversation.unreadCounts || !userProfile?.id) return 0;
    return conversation.unreadCounts[userProfile.id] || 0;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await forceRefreshConversations();
    } finally {
      setRefreshing(false);
    }
  };

  const handlePinToggle = async (e, conversation) => {
    e.stopPropagation(); // Prevent conversation selection
    const isPinned = conversation.pinnedBy?.includes(userProfile?.id);
    await togglePinConversation(conversation.id, isPinned);
  };

  const handleOptionsClick = (e, conversationId) => {
    e.stopPropagation();
    setShowOptionsFor(showOptionsFor === conversationId ? null : conversationId);
  };

  const handleDeleteConversation = async (e, conversation) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (confirmDelete === conversation.id) {
      // Double-click to confirm
      try {
        await deleteConversation(conversation.id);
        setConfirmDelete(null);
        setShowOptionsFor(null);
      } catch (error) {
        console.error('Failed to delete conversation:', error);
      }
    } else {
      // First click - show confirmation state
      setConfirmDelete(conversation.id);
      // Reset confirmation after 3 seconds
      setTimeout(() => {
        setConfirmDelete((current) => current === conversation.id ? null : current);
      }, 3000);
    }
  };

  // Close options dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      // Don't close if clicking inside the options area or delete button
      if (!e.target.closest('.conversation-item__options') && 
          !e.target.closest('.conversation-item__delete-btn')) {
        setShowOptionsFor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getConversationAvatar = (conversation) => {
    if (conversation.type === 'direct') {
      // For direct conversations, show the other user's avatar
      const otherUserId = conversation.participants.find(id => id !== userProfile?.id);
      const otherUser = organizationUsers.find(u => u.id === otherUserId);
      return otherUser ? <UserAvatar user={otherUser} size="medium" /> : null;
    } else {
      // For group conversations, show a group icon or multiple avatars
      // For now, we'll show a group icon
      return (
        <div className="conversation-item__group-avatar">
          <Users size={24} />
        </div>
      );
    }
  };

  // Sort conversations: pinned first, then by last activity
  const sortedConversations = useMemo(() => {
    if (!userProfile?.id) return conversations;
    
    return [...conversations].sort((a, b) => {
      const aIsPinned = a.pinnedBy?.includes(userProfile.id) || false;
      const bIsPinned = b.pinnedBy?.includes(userProfile.id) || false;
      
      // If one is pinned and the other isn't, pinned comes first
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      
      // Otherwise sort by last activity (already sorted by the query)
      return 0;
    });
  }, [conversations, userProfile?.id]);

  if (loading) {
    return (
      <div className="conversation-list">
        <div className="conversation-list__loading">
          <div className="loading-spinner"></div>
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      <div className="conversation-list__header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            background: 'none',
            border: 'none',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#6b7280',
            fontSize: '12px'
          }}
          title="Refresh conversations"
        >
          <RefreshCw 
            size={14} 
            className={refreshing ? 'spinning' : ''}
            style={{
              animation: refreshing ? 'spin 1s linear infinite' : 'none'
            }}
          />
          Refresh
        </button>
      </div>
      {conversations.length === 0 ? (
        <div className="conversation-list__empty">
          <p>No conversations yet</p>
          <button 
            className="conversation-list__new-btn"
            onClick={onNewConversation}
          >
            Start your first chat
          </button>
        </div>
      ) : (
        sortedConversations.map((conversation) => {
          const isActive = activeConversation?.id === conversation.id;
          const unreadCount = getUnreadCount(conversation);
          const isPinned = conversation.pinnedBy?.includes(userProfile?.id) || false;
          
          return (
            <div
              key={`${conversation.id}-${unreadCount}`}
              className={`conversation-item ${isActive ? 'conversation-item--active' : ''} ${isPinned ? 'conversation-item--pinned' : ''}`}
              onClick={() => {
                setActiveConversation(conversation);
                // Mark messages as read with optimistic updates
                if (userProfile?.id && conversation?.id) {
                  markConversationAsRead(conversation.id);
                }
              }}
            >
              <div className="conversation-item__avatar">
                {getConversationAvatar(conversation)}
              </div>
              
              <div className="conversation-item__content">
                <div className="conversation-item__header">
                  <h4 className="conversation-item__name">
                    {getConversationDisplayName(conversation)}
                  </h4>
                  <div className="conversation-item__header-right">
                    <button
                      className={`conversation-item__pin-btn ${isPinned ? 'conversation-item__pin-btn--active' : ''}`}
                      onClick={(e) => handlePinToggle(e, conversation)}
                      title={isPinned ? 'Unpin conversation' : 'Pin conversation'}
                    >
                      <Pin size={14} />
                    </button>
                    <div className="conversation-item__options" style={{ position: 'relative' }}>
                      <button
                        className="conversation-item__options-btn"
                        onClick={(e) => handleOptionsClick(e, conversation.id)}
                        title="More options"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {showOptionsFor === conversation.id && (
                        <div className="conversation-item__options-dropdown">
                          <button
                            className={`conversation-item__delete-btn ${confirmDelete === conversation.id ? 'conversation-item__delete-btn--confirm' : ''}`}
                            onClick={(e) => handleDeleteConversation(e, conversation)}
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {userProfile?.role === 'admin' ? (
                              <>
                                <Trash2 size={14} />
                                {confirmDelete === conversation.id ? 'Click to confirm' : 'Delete'}
                              </>
                            ) : (
                              <>
                                <LogOut size={14} />
                                {confirmDelete === conversation.id ? 'Click to confirm' : 'Leave'}
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="conversation-item__time">
                      {formatLastSeen(conversation.lastActivity)}
                    </span>
                  </div>
                </div>
                
                <div className="conversation-item__preview">
                  <p className="conversation-item__last-message">
                    {getLastMessagePreview(conversation.lastMessage)}
                  </p>
                  {unreadCount > 0 && (
                    <span className="conversation-item__unread-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default ConversationList;