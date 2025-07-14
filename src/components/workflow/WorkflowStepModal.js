// src/components/workflow/WorkflowStepModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Clock, User, CheckCircle, FileText, Upload, Save } from 'lucide-react';
import { 
  updateWorkflowStep, 
  completeWorkflowStep, 
  assignWorkflowStep,
  getTeamMembers 
} from '../../firebase/firestore';
import { useToast } from '../../contexts/ToastContext';

const WorkflowStepModal = ({
  isOpen,
  onClose,
  workflow,
  template,
  stepId,
  currentUser,
  organizationID,
  onStepUpdated
}) => {
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [formData, setFormData] = useState({
    notes: '',
    files: [],
    assignedTo: ''
  });
  const { showToast } = useToast();

  // Get step and template data
  const step = template?.steps?.find(s => s.id === stepId);
  const stepProgress = workflow?.stepProgress?.[stepId];

  useEffect(() => {
    const loadTeamMembers = async () => {
      if (isOpen && organizationID) {
        try {
          const members = await getTeamMembers(organizationID);
          setTeamMembers(members.filter(m => m.isActive));
        } catch (error) {
          console.error('Error loading team members:', error);
        }
      }
    };
    loadTeamMembers();
  }, [isOpen, organizationID]);

  useEffect(() => {
    if (isOpen && stepProgress) {
      setFormData({
        notes: stepProgress.notes || '',
        files: stepProgress.files || [],
        assignedTo: stepProgress.assignedTo || ''
      });
    }
  }, [isOpen, stepProgress]);

  if (!isOpen || !step) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProgress = async () => {
    setLoading(true);
    try {
      await updateWorkflowStep(workflow.id, stepId, {
        notes: formData.notes,
        files: formData.files,
        status: 'in_progress',
        updatedBy: currentUser.id
      });

      // Handle assignment change
      if (formData.assignedTo !== stepProgress?.assignedTo) {
        await assignWorkflowStep(workflow.id, stepId, formData.assignedTo);
        
        // Show assignment notification
        const assignedMember = teamMembers.find(m => m.id === formData.assignedTo);
        if (assignedMember) {
          showToast(
            'Step Assigned',
            `${step.title} assigned to ${assignedMember.firstName} ${assignedMember.lastName}`,
            'success'
          );
        }
      }

      showToast('Progress Saved', 'Step progress has been saved', 'success');
      onStepUpdated?.();
    } catch (error) {
      console.error('Error saving step progress:', error);
      showToast('Error', 'Failed to save progress', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteStep = async () => {
    setLoading(true);
    try {
      await completeWorkflowStep(workflow.id, stepId, {
        userId: currentUser.id,
        notes: formData.notes,
        files: formData.files
      });

      showToast(
        'Step Completed', 
        `${step.title} has been marked as complete`, 
        'success'
      );
      
      onStepUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error completing step:', error);
      showToast('Error', 'Failed to complete step', 'error');
    } finally {
      setLoading(false);
    }
  };

  const canComplete = stepProgress?.assignedTo === currentUser.id || 
                     currentUser.role === 'admin';
  const canAssign = currentUser.role === 'admin' || currentUser.role === 'manager';

  const getStepTypeIcon = (type) => {
    switch (type) {
      case 'task': return '📋';
      case 'approval': return '✅';
      case 'notification': return '📧';
      case 'delay': return '⏰';
      default: return '📋';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#f59e0b';
      case 'overdue': return '#ef4444';
      default: return '#6b7280';
    }
  };

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
          width: '90%',
          maxWidth: '600px',
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
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f9fafb'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{getStepTypeIcon(step.type)}</span>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
                {step.title}
              </h2>
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginTop: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: getStatusColor(stepProgress?.status) + '20',
                color: getStatusColor(stepProgress?.status),
                fontSize: '0.75rem',
                fontWeight: '500',
                textTransform: 'uppercase'
              }}>
                {stepProgress?.status?.replace('_', ' ') || 'pending'}
              </span>
              {step.estimatedHours && (
                <>
                  <Clock size={14} />
                  <span>{step.estimatedHours}h estimated</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              color: '#6b7280',
              borderRadius: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
          {/* Step Description */}
          {step.description && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                DESCRIPTION
              </h4>
              <p style={{ margin: 0, color: '#6b7280', lineHeight: '1.5' }}>
                {step.description}
              </p>
            </div>
          )}

          {/* Assignment Section */}
          {canAssign && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem', 
                fontWeight: '600', 
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                <User size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                ASSIGNED TO
              </label>
              <select
                value={formData.assignedTo}
                onChange={(e) => handleInputChange('assignedTo', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              >
                <option value="">Select team member...</option>
                {teamMembers.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName} ({member.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Current Assignment Display */}
          {!canAssign && stepProgress?.assignedTo && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                <User size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                ASSIGNED TO
              </h4>
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#f3f4f6',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}>
                {teamMembers.find(m => m.id === stepProgress.assignedTo)?.firstName} {teamMembers.find(m => m.id === stepProgress.assignedTo)?.lastName || 'Unknown User'}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              <FileText size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
              NOTES
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Add notes about this step..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                resize: 'vertical',
                minHeight: '100px'
              }}
            />
          </div>

          {/* File Requirements */}
          {step.files?.required?.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                <Upload size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                REQUIRED FILES
              </h4>
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#fef3c7',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}>
                {step.files.required.map((fileType, index) => (
                  <div key={index}>• {fileType.replace('_', ' ')}</div>
                ))}
              </div>
            </div>
          )}

          {/* Progress History */}
          {stepProgress?.updatedAt && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                LAST UPDATED
              </h4>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {new Date(stepProgress.updatedAt.toDate()).toLocaleString()}
                {stepProgress.updatedBy && ` by ${stepProgress.updatedBy}`}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          backgroundColor: '#f9fafb'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              color: '#374151',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Cancel
          </button>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleSaveProgress}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                backgroundColor: '#6b7280',
                color: 'white',
                borderRadius: '0.375rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                opacity: loading ? 0.7 : 1
              }}
            >
              <Save size={16} />
              Save Progress
            </button>
            
            {canComplete && stepProgress?.status !== 'completed' && (
              <button
                onClick={handleCompleteStep}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  backgroundColor: '#10b981',
                  color: 'white',
                  borderRadius: '0.375rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: loading ? 0.7 : 1
                }}
              >
                <CheckCircle size={16} />
                Complete Step
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default WorkflowStepModal;