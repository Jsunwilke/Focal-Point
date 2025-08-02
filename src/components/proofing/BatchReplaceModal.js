// src/components/proofing/BatchReplaceModal.js
import React, { useState, useRef } from "react";
import ReactDOM from "react-dom";
import { X, Upload, AlertCircle, Check, FileText } from "lucide-react";
import { batchReplaceProofImages } from "../../services/proofingService";
import { useToast } from "../../contexts/ToastContext";
import "./BatchReplaceModal.css";

const BatchReplaceModal = ({ isOpen, onClose, gallery, deniedImages, onSuccess, userEmail }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  
  const [replacements, setReplacements] = useState({});
  const [studioNotes, setStudioNotes] = useState({});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);

  if (!isOpen) return null;

  // Handle file selection for a specific proof
  const handleFileSelect = (proofId, file) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setReplacements({
          ...replacements,
          [proofId]: {
            file,
            preview: e.target.result,
            filename: file.name
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle drag and drop
  const handleDrop = (e, proofId) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(proofId, file);
    }
  };

  // Handle batch file selection (match by filename)
  const handleBatchFileSelect = (files) => {
    const fileMap = {};
    
    // Create a map of filenames to files
    Array.from(files).forEach(file => {
      const baseName = file.name.toLowerCase();
      fileMap[baseName] = file;
    });

    // Try to match files to denied images
    const newReplacements = { ...replacements };
    
    deniedImages.forEach(proof => {
      const proofBaseName = proof.filename.toLowerCase();
      
      // Try exact match first
      if (fileMap[proofBaseName]) {
        const file = fileMap[proofBaseName];
        const reader = new FileReader();
        reader.onload = (e) => {
          newReplacements[proof.id] = {
            file,
            preview: e.target.result,
            filename: file.name
          };
          setReplacements({ ...newReplacements });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // Remove a replacement
  const removeReplacement = (proofId) => {
    const newReplacements = { ...replacements };
    delete newReplacements[proofId];
    setReplacements(newReplacements);
  };

  // Handle studio notes change
  const handleNotesChange = (proofId, notes) => {
    setStudioNotes({
      ...studioNotes,
      [proofId]: notes
    });
  };

  // Submit replacements
  const handleSubmit = async () => {
    const replacementList = Object.entries(replacements).map(([proofId, replacement]) => {
      const oldProof = deniedImages.find(p => p.id === proofId);
      return {
        proofId,
        oldProof,
        newFile: replacement.file,
        studioNotes: studioNotes[proofId] || ""
      };
    });

    if (replacementList.length === 0) {
      showToast("Please select at least one image to replace", "error");
      return;
    }

    setUploading(true);
    
    try {
      await batchReplaceProofImages(
        gallery.id,
        replacementList,
        userEmail,
        (progressData) => setProgress(progressData)
      );
      
      showToast(`Successfully replaced ${replacementList.length} image(s)`, "success");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error replacing images:", error);
      showToast("Failed to replace images. Please try again.", "error");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

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
        zIndex: 10003,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) {
          onClose();
        }
      }}
    >
      <div className="batch-replace-modal">
        <div className="modal-header">
          <h2>Upload New Versions</h2>
          <button
            className="close-button"
            onClick={onClose}
            disabled={uploading}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="batch-upload-controls">
          <button
            className="btn btn-batch-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={16} />
            Upload Multiple Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleBatchFileSelect(e.target.files)}
          />
          <p className="help-text">
            Upload new versions of denied images. Previous versions are preserved for reference.
          </p>
        </div>

        <div className="modal-body">
          <div className="replacements-list">
            {deniedImages.map(proof => (
              <div key={proof.id} className="replacement-item">
                <div className="original-image">
                  <img src={proof.thumbnailUrl || proof.imageUrl} alt={proof.filename} />
                  <div className="image-info">
                    <p className="filename">
                      {proof.filename}
                      {proof.currentVersion > 1 && (
                        <span className="version-badge">v{proof.currentVersion}</span>
                      )}
                    </p>
                    <div className="denial-notes">
                      <AlertCircle size={14} />
                      {proof.denialNotes}
                    </div>
                  </div>
                </div>

                <div className="arrow">→</div>

                <div className="replacement-section">
                  {replacements[proof.id] ? (
                    <div className="replacement-preview">
                      <img src={replacements[proof.id].preview} alt="Replacement" />
                      <button
                        className="remove-btn"
                        onClick={() => removeReplacement(proof.id)}
                        disabled={uploading}
                      >
                        <X size={16} />
                      </button>
                      <p className="filename">{replacements[proof.id].filename}</p>
                    </div>
                  ) : (
                    <div
                      className="upload-zone"
                      onDrop={(e) => handleDrop(e, proof.id)}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        id={`file-${proof.id}`}
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileSelect(proof.id, e.target.files[0])}
                      />
                      <label htmlFor={`file-${proof.id}`}>
                        <Upload size={24} />
                        <span>Drop file or click to upload</span>
                      </label>
                    </div>
                  )}
                  
                  <div className="studio-notes">
                    <label>
                      <FileText size={14} />
                      Studio Notes (optional)
                    </label>
                    <textarea
                      placeholder="What changes were made?"
                      value={studioNotes[proof.id] || ""}
                      onChange={(e) => handleNotesChange(proof.id, e.target.value)}
                      disabled={uploading}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {progress && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <p>Uploading new versions... {progress.completed} of {progress.total}</p>
          </div>
        )}

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={uploading || Object.keys(replacements).length === 0}
          >
            {uploading ? 'Uploading...' : `Upload ${Object.keys(replacements).length} New Version(s)`}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default BatchReplaceModal;