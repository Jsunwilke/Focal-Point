import React from 'react';
import { MessageSimple, useMessageContext, Avatar, useChatContext } from 'stream-chat-react';

const CustomMessage = (props) => {
  const { message } = useMessageContext();
  const { client } = useChatContext();
  
  if (!message) return <MessageSimple {...props} />;
  
  // Check if this is a Giphy message from iOS (has attachment + Giphy URL text)
  const hasAttachments = message.attachments && message.attachments.length > 0;
  const hasText = message.text && message.text.trim().length > 0;
  
  // Simple check for Giphy URL in text
  const isGiphyText = hasText && (
    message.text.includes('giphy.com') ||
    /media\d*\.giphy/i.test(message.text)
  );
  
  // Check if attachment is from Giphy
  const hasGiphyAttachment = hasAttachments && message.attachments.some(
    att => att.image_url?.includes('giphy') || 
           att.thumb_url?.includes('giphy') ||
           att.type === 'giphy'
  );
  
  // If this is an iOS Giphy message (has both Giphy attachment and URL text), render custom
  if (hasGiphyAttachment && isGiphyText) {
    console.log('CustomMessage: Rendering iOS Giphy message custom', {
      text: message.text,
      attachments: message.attachments,
      hasGiphyAttachment,
      isGiphyText
    });
    
    const giphyAttachment = message.attachments.find(
      att => att.image_url?.includes('giphy') || 
             att.thumb_url?.includes('giphy') ||
             att.type === 'giphy'
    );
    
    const imageUrl = giphyAttachment?.image_url || giphyAttachment?.thumb_url;
    
    if (imageUrl) {
      console.log('CustomMessage: Rendering with imageUrl:', imageUrl);
      // Check if this message is from the current user
      const isMyMessage = message.user?.id === client?.user?.id;
      
      // For now, use a consistent smaller size that matches web app GIFs in widget
      // Web app GIFs appear to be displaying around 120px in the widget
      const gifSize = '120px';
      
      // Custom render for iOS Giphy messages - just the image, no text
      return (
        <div className={`str-chat__message str-chat__message--regular ${isMyMessage ? 'str-chat__message--me' : 'str-chat__message--other'}`}>
          <div className="str-chat__message-inner">
            {/* Only show avatar for other users' messages */}
            {!isMyMessage && (
              <Avatar 
                image={message.user?.image}
                name={message.user?.name || message.user?.id}
              />
            )}
            <div className="str-chat__message-text-container">
              <div className="str-chat__message-text">
                <div className="str-chat__message-text-inner str-chat__message-simple-text-inner">
                  <div className="str-chat__message-attachment str-chat__message-attachment--image">
                    <img 
                      src={imageUrl} 
                      alt="GIF"
                      style={{
                        width: '180px',
                        height: '180px',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        display: 'block'
                      }}
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }
  
  // For all other messages, use the default MessageSimple component
  return <MessageSimple {...props} message={message} />;
};

export default CustomMessage;