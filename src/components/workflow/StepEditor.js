// src/components/workflow/StepEditor.js
import React, { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { 
  getStepTypes, 
  getAssigneeRules 
} from '../../utils/workflowTemplates';
import { getTeamMembers } from '../../firebase/firestore';

const StepEditor = ({
  isOpen,
  onClose,
  step,
  onSave,
  organizationID
}) => {
  const [formData, setFormData] = useState({
    id: step?.id || '',
    title: step?.title || '',
    description: step?.description || '',
    type: step?.type || 'task',
    assigneeRule: step?.assigneeRule || 'role',
    assigneeValue: step?.assigneeValue || 'photographer',
    estimatedHours: step?.estimatedHours || 1,
    dueOffsetDays: step?.dueOffsetDays || 0,
    dependencies: step?.dependencies || [],
    notifications: {
      onStart: step?.notifications?.onStart ?? true,
      onComplete: step?.notifications?.onComplete ?? true,
      escalationHours: step?.notifications?.escalationHours || 24
    },
    files: {
      required: step?.files?.required || [],
      outputs: step?.files?.outputs || []
    }
  });

  const [errors, setErrors] = useState({});
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  const stepTypes = getStepTypes();
  const assigneeRules = getAssigneeRules();

  useEffect(() => {
    const loadTeamMembers = async () => {
      if (organizationID) {
        try {
          const members = await getTeamMembers(organizationID);
          setTeamMembers(members.filter(m => m.isActive));
        } catch (error) {
          console.error('Error loading team members:', error);
        }
      }
    };
    loadTeamMembers();
  }, [organizationID]);

  if (!isOpen) return null;

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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
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
        if (e.target === e.currentTarget) onClose();
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
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem'
          }}>
            <X size={20} />
          </button>
        </div>

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
                      {teamMembers.map(member => (
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
              disabled={Object.keys(errors).length > 0}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                backgroundColor: Object.keys(errors).length > 0 ? '#9ca3af' : '#3b82f6',
                color: 'white',
                borderRadius: '0.375rem',
                cursor: Object.keys(errors).length > 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Save size={16} />
              Save Step
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default StepEditor;