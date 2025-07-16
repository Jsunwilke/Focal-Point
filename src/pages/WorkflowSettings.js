// src/pages/WorkflowSettings.js
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  Plus, 
  Eye, 
  Edit2, 
  Trash2, 
  Settings,
  FileText,
  Download,
  Upload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getWorkflowTemplatesForOrganization,
  deleteWorkflowTemplate,
  updateWorkflowTemplate
} from '../firebase/firestore';
import { getWorkflowGroups } from '../utils/workflowTemplates';
import WorkflowTemplateBuilder from '../components/workflow/WorkflowTemplateBuilder';
import WorkflowTemplateGallery from '../components/workflow/WorkflowTemplateGallery';
import DeleteConfirmationModal from '../components/workflow/DeleteConfirmationModal';
import './WorkflowSettings.css';

const WorkflowSettings = () => {
  const [activeTab, setActiveTab] = useState('templates');
  const [customTemplates, setCustomTemplates] = useState([]);
  const [workflowGroups, setWorkflowGroups] = useState(getWorkflowGroups());
  const [editingGroup, setEditingGroup] = useState(null);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  
  const navigate = useNavigate();
  const { userProfile, organization } = useAuth();
  const { showToast } = useToast();

  // Load custom templates
  const loadCustomTemplates = async () => {
    if (!organization?.id) return;
    
    setLoading(true);
    try {
      const templates = await getWorkflowTemplatesForOrganization(organization.id);
      setCustomTemplates(templates);
    } catch (error) {
      console.error('Error loading custom templates:', error);
      showToast('Error loading templates', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomTemplates();
  }, [organization?.id]);

  // Handle template deletion
  const handleDeleteTemplate = (template) => {
    setTemplateToDelete(template);
    setShowDeleteModal(true);
  };

  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    
    setLoading(true);
    try {
      await deleteWorkflowTemplate(templateToDelete.id);
      setCustomTemplates(prev => prev.filter(t => t.id !== templateToDelete.id));
      showToast('Template Deleted', `"${templateToDelete.name}" has been permanently deleted`, 'success');
      setShowDeleteModal(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error('Error deleting template:', error);
      showToast('Error', 'Failed to delete template', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle template activation/deactivation
  const handleToggleTemplate = async (template) => {
    try {
      await updateWorkflowTemplate(template.id, {
        isActive: !template.isActive
      });
      
      setCustomTemplates(prev => 
        prev.map(t => 
          t.id === template.id 
            ? { ...t, isActive: !t.isActive }
            : t
        )
      );
      
      showToast(
        'Template Updated', 
        `"${template.name}" has been ${template.isActive ? 'deactivated' : 'activated'}`,
        'success'
      );
    } catch (error) {
      console.error('Error updating template:', error);
      showToast('Error', 'Failed to update template', 'error');
    }
  };

  // Export templates
  const handleExportTemplates = () => {
    const exportData = {
      templates: customTemplates.map(template => ({
        name: template.name,
        description: template.description,
        sessionTypes: template.sessionTypes,
        steps: template.steps,
        estimatedDays: template.estimatedDays
      })),
      exportedAt: new Date().toISOString(),
      organizationId: organization.id
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-templates-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTemplateCreated = () => {
    setShowTemplateBuilder(false);
    setShowTemplateGallery(false);
    setEditingTemplate(null);
    loadCustomTemplates();
  };

  // Group management functions
  const handleUpdateGroup = (groupId, updatedGroup) => {
    setWorkflowGroups(prev => 
      prev.map(group => 
        group.id === groupId ? { ...group, ...updatedGroup } : group
      )
    );
    setEditingGroup(null);
    showToast('Group Updated', `"${updatedGroup.name}" has been updated`, 'success');
  };

  const handleAddGroup = () => {
    const newGroup = {
      id: `custom_${Date.now()}`,
      name: 'New Group',
      description: 'Custom workflow group',
      color: '#6366f1',
      order: workflowGroups.length + 1
    };
    setWorkflowGroups(prev => [...prev, newGroup]);
    setEditingGroup(newGroup);
  };

  const handleDeleteGroup = (groupId) => {
    const group = workflowGroups.find(g => g.id === groupId);
    if (!group) return;

    if (!window.confirm(`Are you sure you want to delete "${group.name}"? This will affect all templates using this group.`)) {
      return;
    }

    setWorkflowGroups(prev => prev.filter(g => g.id !== groupId));
    showToast('Group Deleted', `"${group.name}" has been deleted`, 'success');
  };

  const handleResetGroups = () => {
    if (!window.confirm('Reset to default groups? This will remove all customizations.')) {
      return;
    }
    
    setWorkflowGroups(getWorkflowGroups());
    showToast('Groups Reset', 'Workflow groups have been reset to defaults', 'success');
  };

  return (
    <div className="workflow-settings-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <button
            onClick={() => navigate('/workflows')}
            className="back-button"
          >
            <ArrowLeft size={20} />
            Back to Workflows
          </button>
          
          <div className="header-title">
            <div className="breadcrumb">
              <span>Workflows</span>
              <span>/</span>
              <span>Settings</span>
            </div>
            <h1>Workflow Settings</h1>
            <p>Manage workflow templates and configuration</p>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="page-content">
        {/* Tabs */}
        <div className="settings-tabs">
          <button
            onClick={() => setActiveTab('templates')}
            className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`tab-button ${activeTab === 'groups' ? 'active' : ''}`}
          >
            Groups
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          >
            Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'templates' && (
            <div className="templates-section">
              {/* Action Buttons */}
              <div className="action-buttons">
                <button
                  onClick={() => setShowTemplateBuilder(true)}
                  className="primary-button"
                >
                  <Plus size={16} />
                  Create Custom Template
                </button>
                
                <button
                  onClick={() => setShowTemplateGallery(true)}
                  className="secondary-button"
                >
                  <Eye size={16} />
                  Browse Template Gallery
                </button>
                
                <button
                  onClick={handleExportTemplates}
                  className="secondary-button"
                >
                  <Download size={16} />
                  Export Templates
                </button>
              </div>

              {/* Templates List */}
              <div className="templates-section-content">
                <h3 className="section-title">
                  Custom Templates ({customTemplates.length})
                </h3>
                
                {loading ? (
                  <div className="loading-state">
                    Loading templates...
                  </div>
                ) : customTemplates.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={48} />
                    <p>No custom templates yet. Create your first template!</p>
                  </div>
                ) : (
                  <div className="templates-grid">
                    {customTemplates.map(template => (
                      <div key={template.id} className="template-card">
                        <div className="template-card-content">
                          <div className="template-header">
                            <h4>{template.name}</h4>
                            <span className={`status-badge ${template.isActive ? 'active' : 'inactive'}`}>
                              {template.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          
                          {template.description && (
                            <p className="template-description">{template.description}</p>
                          )}
                          
                          <div className="template-meta">
                            <span>{template.steps?.length || 0} steps</span>
                            {template.sessionTypes && (
                              <span>Types: {template.sessionTypes.join(', ')}</span>
                            )}
                            {template.estimatedDays && (
                              <span>{template.estimatedDays} days estimated</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="template-actions">
                          <button
                            onClick={() => {
                              setEditingTemplate(template);
                              setShowTemplateBuilder(true);
                            }}
                            className="action-button"
                            title="Edit template"
                          >
                            <Edit2 size={14} />
                          </button>
                          
                          <button
                            onClick={() => handleToggleTemplate(template)}
                            className="action-button"
                            title={template.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {template.isActive ? '⏸️' : '▶️'}
                          </button>
                          
                          <button
                            onClick={() => handleDeleteTemplate(template)}
                            className="action-button danger"
                            title="Delete template"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'groups' && (
            <div className="groups-section">
              <div className="action-buttons">
                <button
                  onClick={handleAddGroup}
                  className="primary-button"
                >
                  <Plus size={16} />
                  Add Group
                </button>
                
                <button
                  onClick={handleResetGroups}
                  className="secondary-button"
                >
                  Reset to Defaults
                </button>
              </div>

              <div className="groups-section-content">
                <h3 className="section-title">
                  Workflow Groups ({workflowGroups.length})
                </h3>
                <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                  Customize the names, colors, and descriptions of your workflow groups.
                </p>
                
                <div className="groups-grid">
                  {workflowGroups.map((group, index) => (
                    <div key={group.id} className="group-card">
                      {editingGroup?.id === group.id ? (
                        <GroupEditor 
                          group={group}
                          onSave={(updatedGroup) => handleUpdateGroup(group.id, updatedGroup)}
                          onCancel={() => setEditingGroup(null)}
                        />
                      ) : (
                        <GroupDisplay 
                          group={group}
                          index={index}
                          onEdit={() => setEditingGroup(group)}
                          onDelete={() => handleDeleteGroup(group.id)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="general-settings-section">
              <h3 className="section-title">Workflow Settings</h3>
              
              <div className="settings-content">
                <p>Additional workflow settings will be available here in future updates.</p>
                <ul>
                  <li>Default workflow assignments</li>
                  <li>Notification preferences</li>
                  <li>Workflow automation rules</li>
                  <li>Integration settings</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Builder Modal */}
      {showTemplateBuilder && (
        <WorkflowTemplateBuilder
          isOpen={showTemplateBuilder}
          onClose={() => {
            setShowTemplateBuilder(false);
            setEditingTemplate(null);
          }}
          organizationID={organization?.id}
          editTemplate={editingTemplate}
          onTemplateCreated={handleTemplateCreated}
        />
      )}

      {/* Template Gallery Modal */}
      {showTemplateGallery && (
        <WorkflowTemplateGallery
          isOpen={showTemplateGallery}
          onClose={() => setShowTemplateGallery(false)}
          organizationID={organization?.id}
          onTemplateCreated={handleTemplateCreated}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setTemplateToDelete(null);
        }}
        onConfirm={confirmDeleteTemplate}
        templateName={templateToDelete?.name || ''}
        loading={loading}
      />
    </div>
  );
};

// GroupDisplay component
const GroupDisplay = ({ group, index, onEdit, onDelete }) => {
  return (
    <div className="group-card-content">
      <div className="group-header">
        <div className="group-title">
          <div 
            className="group-color-indicator"
            style={{ backgroundColor: group.color }}
          />
          <h4>{group.name}</h4>
          <span className="group-order">#{index + 1}</span>
        </div>
        <div className="group-actions">
          <button
            onClick={onEdit}
            className="action-button"
            title="Edit group"
          >
            <Edit2 size={14} />
          </button>
          {group.id.startsWith('custom_') && (
            <button
              onClick={onDelete}
              className="action-button danger"
              title="Delete group"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      
      <p className="group-description">{group.description}</p>
      
      <div className="group-meta">
        <span style={{ 
          backgroundColor: group.color + '20', 
          color: group.color,
          padding: '0.125rem 0.5rem',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: '500'
        }}>
          Order: {group.order}
        </span>
      </div>
    </div>
  );
};

// GroupEditor component
const GroupEditor = ({ group, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: group.name,
    description: group.description,
    color: group.color,
    order: group.order
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Group name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    onSave(formData);
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

  return (
    <div className="group-editor">
      <div className="editor-field">
        <label>Group Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder="e.g., Pre-Production"
          style={{ 
            border: errors.name ? '1px solid #ef4444' : '1px solid #d1d5db'
          }}
        />
        {errors.name && <span className="error-text">{errors.name}</span>}
      </div>

      <div className="editor-field">
        <label>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Describe this workflow phase..."
          rows={2}
          style={{ 
            border: errors.description ? '1px solid #ef4444' : '1px solid #d1d5db'
          }}
        />
        {errors.description && <span className="error-text">{errors.description}</span>}
      </div>

      <div className="editor-row">
        <div className="editor-field">
          <label>Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => handleInputChange('color', e.target.value)}
              style={{ width: '40px', height: '32px' }}
            />
            <input
              type="text"
              value={formData.color}
              onChange={(e) => handleInputChange('color', e.target.value)}
              placeholder="#3b82f6"
              style={{ flex: 1 }}
            />
          </div>
        </div>

        <div className="editor-field">
          <label>Order</label>
          <input
            type="number"
            value={formData.order}
            onChange={(e) => handleInputChange('order', parseInt(e.target.value) || 1)}
            min="1"
            max="99"
          />
        </div>
      </div>

      <div className="editor-actions">
        <button onClick={onCancel} className="secondary-button">
          Cancel
        </button>
        <button onClick={handleSave} className="primary-button">
          Save Group
        </button>
      </div>
    </div>
  );
};

export default WorkflowSettings;