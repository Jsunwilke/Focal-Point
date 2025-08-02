// src/components/proofing/GalleryDetailsModal.js
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Copy, ExternalLink, Trash2, Clock, Eye, Check, AlertCircle } from "lucide-react";
import { getProofsByGalleryId, subscribeToProofs, getGalleryActivity, deleteGallery, batchReplaceProofImages } from "../../services/proofingService";
import { proofingCacheService } from "../../services/proofingCacheService";
import { readCounter } from "../../services/readCounter";
import { useToast } from "../../contexts/ToastContext";
import ConfirmationModal from "../shared/ConfirmationModal";
import ProofReviewModal from "./ProofReviewModal";
import BatchReplaceModal from "./BatchReplaceModal";
import "./GalleryDetailsModal.css";

const GalleryDetailsModal = ({ isOpen, onClose, gallery, organization, userEmail }) => {
  const { showToast } = useToast();
  const [proofs, setProofs] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("images");
  const [selectedProof, setSelectedProof] = useState(null);
  const [selectedProofIndex, setSelectedProofIndex] = useState(0);
  const [showReplaceModal, setShowReplaceModal] = useState(false);

  // Load proofs and activity with real-time updates
  useEffect(() => {
    if (!isOpen || !gallery) return;

    let unsubscribe;

    const loadData = async () => {
      try {
        setLoading(true);

        // Try cache first for initial load
        const cachedProofs = proofingCacheService.getCachedProofs(gallery.id);
        if (cachedProofs) {
          setProofs(cachedProofs);
          readCounter.recordCacheHit('proofs', 'GalleryDetailsModal', cachedProofs.length);
          setLoading(false);
        } else {
          readCounter.recordCacheMiss('proofs', 'GalleryDetailsModal');
        }

        // Subscribe to real-time updates
        unsubscribe = subscribeToProofs(
          gallery.id,
          (updatedProofs) => {
            setProofs(updatedProofs);
            proofingCacheService.setCachedProofs(gallery.id, updatedProofs);
            setLoading(false);
          },
          (error) => {
            console.error("Error loading proofs:", error);
            showToast("Failed to load proofs", "error");
            setLoading(false);
          }
        );

        // Load activity
        const activityData = await getGalleryActivity(gallery.id);
        setActivity(activityData);
      } catch (error) {
        console.error("Error loading gallery details:", error);
        showToast("Failed to load gallery details", "error");
        setLoading(false);
      }
    };

    loadData();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isOpen, gallery, showToast]);

  // Copy gallery link
  const copyLink = () => {
    const link = `${window.location.origin}/proof/${gallery.id}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast("Link copied to clipboard!", "success");
    }).catch(() => {
      showToast("Failed to copy link", "error");
    });
  };

  // Open gallery in new tab
  const openInNewTab = () => {
    window.open(`/proof/${gallery.id}`, '_blank');
  };

  // Handle delete gallery
  const handleDelete = async () => {
    try {
      await deleteGallery(gallery.id);
      showToast("Gallery deleted successfully", "success");
      onClose();
    } catch (error) {
      console.error("Error deleting gallery:", error);
      showToast("Failed to delete gallery", "error");
    }
    setShowDeleteConfirm(false);
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'denied': return '#dc3545';
      case 'pending': return '#6c757d';
      default: return '#6c757d';
    }
  };

  // Get activity icon
  const getActivityIcon = (action) => {
    switch (action) {
      case 'viewed': return Eye;
      case 'approved': return Check;
      case 'denied': return X;
      default: return Clock;
    }
  };

  if (!isOpen || !gallery) return null;

  const galleryLink = `${window.location.origin}/proof/${gallery.id}`;
  const deniedImages = proofs.filter(proof => proof.status === 'denied');
  const hasDeniedImages = deniedImages.length > 0;

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="gallery-details-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>{gallery.name}</h2>
            <p className="subtitle">{gallery.schoolName}</p>
          </div>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="gallery-link-section">
          <label>Gallery Link</label>
          <div className="link-container">
            <input 
              type="text" 
              value={galleryLink} 
              readOnly 
              onClick={(e) => e.target.select()}
            />
            <div className="link-actions">
              <button
                className="btn-icon"
                onClick={copyLink}
                title="Copy link"
              >
                <Copy size={16} />
              </button>
              <button
                className="btn-icon"
                onClick={openInNewTab}
                title="Open in new tab"
              >
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
          {gallery.password && (
            <p className="password-note">
              <AlertCircle size={14} />
              This gallery is password protected
            </p>
          )}
        </div>

        <div className="tabs-container">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'images' ? 'active' : ''}`}
              onClick={() => setActiveTab('images')}
            >
              Images ({proofs.length})
            </button>
            <button
              className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              Activity ({activity.length})
            </button>
          </div>
          {hasDeniedImages && activeTab === 'images' && (
            <button
              className="btn btn-replace"
              onClick={() => setShowReplaceModal(true)}
            >
              Upload New Versions ({deniedImages.length})
            </button>
          )}
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : activeTab === 'images' ? (
            <div className="images-grid">
              {proofs.map((proof, index) => (
                <div 
                  key={proof.id} 
                  className="proof-thumbnail"
                  onClick={() => {
                    setSelectedProof(proof);
                    setSelectedProofIndex(index);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="image-wrapper">
                    <img 
                      src={proof.thumbnailUrl || proof.imageUrl} 
                      alt={proof.filename}
                    />
                    <span 
                      className="status-indicator"
                      style={{ backgroundColor: getStatusColor(proof.status) }}
                    >
                      {proof.status}
                    </span>
                    {proof.denialNotes && (
                      <div className="denial-notes-indicator" title={proof.denialNotes}>
                        <AlertCircle size={16} />
                      </div>
                    )}
                    {proof.currentVersion > 1 && (
                      <div className="version-indicator" title={`Version ${proof.currentVersion}`}>
                        v{proof.currentVersion}
                      </div>
                    )}
                  </div>
                  <div className="proof-info">
                    <p className="filename">{proof.filename}</p>
                    {proof.denialNotes && (
                      <p className="denial-notes-text">{proof.denialNotes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="activity-list">
              {activity.length === 0 ? (
                <p className="empty-state">No activity yet</p>
              ) : (
                activity.map((item, index) => {
                  const Icon = getActivityIcon(item.action);
                  return (
                    <div key={index} className="activity-item">
                      <div className="activity-icon">
                        <Icon size={16} />
                      </div>
                      <div className="activity-content">
                        <p>
                          <strong>{item.userEmail}</strong> {item.action} 
                          {item.proofId && ' an image'}
                        </p>
                        <span className="timestamp">
                          {formatTimestamp(item.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 size={16} />
            Delete Gallery
          </button>
          <button
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="Delete Gallery"
          message={`Are you sure you want to delete "${gallery.name}"? This will permanently delete all images and cannot be undone.`}
          confirmText="Delete"
          confirmVariant="danger"
        />
      )}

      {selectedProof && (
        <ProofReviewModal
          proof={selectedProof}
          proofIndex={selectedProofIndex}
          totalProofs={proofs.length}
          onClose={() => setSelectedProof(null)}
          onApprove={() => {
            // Just close for now - approval/denial should be done in the public review page
            setSelectedProof(null);
          }}
          onDeny={() => {
            // Just close for now - approval/denial should be done in the public review page
            setSelectedProof(null);
          }}
          onNavigate={(direction) => {
            const newIndex = direction === 'next' ? selectedProofIndex + 1 : selectedProofIndex - 1;
            if (newIndex >= 0 && newIndex < proofs.length) {
              setSelectedProofIndex(newIndex);
              setSelectedProof(proofs[newIndex]);
            }
          }}
        />
      )}

      {showReplaceModal && (
        <BatchReplaceModal
          isOpen={showReplaceModal}
          onClose={() => setShowReplaceModal(false)}
          gallery={gallery}
          deniedImages={deniedImages}
          userEmail={userEmail}
          onSuccess={() => {
            setShowReplaceModal(false);
            // The real-time listener will automatically update the proofs
          }}
        />
      )}
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default GalleryDetailsModal;