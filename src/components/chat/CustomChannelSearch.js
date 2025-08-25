import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChatContext } from 'stream-chat-react';
import { ArrowLeft, Search, X } from 'lucide-react';
import './CustomChannelSearch.css';

const CustomChannelSearch = ({ onSelectResult }) => {
  const { client, setActiveChannel } = useChatContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], channels: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Perform search
  const performSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults({ users: [], channels: [] });
      return;
    }

    setLoading(true);
    try {
      // Search for users
      const userResponse = await client.queryUsers(
        {
          $or: [
            { name: { $autocomplete: query } },
            { id: { $autocomplete: query } }
          ]
        },
        { name: 1 },
        { limit: 5 }
      );

      // Search for channels
      const channelResponse = await client.queryChannels(
        {
          name: { $autocomplete: query },
          members: { $in: [client.userID] }
        },
        { last_message_at: -1 },
        { limit: 5 }
      );

      setSearchResults({
        users: userResponse.users.filter(u => u.id !== client.userID),
        channels: channelResponse
      });
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults({ users: [], channels: [] });
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Handle search input with debouncing
  const handleSearchInput = (value) => {
    setSearchQuery(value);
    setIsSearching(!!value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Handle selecting a user (create/open DM)
  const handleSelectUser = async (user) => {
    try {
      // Create or get existing DM channel
      const channel = client.channel('messaging', {
        members: [client.userID, user.id]
      });
      
      await channel.watch();
      setActiveChannel(channel);
      
      // Clear search
      setSearchQuery('');
      setIsSearching(false);
      setSearchResults({ users: [], channels: [] });
      
      if (onSelectResult) {
        onSelectResult(channel);
      }
    } catch (error) {
      console.error('Error creating/opening DM:', error);
    }
  };

  // Handle selecting a channel
  const handleSelectChannel = (channel) => {
    setActiveChannel(channel);
    
    // Clear search
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults({ users: [], channels: [] });
    
    if (onSelectResult) {
      onSelectResult(channel);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults({ users: [], channels: [] });
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const hasResults = searchResults.users.length > 0 || searchResults.channels.length > 0;

  return (
    <div className="custom-channel-search">
      <div className="search-input-container">
        {isSearching && (
          <button className="search-back-btn" onClick={clearSearch}>
            <ArrowLeft size={18} />
          </button>
        )}
        {!isSearching && (
          <div className="search-icon">
            <Search size={18} />
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search users and conversations..."
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
        />
        {searchQuery && (
          <button className="search-clear-btn" onClick={clearSearch}>
            <X size={18} />
          </button>
        )}
      </div>

      {isSearching && (
        <div className="search-results-container">
          {loading && (
            <div className="search-loading">
              <div className="spinner"></div>
              <span>Searching...</span>
            </div>
          )}

          {!loading && searchQuery && !hasResults && (
            <div className="search-empty">
              <p>No results found</p>
            </div>
          )}

          {!loading && hasResults && (
            <div className="search-results">
              {searchResults.users.length > 0 && (
                <div className="results-section">
                  <div className="results-header">Users</div>
                  {searchResults.users.map(user => (
                    <div 
                      key={user.id}
                      className="search-result-item"
                      onClick={() => handleSelectUser(user)}
                    >
                      <div className="result-avatar">
                        {user.image ? (
                          <img src={user.image} alt={user.name} />
                        ) : (
                          <div className="avatar-fallback">
                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                        )}
                      </div>
                      <div className="result-info">
                        <div className="result-name">{user.name || user.id}</div>
                        {user.online && <div className="result-status">Active now</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.channels.length > 0 && (
                <div className="results-section">
                  <div className="results-header">Conversations</div>
                  {searchResults.channels.map(channel => (
                    <div 
                      key={channel.cid}
                      className="search-result-item"
                      onClick={() => handleSelectChannel(channel)}
                    >
                      <div className="result-avatar">
                        {channel.data?.image ? (
                          <img src={channel.data.image} alt={channel.data.name} />
                        ) : (
                          <div className="avatar-fallback">
                            #
                          </div>
                        )}
                      </div>
                      <div className="result-info">
                        <div className="result-name">
                          {channel.data?.name || 'Unnamed Channel'}
                        </div>
                        <div className="result-status">
                          {Object.keys(channel.state?.members || {}).length} members
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomChannelSearch;