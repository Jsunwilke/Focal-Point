import React, { useState, useRef } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { Send, Paperclip } from 'lucide-react';
import './MessageInput.css';

const MessageInput = () => {
  const { sendMessage, sendingMessage, activeConversation } = useChat();
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    // TODO: Implement file upload to Firebase Storage
    // For now, just show a placeholder
    
    // Reset file input
    e.target.value = '';
  };

  if (!activeConversation) {
    return null;
  }

  return (
    <div className="message-input">
      <form onSubmit={handleSubmit} className="message-input__form">
        <div className="message-input__container">
          <button
            type="button"
            className="message-input__file-btn"
            onClick={handleFileSelect}
            disabled={sendingMessage}
            title="Attach file"
          >
            <Paperclip size={20} />
          </button>
          
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