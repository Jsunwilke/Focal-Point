// src/components/proofing/EditGalleryModal.js
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Upload, Calendar, Lock, Image as ImageIcon, Save } from "lucide-react";
import { updateGalleryDetails, addPhotosToGallery } from "../../services/proofingService";
import { getSchools } from "../../firebase/firestore";
import { useToast } from "../../contexts/ToastContext";
import SearchableSelect from "../shared/SearchableSelect";
import { compressImages } from "../../utils/imageCompression";
import "./EditGalleryModal.css";

const EditGalleryModal = ({ isOpen, onClose, gallery, organization }) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    schoolId: "",
    schoolName: "",
    password: null, // null means don't change, '' means remove, string means update
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

  // Initialize form with gallery data
  useEffect(() => {
    if (gallery) {
      setFormData({
        name: gallery.name || "",
        schoolId: gallery.schoolId || "",
        schoolName: gallery.schoolName || "",
        password: null, // Don't show existing password
        deadline: gallery.deadline ? 
          new Date(gallery.deadline.toDate ? gallery.deadline.toDate() : gallery.deadline)
            .toISOString().split('T')[0] : ""
      });
    }
  }, [gallery]);

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
    const selectedSchool = schools.find(s => s.id === selectedId);
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
    
    if (!formData.name || !formData.schoolId) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    setLoading(true);

    try {
      // Prepare update data
      const updateData = {
        name: formData.name,
        schoolId: formData.schoolId,
        schoolName: formData.schoolName,
        deadline: formData.deadline ? new Date(formData.deadline) : null
      };

      // Only include password if it was changed
      if (formData.password !== null) {
        updateData.password = formData.password;
      }

      // Update gallery details
      await updateGalleryDetails(gallery.id, updateData);

      // If there are files to upload, add them to the gallery
      if (files.length > 0) {
        setUploadProgress({
          percentage: 0,
          completed: 0,
          total: files.length,
          status: 'uploading'
        });

        // Create abort controller for cancellation
        const controller = new AbortController();
        setAbortController(controller);

        // Compress images before upload
        setUploadProgress(prev => ({ ...prev, status: 'compressing' }));
        
        const compressedFiles = await compressImages(files, {
          maxWidth: 3000,
          maxHeight: 3000,
          quality: 0.92,
          concurrency: 3,
          onOverallProgress: (progress) => {
            setUploadProgress(prev => ({ 
              ...prev, 
              percentage: progress.percentage * 0.3,
              status: 'compressing',
              completed: progress.completed,
              total: progress.total
            }));
          }
        });

        // Upload compressed images
        setUploadProgress(prev => ({ ...prev, status: 'uploading' }));
        const result = await addPhotosToGallery(
          gallery.id, 
          compressedFiles, 
          (progress) => {
            setUploadProgress({
              ...progress,
              percentage: 30 + (progress.percentage * 0.7)
            });
          }, 
          controller.signal
        );

        if (result.failed && result.failed.length > 0) {
          showToast(`Gallery updated. ${result.uploaded.length} images added, ${result.failed.length} failed.`, "warning");
        } else {
          showToast(`Gallery updated successfully with ${result.uploaded.length} new images!`, "success");
        }
      } else {
        showToast("Gallery details updated successfully!", "success");
      }

      onClose();
    } catch (error) {
      console.error("Error updating gallery:", error);
      if (error.message === 'Upload cancelled') {
        showToast("Upload cancelled", "info");
      } else {
        showToast("Failed to update gallery. Please try again.", "error");
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

  if (!isOpen || !gallery) return null;

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
        className="edit-gallery-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Edit Gallery</h2>
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
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password === null ? "" : formData.password}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    password: e.target.value || '' 
                  })}
                  placeholder="Leave blank to keep current"
                  disabled={loading}
                  autoComplete="new-password"
                />
                <small className="form-help">
                  {gallery.password ? "Gallery is password protected" : "No password set"}
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="deadline">
                  <Calendar size={16} />
                  Deadline
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
                Add More Images
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
                    <span>Add more photos to your gallery</span>
                  </label>
                ) : (
                  <div className="selected-files">
                    <p>{files.length} new image{files.length > 1 ? 's' : ''} selected</p>
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
                  {files.length > 5 && (
                    <div className="file-summary">
                      <span>...and {files.length - 5} more</span>
                    </div>
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

            <div className="gallery-info">
              <p><strong>Current Status:</strong> {gallery.totalImages || 0} images in gallery</p>
            </div>
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
              disabled={loading}
            >
              {loading ? "Saving..." : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default EditGalleryModal;