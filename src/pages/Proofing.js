// src/pages/Proofing.js
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Plus, Copy, ExternalLink, Image as ImageIcon, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import CreateGalleryModal from "../components/proofing/CreateGalleryModal";
import GalleryDetailsModal from "../components/proofing/GalleryDetailsModal";
import { subscribeToGalleries } from "../services/proofingService";
import { proofingCacheService } from "../services/proofingCacheService";
import { readCounter } from "../services/readCounter";
import { useToast } from "../contexts/ToastContext";
import "./Proofing.css";

const Proofing = () => {
  const { userProfile, organization } = useAuth();
  const { showToast } = useToast();
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Load galleries with cache-first approach
  useEffect(() => {
    if (!organization?.id) return;

    // Load from cache first
    const cachedGalleries = proofingCacheService.getCachedGalleries(organization.id);
    if (cachedGalleries && cachedGalleries.length > 0) {
      setGalleries(cachedGalleries);
      setLoading(false);
      readCounter.recordCacheHit('proofGalleries', 'Proofing', cachedGalleries.length);
    } else {
      readCounter.recordCacheMiss('proofGalleries', 'Proofing');
    }

    // Subscribe to real-time updates
    const unsubscribe = subscribeToGalleries(
      organization.id,
      (updatedGalleries) => {
        setGalleries(updatedGalleries);
        proofingCacheService.setCachedGalleries(organization.id, updatedGalleries);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading galleries:", error);
        showToast("Failed to load galleries", "error");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [organization?.id, showToast]);

  // Filter galleries based on search and status
  const filteredGalleries = galleries.filter(gallery => {
    const matchesSearch = gallery.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         gallery.schoolName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || gallery.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Copy gallery link to clipboard
  const copyGalleryLink = (galleryId, e) => {
    e.stopPropagation();
    const link = `${window.location.origin}/proof/${galleryId}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast("Link copied to clipboard!", "success");
    }).catch(() => {
      showToast("Failed to copy link", "error");
    });
  };

  // Get status icon and color
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, color: '#6c757d', label: 'Pending Review' };
      case 'partial':
        return { icon: AlertCircle, color: '#ffc107', label: 'In Progress' };
      case 'approved':
        return { icon: CheckCircle, color: '#28a745', label: 'All Approved' };
      case 'has_denials':
        return { icon: XCircle, color: '#dc3545', label: 'Has Denials' };
      default:
        return { icon: Clock, color: '#6c757d', label: 'Unknown' };
    }
  };

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

  // Format deadline with urgency
  const formatDeadline = (deadline) => {
    if (!deadline) return null;
    const date = deadline.toDate ? deadline.toDate() : new Date(deadline);
    const now = new Date();
    const daysUntil = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    
    let urgencyClass = '';
    if (daysUntil < 0) urgencyClass = 'deadline-overdue';
    else if (daysUntil <= 3) urgencyClass = 'deadline-urgent';
    else if (daysUntil <= 7) urgencyClass = 'deadline-soon';
    
    return (
      <span className={`deadline ${urgencyClass}`}>
        Due {formatDate(deadline)}
        {daysUntil < 0 && ' (Overdue)'}
      </span>
    );
  };

  return (
    <div className="proofing-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Proofing Galleries</h1>
          <p>Create and manage proof galleries for schools to review and approve</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={20} />
          Create Gallery
        </button>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by gallery or school name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
          />
        </div>
        <div className="status-filters">
          <button
            className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
            onClick={() => setFilterStatus('pending')}
          >
            Pending
          </button>
          <button
            className={`filter-btn ${filterStatus === 'partial' ? 'active' : ''}`}
            onClick={() => setFilterStatus('partial')}
          >
            In Progress
          </button>
          <button
            className={`filter-btn ${filterStatus === 'approved' ? 'active' : ''}`}
            onClick={() => setFilterStatus('approved')}
          >
            Approved
          </button>
          <button
            className={`filter-btn ${filterStatus === 'has_denials' ? 'active' : ''}`}
            onClick={() => setFilterStatus('has_denials')}
          >
            Has Denials
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : filteredGalleries.length === 0 ? (
        <div className="empty-state">
          <ImageIcon size={48} />
          <h3>No galleries found</h3>
          <p>
            {searchTerm || filterStatus !== 'all' 
              ? "Try adjusting your filters"
              : "Create your first proofing gallery to get started"}
          </p>
        </div>
      ) : (
        <div className="galleries-grid">
          {filteredGalleries.map(gallery => {
            const StatusIcon = getStatusInfo(gallery.status).icon;
            const statusInfo = getStatusInfo(gallery.status);
            
            return (
              <div 
                key={gallery.id} 
                className="gallery-card"
                onClick={() => {
                  setSelectedGallery(gallery);
                  setShowDetailsModal(true);
                }}
              >
                <div className="gallery-header">
                  <h3>{gallery.name}</h3>
                  <div className="gallery-actions">
                    <button
                      className="btn-icon"
                      onClick={(e) => copyGalleryLink(gallery.id, e)}
                      title="Copy link"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/proof/${gallery.id}`, '_blank');
                      }}
                      title="Open in new tab"
                    >
                      <ExternalLink size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="gallery-info">
                  <p className="school-name">{gallery.schoolName}</p>
                  <div className="gallery-stats">
                    <span className="stat">
                      <ImageIcon size={14} />
                      {gallery.totalImages || 0} images
                    </span>
                    <span className="stat">
                      {gallery.approvedCount || 0} approved
                    </span>
                    {gallery.deniedCount > 0 && (
                      <span className="stat denied">
                        {gallery.deniedCount} denied
                      </span>
                    )}
                  </div>
                </div>

                <div className="gallery-footer">
                  <div className="status-badge" style={{ color: statusInfo.color }}>
                    <StatusIcon size={16} />
                    {statusInfo.label}
                  </div>
                  {gallery.deadline && formatDeadline(gallery.deadline)}
                </div>

                <div className="gallery-meta">
                  Created {formatDate(gallery.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateGalleryModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          organization={organization}
          userProfile={userProfile}
        />
      )}

      {showDetailsModal && selectedGallery && (
        <GalleryDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedGallery(null);
          }}
          gallery={selectedGallery}
          organization={organization}
          userEmail={userProfile?.email}
        />
      )}
    </div>
  );
};

export default Proofing;