import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Send, Paperclip, Smile, Mic, X, Image as ImageIcon, 
  Bold, Italic, Underline
} from 'lucide-react';
import fileUploadService from '../../services/fileUploadService';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import './InputBar.css';

const InputBar = ({ replyTo, onCancelReply }) => {
  const { 
    sendMessage, 
    sendFileMessage, 
    sendingMessage, 
    activeConversation, 
    setUserTyping, 
    organizationUsers 
  } = useChat();
  const { userProfile } = useAuth();
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const gifPickerRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [message]);

  // Click outside to close pickers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        const emojiButton = event.target.closest('.input-bar__action[title="Add emoji"]');
        if (!emojiButton) {
          setShowEmojiPicker(false);
        }
      }
      if (gifPickerRef.current && !gifPickerRef.current.contains(event.target)) {
        const gifButton = event.target.closest('.input-bar__action[title="Send GIF"]');
        if (!gifButton) {
          setShowGifPicker(false);
        }
      }
    };

    if (showEmojiPicker || showGifPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showEmojiPicker, showGifPicker]);

  // Handle typing indicator
  useEffect(() => {
    if (message.length > 0 && activeConversation && setUserTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setUserTyping(activeConversation.id, userProfile.id, true);
      typingTimeoutRef.current = setTimeout(() => {
        setUserTyping(activeConversation.id, userProfile.id, false);
      }, 3000);
    } else if (message.length === 0 && setUserTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setUserTyping(activeConversation.id, userProfile.id, false);
    }
  }, [message, activeConversation, setUserTyping, userProfile.id]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!message.trim() || sendingMessage || !activeConversation) {
      return;
    }

    const messageText = message.trim();
    setMessage('');
    setShowEmojiPicker(false);
    setShowGifPicker(false);

    try {
      await sendMessage(messageText, 'text', null, replyTo);
      if (onCancelReply) onCancelReply();
    } catch (error) {
      setMessage(messageText);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    setSelectedFile(file);

    try {
      const uploadResult = await fileUploadService.uploadFile(
        file,
        `chat/${activeConversation.id}`,
        (progress) => {
          // Progress callback
        }
      );

      const fileType = file.type.startsWith('image/') ? 'image' : 'file';
      await sendFileMessage(uploadResult.url, fileType, {
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(2) + ' KB',
        mimeType: file.type
      });

      setSelectedFile(null);
    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const insertFormatting = (format) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    let formattedText = '';

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText || 'bold text'}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText || 'italic text'}*`;
        break;
      case 'underline':
        formattedText = `__${selectedText || 'underlined text'}__`;
        break;
      case 'strike':
        formattedText = `~~${selectedText || 'strikethrough text'}~~`;
        break;
      case 'code':
        formattedText = `\`${selectedText || 'code'}\``;
        break;
      case 'link':
        formattedText = `[${selectedText || 'link text'}](url)`;
        break;
      case 'list':
        formattedText = `\n• ${selectedText || 'list item'}`;
        break;
      default:
        return;
    }

    const newMessage = message.substring(0, start) + formattedText + message.substring(end);
    setMessage(newMessage);
    
    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + formattedText.length,
        start + formattedText.length
      );
    }, 0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        // Upload and send voice message
        // Implementation would go here
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredMentions = organizationUsers?.filter(user => 
    user.id !== userProfile?.id &&
    (user.firstName?.toLowerCase().includes(mentionSearch) ||
     user.lastName?.toLowerCase().includes(mentionSearch))
  ).slice(0, 5);

  return (
    <div className="input-bar">
      {/* Reply Preview */}
      {replyTo && (
        <div className="input-bar__reply">
          <div className="input-bar__reply-content">
            <span>Replying to {replyTo.senderName}</span>
            <p>{replyTo.text}</p>
          </div>
          <button onClick={onCancelReply} className="input-bar__reply-cancel">
            <X size={16} />
          </button>
        </div>
      )}

      {/* File Upload Preview */}
      {selectedFile && (
        <div className="input-bar__file-preview">
          <div className="input-bar__file-info">
            {selectedFile.type.startsWith('image/') ? (
              <ImageIcon size={20} />
            ) : (
              <Paperclip size={20} />
            )}
            <span>{selectedFile.name}</span>
          </div>
          {uploadingFile && <div className="input-bar__upload-progress" />}
        </div>
      )}

      {/* Main Input Area */}
      <div className="input-bar__container">
        {/* Left Formatting Actions */}
        <div className="input-bar__actions input-bar__actions--left">
          <button
            className="input-bar__action"
            onClick={() => insertFormatting('bold')}
            title="Bold (Ctrl+B)"
          >
            <Bold size={16} />
          </button>
          <button
            className="input-bar__action"
            onClick={() => insertFormatting('italic')}
            title="Italic (Ctrl+I)"
          >
            <Italic size={16} />
          </button>
          <button
            className="input-bar__action"
            onClick={() => insertFormatting('underline')}
            title="Underline (Ctrl+U)"
          >
            <Underline size={16} />
          </button>
        </div>

        {/* Text Input */}
        <div className="input-bar__input-wrapper">
          {/* Mentions Dropdown */}
          {showMentions && filteredMentions?.length > 0 && (
            <div className="input-bar__mentions">
              {filteredMentions.map(user => (
                <button
                  key={user.id}
                  className="input-bar__mention-item"
                  onClick={() => {
                    const textarea = textareaRef.current;
                    const cursorPos = textarea.selectionStart;
                    const textBefore = message.substring(0, cursorPos);
                    const textAfter = message.substring(cursorPos);
                    const lastAtIndex = textBefore.lastIndexOf('@');
                    const newMessage = 
                      textBefore.substring(0, lastAtIndex) +
                      `@${user.firstName} ${user.lastName} ` +
                      textAfter;
                    setMessage(newMessage);
                    setShowMentions(false);
                  }}
                >
                  <Hash size={14} />
                  {user.firstName} {user.lastName}
                </button>
              ))}
            </div>
          )}

          <input
            ref={textareaRef}
            type="text"
            value={message}
            onChange={(e) => {
              const value = e.target.value;
              setMessage(value);
              
              // Check for mentions
              const cursorPosition = e.target.selectionStart;
              const textBeforeCursor = value.substring(0, cursorPosition);
              const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
              
              if (mentionMatch) {
                setShowMentions(true);
                setMentionSearch(mentionMatch[1].toLowerCase());
              } else {
                setShowMentions(false);
              }
            }}
            onKeyPress={handleKeyPress}
            placeholder={isRecording ? "Recording..." : "Type a message..."}
            className="input-bar__input"
            disabled={sendingMessage || isRecording}
          />
        </div>

        {/* Right Actions */}
        <div className="input-bar__actions input-bar__actions--right">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          />
          
          <button
            className="input-bar__action"
            onClick={() => {
              setShowGifPicker(!showGifPicker);
              setShowEmojiPicker(false);
            }}
            title="Send GIF"
          >
            <span style={{ fontSize: '11px', fontWeight: 600 }}>GIF</span>
          </button>
          
          <button
            className="input-bar__action"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowGifPicker(false);
            }}
            title="Add emoji"
          >
            <Smile size={16} />
          </button>
          
          <button
            className="input-bar__action"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
            title="Attach file"
          >
            <Paperclip size={16} />
          </button>
        </div>

        {/* Send Button */}
        <button
          className="input-bar__send"
          onClick={handleSubmit}
          disabled={sendingMessage || !message.trim()}
          title="Send message"
        >
          Send
        </button>
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="input-bar__picker" ref={emojiPickerRef}>
          <EmojiPicker
            isInline={true}
            onSelect={(emoji) => {
              setMessage(prev => prev + emoji);
              setShowEmojiPicker(false);
              textareaRef.current?.focus();
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}

      {/* GIF Picker */}
      {showGifPicker && (
        <div className="input-bar__picker" ref={gifPickerRef}>
          <GifPicker
            isInline={true}
            onSelect={async (gif) => {
              await sendMessage('', 'gif', {
                url: gif.url,
                preview: gif.preview,
                title: gif.title
              });
              setShowGifPicker(false);
            }}
            onClose={() => setShowGifPicker(false)}
          />
        </div>
      )}
    </div>
  );
};

export default InputBar;