// src/components/workflow/VideoPlayerModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, AlertCircle } from 'lucide-react';
import { secureLogger } from '../../services/secureLogger';
import './VideoPlayerModal.css';

/**
 * Parse video URL and return embed information
 * @param {string} url - Video URL (YouTube, Vimeo, or direct)
 * @returns {Object} { type, embedUrl, error }
 */
const parseVideoURL = (url) => {
  if (!url || typeof url !== 'string') {
    return { type: 'error', embedUrl: null, error: 'No video URL provided. Please add a video URL to enable tutorial playback.' };
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
      error: 'Unsupported video format. Please use YouTube, Vimeo, or upload a direct video file (MP4, MOV, WebM, AVI).'
    };
  } catch (error) {
    return {
      type: 'error',
      embedUrl: null,
      error: 'Invalid video URL. Please check the URL and try again, or upload a video file directly.'
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
  const [playbackError, setPlaybackError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Store currently focused element
      const previouslyFocused = document.activeElement;

      // Focus the modal after a brief delay to ensure it's rendered
      setTimeout(() => {
        const modal = document.querySelector('[role="dialog"]');
        if (modal) modal.focus();
      }, 100);

      // Return focus when modal closes
      return () => {
        if (previouslyFocused) previouslyFocused.focus();
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && videoUrl) {
      setLoading(true);
      setPlaybackError(null);
      const parsed = parseVideoURL(videoUrl);
      setVideoData(parsed);
      setLoading(false);
    }
  }, [isOpen, videoUrl]);

  // Keyboard support (Escape key)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Timeout for loading state (30 seconds)
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        if (loading) {
          setLoading(false);
          setPlaybackError('Video loading timed out. Please check your connection and try again.');
        }
      }, 30000);

      return () => clearTimeout(timeout);
    }
  }, [loading]);

  const handleVideoError = (e) => {
    secureLogger.error('Video playback error', { error: e.message || 'Unknown error' });
    const video = e.target;
    let errorMessage = 'Unable to play video. ';

    if (video.error) {
      switch (video.error.code) {
        case 1: // MEDIA_ERR_ABORTED
          errorMessage += 'Playback was stopped. Please try again.';
          break;
        case 2: // MEDIA_ERR_NETWORK
          errorMessage += 'A network error occurred. Please check your internet connection and try again.';
          break;
        case 3: // MEDIA_ERR_DECODE
          errorMessage += 'The video file is corrupted. Please re-upload the video.';
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          errorMessage += 'This video format is not supported. Please upload a video in MP4, MOV, WebM, or AVI format.';
          break;
        default:
          errorMessage += 'An unexpected error occurred. Please try again.';
      }
    }

    setPlaybackError(errorMessage);
    setLoading(false);
  };

  const handleIframeError = () => {
    secureLogger.error('Iframe load error');
    setPlaybackError('Unable to load the video player. Please verify the video URL is correct, or try using a direct video file (MP4, MOV, WebM) instead.');
    setLoading(false);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setPlaybackError(null);
    setLoading(true);
    const parsed = parseVideoURL(videoUrl);
    setVideoData(parsed);
    setLoading(false);
  };

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
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-modal-title"
      tabIndex={-1}
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
            id="video-modal-title"
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
            aria-label="Close video player"
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
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                color: '#9ca3af',
                fontSize: '0.875rem'
              }}
            >
              <div className="spinner" style={{
                width: '40px',
                height: '40px',
                border: '4px solid #374151',
                borderTop: '4px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Loading video...
            </div>
          ) : videoData?.error || playbackError ? (
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
              <p style={{ margin: 0, textAlign: 'center', fontSize: '0.875rem', maxWidth: '400px' }}>
                {playbackError || videoData.error}
              </p>
              {playbackError && (
                <button
                  onClick={handleRetry}
                  style={{
                    padding: '0.5rem 1.5rem',
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                >
                  Retry ({retryCount + 1})
                </button>
              )}
            </div>
          ) : videoData?.type === 'youtube' || videoData?.type === 'vimeo' ? (
            <iframe
              key={`iframe-${retryCount}`}
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
              onLoad={() => setLoading(false)}
              onError={handleIframeError}
            />
          ) : videoData?.type === 'direct' ? (
            <video
              key={`video-${retryCount}`}
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
              onLoadedData={() => setLoading(false)}
              onError={handleVideoError}
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

export default React.memo(VideoPlayerModal);
