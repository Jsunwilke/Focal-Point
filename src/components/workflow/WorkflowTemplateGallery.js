// src/components/workflow/WorkflowTemplateGallery.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, Eye, Copy, Settings, Clock, Users, ArrowRight, Wrench, Trash2, AlertCircle } from 'lucide-react';
import { 
  createWorkflowTemplate,
  getWorkflowTemplates,
  deleteWorkflowTemplate
} from '../../firebase/firestore';
import { 
  getAllDefaultTemplates, 
  createTemplateForOrganization,
  getStepTypes 
} from '../../utils/workflowTemplates';
import { useToast } from '../../contexts/ToastContext';
import WorkflowTemplateBuilder from './WorkflowTemplateBuilder';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const WorkflowTemplateGallery = ({
  isOpen,
  onClose,
  organizationID,
  onTemplateCreated
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('defaults');
  const [defaultTemplates] = useState(getAllDefaultTemplates());
  const [customTemplates, setCustomTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    const loadCustomTemplates = async () => {
      if (isOpen && organizationID) {
        try {
          const templates = await getWorkflowTemplates(organizationID);
          setCustomTemplates(templates);
        } catch (error) {
          console.error('Error loading custom templates:', error);
        }
      }
    };
    loadCustomTemplates();
  }, [isOpen, organizationID]);

  if (!isOpen) return null;

  const handleUseTemplate = async (template, isDefault = false) => {
    setLoading(true);
    try {
      let templateData;
      
      if (isDefault) {
        // Map template names to keys
        const templateKeyMap = {
          "Portrait Session Workflow": "portrait",
          "Sports Photography Workflow": "sports", 
          "Wedding Photography Workflow": "wedding",
          "Graduation Photography Workflow": "graduation"
        };
        
        const templateKey = templateKeyMap[template.name];
        if (!templateKey) {
          throw new Error(`Unknown template: ${template.name}`);
        }
        
        // Create from default template
        templateData = createTemplateForOrganization(
          organizationID, 
          templateKey,
          {
            name: template.name,
            description: template.description,
            sessionTypes: template.sessionTypes,
            steps: template.steps,
            estimatedDays: template.estimatedDays,
            isDefault: true
          }
        );
      } else {
        // Copy existing custom template
        templateData = {
          ...template,
          name: `${template.name} (Copy)`,
          isDefault: false
        };
        delete templateData.id; // Remove ID so a new one is created
      }

      const templateId = await createWorkflowTemplate(templateData);
      
      showToast(
        'Template Created', 
        `${templateData.name} has been added to your organization`, 
        'success'
      );
      
      onTemplateCreated?.(templateId);
      onClose();
    } catch (error) {
      console.error('Error creating template:', error);
      showToast('Error', 'Failed to create template', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewTemplate = (template) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const handleDeleteTemplate = (template) => {
    setTemplateToDelete(template);
    setShowDeleteModal(true);
  };

  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) {
      console.error('No template selected for deletion');
      return;
    }
    
    console.log('🗑️ Starting template deletion:', templateToDelete);
    setLoading(true);
    
    try {
      console.log('📝 Deleting template with ID:', templateToDelete.id);
      await deleteWorkflowTemplate(templateToDelete.id);
      console.log('✅ Template deleted successfully');
      
      // Refresh the custom templates list
      console.log('🔄 Refreshing templates list...');
      const templates = await getWorkflowTemplates(organizationID);
      console.log('📋 Updated templates list:', templates.length, 'templates');
      setCustomTemplates(templates);
      
      showToast(
        'Template Deleted',
        `${templateToDelete.name} has been deleted successfully`,
        'success'
      );
      
      console.log('🎉 Template deletion completed successfully');
      setShowDeleteModal(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error('💥 Error deleting template:', error);
      console.error('Error details:', {
        templateId: templateToDelete.id,
        templateName: templateToDelete.name,
        errorMessage: error.message,
        errorCode: error.code,
        error: error
      });
      
      showToast(
        'Deletion Failed', 
        `Failed to delete ${templateToDelete.name}: ${error.message || 'Unknown error'}`,
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const getStepTypeIcon = (type) => {
    const stepTypes = getStepTypes();
    return stepTypes.find(st => st.id === type)?.icon || '📋';
  };

  const TemplateCard = ({ template, isDefault = false, onUse, onPreview, onDelete }) => (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '1.5rem',
      backgroundColor: 'white',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'}
    onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'}
    >
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
          {template.name}
        </h3>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', lineHeight: '1.4' }}>
          {template.description}
        </p>
      </div>

      {/* Template Stats */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem',
        fontSize: '0.75rem',
        color: '#6b7280'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Clock size={12} />
          <span>{template.steps?.length || 0} steps</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Users size={12} />
          <span>{template.sessionTypes?.join(', ') || 'All types'}</span>
        </div>
        {template.estimatedDays && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={12} />
            <span>{template.estimatedDays} days</span>
          </div>
        )}
      </div>

      {/* Session Types */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginBottom: '1rem'
      }}>
        {template.sessionTypes?.map(type => (
          <span
            key={type}
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '12px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              fontSize: '0.75rem',
              fontWeight: '500'
            }}
          >
            {type}
          </span>
        ))}
      </div>

      {/* Step Preview */}
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '4px',
        padding: '0.75rem',
        marginBottom: '1rem'
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
          WORKFLOW STEPS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {(template.steps || []).slice(0, 3).map((step, index) => (
            <div key={step.id || index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              color: '#6b7280'
            }}>
              <span>{getStepTypeIcon(step.type)}</span>
              <span>{step.title}</span>
              {step.estimatedHours && (
                <span style={{ marginLeft: 'auto', color: '#9ca3af' }}>
                  {step.estimatedHours}h
                </span>
              )}
            </div>
          ))}
          {(template.steps || []).length > 3 && (
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' }}>
              +{template.steps.length - 3} more steps
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview(template);
          }}
          style={{
            flex: 1,
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            backgroundColor: 'white',
            color: '#374151',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem'
          }}
        >
          <Eye size={14} />
          Preview
        </button>
        
        {!isDefault && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(template);
            }}
            style={{
              padding: '0.5rem',
              border: '1px solid #ef4444',
              backgroundColor: 'white',
              color: '#ef4444',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Delete Template"
          >
            <Trash2 size={14} />
          </button>
        )}
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUse(template, isDefault);
          }}
          disabled={loading}
          style={{
            flex: 1,
            padding: '0.5rem',
            border: 'none',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '0.375rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
            opacity: loading ? 0.7 : 1
          }}
        >
          <Plus size={14} />
          {isDefault ? 'Use Template' : 'Copy Template'}
        </button>
      </div>
    </div>
  );

  const PreviewModal = ({ template, onClose, onUse }) => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10002,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Preview Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
              {template.name}
            </h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
              {template.description}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem'
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Preview Body */}
        <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600' }}>
              Workflow Steps ({template.steps?.length || 0})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(template.steps || []).map((step, index) => (
                <div key={step.id || index} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}>
                  <div style={{
                    minWidth: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span>{getStepTypeIcon(step.type)}</span>
                      <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600' }}>
                        {step.title}
                      </h4>
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        borderRadius: '12px',
                        backgroundColor: '#f3f4f6',
                        fontSize: '0.75rem',
                        color: '#6b7280'
                      }}>
                        {step.type}
                      </span>
                    </div>
                    {step.description && (
                      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#6b7280' }}>
                        {step.description}
                      </p>
                    )}
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {step.estimatedHours && `${step.estimatedHours}h estimated`}
                      {step.assigneeRule && ` • Assigned by ${step.assigneeRule}`}
                    </div>
                  </div>
                  {index < template.steps.length - 1 && (
                    <ArrowRight size={16} style={{ color: '#9ca3af', marginTop: '0.25rem' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview Footer */}
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
            Close
          </button>
          <button
            onClick={() => onUse(template, true)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Plus size={16} />
            Use This Template
          </button>
        </div>
      </div>
    </div>
  );

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
        zIndex: 10001,
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
          width: '95%',
          maxWidth: '1200px',
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
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', fontWeight: '600' }}>
              Workflow Template Gallery
            </h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
              Choose from pre-built templates, copy existing workflows, or create custom templates
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowTemplateBuilder(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Wrench size={16} />
              Create Custom
            </button>
            <button onClick={onClose} style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem'
            }}>
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb'
        }}>
          {[
            { id: 'defaults', label: 'Default Templates', count: defaultTemplates.length },
            { id: 'custom', label: 'Organization Templates', count: customTemplates.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '1rem 1.5rem',
                border: 'none',
                backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: activeTab === tab.id ? '#3b82f6' : '#6b7280'
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem'
          }}>
            {activeTab === 'defaults' 
              ? defaultTemplates.map((template, index) => (
                  <TemplateCard
                    key={index}
                    template={template}
                    isDefault={true}
                    onUse={handleUseTemplate}
                    onPreview={handlePreviewTemplate}
                  />
                ))
              : customTemplates.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isDefault={false}
                    onUse={handleUseTemplate}
                    onPreview={handlePreviewTemplate}
                    onDelete={handleDeleteTemplate}
                  />
                ))
            }
          </div>

          {/* Empty State */}
          {((activeTab === 'defaults' && defaultTemplates.length === 0) ||
            (activeTab === 'custom' && customTemplates.length === 0)) && (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#6b7280'
            }}>
              <Settings size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>
                {activeTab === 'defaults' ? 'No Default Templates' : 'No Organization Templates'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                {activeTab === 'defaults' 
                  ? 'Default templates will appear here'
                  : 'Create custom templates or copy from defaults to get started'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedTemplate && (
        <PreviewModal
          template={selectedTemplate}
          onClose={() => {
            setShowPreview(false);
            setSelectedTemplate(null);
          }}
          onUse={(template) => {
            setShowPreview(false);
            setSelectedTemplate(null);
            handleUseTemplate(template, true);
          }}
        />
      )}

      {/* Template Builder Modal */}
      {showTemplateBuilder && (
        <WorkflowTemplateBuilder
          isOpen={showTemplateBuilder}
          onClose={() => setShowTemplateBuilder(false)}
          organizationID={organizationID}
          onTemplateCreated={(templateId) => {
            setShowTemplateBuilder(false);
            // Reload custom templates
            const loadCustomTemplates = async () => {
              try {
                const templates = await getWorkflowTemplates(organizationID);
                setCustomTemplates(templates);
              } catch (error) {
                console.error('Error loading custom templates:', error);
              }
            };
            loadCustomTemplates();
            onTemplateCreated?.(templateId);
          }}
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

  return ReactDOM.createPortal(modalContent, document.body);
};

export default WorkflowTemplateGallery;