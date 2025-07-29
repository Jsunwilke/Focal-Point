import React from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import './ConversationList.css';

const ConversationList = ({ onNewConversation }) => {
  const { 
    conversations, 
    activeConversation, 
    setActiveConversation, 
    getConversationDisplayName,
    loading
  } = useChat();
  const { userProfile } = useAuth();

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
        conversations.map((conversation) => {
          const isActive = activeConversation?.id === conversation.id;
          const unreadCount = getUnreadCount(conversation);
          
          return (
            <div
              key={conversation.id}
              className={`conversation-item ${isActive ? 'conversation-item--active' : ''}`}
              onClick={() => setActiveConversation(conversation)}
            >
              <div className="conversation-item__avatar">
                <div className="conversation-item__avatar-placeholder">
                  {conversation.type === 'direct' ? '👤' : '👥'}
                </div>
              </div>
              
              <div className="conversation-item__content">
                <div className="conversation-item__header">
                  <h4 className="conversation-item__name">
                    {getConversationDisplayName(conversation)}
                  </h4>
                  <span className="conversation-item__time">
                    {formatLastSeen(conversation.lastActivity)}
                  </span>
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