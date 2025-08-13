import React, { useState, useEffect, useRef } from 'react';
import { FileImage, Search, X, TrendingUp } from 'lucide-react';
import './GifPicker.css';

// You'll need to get a free API key from https://developers.giphy.com/
const GIPHY_API_KEY = process.env.REACT_APP_GIPHY_API_KEY || 'YOUR_GIPHY_API_KEY';

const GifPicker = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('trending');
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Fetch trending GIFs on mount
  useEffect(() => {
    if (isOpen && activeTab === 'trending') {
      fetchTrendingGifs();
    }
  }, [isOpen, activeTab]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const fetchTrendingGifs = async () => {
    if (!GIPHY_API_KEY || GIPHY_API_KEY === 'YOUR_GIPHY_API_KEY') {
      console.warn('Please add your Giphy API key to use GIF search');
      // Fallback to some default GIFs
      setGifs([
        { id: '1', preview: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
        { id: '2', preview: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif' },
        { id: '3', preview: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif' },
        { id: '4', preview: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif', url: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif' }
      ]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=pg-13`
      );
      const data = await response.json();
      
      const formattedGifs = data.data.map(gif => ({
        id: gif.id,
        preview: gif.images.fixed_height.url,
        url: gif.images.original.url,
        title: gif.title
      }));
      
      setGifs(formattedGifs);
    } catch (error) {
      console.error('Error fetching trending GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query) => {
    if (!query.trim()) {
      fetchTrendingGifs();
      return;
    }

    if (!GIPHY_API_KEY || GIPHY_API_KEY === 'YOUR_GIPHY_API_KEY') {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
      );
      const data = await response.json();
      
      const formattedGifs = data.data.map(gif => ({
        id: gif.id,
        preview: gif.images.fixed_height.url,
        url: gif.images.original.url,
        title: gif.title
      }));
      
      setGifs(formattedGifs);
    } catch (error) {
      console.error('Error searching GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setActiveTab('search');
    
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchGifs(query);
    }, 500);
  };

  const handleGifSelect = (gif) => {
    onSelect({
      type: 'gif',
      url: gif.url,
      preview: gif.preview,
      title: gif.title || 'GIF'
    });
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
    setActiveTab('trending');
  };

  return (
    <div className="gif-picker-container">
      <button
        className="gif-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        title="Send a GIF"
      >
        <span className="gif-text">GIF</span>
      </button>

      {isOpen && (
        <>
          <div className="gif-picker-overlay" onClick={handleClose} />
          <div className="gif-picker-dropdown">
            <div className="gif-picker-header">
              <div className="gif-picker-search">
                <Search size={16} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search GIFs..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="gif-picker-search-input"
                />
                {searchQuery && (
                  <button
                    className="gif-picker-clear"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveTab('trending');
                      fetchTrendingGifs();
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button className="gif-picker-close" onClick={handleClose}>
                <X size={20} />
              </button>
            </div>

            <div className="gif-picker-tabs">
              <button
                className={`gif-picker-tab ${activeTab === 'trending' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('trending');
                  setSearchQuery('');
                  fetchTrendingGifs();
                }}
              >
                <TrendingUp size={16} />
                Trending
              </button>
              {searchQuery && (
                <button
                  className={`gif-picker-tab ${activeTab === 'search' ? 'active' : ''}`}
                  onClick={() => setActiveTab('search')}
                >
                  <Search size={16} />
                  Search Results
                </button>
              )}
            </div>

            <div className="gif-picker-body">
              {loading ? (
                <div className="gif-picker-loading">
                  <div className="gif-picker-spinner" />
                  <p>Loading GIFs...</p>
                </div>
              ) : gifs.length === 0 ? (
                <div className="gif-picker-empty">
                  <FileImage size={48} />
                  <p>No GIFs found</p>
                  <span>Try a different search term</span>
                </div>
              ) : (
                <div className="gif-grid">
                  {gifs.map(gif => (
                    <button
                      key={gif.id}
                      className="gif-item"
                      onClick={() => handleGifSelect(gif)}
                      type="button"
                    >
                      <img 
                        src={gif.preview} 
                        alt={gif.title || 'GIF'}
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="gif-picker-footer">
              <span>Powered by GIPHY</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GifPicker;