import React, { useState, useEffect } from 'react';
import { 
  Channel, 
  ChannelList, 
  MessageList, 
  Thread, 
  Window,
  TypingIndicator,
  MessageSimple,
  Chat
} from 'stream-chat-react';
import { EmojiPicker } from 'stream-chat-react/emojis';
import { useStreamChat } from '../../contexts/StreamChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { MessageSquare, X, Send, ChevronLeft, MoreHorizontal, Users } from 'lucide-react';
import CustomMessageInput from './CustomMessageInput';
import CustomChannelPreview from './CustomChannelPreview';
import GiphySelector from './GiphySelector';
import './ChatWidget.css';

const ChatWidget = () => {
  const { client, connectionReady, totalUnreadCount } = useStreamChat();
  const { user, userProfile } = useAuth();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null);

  // Don't render on chat pages
  const isChatPage = location.pathname.includes('/chat');
  
  // Get user ID
  const userId = user?.uid || userProfile?.uid;

  // Channel filters
  const filters = React.useMemo(() => {
    if (!userId) return {};
    return {
      type: { $in: ['messaging', 'team'] },
      members: { $in: [userId] }
    };
  }, [userId]);

  const sort = React.useMemo(() => [{ last_message_at: -1 }], []);
  const options = React.useMemo(() => ({
    state: true,
    watch: true,
    presence: true,
    limit: 10
  }), []);


  // Don't render on chat page or if not connected
  if (isChatPage || !client || !connectionReady) {
    return null;
  }

  return (
    <>
      {isExpanded ? (
        <div className="chat-widget-expanded">
          {!activeChannel && (
            <div className="widget-header">
              <div className="widget-title">
                <MessageSquare size={18} />
                <span>Messages</span>
                {totalUnreadCount > 0 && (
                  <span className="unread-badge">{totalUnreadCount}</span>
                )}
              </div>
              <div className="widget-controls">
                <button 
                  className="widget-control-btn"
                  onClick={() => setIsExpanded(false)}
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          <div className="widget-body">
            <Chat client={client}>
              {!activeChannel ? (
                <div className="widget-channel-list">
                  <ChannelList
                    filters={filters}
                    sort={sort}
                    options={options}
                    Preview={(props) => (
                      <div 
                        className="custom-channel-preview"
                        onClick={() => setActiveChannel(props.channel)}
                      >
                        <CustomChannelPreview {...props} setActiveChannel={setActiveChannel} />
                      </div>
                    )}
                    EmptyStateIndicator={() => (
                      <div className="widget-empty-state">
                        <p>No conversations yet</p>
                      </div>
                    )}
                  />
                </div>
              ) : (
                <div className="widget-chat-area">
                  <Channel 
                    channel={activeChannel}
                    EmojiPicker={EmojiPicker}
                    emojiSearchIndex="facebook"
                    GiphyPreviewMessage={GiphySelector}
                  >
                    <Window>
                      <div className="widget-channel-header">
                        <button 
                          className="back-button"
                          onClick={() => setActiveChannel(null)}
                          title="Back to channels"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        
                        <div className="channel-icon">
                          {activeChannel.data?.image ? (
                            <img src={activeChannel.data.image} alt="" />
                          ) : (
                            <Users size={16} />
                          )}
                        </div>
                        
                        <div className="channel-details">
                          <div className="channel-name">
                            {activeChannel.data?.name || 'Direct Message'}
                          </div>
                          <div className="channel-subtitle">
                            {Object.keys(activeChannel.state?.members || {}).length} members
                          </div>
                        </div>
                        
                        <div className="header-actions">
                          <button className="header-action-btn" title="More options">
                            <MoreHorizontal size={18} />
                          </button>
                          <button 
                            className="header-action-btn" 
                            onClick={() => setIsExpanded(false)}
                            title="Close"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                      <MessageList 
                        Message={MessageSimple}
                        messageActions={['edit', 'delete', 'react', 'reply']}
                        reactionOptions={[
                          { name: 'like', emoji: '👍' },
                          { name: 'love', emoji: '❤️' },
                          { name: 'haha', emoji: '😂' },
                          { name: 'wow', emoji: '😮' }
                        ]}
                        disableDateSeparator
                      />
                      <TypingIndicator />
                      <CustomMessageInput />
                    </Window>
                  </Channel>
                </div>
              )}
            </Chat>
          </div>
        </div>
      ) : (
        <button 
          className="chat-widget-button"
          onClick={() => setIsExpanded(true)}
        >
          <MessageSquare size={24} />
          {totalUnreadCount > 0 && (
            <span className="widget-notification-badge">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </span>
          )}
        </button>
      )}
    </>
  );
};

export default ChatWidget;