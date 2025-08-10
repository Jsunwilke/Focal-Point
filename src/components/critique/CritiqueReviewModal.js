// src/components/critique/CritiqueReviewModal.js
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, User, Calendar, CheckCircle, AlertCircle, Trash2, Maximize2, Download, ZoomIn } from 'lucide-react';
import { usePhotoCritique } from '../../contexts/PhotoCritiqueContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../shared/Button';
import './CritiqueReviewModal.css';

const CritiqueReviewModal = ({ isOpen, critique, onClose }) => {
  const { user, userProfile } = useAuth();
  const { removeCritique } = usePhotoCritique();
  
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);

  const handleDelete = async () => {
    if (!critique?.id) return;
    
    setDeleting(true);
    
    try {
      // Pass all image URLs for deletion
      const imageUrls = critique.imageUrls || [critique.imageUrl];
      const thumbnailUrls = critique.thumbnailUrls || [critique.thumbnailUrl];
      
      await removeCritique(critique.id, imageUrls, thumbnailUrls);
      onClose();
    } catch (error) {
      console.error('Error deleting critique:', error);
      alert('Failed to delete critique');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleKeyDown = (e) => {
    if (!fullscreenImage) {
      const images = critique.imageUrls || [critique.imageUrl];
      if (e.key === 'ArrowLeft' && selectedImageIndex > 0) {
        setSelectedImageIndex(selectedImageIndex - 1);
      } else if (e.key === 'ArrowRight' && selectedImageIndex < images.length - 1) {
        setSelectedImageIndex(selectedImageIndex + 1);
      }
    }
    if (e.key === 'Escape') {
      if (fullscreenImage) {
        setFullscreenImage(null);
      } else {
        onClose();
      }
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, selectedImageIndex, fullscreenImage]);

  const openFullscreen = (imageUrl) => {
    setFullscreenImage(imageUrl);
  };

  if (!isOpen || !critique) return null;

  const images = critique.imageUrls || [critique.imageUrl];
  const hasMultipleImages = images.length > 1;
  const isOwner = critique?.submitterId === user?.uid;
  const isManager = userProfile?.role === 'manager' || userProfile?.role === 'admin';
  const canDelete = isOwner || isManager;

  const modalContent = (
    <>
      {/* Main Modal */}
      <div 
        className="critique-modal-overlay"
        onClick={onClose}
      >
        <div 
          className="critique-modal-container"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="critique-modal-header">
            <div className="critique-modal-header-left">
              <h2 className="critique-modal-title">
                {critique.targetPhotographerName 
                  ? `Training Photo for ${critique.targetPhotographerName}`
                  : 'Training Photo Review'}
              </h2>
              <div className={`critique-badge critique-badge--${critique.exampleType === 'example' ? 'success' : 'warning'}`}>
                {critique.exampleType === 'example' ? (
                  <>
                    <CheckCircle size={16} />
                    <span>Good Example</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} />
                    <span>Needs Improvement</span>
                  </>
                )}
              </div>
            </div>
            <button className="critique-modal-close" onClick={onClose} aria-label="Close">
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="critique-modal-body">
            {/* Gallery Section */}
            <div className="critique-gallery-section">
              {/* Main Image Display */}
              <div className="critique-main-image-container">
                <img 
                  src={images[selectedImageIndex]} 
                  alt={`Training photo ${selectedImageIndex + 1}`}
                  className="critique-main-image"
                />
                
                {/* Image Actions Overlay */}
                <div className="critique-image-actions">
                  <button 
                    className="critique-action-btn"
                    onClick={() => openFullscreen(images[selectedImageIndex])}
                    title="View fullscreen"
                  >
                    <Maximize2 size={20} />
                  </button>
                  <a 
                    href={images[selectedImageIndex]} 
                    download 
                    className="critique-action-btn"
                    title="Download image"
                  >
                    <Download size={20} />
                  </a>
                </div>

                {/* Image Counter */}
                {hasMultipleImages && (
                  <div className="critique-image-counter">
                    {selectedImageIndex + 1} / {images.length}
                  </div>
                )}
              </div>

              {/* Thumbnail Grid */}
              {hasMultipleImages && (
                <div className="critique-thumbnail-grid">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      className={`critique-thumbnail ${index === selectedImageIndex ? 'active' : ''}`}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img src={image} alt={`Thumbnail ${index + 1}`} />
                      <div className="critique-thumbnail-number">{index + 1}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details Section */}
            <div className="critique-details-section">
              {/* Metadata */}
              <div className="critique-metadata">
                <div className="critique-metadata-item">
                  <User size={16} />
                  <div className="critique-metadata-content">
                    <span className="critique-metadata-label">Submitted by</span>
                    <span className="critique-metadata-value">{critique.submitterName}</span>
                  </div>
                </div>
                
                <div className="critique-metadata-item">
                  <Calendar size={16} />
                  <div className="critique-metadata-content">
                    <span className="critique-metadata-label">Date</span>
                    <span className="critique-metadata-value">{formatDate(critique.createdAt)}</span>
                  </div>
                </div>

                {critique.targetPhotographerName && (
                  <div className="critique-metadata-item">
                    <User size={16} />
                    <div className="critique-metadata-content">
                      <span className="critique-metadata-label">Photographer</span>
                      <span className="critique-metadata-value">{critique.targetPhotographerName}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Training Notes */}
              <div className="critique-notes-section">
                <h3 className="critique-section-title">Training Notes</h3>
                <div className="critique-notes-content">
                  {critique.managerNotes || critique.description || 'No training notes provided for this example.'}
                </div>
              </div>

              {/* Actions */}
              {canDelete && (
                <div className="critique-actions-section">
                  {!showDeleteConfirm ? (
                    <Button
                      variant="danger"
                      size="medium"
                      onClick={() => setShowDeleteConfirm(true)}
                      icon={<Trash2 size={18} />}
                      fullWidth
                    >
                      Delete Training Example
                    </Button>
                  ) : (
                    <div className="critique-delete-confirm">
                      <p className="critique-delete-message">
                        Are you sure you want to delete this training example?
                      </p>
                      <div className="critique-delete-buttons">
                        <Button
                          variant="secondary"
                          size="medium"
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={deleting}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          size="medium"
                          onClick={handleDelete}
                          loading={deleting}
                        >
                          Confirm Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div 
          className="critique-fullscreen-overlay"
          onClick={() => setFullscreenImage(null)}
        >
          <button 
            className="critique-fullscreen-close"
            onClick={() => setFullscreenImage(null)}
          >
            <X size={32} />
          </button>
          <img 
            src={fullscreenImage} 
            alt="Fullscreen view"
            className="critique-fullscreen-image"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default CritiqueReviewModal;