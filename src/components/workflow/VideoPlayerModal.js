// src/components/workflow/VideoPlayerModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, AlertCircle } from 'lucide-react';
import './VideoPlayerModal.css';

/**
 * Parse video URL and return embed information
 * @param {string} url - Video URL (YouTube, Vimeo, or direct)
 * @returns {Object} { type, embedUrl, error }
 */
const parseVideoURL = (url) => {
  if (!url || typeof url !== 'string') {
    return { type: 'error', embedUrl: null, error: 'No video URL provided' };
  }

  try {
    const urlObj = new URL(url);

    // YouTube detection
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      let videoId = null;

      if (urlObj.hostname.includes('youtu.be')) {
        // Short URL: https://youtu.be/VIDEO_ID
        videoId = urlObj.pathname.substring(1);
      } else if (urlObj.searchParams.has('v')) {
        // Standard URL: https://www.youtube.com/watch?v=VIDEO_ID
        videoId = urlObj.searchParams.get('v');
      }

      if (videoId) {
        return {
          type: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          error: null
        };
      }
    }

    // Vimeo detection
    if (urlObj.hostname.includes('vimeo.com')) {
      // URL: https://vimeo.com/VIDEO_ID
      const videoId = urlObj.pathname.split('/').filter(Boolean)[0];
      if (videoId) {
        return {
          type: 'vimeo',
          embedUrl: `https://player.vimeo.com/video/${videoId}`,
          error: null
        };
      }
    }

    // Firebase Storage or direct video URL
    if (
      urlObj.hostname.includes('firebasestorage.googleapis.com') ||
      url.match(/\.(mp4|mov|avi|webm)$/i)
    ) {
      return {
        type: 'direct',
        embedUrl: url,
        error: null
      };
    }

    // Unknown URL format
    return {
      type: 'error',
      embedUrl: null,
      error: 'Unsupported video URL format. Please use YouTube, Vimeo, or direct video links.'
    };
  } catch (error) {
    return {
      type: 'error',
      embedUrl: null,
      error: 'Invalid URL format'
    };
  }
};

/**
 * Video Player Modal Component
 * Displays tutorial videos for workflow steps
 */
const VideoPlayerModal = ({ isOpen, onClose, videoUrl, title }) => {
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && videoUrl) {
      setLoading(true);
      const parsed = parseVideoURL(videoUrl);
      setVideoData(parsed);
      setLoading(false);
    }
  }, [isOpen, videoUrl]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      className="video-player-overlay"
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10002,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        padding: '2rem'
      }}
    >
      <div
        className="video-player-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          backgroundColor: '#000',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            backgroundColor: '#1f2937',
            borderBottom: '1px solid #374151'
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#f9fafb',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {title || 'Tutorial Video'}
          </h3>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              padding: 0,
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: '#9ca3af',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginLeft: '1rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#374151';
              e.currentTarget.style.color = '#f9fafb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Video Content */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            paddingBottom: '56.25%', // 16:9 aspect ratio
            backgroundColor: '#000'
          }}
        >
          {loading ? (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                fontSize: '0.875rem'
              }}
            >
              Loading video...
            </div>
          ) : videoData?.error ? (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                padding: '2rem',
                color: '#ef4444'
              }}
            >
              <AlertCircle size={48} />
              <p style={{ margin: 0, textAlign: 'center', fontSize: '0.875rem' }}>
                {videoData.error}
              </p>
            </div>
          ) : videoData?.type === 'youtube' || videoData?.type === 'vimeo' ? (
            <iframe
              src={videoData.embedUrl}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none'
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={title || 'Tutorial Video'}
            />
          ) : videoData?.type === 'direct' ? (
            <video
              src={videoData.embedUrl}
              controls
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            >
              <track kind="captions" />
              Your browser does not support the video tag.
            </video>
          ) : null}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#1f2937',
            borderTop: '1px solid #374151',
            fontSize: '0.8125rem',
            color: '#9ca3af',
            textAlign: 'center'
          }}
        >
          Press ESC or click outside to close
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default VideoPlayerModal;
