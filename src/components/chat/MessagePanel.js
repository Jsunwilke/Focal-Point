import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { 
  Info, Search, MoreVertical, 
  Image as ImageIcon, File, Mic, Heart, ThumbsUp, 
  Smile, Laugh, Frown, Reply, Edit2, Trash2,
  Check, CheckCheck, Clock, AlertCircle
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import UserAvatar from '../shared/UserAvatar';
import presenceService from '../../services/presenceService';
import MessageSearch from './MessageSearch';
import './MessagePanel.css';

const MessagePanel = ({ onToggleDetails, showDetails }) => {
  const { 
    messages, 
    messagesLoading, 
    hasMoreMessages, 
    loadMoreMessages,
    activeConversation,
    getConversationDisplayName,
    organizationUsers,
    typingUsers,
    sendReaction,
    editMessage,
    deleteMessage
  } = useChat();
  const { userProfile } = useAuth();
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [showSearch, setShowSearch] = useState(false);
  const [participantPresence, setParticipantPresence] = useState({});
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  // Track presence for conversation participants
  useEffect(() => {
    if (!activeConversation?.participants) return;
    
    const presenceUnsubscribes = [];
    activeConversation.participants.forEach(participantId => {
      if (participantId !== userProfile?.id) {
        const unsubscribe = presenceService.subscribeToUserPresence(
          participantId,
          (presence) => {
            setParticipantPresence(prev => ({
              ...prev,
              [participantId]: presence
            }));
          }
        );
        presenceUnsubscribes.push(unsubscribe);
      }
    });
    
    return () => {
      presenceUnsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [activeConversation?.participants, userProfile?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isAutoScrollEnabled && !messagesLoading) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesLoading, isAutoScrollEnabled]);

  // Handle scroll for load more and auto-scroll detection
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Check if user scrolled to top to load more
    if (container.scrollTop < 100 && hasMoreMessages && !messagesLoading) {
      loadMoreMessages();
    }

    // Check if user is near bottom for auto-scroll
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setIsAutoScrollEnabled(isNearBottom);
  };

  const formatDateDivider = (date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const getMessageStatus = (message) => {
    if (message.senderId !== userProfile?.id) return null;
    
    if (message.sending) return { icon: Clock, label: 'Sending' };
    if (message.error) return { icon: AlertCircle, label: 'Failed' };
    if (message.readBy && Object.keys(message.readBy).length > 1) {
      return { icon: CheckCheck, label: 'Read', className: 'read' };
    }
    if (message.delivered) return { icon: CheckCheck, label: 'Delivered' };
    return { icon: Check, label: 'Sent' };
  };

  const handleReaction = (messageId, emoji) => {
    sendReaction(messageId, emoji);
    setShowReactionPicker(null);
  };

  const quickReactions = ['❤️', '👍', '😊', '😂', '😮', '😢'];

  const getOtherParticipant = () => {
    if (activeConversation?.type === 'group') return null;
    const otherId = activeConversation?.participants?.find(id => id !== userProfile?.id);
    return organizationUsers?.find(u => u.id === otherId);
  };

  const isOnline = () => {
    if (activeConversation?.type === 'group') {
      return activeConversation.participants?.some(
        id => id !== userProfile?.id && participantPresence[id]?.online
      );
    }
    const otherParticipant = getOtherParticipant();
    return otherParticipant && participantPresence[otherParticipant.id]?.online;
  };

  if (!activeConversation) {
    return (
      <div className="message-panel message-panel--empty">
        <div className="message-panel__empty-state">
          <div className="message-panel__empty-icon">💬</div>
          <h3>Welcome to Chat</h3>
          <p>Select a conversation or start a new one to begin messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-panel">
      {/* Header */}
      <div className="message-panel__header">
        <div className="message-panel__header-info">
          <UserAvatar 
            user={getOtherParticipant() || { displayName: getConversationDisplayName(activeConversation) }}
            size="medium"
          />
          <div className="message-panel__header-text">
            <h3 className="message-panel__header-title">
              {getConversationDisplayName(activeConversation)}
            </h3>
            <span className="message-panel__header-status">
              {isOnline() ? (
                <>
                  <span className="message-panel__status-dot" />
                  Active now
                </>
              ) : (
                'Offline'
              )}
            </span>
          </div>
        </div>
        <div className="message-panel__header-actions">
          <button 
            className="message-panel__header-btn"
            onClick={() => setShowSearch(!showSearch)}
            title="Search messages"
          >
            <Search size={20} />
          </button>
          <button 
            className={`message-panel__header-btn ${showDetails ? 'active' : ''}`}
            onClick={onToggleDetails}
            title="Conversation details"
          >
            <Info size={20} />
          </button>
        </div>
      </div>

      {/* Search Bar (collapsible) */}
      {showSearch && (
        <MessageSearch 
          isInline
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Messages Area */}
      <div 
        className="message-panel__messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        <div className="message-panel__messages-inner">
        {messagesLoading && messages.length === 0 ? (
          <div className="message-panel__loading">
            <div className="message-panel__loading-bubble" />
            <div className="message-panel__loading-bubble message-panel__loading-bubble--sent" />
            <div className="message-panel__loading-bubble" />
          </div>
        ) : (
          <>
            {hasMoreMessages && (
              <button 
                className="message-panel__load-more"
                onClick={loadMoreMessages}
                disabled={messagesLoading}
              >
                {messagesLoading ? 'Loading...' : 'Load earlier messages'}
              </button>
            )}
            
            {messages.map((message, index) => {
              const prevMessage = messages[index - 1];
              const nextMessage = messages[index + 1];
              const showDateDivider = !prevMessage || !isSameDay(
                message.timestamp?.toDate?.() || new Date(message.timestamp),
                prevMessage.timestamp?.toDate?.() || new Date(prevMessage.timestamp)
              );
              const isConsecutive = prevMessage && 
                prevMessage.senderId === message.senderId &&
                !showDateDivider;
              const isLastInGroup = !nextMessage || 
                nextMessage.senderId !== message.senderId ||
                !isSameDay(
                  message.timestamp?.toDate?.() || new Date(message.timestamp),
                  nextMessage.timestamp?.toDate?.() || new Date(nextMessage.timestamp)
                );

              return (
                <React.Fragment key={message.id}>
                  {showDateDivider && (
                    <div className="message-panel__date-divider">
                      <span>{formatDateDivider(message.timestamp?.toDate?.() || new Date(message.timestamp))}</span>
                    </div>
                  )}
                  
                  <MessageBubble
                    message={message}
                    isOwn={message.senderId === userProfile?.id}
                    isConsecutive={isConsecutive}
                    isLastInGroup={isLastInGroup}
                    user={organizationUsers?.find(u => u.id === message.senderId)}
                    onReaction={(emoji) => handleReaction(message.id, emoji)}
                    onEdit={(text) => editMessage(message.id, text)}
                    onDelete={() => deleteMessage(message.id)}
                    onReply={() => setSelectedMessage(message)}
                    messageStatus={getMessageStatus(message)}
                  />
                </React.Fragment>
              );
            })}
            
            {/* Typing Indicators */}
            {typingUsers && Object.keys(typingUsers).length > 0 && (
              (() => {
                const activeTypingUsers = Object.entries(typingUsers)
                  .filter(([userId, isTyping]) => userId !== userProfile?.id && isTyping === true);
                
                if (activeTypingUsers.length === 0) return null;
                
                return (
                  <div className="message-panel__typing">
                    {activeTypingUsers.map(([userId]) => {
                      const user = organizationUsers?.find(u => u.id === userId);
                      return (
                        <div key={userId} className="message-panel__typing-user">
                          <UserAvatar user={user} size="small" />
                          <span>{user?.firstName || 'Someone'} is typing</span>
                          <div className="message-panel__typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
        </div>
      </div>

      {/* Input Bar */}
      <div className="message-panel__input-wrapper">
        <InputBar 
          replyTo={selectedMessage}
          onCancelReply={() => setSelectedMessage(null)}
        />
      </div>
    </div>
  );
};

export default MessagePanel;