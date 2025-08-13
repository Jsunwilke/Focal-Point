import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Calendar, User, Hash } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import './MessageSearch.css';

const MessageSearch = ({ isOpen, onClose }) => {
  const { conversations, messages, organizationUsers, setActiveConversation } = useChat();
  const { userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedUser, setSelectedUser] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!searchQuery.trim() && !dateRange.start && !selectedUser) return;
    
    setIsSearching(true);
    const results = [];

    try {
      // Search through all conversations
      for (const conversation of conversations) {
        // Get messages for this conversation
        const conversationMessages = await getConversationMessages(conversation.id);
        
        // Filter messages based on search criteria
        const filteredMessages = conversationMessages.filter(message => {
          // Text search
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const messageText = (message.text || '').toLowerCase();
            const senderName = (message.senderName || '').toLowerCase();
            
            if (!messageText.includes(query) && !senderName.includes(query)) {
              return false;
            }
          }
          
          // User filter
          if (selectedUser && message.senderId !== selectedUser) {
            return false;
          }
          
          // Date range filter
          if (dateRange.start || dateRange.end) {
            const messageDate = message.timestamp?.toDate ? 
              message.timestamp.toDate() : 
              new Date(message.timestamp);
            
            if (dateRange.start && messageDate < new Date(dateRange.start)) {
              return false;
            }
            if (dateRange.end && messageDate > new Date(dateRange.end)) {
              return false;
            }
          }
          
          // Filter type
          if (selectedFilter !== 'all') {
            if (selectedFilter === 'files' && message.type !== 'file') {
              return false;
            }
            if (selectedFilter === 'images' && (!message.fileData || !message.fileData.isImage)) {
              return false;
            }
          }
          
          return true;
        });
        
        // Add filtered messages to results
        filteredMessages.forEach(message => {
          results.push({
            ...message,
            conversationId: conversation.id,
            conversationName: getConversationName(conversation)
          });
        });
      }
      
      // Sort results by date (newest first)
      results.sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return dateB - dateA;
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const getConversationMessages = async (conversationId) => {
    // This would normally fetch from Firebase or cache
    // For now, return current messages if it matches active conversation
    return messages || [];
  };

  const getConversationName = (conversation) => {
    if (conversation.name) return conversation.name;
    
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find(p => p !== userProfile?.id);
      const otherUser = organizationUsers.find(u => u.id === otherParticipant);
      return otherUser ? `${otherUser.firstName} ${otherUser.lastName}` : 'Unknown';
    }
    
    return 'Group Chat';
  };

  const navigateToMessage = (result) => {
    // Find and activate the conversation
    const conversation = conversations.find(c => c.id === result.conversationId);
    if (conversation) {
      setActiveConversation(conversation);
      // TODO: Scroll to specific message
    }
    onClose();
  };

  const highlightSearchTerm = (text) => {
    if (!searchQuery.trim()) return text;
    
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? 
        <mark key={index} className="search-highlight">{part}</mark> : 
        part
    );
  };

  if (!isOpen) return null;

  return (
    <div className="message-search-overlay" onClick={onClose}>
      <div className="message-search-modal" onClick={e => e.stopPropagation()}>
        <div className="message-search-header">
          <h2>Search Messages</h2>
          <button className="message-search-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="message-search-controls">
          <div className="message-search-input-wrapper">
            <Search size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="message-search-input"
            />
          </div>

          <div className="message-search-filters">
            <div className="message-search-filter-group">
              <label>Type:</label>
              <select 
                value={selectedFilter} 
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="message-search-select"
              >
                <option value="all">All Messages</option>
                <option value="files">Files Only</option>
                <option value="images">Images Only</option>
              </select>
            </div>

            <div className="message-search-filter-group">
              <label>From:</label>
              <select 
                value={selectedUser} 
                onChange={(e) => setSelectedUser(e.target.value)}
                className="message-search-select"
              >
                <option value="">All Users</option>
                {organizationUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="message-search-filter-group">
              <label>Date Range:</label>
              <div className="message-search-date-inputs">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="message-search-date"
                />
                <span>to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="message-search-date"
                />
              </div>
            </div>
          </div>

          <button 
            className="message-search-button"
            onClick={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="message-search-results">
          {searchResults.length === 0 && !isSearching && (
            <div className="message-search-empty">
              <Search size={48} />
              <p>No results found</p>
              <span>Try adjusting your search criteria</span>
            </div>
          )}

          {searchResults.map((result, index) => (
            <div 
              key={`${result.id}-${index}`}
              className="message-search-result"
              onClick={() => navigateToMessage(result)}
            >
              <div className="message-search-result-header">
                <span className="message-search-result-sender">
                  <User size={14} />
                  {result.senderName}
                </span>
                <span className="message-search-result-conversation">
                  <Hash size={14} />
                  {result.conversationName}
                </span>
                <span className="message-search-result-date">
                  <Calendar size={14} />
                  {format(
                    result.timestamp?.toDate ? result.timestamp.toDate() : new Date(result.timestamp),
                    'MMM d, yyyy h:mm a'
                  )}
                </span>
              </div>
              <div className="message-search-result-content">
                {result.type === 'file' ? (
                  <span className="message-search-result-file">
                    📎 {result.fileData?.name || 'File attachment'}
                  </span>
                ) : (
                  <p>{highlightSearchTerm(result.text)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MessageSearch;