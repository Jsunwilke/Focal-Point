// src/components/critique/PhotoCritiqueModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Upload, Image, AlertCircle, CheckCircle, User, Edit2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePhotoCritique } from '../../contexts/PhotoCritiqueContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import Button from '../shared/Button';
import ImageAnnotator from './ImageAnnotator';
import './PhotoCritiqueModal.css';

const PhotoCritiqueModal = ({ isOpen, onClose, onSuccess, preselectedPhotographer }) => {
  const { submitCritique } = usePhotoCritique();
  const { userProfile, organization } = useAuth();
  const { users } = useDataCache();
  const [loading, setLoading] = useState(false);
  const [photographers, setPhotographers] = useState([]);
  const [formData, setFormData] = useState({
    photographerId: preselectedPhotographer?.id || '',
    notes: '',
    type: 'example' // 'example' for good example, 'improvement' for needs improvement
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [error, setError] = useState(null);
  const [annotatorOpen, setAnnotatorOpen] = useState(false);
  const [annotatingIndex, setAnnotatingIndex] = useState(null);
  const [annotatedImages, setAnnotatedImages] = useState({}); // Track which images have annotations
  const MAX_IMAGES = 6; // Maximum number of images allowed
  
  // Load photographers from cached users when modal opens
  useEffect(() => {
    if (isOpen) {
      // If photographer is preselected, use just that photographer
      if (preselectedPhotographer) {
        setPhotographers([preselectedPhotographer]);
        setFormData(prev => ({ ...prev, photographerId: preselectedPhotographer.id }));
      } else if (users && users.length > 0) {
        // Filter for photographers only from cached users
        const photographersList = users.filter(member => member.isPhotographer === true);
        setPhotographers(photographersList);
      } else {
        // If cache isn't ready, clear photographers list
        setPhotographers([]);
      }
    }
  }, [isOpen, users]);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    
    // Check if adding these files would exceed the limit
    if (imageFiles.length + files.length > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    
    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > 20 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError('All images must be less than 20MB');
      return;
    }
    
    // Process each file
    const newImageFiles = [...imageFiles];
    const newImagePreviews = [...imagePreviews];
    
    files.forEach(file => {
      newImageFiles.push(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
    
    setImageFiles(newImageFiles);
    setError(null);
  };
  
  const removeImage = (index) => {
    const newImageFiles = imageFiles.filter((_, i) => i !== index);
    const newImagePreviews = imagePreviews.filter((_, i) => i !== index);
    setImageFiles(newImageFiles);
    setImagePreviews(newImagePreviews);
    
    // Remove annotation if exists
    const newAnnotatedImages = { ...annotatedImages };
    delete newAnnotatedImages[index];
    setAnnotatedImages(newAnnotatedImages);
  };

  const openAnnotator = (index) => {
    setAnnotatingIndex(index);
    setAnnotatorOpen(true);
  };

  const handleAnnotationSave = (annotatedFile, annotatedDataUrl) => {
    // Update the image file with the annotated version
    const newImageFiles = [...imageFiles];
    newImageFiles[annotatingIndex] = annotatedFile;
    setImageFiles(newImageFiles);
    
    // Update the preview
    const newImagePreviews = [...imagePreviews];
    newImagePreviews[annotatingIndex] = annotatedDataUrl;
    setImagePreviews(newImagePreviews);
    
    // Track that this image has been annotated
    setAnnotatedImages({
      ...annotatedImages,
      [annotatingIndex]: true
    });
    
    // Close annotator
    setAnnotatorOpen(false);
    setAnnotatingIndex(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if user is properly authenticated
    if (!userProfile?.id || !organization?.id) {
      setError('Authentication not complete. Please refresh the page and try again.');
      return;
    }
    
    if (imageFiles.length === 0) {
      setError('Please select at least one image');
      return;
    }
    
    if (!formData.photographerId) {
      setError('Please select a photographer');
      return;
    }
    
    if (!formData.notes.trim()) {
      setError('Please add your training notes');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await submitCritique(formData, imageFiles);
      onSuccess();
    } catch (err) {
      console.error('Error submitting critique:', err);
      setError(err.message || 'Failed to submit critique');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div 
        className="modal-content photo-critique-modal" 
        style={{ 
          position: 'relative',
          margin: 0,
          transform: 'none',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Submit Training Photo</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="photo-critique-form">
          <div className="form-content">
            {/* Left Column - Image Upload */}
            <div className="form-column form-column--left">
              <div className="upload-section">
                <h3 className="section-title">
                  Training Photos
                  {imageFiles.length > 0 && (
                    <span className="photo-count">({imageFiles.length}/{MAX_IMAGES})</span>
                  )}
                </h3>
                
                {imagePreviews.length > 0 ? (
                  <>
                    <div className="image-thumbnails-grid">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="thumbnail-item">
                          <img src={preview} alt={`Preview ${index + 1}`} />
                          {annotatedImages[index] && (
                            <div className="thumbnail-annotated-badge">
                              <Edit2 size={12} />
                            </div>
                          )}
                          <div className="thumbnail-actions">
                            <button
                              type="button"
                              className="thumbnail-action thumbnail-annotate"
                              onClick={() => openAnnotator(index)}
                              title="Annotate image"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="thumbnail-action thumbnail-remove"
                              onClick={() => removeImage(index)}
                              title="Remove image"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {imageFiles.length < MAX_IMAGES && (
                        <label htmlFor="image-input" className="add-more-button">
                          <Upload size={20} />
                          <span>Add More</span>
                        </label>
                      )}
                    </div>
                    
                    <button
                      type="button"
                      className="btn-clear-all"
                      onClick={() => {
                        setImageFiles([]);
                        setImagePreviews([]);
                      }}
                    >
                      <X size={14} />
                      Clear All
                    </button>
                  </>
                ) : (
                  <label htmlFor="image-input" className="upload-dropzone">
                    <Image size={32} />
                    <span className="upload-text">Click or drag to upload</span>
                    <span className="upload-hint">Multiple photos allowed (max {MAX_IMAGES})</span>
                    <span className="upload-hint">JPG, PNG or WebP (max 20MB each)</span>
                  </label>
                )}
                
                <input
                  type="file"
                  id="image-input"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
            
            {/* Right Column - Form Fields */}
            <div className="form-column form-column--right">
              {/* Photographer Selector */}
              <div className="form-section">
                <label className="form-label" htmlFor="photographer">
                  Send to Photographer
                </label>
                <select
                  id="photographer"
                  className="form-select"
                  value={formData.photographerId}
                  onChange={(e) => setFormData({ ...formData, photographerId: e.target.value })}
                  required
                  disabled={!users || users.length === 0}
                >
                  <option value="">
                    {!users || users.length === 0 
                      ? "Loading photographers..." 
                      : photographers.length === 0 
                        ? "No photographers available" 
                        : "Select a photographer..."}
                  </option>
                  {photographers.map(photographer => (
                    <option key={photographer.id} value={photographer.id}>
                      {photographer.firstName} {photographer.lastName}
                      {photographer.position && ` - ${photographer.position}`}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Example Type Section */}
              <div className="form-section">
                <label className="form-label">Example Type</label>
                <div className="type-selector-vertical">
                  <button
                    type="button"
                    className={`type-card-vertical ${formData.type === 'example' ? 'type-card-vertical--active type-card-vertical--good' : ''}`}
                    onClick={() => setFormData({ ...formData, type: 'example' })}
                  >
                    <CheckCircle size={18} />
                    <span>Good Example</span>
                  </button>
                  <button
                    type="button"
                    className={`type-card-vertical ${formData.type === 'improvement' ? 'type-card-vertical--active type-card-vertical--improvement' : ''}`}
                    onClick={() => setFormData({ ...formData, type: 'improvement' })}
                  >
                    <AlertCircle size={18} />
                    <span>Needs Improvement</span>
                  </button>
                </div>
              </div>
          
              <div className="form-section">
                <label className="form-label" htmlFor="notes">
                  Training Notes
                  <span className="char-count">{formData.notes.length}/2000</span>
                </label>
                <textarea
                  id="notes"
                  className="form-textarea"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={formData.type === 'example' 
                    ? "Explain what makes this a good example (composition, lighting, posing, etc.)..."
                    : "Explain what needs improvement and how to fix it..."}
                  rows={5}
                  maxLength={2000}
                />
              </div>
            </div>
          </div>
          
          {error && (
            <div className="form-error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          
          <div className="modal-footer">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              icon={<Upload size={20} />}
            >
              Submit Training Photo
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(modalContent, document.body)}
      {annotatorOpen && annotatingIndex !== null && (
        <ImageAnnotator
          isOpen={annotatorOpen}
          imageUrl={imagePreviews[annotatingIndex]}
          onSave={handleAnnotationSave}
          onClose={() => {
            setAnnotatorOpen(false);
            setAnnotatingIndex(null);
          }}
        />
      )}
    </>
  );
};

export default PhotoCritiqueModal;