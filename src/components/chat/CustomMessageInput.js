import React, { useState, useCallback, useRef } from 'react';
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
    
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    };

    const handleEmojiSelect = (emoji) => {
      setText(text + emoji.native);
      setShowEmojiPicker(false);
    };

    return (
      <div className="custom-message-input-container">
        {/* Action buttons */}
        <div className="input-actions-left">
          <button 
            className="input-action-button"
            onClick={toggleActions}
            title="More actions"
          >
            <Plus size={20} />
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

        {/* Main input area */}
        <div className="input-wrapper">
          <textarea
            className="message-input-field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Message #${channel?.data?.name || 'channel'}`}
            rows={1}
          />
          
          {/* Emoji picker */}
          {showEmojiPicker && (
            <div className="emoji-picker-wrapper">
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
            <div className="giphy-selector-wrapper">
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

        {/* Right actions */}
        <div className="input-actions-right">
          <button 
            className="input-action-button"
            onClick={toggleGiphy}
            title="Send GIF"
          >
            GIF
          </button>
          
          <button 
            className="input-action-button"
            onClick={toggleEmojiPicker}
            title="Add emoji"
          >
            <Smile size={20} />
          </button>
          
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