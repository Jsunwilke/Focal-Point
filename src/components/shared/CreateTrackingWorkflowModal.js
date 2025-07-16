// src/components/shared/CreateTrackingWorkflowModal.js
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Calendar, School, FileText, AlertCircle } from "lucide-react";
import { createTrackingWorkflowForSchool, getWorkflowTemplates } from "../../firebase/firestore";
import { getOrganizationTrackingTemplates } from "../../utils/workflowTemplates";
import Button from "./Button";
import LoadingSpinner from "./LoadingSpinner";
import DynamicFormField from "./DynamicFormField";
import "./Modal.css";
import "./CreateTrackingWorkflowModal.css";

const CreateTrackingWorkflowModal = ({ isOpen, onClose, school, organizationID, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trackingTemplates, setTrackingTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [formData, setFormData] = useState({
    templateId: "",
    academicYear: "2024-2025",
    trackingStartDate: new Date().toISOString().split('T')[0],
    notes: ""
  });
  const [customFormData, setCustomFormData] = useState({});
  const [customFormErrors, setCustomFormErrors] = useState({});

  // Load tracking templates when modal opens
  useEffect(() => {
    const loadTrackingTemplates = async () => {
      if (isOpen && organizationID) {
        setLoadingTemplates(true);
        try {
          const templates = await getOrganizationTrackingTemplates(organizationID, getWorkflowTemplates);
          setTrackingTemplates(templates);
          
          // Set default template if current one isn't available
          if (templates.length > 0 && !templates.find(t => t.id === formData.templateId)) {
            setFormData(prev => ({
              ...prev,
              templateId: templates[0].id
            }));
          }
        } catch (error) {
          console.error('Error loading tracking templates:', error);
          // Fallback to basic message
          setTrackingTemplates([]);
          setError('Failed to load tracking templates');
        } finally {
          setLoadingTemplates(false);
        }
      }
    };

    loadTrackingTemplates();
  }, [isOpen, organizationID, formData.templateId]);

  // Reset custom form data when template changes
  useEffect(() => {
    if (formData.templateId) {
      const selectedTemplate = trackingTemplates.find(t => t.id === formData.templateId);
      if (selectedTemplate && selectedTemplate.customFormFields) {
        // Initialize custom form data with default values
        const initialData = {};
        selectedTemplate.customFormFields.forEach(field => {
          initialData[field.id] = field.defaultValue || '';
        });
        setCustomFormData(initialData);
      } else {
        setCustomFormData({});
      }
      setCustomFormErrors({});
    }
  }, [formData.templateId, trackingTemplates]);


  const currentYear = new Date().getFullYear();
  const academicYears = [
    `${currentYear-1}-${currentYear}`,
    `${currentYear}-${currentYear+1}`,
    `${currentYear+1}-${currentYear+2}`
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCustomFieldChange = (fieldId, value) => {
    setCustomFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
    
    // Clear error for this field
    if (customFormErrors[fieldId]) {
      setCustomFormErrors(prev => ({ ...prev, [fieldId]: '' }));
    }
  };

  const validateCustomFields = (template) => {
    if (!template.customFormFields) return true;
    
    const errors = {};
    let isValid = true;
    
    template.customFormFields.forEach(field => {
      const value = customFormData[field.id];
      
      // Check required fields
      if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
        errors[field.id] = `${field.label} is required`;
        isValid = false;
      }
      
      // Additional validation based on field type
      if (value && field.validation) {
        if (field.type === 'text' || field.type === 'textarea') {
          if (field.validation.maxLength && value.length > field.validation.maxLength) {
            errors[field.id] = `${field.label} must be ${field.validation.maxLength} characters or less`;
            isValid = false;
          }
        }
        
        if (field.type === 'number') {
          const numValue = parseFloat(value);
          if (field.validation.min !== undefined && numValue < field.validation.min) {
            errors[field.id] = `${field.label} must be at least ${field.validation.min}`;
            isValid = false;
          }
          if (field.validation.max !== undefined && numValue > field.validation.max) {
            errors[field.id] = `${field.label} must be at most ${field.validation.max}`;
            isValid = false;
          }
        }
      }
    });
    
    setCustomFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Get selected template for validation
      const selectedTemplate = trackingTemplates.find(t => t.id === formData.templateId);
      if (!selectedTemplate) {
        throw new Error("Please select a tracking template");
      }

      // Validate custom fields
      if (!validateCustomFields(selectedTemplate)) {
        setError("Please fix the form errors before submitting");
        setLoading(false);
        return;
      }

      // Calculate end date (30 days from start by default)
      const startDate = new Date(formData.trackingStartDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);

      // Prepare additional data including custom form fields
      const currentTemplate = trackingTemplates.find(t => t.id === formData.templateId);
      const additionalData = {
        notes: formData.notes,
        customFormData: customFormData,
        customFormFields: currentTemplate?.customFormFields || []
      };

      const workflowId = await createTrackingWorkflowForSchool(
        school.id,
        organizationID,
        formData.templateId,
        formData.academicYear,
        {
          trackingStartDate: startDate,
          trackingEndDate: endDate,
          additionalData
        }
      );

      console.log("✅ Tracking workflow created:", workflowId);
      
      if (onSuccess) {
        onSuccess(workflowId);
      }
      
      onClose();
    } catch (err) {
      console.error("Error creating tracking workflow:", err);
      setError(err.message || "Failed to create tracking workflow");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  const modalContent = (
    <div 
      className="modal-overlay" 
      onClick={handleOverlayClick}
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
        backdropFilter: 'blur(2px)'
      }}
    >
      <div className="modal-container create-tracking-workflow-modal" style={{
        position: 'relative',
        margin: 0,
        transform: 'none'
      }}>
        <div className="modal-header">
          <h2 className="modal-title">
            <FileText size={20} />
            Create Tracking Workflow
          </h2>
          <button
            onClick={onClose}
            className="modal-close-button"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="school-info">
            <School size={16} />
            <span>Creating workflow for: <strong>{school?.value || school?.name || 'Selected School'}</strong></span>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="tracking-workflow-form">
            <div className="form-content">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="templateId" className="form-label">
                    Tracking Template *
                  </label>
                  <select
                    id="templateId"
                    name="templateId"
                    value={formData.templateId}
                    onChange={handleChange}
                    className="form-input"
                    required
                    disabled={loadingTemplates}
                  >
                    {loadingTemplates ? (
                      <option value="">Loading tracking templates...</option>
                    ) : trackingTemplates.length === 0 ? (
                      <option value="">No tracking templates available</option>
                    ) : (
                      <>
                        <option value="">Select a tracking template...</option>
                        {trackingTemplates.map(template => (
                          <option key={template.id} value={template.id} title={template.description}>
                            {template.name}
                            {template.isCustom ? ' (Custom)' : ' (Default)'}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {trackingTemplates.length === 0 && !loadingTemplates && (
                    <p className="form-hint" style={{ color: '#ef4444', marginTop: '0.25rem' }}>
                      No tracking templates found. Create one in the Workflow Template Gallery first.
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="academicYear" className="form-label">
                    Academic Year *
                  </label>
                  <select
                    id="academicYear"
                    name="academicYear"
                    value={formData.academicYear}
                    onChange={handleChange}
                    className="form-input"
                    required
                  >
                    {academicYears.map(year => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="trackingStartDate" className="form-label">
                  <Calendar size={16} />
                  Start Date *
                </label>
                <input
                  type="date"
                  id="trackingStartDate"
                  name="trackingStartDate"
                  value={formData.trackingStartDate}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
                <span className="form-hint">
                  Workflow due dates will be calculated from this date
                </span>
              </div>

              {/* Dynamic Custom Form Fields */}
              {(() => {
                const selectedTemplate = trackingTemplates.find(t => t.id === formData.templateId);
                return selectedTemplate && selectedTemplate.customFormFields && selectedTemplate.customFormFields.length > 0;
              })() && (
                <div className="form-section">
                  <h4 style={{ 
                    margin: '0 0 1rem 0', 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.5rem'
                  }}>
                    Template-Specific Information
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {trackingTemplates.find(t => t.id === formData.templateId)?.customFormFields?.map(field => (
                      <DynamicFormField
                        key={field.id}
                        field={field}
                        value={customFormData[field.id]}
                        onChange={handleCustomFieldChange}
                        error={customFormErrors[field.id]}
                        disabled={loading}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="notes" className="form-label">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="form-input"
                  rows="3"
                  placeholder="Any additional notes or special requirements..."
                />
              </div>
            </div>

            <div className="form-actions">
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
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="small" />
                    Creating Workflow...
                  </>
                ) : (
                  "Create Workflow"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default CreateTrackingWorkflowModal;