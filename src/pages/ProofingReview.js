// src/pages/ProofingReview.js
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Check, X, ChevronLeft, ChevronRight, Lock, Calendar, AlertCircle } from "lucide-react";
import { getGalleryById, getProofsByGalleryId, updateProofStatus, logActivity, verifyPassword } from "../services/proofingService";
import ProofReviewModal from "../components/proofing/ProofReviewModal";
import PasswordPrompt from "../components/proofing/PasswordPrompt";
import "./ProofingReview.css";

const ProofingReview = () => {
  const { id } = useParams();
  const [gallery, setGallery] = useState(null);
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [selectedProofIndex, setSelectedProofIndex] = useState(null);
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [showEmailPrompt, setShowEmailPrompt] = useState(true);

  // Load gallery and proofs
  useEffect(() => {
    const loadGallery = async () => {
      try {
        setLoading(true);
        const galleryData = await getGalleryById(id);
        
        if (!galleryData) {
          setError("Gallery not found");
          setLoading(false);
          return;
        }

        setGallery(galleryData);
        
        // Check if password is required
        if (galleryData.password && !passwordVerified) {
          setPasswordRequired(true);
          setLoading(false);
          return;
        }

        // Load proofs
        const proofsData = await getProofsByGalleryId(id);
        setProofs(proofsData);
        
        setLoading(false);
      } catch (err) {
        console.error("Error loading gallery:", err);
        setError("Failed to load gallery");
        setLoading(false);
      }
    };

    if (passwordVerified || !passwordRequired) {
      loadGallery();
    }
  }, [id, passwordVerified, passwordRequired]);

  // Handle password verification
  const handlePasswordSubmit = async (password) => {
    try {
      const isValid = await verifyPassword(password, gallery.password);
      if (isValid) {
        setPasswordVerified(true);
        setPasswordRequired(false);
      }
      return isValid;
    } catch (err) {
      console.error("Error verifying password:", err);
      return false;
    }
  };

  // Handle proof approval
  const handleApprove = async (proofId, index) => {
    try {
      await updateProofStatus(gallery.id, proofId, 'approved', null, reviewerEmail);
      
      // Update local state
      const updatedProofs = [...proofs];
      updatedProofs[index] = { ...updatedProofs[index], status: 'approved', denialNotes: null };
      setProofs(updatedProofs);
      
      // Log activity
      await logActivity(gallery.id, 'approved', proofId, reviewerEmail);
      
      // Move to next image if in modal view
      if (selectedProofIndex !== null && selectedProofIndex < proofs.length - 1) {
        setSelectedProofIndex(selectedProofIndex + 1);
      }
    } catch (err) {
      console.error("Error approving proof:", err);
      alert("Failed to approve image. Please try again.");
    }
  };

  // Handle proof denial
  const handleDeny = async (proofId, index, notes) => {
    if (!notes || notes.trim() === '') {
      alert("Please provide notes explaining why this image was denied.");
      return;
    }

    try {
      await updateProofStatus(gallery.id, proofId, 'denied', notes, reviewerEmail);
      
      // Update local state
      const updatedProofs = [...proofs];
      updatedProofs[index] = { ...updatedProofs[index], status: 'denied', denialNotes: notes };
      setProofs(updatedProofs);
      
      // Log activity
      await logActivity(gallery.id, 'denied', proofId, reviewerEmail);
      
      // Move to next image if in modal view
      if (selectedProofIndex !== null && selectedProofIndex < proofs.length - 1) {
        setSelectedProofIndex(selectedProofIndex + 1);
      }
    } catch (err) {
      console.error("Error denying proof:", err);
      alert("Failed to deny image. Please try again.");
    }
  };

  // Calculate progress
  const getProgress = () => {
    if (proofs.length === 0) return { approved: 0, denied: 0, pending: 0, percentage: 0 };
    
    const approved = proofs.filter(p => p.status === 'approved').length;
    const denied = proofs.filter(p => p.status === 'denied').length;
    const pending = proofs.filter(p => p.status === 'pending').length;
    const percentage = Math.round(((approved + denied) / proofs.length) * 100);
    
    return { approved, denied, pending, percentage };
  };

  // Handle email submission
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (reviewerEmail.trim()) {
      setShowEmailPrompt(false);
      // Log initial view with email
      if (gallery) {
        try {
          await logActivity(gallery.id, 'viewed', null, reviewerEmail);
        } catch (err) {
          console.error("Error logging activity:", err);
        }
      }
    }
  };

  // Format deadline
  const formatDeadline = (deadline) => {
    if (!deadline) return null;
    
    let date;
    try {
      date = deadline.toDate ? deadline.toDate() : new Date(deadline);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid deadline date:', deadline);
        return null;
      }
    } catch (error) {
      console.error('Error parsing deadline date:', error);
      return null;
    }
    
    const now = new Date();
    const daysUntil = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    
    return {
      formatted: date.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      }),
      daysUntil,
      isOverdue: daysUntil < 0
    };
  };

  if (loading) {
    return (
      <div className="proofing-review-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading gallery...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="proofing-review-page">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (passwordRequired && !passwordVerified) {
    return (
      <div className="proofing-review-page">
        <PasswordPrompt
          onSubmit={handlePasswordSubmit}
          galleryName={gallery?.name}
        />
      </div>
    );
  }

  const progress = getProgress();
  const deadline = gallery?.deadline ? formatDeadline(gallery.deadline) : null;

  return (
    <div className="proofing-review-page">
      {showEmailPrompt && (
        <div className="email-prompt-overlay">
          <div className="email-prompt-modal">
            <h3>Welcome to {gallery?.name}</h3>
            <p>Please enter your email to begin reviewing</p>
            <form onSubmit={handleEmailSubmit}>
              <input
                type="email"
                placeholder="your.email@school.edu"
                value={reviewerEmail}
                onChange={(e) => setReviewerEmail(e.target.value)}
                required
                autoFocus
              />
              <button type="submit" className="btn-primary">
                Continue
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="review-header">
        <div className="header-content">
          <h1>{gallery?.name}</h1>
          <p className="school-name">{gallery?.schoolName}</p>
          {deadline && (
            <div className={`deadline-info ${deadline.isOverdue ? 'overdue' : ''}`}>
              <Calendar size={16} />
              <span>
                Due: {deadline.formatted}
                {deadline.isOverdue ? ' (Overdue)' : ` (${deadline.daysUntil} days left)`}
              </span>
            </div>
          )}
        </div>
        
        <div className="proof-progress-section">
          <div className="proof-progress-stats">
            <span className="stat approved">
              <Check size={16} />
              {progress.approved} Approved
            </span>
            <span className="stat denied">
              <X size={16} />
              {progress.denied} Denied
            </span>
            <span className="stat pending">
              <AlertCircle size={16} />
              {progress.pending} Pending
            </span>
          </div>
          <div className="proof-progress-bar">
            <div 
              className="proof-progress-fill"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <span className="proof-progress-percentage">{progress.percentage}% Complete</span>
        </div>
      </div>

      <div className="proofs-grid">
        {proofs.map((proof, index) => (
          <div 
            key={proof.id}
            className={`proof-item ${proof.status}`}
            onClick={() => setSelectedProofIndex(index)}
          >
            <div className="proof-image-container">
              <img 
                src={proof.thumbnailUrl || proof.imageUrl} 
                alt={proof.filename}
                loading="lazy"
              />
              {proof.status === 'approved' && (
                <div className="status-overlay approved">
                  <Check size={24} />
                </div>
              )}
              {proof.status === 'denied' && (
                <div className="status-overlay denied">
                  <X size={24} />
                </div>
              )}
            </div>
            <div className="proof-info">
              <p className="filename">{proof.filename}</p>
              {proof.status === 'pending' && (
                <div className="quick-actions">
                  <button
                    className="btn-approve"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(proof.id, index);
                    }}
                  >
                    <Check size={16} />
                  </button>
                  <button
                    className="btn-deny"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProofIndex(index);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {proof.status === 'denied' && proof.denialNotes && (
                <p className="denial-notes">{proof.denialNotes}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedProofIndex !== null && (
        <ProofReviewModal
          proof={proofs[selectedProofIndex]}
          proofIndex={selectedProofIndex}
          totalProofs={proofs.length}
          onClose={() => setSelectedProofIndex(null)}
          onApprove={() => handleApprove(proofs[selectedProofIndex].id, selectedProofIndex)}
          onDeny={(notes) => handleDeny(proofs[selectedProofIndex].id, selectedProofIndex, notes)}
          onNavigate={(direction) => {
            if (direction === 'prev' && selectedProofIndex > 0) {
              setSelectedProofIndex(selectedProofIndex - 1);
            } else if (direction === 'next' && selectedProofIndex < proofs.length - 1) {
              setSelectedProofIndex(selectedProofIndex + 1);
            }
          }}
        />
      )}

      {progress.pending === 0 && proofs.length > 0 && (
        <div className="completion-message">
          <div className="completion-content">
            {progress.denied === 0 ? (
              <>
                <CheckCircle size={48} className="success-icon" />
                <h2>All Images Approved!</h2>
                <p>Thank you for reviewing this gallery. All images have been approved.</p>
              </>
            ) : (
              <>
                <AlertCircle size={48} className="warning-icon" />
                <h2>Review Complete</h2>
                <p>
                  {progress.approved} images approved, {progress.denied} images need revisions.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProofingReview;