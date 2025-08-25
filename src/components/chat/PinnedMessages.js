import React, { useState, useEffect } from 'react';
import { useChatContext } from 'stream-chat-react';
import { X, Pin, User, Calendar, MessageSquare } from 'lucide-react';
import './PinnedMessages.css';

const PinnedMessages = ({ channel, onClose }) => {
  const { client } = useChatContext();
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!channel) return;

    const fetchPinnedMessages = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get pinned messages from channel state first
        const statePinned = channel.state.pinnedMessages || [];
        
        // If there are pinned messages, fetch full details
        if (statePinned.length > 0) {
          setPinnedMessages(statePinned);
        } else {
          // Try to fetch from API
          const response = await channel.getPinnedMessages({
            limit: 100,
            sort: [{ pinned_at: -1 }]
          });
          setPinnedMessages(response.messages || []);
        }
      } catch (err) {
        console.error('Error fetching pinned messages:', err);
        setError('Failed to load pinned messages');
      } finally {
        setLoading(false);
      }
    };

    fetchPinnedMessages();
  }, [channel]);

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const handleUnpin = async (message) => {
    try {
      await client.unpinMessage(message);
      setPinnedMessages(prev => prev.filter(m => m.id !== message.id));
    } catch (err) {
      console.error('Error unpinning message:', err);
    }
  };

  const handleMessageClick = (message) => {
    // TODO: Implement scroll to message in main chat
    console.log('Jump to message:', message.id);
    onClose();
  };

  return (
    <div className="pinned-messages-overlay" onClick={onClose}>
      <div className="pinned-messages-container" onClick={(e) => e.stopPropagation()}>
        <div className="pinned-messages-header">
          <div className="header-title">
            <Pin size={20} />
            <h3>Pinned Messages</h3>
            {pinnedMessages.length > 0 && (
              <span className="count-badge">{pinnedMessages.length}</span>
            )}
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="pinned-messages-body">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading pinned messages...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && pinnedMessages.length === 0 && (
            <div className="empty-state">
              <Pin size={48} className="empty-icon" />
              <h4>No pinned messages</h4>
              <p>Important messages that are pinned will appear here</p>
            </div>
          )}

          {!loading && !error && pinnedMessages.length > 0 && (
            <div className="messages-list">
              {pinnedMessages.map((message) => (
                <div 
                  key={message.id} 
                  className="pinned-message-item"
                  onClick={() => handleMessageClick(message)}
                >
                  <div className="message-header">
                    <div className="user-info">
                      {message.user?.image ? (
                        <img 
                          src={message.user.image} 
                          alt={message.user.name}
                          className="user-avatar"
                        />
                      ) : (
                        <div className="avatar-fallback">
                          <User size={16} />
                        </div>
                      )}
                      <span className="user-name">{message.user?.name || 'Unknown'}</span>
                    </div>
                    <div className="message-meta">
                      <span className="message-date">
                        <Calendar size={14} />
                        {formatDate(message.pinned_at || message.created_at)}
                      </span>
                      <button 
                        className="unpin-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnpin(message);
                        }}
                        title="Unpin message"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="message-content">
                    {message.text ? (
                      <p>{message.text}</p>
                    ) : message.attachments?.length > 0 ? (
                      <div className="attachment-preview">
                        {message.attachments[0].type === 'image' && '📷 Image'}
                        {message.attachments[0].type === 'file' && `📎 ${message.attachments[0].title || 'File'}`}
                        {message.attachments[0].type === 'giphy' && 'GIF'}
                      </div>
                    ) : (
                      <p className="no-content">No content</p>
                    )}
                  </div>

                  {message.pinned_by && (
                    <div className="pinned-by">
                      <Pin size={12} />
                      <span>Pinned by {message.pinned_by.name || message.pinned_by.id}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PinnedMessages;