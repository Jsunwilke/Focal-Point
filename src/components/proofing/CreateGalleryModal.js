// src/components/proofing/CreateGalleryModal.js
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Upload, Calendar, Lock, Image as ImageIcon } from "lucide-react";
import { createGallery, uploadProofImages } from "../../services/proofingService";
import { getSchools } from "../../firebase/firestore";
import { useToast } from "../../contexts/ToastContext";
import SearchableSelect from "../shared/SearchableSelect";
import { compressImages } from "../../utils/imageCompression";
import "./CreateGalleryModal.css";

const CreateGalleryModal = ({ isOpen, onClose, organization, userProfile }) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    schoolId: "",
    schoolName: "",
    password: "",
    deadline: ""
  });
  const [schools, setSchools] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    percentage: 0,
    completed: 0,
    total: 0,
    status: 'idle'
  });
  const [dragActive, setDragActive] = useState(false);
  const [abortController, setAbortController] = useState(null);

  // Load schools
  useEffect(() => {
    const loadSchools = async () => {
      if (organization?.id) {
        try {
          const schoolsList = await getSchools(organization.id);
          setSchools(schoolsList);
        } catch (error) {
          console.error("Error loading schools:", error);
        }
      }
    };
    loadSchools();
  }, [organization?.id]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle school selection
  const handleSchoolChange = (e) => {
    const selectedId = e.target.value;
    console.log("School selected:", selectedId);
    console.log("Available schools:", schools);
    const selectedSchool = schools.find(s => s.id === selectedId);
    console.log("Found school:", selectedSchool);
    setFormData({
      ...formData,
      schoolId: selectedId,
      schoolName: selectedSchool ? selectedSchool.value : ""
    });
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(file => 
      file.type.startsWith('image/')
    );
    setFiles(selectedFiles);
  };

  // Handle drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    setFiles(droppedFiles);
  };

  // Remove a file
  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.schoolId || files.length === 0) {
      showToast("Please fill in all required fields and select images", "error");
      return;
    }

    setLoading(true);
    setUploadProgress({
      percentage: 0,
      completed: 0,
      total: files.length,
      status: 'uploading'
    });

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Create gallery
      const galleryData = {
        ...formData,
        organizationId: organization.id,
        createdBy: userProfile.id,
        createdByName: `${userProfile.firstName} ${userProfile.lastName}`,
        deadline: formData.deadline ? new Date(formData.deadline) : null
      };

      const galleryId = await createGallery(galleryData);

      // Update progress to show compression
      setUploadProgress(prev => ({ ...prev, status: 'compressing' }));
      
      // Compress images before upload
      const compressedFiles = await compressImages(files, {
        maxWidth: 3000,
        maxHeight: 3000,
        quality: 0.92,
        concurrency: 3,
        onOverallProgress: (progress) => {
          setUploadProgress(prev => ({ 
            ...prev, 
            percentage: progress.percentage * 0.3, // Compression is 30% of overall progress
            status: 'compressing',
            completed: progress.completed,
            total: progress.total
          }));
        }
      });
      
      // Calculate size reduction
      const originalSize = files.reduce((sum, file) => sum + file.size, 0);
      const compressedSize = compressedFiles.reduce((sum, file) => sum + file.size, 0);
      const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
      
      if (reduction > 0) {
        console.log(`Image compression saved ${reduction}% (${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(compressedSize / 1024 / 1024).toFixed(1)}MB)`);
      }

      // Upload compressed images with abort signal
      setUploadProgress(prev => ({ ...prev, status: 'uploading' }));
      const result = await uploadProofImages(galleryId, compressedFiles, (progress) => {
        // Adjust progress to account for compression phase (30% compression + 70% upload)
        setUploadProgress({
          ...progress,
          percentage: 30 + (progress.percentage * 0.7)
        });
      }, controller.signal);

      if (result.failed && result.failed.length > 0) {
        showToast(`Gallery created with ${result.uploaded.length} images. ${result.failed.length} images failed to upload.`, "warning");
      } else {
        showToast(`Gallery "${formData.name}" created successfully!`, "success");
      }
      
      // Copy link to clipboard
      const link = `${window.location.origin}/proof/${galleryId}`;
      navigator.clipboard.writeText(link).then(() => {
        showToast("Gallery link copied to clipboard!", "success");
      });

      onClose();
    } catch (error) {
      console.error("Error creating gallery:", error);
      if (error.message === 'Upload cancelled') {
        showToast("Upload cancelled", "info");
      } else {
        showToast("Failed to create gallery. Please try again.", "error");
      }
    } finally {
      setLoading(false);
      setUploadProgress({
        percentage: 0,
        completed: 0,
        total: 0,
        status: 'idle'
      });
      setAbortController(null);
    }
  };

  // Handle upload cancellation
  const handleCancelUpload = () => {
    if (abortController) {
      abortController.abort();
      setUploadProgress(prev => ({ ...prev, status: 'cancelling' }));
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
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        className="create-gallery-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Create Proof Gallery</h2>
          <button
            className="close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Hidden field to prevent password autofill */}
          <input type="text" name="username" autoComplete="username" style={{ display: 'none' }} />
          
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="name">
                Gallery Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., 2025 Senior Banners"
                required
                disabled={loading}
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label>
                School <span className="required">*</span>
              </label>
              <SearchableSelect
                options={schools}
                value={formData.schoolId || ""}
                onChange={handleSchoolChange}
                placeholder="Select or search for a school..."
                name="schoolId"
                disabled={loading}
                required={true}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">
                  <Lock size={16} />
                  Password (Optional)
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Leave blank for no password"
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="deadline">
                  <Calendar size={16} />
                  Deadline (Optional)
                </label>
                <input
                  type="date"
                  id="deadline"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                Images <span className="required">*</span>
              </label>
              <div
                className={`file-drop-zone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file-input"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={loading}
                  style={{ display: 'none' }}
                />
                
                {files.length === 0 ? (
                  <label htmlFor="file-input" className="file-drop-label">
                    <Upload size={32} />
                    <p>Drag and drop images here or click to browse</p>
                    <span>Supports JPG, PNG, WebP</span>
                  </label>
                ) : (
                  <div className="selected-files">
                    <p>{files.length} image{files.length > 1 ? 's' : ''} selected</p>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => document.getElementById('file-input').click()}
                      disabled={loading}
                    >
                      Change Images
                    </button>
                  </div>
                )}
              </div>

              {files.length > 0 && (
                <div className="file-list">
                  {files.length > 10 ? (
                    <>
                      <div className="file-summary">
                        <ImageIcon size={16} />
                        <span>{files.length} images selected</span>
                      </div>
                      {files.slice(0, 5).map((file, index) => (
                        <div key={index} className="file-item">
                          <ImageIcon size={16} />
                          <span>{file.name}</span>
                          <button
                            type="button"
                            className="remove-file"
                            onClick={() => removeFile(index)}
                            disabled={loading}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <div className="file-summary">
                        <span>...and {files.length - 5} more</span>
                      </div>
                    </>
                  ) : (
                    files.map((file, index) => (
                      <div key={index} className="file-item">
                        <ImageIcon size={16} />
                        <span>{file.name}</span>
                        <button
                          type="button"
                          className="remove-file"
                          onClick={() => removeFile(index)}
                          disabled={loading}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {loading && (uploadProgress.status === 'compressing' || uploadProgress.status === 'uploading') && (
              <div className="upload-progress">
                <div className="progress-header">
                  <span>
                    {uploadProgress.status === 'compressing' 
                      ? `Compressing image ${uploadProgress.completed || 1} of ${uploadProgress.total}...` 
                      : `Uploading ${uploadProgress.completed} of ${uploadProgress.total} images...`
                    }
                  </span>
                  {uploadProgress.status === 'uploading' && (
                    <button
                      type="button"
                      className="btn-cancel-upload"
                      onClick={handleCancelUpload}
                      disabled={uploadProgress.status === 'cancelling'}
                    >
                      {uploadProgress.status === 'cancelling' ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}
                </div>
                {uploadProgress.status === 'uploading' && (
                  <>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${uploadProgress.percentage}%` }}
                      />
                    </div>
                    <span className="progress-text">{Math.round(uploadProgress.percentage)}%</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || files.length === 0}
            >
              {loading ? "Creating..." : "Create Gallery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default CreateGalleryModal;