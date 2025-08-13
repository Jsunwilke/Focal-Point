import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { Send, Paperclip, X } from 'lucide-react';
import fileUploadService from '../../services/fileUploadService';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import './MessageInput.css';

const MessageInput = () => {
  const { sendMessage, sendFileMessage, sendingMessage, activeConversation, setUserTyping, organizationUsers } = useChat();
  const { userProfile } = useAuth();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    
    if (!message.trim() || sendingMessage || !activeConversation) {
      return;
    }

    const messageText = message.trim();
    setMessage('');
    setIsTyping(false);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await sendMessage(messageText);
    } catch (error) {
      // Error handling is done in the context
      // Restore message on error
      setMessage(messageText);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);
    setIsTyping(value.length > 0);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }

    // Check for @ mentions
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setShowMentions(true);
      setMentionSearch(mentionMatch[1].toLowerCase());
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }

    // Handle typing indicator
    if (value.length > 0 && activeConversation && setUserTyping) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set user as typing
      setUserTyping(activeConversation.id, userProfile.id, true);

      // Set timeout to stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setUserTyping(activeConversation.id, userProfile.id, false);
      }, 3000);
    } else if (value.length === 0 && setUserTyping) {
      // Clear typing status when message is empty
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setUserTyping(activeConversation.id, userProfile.id, false);
    }
  };

  const filteredUsers = organizationUsers?.filter(user => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    return fullName.includes(mentionSearch);
  }) || [];

  const insertMention = (user) => {
    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = message.substring(0, cursorPosition);
    const textAfterCursor = message.substring(cursorPosition);
    const beforeMention = textBeforeCursor.replace(/@\w*$/, '');
    const mention = `@${user.firstName}_${user.lastName}`;
    const newMessage = beforeMention + mention + ' ' + textAfterCursor;
    
    setMessage(newMessage);
    setShowMentions(false);
    
    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current.focus();
      const newCursorPos = beforeMention.length + mention.length + 1;
      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    try {
      // Validate file
      fileUploadService.validateFile(file);
      setSelectedFile(file);
      setUploadingFile(true);
      setUploadProgress(0);

      // Upload file
      const fileData = await fileUploadService.uploadChatFile(
        file,
        activeConversation.id,
        userProfile.id,
        (progress) => {
          setUploadProgress(Math.round(progress));
        }
      );

      // Send file message
      if (sendFileMessage) {
        await sendFileMessage(fileData, file.name);
      } else {
        // Fallback to regular message with file URL
        await sendMessage(`📎 File: ${file.name}\n${fileData.url}`, 'file', fileData);
      }

      // Reset states
      setSelectedFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error('File upload error:', error);
      alert(error.message || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Clean up typing indicator on unmount or conversation change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (setUserTyping && activeConversation && userProfile) {
        setUserTyping(activeConversation.id, userProfile.id, false);
      }
    };
  }, [activeConversation?.id]);

  if (!activeConversation) {
    return null;
  }

  return (
    <div className="message-input">
      {uploadingFile && (
        <div className="message-input__upload-progress">
          <div className="message-input__upload-info">
            <span>{selectedFile?.name}</span>
            <button
              type="button"
              onClick={() => setUploadingFile(false)}
              className="message-input__upload-cancel"
            >
              <X size={16} />
            </button>
          </div>
          <div className="message-input__progress-bar">
            <div 
              className="message-input__progress-fill" 
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <span className="message-input__progress-text">{uploadProgress}%</span>
        </div>
      )}
      
      {showMentions && filteredUsers.length > 0 && (
        <div className="message-input__mentions-dropdown">
          {filteredUsers.slice(0, 5).map((user, index) => (
            <div
              key={user.id}
              className={`message-input__mention-item ${index === mentionIndex ? 'active' : ''}`}
              onClick={() => insertMention(user)}
              onMouseEnter={() => setMentionIndex(index)}
            >
              <div className="message-input__mention-avatar">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div className="message-input__mention-info">
                <div className="message-input__mention-name">
                  {user.firstName} {user.lastName}
                </div>
                <div className="message-input__mention-email">
                  {user.email}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="message-input__form">
        <div className="message-input__container">
          <button
            type="button"
            className="message-input__file-btn"
            onClick={handleFileSelect}
            disabled={sendingMessage || uploadingFile}
            title="Attach file"
          >
            <Paperclip size={20} />
          </button>
          
          <EmojiPicker 
            onSelect={(emoji) => {
              const cursorPos = textareaRef.current?.selectionStart || message.length;
              const newMessage = message.slice(0, cursorPos) + emoji + message.slice(cursorPos);
              setMessage(newMessage);
              setTimeout(() => {
                textareaRef.current?.focus();
                const newPos = cursorPos + emoji.length;
                textareaRef.current?.setSelectionRange(newPos, newPos);
              }, 0);
            }}
          />
          
          <GifPicker
            onSelect={async (gif) => {
              try {
                await sendMessage('', 'gif', {
                  url: gif.url,
                  preview: gif.preview,
                  title: gif.title
                });
              } catch (error) {
                console.error('Failed to send GIF:', error);
              }
            }}
          />
          
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="message-input__textarea"
            rows={1}
            disabled={sendingMessage}
          />
          
          <button
            type="submit"
            className={`message-input__send-btn ${
              message.trim() ? 'message-input__send-btn--active' : ''
            }`}
            disabled={!message.trim() || sendingMessage}
            title="Send message"
          >
            {sendingMessage ? (
              <div className="message-input__loading-spinner" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept="image/*,.pdf,.doc,.docx,.txt"
        />
      </form>
      
      {isTyping && (
        <div className="message-input__typing-indicator">
          <span>Press Enter to send, Shift+Enter for new line</span>
        </div>
      )}
    </div>
  );
};

export default MessageInput;