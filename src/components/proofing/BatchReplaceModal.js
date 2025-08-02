// src/components/proofing/BatchReplaceModal.js
import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Upload, AlertCircle, Check, FileText, Image as ImageIcon, Zap, Loader } from "lucide-react";
import { batchReplaceProofImages } from "../../services/proofingService";
import { useToast } from "../../contexts/ToastContext";
import { compressImages } from "../../utils/imageCompression";
import { generateThumbnail, cleanupThumbnails } from "../../utils/thumbnailGenerator";
import "./BatchReplaceModal.css";

const BatchReplaceModal = ({ isOpen, onClose, gallery, deniedImages, onSuccess, userEmail }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const objectUrlsRef = useRef(new Map()); // Track object URLs for cleanup
  
  const [replacements, setReplacements] = useState({});
  const [studioNotes, setStudioNotes] = useState({});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [skipCompression, setSkipCompression] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(null);
  const [thumbnailProgress, setThumbnailProgress] = useState({});
  const thumbnailQueue = useRef(new Set());

  // Cleanup object URLs when modal closes
  useEffect(() => {
    return () => {
      // Revoke all object URLs on unmount
      objectUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      objectUrlsRef.current.clear();
      
      // Clear any pending thumbnail operations
      thumbnailQueue.current.clear();
    };
  }, []);

  // Also cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Clear replacements and revoke URLs when modal closes
      objectUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      objectUrlsRef.current.clear();
      setReplacements({});
      setStudioNotes({});
      setProgress(null);
      setCompressionProgress(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle file selection for a specific proof
  const handleFileSelect = async (proofId, file) => {
    if (file) {
      // Revoke previous URL if exists
      const oldUrl = objectUrlsRef.current.get(proofId);
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }
      
      // Stage 1: Immediate placeholder with file info
      setReplacements(prev => ({
        ...prev,
        [proofId]: {
          file,
          preview: null, // No preview yet
          filename: file.name,
          size: (file.size / 1024 / 1024).toFixed(1) + 'MB',
          loading: true
        }
      }));
      
      // Mark as processing
      thumbnailQueue.current.add(proofId);
      setThumbnailProgress(prev => ({
        ...prev,
        [proofId]: { status: 'processing' }
      }));
      
      // Stage 2: Generate thumbnail in background (non-blocking)
      try {
        const thumbnail = await generateThumbnail(file, { maxSize: 300 });
        objectUrlsRef.current.set(proofId, thumbnail);
        
        setReplacements(prev => ({
          ...prev,
          [proofId]: {
            ...prev[proofId],
            preview: thumbnail,
            loading: false
          }
        }));
        
        setThumbnailProgress(prev => ({
          ...prev,
          [proofId]: { status: 'complete' }
        }));
      } catch (error) {
        console.error('Thumbnail generation failed:', error);
        // Still allow upload even if thumbnail fails
        setReplacements(prev => ({
          ...prev,
          [proofId]: {
            ...prev[proofId],
            loading: false,
            error: true
          }
        }));
        
        setThumbnailProgress(prev => ({
          ...prev,
          [proofId]: { status: 'error' }
        }));
      } finally {
        thumbnailQueue.current.delete(proofId);
      }
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
  const handleBatchFileSelect = async (files) => {
    const fileMap = {};
    
    // Create a map of filenames to files
    Array.from(files).forEach(file => {
      const baseName = file.name.toLowerCase();
      fileMap[baseName] = file;
    });

    // Try to match files to denied images
    const matchedFiles = [];
    
    deniedImages.forEach(proof => {
      const proofBaseName = proof.filename.toLowerCase();
      
      // Try exact match first
      if (fileMap[proofBaseName]) {
        matchedFiles.push({ proofId: proof.id, file: fileMap[proofBaseName] });
      }
    });
    
    // Process all matched files
    for (const { proofId, file } of matchedFiles) {
      await handleFileSelect(proofId, file);
      // Small delay to keep UI responsive
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    if (matchedFiles.length > 0) {
      showToast(`Matched ${matchedFiles.length} file(s) to denied images`, "success");
    } else {
      showToast("No files matched denied image names", "info");
    }
  };

  // Remove a replacement
  const removeReplacement = (proofId) => {
    // Revoke object URL
    const url = objectUrlsRef.current.get(proofId);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(proofId);
    }
    
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
      let filesToUpload = replacementList;
      
      // Compress images if not skipped
      if (!skipCompression) {
        setCompressionProgress({ stage: 'preparing', percentage: 0, total: replacementList.length });
        
        const files = replacementList.map(r => r.newFile);
        const compressedFiles = await compressImages(files, {
          maxWidth: 3000,
          maxHeight: 3000,
          quality: 0.92,
          concurrency: 3,
          onOverallProgress: (progress) => {
            setCompressionProgress({
              ...progress,
              stage: 'compressing',
              currentFile: Math.min(progress.completed + 1, progress.total)
            });
          }
        });
        
        // Update replacement list with compressed files
        filesToUpload = replacementList.map((item, index) => ({
          ...item,
          newFile: compressedFiles[index]
        }));
        
        // Calculate compression savings
        const originalSize = files.reduce((sum, file) => sum + file.size, 0);
        const compressedSize = compressedFiles.reduce((sum, file) => sum + file.size, 0);
        const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
        
        if (savings > 0) {
          console.log(`Compression saved ${savings}% (${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(compressedSize / 1024 / 1024).toFixed(1)}MB)`);
        }
      }
      
      // Reset compression progress and start upload
      setCompressionProgress(null);
      
      await batchReplaceProofImages(
        gallery.id,
        filesToUpload,
        userEmail,
        (progressData) => setProgress(progressData)
      );
      
      showToast(`Successfully replaced ${filesToUpload.length} image(s)`, "success");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error replacing images:", error);
      showToast("Failed to replace images. Please try again.", "error");
    } finally {
      setUploading(false);
      setProgress(null);
      setCompressionProgress(null);
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
          <label className="compression-toggle">
            <input
              type="checkbox"
              checked={!skipCompression}
              onChange={(e) => setSkipCompression(!e.target.checked)}
              disabled={uploading}
            />
            <Zap size={16} />
            <span>Compress images for faster upload</span>
            <small>(Recommended for large files)</small>
          </label>
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
                      {replacements[proof.id].loading ? (
                        <div className="thumbnail-loading">
                          <div className="thumbnail-placeholder">
                            <Loader size={32} className="loading-spinner" />
                          </div>
                          <div className="file-info">
                            <p className="filename">{replacements[proof.id].filename}</p>
                            <p className="filesize">{replacements[proof.id].size}</p>
                          </div>
                        </div>
                      ) : replacements[proof.id].error ? (
                        <div className="thumbnail-error">
                          <div className="thumbnail-placeholder error">
                            <ImageIcon size={48} className="placeholder-icon" />
                          </div>
                          <div className="file-info">
                            <p className="filename">{replacements[proof.id].filename}</p>
                            <p className="filesize">{replacements[proof.id].size}</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <img src={replacements[proof.id].preview} alt="Replacement" />
                          <p className="filename">{replacements[proof.id].filename}</p>
                        </>
                      )}
                      <button
                        className="remove-btn"
                        onClick={() => removeReplacement(proof.id)}
                        disabled={uploading}
                      >
                        <X size={16} />
                      </button>
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

        {compressionProgress && (
          <div className="compression-progress">
            <div className="progress-header">
              <ImageIcon size={16} />
              <span>
                {compressionProgress.stage === 'preparing' 
                  ? 'Preparing images...' 
                  : `Compressing image ${compressionProgress.currentFile || 1} of ${compressionProgress.total}...`
                }
              </span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill compression" 
                style={{ width: `${compressionProgress.percentage}%` }}
              />
            </div>
            <p className="progress-detail">
              {compressionProgress.percentage.toFixed(0)}% complete
            </p>
          </div>
        )}

        {progress && (
          <div className="upload-progress">
            <div className="progress-header">
              <Upload size={16} />
              <span>
                {progress.status === 'uploading' 
                  ? `Uploading version ${progress.completed + 1} of ${progress.total}...`
                  : 'Processing...'
                }
              </span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill upload" 
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <p className="progress-detail">
              {progress.completed} of {progress.total} completed
            </p>
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