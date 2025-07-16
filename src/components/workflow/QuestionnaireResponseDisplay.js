// src/components/workflow/QuestionnaireResponseDisplay.js
import React from 'react';
import { 
  FileText, 
  CheckSquare, 
  Circle, 
  Calendar,
  Hash,
  ChevronDown,
  User
} from 'lucide-react';

const QuestionnaireResponseDisplay = ({ 
  customFormData = {}, 
  customFormFields = [], 
  title = "Questionnaire Responses",
  showTitle = true 
}) => {
  // If no custom form data or fields, don't render anything
  if (!customFormData || Object.keys(customFormData).length === 0 || !customFormFields || customFormFields.length === 0) {
    return null;
  }

  // Get the icon for each field type
  const getFieldIcon = (type) => {
    switch (type) {
      case 'text':
      case 'textarea':
        return <FileText size={16} />;
      case 'number':
        return <Hash size={16} />;
      case 'date':
        return <Calendar size={16} />;
      case 'checkbox':
        return <CheckSquare size={16} />;
      case 'radio':
        return <Circle size={16} />;
      case 'select':
        return <ChevronDown size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  // Format the value based on field type
  const formatValue = (value, field) => {
    if (value === null || value === undefined || value === '') {
      return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No response</span>;
    }

    switch (field.type) {
      case 'checkbox':
        if (Array.isArray(value)) {
          return value.length > 0 ? value.join(', ') : 'None selected';
        }
        return value ? 'Yes' : 'No';
      
      case 'radio':
      case 'select':
        return value;
      
      case 'date':
        try {
          return new Date(value).toLocaleDateString();
        } catch {
          return value;
        }
      
      case 'number':
        return typeof value === 'number' ? value.toString() : value;
      
      case 'textarea':
        return (
          <div style={{
            maxHeight: '100px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            backgroundColor: '#f9fafb',
            padding: '0.5rem',
            borderRadius: '0.25rem',
            border: '1px solid #e5e7eb',
            fontSize: '0.875rem'
          }}>
            {value}
          </div>
        );
      
      case 'text':
      default:
        return value;
    }
  };

  // Get display label for field
  const getFieldLabel = (field) => {
    return field.label || field.id || 'Unknown Field';
  };

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '0.5rem',
      padding: '1rem',
      marginTop: '1rem'
    }}>
      {showTitle && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <User size={18} style={{ color: '#3b82f6' }} />
          <h4 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: '600',
            color: '#1e293b'
          }}>
            {title}
          </h4>
        </div>
      )}

      <div style={{
        display: 'grid',
        gap: '0.75rem'
      }}>
        {customFormFields.map((field) => {
          const value = customFormData[field.id];
          
          return (
            <div 
              key={field.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr',
                gap: '0.75rem',
                alignItems: 'flex-start',
                padding: '0.75rem',
                backgroundColor: 'white',
                borderRadius: '0.375rem',
                border: '1px solid #e5e7eb'
              }}
            >
              {/* Field Label */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div style={{ color: '#6b7280' }}>
                  {getFieldIcon(field.type)}
                </div>
                <div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.125rem'
                  }}>
                    {getFieldLabel(field)}
                    {field.required && (
                      <span style={{ color: '#ef4444', marginLeft: '0.25rem' }}>*</span>
                    )}
                  </div>
                  {field.description && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      lineHeight: '1.3'
                    }}>
                      {field.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Field Value */}
              <div style={{
                fontSize: '0.875rem',
                color: '#1f2937',
                lineHeight: '1.4',
                wordBreak: 'break-word'
              }}>
                {formatValue(value, field)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div style={{
        marginTop: '1rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.75rem',
        color: '#6b7280',
        textAlign: 'center'
      }}>
        {customFormFields.length} field{customFormFields.length !== 1 ? 's' : ''} • 
        Submitted {customFormData.submittedAt ? new Date(customFormData.submittedAt).toLocaleString() : 'at workflow creation'}
      </div>
    </div>
  );
};

export default QuestionnaireResponseDisplay;