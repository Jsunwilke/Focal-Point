import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  X,
  FileText,
  Save,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  getReportTemplates,
  createDailyJobReport,
  getSchools,
} from "../../firebase/firestore";
import { calculateSmartFieldValue } from "../../utils/calculations";
import Button from "../shared/Button";
import "../shared/Modal.css";
import "./CreateReportModal.css";

const CreateReportModal = ({ onClose, onReportCreated }) => {
  const { userProfile, organization } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [schools, setSchools] = useState([]);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [smartFieldValues, setSmartFieldValues] = useState({});
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    photographer: userProfile?.firstName || "",
  });

  useEffect(() => {
    loadTemplates();
    loadSchools();
  }, [organization]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedTemplate) {
      calculateSmartFields();
    }
  }, [selectedTemplate, formData.date, selectedSchools]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError("");
      
      console.log("Loading templates for report creation - organization:", organization);
      
      if (!organization?.id) {
        console.error("No organization ID available for template loading");
        setError("Organization data not available. Please refresh the page.");
        return;
      }
      
      const templatesData = await getReportTemplates(organization.id);
      setTemplates(templatesData);
      
      // Auto-select default template if available
      const defaultTemplate = templatesData.find(t => t.isDefault);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
        initializeFormData(defaultTemplate);
      }
    } catch (err) {
      console.error("Error loading templates:", err);
      if (err.code === 'permission-denied') {
        setError("Permission denied. Please check your access privileges.");
      } else {
        setError(`Failed to load templates: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSchools = async () => {
    try {
      if (!organization?.id) return;
      
      const schoolsData = await getSchools(organization.id);
      setSchools(schoolsData);
    } catch (err) {
      console.error("Error loading schools:", err);
    }
  };

  const calculateSmartFields = async () => {
    if (!selectedTemplate || !selectedTemplate.fields) return;
    
    const smartFields = selectedTemplate.fields.filter(field => field.smartConfig);
    const newSmartFieldValues = {};
    
    // Create calculation context
    const context = {
      userProfile: userProfile,
      selectedSchools: selectedSchools, // Use user-selected schools
      userHomeAddress: userProfile?.homeAddress || userProfile?.address,
      attachedPhotos: [],
      reportDate: formData.date,
      photographer: formData.photographer
    };
    
    for (const field of smartFields) {
      try {
        const value = await calculateSmartFieldValue(field, context);
        newSmartFieldValues[field.id] = value;
      } catch (error) {
        console.error(`Error calculating smart field ${field.id}:`, error);
        newSmartFieldValues[field.id] = field.smartConfig.fallbackValue || "";
      }
    }
    
    setSmartFieldValues(newSmartFieldValues);
  };

  const initializeFormData = (template) => {
    const newFormData = {
      date: new Date().toISOString().split('T')[0],
      photographer: userProfile?.firstName || "",
      templateId: template.id,
      templateName: template.name,
    };

    // Initialize all form fields based on template
    template.fields?.forEach(field => {
      switch (field.type) {
        case "multiselect":
          newFormData[field.id] = [];
          break;
        case "toggle":
          newFormData[field.id] = false;
          break;
        case "number":
          newFormData[field.id] = 0;
          break;
        default:
          newFormData[field.id] = field.defaultValue || "";
      }
    });

    setFormData(newFormData);
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    initializeFormData(template);
  };

  const handleFieldChange = (fieldId, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleMultiSelectChange = (fieldId, option, checked) => {
    setFormData(prev => {
      const currentValues = prev[fieldId] || [];
      const newValues = checked
        ? [...currentValues, option]
        : currentValues.filter(v => v !== option);
      
      return {
        ...prev,
        [fieldId]: newValues
      };
    });
  };

  const handleSchoolSelection = (schoolId, checked) => {
    setSelectedSchools(prev => {
      if (checked) {
        const school = schools.find(s => s.id === schoolId);
        return school ? [...prev, school] : prev;
      } else {
        return prev.filter(school => school.id !== schoolId);
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedTemplate) {
      setError("Please select a template");
      return;
    }
    
    if (!organization?.id) {
      setError("Organization data not available. Please refresh the page.");
      return;
    }
    
    if (!userProfile?.uid) {
      setError("User data not available. Please refresh the page.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      
      console.log("Creating report with data:", {
        organization: organization.id,
        user: userProfile.uid,
        template: selectedTemplate.id
      });

      // Prepare report data for template-based report
      const reportData = {
        ...formData,
        ...smartFieldValues, // Include calculated smart field values
        organizationID: organization.id,
        userId: userProfile.uid,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        templateVersion: selectedTemplate.version || 1,
        photographer: formData.photographer,
        reportType: 'template',
        smartFieldsUsed: selectedTemplate.fields?.filter(f => f.smartConfig)?.map(f => f.id) || [],
      };

      // Submit the report to dailyJobReports collection
      const reportId = await createDailyJobReport(reportData);
      
      console.log("Report created successfully with ID:", reportId);
      
      if (onReportCreated) {
        onReportCreated({ ...reportData, id: reportId });
      }
      
      onClose();
    } catch (err) {
      console.error("Error creating report:", err);
      if (err.code === 'permission-denied') {
        setError("Permission denied. Please check your access privileges.");
      } else {
        setError(`Failed to create report: ${err.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const value = formData[field.id] || "";

    switch (field.type) {
      case "text":
      case "email":
      case "phone":
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className="form-input"
          />
        );

      case "textarea":
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className="form-textarea"
            rows={3}
          />
        );

      case "number":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.id, parseFloat(e.target.value) || 0)}
            placeholder={field.placeholder}
            required={field.required}
            className="form-input"
          />
        );

      case "date":
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            className="form-input"
          />
        );

      case "time":
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            className="form-input"
          />
        );

      case "select":
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            className="form-select"
          >
            <option value="">Choose {field.label.toLowerCase()}</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );

      case "multiselect":
        return (
          <div className="checkbox-group">
            {field.options?.map((option, index) => (
              <label key={index} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={(formData[field.id] || []).includes(option)}
                  onChange={(e) => handleMultiSelectChange(field.id, option, e.target.checked)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case "radio":
        return (
          <div className="radio-group">
            {field.options?.map((option, index) => (
              <label key={index} className="radio-label">
                <input
                  type="radio"
                  name={field.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  required={field.required}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case "toggle":
        return (
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              className="toggle-input"
            />
            <span className="toggle-text">
              {value ? "Yes" : "No"}
            </span>
          </label>
        );

      case "file":
        return (
          <input
            type="file"
            multiple
            onChange={(e) => {
              // Handle file uploads here
              console.log("Files selected:", e.target.files);
            }}
            className="form-input"
          />
        );

      // Smart field types
      case "mileage":
      case "date_auto":
      case "time_auto":
      case "user_name":
      case "school_name":
      case "photo_count":
      case "current_location":
      case "weather_conditions":
      case "calculation":
        return (
          <input
            type="text"
            value={smartFieldValues[field.id] || field.smartConfig?.fallbackValue || ""}
            disabled={field.readOnly !== false}
            className="form-input smart-field-input"
            style={{ backgroundColor: '#f0f8ff', fontStyle: 'italic' }}
            placeholder={`Auto-calculated: ${field.label}`}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className="form-input"
          />
        );
    }
  };

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal modal--large"
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
          maxWidth: "800px",
          width: "100%",
          maxHeight: "90vh",
        }}
      >
        <div className="modal__header">
          <div className="modal__title-section">
            <FileText size={24} />
            <div>
              <h2 className="modal__title">Create Daily Report</h2>
              <p className="modal__subtitle">Fill out your daily job report</p>
            </div>
          </div>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="modal__content create-report__content">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <p>Loading templates...</p>
            </div>
          ) : (
            <>
              {/* Template Selection */}
              <div className="template-selection">
                <h3>Select Report Template</h3>
                <div className="template-options">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      className={`template-option ${
                        selectedTemplate?.id === template.id ? "template-option--selected" : ""
                      }`}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <div className="template-option__header">
                        <h4>{template.name}</h4>
                        {template.isDefault && (
                          <span className="template-default-badge">Default</span>
                        )}
                      </div>
                      <p>{template.description || "No description"}</p>
                      <div className="template-meta">
                        <span>{template.shootType}</span>
                        <span>{template.fields?.length || 0} fields</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Form */}
              {selectedTemplate && (
                <form onSubmit={handleSubmit} className="report-form">
                  <h3>Report Details</h3>
                  
                  {/* Built-in fields */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Date</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleFieldChange("date", e.target.value)}
                        required
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Photographer</label>
                      <input
                        type="text"
                        value={formData.photographer}
                        onChange={(e) => handleFieldChange("photographer", e.target.value)}
                        required
                        className="form-input"
                      />
                    </div>
                  </div>

                  {/* School Selection - Required for mileage calculations */}
                  <div className="form-group">
                    <label>
                      Schools Visited 
                      <span className="required">*</span>
                      <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.5rem' }}>
                        (Required for mileage calculation)
                      </span>
                    </label>
                    <div className="checkbox-group">
                      {schools.length === 0 ? (
                        <p style={{ color: '#666', fontStyle: 'italic' }}>Loading schools...</p>
                      ) : (
                        schools.map(school => (
                          <label key={school.id} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={selectedSchools.some(s => s.id === school.id)}
                              onChange={(e) => handleSchoolSelection(school.id, e.target.checked)}
                            />
                            <span>{school.value}</span>
                          </label>
                        ))
                      )}
                    </div>
                    {selectedSchools.length > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                        Selected: {selectedSchools.map(s => s.value).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Dynamic template fields */}
                  {selectedTemplate.fields?.map(field => (
                    <div key={field.id} className="form-group">
                      <label>
                        {field.label}
                        {field.required && <span className="required">*</span>}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}

                  <div className="form-actions">
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? (
                        "Creating..."
                      ) : (
                        <>
                          <Save size={16} />
                          Create Report
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateReportModal;