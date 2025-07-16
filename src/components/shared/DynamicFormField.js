// src/components/shared/DynamicFormField.js
import React from 'react';

const DynamicFormField = ({ field, value, onChange, error, disabled = false }) => {
  const handleChange = (e) => {
    const newValue = field.type === 'checkbox' ? e.target.checked : e.target.value;
    onChange(field.id, newValue);
  };

  const renderField = () => {
    const commonProps = {
      id: field.id,
      name: field.id,
      disabled,
      'aria-describedby': field.helpText ? `${field.id}-help` : undefined,
      'aria-invalid': error ? 'true' : 'false'
    };

    const inputStyle = {
      width: '100%',
      padding: '0.75rem',
      border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
      borderRadius: '0.375rem',
      fontSize: '0.875rem',
      backgroundColor: disabled ? '#f3f4f6' : 'white'
    };

    switch (field.type) {
      case 'text':
        return (
          <input
            {...commonProps}
            type="text"
            value={value || ''}
            onChange={handleChange}
            placeholder={field.placeholder}
            style={inputStyle}
            maxLength={field.validation?.maxLength}
          />
        );

      case 'textarea':
        return (
          <textarea
            {...commonProps}
            value={value || ''}
            onChange={handleChange}
            placeholder={field.placeholder}
            rows={field.rows || 3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: '80px'
            }}
            maxLength={field.validation?.maxLength}
          />
        );

      case 'select':
        return (
          <select
            {...commonProps}
            value={value || ''}
            onChange={handleChange}
            style={inputStyle}
          >
            <option value="">
              {field.placeholder || `Select ${field.label.toLowerCase()}...`}
            </option>
            {(field.options || []).map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            {...commonProps}
            type="number"
            value={value || ''}
            onChange={handleChange}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.step || 1}
            style={inputStyle}
          />
        );

      case 'date':
        return (
          <input
            {...commonProps}
            type="date"
            value={value || ''}
            onChange={handleChange}
            min={field.validation?.min}
            max={field.validation?.max}
            style={inputStyle}
          />
        );

      case 'checkbox':
        return (
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}>
            <input
              {...commonProps}
              type="checkbox"
              checked={value || false}
              onChange={handleChange}
              style={{ 
                width: 'auto',
                margin: 0
              }}
            />
            <span style={{ 
              fontSize: '0.875rem',
              color: disabled ? '#9ca3af' : '#374151'
            }}>
              {field.placeholder || field.label}
            </span>
          </label>
        );

      case 'radio':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(field.options || []).map((option, index) => (
              <label 
                key={index}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  cursor: disabled ? 'not-allowed' : 'pointer'
                }}
              >
                <input
                  type="radio"
                  name={field.id}
                  value={option}
                  checked={value === option}
                  onChange={handleChange}
                  disabled={disabled}
                  style={{ width: 'auto', margin: 0 }}
                />
                <span style={{ 
                  fontSize: '0.875rem',
                  color: disabled ? '#9ca3af' : '#374151'
                }}>
                  {option}
                </span>
              </label>
            ))}
          </div>
        );

      default:
        return (
          <div style={{ 
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.375rem',
            color: '#dc2626',
            fontSize: '0.875rem'
          }}>
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* Label */}
      {field.type !== 'checkbox' && (
        <label 
          htmlFor={field.id}
          style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            color: '#374151',
            marginBottom: '0.5rem'
          }}
        >
          {field.label}
          {field.required && (
            <span style={{ color: '#ef4444', marginLeft: '0.25rem' }}>*</span>
          )}
        </label>
      )}

      {/* Field */}
      {renderField()}

      {/* Help Text */}
      {field.helpText && (
        <p 
          id={`${field.id}-help`}
          style={{ 
            margin: '0.25rem 0 0 0', 
            fontSize: '0.75rem', 
            color: '#6b7280' 
          }}
        >
          {field.helpText}
        </p>
      )}

      {/* Error Message */}
      {error && (
        <p style={{ 
          margin: '0.25rem 0 0 0', 
          fontSize: '0.75rem', 
          color: '#ef4444' 
        }}>
          {error}
        </p>
      )}
    </div>
  );
};

export default DynamicFormField;