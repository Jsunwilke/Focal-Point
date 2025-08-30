// src/components/proofing/VersionHistoryModal.js
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Clock, User, FileText, Download, AlertCircle, CheckCircle } from "lucide-react";
import { getProofRevisions } from "../../services/proofingService";
import { useToast } from "../../contexts/ToastContext";
import "./VersionHistoryModal.css";

const VersionHistoryModal = ({ isOpen, onClose, proof }) => {
  const { showToast } = useToast();
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersion, setCompareVersion] = useState(null);

  useEffect(() => {
    if (isOpen && proof?.id) {
      loadRevisions();
    }
  }, [isOpen, proof?.id]);

  const loadRevisions = async () => {
    try {
      setLoading(true);
      const history = await getProofRevisions(proof.id);
      
      // With the new system, we should have complete history
      // But for backward compatibility, add current if missing
      if (history.length === 0 || !history.some(r => r.isCurrent)) {
        // This handles old galleries without v1 revisions
        const currentRevision = {
          id: 'current',
          proofId: proof.id,
          galleryId: proof.galleryId,
          newImageUrl: proof.imageUrl,
          originalImageUrl: proof.imageUrl,
          versionNumber: proof.currentVersion || 1,
          isLatest: true,
          isCurrent: true,
          replacedAt: proof.updatedAt,
          replacedBy: proof.reviewedBy || 'System',
          studioNotes: 'Current version'
        };
        
        // For backward compatibility, reconstruct v1 if missing
        if (history.length > 0 && history[history.length - 1].versionNumber > 1) {
          const oldestRevision = history[history.length - 1];
          const v1Revision = {
            id: 'v1-reconstructed',
            proofId: proof.id,
            galleryId: proof.galleryId,
            newImageUrl: oldestRevision.originalImageUrl,
            originalImageUrl: oldestRevision.originalImageUrl,
            versionNumber: 1,
            isLatest: false,
            isCurrent: false,
            replacedAt: proof.createdAt,
            replacedBy: 'System',
            studioNotes: 'Initial upload (reconstructed)'
          };
          setRevisions([currentRevision, ...history, v1Revision]);
        } else {
          setRevisions([currentRevision, ...history]);
        }
      } else {
        // New galleries will have complete history
        setRevisions(history);
      }
    } catch (error) {
      console.error("Error loading version history:", error);
      showToast("Failed to load version history", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const downloadVersion = (url, filename, version) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_v${version}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleVersionClick = (revision) => {
    if (compareMode) {
      if (compareVersion?.id === revision.id) {
        setCompareVersion(null);
      } else {
        setCompareVersion(revision);
      }
    } else {
      setSelectedVersion(revision);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10002,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="version-history-modal">
        <div className="modal-header">
          <h2>Version History - {proof?.filename}</h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading version history...</p>
            </div>
          ) : (
            <div className="content-wrapper">
              {/* Timeline View */}
              <div className="timeline-section">
                <div className="timeline-header">
                  <h3>All Versions ({revisions.length})</h3>
                  {revisions.length > 1 && (
                    <button
                      className={`compare-toggle ${compareMode ? 'active' : ''}`}
                      onClick={() => {
                        setCompareMode(!compareMode);
                        setCompareVersion(null);
                      }}
                    >
                      Compare Versions
                    </button>
                  )}
                </div>
                
                <div className="timeline">
                  {revisions.map((revision, index) => (
                    <div
                      key={revision.id}
                      className={`timeline-item ${selectedVersion?.id === revision.id ? 'selected' : ''} 
                                 ${compareVersion?.id === revision.id ? 'comparing' : ''}
                                 ${revision.isCurrent ? 'current' : ''}`}
                      onClick={() => handleVersionClick(revision)}
                    >
                      <div className="version-marker">
                        <span className="version-number">v{revision.versionNumber}</span>
                        {revision.isCurrent && <span className="current-badge">Current</span>}
                      </div>
                      
                      <div className="version-content">
                        <div className="version-header">
                          <div className="version-info">
                            <p className="version-date">
                              <Clock size={14} />
                              {formatDate(revision.replacedAt)}
                            </p>
                            <p className="version-user">
                              <User size={14} />
                              {revision.replacedBy}
                            </p>
                          </div>
                          
                          <button
                            className="download-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadVersion(revision.newImageUrl || revision.originalImageUrl, 
                                            proof.filename, 
                                            revision.versionNumber);
                            }}
                            title="Download this version"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                        
                        {revision.denialNotes && (
                          <div className="version-notes denial">
                            <AlertCircle size={14} />
                            <span>Denial Notes: {revision.denialNotes}</span>
                          </div>
                        )}
                        
                        {revision.studioNotes && (
                          <div className="version-notes studio">
                            <FileText size={14} />
                            <span>Studio Notes: {revision.studioNotes}</span>
                          </div>
                        )}
                        
                        <img 
                          src={revision.newImageUrl || revision.originalImageUrl} 
                          alt={`Version ${revision.versionNumber}`}
                          className="version-thumbnail"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Section */}
              <div className="preview-section">
                {compareMode && compareVersion ? (
                  <div className="compare-view">
                    <div className="compare-image">
                      <h4>Version {selectedVersion?.versionNumber || proof.currentVersion}</h4>
                      <img 
                        src={selectedVersion?.newImageUrl || selectedVersion?.originalImageUrl || proof.imageUrl} 
                        alt={`Version ${selectedVersion?.versionNumber || proof.currentVersion}`} 
                      />
                    </div>
                    <div className="compare-divider" />
                    <div className="compare-image">
                      <h4>Version {compareVersion.versionNumber}</h4>
                      <img 
                        src={compareVersion.newImageUrl || compareVersion.originalImageUrl} 
                        alt={`Version ${compareVersion.versionNumber}`} 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="single-preview">
                    <h3>
                      {selectedVersion 
                        ? `Version ${selectedVersion.versionNumber}`
                        : `Current Version (v${proof.currentVersion || 1})`
                      }
                    </h3>
                    <img 
                      src={selectedVersion?.newImageUrl || selectedVersion?.originalImageUrl || proof.imageUrl} 
                      alt={selectedVersion ? `Version ${selectedVersion.versionNumber}` : 'Current version'} 
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default VersionHistoryModal;