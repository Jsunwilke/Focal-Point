import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  Reply, Edit2, Trash2, MoreVertical, Download,
  Play, Pause, Image as ImageIcon, File, Mic
} from 'lucide-react';
import UserAvatar from '../shared/UserAvatar';
import './MessageBubble.css';

const MessageBubble = ({ 
  message, 
  isOwn, 
  isConsecutive, 
  isLastInGroup,
  user,
  onReaction,
  onEdit,
  onDelete,
  onReply,
  messageStatus
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [imageLoaded, setImageLoaded] = useState(false);
  const quickReactions = ['❤️', '👍', '😊', '😂', '😮', '😢'];

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'h:mm a');
  };

  const handleEdit = () => {
    if (editText.trim() && editText !== message.text) {
      onEdit(editText);
    }
    setIsEditing(false);
  };

  const renderContent = () => {
    // Editing mode
    if (isEditing) {
      return (
        <div className="message-bubble__edit">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleEdit();
              }
            }}
            autoFocus
            className="message-bubble__edit-input"
          />
          <div className="message-bubble__edit-actions">
            <button onClick={() => setIsEditing(false)}>Cancel</button>
            <button onClick={handleEdit}>Save</button>
          </div>
        </div>
      );
    }

    // Different content types
    switch (message.type) {
      case 'image':
        return (
          <div className="message-bubble__image">
            {!imageLoaded && <div className="message-bubble__image-skeleton" />}
            <img 
              src={message.fileUrl} 
              alt="Shared image"
              onLoad={() => setImageLoaded(true)}
              style={{ display: imageLoaded ? 'block' : 'none' }}
            />
            {message.text && <p className="message-bubble__caption">{message.text}</p>}
          </div>
        );

      case 'file':
        return (
          <div className="message-bubble__file">
            <File size={24} />
            <div className="message-bubble__file-info">
              <span className="message-bubble__file-name">{message.fileName}</span>
              <span className="message-bubble__file-size">{message.fileSize}</span>
            </div>
            <a 
              href={message.fileUrl} 
              download={message.fileName}
              className="message-bubble__file-download"
            >
              <Download size={18} />
            </a>
          </div>
        );

      case 'voice':
        return (
          <div className="message-bubble__voice">
            <button className="message-bubble__voice-play">
              <Play size={18} />
            </button>
            <div className="message-bubble__voice-waveform">
              {[...Array(20)].map((_, i) => (
                <span 
                  key={i} 
                  style={{ height: `${Math.random() * 100}%` }}
                />
              ))}
            </div>
            <span className="message-bubble__voice-duration">
              {message.duration || '0:00'}
            </span>
          </div>
        );

      case 'gif':
        return (
          <div className="message-bubble__gif">
            <img src={message.fileData?.url || message.fileUrl || message.metadata?.url} alt="GIF" />
          </div>
        );

      default:
        // Text message with potential formatting
        return (
          <p className="message-bubble__text">
            {message.text}
            {message.edited && (
              <span className="message-bubble__edited">(edited)</span>
            )}
          </p>
        );
    }
  };

  const handleReaction = (emoji) => {
    onReaction(emoji);
    setShowReactionPicker(false);
  };

  return (
    <div 
      className={`message-bubble ${isOwn ? 'message-bubble--own' : ''} ${isConsecutive ? 'message-bubble--consecutive' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactionPicker(false);
      }}
    >
      {/* Avatar (only for non-consecutive received messages) */}
      {!isOwn && !isConsecutive && (
        <div className="message-bubble__avatar">
          <UserAvatar user={user} size="small" />
        </div>
      )}

      {/* Message Content */}
      <div className="message-bubble__wrapper">
        {/* Sender name (for group chats) */}
        {!isOwn && !isConsecutive && user && (
          <span className="message-bubble__sender">
            {user.firstName} {user.lastName}
          </span>
        )}

        <div className="message-bubble__content">
          {/* Reply reference */}
          {message.replyTo && (
            <div className="message-bubble__reply-ref">
              <Reply size={14} />
              <span>{message.replyTo.text}</span>
            </div>
          )}

          {renderContent()}

          {/* Reactions */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className="message-bubble__reactions">
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  className="message-bubble__reaction"
                  onClick={() => handleReaction(emoji)}
                >
                  {emoji} {users.length > 1 && users.length}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp and status (shown for last message in group) */}
        {isLastInGroup && (
          <div className="message-bubble__meta">
            <span className="message-bubble__time">
              {formatTime(message.timestamp)}
            </span>
            {messageStatus && isOwn && (
              <span className={`message-bubble__status ${messageStatus.className || ''}`}>
                <messageStatus.icon size={14} />
              </span>
            )}
          </div>
        )}

        {/* Action buttons (visible on hover) */}
        {showActions && !isEditing && (
          <div className="message-bubble__actions">
            {/* Quick reactions */}
            {showReactionPicker ? (
              <div className="message-bubble__reaction-picker">
                {quickReactions.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="message-bubble__reaction-option"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <button
                  className="message-bubble__action"
                  onClick={() => setShowReactionPicker(true)}
                  title="React"
                >
                  😊
                </button>
                <button
                  className="message-bubble__action"
                  onClick={() => onReply(message)}
                  title="Reply"
                >
                  <Reply size={16} />
                </button>
                {isOwn && (
                  <>
                    <button
                      className="message-bubble__action"
                      onClick={() => setIsEditing(true)}
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="message-bubble__action message-bubble__action--danger"
                      onClick={() => onDelete()}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;