import React, { useState, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Search, Plus, Pin, Archive, MoreVertical, Circle } from 'lucide-react';
import UserAvatar from '../shared/UserAvatar';
import presenceService from '../../services/presenceService';
import './ConversationPanel.css';

const ConversationPanel = ({ onNewConversation, onSelectConversation }) => {
  const { 
    conversations, 
    activeConversation, 
    setActiveConversation, 
    getConversationDisplayName,
    loading,
    markConversationAsRead,
    togglePinConversation,
    organizationUsers
  } = useChat();
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [userPresence, setUserPresence] = useState({});
  const [hoveredConversation, setHoveredConversation] = useState(null);

  // Track presence for all conversation participants
  useEffect(() => {
    if (!conversations || conversations.length === 0) return;
    
    const allParticipants = new Set();
    conversations.forEach(conv => {
      conv.participants?.forEach(participantId => {
        if (participantId !== userProfile?.id) {
          allParticipants.add(participantId);
        }
      });
    });
    
    const presenceUnsubscribes = [];
    allParticipants.forEach(participantId => {
      const unsubscribe = presenceService.subscribeToUserPresence(
        participantId,
        (presence) => {
          setUserPresence(prev => ({
            ...prev,
            [participantId]: presence
          }));
        }
      );
      presenceUnsubscribes.push(unsubscribe);
    });
    
    return () => {
      presenceUnsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [conversations, userProfile?.id]);

  const handleConversationClick = (conversation) => {
    setActiveConversation(conversation);
    markConversationAsRead(conversation.id);
    if (onSelectConversation) {
      onSelectConversation(conversation);
    }
  };

  const getUnreadCount = (conversation) => {
    if (!conversation.unreadCounts || !userProfile?.id) return 0;
    return conversation.unreadCounts[userProfile.id] || 0;
  };

  const getLastMessagePreview = (lastMessage) => {
    if (!lastMessage) return 'Start a conversation';
    
    if (lastMessage.type === 'image') return '📷 Photo';
    if (lastMessage.type === 'file') return '📎 File attachment';
    if (lastMessage.type === 'voice') return '🎤 Voice message';
    if (lastMessage.type === 'gif') return 'GIF';
    
    if (lastMessage.text) {
      return lastMessage.text.length > 40 
        ? lastMessage.text.substring(0, 40) + '...'
        : lastMessage.text;
    }
    
    return 'Start a conversation';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: false });
  };

  const isConversationOnline = (conversation) => {
    if (conversation.type === 'group') {
      return conversation.participants?.some(
        id => id !== userProfile?.id && userPresence[id]?.online
      );
    }
    const otherParticipant = conversation.participants?.find(id => id !== userProfile?.id);
    return otherParticipant && userPresence[otherParticipant]?.online;
  };

  const isPinned = (conversation) => {
    return conversation.pinnedBy?.includes(userProfile?.id);
  };

  const filteredConversations = conversations
    .filter(conv => {
      if (!searchTerm) return true;
      const displayName = getConversationDisplayName(conv).toLowerCase();
      return displayName.includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      // Pinned first
      const aPinned = isPinned(a);
      const bPinned = isPinned(b);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      
      // Then by last message time
      const aTime = a.lastMessage?.timestamp || 0;
      const bTime = b.lastMessage?.timestamp || 0;
      return bTime - aTime;
    });

  return (
    <div className="conversation-panel">
      {/* Header */}
      <div className="conversation-panel__header">
        <h2 className="conversation-panel__title">Messages</h2>
        <button 
          className="conversation-panel__new-btn"
          onClick={onNewConversation}
          title="New conversation"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="conversation-panel__search">
        <Search size={18} className="conversation-panel__search-icon" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="conversation-panel__search-input"
        />
      </div>

      {/* Conversations List */}
      <div className="conversation-panel__list">
        {loading ? (
          <div className="conversation-panel__loading">
            <div className="conversation-panel__loading-item" />
            <div className="conversation-panel__loading-item" />
            <div className="conversation-panel__loading-item" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="conversation-panel__empty">
            <p>No conversations yet</p>
            <button onClick={onNewConversation} className="conversation-panel__empty-btn">
              Start a conversation
            </button>
          </div>
        ) : (
          filteredConversations.map(conversation => {
            const unreadCount = getUnreadCount(conversation);
            const isActive = activeConversation?.id === conversation.id;
            const isOnline = isConversationOnline(conversation);
            const pinned = isPinned(conversation);
            
            return (
              <div
                key={conversation.id}
                className={`conversation-panel__item ${isActive ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}`}
                onClick={() => handleConversationClick(conversation)}
                onMouseEnter={() => setHoveredConversation(conversation.id)}
                onMouseLeave={() => setHoveredConversation(null)}
              >
                {/* Avatar with Online Status */}
                <div className="conversation-panel__avatar-wrapper">
                  <UserAvatar 
                    user={organizationUsers?.find(u => 
                      conversation.participants?.find(p => p !== userProfile?.id) === u.id
                    ) || { displayName: getConversationDisplayName(conversation) }}
                    size="medium"
                  />
                  {isOnline && (
                    <div className="conversation-panel__online-indicator">
                      <Circle size={8} fill="currentColor" />
                    </div>
                  )}
                </div>

                {/* Conversation Info */}
                <div className="conversation-panel__info">
                  <div className="conversation-panel__info-header">
                    <h3 className="conversation-panel__name">
                      {getConversationDisplayName(conversation)}
                      {pinned && <Pin size={12} className="conversation-panel__pinned" />}
                    </h3>
                    <span className="conversation-panel__time">
                      {formatTime(conversation.lastMessage?.timestamp)}
                    </span>
                  </div>
                  <p className="conversation-panel__preview">
                    {conversation.lastMessage?.senderId === userProfile?.id && 'You: '}
                    {getLastMessagePreview(conversation.lastMessage)}
                  </p>
                </div>

                {/* Unread Badge */}
                {unreadCount > 0 && (
                  <div className="conversation-panel__unread-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                )}

                {/* Actions (visible on hover) */}
                {hoveredConversation === conversation.id && (
                  <div className="conversation-panel__actions">
                    <button
                      className="conversation-panel__action"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinConversation(conversation.id, pinned);
                      }}
                      title={pinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin size={16} />
                    </button>
                    <button
                      className="conversation-panel__action"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement archive
                      }}
                      title="Archive"
                    >
                      <Archive size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationPanel;