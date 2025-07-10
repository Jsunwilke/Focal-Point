import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  X,
  Plus,
  Edit3,
  Copy,
  Trash2,
  FileText,
  Eye,
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
  ArrowLeft,
  Navigation,
  Timer,
  Camera,
  User,
  Building,
  Thermometer,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  getReportTemplates,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
  getReportTemplate,
  getSchools,
} from "../firebase/firestore";
import Button from "../components/shared/Button";
import "./TemplateBuilder.css";

const TemplateBuilder = () => {
  const navigate = useNavigate();
  const { templateId } = useParams(); // Get template ID from URL if editing
  const location = useLocation();
  const { userProfile, organization } = useAuth();
  
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isCreating, setIsCreating] = useState(!templateId);
  const [fieldSearchTerm, setFieldSearchTerm] = useState("");
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [autoSaveTimeout, setAutoSaveTimeout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggedFieldId, setDraggedFieldId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [schools, setSchools] = useState([]);

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
      description: "Boolean toggle switch",
      category: "selection"
    },
    {
      id: "file",
      label: "File Upload",
      icon: <Upload size={16} />,
      description: "File attachment field",
      category: "advanced"
    },
    {
      id: "location",
      label: "Location",
      icon: <MapPin size={16} />,
      description: "Address or location input",
      category: "advanced"
    },
    {
      id: "currency",
      label: "Currency",
      icon: <DollarSign size={16} />,
      description: "Monetary value input",
      category: "advanced"
    },
    {
      id: "calculation",
      label: "Calculation",
      icon: <Zap size={16} />,
      description: "Auto-calculated value",
      category: "smart"
    },
    {
      id: "mileage",
      label: "Round Trip Mileage",
      icon: <Navigation size={16} />,
      description: "Auto-calculates round trip distance from home to schools",
      category: "smart"
    },
    {
      id: "date_auto",
      label: "Auto Date",
      icon: <Calendar size={16} />,
      description: "Automatically fills current date",
      category: "smart"
    },
    {
      id: "time_auto",
      label: "Auto Time",
      icon: <Timer size={16} />,
      description: "Automatically fills current time",
      category: "smart"
    },
    {
      id: "user_name",
      label: "Photographer Name",
      icon: <User size={16} />,
      description: "Auto-fills photographer's name",
      category: "smart"
    },
    {
      id: "school_name",
      label: "School Name",
      icon: <Building size={16} />,
      description: "Auto-fills selected school name",
      category: "smart"
    },
    {
      id: "current_location",
      label: "Current Location",
      icon: <MapPin size={16} />,
      description: "Auto-fills GPS coordinates",
      category: "smart"
    },
    {
      id: "weather_conditions",
      label: "Weather Conditions",
      icon: <Thermometer size={16} />,
      description: "Auto-fills weather at location",
      category: "smart"
    }
  ];

  useEffect(() => {
    loadTemplate();
    loadSchools();
  }, [templateId, organization]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [autoSaveTimeout]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      setError("");

      if (!organization?.id) {
        setError("Organization data not available. Please refresh the page.");
        return;
      }

      if (templateId) {
        // Load existing template
        const template = await getReportTemplate(templateId);
        if (template) {
          setEditingTemplate(template);
          setIsCreating(false);
        } else {
          setError("Template not found");
        }
      } else {
        // Create new template or duplicate existing one
        const duplicateTemplate = location.state?.duplicateFrom;
        
        if (duplicateTemplate) {
          // Duplicating an existing template
          setEditingTemplate({
            ...duplicateTemplate,
            organizationID: organization.id,
          });
        } else {
          // Create completely new template
          setEditingTemplate({
            name: "",
            description: "",
            shootType: "general",
            fields: [],
            isDefault: false,
            isActive: true,
            organizationID: organization.id,
          });
        }
        setIsCreating(true);
      }
    } catch (err) {
      console.error("Error loading template:", err);
      setError(`Failed to load template: ${err.message}`);
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
      console.error("Error loading schools for preview:", err);
    }
  };

  const getDefaultSmartConfig = (fieldType) => {
    switch (fieldType) {
      case "mileage":
        return {
          calculation: "roundTripMileage",
          sourceFields: ["userHomeAddress", "selectedSchools"],
          units: "miles",
          precision: 1,
          fallbackValue: 0,
          autoUpdate: true
        };
      case "date_auto":
        return {
          calculation: "currentDate",
          sourceFields: [],
          format: "US",
          fallbackValue: "",
          autoUpdate: true
        };
      case "time_auto":
        return {
          calculation: "currentTime",
          sourceFields: [],
          format: "US",
          fallbackValue: "",
          autoUpdate: true
        };
      case "user_name":
        return {
          calculation: "photographerName",
          sourceFields: ["userProfile.firstName", "selectedPhotographer"],
          fallbackValue: "",
          autoUpdate: true
        };
      case "school_name":
        return {
          calculation: "schoolName",
          sourceFields: ["selectedSchools"],
          fallbackValue: "",
          autoUpdate: true
        };
      case "current_location":
        return {
          calculation: "currentLocation",
          sourceFields: [],
          format: "coordinates",
          fallbackValue: "",
          autoUpdate: false
        };
      case "weather_conditions":
        return {
          calculation: "weatherConditions",
          sourceFields: ["currentLocation"],
          apiIntegration: "weather",
          fallbackValue: "",
          autoUpdate: false
        };
      case "calculation":
      default:
        return {
          calculation: "custom",
          sourceFields: [],
          expression: "",
          fallbackValue: "",
          autoUpdate: true
        };
    }
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

    // Add smartConfig for smart fields
    if (fieldType.category === "smart") {
      newField.smartConfig = getDefaultSmartConfig(fieldType.id);
      newField.readOnly = true; // Smart fields are typically read-only
    }

    setEditingTemplate(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
    
    setTimeout(() => {
      setSelectedFieldId(newField.id);
    }, 100);
    
    triggerAutoSave();
  };

  const updateField = (fieldId, updates) => {
    setEditingTemplate(prev => ({
      ...prev,
      fields: prev.fields.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      )
    }));
    
    triggerAutoSave();
  };

  const removeField = (fieldId) => {
    setEditingTemplate(prev => ({
      ...prev,
      fields: prev.fields.filter(field => field.id !== fieldId)
    }));
    
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
    
    triggerAutoSave();
  };
  
  const handleDragStart = (e, fieldId, index) => {
    setDraggedFieldId(fieldId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.target.style.opacity = '0.5';
  };
  
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedFieldId(null);
    setDragOverIndex(null);
  };
  
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Only set drag over index if we're dragging a different field
    if (draggedFieldId && editingTemplate.fields[index]?.id !== draggedFieldId) {
      setDragOverIndex(index);
    }
  };
  
  const handleDragLeave = (e) => {
    // Only clear if we're leaving the entire drop zone, not just moving between children
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  };
  
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (!draggedFieldId) return;
    
    const draggedIndex = editingTemplate.fields.findIndex(field => field.id === draggedFieldId);
    
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }
    
    // Create new fields array with reordered items
    const newFields = [...editingTemplate.fields];
    const [draggedField] = newFields.splice(draggedIndex, 1);
    newFields.splice(dropIndex, 0, draggedField);
    
    setEditingTemplate(prev => ({
      ...prev,
      fields: newFields
    }));
    
    setDragOverIndex(null);
    triggerAutoSave();
  };

  const triggerAutoSave = () => {
    if (!editingTemplate?.name?.trim()) return;
    
    setSaveStatus('saving');
    
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    
    const timeout = setTimeout(async () => {
      try {
        // Prepare template data with smart field metadata
        const smartFields = editingTemplate.fields?.filter(field => field.smartConfig);
        const hasSmartFields = smartFields && smartFields.length > 0;
        
        const templateToSave = {
          ...editingTemplate,
          hasSmartFields,
          smartFieldsCount: smartFields?.length || 0,
          smartFieldTypes: smartFields?.map(f => f.type) || [],
          version: editingTemplate.version || 1,
          templateFormat: 'v2',
        };
        
        if (isCreating) {
          const newTemplateId = await createReportTemplate(templateToSave);
          setIsCreating(false);
          navigate(`/settings/templates/${newTemplateId}`, { replace: true });
        } else {
          await updateReportTemplate(editingTemplate.id, templateToSave);
        }
        setSaveStatus('saved');
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('error');
      }
    }, 2000);
    
    setAutoSaveTimeout(timeout);
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
      
      // Validate smart fields have proper configuration
      const smartFields = editingTemplate.fields?.filter(field => field.smartConfig);
      const hasSmartFields = smartFields && smartFields.length > 0;
      
      // Prepare template data with smart field metadata
      const templateToSave = {
        ...editingTemplate,
        hasSmartFields,
        smartFieldsCount: smartFields?.length || 0,
        smartFieldTypes: smartFields?.map(f => f.type) || [],
        version: editingTemplate.version || 1,
        templateFormat: 'v2', // Indicate this supports smart fields
      };
      
      console.log("Saving template with smart fields:", templateToSave);
      
      if (isCreating) {
        const newTemplateId = await createReportTemplate(templateToSave);
        setIsCreating(false);
        navigate(`/settings/templates/${newTemplateId}`, { replace: true });
      } else {
        await updateReportTemplate(editingTemplate.id, templateToSave);
      }

      setSaveStatus('saved');
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

  const renderFieldPreview = (field, isLivePreview = false) => {
    const baseClassName = isLivePreview ? 'preview-input-element' : 'template-field__preview-element';

    switch (field.type) {
      case "text":
      case "email":
      case "phone":
        return <input 
          type={field.type} 
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} 
          disabled={!isLivePreview}
          className={baseClassName}
        />;
      case "textarea":
        return <textarea 
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} 
          disabled={!isLivePreview}
          rows={isLivePreview ? 3 : 2}
          className={baseClassName}
        />;
      case "number":
        return <input 
          type="number" 
          placeholder={field.placeholder || "0"} 
          disabled={!isLivePreview}
          className={baseClassName}
        />;
      case "date":
        return <input 
          type="date" 
          disabled={!isLivePreview}
          className={baseClassName}
        />;
      case "time":
        return <input 
          type="time" 
          disabled={!isLivePreview}
          className={baseClassName}
        />;
      case "select":
        return (
          <select disabled={!isLivePreview} className={baseClassName}>
            <option>Choose {field.label.toLowerCase()}</option>
            {field.options?.map((option, index) => (
              <option key={index}>{option}</option>
            ))}
          </select>
        );
      case "multiselect":
        return (
          <div className={`template-field__checkbox-group ${baseClassName}`}>
            {field.options?.map((option, index) => (
              <label key={index} className="checkbox-option">
                <input type="checkbox" disabled={!isLivePreview} />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );
      case "radio":
        return (
          <div className={`template-field__radio-group ${baseClassName}`}>
            {field.options?.map((option, index) => (
              <label key={index} className="radio-option">
                <input type="radio" name={field.id} disabled={!isLivePreview} />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );
      case "toggle":
        return (
          <label className={`toggle-option ${baseClassName}`}>
            <input type="checkbox" disabled={!isLivePreview} />
            <span>Yes/No</span>
          </label>
        );
      case "file":
        return <input 
          type="file" 
          disabled={!isLivePreview}
          className={baseClassName}
        />;
      case "mileage":
        // Use actual school names from organization when available
        const sampleSchools = schools.length > 0 
          ? schools.slice(0, 2).map(school => school.value)
          : ["Adams School - Marion", "Lincoln Elementary"];
        
        return (
          <div className={`${baseClassName} smart-field mileage-preview`} style={{ backgroundColor: '#f0f8ff', padding: '12px', border: '1px solid #bee3f8', borderRadius: '6px' }}>
            <div style={{ marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500', color: '#4a5568' }}>
              Schools & Mileage Preview
            </div>
            
            {/* School Selection Preview */}
            {sampleSchools.map((schoolName, index) => (
              <div key={index} style={{ marginBottom: '10px' }}>
                <div style={{ marginBottom: '6px', fontSize: '0.8rem', color: '#666' }}>School {index + 1}</div>
                <div style={{ padding: '8px', backgroundColor: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', color: '#2d3748' }}>
                  {schoolName} ⌄
                </div>
              </div>
            ))}
            
            {/* Add School Button Preview */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '6px 12px', 
                backgroundColor: '#3182ce', 
                color: 'white', 
                borderRadius: '4px', 
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}>
                <span style={{ fontSize: '0.9rem' }}>+</span> Add School
              </div>
            </div>
            
            {/* Total Mileage Preview */}
            <div>
              <div style={{ marginBottom: '6px', fontSize: '0.8rem', color: '#666' }}>Total Mileage</div>
              <div style={{ 
                padding: '10px', 
                backgroundColor: '#f7fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2d3748' }}>
                  {sampleSchools.length === 1 ? "12.4" : "24.8"}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>miles</span>
              </div>
            </div>
            
            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>
              Round trip: Home → Schools → Home
            </div>
            
            {schools.length > 0 && (
              <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#3182ce', fontStyle: 'italic' }}>
                Using actual schools from your organization
              </div>
            )}
          </div>
        );
      case "date_auto":
        return <input 
          type="text" 
          value={new Date().toLocaleDateString('en-US')}
          disabled={true}
          className={`${baseClassName} smart-field`}
          style={{ backgroundColor: '#f0f8ff', fontStyle: 'italic' }}
        />;
      case "time_auto":
        return <input 
          type="text" 
          value={new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          disabled={true}
          className={`${baseClassName} smart-field`}
          style={{ backgroundColor: '#f0f8ff', fontStyle: 'italic' }}
        />;
      case "user_name":
        return <input 
          type="text" 
          value={userProfile?.firstName || "Photographer Name"}
          disabled={true}
          className={`${baseClassName} smart-field`}
          style={{ backgroundColor: '#f0f8ff', fontStyle: 'italic' }}
        />;
      case "school_name":
        return <input 
          type="text" 
          value="School Name (auto-filled)"
          disabled={true}
          className={`${baseClassName} smart-field`}
          style={{ backgroundColor: '#f0f8ff', fontStyle: 'italic' }}
        />;
      case "current_location":
        return <input 
          type="text" 
          value="GPS coordinates (auto-detected)"
          disabled={true}
          className={`${baseClassName} smart-field`}
          style={{ backgroundColor: '#f0f8ff', fontStyle: 'italic' }}
        />;
      case "weather_conditions":
        return <input 
          type="text" 
          value="Weather (auto-detected)"
          disabled={true}
          className={`${baseClassName} smart-field`}
          style={{ backgroundColor: '#f0f8ff', fontStyle: 'italic' }}
        />;
      case "calculation":
        return <input 
          type="text" 
          value="Calculated value"
          disabled={true}
          className={`${baseClassName} smart-field`}
          style={{ backgroundColor: '#f0f8ff', fontStyle: 'italic' }}
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

  if (loading) {
    return (
      <div className="template-builder">
        <div className="template-builder__loading">
          <p>Loading template...</p>
        </div>
      </div>
    );
  }

  if (!organization?.id) {
    return (
      <div className="template-builder">
        <div className="template-builder__error">
          <p>Organization data not available. Please refresh the page.</p>
          <Button onClick={() => navigate("/settings")}>Back to Settings</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="template-builder">
      {/* Top Header Bar */}
      <div className="template-builder__header">
        <div className="template-builder__header-content">
          <div className="template-builder__title">
            <Button
              variant="secondary"
              onClick={() => navigate("/settings")}
              className="back-button"
            >
              <ArrowLeft size={16} />
              Back
            </Button>
            <h1>{isCreating ? "Create New Template" : "Edit Template"}</h1>
            <input
              type="text"
              value={editingTemplate?.name || ""}
              onChange={(e) => {
                setEditingTemplate(prev => ({ ...prev, name: e.target.value }));
                triggerAutoSave();
              }}
              placeholder="Untitled template"
              className="template-builder__name-input"
            />
          </div>
          <div className="template-builder__actions">
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
            
            <Button onClick={handleSaveTemplate} className="btn-primary">
              <Save size={16} />
              Save Template
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="template-builder__error-banner">
          {error}
        </div>
      )}

      {/* Three Panel Layout */}
      <div className="template-builder__content">
        {/* Left Panel - Field Types Palette */}
        <div className="template-builder__palette">
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
        <div className="template-builder__main">
          <div className="form-canvas">
            <div className="form-canvas__inner">
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
                  onChange={(e) => {
                    setEditingTemplate(prev => ({ ...prev, shootType: e.target.value }));
                    triggerAutoSave();
                  }}
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
                    onChange={(e) => {
                      setEditingTemplate(prev => ({ ...prev, isDefault: e.target.checked }));
                      triggerAutoSave();
                    }}
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
              <div className={`template-fields ${draggedFieldId ? 'template-fields--drag-active' : ''}`}>
                {editingTemplate?.fields?.map((field, index) => (
                  <div 
                    key={field.id} 
                    className={`template-field ${
                      selectedFieldId === field.id ? 'template-field--selected' : ''
                    } ${
                      draggedFieldId === field.id ? 'template-field--dragging' : ''
                    } ${
                      dragOverIndex === index ? 'template-field--drag-over' : ''
                    }`}
                    data-field-id={field.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, field.id, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onClick={() => setSelectedFieldId(field.id)}
                  >
                    <div className="template-field__content">
                      <div className="template-field__header">
                        <div className="template-field__drag-handle" title="Drag to reorder">
                          <div className="template-field__drag-dots">
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                          </div>
                        </div>
                        <div className="template-field__number">{index + 1}</div>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          className="template-field__label-input"
                          placeholder="Question"
                        />
                        <div className="template-field__type-indicator">
                          {fieldTypes.find(ft => ft.id === field.type)?.icon}
                          <span>{field.type}</span>
                        </div>
                      </div>
                      
                      <div className="template-field__preview">
                        {renderFieldPreview(field)}
                      </div>
                      
                      <div className="template-field__toolbar">
                        <div className="template-field__options">
                          <label className="template-field__option">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(field.id, { required: e.target.checked })}
                            />
                            <span>Required</span>
                          </label>
                        </div>
                        
                        <div className="template-field__actions">
                          <button
                            onClick={() => {
                              const newFields = [...editingTemplate.fields];
                              const fieldCopy = { ...field, id: Date.now().toString() };
                              newFields.splice(index + 1, 0, fieldCopy);
                              setEditingTemplate(prev => ({ ...prev, fields: newFields }));
                              triggerAutoSave();
                            }}
                            className="template-field__action"
                            title="Duplicate"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={() => removeField(field.id)}
                            className="template-field__action template-field__action--delete"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      {(field.type === "select" || field.type === "multiselect" || field.type === "radio") && (
                        <div className="template-field__options-editor">
                          <h5>Options</h5>
                          <div className="template-field__options-list">
                            {field.options.map((option, optIndex) => (
                              <div key={optIndex} className="template-field__option-item">
                                <div className="template-field__option-bullet">
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
                                  className="template-field__option-input"
                                />
                                <button
                                  onClick={() => {
                                    const newOptions = field.options.filter((_, i) => i !== optIndex);
                                    updateField(field.id, { options: newOptions });
                                  }}
                                  className="template-field__option-remove"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => updateField(field.id, { 
                                options: [...field.options, `Option ${field.options.length + 1}`] 
                              })}
                              className="template-field__add-option-btn"
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
        </div>

        {/* Right Panel - Live Preview */}
        <div className="template-builder__preview">
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
};

export default TemplateBuilder;