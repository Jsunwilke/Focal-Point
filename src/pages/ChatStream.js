import React from 'react';
import { 
  Channel, 
  ChannelList, 
  MessageList, 
  MessageInput, 
  Thread, 
  Window,
  ChannelHeader,
  TypingIndicator
} from 'stream-chat-react';
import { useStreamChat } from '../contexts/StreamChatContext';
import { useAuth } from '../contexts/AuthContext';

import './ChatStream.css';

const ChatStream = () => {
  const { client, isConnecting, connectionError, connectionReady, retryConnection } = useStreamChat();
  const { user, userProfile } = useAuth();

  // Memoized channel list filters for performance
  const filters = React.useMemo(() => {
    const userId = user?.uid || userProfile?.uid;
    if (!userId) {
      return {};
    }
    
    return {
      type: 'messaging',
      members: { $in: [userId] }
    };
  }, [user?.uid, userProfile?.uid]);
  
  const sort = React.useMemo(() => [{ last_message_at: -1 }], []);
  
  const options = React.useMemo(() => ({
    state: true,
    watch: true,
    presence: true,
    limit: 20
  }), []);

  // Show loading state while connecting
  if (isConnecting) {
    return (
      <div className="chat-stream-loading">
        <div className="loading-spinner"></div>
        <p>Connecting to chat...</p>
      </div>
    );
  }

  // Show error state if connection failed
  if (connectionError) {
    return (
      <div className="chat-stream-error">
        <div className="error-icon">⚠️</div>
        <h3>Chat Connection Error</h3>
        <p>{connectionError}</p>
        <button 
          onClick={retryConnection} 
          className="retry-button"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // Show message if client is not ready
  if (!client) {
    return (
      <div className="chat-stream-not-ready">
        <p>Chat is not available. Please check your Stream Chat configuration.</p>
      </div>
    );
  }

  return (
    <div className="chat-stream-container">
      <div className="chat-stream-layout">
        {/* Channel List Sidebar */}
        <div className="channel-list-container">
          {client && connectionReady ? (
            <ChannelList
              filters={filters}
              sort={sort}
              options={options}
              showChannelSearch
            />
          ) : (
            <div className="channel-list-not-ready">
              <p>Chat is loading...</p>
            </div>
          )}
        </div>

        {/* Main Chat Area */}
        <div className="main-chat-container">
          <Channel>
            <Window>
              <ChannelHeader />
              <MessageList />
              <TypingIndicator />
              <MessageInput />
            </Window>
            <Thread />
          </Channel>
        </div>
      </div>
    </div>
  );
};

export default ChatStream;