import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Plus,
  ArrowLeft,
  Edit3,
  Copy,
  Trash2,
  Eye,
  Star,
  Search,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  getReportTemplates,
  deleteReportTemplate,
} from "../firebase/firestore";
import Button from "../components/shared/Button";
import "./TemplatesList.css";

const TemplatesList = () => {
  const navigate = useNavigate();
  const { userProfile, organization } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadTemplates();
  }, [organization]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError("");
      
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
    // Navigate to template builder with template data for duplication
    navigate("/settings/templates/new", { 
      state: { 
        duplicateFrom: {
          ...template,
          id: undefined,
          name: `${template.name} (Copy)`,
          isDefault: false,
        }
      }
    });
  };

  const filteredTemplates = templates.filter(template =>
    searchTerm === "" ||
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.shootType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="templates-list-page">
        <div className="templates-loading">
          <p>Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="templates-list-page">
      {/* Header */}
      <div className="templates-list-header">
        <div className="templates-list-header__content">
          <div className="templates-list-title">
            <Button
              variant="secondary"
              onClick={() => navigate("/settings")}
              className="back-button"
            >
              <ArrowLeft size={16} />
              Back to Settings
            </Button>
            <div className="title-section">
              <h1>Report Templates</h1>
              <p>Create and manage custom daily report templates for different types of photography jobs.</p>
            </div>
          </div>
          <div className="templates-list-actions">
            <Button
              onClick={() => navigate("/settings/templates/new")}
              className="btn-primary"
            >
              <Plus size={16} />
              Create Template
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="templates-error-banner">
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="templates-controls">
        <div className="templates-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="templates-search__input"
          />
        </div>
      </div>

      {/* Templates Grid */}
      <div className="templates-content">
        {filteredTemplates.length === 0 && !loading ? (
          <div className="templates-empty">
            <FileText size={64} />
            <h3>No Templates Yet</h3>
            <p>Create your first custom report template to get started.</p>
            <Button
              onClick={() => navigate("/settings/templates/new")}
              className="btn-primary"
            >
              <Plus size={16} />
              Create First Template
            </Button>
          </div>
        ) : (
          <div className="templates-grid">
            {filteredTemplates.map(template => (
              <div key={template.id} className="template-card">
                <div className="template-card__header">
                  <div className="template-card__title-section">
                    <h3 className="template-card__title">{template.name}</h3>
                    <div className="template-card__badges">
                      {template.isDefault && (
                        <span className="template-badge template-badge--default">
                          <Star size={12} />
                          Default
                        </span>
                      )}
                      <span className="template-badge template-badge--type">
                        {template.shootType}
                      </span>
                    </div>
                  </div>
                  <div className="template-card__actions">
                    <button
                      onClick={() => navigate(`/settings/templates/${template.id}/preview`)}
                      className="template-action"
                      title="Preview"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => navigate(`/settings/templates/${template.id}`)}
                      className="template-action"
                      title="Edit"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDuplicateTemplate(template)}
                      className="template-action"
                      title="Duplicate"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="template-action template-action--delete"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="template-card__content">
                  <p className="template-description">
                    {template.description || "No description"}
                  </p>
                  <div className="template-meta">
                    <span className="template-fields">
                      {template.fields?.length || 0} fields
                    </span>
                    <span className={`template-status ${template.isActive ? "active" : "inactive"}`}>
                      {template.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                
                <div className="template-card__footer">
                  <div className="template-dates">
                    <span>
                      Created: {template.createdAt?.toDate?.()?.toLocaleDateString() || "Unknown"}
                    </span>
                    {template.updatedAt && (
                      <span>
                        Updated: {template.updatedAt.toDate().toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatesList;