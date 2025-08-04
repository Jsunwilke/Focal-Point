import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import './LocationPhotosModal.css';

const LocationPhotosModal = ({ 
  isOpen, 
  onClose, 
  photos = [], 
  schoolName = '',
  lastUpdated = null 
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  const [imageLoadErrors, setImageLoadErrors] = useState({});
  const [imageLoading, setImageLoading] = useState({});
  
  // Debug logging
  console.log('LocationPhotosModal - photos:', photos);
  console.log('LocationPhotosModal - schoolName:', schoolName);

  if (!isOpen || photos.length === 0) return null;

  const handlePrevious = (e) => {
    e.stopPropagation();
    if (selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1);
    }
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (selectedPhotoIndex < photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1);
    }
  };

  const handleKeyDown = (e) => {
    if (selectedPhotoIndex !== null) {
      if (e.key === 'ArrowLeft') {
        handlePrevious(e);
      } else if (e.key === 'ArrowRight') {
        handleNext(e);
      } else if (e.key === 'Escape') {
        setSelectedPhotoIndex(null);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleImageError = (index, url) => {
    console.error(`Failed to load image ${index}:`, url);
    setImageLoadErrors(prev => ({ ...prev, [index]: true }));
    setImageLoading(prev => ({ ...prev, [index]: false }));
  };

  const handleImageLoad = (index) => {
    setImageLoading(prev => ({ ...prev, [index]: false }));
  };

  const handleImageLoadStart = (index) => {
    setImageLoading(prev => ({ ...prev, [index]: true }));
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const modalContent = (
    <div 
      className="location-photos-overlay" 
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div 
        className="location-photos-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="location-photos-header">
          <div>
            <h2>Location Photos</h2>
            <p className="location-photos-subtitle">
              {schoolName}
              {lastUpdated && (
                <span className="location-photos-date">
                  Last updated: {formatDate(lastUpdated)}
                </span>
              )}
            </p>
          </div>
          <button 
            className="location-photos-close" 
            onClick={onClose}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <div className="location-photos-grid">
          {photos.map((photo, index) => {
            // Handle both string URLs and object format {url, label}
            const photoUrl = typeof photo === 'string' ? photo : photo.url;
            const photoLabel = typeof photo === 'object' ? photo.label : null;
            
            return (
              <div 
                key={index} 
                className={`location-photo-item ${imageLoading[index] ? 'loading' : ''}`}
                onClick={() => !imageLoadErrors[index] && setSelectedPhotoIndex(index)}
              >
                {imageLoadErrors[index] ? (
                  <div className="location-photo-error">
                    <p>Unable to load image</p>
                    {photoLabel && <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>{photoLabel}</p>}
                  </div>
                ) : (
                  <>
                    {imageLoading[index] && (
                      <div className="location-photo-loading">
                        <div className="spinner"></div>
                      </div>
                    )}
                    <img 
                      src={photoUrl} 
                      alt={photoLabel || `Location photo ${index + 1}`}
                      onError={() => handleImageError(index, photoUrl)}
                      onLoad={() => handleImageLoad(index)}
                      onLoadStart={() => handleImageLoadStart(index)}
                      style={{ opacity: imageLoading[index] ? 0 : 1 }}
                    />
                  </>
                )}
                <div className="location-photo-number">
                  {index + 1}
                  {photoLabel && <span className="location-photo-label">{photoLabel}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full screen photo viewer */}
      {selectedPhotoIndex !== null && (
        <div 
          className="location-photo-viewer" 
          onClick={() => setSelectedPhotoIndex(null)}
        >
          <button 
            className="photo-viewer-close"
            onClick={() => setSelectedPhotoIndex(null)}
            aria-label="Close viewer"
          >
            <X size={32} />
          </button>

          {selectedPhotoIndex > 0 && (
            <button 
              className="photo-viewer-nav photo-viewer-prev"
              onClick={handlePrevious}
              aria-label="Previous photo"
            >
              <ChevronLeft size={32} />
            </button>
          )}

          <div className="photo-viewer-content">
            {(() => {
              const photo = photos[selectedPhotoIndex];
              const photoUrl = typeof photo === 'string' ? photo : photo.url;
              const photoLabel = typeof photo === 'object' ? photo.label : null;
              
              return (
                <>
                  <img 
                    src={photoUrl} 
                    alt={photoLabel || `Location photo ${selectedPhotoIndex + 1}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="photo-viewer-info">
                    <span>
                      {selectedPhotoIndex + 1} / {photos.length}
                      {photoLabel && ` - ${photoLabel}`}
                    </span>
                    <a 
                      href={photoUrl} 
                      download={`location-photo-${selectedPhotoIndex + 1}.jpg`}
                      onClick={(e) => e.stopPropagation()}
                      className="photo-viewer-download"
                      title="Download photo"
                    >
                      <Download size={20} />
                    </a>
                  </div>
                </>
              );
            })()}
          </div>

          {selectedPhotoIndex < photos.length - 1 && (
            <button 
              className="photo-viewer-nav photo-viewer-next"
              onClick={handleNext}
              aria-label="Next photo"
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
      )}
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default LocationPhotosModal;