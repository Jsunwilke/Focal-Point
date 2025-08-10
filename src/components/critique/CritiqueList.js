// src/components/critique/CritiqueList.js
import React, { useState } from 'react';
import { MessageSquare, Calendar, User, Eye } from 'lucide-react';
import CritiqueReviewModal from './CritiqueReviewModal';
import './CritiqueList.css';

const CritiqueList = ({ critiques, viewMode, canProvideFeedback }) => {
  const [selectedCritique, setSelectedCritique] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const handleViewCritique = (critique) => {
    setSelectedCritique(critique);
    setShowReviewModal(true);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : date.toDate?.() || new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const CritiqueCard = ({ critique }) => (
    <div className="critique-card" onClick={() => handleViewCritique(critique)}>
      <div className="critique-card__image-container">
        <img 
          src={critique.thumbnailUrl || critique.imageUrl} 
          alt="Training example"
          className="critique-card__image"
        />
        <div className="critique-card__overlay">
          <button className="critique-card__view-btn">
            <Eye size={20} />
            <span>View Details</span>
          </button>
        </div>
        {critique.exampleType === 'example' ? (
          <span className="critique-card__badge critique-card__badge--good">
            Good Example
          </span>
        ) : (
          <span className="critique-card__badge critique-card__badge--improvement">
            Needs Improvement
          </span>
        )}
        {critique.imageCount > 1 && (
          <span className="critique-card__badge critique-card__badge--count">
            {critique.imageCount} photos
          </span>
        )}
      </div>
      
      <div className="critique-card__content">
        <div className="critique-card__meta">
          <div className="critique-card__meta-item">
            <User size={14} />
            <span>{critique.submitterName || 'Manager'}</span>
          </div>
          <div className="critique-card__meta-item">
            <Calendar size={14} />
            <span>{formatDate(critique.createdAt)}</span>
          </div>
        </div>
        
        {critique.managerNotes && (
          <p className="critique-card__description">
            {critique.managerNotes.length > 100 
              ? critique.managerNotes.substring(0, 100) + '...'
              : critique.managerNotes}
          </p>
        )}
      </div>
    </div>
  );

  const CritiqueListItem = ({ critique }) => (
    <div className="critique-list-item" onClick={() => handleViewCritique(critique)}>
      <img 
        src={critique.thumbnailUrl || critique.imageUrl} 
        alt="Training example"
        className="critique-list-item__image"
      />
      
      <div className="critique-list-item__content">
        <div className="critique-list-item__header">
          <h3 className="critique-list-item__title">
            {critique.exampleType === 'example' ? '✓ Good Example' : '⚠ Needs Improvement'}
          </h3>
          {critique.status === 'pending' && (
            <span className="critique-list-item__badge critique-list-item__badge--pending">
              Pending
            </span>
          )}
        </div>
        
        <div className="critique-list-item__meta">
          <span>By {critique.submitterName || 'Unknown'}</span>
          <span>•</span>
          <span>{formatDate(critique.createdAt)}</span>
        </div>
        
        {critique.description && (
          <p className="critique-list-item__description">
            {critique.description}
          </p>
        )}
      </div>
      
      <div className="critique-list-item__stats">
        <div className="critique-list-item__stat">
          <StarRating 
            rating={critique.averageRating || 0} 
            readonly 
            size="small" 
          />
          {critique.averageRating > 0 && (
            <span>{critique.averageRating.toFixed(1)}</span>
          )}
        </div>
        <div className="critique-list-item__stat">
          <MessageSquare size={16} />
          <span>{critique.feedbackCount || 0} reviews</span>
        </div>
      </div>
      
      <button className="critique-list-item__action">
        <Eye size={20} />
      </button>
    </div>
  );

  return (
    <>
      <div className={`critique-list critique-list--${viewMode}`}>
        {viewMode === 'grid' ? (
          <div className="critique-grid">
            {critiques.map(critique => (
              <CritiqueCard key={critique.id} critique={critique} />
            ))}
          </div>
        ) : (
          <div className="critique-list-view">
            {critiques.map(critique => (
              <CritiqueListItem key={critique.id} critique={critique} />
            ))}
          </div>
        )}
      </div>
      
      {showReviewModal && selectedCritique && (
        <CritiqueReviewModal
          isOpen={showReviewModal}
          critique={selectedCritique}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedCritique(null);
          }}
          canProvideFeedback={canProvideFeedback}
        />
      )}
    </>
  );
};

export default CritiqueList;