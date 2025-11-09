// src/components/tasks/TaskTemplateSelector.js
import React, { useState, useEffect } from 'react';
import { FileText, Trash2, Edit, Plus } from 'lucide-react';
import { getTaskTemplates, deleteTaskTemplate } from '../../firebase/taskTemplates';
import { useAuth } from '../../contexts/AuthContext';
import './TaskTemplateSelector.css';

const TaskTemplateSelector = ({ onSelectTemplate, onCreateNew }) => {
  const { organization, userProfile } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, [organization?.id]);

  const loadTemplates = async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      const fetchedTemplates = await getTaskTemplates(organization.id);
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, templateId) => {
    e.stopPropagation();

    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await deleteTaskTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="template-selector__loading">
        <div className="loading-spinner"></div>
        <p>Loading templates...</p>
      </div>
    );
  }

  return (
    <div className="template-selector">
      <div className="template-selector__header">
        <h3>Task Templates</h3>
        <button className="template-selector__new-btn" onClick={onCreateNew}>
          <Plus size={16} />
          Create New
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="template-selector__empty">
          <FileText size={48} />
          <p>No templates yet</p>
          <button className="template-selector__empty-btn" onClick={onCreateNew}>
            <Plus size={16} />
            Create First Template
          </button>
        </div>
      ) : (
        <div className="template-selector__list">
          {templates.map(template => (
            <div
              key={template.id}
              className="template-selector__item"
              onClick={() => onSelectTemplate(template)}
            >
              <div className="template-selector__item-header">
                <div className="template-selector__item-icon">
                  <FileText size={20} />
                </div>
                <div className="template-selector__item-content">
                  <h4 className="template-selector__item-title">{template.name}</h4>
                  {template.description && (
                    <p className="template-selector__item-description">
                      {template.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="template-selector__item-meta">
                <span
                  className="template-selector__item-priority"
                  style={{ backgroundColor: getPriorityColor(template.priority) }}
                >
                  {template.priority}
                </span>
                <span className="template-selector__item-type">{template.type}</span>
              </div>

              <div className="template-selector__item-actions">
                <button
                  className="template-selector__item-delete"
                  onClick={(e) => handleDelete(e, template.id)}
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
  );
};

export default TaskTemplateSelector;
