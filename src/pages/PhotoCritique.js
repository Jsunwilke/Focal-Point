// src/pages/PhotoCritique.js
import React, { useState, useEffect } from 'react';
import { Plus, Filter, Grid, List, Star, MessageSquare, Camera, ArrowLeft, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PhotoCritiqueProvider, usePhotoCritique } from '../contexts/PhotoCritiqueContext';
import Button from '../components/shared/Button';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import PhotoCritiqueModal from '../components/critique/PhotoCritiqueModal';
import CritiqueList from '../components/critique/CritiqueList';
import PhotographerList from '../components/critique/PhotographerList';
import { useToast } from '../contexts/ToastContext';
import './PhotoCritique.css';

const PhotoCritiqueContent = () => {
  const { userProfile } = useAuth();
  const {
    critiques,
    photographers,
    loading,
    error,
    filters,
    setFilters,
    canSubmitCritiques,
    canProvideFeedback,
    loadCritiques
  } = usePhotoCritique();
  
  const { showToast } = useToast();
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [activeTab, setActiveTab] = useState('all'); // all, good, improvement
  const [selectedPhotographer, setSelectedPhotographer] = useState(null);

  // Filter critiques based on active tab and selected photographer
  const getFilteredCritiques = () => {
    let filtered = critiques;
    
    // Filter by photographer if one is selected
    if (selectedPhotographer) {
      filtered = filtered.filter(c => 
        c.targetPhotographerId === selectedPhotographer.id || 
        c.photographerId === selectedPhotographer.id
      );
    }
    
    // Filter by tab
    switch (activeTab) {
      case 'good':
        return filtered.filter(c => c.exampleType === 'example');
      case 'improvement':
        return filtered.filter(c => c.exampleType === 'improvement');
      default:
        return filtered;
    }
  };

  const filteredCritiques = getFilteredCritiques();
  
  // Handle photographer selection
  const handleSelectPhotographer = (photographer) => {
    setSelectedPhotographer(photographer);
    setActiveTab('all'); // Reset tab when selecting photographer
  };
  
  // Handle back to photographers
  const handleBackToPhotographers = () => {
    setSelectedPhotographer(null);
  };

  // Handle submission success
  const handleSubmitSuccess = () => {
    setShowSubmitModal(false);
    showToast('Training example submitted successfully!', 'success');
    // Don't reload - let the real-time listener handle updates
  };

  // Stats calculation
  const stats = {
    total: critiques.length,
    goodExamples: critiques.filter(c => c.exampleType === 'example').length,
    improvements: critiques.filter(c => c.exampleType === 'improvement').length
  };

  if (loading && critiques.length === 0) {
    return <LoadingSpinner message="Loading photo critiques..." />;
  }

  return (
    <div className="photo-critique">
      {/* Header */}
      <div className="photo-critique__header">
        <div className="photo-critique__title-section">
          <h1>School Photography Training</h1>
          <p className="photo-critique__subtitle">
            Training examples for school photographers
          </p>
        </div>
        
        {canSubmitCritiques() && (
          <Button
            variant="primary"
            icon={<Plus size={20} />}
            onClick={() => setShowSubmitModal(true)}
          >
            Submit Example
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="photo-critique__stats">
        <div className="stat-card">
          <div className="stat-card__icon">
            <Camera size={20} />
          </div>
          <div className="stat-card__content">
            <div className="stat-card__value">{stats.total}</div>
            <div className="stat-card__label">Total Submissions</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-card__icon">
            <Star size={20} />
          </div>
          <div className="stat-card__content">
            <div className="stat-card__value">{stats.goodExamples}</div>
            <div className="stat-card__label">Good Examples</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-card__icon">
            <MessageSquare size={20} />
          </div>
          <div className="stat-card__content">
            <div className="stat-card__value">{stats.improvements}</div>
            <div className="stat-card__label">Needs Improvement</div>
          </div>
        </div>
        
      </div>

      {/* Tabs and Controls */}
      <div className="photo-critique__controls">
        <div className="photo-critique__tabs">
          <button
            className={`tab ${activeTab === 'all' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Examples ({stats.total})
          </button>
          
          <button
            className={`tab ${activeTab === 'good' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('good')}
          >
            Good Examples ({stats.goodExamples})
          </button>
          
          <button
            className={`tab ${activeTab === 'improvement' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('improvement')}
          >
            Needs Improvement ({stats.improvements})
          </button>
        </div>
        
        <div className="photo-critique__view-controls">
          <button
            className={`view-toggle ${viewMode === 'grid' ? 'view-toggle--active' : ''}`}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            <Grid size={20} />
          </button>
          <button
            className={`view-toggle ${viewMode === 'list' ? 'view-toggle--active' : ''}`}
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            <List size={20} />
          </button>
        </div>
        </div>
      )}

      {/* Main Content */}
      {error && (
        <div className="photo-critique__error">
          {error}
        </div>
      )}
      
      {!selectedPhotographer ? (
        // Show photographer list
        <PhotographerList
          photographers={photographers}
          critiques={critiques}
          onSelectPhotographer={handleSelectPhotographer}
          viewMode={viewMode}
        />
      ) : (
        // Show critiques for selected photographer
        <>
          {filteredCritiques.length === 0 ? (
            <div className="photo-critique__empty">
              <Camera size={48} />
              <h3>No critiques found</h3>
              <p>
                {activeTab === 'good' 
                  ? `No good examples have been submitted for ${selectedPhotographer.firstName || 'this photographer'} yet.`
                  : activeTab === 'improvement'
                  ? `No improvement examples have been submitted for ${selectedPhotographer.firstName || 'this photographer'} yet.`
                  : `No training photos have been submitted for ${selectedPhotographer.firstName || 'this photographer'} yet.`}
              </p>
              {canSubmitCritiques() && (
                <Button
                  variant="primary"
                  icon={<Plus size={20} />}
                  onClick={() => setShowSubmitModal(true)}
                >
                  Submit First Example
                </Button>
              )}
            </div>
          ) : (
            <CritiqueList
              critiques={filteredCritiques}
              viewMode={viewMode}
              canProvideFeedback={canProvideFeedback()}
            />
          )}
        </>
      )}

      {/* Submit Modal */}
      {showSubmitModal && (
        <PhotoCritiqueModal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          onSuccess={handleSubmitSuccess}
          preselectedPhotographer={selectedPhotographer}
        />
      )}
    </div>
  );
};

// Main component with provider
const PhotoCritique = () => {
  return (
    <PhotoCritiqueProvider>
      <PhotoCritiqueContent />
    </PhotoCritiqueProvider>
  );
};

export default PhotoCritique;