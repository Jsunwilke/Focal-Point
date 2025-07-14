// src/components/workflow/WorkflowTemplateBuilder.js
import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, 
  Plus, 
  Trash2, 
  Move, 
  Clock, 
  Users, 
  Tag,
  Save,
  ArrowUp,
  ArrowDown,
  Settings,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { 
  createWorkflowTemplate,
  updateWorkflowTemplate,
  getTeamMembers 
} from '../../firebase/firestore';
import { 
  getStepTypes, 
  getAssigneeRules,
  createTemplateForOrganization 
} from '../../utils/workflowTemplates';
import { 
  getOrganizationSessionTypes 
} from '../../utils/sessionTypes';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import StepEditor from './StepEditor';

const WorkflowTemplateBuilder = ({
  isOpen,
  onClose,
  organizationID,
  onTemplateCreated,
  editTemplate = null // If provided, we're editing an existing template
}) => {
  const { organization } = useAuth();
  const { showToast } = useToast();
  
  // Initialize form data
  const [formData, setFormData] = useState({
    name: editTemplate?.name || '',
    description: editTemplate?.description || '',
    sessionTypes: editTemplate?.sessionTypes || [],
    estimatedDays: editTemplate?.estimatedDays || 7,
    steps: editTemplate?.steps || []
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [draggedStep, setDraggedStep] = useState(null);

  // Get available options
  const stepTypes = getStepTypes();
  const assigneeRules = getAssigneeRules();
  const organizationSessionTypes = getOrganizationSessionTypes(organization);

  if (!isOpen) return null;

  // Generate unique step ID
  const generateStepId = () => {
    const prefix = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'custom';
    const stepNumber = formData.steps.length + 1;
    return `${prefix}_step_${stepNumber}`;
  };

  // Validation
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Template description is required';
    }
    
    if (formData.sessionTypes.length === 0) {
      newErrors.sessionTypes = 'At least one session type is required';
    }
    
    if (formData.steps.length === 0) {
      newErrors.steps = 'At least one workflow step is required';
    }
    
    // Validate each step
    formData.steps.forEach((step, index) => {
      if (!step.title?.trim()) {
        newErrors[`step_${index}_title`] = 'Step title is required';
      }
      if (!step.type) {
        newErrors[`step_${index}_type`] = 'Step type is required';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Session type management
  const handleSessionTypeToggle = (sessionTypeId) => {
    setFormData(prev => ({
      ...prev,
      sessionTypes: prev.sessionTypes.includes(sessionTypeId)
        ? prev.sessionTypes.filter(id => id !== sessionTypeId)
        : [...prev.sessionTypes, sessionTypeId]
    }));
  };

  // Step management
  const handleAddStep = () => {
    const newStep = {
      id: generateStepId(),
      title: '',
      description: '',
      type: 'task',
      assigneeRule: 'role',
      assigneeValue: 'photographer',
      estimatedHours: 1,
      dueOffsetDays: 0,
      dependencies: [],
      notifications: {
        onStart: true,
        onComplete: true,
        escalationHours: 24
      },
      files: {
        required: [],
        outputs: []
      }
    };
    
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
    
    setActiveStep(newStep);
    setShowStepEditor(true);
  };

  const handleEditStep = (step) => {
    setActiveStep(step);
    setShowStepEditor(true);
  };

  const handleUpdateStep = (updatedStep) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map(step => 
        step.id === updatedStep.id ? updatedStep : step
      )
    }));
    setShowStepEditor(false);
    setActiveStep(null);
  };

  const handleDeleteStep = (stepId) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter(step => step.id !== stepId)
    }));
  };

  const handleMoveStep = (stepId, direction) => {
    setFormData(prev => {
      const steps = [...prev.steps];
      const index = steps.findIndex(step => step.id === stepId);
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      
      if (newIndex >= 0 && newIndex < steps.length) {
        [steps[index], steps[newIndex]] = [steps[newIndex], steps[index]];
      }
      
      return { ...prev, steps };
    });
  };

  // Drag and drop handling
  const handleDragStart = (e, step) => {
    setDraggedStep(step);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetStep) => {
    e.preventDefault();
    
    if (!draggedStep || draggedStep.id === targetStep.id) return;
    
    setFormData(prev => {
      const steps = [...prev.steps];
      const draggedIndex = steps.findIndex(step => step.id === draggedStep.id);
      const targetIndex = steps.findIndex(step => step.id === targetStep.id);
      
      // Remove dragged step and insert at target position
      const [draggedStepData] = steps.splice(draggedIndex, 1);
      steps.splice(targetIndex, 0, draggedStepData);
      
      return { ...prev, steps };
    });
    
    setDraggedStep(null);
  };

  // Save template
  const handleSave = async () => {
    if (!validateForm()) {
      showToast('Validation Error', 'Please fix the errors before saving', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const templateData = {
        ...formData,
        organizationID,
        isActive: true,
        isDefault: false,
        version: editTemplate?.version ? editTemplate.version + 1 : 1
      };
      
      let templateId;
      if (editTemplate) {
        // Update existing template
        await updateWorkflowTemplate(editTemplate.id, templateData);
        templateId = editTemplate.id;
        showToast('Success', 'Workflow template updated successfully', 'success');
      } else {
        // Create new template
        templateId = await createWorkflowTemplate(templateData);
        showToast('Success', 'Workflow template created successfully', 'success');
      }
      
      onTemplateCreated?.(templateId);
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      showToast('Error', 'Failed to save workflow template', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStepTypeIcon = (type) => {
    return stepTypes.find(st => st.id === type)?.icon || '📋';
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '95%',
          maxWidth: '1200px',
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
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', fontWeight: '600' }}>
              {editTemplate ? 'Edit Workflow Template' : 'Create Custom Workflow Template'}
            </h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
              Design a custom workflow that matches your studio's process
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem'
          }}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ 
          display: 'flex', 
          flex: 1, 
          overflow: 'hidden' 
        }}>
          {/* Left Panel - Template Settings */}
          <div style={{
            width: '350px',
            borderRight: '1px solid #e5e7eb',
            padding: '1.5rem',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
              Template Settings
            </h3>
            
            {/* Basic Info */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Template Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Senior Portrait Workflow"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: `1px solid ${errors.name ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              />
              {errors.name && (
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                  {errors.name}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe what this workflow is for..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: `1px solid ${errors.description ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  resize: 'vertical'
                }}
              />
              {errors.description && (
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                  {errors.description}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Estimated Days
              </label>
              <input
                type="number"
                value={formData.estimatedDays}
                onChange={(e) => handleInputChange('estimatedDays', parseInt(e.target.value) || 0)}
                min="1"
                max="365"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Session Types */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Session Types *
              </label>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: '#6b7280' }}>
                Select which session types should use this workflow
              </p>
              <div style={{ 
                maxHeight: '150px', 
                overflow: 'auto',
                border: `1px solid ${errors.sessionTypes ? '#ef4444' : '#d1d5db'}`,
                borderRadius: '0.375rem',
                padding: '0.5rem'
              }}>
                {organizationSessionTypes.map(sessionType => (
                  <label
                    key={sessionType.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.sessionTypes.includes(sessionType.id)}
                      onChange={() => handleSessionTypeToggle(sessionType.id)}
                    />
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '2px',
                        backgroundColor: sessionType.color
                      }}
                    />
                    {sessionType.name}
                  </label>
                ))}
              </div>
              {errors.sessionTypes && (
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                  {errors.sessionTypes}
                </p>
              )}
            </div>
          </div>

          {/* Right Panel - Steps */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              padding: '1.5rem 1.5rem 1rem 1.5rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                Workflow Steps ({formData.steps.length})
              </h3>
              <button
                onClick={handleAddStep}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Plus size={16} />
                Add Step
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
              {formData.steps.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem',
                  color: '#6b7280'
                }}>
                  <Settings size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>
                    No Steps Added Yet
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>
                    Add workflow steps to define your process
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {formData.steps.map((step, index) => (
                    <div
                      key={step.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, step)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, step)}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '1rem',
                        backgroundColor: 'white',
                        cursor: 'grab',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                        {/* Step Number */}
                        <div style={{
                          minWidth: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '600'
                        }}>
                          {index + 1}
                        </div>

                        {/* Step Content */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1rem' }}>{getStepTypeIcon(step.type)}</span>
                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
                              {step.title || 'Untitled Step'}
                            </h4>
                            <span style={{
                              padding: '0.125rem 0.5rem',
                              borderRadius: '12px',
                              backgroundColor: '#f3f4f6',
                              fontSize: '0.75rem',
                              color: '#6b7280',
                              textTransform: 'capitalize'
                            }}>
                              {step.type}
                            </span>
                          </div>
                          
                          {step.description && (
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
                              {step.description}
                            </p>
                          )}
                          
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                            {step.estimatedHours}h estimated • Due {step.dueOffsetDays > 0 ? `${step.dueOffsetDays} days after` : step.dueOffsetDays < 0 ? `${Math.abs(step.dueOffsetDays)} days before` : 'on'} session
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <button
                            onClick={() => handleMoveStep(step.id, 'up')}
                            disabled={index === 0}
                            style={{
                              padding: '0.25rem',
                              border: '1px solid #d1d5db',
                              backgroundColor: 'white',
                              borderRadius: '0.25rem',
                              cursor: index === 0 ? 'not-allowed' : 'pointer',
                              opacity: index === 0 ? 0.5 : 1
                            }}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            onClick={() => handleMoveStep(step.id, 'down')}
                            disabled={index === formData.steps.length - 1}
                            style={{
                              padding: '0.25rem',
                              border: '1px solid #d1d5db',
                              backgroundColor: 'white',
                              borderRadius: '0.25rem',
                              cursor: index === formData.steps.length - 1 ? 'not-allowed' : 'pointer',
                              opacity: index === formData.steps.length - 1 ? 0.5 : 1
                            }}
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            onClick={() => handleEditStep(step)}
                            style={{
                              padding: '0.25rem',
                              border: '1px solid #3b82f6',
                              backgroundColor: 'white',
                              color: '#3b82f6',
                              borderRadius: '0.25rem',
                              cursor: 'pointer'
                            }}
                          >
                            <Settings size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteStep(step.id)}
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
                    </div>
                  ))}
                </div>
              )}
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
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {Object.keys(errors).length > 0 && (
              <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertCircle size={16} />
                Please fix errors before saving
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                borderRadius: '0.375rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || Object.keys(errors).length > 0}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                borderRadius: '0.375rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Save size={16} />
              {loading ? 'Saving...' : editTemplate ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </div>
      </div>

      {/* Step Editor Modal */}
      {showStepEditor && activeStep && (
        <StepEditor
          isOpen={showStepEditor}
          onClose={() => {
            setShowStepEditor(false);
            setActiveStep(null);
          }}
          step={activeStep}
          onSave={handleUpdateStep}
          organizationID={organizationID}
        />
      )}
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default WorkflowTemplateBuilder;