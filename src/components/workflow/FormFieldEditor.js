// src/components/workflow/FormFieldEditor.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

const FormFieldEditor = ({
  isOpen,
  onClose,
  field,
  onSave,
  formFieldTypes
}) => {
  const [formData, setFormData] = useState({
    id: '',
    type: 'text',
    label: '',
    required: false,
    placeholder: '',
    helpText: '',
    options: [],
    validation: {},
    defaultValue: ''
  });
  
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && field) {
      setFormData({
        id: field.id || '',
        type: field.type || 'text',
        label: field.label || '',
        required: field.required || false,
        placeholder: field.placeholder || '',
        helpText: field.helpText || '',
        options: field.options || [],
        validation: field.validation || {},
        defaultValue: field.defaultValue || ''
      });
      setErrors({});
    }
  }, [isOpen, field]);

  if (!isOpen) return null;

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

  const handleOptionsChange = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  const handleAddOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const handleRemoveOption = (index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.label.trim()) {
      newErrors.label = 'Field label is required';
    }
    
    if (!formData.id.trim()) {
      newErrors.id = 'Field ID is required';
    }
    
    if ((formData.type === 'select' || formData.type === 'radio') && formData.options.length === 0) {
      newErrors.options = 'At least one option is required for this field type';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    
    onSave(formData);
  };

  const needsOptions = formData.type === 'select' || formData.type === 'radio';

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
          maxWidth: '600px',
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
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
            {field.id ? 'Edit Form Field' : 'Add Form Field'}
          </h2>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem'
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Field Type */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Field Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              >
                {formFieldTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name} - {type.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Field ID */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Field ID *
              </label>
              <input
                type="text"
                value={formData.id}
                onChange={(e) => handleInputChange('id', e.target.value.replace(/[^a-z0-9_]/g, '_'))}
                placeholder="e.g., composite_size"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: `1px solid ${errors.id ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              />
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                Used internally - lowercase letters, numbers, and underscores only
              </p>
              {errors.id && (
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                  {errors.id}
                </p>
              )}
            </div>

            {/* Label */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Label *
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => handleInputChange('label', e.target.value)}
                placeholder="e.g., Composite Size"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: `1px solid ${errors.label ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              />
              {errors.label && (
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                  {errors.label}
                </p>
              )}
            </div>

            {/* Placeholder */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Placeholder
              </label>
              <input
                type="text"
                value={formData.placeholder}
                onChange={(e) => handleInputChange('placeholder', e.target.value)}
                placeholder="Optional placeholder text"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Help Text */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Help Text
              </label>
              <textarea
                value={formData.helpText}
                onChange={(e) => handleInputChange('helpText', e.target.value)}
                placeholder="Optional help text to guide users"
                rows={2}
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

            {/* Required Toggle */}
            <div>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={formData.required}
                  onChange={(e) => handleInputChange('required', e.target.checked)}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                  Required field
                </span>
              </label>
            </div>

            {/* Options (for select and radio) */}
            {needsOptions && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Options *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {formData.options.map((option, index) => (
                    <div key={index} style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handleOptionsChange(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem'
                        }}
                      />
                      <button
                        onClick={() => handleRemoveOption(index)}
                        style={{
                          padding: '0.5rem',
                          border: '1px solid #ef4444',
                          backgroundColor: 'white',
                          color: '#ef4444',
                          borderRadius: '0.375rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleAddOption}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #3b82f6',
                      backgroundColor: 'white',
                      color: '#3b82f6',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    <Plus size={16} />
                    Add Option
                  </button>
                </div>
                {errors.options && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                    {errors.options}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <button onClick={onClose} style={{
            padding: '0.5rem 1rem',
            border: '1px solid #d1d5db',
            backgroundColor: 'white',
            borderRadius: '0.375rem',
            cursor: 'pointer'
          }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '0.375rem',
              cursor: 'pointer'
            }}
          >
            Save Field
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default FormFieldEditor;