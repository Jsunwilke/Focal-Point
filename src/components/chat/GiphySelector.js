import React, { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import './GiphySelector.css';

// Use the provided Giphy API key
const GIPHY_API_KEY = 'pHkSkJcH9UL5jvSjTFpPh8dRXxzX5iSO';
const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs';

const GiphySelector = ({ onGifSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [gifs, setGifs] = useState([]);
  const [trending, setTrending] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('trending'); // trending, search
  const [error, setError] = useState('');

  // Fetch trending GIFs on mount
  useEffect(() => {
    fetchTrendingGifs();
  }, []);

  const fetchTrendingGifs = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const url = `${GIPHY_API_URL}/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=pg-13`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        setTrending(data.data);
        setGifs(data.data);
      } else {
        setError('No GIFs available');
      }
    } catch (err) {
      console.error('Failed to fetch trending GIFs:', err);
      setError('Failed to load GIFs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const searchGifs = useCallback(async (query) => {
    if (!query.trim()) {
      setGifs(trending);
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const url = `${GIPHY_API_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        setGifs(data.data);
        setActiveTab('search');
      } else {
        setGifs([]);
      }
    } catch (err) {
      console.error('Failed to search GIFs:', err);
      setError('Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [trending]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        searchGifs(searchTerm);
      } else {
        setGifs(trending);
        setActiveTab('trending');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, searchGifs, trending]);

  const handleGifSelect = (gif) => {
    if (gif && onGifSelect) {
      // Send as an image attachment for proper display
      const gifData = {
        type: 'image',
        image_url: gif.images.fixed_height.url || gif.images.original.url,
        thumb_url: gif.images.fixed_height_small.url || gif.images.preview_gif?.url,
        fallback: gif.title || 'GIF'
      };
      onGifSelect(gifData);
      // Close the selector after sending
      if (onClose) {
        onClose();
      }
    }
  };


  return (
    <div className="giphy-selector">
      {/* Search Bar with Close Button */}
      <div className="giphy-search">
        <Search size={16} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search GIFs..."
          autoFocus
        />
        {searchTerm && (
          <button 
            className="clear-search"
            onClick={() => setSearchTerm('')}
          >
            <X size={14} />
          </button>
        )}
        {onClose && (
          <button className="giphy-close" onClick={onClose}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="giphy-tabs">
        <button
          className={`tab ${activeTab === 'trending' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('trending');
            setGifs(trending);
            setSearchTerm('');
          }}
        >
          Trending
        </button>
        {searchTerm && (
          <button
            className={`tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Search Results
          </button>
        )}
      </div>


      {/* Error Message */}
      {error && (
        <div className="giphy-error">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="giphy-loading">
          <div className="loading-spinner"></div>
          <p>Loading GIFs...</p>
        </div>
      )}

      {/* GIF Grid */}
      {!isLoading && (
        <div className="giphy-grid">
          {gifs.map((gif) => {
            // Use preview_gif as fallback if fixed_height_small is not available
            const imageUrl = gif.images?.fixed_height_small?.url || 
                           gif.images?.preview_gif?.url || 
                           gif.images?.fixed_height?.url ||
                           gif.images?.original?.url;
            
            if (!imageUrl) {
              return null;
            }
            
            return (
              <div
                key={gif.id}
                className="gif-item"
                onClick={() => handleGifSelect(gif)}
              >
                <img 
                  src={imageUrl} 
                  alt={gif.title || 'GIF'}
                  loading="lazy"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            );
          })}
          {gifs.length === 0 && !isLoading && (
            <div className="no-gifs">
              {searchTerm ? 'No GIFs found. Try a different search.' : 'No trending GIFs available.'}
            </div>
          )}
        </div>
      )}

      {/* Attribution - minimal */}
      <div className="giphy-attribution">
        <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>Powered by GIPHY</span>
      </div>
    </div>
  );
};

export default GiphySelector;