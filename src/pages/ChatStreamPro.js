import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Channel, 
  ChannelList, 
  MessageList, 
  MessageInput, 
  Thread, 
  Window,
  ChannelHeader,
  TypingIndicator,
  MessageSimple,
  useChannelStateContext,
  useChatContext,
  Avatar,
  ChannelPreviewMessenger,
  Chat
} from 'stream-chat-react';
import { EmojiPicker } from 'stream-chat-react/emojis';
import { useStreamChat } from '../contexts/StreamChatContext';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquarePlus, Search, Settings, Users, X, Plus, Hash, Lock, Globe } from 'lucide-react';
import CreateGroupModal from '../components/chat/CreateGroupModal';
import ChannelSettingsModal from '../components/chat/ChannelSettingsModal';
import CustomChannelHeader from '../components/chat/CustomChannelHeader';
import CustomMessageInput from '../components/chat/CustomMessageInput';
import CustomChannelPreview from '../components/chat/CustomChannelPreview';
import CustomChannelSearch from '../components/chat/CustomChannelSearch';
import CustomMessage from '../components/chat/CustomMessage';
import GiphySelector from '../components/chat/GiphySelector';

import 'stream-chat-react/dist/css/v2/index.css';
import './ChatStreamPro.css';

const ChatStreamPro = () => {
  const { client, isConnecting, connectionError, connectionReady, retryConnection } = useStreamChat();
  const { user, userProfile } = useAuth();
  
  // Modal states
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [isWidgetMode, setIsWidgetMode] = useState(false);
  const [isWidgetOpen, setIsWidgetOpen] = useState(true);

  // Channel list filters
  const filters = useMemo(() => {
    const userId = user?.uid || userProfile?.uid;
    if (!userId) return {};
    
    return {
      type: { $in: ['messaging', 'team'] },
      members: { $in: [userId] }
    };
  }, [user?.uid, userProfile?.uid]);
  
  const sort = useMemo(() => [{ last_message_at: -1 }], []);
  
  // Custom channel renderer to sort pinned channels to top
  const renderChannels = useCallback((channels, getChannelPreview) => {
    const pinnedChannels = [];
    const regularChannels = [];
    
    for (const channel of channels) {
      if (channel.data?.pinned) {
        pinnedChannels.push(channel);
      } else {
        regularChannels.push(channel);
      }
    }
    
    // Return pinned channels first, then regular channels
    return [
      ...pinnedChannels.map(getChannelPreview),
      ...regularChannels.map(getChannelPreview)
    ];
  }, []);
  
  const options = useMemo(() => ({
    state: true,
    watch: true,
    presence: true,
    limit: 30
  }), []);


  // Custom channel list header
  const CustomChannelListHeader = () => (
    <div className="channel-list-header">
      <div className="channel-list-title">
        <h2>Messages</h2>
        <button 
          className="new-chat-button"
          onClick={() => setShowCreateGroup(true)}
          title="New Conversation"
        >
          <MessageSquarePlus size={20} />
        </button>
      </div>
      <div className="channel-search-wrapper">
        <CustomChannelSearch />
      </div>
    </div>
  );

  // Custom empty state
  const EmptyStateIndicator = () => (
    <div className="channel-list-empty">
      <div className="empty-state-content">
        <div className="empty-icon">💬</div>
        <h3>No conversations yet</h3>
        <p>Start a new conversation to connect with your team</p>
        <button 
          className="create-channel-btn"
          onClick={() => setShowCreateGroup(true)}
        >
          Start New Chat
        </button>
      </div>
    </div>
  );

  // Toggle widget mode
  const toggleWidgetMode = () => {
    setIsWidgetMode(!isWidgetMode);
    if (!isWidgetMode) {
      setIsWidgetOpen(true);
    }
  };

  // Loading state
  if (isConnecting) {
    return (
      <div className="chat-stream-loading">
        <div className="loading-spinner"></div>
        <p>Connecting to chat...</p>
      </div>
    );
  }

  // Error state
  if (connectionError) {
    return (
      <div className="chat-stream-error">
        <div className="error-icon">⚠️</div>
        <h3>Chat Connection Error</h3>
        <p>{connectionError}</p>
        <button onClick={retryConnection} className="retry-button">
          Retry Connection
        </button>
      </div>
    );
  }

  // Not ready state
  if (!client) {
    return (
      <div className="chat-stream-not-ready">
        <p>Chat is not available. Please check your Stream Chat configuration.</p>
      </div>
    );
  }

  // Widget mode render
  if (isWidgetMode) {
    return (
      <>
        <div className={`chat-widget ${isWidgetOpen ? 'open' : ''}`}>
          {isWidgetOpen ? (
            <div className="chat-widget-container">
              <div className="chat-widget-header">
                <h3>Chat</h3>
                <div className="widget-controls">
                  <button onClick={() => setIsWidgetMode(false)} title="Expand">
                    <Globe size={18} />
                  </button>
                  <button onClick={() => setIsWidgetOpen(false)} title="Minimize">
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="chat-widget-body">
                <div className="widget-channel-list">
                  <ChannelList
                    filters={filters}
                    sort={sort}
                    options={options}
                    Preview={CustomChannelPreview}
                    EmptyStateIndicator={EmptyStateIndicator}
                  />
                </div>
                <div className="widget-chat-area">
                  <Channel 
                    EmojiPicker={EmojiPicker}
                    emojiSearchIndex="facebook"
                    GiphyPreviewMessage={GiphySelector}
                  >
                    <Window>
                      <CustomChannelHeader 
                        onSettingsClick={() => setShowChannelSettings(true)} 
                      />
                      <MessageList 
                        Message={CustomMessage}
                        messageActions={['edit', 'delete', 'react', 'reply', 'quote']}
                        reactionOptions={[
                          { name: 'like', emoji: '👍' },
                          { name: 'love', emoji: '❤️' },
                          { name: 'haha', emoji: '😂' },
                          { name: 'wow', emoji: '😮' },
                          { name: 'sad', emoji: '😢' },
                          { name: 'angry', emoji: '😡' }
                        ]}
                      />
                      <TypingIndicator />
                      <CustomMessageInput />
                    </Window>
                    <Thread />
                  </Channel>
                </div>
              </div>
            </div>
          ) : (
            <button 
              className="chat-widget-button"
              onClick={() => setIsWidgetOpen(true)}
            >
              <MessageSquarePlus size={24} />
              <span className="widget-badge">3</span>
            </button>
          )}
        </div>
        <button 
          className="widget-mode-toggle"
          onClick={toggleWidgetMode}
          title="Exit Widget Mode"
        >
          Exit Widget
        </button>
      </>
    );
  }

  // Full page render
  return (
    <div className="chat-stream-pro-container">
      
      <div className="chat-stream-layout">
        {/* Channel List Sidebar */}
        <div className="channel-list-container">
          <CustomChannelListHeader />
          {client && connectionReady ? (
            <ChannelList
              filters={filters}
              sort={sort}
              options={options}
              Preview={CustomChannelPreview}
              EmptyStateIndicator={EmptyStateIndicator}
              renderChannels={renderChannels}
              showChannelSearch={false}
            />
          ) : (
            <div className="channel-list-not-ready">
              <p>Loading conversations...</p>
            </div>
          )}
        </div>

        {/* Main Chat Area */}
        <div className="main-chat-container">
          <Channel 
            EmojiPicker={EmojiPicker}
            emojiSearchIndex="facebook"
            giphyEnabled={true}
            onMentionsHover={(event, user) => console.log('Mention hover:', user)}
            onMentionsClick={(event, user) => console.log('Mention click:', user)}
          >
            <Window>
              <CustomChannelHeader 
                onSettingsClick={() => {
                  const channel = client?.activeChannel;
                  if (channel) {
                    setSelectedChannel(channel);
                    setShowChannelSettings(true);
                  }
                }}
              />
              <MessageList 
                Message={CustomMessage}
                messageActions={['edit', 'delete', 'react', 'reply', 'quote', 'pin']}
                reactionOptions={[
                  { name: 'like', emoji: '👍' },
                  { name: 'love', emoji: '❤️' },
                  { name: 'haha', emoji: '😂' },
                  { name: 'wow', emoji: '😮' },
                  { name: 'sad', emoji: '😢' },
                  { name: 'angry', emoji: '😡' },
                  { name: 'fire', emoji: '🔥' },
                  { name: 'celebrate', emoji: '🎉' },
                  { name: 'check', emoji: '✅' },
                  { name: 'eyes', emoji: '👀' }
                ]}
                hasMore={true}
                loadMore={() => console.log('Loading more messages...')}
                threadList={true}
                customMessageRenderer={(messageProps) => {
                  // Custom message rendering for special types
                  return null; // Return null to use default
                }}
              />
              <TypingIndicator />
              <CustomMessageInput />
            </Window>
            <Thread />
          </Channel>
        </div>
      </div>

      {/* Widget Mode Toggle */}
      <button 
        className="widget-mode-toggle floating"
        onClick={toggleWidgetMode}
        title="Switch to Widget Mode"
      >
        <MessageSquarePlus size={20} />
      </button>

      {/* Modals */}
      {showCreateGroup && (
        <CreateGroupModal
          isOpen={showCreateGroup}
          onClose={() => setShowCreateGroup(false)}
          client={client}
          currentUser={userProfile}
        />
      )}

      {showChannelSettings && selectedChannel && (
        <ChannelSettingsModal
          isOpen={showChannelSettings}
          onClose={() => {
            setShowChannelSettings(false);
            setSelectedChannel(null);
          }}
          channel={selectedChannel}
          currentUser={userProfile}
        />
      )}
    </div>
  );
};

export default ChatStreamPro;