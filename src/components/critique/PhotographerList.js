// src/components/critique/PhotographerList.js
import React from 'react';
import { User, Camera, Star, AlertCircle, Calendar, ChevronRight } from 'lucide-react';
import './PhotographerList.css';

const PhotographerList = ({ photographers, critiques, onSelectPhotographer, viewMode = 'grid' }) => {
  // Group critiques by photographer and calculate stats
  const getPhotographerStats = (photographerId) => {
    const photographerCritiques = critiques.filter(c => 
      c.targetPhotographerId === photographerId || c.photographerId === photographerId
    );
    
    const goodExamples = photographerCritiques.filter(c => c.exampleType === 'example').length;
    const improvements = photographerCritiques.filter(c => c.exampleType === 'improvement').length;
    
    // Get most recent critique date
    const lastCritique = photographerCritiques.sort((a, b) => {
      const dateA = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime() || 0;
      const dateB = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime() || 0;
      return dateB - dateA;
    })[0];
    
    return {
      total: photographerCritiques.length,
      goodExamples,
      improvements,
      lastCritiqueDate: lastCritique?.createdAt,
      critiques: photographerCritiques
    };
  };
  
  const formatDate = (date) => {
    if (!date) return 'No critiques yet';
    const d = date instanceof Date ? date : date.toDate?.() || new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };
  
  const PhotographerCard = ({ photographer }) => {
    const stats = getPhotographerStats(photographer.id);
    const displayName = photographer.displayName || 
                        `${photographer.firstName} ${photographer.lastName}`.trim() || 
                        photographer.email || 
                        'Unknown Photographer';
    
    return (
      <div 
        className="photographer-card" 
        onClick={() => onSelectPhotographer(photographer)}
      >
        <div className="photographer-card__header">
          <div className="photographer-card__avatar">
            {photographer.photoURL ? (
              <img src={photographer.photoURL} alt={displayName} />
            ) : (
              <User size={32} />
            )}
          </div>
          <div className="photographer-card__info">
            <h3 className="photographer-card__name">{displayName}</h3>
            <div className="photographer-card__last-activity">
              <Calendar size={14} />
              <span>{formatDate(stats.lastCritiqueDate)}</span>
            </div>
          </div>
          <ChevronRight className="photographer-card__arrow" size={20} />
        </div>
        
        <div className="photographer-card__stats">
          <div className="photographer-card__stat">
            <Camera size={16} />
            <span className="photographer-card__stat-value">{stats.total}</span>
            <span className="photographer-card__stat-label">Total</span>
          </div>
          
          <div className="photographer-card__stat photographer-card__stat--good">
            <Star size={16} />
            <span className="photographer-card__stat-value">{stats.goodExamples}</span>
            <span className="photographer-card__stat-label">Good</span>
          </div>
          
          <div className="photographer-card__stat photographer-card__stat--improvement">
            <AlertCircle size={16} />
            <span className="photographer-card__stat-value">{stats.improvements}</span>
            <span className="photographer-card__stat-label">Improve</span>
          </div>
        </div>
        
        {stats.total === 0 && (
          <div className="photographer-card__empty">
            No training examples yet
          </div>
        )}
      </div>
    );
  };
  
  const PhotographerRow = ({ photographer }) => {
    const stats = getPhotographerStats(photographer.id);
    const displayName = photographer.displayName || 
                        `${photographer.firstName} ${photographer.lastName}`.trim() || 
                        photographer.email || 
                        'Unknown Photographer';
    
    return (
      <div 
        className="photographer-row" 
        onClick={() => onSelectPhotographer(photographer)}
      >
        <div className="photographer-row__main">
          <div className="photographer-row__avatar">
            {photographer.photoURL ? (
              <img src={photographer.photoURL} alt={displayName} />
            ) : (
              <User size={24} />
            )}
          </div>
          <div className="photographer-row__info">
            <h3 className="photographer-row__name">{displayName}</h3>
            <div className="photographer-row__meta">
              <span>{photographer.email}</span>
            </div>
          </div>
        </div>
        
        <div className="photographer-row__stats">
          <div className="photographer-row__stat">
            <Camera size={16} />
            <span>{stats.total}</span>
          </div>
          <div className="photographer-row__stat photographer-row__stat--good">
            <Star size={16} />
            <span>{stats.goodExamples}</span>
          </div>
          <div className="photographer-row__stat photographer-row__stat--improvement">
            <AlertCircle size={16} />
            <span>{stats.improvements}</span>
          </div>
        </div>
        
        <div className="photographer-row__last-activity">
          <Calendar size={14} />
          <span>{formatDate(stats.lastCritiqueDate)}</span>
        </div>
        
        <ChevronRight className="photographer-row__arrow" size={20} />
      </div>
    );
  };
  
  // Sort photographers by those with critiques first, then alphabetically
  const sortedPhotographers = [...photographers].sort((a, b) => {
    const aStats = getPhotographerStats(a.id);
    const bStats = getPhotographerStats(b.id);
    
    // First sort by whether they have critiques
    if (aStats.total > 0 && bStats.total === 0) return -1;
    if (aStats.total === 0 && bStats.total > 0) return 1;
    
    // Then sort by name
    const aName = a.displayName || `${a.firstName} ${a.lastName}`.trim() || a.email || '';
    const bName = b.displayName || `${b.firstName} ${b.lastName}`.trim() || b.email || '';
    return aName.localeCompare(bName);
  });
  
  if (photographers.length === 0) {
    return (
      <div className="photographer-list__empty">
        <User size={48} />
        <h3>No photographers found</h3>
        <p>Photographers will appear here once they are added to your organization.</p>
      </div>
    );
  }
  
  return (
    <div className={`photographer-list photographer-list--${viewMode}`}>
      {viewMode === 'grid' ? (
        <div className="photographer-grid">
          {sortedPhotographers.map(photographer => (
            <PhotographerCard key={photographer.id} photographer={photographer} />
          ))}
        </div>
      ) : (
        <div className="photographer-list-view">
          {sortedPhotographers.map(photographer => (
            <PhotographerRow key={photographer.id} photographer={photographer} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotographerList;