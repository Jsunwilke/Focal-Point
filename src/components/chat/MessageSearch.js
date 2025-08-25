import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useChatContext } from 'stream-chat-react';
import { X, Search, User, Calendar, MessageSquare, FileText, Image } from 'lucide-react';
import './MessageSearch.css';

const MessageSearch = ({ channel, onClose }) => {
  const { client } = useChatContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const searchTimeoutRef = useRef(null);

  // Debounced search function
  const performSearch = useCallback(async (query) => {
    if (!query.trim() || !channel) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Search messages in the current channel
      const response = await client.search(
        {
          id: channel.id
        },
        {
          text: {
            $autocomplete: query
          }
        },
        {
          limit: 50,
          sort: [{ relevance: -1 }]
        }
      );

      setSearchResults(response.results || []);
    } catch (err) {
      console.error('Error searching messages:', err);
      setError('Failed to search messages');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [channel, client]);

  // Handle search input with debouncing
  const handleSearchInput = (value) => {
    setSearchQuery(value);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const highlightText = (text, query) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <mark key={index}>{part}</mark> : 
        part
    );
  };

  const handleMessageClick = (message) => {
    // TODO: Implement scroll to message in main chat
    console.log('Jump to message:', message.message.id);
    onClose();
  };

  const getAttachmentIcon = (attachment) => {
    if (attachment.type === 'image') return <Image size={16} />;
    if (attachment.type === 'file') return <FileText size={16} />;
    return <FileText size={16} />;
  };

  return (
    <div className="message-search-overlay" onClick={onClose}>
      <div className="message-search-container" onClick={(e) => e.stopPropagation()}>
        <div className="message-search-header">
          <div className="search-input-wrapper">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button 
                className="clear-search"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="message-search-body">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Searching messages...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && searchQuery && searchResults.length === 0 && (
            <div className="empty-state">
              <Search size={48} className="empty-icon" />
              <h4>No results found</h4>
              <p>Try searching with different keywords</p>
            </div>
          )}

          {!loading && !error && !searchQuery && (
            <div className="empty-state">
              <Search size={48} className="empty-icon" />
              <h4>Search in conversation</h4>
              <p>Type to search through all messages in this channel</p>
            </div>
          )}

          {!loading && !error && searchResults.length > 0 && (
            <div className="search-results-list">
              <div className="results-header">
                <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
              </div>
              {searchResults.map((result) => {
                const message = result.message;
                return (
                  <div 
                    key={message.id} 
                    className="search-result-item"
                    onClick={() => handleMessageClick(result)}
                  >
                    <div className="result-header">
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
                      <span className="message-date">
                        <Calendar size={14} />
                        {formatDate(message.created_at)}
                      </span>
                    </div>
                    
                    <div className="result-content">
                      {message.text ? (
                        <p className="message-text">
                          {highlightText(message.text, searchQuery)}
                        </p>
                      ) : message.attachments?.length > 0 ? (
                        <div className="attachment-info">
                          {getAttachmentIcon(message.attachments[0])}
                          <span>
                            {message.attachments[0].type === 'image' && 'Image'}
                            {message.attachments[0].type === 'file' && (message.attachments[0].title || 'File')}
                            {message.attachments[0].type === 'giphy' && 'GIF'}
                          </span>
                        </div>
                      ) : (
                        <p className="no-content">No content</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageSearch;