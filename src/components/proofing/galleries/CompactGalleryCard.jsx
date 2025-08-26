// src/components/proofing/galleries/CompactGalleryCard.jsx
import React from "react";
import { Image, CheckCircle, XCircle, AlertCircle, Clock, Calendar, Archive, ArchiveRestore, Copy, ExternalLink } from "lucide-react";
import { toggleGalleryArchiveStatus } from "../../../services/proofingService";

const CompactGalleryCard = ({ gallery, onView, isArchived }) => {
  // Format date - handles Firestore timestamps, cached timestamps, and regular dates
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      // Handle Firestore Timestamp
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
      }
      
      // Handle millisecond timestamp (number)
      if (typeof timestamp === 'number') {
        return new Date(timestamp).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
      }
      
      // Handle object with seconds/nanoseconds (serialized Firestore timestamp)
      if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
        return new Date(timestamp.seconds * 1000).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
      }
      
      // Handle JavaScript Date objects and date strings
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
      }
      
      return '';
    } catch (error) {
      console.error('Error formatting date:', error, timestamp);
      return '';
    }
  };

  // Get status info
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { color: '#6c757d', label: 'Pending', icon: Clock };
      case 'partial':
        return { color: '#ffc107', label: 'In Progress', icon: AlertCircle };
      case 'approved':
        return { color: '#28a745', label: 'Approved', icon: CheckCircle };
      case 'has_denials':
        return { color: '#dc3545', label: 'Has Denials', icon: XCircle };
      default:
        return { color: '#6c757d', label: 'Unknown', icon: Clock };
    }
  };

  const statusInfo = getStatusInfo(gallery.status);
  const StatusIcon = statusInfo.icon;

  // Copy gallery link
  const copyGalleryLink = (e) => {
    e.stopPropagation();
    const link = `${window.location.origin}/proof/${gallery.id}`;
    navigator.clipboard.writeText(link);
  };

  // Handle archive toggle
  const handleArchiveToggle = async (e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to ${isArchived ? 'unarchive' : 'archive'} this gallery?`)) {
      try {
        await toggleGalleryArchiveStatus(gallery.id, !isArchived);
      } catch (error) {
        console.error('Error toggling archive status:', error);
      }
    }
  };

  // Calculate progress percentage (based on approved images only)
  const totalImages = gallery.totalImages || 0;
  const approvedImages = gallery.approvedCount || 0;
  const progressPercentage = totalImages > 0 ? Math.round((approvedImages / totalImages) * 100) : 0;

  return (
    <div className={`compact-job-card ${isArchived ? 'archived-job' : ''}`}>
      <div className="compact-header">
        <div className="school-info">
          <h5 className="school-name">{gallery.name}</h5>
          <div className="date-text">
            <Calendar size={12} />
            {formatDate(gallery.createdAt)}
          </div>
        </div>
        <div 
          className="season-tag" 
          style={{ background: statusInfo.color }}
        >
          {statusInfo.label}
        </div>
      </div>

      <div className="job-meta">
        <div className="meta-item">
          <i className="bi bi-building"></i>
          {gallery.schoolName}
        </div>
        {gallery.deadline && (
          <div className="meta-item">
            <i className="bi bi-calendar-check"></i>
            Due {formatDate(gallery.deadline)}
          </div>
        )}
        {gallery.password && (
          <div className="meta-item">
            <i className="bi bi-lock"></i>
            Protected
          </div>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-num">{totalImages}</span>
          <span className="stat-lbl">Images</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">{gallery.approvedCount || 0}</span>
          <span className="stat-lbl">Approved</span>
          {totalImages > 0 && (
            <span className="stat-pct">
              {Math.round(((gallery.approvedCount || 0) / totalImages) * 100)}%
            </span>
          )}
        </div>
        <div className="stat-item">
          <span className="stat-num">{gallery.deniedCount || 0}</span>
          <span className="stat-lbl">Denied</span>
          {gallery.deniedCount > 0 && (
            <span className="stat-warn">Needs Review</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalImages > 0 && (
        <div className="extra-stats">
          <div className="progress-stat">
            <span>Review Progress</span>
            <span className="progress-value">{progressPercentage}%</span>
          </div>
          <div className="progress" style={{ height: '8px' }}>
            <div 
              className="progress-bar" 
              role="progressbar" 
              style={{ 
                width: `${progressPercentage}%`,
                backgroundColor: progressPercentage === 100 ? '#28a745' : '#3a6ea5'
              }}
              aria-valuenow={progressPercentage}
              aria-valuemin="0" 
              aria-valuemax="100"
            />
          </div>
        </div>
      )}

      <div className="compact-actions">
        <button 
          className="action-btn-sm view" 
          onClick={() => onView()}
        >
          <i className="bi bi-eye"></i> View Gallery
        </button>
        <button 
          className="action-btn-sm secondary" 
          onClick={copyGalleryLink}
        >
          <i className="bi bi-link-45deg"></i> Copy Link
        </button>
        <button 
          className={`action-btn-sm ${isArchived ? 'activate' : 'complete'}`}
          onClick={handleArchiveToggle}
        >
          {isArchived ? (
            <><i className="bi bi-arrow-counterclockwise"></i> Restore</>
          ) : (
            <><i className="bi bi-archive"></i> Archive</>
          )}
        </button>
      </div>
    </div>
  );
};

export default CompactGalleryCard;