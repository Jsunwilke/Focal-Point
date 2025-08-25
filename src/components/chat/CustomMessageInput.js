import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  MessageInput, 
  useMessageInputContext,
  useChannelActionContext,
  useChannelStateContext,
  useChatContext
} from 'stream-chat-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { Smile, Paperclip, Send, Image, Plus, AtSign, Hash } from 'lucide-react';
import GiphySelector from './GiphySelector';
import './CustomMessageInput.css';

const CustomMessageInput = () => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGiphy, setShowGiphy] = useState(false);
  const [showActions, setShowActions] = useState(false);
  
  const { channel } = useChannelStateContext();
  const { sendMessage } = useChannelActionContext();
  const { client } = useChatContext();
  
  // File input refs
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  
  // Picker refs for click-outside detection
  const emojiPickerRef = useRef(null);
  const giphyPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const giphyButtonRef = useRef(null);

  // Toggle emoji picker
  const toggleEmojiPicker = useCallback(() => {
    setShowEmojiPicker(!showEmojiPicker);
    setShowGiphy(false);
    setShowActions(false);
  }, [showEmojiPicker]);

  // Toggle Giphy selector
  const toggleGiphy = useCallback(() => {
    setShowGiphy(!showGiphy);
    setShowEmojiPicker(false);
    setShowActions(false);
  }, [showGiphy]);

  // Toggle action menu
  const toggleActions = useCallback(() => {
    setShowActions(!showActions);
    setShowEmojiPicker(false);
    setShowGiphy(false);
  }, [showActions]);
  
  // Handle click outside to close pickers
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close emoji picker if clicking outside
      if (showEmojiPicker && 
          emojiPickerRef.current && 
          !emojiPickerRef.current.contains(event.target) &&
          emojiButtonRef.current &&
          !emojiButtonRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
      
      // Close GIF picker if clicking outside
      if (showGiphy && 
          giphyPickerRef.current && 
          !giphyPickerRef.current.contains(event.target) &&
          giphyButtonRef.current &&
          !giphyButtonRef.current.contains(event.target)) {
        setShowGiphy(false);
      }
      
      // Close actions menu if clicking outside
      if (showActions && !event.target.closest('.actions-menu') && !event.target.closest('.input-action-button')) {
        setShowActions(false);
      }
    };

    if (showEmojiPicker || showGiphy || showActions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showEmojiPicker, showGiphy, showActions]);
  
  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      // Upload file and send as attachment
      const response = await channel.sendFile(file);
      
      // Send message with file attachment (no text to avoid redundant labels)
      await channel.sendMessage({
        attachments: [
          {
            type: 'file',
            asset_url: response.file,
            title: file.name,
            file_size: file.size,
            mime_type: file.type
          }
        ]
      });
      
      setShowActions(false);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
    
    // Reset input
    event.target.value = '';
  };
  
  // Handle image upload
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      // Upload image and send as attachment
      const response = await channel.sendImage(file);
      
      // Send message with image attachment (no text to avoid redundant labels)
      await channel.sendMessage({
        attachments: [
          {
            type: 'image',
            image_url: response.file,
            fallback: file.name
          }
        ]
      });
      
      setShowActions(false);
    } catch (error) {
      console.error('Error uploading image:', error);
    }
    
    // Reset input
    event.target.value = '';
  };

  // Custom input with enhanced features
  const CustomInput = () => {
    const { text, setText, handleSubmit } = useMessageInputContext();
    const textareaRef = useRef(null);
    
    // Auto-resize textarea function
    const autoResize = useCallback(() => {
      if (textareaRef.current) {
        // Reset to calculate actual height needed
        textareaRef.current.setAttribute('style', `
          height: auto !important;
          font-size: 14px !important;
          padding: 2px 0 !important;
          border: none !important;
          background: transparent !important;
          outline: none !important;
          resize: none !important;
          width: 100% !important;
          box-shadow: none !important;
          line-height: 1.4 !important;
        `);
        
        // Calculate and set new height
        const scrollHeight = textareaRef.current.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, 20), 80);
        
        textareaRef.current.setAttribute('style', `
          height: ${newHeight}px !important;
          overflow-y: ${newHeight >= 80 ? 'auto' : 'hidden'} !important;
          font-size: 14px !important;
          padding: 2px 0 !important;
          border: none !important;
          background: transparent !important;
          outline: none !important;
          resize: none !important;
          width: 100% !important;
          box-shadow: none !important;
          line-height: 1.4 !important;
        `);
      }
    }, []);
    
    // Auto-resize on text change
    useEffect(() => {
      autoResize();
    }, [text, autoResize]);
    
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    };
    
    const handleTextChange = (e) => {
      setText(e.target.value);
      autoResize();
    };

    const handleEmojiSelect = (emoji) => {
      setText(text + emoji.native);
      setShowEmojiPicker(false);
    };

    return (
      <div className="custom-message-input-container">
        {/* Main input area - First Row */}
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="message-input-field"
            value={text}
            onChange={handleTextChange}
            onInput={autoResize}
            onKeyPress={handleKeyPress}
            placeholder={`Message #${channel?.data?.name || 'channel'}`}
            rows={1}
          />
          
          {/* Emoji picker */}
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="emoji-picker-wrapper">
              <Picker 
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme="light"
                previewPosition="none"
                skinTonePosition="none"
              />
            </div>
          )}
          
          {/* Giphy selector */}
          {showGiphy && (
            <div ref={giphyPickerRef} className="giphy-selector-wrapper">
              <GiphySelector 
                onGifSelect={(gif) => {
                  // Send as a giphy attachment
                  sendMessage({
                    text: '',
                    attachments: [gif]
                  });
                  setShowGiphy(false);
                }}
                onClose={() => setShowGiphy(false)}
              />
            </div>
          )}
        </div>

        {/* Second Row - All Actions */}
        <div className="input-actions-container">
          {/* Left actions - paperclip, emoji, gif */}
          <div className="input-actions-left">
            <button 
              className="input-action-button"
              onClick={toggleActions}
              title="More actions"
            >
              <Paperclip size={20} />
            </button>
            
            <button 
              ref={emojiButtonRef}
              className="input-action-button"
              onClick={toggleEmojiPicker}
              title="Add emoji"
            >
              <Smile size={20} />
            </button>
            
            <button 
              ref={giphyButtonRef}
              className="input-action-button"
              onClick={toggleGiphy}
              title="Send GIF"
            >
              GIF
            </button>
            
            {showActions && (
              <div className="actions-menu">
                <button 
                  className="action-item" 
                  title="Upload file"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={18} />
                  <span>File</span>
                </button>
                <button 
                  className="action-item" 
                  title="Upload image"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <Image size={18} />
                  <span>Image</span>
                </button>
              </div>
            )}
            
            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageUpload}
            />
          </div>

          {/* Right actions - only send button */}
          <div className="input-actions-right">
            <button 
              className="send-button"
              onClick={handleSubmit}
              disabled={!text.trim()}
              title="Send message"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <MessageInput 
      Input={CustomInput}
      additionalTextareaProps={{
        placeholder: `Message #${channel?.data?.name || 'channel'}`,
        maxLength: 5000
      }}
      grow
      maxRows={10}
      emojiPicker={false}
      publishTypingEvent={true}
      shouldSubmit={(message) => message.text?.trim().length > 0}
    />
  );
};

export default CustomMessageInput;