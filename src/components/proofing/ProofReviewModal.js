// src/components/proofing/ProofReviewModal.js
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, ChevronLeft, ChevronRight, Check, AlertCircle, History } from "lucide-react";
import VersionHistoryModal from "./VersionHistoryModal";
import "./ProofReviewModal.css";

const ProofReviewModal = ({ 
  proof, 
  proofIndex, 
  totalProofs, 
  onClose, 
  onApprove, 
  onDeny, 
  onNavigate 
}) => {
  const [denialNotes, setDenialNotes] = useState("");
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Reset state when proof changes
  useEffect(() => {
    if (proof?.status === 'denied' && proof.denialNotes) {
      setDenialNotes(proof.denialNotes);
      setShowDenyForm(true);
      setIsEditingNotes(false);
    } else {
      setDenialNotes("");
      setShowDenyForm(false);
      setIsEditingNotes(false);
    }
  }, [proof]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && proofIndex > 0) {
        onNavigate("prev");
      } else if (e.key === "ArrowRight" && proofIndex < totalProofs - 1) {
        onNavigate("next");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [proofIndex, totalProofs, onClose, onNavigate]);

  const handleApprove = () => {
    onApprove();
    setDenialNotes("");
    setShowDenyForm(false);
  };

  const handleDenyClick = () => {
    if (proof.status === 'denied' && proof.denialNotes) {
      setDenialNotes(proof.denialNotes);
    }
    setShowDenyForm(true);
  };

  const handleDenySubmit = () => {
    if (denialNotes.trim()) {
      onDeny(denialNotes);
      setDenialNotes("");
      setShowDenyForm(false);
    }
  };

  const handleCancelDeny = () => {
    if (proof.status === 'denied' && proof.denialNotes) {
      // If editing existing notes, revert to original and switch to view mode
      setDenialNotes(proof.denialNotes);
      setIsEditingNotes(false);
    } else {
      // If new denial, close the form
      setDenialNotes("");
      setShowDenyForm(false);
    }
  };

  if (!proof) return null;

  const modalContent = (
    <div className="proof-review-modal-overlay">
      {/* Top bar */}
      <div className="top-bar">
        <div className="image-counter">
          {proofIndex + 1} of {totalProofs}
        </div>
        <div className="top-bar-actions">
          {proof.currentVersion > 1 && (
            <button
              className="version-history-btn"
              onClick={() => setShowVersionHistory(true)}
              title="View version history"
            >
              <History size={20} />
            </button>
          )}
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main viewing area */}
      <div className={`viewing-area ${showDenyForm ? 'denial-active' : ''}`}>
        {/* Left arrow */}
        <button
          className="nav-arrow prev"
          onClick={() => onNavigate("prev")}
          disabled={proofIndex === 0}
          aria-label="Previous image"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Image container */}
        <div className="image-container">
          <img 
            src={proof.imageUrl} 
            alt={proof.filename}
            className="proof-image"
          />
        </div>

        {/* Right arrow */}
        <button
          className="nav-arrow next"
          onClick={() => onNavigate("next")}
          disabled={proofIndex === totalProofs - 1}
          aria-label="Next image"
        >
          <ChevronRight size={24} />
        </button>

        {/* Denial panel - positioned beside image */}
        {showDenyForm && (
          <div className="denial-panel">
            {proof.status === 'denied' && !isEditingNotes ? (
              // View mode for existing denial notes
              <>
                <h3>Revision Notes</h3>
                <div className="denial-notes-view">
                  {denialNotes}
                </div>
                <div className="action-buttons">
                  <button
                    className="btn btn-edit"
                    onClick={() => setIsEditingNotes(true)}
                  >
                    Edit Notes
                  </button>
                </div>
              </>
            ) : (
              // Edit mode for new or editing denial notes
              <>
                <label>Please explain what needs to be revised:</label>
                <textarea
                  value={denialNotes}
                  onChange={(e) => setDenialNotes(e.target.value)}
                  placeholder="Enter your revision notes here..."
                  autoFocus={isEditingNotes || proof.status !== 'denied'}
                />
                <div className="action-buttons">
                  <button
                    className="btn btn-cancel"
                    onClick={handleCancelDeny}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-deny"
                    onClick={handleDenySubmit}
                    disabled={!denialNotes.trim()}
                  >
                    {isEditingNotes ? 'Save Changes' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="bottom-bar">
        <div className="status-info">
          {proof.status === 'pending' && (
            <span>Review this image</span>
          )}
          {proof.status === 'approved' && (
            <span className="status-text approved">
              <Check size={16} /> Approved
            </span>
          )}
          {proof.status === 'denied' && (
            <span className="status-text denied">
              <X size={16} /> Needs Revision
            </span>
          )}
        </div>

        {!showDenyForm && (
          <div className="action-buttons">
            {proof.status === 'pending' && (
              <>
                <button
                  className="btn btn-approve"
                  onClick={handleApprove}
                >
                  <Check size={16} /> Approve
                </button>
                <button
                  className="btn btn-deny"
                  onClick={handleDenyClick}
                >
                  <X size={16} /> Needs Revision
                </button>
              </>
            )}
            
            {proof.status === 'approved' && (
              <button
                className="btn btn-deny"
                onClick={handleDenyClick}
              >
                Change to Needs Revision
              </button>
            )}
            
            {proof.status === 'denied' && (
              <button
                className="btn btn-approve"
                onClick={handleApprove}
              >
                Change to Approved
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(modalContent, document.body)}
      {showVersionHistory && (
        <VersionHistoryModal
          isOpen={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          proof={proof}
        />
      )}
    </>
  );
};

export default ProofReviewModal;