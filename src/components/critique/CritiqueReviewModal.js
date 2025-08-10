// src/components/critique/CritiqueReviewModal.js
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, User, Calendar, CheckCircle, AlertCircle, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePhotoCritique } from '../../contexts/PhotoCritiqueContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../shared/Button';
import './CritiqueReviewModal.css';

const CritiqueReviewModal = ({ isOpen, critique, onClose }) => {
  const { user, userProfile } = useAuth();
  const { removeCritique } = usePhotoCritique();
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const nextImage = () => {
    const images = critique.imageUrls || [critique.imageUrl];
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    const images = critique.imageUrls || [critique.imageUrl];
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (!isOpen || !critique) return null;

  const images = critique.imageUrls || [critique.imageUrl];
  const hasMultipleImages = images.length > 1;
  const isOwner = critique?.submitterId === user?.uid; // Check against auth uid
  const isManager = userProfile?.role === 'manager' || userProfile?.role === 'admin';
  const canDelete = isOwner || isManager;

  const modalContent = (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div 
        className="critique-review-modal" 
        style={{ 
          position: 'relative',
          margin: 0,
          transform: 'none',
          backgroundColor: 'white',
          maxWidth: '900px',
          width: '100%'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-content">
            <h2>Training Photo</h2>
            <div className={`example-type-badge ${critique.exampleType === 'example' ? 'badge--good' : 'badge--improvement'}`}>
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
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="critique-review-content">
          {/* Image Section */}
          <div className="critique-review-image">
            {hasMultipleImages && (
              <button className="image-nav image-nav--prev" onClick={prevImage}>
                <ChevronLeft size={24} />
              </button>
            )}
            
            <img src={images[currentImageIndex]} alt="Training photo" />
            
            {hasMultipleImages && (
              <>
                <button className="image-nav image-nav--next" onClick={nextImage}>
                  <ChevronRight size={24} />
                </button>
                <div className="image-indicators">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      className={`image-indicator ${index === currentImageIndex ? 'active' : ''}`}
                      onClick={() => setCurrentImageIndex(index)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          
          {/* Details Section */}
          <div className="critique-review-details">
            <div className="critique-info">
              <div className="critique-info__meta">
                <div className="critique-info__meta-item">
                  <User size={16} />
                  <span>{critique.submitterName}</span>
                </div>
                <div className="critique-info__meta-item">
                  <Calendar size={16} />
                  <span>{formatDate(critique.createdAt)}</span>
                </div>
              </div>
              
              {critique.targetPhotographerName && (
                <div className="critique-info__target">
                  <span className="label">For:</span>
                  <span className="photographer-name">{critique.targetPhotographerName}</span>
                </div>
              )}
              
              <div className="critique-info__notes">
                <h3>Training Notes</h3>
                <p>{critique.managerNotes || critique.description || 'No notes provided'}</p>
              </div>
              
              {hasMultipleImages && (
                <div className="critique-info__image-count">
                  <span>Image {currentImageIndex + 1} of {images.length}</span>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            {canDelete && (
              <div className="critique-actions">
                {!showDeleteConfirm ? (
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => setShowDeleteConfirm(true)}
                    icon={<Trash2 size={16} />}
                  >
                    Delete
                  </Button>
                ) : (
                  <div className="delete-confirm">
                    <span>Are you sure?</span>
                    <div className="delete-confirm-buttons">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deleting}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        size="small"
                        onClick={handleDelete}
                        loading={deleting}
                      >
                        Delete
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
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default CritiqueReviewModal;