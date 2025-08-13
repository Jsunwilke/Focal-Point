import React, { useState, useEffect, useRef } from 'react';
import { FileImage, Search, X, TrendingUp } from 'lucide-react';
import './GifPicker.css';

// You'll need to get a free API key from https://developers.giphy.com/
const GIPHY_API_KEY = process.env.REACT_APP_GIPHY_API_KEY || 'YOUR_GIPHY_API_KEY';

const GifPicker = ({ onSelect, onClose, isInline = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('trending');
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Fetch trending GIFs on mount or when inline
  useEffect(() => {
    if ((isOpen || isInline) && activeTab === 'trending') {
      fetchTrendingGifs();
    }
  }, [isOpen, isInline, activeTab]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const fetchTrendingGifs = async () => {
    if (!GIPHY_API_KEY || GIPHY_API_KEY === 'YOUR_GIPHY_API_KEY') {
      // Provide a good set of fallback GIFs when no API key is configured
      setGifs([
        { id: '1', preview: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', title: 'Thumbs Up' },
        { id: '2', preview: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', title: 'Laughing' },
        { id: '3', preview: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', title: 'Applause' },
        { id: '4', preview: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif', url: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif', title: 'High Five' },
        { id: '5', preview: 'https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif', url: 'https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif', title: 'Excited' },
        { id: '6', preview: 'https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif', url: 'https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif', title: 'Facepalm' },
        { id: '7', preview: 'https://media.giphy.com/media/3o7TKF1fSIs1R19B8k/giphy.gif', url: 'https://media.giphy.com/media/3o7TKF1fSIs1R19B8k/giphy.gif', title: 'Eye Roll' },
        { id: '8', preview: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', title: 'Mind Blown' }
      ]);
      setLoading(false);
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
      // For search without API key, just filter the fallback GIFs
      const fallbackGifs = [
        { id: '1', preview: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', title: 'Thumbs Up' },
        { id: '2', preview: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', title: 'Laughing' },
        { id: '3', preview: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', title: 'Applause' },
        { id: '4', preview: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif', url: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif', title: 'High Five' }
      ];
      setGifs(fallbackGifs.filter(gif => gif.title.toLowerCase().includes(query.toLowerCase())));
      setLoading(false);
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
    onSelect(gif);
    setIsOpen(false);
    setSearchQuery('');
    if (onClose) onClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
    setActiveTab('trending');
    if (onClose) onClose();
  };

  // If inline mode, just render the picker dropdown
  if (isInline) {
    return (
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
                type="button"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="gif-picker-tabs">
          <button
            className={`gif-picker-tab ${activeTab === 'trending' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('trending');
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
          <span>{(!GIPHY_API_KEY || GIPHY_API_KEY === 'YOUR_GIPHY_API_KEY') ? 'Demo GIFs - Add API key for full search' : 'Powered by GIPHY'}</span>
        </div>
      </div>
    );
  }

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
              <span>{(!GIPHY_API_KEY || GIPHY_API_KEY === 'YOUR_GIPHY_API_KEY') ? 'Demo GIFs - Add API key for full search' : 'Powered by GIPHY'}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GifPicker;