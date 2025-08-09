// src/components/proofing/galleries/ModernGalleryCard.jsx
import React, { useState } from "react";
import { 
  Eye, 
  ExternalLink, 
  Copy, 
  Archive, 
  ArchiveRestore, 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Image,
  Pencil
} from "lucide-react";
import { toggleGalleryArchiveStatus } from "../../../services/proofingService";
import { useToast } from "../../../contexts/ToastContext";

const ModernGalleryCard = ({ gallery, onView, onEdit, isArchived }) => {
  const { showToast } = useToast();
  const [isHovered, setIsHovered] = useState(false);

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    return formatDate(timestamp);
  };

  // Get status info
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { 
          color: 'status-pending', 
          label: 'Pending Review', 
          icon: Clock,
          bgColor: '#f3f4f6',
          textColor: '#6b7280'
        };
      case 'partial':
        return { 
          color: 'status-progress', 
          label: 'In Progress', 
          icon: AlertTriangle,
          bgColor: '#fef3c7',
          textColor: '#92400e'
        };
      case 'approved':
        return { 
          color: 'status-approved', 
          label: 'Approved', 
          icon: CheckCircle,
          bgColor: '#d1fae5',
          textColor: '#065f46'
        };
      case 'has_denials':
        return { 
          color: 'status-denied', 
          label: 'Has Denials', 
          icon: XCircle,
          bgColor: '#fee2e2',
          textColor: '#991b1b'
        };
      default:
        return { 
          color: 'status-pending', 
          label: 'Unknown', 
          icon: Clock,
          bgColor: '#f3f4f6',
          textColor: '#6b7280'
        };
    }
  };

  const statusInfo = getStatusInfo(gallery.status);
  const StatusIcon = statusInfo.icon;

  // Calculate progress
  const totalImages = gallery.totalImages || 0;
  const reviewedImages = (gallery.approvedCount || 0) + (gallery.deniedCount || 0);
  const progressPercentage = totalImages > 0 ? Math.round((reviewedImages / totalImages) * 100) : 0;

  // Handle actions
  const handleOpenGallery = (e) => {
    e.stopPropagation();
    const link = `${window.location.origin}/proof/${gallery.id}`;
    window.open(link, '_blank');
  };

  const handleCopyLink = (e) => {
    e.stopPropagation();
    const link = `${window.location.origin}/proof/${gallery.id}`;
    navigator.clipboard.writeText(link);
    showToast("Gallery link copied to clipboard", "success");
  };

  const handleArchiveToggle = async (e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to ${isArchived ? 'restore' : 'archive'} this gallery?`)) {
      try {
        await toggleGalleryArchiveStatus(gallery.id, !isArchived);
        showToast(`Gallery ${isArchived ? 'restored' : 'archived'} successfully`, "success");
      } catch (error) {
        console.error('Error toggling archive status:', error);
        showToast("Failed to update gallery status", "error");
      }
    }
  };

  const handleViewDetails = (e) => {
    e.stopPropagation();
    onView();
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit();
    }
  };

  return (
    <div 
      className={`modern-gallery-card ${isArchived ? 'archived' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Edit Button */}
      <button 
        className="card-edit-btn"
        onClick={handleEdit}
        title="Edit Gallery"
      >
        <Pencil size={14} />
      </button>

      {/* Card Header */}
      <div className="card-header">
        <div className="header-content">
          <h3 className="gallery-title">{gallery.name}</h3>
          <div className="gallery-meta">
            {gallery.password && (
              <span className="meta-item">
                <Lock size={14} />
                Protected
              </span>
            )}
          </div>
        </div>
        <div className="status-section">
          <div 
            className={`status-badge ${statusInfo.color}`}
            style={{ 
              backgroundColor: statusInfo.bgColor,
              color: statusInfo.textColor
            }}
          >
            <StatusIcon size={14} />
            <span>{statusInfo.label}</span>
          </div>
          <div className="status-time">
            <Calendar size={12} />
            {formatRelativeTime(gallery.createdAt)}
          </div>
        </div>
      </div>

      {/* School Info */}
      <div className="school-section">
        <div className="school-name">{gallery.schoolName}</div>
        {gallery.deadline && (
          <div className="deadline">
            <Clock size={14} />
            Due {formatDate(gallery.deadline)}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Image size={16} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{totalImages}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon approved">
            <CheckCircle size={16} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{gallery.approvedCount || 0}</div>
            <div className="stat-label">Approved</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon denied">
            <XCircle size={16} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{gallery.deniedCount || 0}</div>
            <div className="stat-label">Denied</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {totalImages > 0 && (
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-label">Review Progress</span>
            <span className="progress-value">{progressPercentage}%</span>
          </div>
          <div className="progress-track">
            <div 
              className="progress-fill"
              style={{ 
                width: `${progressPercentage}%`,
                backgroundColor: progressPercentage === 100 ? '#10b981' : '#3b82f6'
              }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-bar">
        <button 
          className="action-btn primary"
          onClick={handleViewDetails}
          title="View Gallery Details"
        >
          <Eye size={16} />
          <span>View</span>
        </button>
        
        <button 
          className="action-btn"
          onClick={handleOpenGallery}
          title="Open Gallery in New Tab"
        >
          <ExternalLink size={16} />
          <span>Open</span>
        </button>
        
        <button 
          className="action-btn"
          onClick={handleCopyLink}
          title="Copy Gallery Link"
        >
          <Copy size={16} />
          <span>Copy</span>
        </button>
        
        <button 
          className={`action-btn ${isArchived ? 'restore' : 'archive'}`}
          onClick={handleArchiveToggle}
          title={isArchived ? "Restore Gallery" : "Archive Gallery"}
        >
          {isArchived ? (
            <>
              <ArchiveRestore size={16} />
              <span>Restore</span>
            </>
          ) : (
            <>
              <Archive size={16} />
              <span>Archive</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ModernGalleryCard;