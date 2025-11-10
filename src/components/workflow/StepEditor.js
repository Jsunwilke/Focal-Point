// src/components/workflow/StepEditor.js
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Save,
  Clock,
  Users,
  FileText,
  Bell,
  AlertCircle,
  Plus,
  Trash2,
  Video,
  Upload,
  Loader2,
  Link,
  PlayCircle,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import {
  getStepTypes,
  getAssigneeRules,
  getWorkflowGroups
} from '../../utils/workflowTemplates';
import { useDataCache } from '../../contexts/DataCacheContext';
import {
  uploadStepVideo,
  deleteStepVideo,
  validateVideoFile,
  formatFileSize
} from '../../services/videoUploadService';
import VideoPlayerModal from './VideoPlayerModal';

const StepEditor = ({
  isOpen,
  onClose,
  step,
  onSave,
  organizationID,
  allSteps = [],
  templateID = null
}) => {
  const [formData, setFormData] = useState({
    id: step?.id || '',
    title: step?.title || '',
    description: step?.description || '',
    type: step?.type || 'task',
    group: step?.group || 'pre_shoot',
    assigneeRule: step?.assigneeRule || 'role',
    assigneeValue: step?.assigneeValue || 'photographer',
    estimatedHours: step?.estimatedHours || 1,
    dueOffsetDays: step?.dueOffsetDays || 0,
    dependencies: step?.dependencies || [],
    micros: step?.micros || [],
    notifications: {
      onStart: step?.notifications?.onStart ?? true,
      onComplete: step?.notifications?.onComplete ?? true,
      escalationHours: step?.notifications?.escalationHours || 24
    },
    files: {
      required: step?.files?.required || [],
      outputs: step?.files?.outputs || []
    },
    taskCreationTrigger: step?.taskCreationTrigger || 'manual',
    taskCreationDaysBefore: step?.taskCreationDaysBefore || 7,
    tutorialVideoURL: step?.tutorialVideoURL || '',
    tutorialVideoFile: step?.tutorialVideoFile || null
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Video upload state
  const [videoInputMethod, setVideoInputMethod] = useState('url');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [isReplacingVideo, setIsReplacingVideo] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState(null);
  const [lastUploadTime, setLastUploadTime] = useState(null);
  const uploadTaskRef = useRef(null); // Store upload task for cancellation

  // Rate limiting configuration
  const UPLOAD_COOLDOWN_MS = 30000; // 30 seconds between uploads
  const MIN_RETRY_DELAY_MS = 5000; // 5 seconds minimum between retry attempts

  // Cleanup preview URL when component unmounts or file changes
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewVideoUrl(url);

      return () => {
        URL.revokeObjectURL(url);
        setPreviewVideoUrl(null);
      };
    } else {
      setPreviewVideoUrl(null);
    }
  }, [selectedFile]);

  // Get team members from cache
  const { users } = useDataCache();
  const teamMembers = (users || []).filter(m => m.isActive);

  const stepTypes = getStepTypes();
  const assigneeRules = getAssigneeRules();
  const workflowGroups = getWorkflowGroups();

  // Team members are now loaded from DataCacheContext
  useEffect(() => {
  }, [organizationID]);

  if (!isOpen) return null;

  /**
   * Detect circular dependencies using depth-first search
   * @param {string} stepId - The step ID to check
   * @param {Array} newDependencies - The proposed new dependencies
   * @returns {Array|null} - Array representing the cycle path, or null if no cycle
   */
  const detectCircularDependency = (stepId, newDependencies) => {
    // Build dependency map including the proposed changes
    const dependencyMap = {};

    // Add all existing step dependencies
    allSteps.forEach(s => {
      if (s.id === stepId) {
        // Use the new dependencies for the current step
        dependencyMap[s.id] = newDependencies;
      } else {
        dependencyMap[s.id] = s.dependencies || [];
      }
    });

    // DFS to detect cycles
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (currentId, path = []) => {
      visited.add(currentId);
      recursionStack.add(currentId);
      path.push(currentId);

      const deps = dependencyMap[currentId] || [];
      for (const depId of deps) {
        if (!visited.has(depId)) {
          const cyclePath = hasCycle(depId, [...path]);
          if (cyclePath) return cyclePath;
        } else if (recursionStack.has(depId)) {
          // Found a cycle - return the path from depId to current
          const cycleStart = path.indexOf(depId);
          return path.slice(cycleStart).concat(depId);
        }
      }

      recursionStack.delete(currentId);
      return null;
    };

    return hasCycle(stepId);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Step title is required';
    }

    if (!formData.type) {
      newErrors.type = 'Step type is required';
    }

    if (formData.estimatedHours <= 0) {
      newErrors.estimatedHours = 'Estimated hours must be greater than 0';
    }

    if (formData.assigneeRule === 'specific' && !formData.assigneeValue) {
      newErrors.assigneeValue = 'Please select a team member';
    }

    // Check for circular dependencies
    if (formData.dependencies.length > 0) {
      const cycle = detectCircularDependency(formData.id, formData.dependencies);
      if (cycle) {
        const cycleNames = cycle.map(id => {
          const step = allSteps.find(s => s.id === id);
          return step?.title || id;
        }).join(' → ');
        newErrors.dependencies = `Circular dependency detected: ${cycleNames}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Real-time validation for dependencies
    if (field === 'dependencies' && value.length > 0) {
      const cycle = detectCircularDependency(formData.id, value);
      if (cycle) {
        const cycleNames = cycle.map(id => {
          const step = allSteps.find(s => s.id === id);
          return step?.title || id;
        }).join(' → ');
        setErrors(prev => ({
          ...prev,
          dependencies: `Circular dependency detected: ${cycleNames}`
        }));
      } else {
        // Clear dependency error if no cycle
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.dependencies;
          return newErrors;
        });
      }
    } else if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  const handleArrayChange = (parent, field, index, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: prev[parent][field].map((item, i) => i === index ? value : item)
      }
    }));
  };

  const handleArrayAdd = (parent, field, value = '') => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: [...prev[parent][field], value]
      }
    }));
  };

  const handleArrayRemove = (parent, field, index) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: prev[parent][field].filter((_, i) => i !== index)
      }
    }));
  };

  // Micro-step management
  const generateMicroKey = () => {
    const stepPrefix = formData.id || 'step';
    const microNumber = formData.micros.length + 1;
    return `${stepPrefix}_micro_${microNumber}`;
  };

  const handleMicroAdd = () => {
    setFormData(prev => ({
      ...prev,
      micros: [...prev.micros, { key: generateMicroKey(), label: '' }]
    }));
  };

  const handleMicroChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      micros: prev.micros.map((micro, i) =>
        i === index ? { ...micro, [field]: value } : micro
      )
    }));
  };

  const handleMicroRemove = (index) => {
    setFormData(prev => ({
      ...prev,
      micros: prev.micros.filter((_, i) => i !== index)
    }));
  };

  // Video upload handlers
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validation = validateVideoFile(file);
    if (!validation.valid) {
      setUploadError(validation.error);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setUploadError('');
  };

  const checkRateLimit = () => {
    if (!lastUploadTime) return { allowed: true };

    const timeSinceLastUpload = Date.now() - lastUploadTime;
    if (timeSinceLastUpload < UPLOAD_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((UPLOAD_COOLDOWN_MS - timeSinceLastUpload) / 1000);
      return {
        allowed: false,
        message: `Please wait ${remainingSeconds} seconds before uploading another video.`
      };
    }

    return { allowed: true };
  };

  const handleVideoUpload = async () => {
    if (!selectedFile) return;

    // Validate required fields
    if (!organizationID || !formData.id) {
      setUploadError('Missing required information for upload');
      return;
    }

    // Check if template has been saved
    if (!templateID) {
      setUploadError('Please save the workflow template before uploading videos');
      return;
    }

    // Check rate limit
    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.allowed) {
      setUploadError(rateLimitCheck.message);
      return;
    }

    // Prevent multiple simultaneous uploads
    if (uploading) {
      setUploadError('An upload is already in progress. Please wait for it to complete.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError('');
    uploadTaskRef.current = null; // Reset upload task ref

    try {
      // If replacing, delete the old video first
      if (isReplacingVideo && formData.tutorialVideoFile) {
        await deleteStepVideo(formData.tutorialVideoFile);
      }

      const downloadURL = await uploadStepVideo(
        organizationID,
        templateID,
        formData.id,
        selectedFile,
        (progress) => setUploadProgress(progress),
        (uploadTask) => {
          // Store upload task for potential cancellation
          uploadTaskRef.current = uploadTask;
        }
      );

      // Update form data with video URL
      handleInputChange('tutorialVideoFile', downloadURL);

      // Record upload time for rate limiting
      setLastUploadTime(Date.now());

      // Clear selected file and exit replace mode
      setSelectedFile(null);
      setUploading(false);
      setUploadProgress(0);
      setIsReplacingVideo(false);
      uploadTaskRef.current = null;
    } catch (error) {
      // Handle cancellation differently from other errors
      if (error.code === 'storage/canceled') {
        setUploadError('Upload cancelled');
      } else {
        setUploadError(error.message || 'Upload failed');
      }
      setUploading(false);
      setUploadProgress(0);
      uploadTaskRef.current = null;
    }
  };

  const handleCancelUpload = () => {
    if (!window.confirm('Are you sure you want to cancel the upload? All progress will be lost.')) {
      return;
    }

    // Cancel the Firebase upload task
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel();
      uploadTaskRef.current = null;
    }

    // Reset upload state
    setUploading(false);
    setUploadProgress(0);
    setUploadError('Upload cancelled by user');
  };

  const handleDeleteUploadedVideo = async () => {
    if (!window.confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    if (formData.tutorialVideoFile) {
      await deleteStepVideo(formData.tutorialVideoFile);
      handleInputChange('tutorialVideoFile', null);
      setIsReplacingVideo(false);
    }
  };

  const handleReplaceVideo = () => {
    setIsReplacingVideo(true);
    setSelectedFile(null);
    setUploadError('');
  };

  const handleCancelReplace = () => {
    setIsReplacingVideo(false);
    setSelectedFile(null);
    setUploadError('');
  };

  const handlePreviewVideo = () => {
    setShowVideoPlayer(true);
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    onSave(formData);
  };

  const getStepTypeInfo = (typeId) => {
    return stepTypes.find(type => type.id === typeId);
  };

  const getAssigneeRuleInfo = (ruleId) => {
    return assigneeRules.find(rule => rule.id === ruleId);
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10002,
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (uploading) {
            alert('Please wait for the video upload to complete before closing.');
            return;
          }
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
              {step?.id ? 'Edit Workflow Step' : 'Create Workflow Step'}
            </h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
              Configure the details for this workflow step
            </p>
          </div>
          <button
            onClick={() => {
              if (uploading) {
                alert('Please wait for the video upload to complete before closing.');
                return;
              }
              onClose();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: uploading ? 'not-allowed' : 'pointer',
              padding: '0.25rem',
              opacity: uploading ? 0.5 : 1
            }}
            title={uploading ? 'Upload in progress...' : 'Close'}
            disabled={uploading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Upload Loading Overlay */}
        {uploading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem'
          }}>
            <Loader2 size={48} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
                Uploading Video...
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                {uploadProgress}% complete
              </p>
              {uploadProgress > 0 && (
                <div style={{
                  width: '300px',
                  height: '8px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  marginTop: '1rem'
                }}>
                  <div style={{
                    width: `${uploadProgress}%`,
                    height: '100%',
                    backgroundColor: '#3b82f6',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              )}
              <button
                onClick={handleCancelUpload}
                style={{
                  marginTop: '1.5rem',
                  padding: '0.5rem 1.5rem',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  margin: '1.5rem auto 0'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                <X size={16} />
                Cancel Upload
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Left Column */}
            <div>
              {/* Basic Information */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600' }}>
                  Basic Information
                </h3>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    Step Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="e.g., Equipment Check"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: `1px solid ${errors.title ? '#ef4444' : '#d1d5db'}`,
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                  />
                  {errors.title && (
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                      {errors.title}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe what needs to be done in this step..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    Step Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: `1px solid ${errors.type ? '#ef4444' : '#d1d5db'}`,
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    {stepTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.icon} {type.name} - {type.description}
                      </option>
                    ))}
                  </select>
                  {errors.type && (
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                      {errors.type}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    Workflow Group
                  </label>
                  <select
                    value={formData.group}
                    onChange={(e) => handleInputChange('group', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    {workflowGroups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name} - {group.description}
                      </option>
                    ))}
                  </select>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    marginTop: '0.5rem' 
                  }}>
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '2px',
                        backgroundColor: workflowGroups.find(g => g.id === formData.group)?.color || '#6b7280'
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {workflowGroups.find(g => g.id === formData.group)?.description}
                    </span>
                  </div>
                </div>
              </div>

              {/* Assignment & Timing */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600' }}>
                  Assignment & Timing
                </h3>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    Assignment Rule
                  </label>
                  <select
                    value={formData.assigneeRule}
                    onChange={(e) => handleInputChange('assigneeRule', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    {assigneeRules.map(rule => (
                      <option key={rule.id} value={rule.id}>
                        {rule.name} - {rule.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    {formData.assigneeRule === 'role' ? 'Role' : 
                     formData.assigneeRule === 'specific' ? 'Team Member' : 'Value'}
                  </label>
                  {formData.assigneeRule === 'role' ? (
                    <select
                      value={formData.assigneeValue}
                      onChange={(e) => handleInputChange('assigneeValue', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="photographer">Photographer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                    </select>
                  ) : formData.assigneeRule === 'specific' ? (
                    <select
                      value={formData.assigneeValue}
                      onChange={(e) => handleInputChange('assigneeValue', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: `1px solid ${errors.assigneeValue ? '#ef4444' : '#d1d5db'}`,
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="">Select a team member</option>
                      {teamMembers
                        .filter(member => !member.isAccountant)
                        .map(member => (
                          <option key={member.id} value={member.id}>
                            {member.firstName} {member.lastName} ({member.role})
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.assigneeValue}
                      onChange={(e) => handleInputChange('assigneeValue', e.target.value)}
                      placeholder="Auto-assigned"
                      disabled
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        backgroundColor: '#f9fafb',
                        color: '#6b7280'
                      }}
                    />
                  )}
                  {errors.assigneeValue && (
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                      {errors.assigneeValue}
                    </p>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                      Estimated Hours *
                    </label>
                    <input
                      type="number"
                      value={formData.estimatedHours}
                      onChange={(e) => handleInputChange('estimatedHours', parseFloat(e.target.value) || 0)}
                      min="0.1"
                      step="0.5"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: `1px solid ${errors.estimatedHours ? '#ef4444' : '#d1d5db'}`,
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                    {errors.estimatedHours && (
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                        {errors.estimatedHours}
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                      Due Days Offset
                    </label>
                    <input
                      type="number"
                      value={formData.dueOffsetDays}
                      onChange={(e) => handleInputChange('dueOffsetDays', parseInt(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                      Days before (-) or after (+) session date
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div>
              {/* Notifications */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600' }}>
                  Notifications
                </h3>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.notifications.onStart}
                      onChange={(e) => handleNestedChange('notifications', 'onStart', e.target.checked)}
                    />
                    <span style={{ fontSize: '0.875rem' }}>Notify when step starts</span>
                  </label>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.notifications.onComplete}
                      onChange={(e) => handleNestedChange('notifications', 'onComplete', e.target.checked)}
                    />
                    <span style={{ fontSize: '0.875rem' }}>Notify when step completes</span>
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    Escalation Hours
                  </label>
                  <input
                    type="number"
                    value={formData.notifications.escalationHours}
                    onChange={(e) => handleNestedChange('notifications', 'escalationHours', parseInt(e.target.value) || 0)}
                    min="1"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem'
                    }}
                  />
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                    Hours before sending overdue notification
                  </p>
                </div>
              </div>

              {/* File Requirements */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600' }}>
                  File Requirements
                </h3>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    Required Files
                  </label>
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.5rem' }}>
                    {formData.files.required.map((file, index) => (
                      <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          value={file}
                          onChange={(e) => handleArrayChange('files', 'required', index, e.target.value)}
                          placeholder="File name or description"
                          style={{
                            flex: 1,
                            padding: '0.25rem 0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.25rem',
                            fontSize: '0.875rem'
                          }}
                        />
                        <button
                          onClick={() => handleArrayRemove('files', 'required', index)}
                          style={{
                            padding: '0.25rem',
                            border: '1px solid #ef4444',
                            backgroundColor: 'white',
                            color: '#ef4444',
                            borderRadius: '0.25rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => handleArrayAdd('files', 'required')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        border: '1px solid #3b82f6',
                        backgroundColor: 'white',
                        color: '#3b82f6',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Plus size={12} />
                      Add Required File
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    Output Files
                  </label>
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.5rem' }}>
                    {formData.files.outputs.map((file, index) => (
                      <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          value={file}
                          onChange={(e) => handleArrayChange('files', 'outputs', index, e.target.value)}
                          placeholder="File name or description"
                          style={{
                            flex: 1,
                            padding: '0.25rem 0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.25rem',
                            fontSize: '0.875rem'
                          }}
                        />
                        <button
                          onClick={() => handleArrayRemove('files', 'outputs', index)}
                          style={{
                            padding: '0.25rem',
                            border: '1px solid #ef4444',
                            backgroundColor: 'white',
                            color: '#ef4444',
                            borderRadius: '0.25rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => handleArrayAdd('files', 'outputs')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        border: '1px solid #3b82f6',
                        backgroundColor: 'white',
                        color: '#3b82f6',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Plus size={12} />
                      Add Output File
                    </button>
                  </div>
                </div>
              </div>

              {/* Task Auto-Creation */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600' }}>
                  Task Auto-Creation
                </h3>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    <span>Task Creation Trigger</span>
                    <HelpCircle
                      size={14}
                      style={{ color: '#6b7280', cursor: 'help' }}
                      title="Controls when tasks are automatically created for this step. Choose 'Immediate' for tasks that should be available right away, 'Timeline' for time-based creation, 'Dependency' to wait for prerequisite steps, or 'Manual' if you'll create tasks manually."
                    />
                  </label>
                  <select
                    value={formData.taskCreationTrigger}
                    onChange={(e) => handleInputChange('taskCreationTrigger', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="manual">Manual - No auto-creation</option>
                    <option value="immediate">Immediate - Create when workflow starts</option>
                    <option value="timeline">Timeline - Create X days before due date</option>
                    <option value="dependency">Dependency - Create when prerequisites complete</option>
                  </select>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                    {formData.taskCreationTrigger === 'manual' && 'Tasks must be created manually'}
                    {formData.taskCreationTrigger === 'immediate' && 'Task will be created as soon as the workflow starts'}
                    {formData.taskCreationTrigger === 'timeline' && 'Task will be created based on the timeline (days before due date)'}
                    {formData.taskCreationTrigger === 'dependency' && 'Task will be created when all dependency steps are completed'}
                  </p>
                </div>

                {formData.taskCreationTrigger === 'timeline' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                      Days Before Due Date
                    </label>
                    <input
                      type="number"
                      value={formData.taskCreationDaysBefore}
                      onChange={(e) => handleInputChange('taskCreationDaysBefore', parseInt(e.target.value) || 0)}
                      min="0"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                      Task will be created {formData.taskCreationDaysBefore} days before this step's due date
                    </p>
                  </div>
                )}

                {formData.taskCreationTrigger === 'dependency' && (
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                      <span>Prerequisite Steps</span>
                      <HelpCircle
                        size={14}
                        style={{ color: '#6b7280', cursor: 'help' }}
                        title="Select which steps must be completed before a task is created for this step. Tasks will be created automatically once ALL selected prerequisite steps are marked as completed. This helps ensure work is done in the correct order."
                      />
                    </label>
                    <div style={{
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: '#fafafa',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {allSteps.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af', fontStyle: 'italic' }}>
                          No other steps available yet. Add more steps to the template first.
                        </p>
                      ) : allSteps.filter(s => s.id !== formData.id).length === 0 ? (
                        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af', fontStyle: 'italic' }}>
                          No other steps available. This is the only step in the template.
                        </p>
                      ) : (
                        allSteps
                          .filter(s => s.id !== formData.id)
                          .map(availableStep => (
                            <label
                              key={availableStep.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem',
                                cursor: 'pointer',
                                borderRadius: '0.25rem',
                                transition: 'background-color 0.15s ease',
                                backgroundColor: formData.dependencies.includes(availableStep.id) ? '#eff6ff' : 'transparent'
                              }}
                              onMouseEnter={(e) => {
                                if (!formData.dependencies.includes(availableStep.id)) {
                                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!formData.dependencies.includes(availableStep.id)) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={formData.dependencies.includes(availableStep.id)}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  handleInputChange('dependencies',
                                    isChecked
                                      ? [...formData.dependencies, availableStep.id]
                                      : formData.dependencies.filter(id => id !== availableStep.id)
                                  );
                                }}
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  cursor: 'pointer',
                                  accentColor: 'var(--primary-color, #3b82f6)'
                                }}
                              />
                              <span style={{ fontSize: '0.8125rem', color: '#374151', flex: 1 }}>
                                {availableStep.title}
                              </span>
                            </label>
                          ))
                      )}
                    </div>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                      Task will be created when ALL selected steps are completed
                    </p>
                    {errors.dependencies && (
                      <div style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '0.375rem',
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'flex-start'
                      }}>
                        <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: '0.125rem' }} />
                        <span style={{ fontSize: '0.875rem', color: '#991b1b' }}>
                          {errors.dependencies}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Micro-Steps */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600' }}>
                  Micro-Steps
                </h3>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  Add checklist items that appear in the matrix view. Users can track completion of each micro-step.
                </p>

                <div style={{ border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.5rem' }}>
                  {formData.micros.map((micro, index) => (
                    <div key={index} style={{ marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        Key: {micro.key}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={micro.label}
                          onChange={(e) => handleMicroChange(index, 'label', e.target.value)}
                          placeholder="Micro-step label (e.g., 'White Balance', 'Exposure')"
                          style={{
                            flex: 1,
                            padding: '0.25rem 0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.25rem',
                            fontSize: '0.875rem'
                          }}
                        />
                        <button
                          onClick={() => handleMicroRemove(index)}
                          style={{
                            padding: '0.25rem',
                            border: '1px solid #ef4444',
                            backgroundColor: 'white',
                            color: '#ef4444',
                            borderRadius: '0.25rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={handleMicroAdd}
                    style={{
                      padding: '0.25rem 0.5rem',
                      border: '1px solid #3b82f6',
                      backgroundColor: 'white',
                      color: '#3b82f6',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <Plus size={12} />
                    Add Micro-Step
                  </button>
                </div>
              </div>

              {/* Tutorial Video */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Video size={18} />
                  Tutorial Video
                </h3>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  Add a tutorial video to help users complete this step. Use a YouTube/Vimeo URL or upload your own video file.
                </p>

                {/* Video Input Method Toggle */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setVideoInputMethod('url')}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      border: videoInputMethod === 'url' ? '2px solid var(--primary-color)' : '1px solid #d1d5db',
                      backgroundColor: videoInputMethod === 'url' ? '#eff6ff' : 'white',
                      color: videoInputMethod === 'url' ? 'var(--primary-color)' : '#6b7280',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Link size={16} />
                    Video URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoInputMethod('upload')}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      border: videoInputMethod === 'upload' ? '2px solid var(--primary-color)' : '1px solid #d1d5db',
                      backgroundColor: videoInputMethod === 'upload' ? '#eff6ff' : 'white',
                      color: videoInputMethod === 'upload' ? 'var(--primary-color)' : '#6b7280',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Upload size={16} />
                    Upload File
                  </button>
                </div>

                {/* URL Input */}
                {videoInputMethod === 'url' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                      Video URL (YouTube, Vimeo, or direct link)
                    </label>
                    <input
                      type="url"
                      value={formData.tutorialVideoURL}
                      onChange={(e) => handleInputChange('tutorialVideoURL', e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                    {formData.tutorialVideoURL && (
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#10b981' }}>
                        ✓ Video URL set
                      </p>
                    )}
                  </div>
                )}

                {/* File Upload */}
                {videoInputMethod === 'upload' && (
                  <div>
                    {!formData.tutorialVideoFile || isReplacingVideo ? (
                      <>
                        {isReplacingVideo && (
                          <div style={{
                            padding: '0.75rem',
                            backgroundColor: '#fef3c7',
                            border: '1px solid #fbbf24',
                            borderRadius: '0.375rem',
                            marginBottom: '0.75rem',
                            fontSize: '0.875rem',
                            color: '#92400e'
                          }}>
                            Replacing existing video. Upload a new file or cancel to keep the current video.
                          </div>
                        )}
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                          {isReplacingVideo ? 'Choose New Video File (MP4, MOV, AVI, WebM)' : 'Upload Video File (MP4, MOV, AVI, WebM)'}
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <input
                            type="file"
                            accept=".mp4,.mov,.avi,.webm,video/mp4,video/quicktime,video/avi,video/webm"
                            onChange={handleFileSelect}
                            disabled={uploading}
                            style={{
                              flex: 1,
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem'
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleVideoUpload}
                            disabled={!selectedFile || uploading}
                            style={{
                              padding: '0.5rem 1rem',
                              border: 'none',
                              backgroundColor: !selectedFile || uploading ? '#d1d5db' : 'var(--primary-color)',
                              color: 'white',
                              borderRadius: '0.375rem',
                              cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Upload size={16} />
                            {uploading ? 'Uploading...' : 'Upload'}
                          </button>
                          {isReplacingVideo && (
                            <button
                              type="button"
                              onClick={handleCancelReplace}
                              disabled={uploading}
                              style={{
                                padding: '0.5rem 1rem',
                                border: '1px solid #d1d5db',
                                backgroundColor: 'white',
                                color: '#6b7280',
                                borderRadius: '0.375rem',
                                cursor: uploading ? 'not-allowed' : 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>

                        {selectedFile && (
                          <div style={{
                            marginTop: '0.75rem',
                            padding: '1rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            backgroundColor: '#f9fafb'
                          }}>
                            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                              Preview Selected Video
                            </p>
                            <div style={{
                              marginBottom: '0.75rem',
                              backgroundColor: '#000',
                              borderRadius: '0.375rem',
                              overflow: 'hidden',
                              maxHeight: '300px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {previewVideoUrl ? (
                                <video
                                  src={previewVideoUrl}
                                  controls
                                  style={{
                                    width: '100%',
                                    maxHeight: '300px',
                                    display: 'block'
                                  }}
                                >
                                  <track kind="captions" />
                                  Your browser does not support the video tag.
                                </video>
                              ) : (
                                <div style={{ padding: '2rem', color: '#9ca3af', fontSize: '0.875rem' }}>
                                  Loading preview...
                                </div>
                              )}
                            </div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}>
                              <span>File: {selectedFile.name}</span>
                              <span>Size: {formatFileSize(selectedFile.size)}</span>
                            </div>
                          </div>
                        )}

                        {uploading && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <div style={{
                              width: '100%',
                              height: '8px',
                              backgroundColor: '#e5e7eb',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${uploadProgress}%`,
                                height: '100%',
                                backgroundColor: 'var(--primary-color)',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
                              {uploadProgress}%
                            </p>
                          </div>
                        )}

                        {uploadError && (
                          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <AlertCircle size={14} />
                            {uploadError}
                          </p>
                        )}
                      </>
                    ) : (
                      <div style={{
                        padding: '1rem',
                        border: '1px solid #10b981',
                        borderRadius: '0.375rem',
                        backgroundColor: '#f0fdf4'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <div>
                            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', fontWeight: '500', color: '#10b981' }}>
                              ✓ Video uploaded successfully
                            </p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                              Video is ready to be displayed in the workflow
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={handlePreviewVideo}
                            style={{
                              padding: '0.5rem 0.75rem',
                              border: '1px solid #3b82f6',
                              backgroundColor: 'white',
                              color: '#3b82f6',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              fontSize: '0.8125rem',
                              fontWeight: '500'
                            }}
                          >
                            <PlayCircle size={16} />
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={handleReplaceVideo}
                            style={{
                              padding: '0.5rem 0.75rem',
                              border: '1px solid #f59e0b',
                              backgroundColor: 'white',
                              color: '#f59e0b',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              fontSize: '0.8125rem',
                              fontWeight: '500'
                            }}
                          >
                            <RefreshCw size={16} />
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteUploadedVideo}
                            style={{
                              padding: '0.5rem 0.75rem',
                              border: '1px solid #ef4444',
                              backgroundColor: 'white',
                              color: '#ef4444',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              fontSize: '0.8125rem',
                              fontWeight: '500'
                            }}
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            {Object.keys(errors).length > 0 && (
              <span style={{ color: '#ef4444', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertCircle size={16} />
                Please fix errors before saving
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => {
                if (uploading) {
                  alert('Please wait for the video upload to complete before closing.');
                  return;
                }
                onClose();
              }}
              disabled={uploading}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                backgroundColor: uploading ? '#f3f4f6' : 'white',
                borderRadius: '0.375rem',
                cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={Object.keys(errors).length > 0 || uploading}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                backgroundColor: (Object.keys(errors).length > 0 || uploading) ? '#9ca3af' : '#3b82f6',
                color: 'white',
                borderRadius: '0.375rem',
                cursor: (Object.keys(errors).length > 0 || uploading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              title={uploading ? 'Upload in progress...' : ''}
            >
              <Save size={16} />
              {uploading ? 'Upload in Progress...' : 'Save Step'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      {ReactDOM.createPortal(modalContent, document.body)}
      {showVideoPlayer && (
        <VideoPlayerModal
          isOpen={showVideoPlayer}
          onClose={() => setShowVideoPlayer(false)}
          videoUrl={formData.tutorialVideoFile}
          title={`${formData.title} - Tutorial Video`}
        />
      )}
    </>
  );
};

export default StepEditor;