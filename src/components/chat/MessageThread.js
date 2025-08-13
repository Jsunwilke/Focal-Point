import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { format, isToday, isYesterday } from 'date-fns';
import { Settings, Check, CheckCheck, Image, FileText, Download, Circle } from 'lucide-react';
import ConversationSettingsModal from './ConversationSettingsModal';
import UserAvatar from '../shared/UserAvatar';
import fileUploadService from '../../services/fileUploadService';
import presenceService from '../../services/presenceService';
import './MessageThread.css';

const MessageThread = () => {
  const { 
    messages, 
    messagesLoading, 
    hasMoreMessages, 
    loadMoreMessages,
    getConversationDisplayName,
    activeConversation,
    organizationUsers,
    typingUsers
  } = useChat();
  const { userProfile } = useAuth();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [showSettings, setShowSettings] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [participantPresence, setParticipantPresence] = useState({});

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
    if (messagesEndRef.current && !messagesLoading) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesLoading]);

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      
      // Validate date
      if (isNaN(date.getTime())) return '';
      
      if (isToday(date)) {
        return format(date, 'h:mm a');
      } else if (isYesterday(date)) {
        return `Yesterday ${format(date, 'h:mm a')}`;
      } else {
        return format(date, 'MMM d, h:mm a');
      }
    } catch (error) {
      console.warn('Error formatting message time:', error);
      return '';
    }
  };

  const isConsecutiveMessage = (currentMessage, previousMessage) => {
    if (!previousMessage || !currentMessage) return false;
    
    try {
      const isSameSender = currentMessage.senderId === previousMessage.senderId;
      
      // Safe timestamp handling
      const currentTime = currentMessage.timestamp?.toDate?.() || new Date(currentMessage.timestamp || Date.now());
      const previousTime = previousMessage.timestamp?.toDate?.() || new Date(previousMessage.timestamp || Date.now());
      
      // Validate dates
      if (isNaN(currentTime.getTime()) || isNaN(previousTime.getTime())) {
        return isSameSender;
      }
      
      const timeDiff = Math.abs(currentTime - previousTime);
      
      // Consider messages consecutive if from same sender within 5 minutes
      return isSameSender && timeDiff < 5 * 60 * 1000;
    } catch (error) {
      console.warn('Error checking consecutive messages:', error);
      return false;
    }
  };

  const shouldShowDateSeparator = (currentMessage, previousMessage) => {
    if (!previousMessage || !currentMessage) return true;
    
    try {
      const currentDate = currentMessage.timestamp?.toDate?.() || new Date(currentMessage.timestamp || Date.now());
      const previousDate = previousMessage.timestamp?.toDate?.() || new Date(previousMessage.timestamp || Date.now());
      
      // Validate dates
      if (isNaN(currentDate.getTime()) || isNaN(previousDate.getTime())) {
        return true;
      }
      
      return format(currentDate, 'yyyy-MM-dd') !== format(previousDate, 'yyyy-MM-dd');
    } catch (error) {
      console.warn('Error checking date separator:', error);
      return true;
    }
  };

  const formatDateSeparator = (timestamp) => {
    if (!timestamp) return 'Unknown Date';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      
      // Validate date
      if (isNaN(date.getTime())) return 'Unknown Date';
      
      if (isToday(date)) {
        return 'Today';
      } else if (isYesterday(date)) {
        return 'Yesterday';
      } else {
        return format(date, 'MMMM d, yyyy');
      }
    } catch (error) {
      console.warn('Error formatting date separator:', error);
      return 'Unknown Date';
    }
  };

  const handleLoadMore = () => {
    if (!messagesLoading && hasMoreMessages) {
      loadMoreMessages();
    }
  };

  const getUserName = (userId) => {
    const user = organizationUsers.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown User';
  };

  const getUserData = (userId) => {
    return organizationUsers.find(u => u.id === userId) || null;
  };

  const getTypingUsers = () => {
    if (!activeConversation || !typingUsers) return [];
    
    const conversationTyping = typingUsers[activeConversation.id] || {};
    return Object.keys(conversationTyping)
      .filter(userId => userId !== userProfile?.id)
      .map(userId => getUserName(userId));
  };

  const renderMessageStatus = (message) => {
    if (!message || message.senderId !== userProfile?.id) return null;
    
    const isRead = message.readBy && message.readBy.length > 1;
    const isDelivered = message.status === 'delivered' || isRead;
    
    return (
      <span className="message-bubble__status">
        {isRead ? (
          <CheckCheck size={14} className="message-bubble__status--read" />
        ) : isDelivered ? (
          <CheckCheck size={14} className="message-bubble__status--delivered" />
        ) : (
          <Check size={14} className="message-bubble__status--sent" />
        )}
      </span>
    );
  };

  const getOnlineParticipants = () => {
    if (!activeConversation?.participants) return [];
    
    return activeConversation.participants.filter(participantId => {
      if (participantId === userProfile?.id) return false;
      return participantPresence[participantId]?.online || false;
    });
  };

  const getOnlineStatusText = () => {
    const onlineUsers = getOnlineParticipants();
    if (onlineUsers.length === 0) return null;
    
    if (activeConversation.type === 'direct') {
      return 'Active now';
    }
    
    return `${onlineUsers.length} online`;
  };

  const renderSystemMessage = (message) => {
    let content = '';
    
    switch (message.systemAction) {
      case 'participants_added':
        const addedNames = message.addedParticipants?.map(id => getUserName(id)).join(', ') || '';
        content = `${message.addedByName || 'Someone'} added ${addedNames} to the group`;
        break;
      
      case 'participant_removed':
        content = `${message.removedByName || 'Someone'} removed ${message.removedParticipantName || 'a participant'} from the group`;
        break;
      
      case 'participant_left':
        content = `${message.leftUserName || 'Someone'} left the group`;
        break;
      
      default:
        content = 'System message';
    }
    
    return (
      <div className="message-thread__system-message">
        <span>{content}</span>
      </div>
    );
  };

  if (!activeConversation) {
    return null;
  }

  return (
    <div className="message-thread">
      <div className="message-thread__header">
        <div className="message-thread__header-info">
          <h3 className="message-thread__title">
            {getConversationDisplayName(activeConversation)}
          </h3>
          <div className="message-thread__status">
            {getOnlineStatusText() ? (
              <>
                <Circle size={8} fill="#10b981" color="#10b981" />
                <span className="message-thread__online-status">
                  {getOnlineStatusText()}
                </span>
              </>
            ) : (
              <span className="message-thread__participant-count">
                {activeConversation.participants?.length || 0} participants
              </span>
            )}
          </div>
        </div>
        <button 
          className="message-thread__settings-btn"
          onClick={() => setShowSettings(true)}
          title="Conversation settings"
        >
          <Settings size={20} />
        </button>
      </div>

      <div 
        className="message-thread__messages"
        ref={messagesContainerRef}
      >
        {hasMoreMessages && (
          <div className="message-thread__load-more">
            <button 
              className="message-thread__load-more-btn"
              onClick={handleLoadMore}
              disabled={messagesLoading}
            >
              {messagesLoading ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="message-thread__empty">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.filter(message => message && message.id).map((message, index) => {
            const previousMessage = messages[index - 1];
            const showDateSeparator = shouldShowDateSeparator(message, previousMessage);

            // Handle system messages differently
            if (message.type === 'system') {
              return (
                <div key={message.id || `message-${index}`}>
                  {showDateSeparator && (
                    <div className="message-thread__date-separator">
                      <span>{formatDateSeparator(message.timestamp)}</span>
                    </div>
                  )}
                  {renderSystemMessage(message)}
                </div>
              );
            }

            // Regular message handling
            const isOwnMessage = message.senderId === userProfile?.id;
            const isConsecutive = isConsecutiveMessage(message, previousMessage);

            return (
              <div key={message.id || `message-${index}`}>
                {showDateSeparator && (
                  <div className="message-thread__date-separator">
                    <span>{formatDateSeparator(message.timestamp)}</span>
                  </div>
                )}
                
                <div 
                  className={`message-bubble-wrapper ${
                    isOwnMessage ? 'message-bubble-wrapper--own' : 'message-bubble-wrapper--other'
                  }`}
                >
                  {!isOwnMessage && (
                    <UserAvatar 
                      user={getUserData(message.senderId)} 
                      size="small" 
                      className="message-bubble__avatar"
                    />
                  )}
                  
                  <div 
                    className={`message-bubble ${
                      isOwnMessage ? 'message-bubble--own' : 'message-bubble--other'
                    } ${isConsecutive ? 'message-bubble--consecutive' : ''}`}
                  >
                    {!isConsecutive && !isOwnMessage && (
                      <div className="message-bubble__sender">
                        {message.senderName || 'Unknown User'}
                      </div>
                    )}
                    
                    <div className="message-bubble__content">
                    {(message.type === 'text' || !message.type) && (
                      <p className={`message-bubble__text ${
                        message.text && (
                          message.text.includes('Error') || 
                          message.text.includes('error') ||
                          message.text.includes('Exception') ||
                          message.text.includes('[FloatingChatWidget]')
                        ) ? 'message-bubble__text--error' : ''
                      }`}>{message.text || ''}</p>
                    )}
                    
                    {message.type === 'gif' && message.fileData && (
                      <div className="message-bubble__gif">
                        <img 
                          src={message.fileData.preview || message.fileData.url}
                          alt={message.fileData.title || 'GIF'}
                          className="message-bubble__gif-image"
                          loading="lazy"
                        />
                      </div>
                    )}
                    
                    {message.type === 'file' && message.fileData && (
                      <div className="message-bubble__file">
                        {message.fileData.isImage ? (
                          <div className="message-bubble__image">
                            <img 
                              src={message.fileData.url || message.fileUrl}
                              alt={message.fileData.name || 'Image'}
                              onClick={() => setImagePreview(message.fileData.url || message.fileUrl)}
                              className="message-bubble__image-preview"
                            />
                            <div className="message-bubble__image-info">
                              <span>{message.fileData.name}</span>
                              <span className="message-bubble__file-size">
                                {fileUploadService.formatFileSize(message.fileData.size)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="message-bubble__document">
                            <div className="message-bubble__file-icon">
                              <FileText size={24} />
                            </div>
                            <div className="message-bubble__file-info">
                              <span className="message-bubble__file-name">
                                {message.fileData.name || 'File'}
                              </span>
                              <span className="message-bubble__file-size">
                                {fileUploadService.formatFileSize(message.fileData.size)}
                              </span>
                            </div>
                            <a 
                              href={message.fileData.url || message.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="message-bubble__download-btn"
                              title="Download"
                            >
                              <Download size={18} />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {message.type === 'file' && !message.fileData && message.fileUrl && (
                      <div className="message-bubble__file">
                        <div className="message-bubble__file-icon">📎</div>
                        <div className="message-bubble__file-info">
                          <span className="message-bubble__file-name">
                            {message.text || 'File'}
                          </span>
                          <a 
                            href={message.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="message-bubble__file-link"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  
                    <div className="message-bubble__meta">
                      <span className="message-bubble__time">
                        {formatMessageTime(message.timestamp)}
                      </span>
                      {renderMessageStatus(message)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {getTypingUsers().length > 0 && (
          <div className="message-thread__typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="typing-text">
              {getTypingUsers().join(', ')} {getTypingUsers().length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {imagePreview && (
        <div 
          className="message-thread__image-modal"
          onClick={() => setImagePreview(null)}
        >
          <img src={imagePreview} alt="Preview" />
          <button 
            className="message-thread__image-modal-close"
            onClick={() => setImagePreview(null)}
          >
            ×
          </button>
        </div>
      )}

      <ConversationSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        conversation={activeConversation}
      />
    </div>
  );
};

export default MessageThread;