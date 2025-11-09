import React, { useState, useRef } from 'react';
import { Upload, X, File, AlertCircle } from 'lucide-react';
import './FileUploadButton.css';

/**
 * FileUploadButton Component
 * Reusable file upload button with drag-and-drop support
 *
 * @param {Function} onUpload - Callback when file is selected (file, onProgress)
 * @param {boolean} disabled - Whether upload is disabled
 * @param {number} maxFileSize - Max file size in MB (default: 50)
 * @param {string} acceptedTypes - Accepted file types (default: all)
 * @param {boolean} multiple - Allow multiple file selection (default: false)
 * @param {string} buttonText - Custom button text
 * @param {string} buttonVariant - Button style variant (primary, secondary, outline)
 */
const FileUploadButton = ({
  onUpload,
  disabled = false,
  maxFileSize = 50,
  acceptedTypes = '*',
  multiple = false,
  buttonText = 'Upload File',
  buttonVariant = 'outline'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (files) => {
    if (!files || files.length === 0) return;

    const file = files[0]; // For now, handle single file
    setError(null);

    // Validate file size
    const maxSizeBytes = maxFileSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError(`File size exceeds ${maxFileSize}MB limit`);
      return;
    }

    // Start upload
    setIsUploading(true);
    setUploadProgress(0);

    // Call onUpload with file and progress callback
    const handleProgress = (progress) => {
      setUploadProgress(progress);
    };

    // Handle upload
    onUpload(file, handleProgress)
      .then(() => {
        // Upload complete
        setIsUploading(false);
        setUploadProgress(0);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      })
      .catch((error) => {
        console.error('Upload error:', error);
        setError(error.message || 'Failed to upload file');
        setIsUploading(false);
        setUploadProgress(0);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleButtonClick = () => {
    if (fileInputRef.current && !disabled && !isUploading) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    handleFileSelect(files);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <div className="file-upload-button-container">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        multiple={multiple}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={disabled || isUploading}
      />

      <button
        className={`file-upload-button ${buttonVariant} ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
        onClick={handleButtonClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        disabled={disabled || isUploading}
      >
        {isUploading ? (
          <div className="upload-progress-container">
            <div className="upload-progress-bar">
              <div
                className="upload-progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="upload-progress-text">{Math.round(uploadProgress)}%</span>
          </div>
        ) : (
          <>
            <Upload size={18} />
            <span>{buttonText}</span>
          </>
        )}
      </button>

      {error && (
        <div className="file-upload-error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={clearError} className="error-close-btn">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUploadButton;
