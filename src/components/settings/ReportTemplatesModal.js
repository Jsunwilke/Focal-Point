import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  X,
  Plus,
  Edit3,
  Copy,
  Trash2,
  FileText,
  Settings as SettingsIcon,
  Eye,
  Star,
  Save,
  Calendar,
  Type,
  CheckSquare,
  Circle,
  Hash,
  Mail,
  Phone,
  MapPin,
  Upload,
  Clock,
  DollarSign,
  ToggleLeft,
  List,
  Zap,
  Search,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  getReportTemplates,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
} from "../../firebase/firestore";
import Button from "../shared/Button";
import "../shared/Modal.css";

const ReportTemplatesModal = ({ onClose }) => {
  const { userProfile, organization } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("list");
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [fieldSearchTerm, setFieldSearchTerm] = useState("");
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving', 'saved', 'error'
  const [autoSaveTimeout, setAutoSaveTimeout] = useState(null);

  // Field types available for templates
  const fieldTypes = [
    {
      id: "text",
      label: "Text Input",
      icon: <Type size={16} />,
      description: "Single line text field",
      category: "basic"
    },
    {
      id: "textarea",
      label: "Text Area",
      icon: <FileText size={16} />,
      description: "Multi-line text field",
      category: "basic"
    },
    {
      id: "number",
      label: "Number",
      icon: <Hash size={16} />,
      description: "Numeric input",
      category: "basic"
    },
    {
      id: "email",
      label: "Email",
      icon: <Mail size={16} />,
      description: "Email address input",
      category: "basic"
    },
    {
      id: "phone",
      label: "Phone",
      icon: <Phone size={16} />,
      description: "Phone number input",
      category: "basic"
    },
    {
      id: "date",
      label: "Date",
      icon: <Calendar size={16} />,
      description: "Date picker",
      category: "basic"
    },
    {
      id: "time",
      label: "Time",
      icon: <Clock size={16} />,
      description: "Time picker",
      category: "basic"
    },
    {
      id: "select",
      label: "Dropdown",
      icon: <List size={16} />,
      description: "Single selection dropdown",
      category: "selection"
    },
    {
      id: "multiselect",
      label: "Multi-Select",
      icon: <CheckSquare size={16} />,
      description: "Multiple checkboxes",
      category: "selection"
    },
    {
      id: "radio",
      label: "Radio Buttons",
      icon: <Circle size={16} />,
      description: "Single choice from group",
      category: "selection"
    },
    {
      id: "toggle",
      label: "Yes/No Toggle",
      icon: <ToggleLeft size={16} />,
      description: "Boolean toggle",
      category: "selection"
    },
    {
      id: "file",
      label: "File Upload",
      icon: <Upload size={16} />,
      description: "File/image upload",
      category: "advanced"
    },
    {
      id: "location",
      label: "Location",
      icon: <MapPin size={16} />,
      description: "Address/location field",
      category: "advanced"
    },
    {
      id: "currency",
      label: "Currency",
      icon: <DollarSign size={16} />,
      description: "Money amount input",
      category: "advanced"
    },
    {
      id: "signature",
      label: "Signature",
      icon: <Edit3 size={16} />,
      description: "Digital signature capture",
      category: "advanced"
    },
    {
      id: "calculated",
      label: "Calculated Field",
      icon: <Zap size={16} />,
      description: "Auto-calculated value",
      category: "smart"
    }
  ];

  useEffect(() => {
    // Debug user permissions
    if (userProfile && organization) {
      console.log("=== DEBUG USER PERMISSIONS ===");
      console.log("User profile:", userProfile);
      console.log("User role:", userProfile.role);
      console.log("Organization:", organization);
      console.log("Organization ID:", organization.id);
      console.log("User organization ID:", userProfile.organizationID);
      console.log("Roles match for admin/manager:", ['admin', 'manager'].includes(userProfile.role));
      console.log("Organization IDs match:", userProfile.organizationID === organization.id);
      console.log("===========================");
    }
    
    loadTemplates();
  }, [organization, userProfile]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [autoSaveTimeout]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Debug logging
      console.log("Loading templates - organization:", organization);
      console.log("User profile:", userProfile);
      
      if (!organization?.id) {
        console.error("No organization ID available");
        setError("Organization data not available. Please refresh the page.");
        return;
      }
      
      const templatesData = await getReportTemplates(organization.id);
      setTemplates(templatesData);
    } catch (err) {
      console.error("Error loading templates:", err);
      if (err.code === 'permission-denied') {
        setError("Permission denied. Please check that you have admin or manager privileges.");
      } else {
        setError(`Failed to load templates: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    // Check if organization data is available
    if (!organization?.id) {
      setError("Organization data not available. Please refresh the page.");
      return;
    }
    
    console.log("Creating template with organization ID:", organization.id);
    
    setEditingTemplate({
      name: "",
      description: "",
      shootType: "general",
      fields: [],
      isDefault: false,
      isActive: true,
      organizationID: organization.id,
    });
    setIsCreating(true);
    setActiveTab("editor");
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate({ ...template });
    setIsCreating(false);
    setActiveTab("editor");
  };

  const handleSaveTemplate = async () => {
    try {
      if (!editingTemplate.name.trim()) {
        setError("Template name is required");
        return;
      }
      
      if (!editingTemplate.organizationID) {
        setError("Organization ID is missing. Please refresh the page.");
        return;
      }
      
      // Debug logging
      console.log("Saving template:", editingTemplate);
      console.log("User profile role:", userProfile?.role);
      
      if (isCreating) {
        await createReportTemplate(editingTemplate);
      } else {
        await updateReportTemplate(editingTemplate.id, editingTemplate);
      }

      await loadTemplates();
      setEditingTemplate(null);
      setIsCreating(false);
      setActiveTab("list");
      setError("");
    } catch (err) {
      console.error("Error saving template:", err);
      if (err.code === 'permission-denied') {
        setError("Permission denied. You need admin or manager privileges to save templates.");
      } else {
        setError(`Failed to save template: ${err.message}`);
      }
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      console.log("Deleting template:", templateId);
      await deleteReportTemplate(templateId);
      await loadTemplates();
    } catch (err) {
      console.error("Error deleting template:", err);
      if (err.code === 'permission-denied') {
        setError("Permission denied. You need admin privileges to delete templates.");
      } else {
        setError(`Failed to delete template: ${err.message}`);
      }
    }
  };

  const handleDuplicateTemplate = (template) => {
    setEditingTemplate({
      ...template,
      id: undefined,
      name: `${template.name} (Copy)`,
      isDefault: false,
    });
    setIsCreating(true);
    setActiveTab("editor");
  };

  const addField = (fieldType) => {
    const newField = {
      id: Date.now().toString(),
      type: fieldType.id,
      label: fieldType.label,
      required: false,
      options: fieldType.id === "select" || fieldType.id === "multiselect" || fieldType.id === "radio" ? ["Option 1", "Option 2"] : [],
      placeholder: "",
      defaultValue: "",
    };

    setEditingTemplate(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
    
    // Auto-select the newly added field
    setTimeout(() => {
      setSelectedFieldId(newField.id);
    }, 100);
  };

  const updateField = (fieldId, updates) => {
    setEditingTemplate(prev => ({
      ...prev,
      fields: prev.fields.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      )
    }));
    
    // Trigger auto-save
    triggerAutoSave();
  };
  
  const triggerAutoSave = () => {
    if (!editingTemplate?.name?.trim()) return;
    
    setSaveStatus('saving');
    
    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    
    // Set new timeout for auto-save
    const timeout = setTimeout(async () => {
      try {
        if (isCreating) {
          await createReportTemplate(editingTemplate);
        } else {
          await updateReportTemplate(editingTemplate.id, editingTemplate);
        }
        setSaveStatus('saved');
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('error');
      }
    }, 2000); // Auto-save after 2 seconds of inactivity
    
    setAutoSaveTimeout(timeout);
  };

  const removeField = (fieldId) => {
    setEditingTemplate(prev => ({
      ...prev,
      fields: prev.fields.filter(field => field.id !== fieldId)
    }));
  };

  const renderTemplatesList = () => (
    <div className="templates-list">
      <div className="templates-header">
        <div className="templates-header__content">
          <h3>Report Templates</h3>
          <p>Create and manage custom daily report templates for different types of photography jobs.</p>
        </div>
        <Button onClick={handleCreateTemplate}>
          <Plus size={16} />
          Create Template
        </Button>
      </div>

      {loading ? (
        <div className="templates-loading">
          <p>Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="templates-empty">
          <FileText size={48} />
          <h4>No Templates Yet</h4>
          <p>Create your first custom report template to get started.</p>
          <Button onClick={handleCreateTemplate}>
            <Plus size={16} />
            Create First Template
          </Button>
        </div>
      ) : (
        <div className="templates-grid">
          {templates.map((template) => (
            <div key={template.id} className="template-card">
              <div className="template-card__header">
                <div className="template-card__title">
                  <h4>{template.name}</h4>
                  {template.isDefault && (
                    <Star size={16} className="template-default-icon" />
                  )}
                </div>
                <div className="template-card__actions">
                  <button
                    onClick={() => handleEditTemplate(template)}
                    className="template-action template-action--edit"
                    title="Edit"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDuplicateTemplate(template)}
                    className="template-action template-action--copy"
                    title="Duplicate"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="template-action template-action--delete"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div className="template-card__content">
                <p className="template-description">{template.description || "No description"}</p>
                <div className="template-meta">
                  <span className="template-type">{template.shootType}</span>
                  <span className="template-fields">{template.fields?.length || 0} fields</span>
                  <span className={`template-status ${template.isActive ? "active" : "inactive"}`}>
                    {template.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTemplateEditor = () => (
    <div className="form-builder">
      {/* Top Header Bar */}
      <div className="form-builder__header">
        <div className="form-builder__header-content">
          <div className="form-builder__title">
            <h2>{isCreating ? "Create New Template" : "Edit Template"}</h2>
            <input
              type="text"
              value={editingTemplate?.name || ""}
              onChange={(e) => {
                setEditingTemplate(prev => ({ ...prev, name: e.target.value }));
                triggerAutoSave();
              }}
              placeholder="Untitled template"
              className="form-builder__name-input"
            />
          </div>
          <div className="form-builder__actions">
            <div className="auto-save-status">
              {saveStatus === 'saving' && (
                <span className="save-status save-status--saving">
                  <div className="spinner"></div>
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="save-status save-status--saved">
                  <CheckSquare size={14} />
                  Saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="save-status save-status--error">
                  <XCircle size={14} />
                  Save failed
                </span>
              )}
            </div>
            
            <Button 
              variant="secondary" 
              onClick={() => {
                setEditingTemplate(null);
                setActiveTab("list");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} className="btn-primary">
              <Save size={16} />
              Save Template
            </Button>
          </div>
        </div>
      </div>

      {/* Three Panel Layout */}
      <div className="form-builder__content">
        {/* Left Panel - Field Types Palette */}
        <div className="form-builder__palette">
          <div className="palette-header">
            <h3>Add questions</h3>
            <p>Click to add or drag to position</p>
          </div>
          
          <div className="field-search">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search field types..."
              className="field-search__input"
              value={fieldSearchTerm}
              onChange={(e) => setFieldSearchTerm(e.target.value)}
            />
          </div>

          <div className="field-types-grid">
            {["basic", "selection", "advanced", "smart"].map(category => {
              const filteredFields = fieldTypes.filter(ft => 
                ft.category === category && 
                (fieldSearchTerm === "" || 
                 ft.label.toLowerCase().includes(fieldSearchTerm.toLowerCase()) ||
                 ft.description.toLowerCase().includes(fieldSearchTerm.toLowerCase()))
              );
              
              if (filteredFields.length === 0) return null;
              
              return (
                <div key={category} className="field-category">
                  <h4 className="category-title">{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                  <div className="field-type-cards">
                    {filteredFields.map(fieldType => (
                      <div
                        key={fieldType.id}
                        className="field-type-card"
                        onClick={() => addField(fieldType)}
                        draggable
                        title={fieldType.description}
                      >
                        <div className="field-type-card__icon">
                          {fieldType.icon}
                        </div>
                        <div className="field-type-card__content">
                          <h5>{fieldType.label}</h5>
                          <p>{fieldType.description}</p>
                        </div>
                        <Plus size={14} className="field-type-card__add" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Panel - Form Builder */}
        <div className="form-builder__main">
          <div className="form-canvas">
            <div className="form-canvas__header">
              <div className="form-meta">
                <input
                  type="text"
                  value={editingTemplate?.description || ""}
                  onChange={(e) => {
                    setEditingTemplate(prev => ({ ...prev, description: e.target.value }));
                    triggerAutoSave();
                  }}
                  placeholder="Form description (optional)"
                  className="form-description"
                />
              </div>
              
              <div className="form-settings-bar">
                <select
                  value={editingTemplate?.shootType || "general"}
                  onChange={(e) => setEditingTemplate(prev => ({ ...prev, shootType: e.target.value }))}
                  className="shoot-type-select"
                >
                  <option value="general">General</option>
                  <option value="sports">Sports</option>
                  <option value="portraits">Portraits</option>
                  <option value="events">Events</option>
                  <option value="commercial">Commercial</option>
                  <option value="yearbook">Yearbook</option>
                </select>
                
                <label className="default-template-toggle">
                  <input
                    type="checkbox"
                    checked={editingTemplate?.isDefault || false}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, isDefault: e.target.checked }))}
                  />
                  <span>Set as default</span>
                </label>
              </div>
            </div>
            
            {editingTemplate?.fields?.length === 0 ? (
              <div className="form-canvas__empty">
                <div className="empty-state">
                  <FileText size={64} />
                  <h3>Start building your form</h3>
                  <p>Add questions from the panel on the left to get started.</p>
                  <div className="quick-add-buttons">
                    {fieldTypes.slice(0, 3).map(fieldType => (
                      <button
                        key={fieldType.id}
                        onClick={() => addField(fieldType)}
                        className="quick-add-btn"
                      >
                        {fieldType.icon}
                        {fieldType.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-fields">
                {editingTemplate?.fields?.map((field, index) => (
                  <div 
                    key={field.id} 
                    className={`form-field ${selectedFieldId === field.id ? 'form-field--selected' : ''}`}
                    data-field-id={field.id}
                    onClick={() => setSelectedFieldId(field.id)}
                  >
                    <div className="form-field__content">
                      <div className="form-field__header">
                        <div className="field-number">{index + 1}</div>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          className="field-label-input"
                          placeholder="Question"
                        />
                        <div className="field-type-indicator">
                          {fieldTypes.find(ft => ft.id === field.type)?.icon}
                          <span>{field.type}</span>
                        </div>
                      </div>
                      
                      <div className="form-field__preview">
                        {renderFieldPreview(field)}
                      </div>
                      
                      <div className="form-field__toolbar">
                        <div className="field-options">
                          <label className="field-option">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(field.id, { required: e.target.checked })}
                            />
                            <span>Required</span>
                          </label>
                        </div>
                        
                        <div className="field-actions">
                          <button
                            onClick={() => {
                              const newFields = [...editingTemplate.fields];
                              const fieldCopy = { ...field, id: Date.now().toString() };
                              newFields.splice(index + 1, 0, fieldCopy);
                              setEditingTemplate(prev => ({ ...prev, fields: newFields }));
                            }}
                            className="field-action"
                            title="Duplicate"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={() => removeField(field.id)}
                            className="field-action field-action--delete"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      {(field.type === "select" || field.type === "multiselect" || field.type === "radio") && (
                        <div className="field-options-editor">
                          <h5>Options</h5>
                          <div className="options-list">
                            {field.options.map((option, optIndex) => (
                              <div key={optIndex} className="option-item">
                                <div className="option-bullet">
                                  {field.type === "radio" ? <Circle size={12} /> : <CheckSquare size={12} />}
                                </div>
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => {
                                    const newOptions = [...field.options];
                                    newOptions[optIndex] = e.target.value;
                                    updateField(field.id, { options: newOptions });
                                  }}
                                  placeholder={`Option ${optIndex + 1}`}
                                  className="option-input"
                                />
                                <button
                                  onClick={() => {
                                    const newOptions = field.options.filter((_, i) => i !== optIndex);
                                    updateField(field.id, { options: newOptions });
                                  }}
                                  className="option-remove"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => updateField(field.id, { 
                                options: [...field.options, `Option ${field.options.length + 1}`] 
                              })}
                              className="add-option-btn"
                            >
                              <Plus size={14} />
                              Add option
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Live Preview */}
        <div className="form-builder__preview">
          <div className="preview-header">
            <h3>Preview</h3>
            <div className="preview-controls">
              <button className="preview-mode active" title="Desktop">
                <Eye size={16} />
              </button>
            </div>
          </div>
          
          <div className="preview-content">
            <div className="preview-form">
              <h2 className="preview-title">{editingTemplate?.name || "Untitled Form"}</h2>
              {editingTemplate?.description && (
                <p className="preview-description">{editingTemplate.description}</p>
              )}
              
              {editingTemplate?.fields?.map((field, index) => (
                <div key={field.id} className="preview-field">
                  <label className="preview-label">
                    {field.label} {field.required && <span className="required-asterisk">*</span>}
                  </label>
                  <div className="preview-input">
                    {renderFieldPreview(field, true)}
                  </div>
                </div>
              ))}
              
              {editingTemplate?.fields?.length === 0 && (
                <div className="preview-empty">
                  <p>Your form will appear here as you add questions.</p>
                </div>
              )}
              
              <div className="preview-submit">
                <button className="preview-submit-btn" disabled>Submit</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFieldPreview = (field) => {
    switch (field.type) {
      case "text":
      case "email":
      case "phone":
        return <input type="text" placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} disabled />;
      case "textarea":
        return <textarea placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} disabled rows={3} />;
      case "number":
        return <input type="number" placeholder={field.placeholder || "0"} disabled />;
      case "date":
        return <input type="date" disabled />;
      case "time":
        return <input type="time" disabled />;
      case "select":
        return (
          <select disabled>
            <option>Choose {field.label.toLowerCase()}</option>
            {field.options.map((option, index) => (
              <option key={index}>{option}</option>
            ))}
          </select>
        );
      case "multiselect":
        return (
          <div className="checkbox-group">
            {field.options.map((option, index) => (
              <label key={index}>
                <input type="checkbox" disabled />
                {option}
              </label>
            ))}
          </div>
        );
      case "radio":
        return (
          <div className="radio-group">
            {field.options.map((option, index) => (
              <label key={index}>
                <input type="radio" name={field.id} disabled />
                {option}
              </label>
            ))}
          </div>
        );
      case "toggle":
        return (
          <label>
            <input type="checkbox" disabled />
            Yes/No
          </label>
        );
      case "file":
        return <input 
          type="file" 
          disabled={!isLivePreview}
          className={baseClassName}
        />;
      default:
        return <input 
          type="text" 
          placeholder={`${field.type} field`} 
          disabled={!isLivePreview}
          className={baseClassName}
        />;
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
          maxWidth: "1200px",
          width: "100%",
          maxHeight: "90vh",
        }}
      >
        <div className="modal__header">
          <div className="modal__title-section">
            <FileText size={24} />
            <div>
              <h2 className="modal__title">Report Templates</h2>
              <p className="modal__subtitle">Design custom daily report forms</p>
            </div>
          </div>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="modal__tabs">
          <button
            className={`modal__tab ${activeTab === "list" ? "modal__tab--active" : ""}`}
            onClick={() => setActiveTab("list")}
          >
            <Eye size={16} />
            Templates
          </button>
          {editingTemplate && (
            <button
              className={`modal__tab ${activeTab === "editor" ? "modal__tab--active" : ""}`}
              onClick={() => setActiveTab("editor")}
            >
              <SettingsIcon size={16} />
              Editor
            </button>
          )}
        </div>

        <div className="modal__content templates-modal__content">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          {/* Show loading state if organization is not available */}
          {!organization?.id ? (
            <div className="loading-state">
              <p>Loading organization data...</p>
              <p>If this persists, please refresh the page.</p>
            </div>
          ) : (
            <>
              {activeTab === "list" && renderTemplatesList()}
              {activeTab === "editor" && renderTemplateEditor()}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReportTemplatesModal;