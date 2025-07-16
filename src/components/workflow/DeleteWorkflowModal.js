// src/components/workflow/DeleteWorkflowModal.js
import React from 'react';
import ReactDOM from 'react-dom';
import { Trash2, AlertCircle } from 'lucide-react';

const DeleteWorkflowModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  workflow,
  sessionData = {},
  loading = false 
}) => {
  if (!isOpen || !workflow) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  // Get workflow display information
  const getWorkflowDisplayInfo = () => {
    const session = sessionData[workflow.sessionId];
    
    if (workflow.workflowType === 'tracking') {
      return {
        title: workflow.schoolName || 'Unknown School',
        subtitle: 'Tracking Workflow',
        template: workflow.templateName || 'Unknown Template',
        date: workflow.trackingStartDate ? new Date(workflow.trackingStartDate).toLocaleDateString() : 'No date'
      };
    } else {
      return {
        title: session?.schoolName || 'Unknown School',
        subtitle: workflow.sessionType || session?.sessionTypes?.join(', ') || 'Unknown Type',
        template: workflow.templateName || 'Unknown Template',
        date: session?.date ? new Date(session.date).toLocaleDateString() : 'No date'
      };
    }
  };

  const displayInfo = getWorkflowDisplayInfo();

  const modalContent = (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10005, // Higher than other modals
        padding: '20px',
        backdropFilter: 'blur(2px)'
      }}
      onClick={handleBackdropClick}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '500px',
          padding: '2rem',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          transform: 'scale(1)',
          transition: 'all 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertCircle size={24} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: '#111827',
              lineHeight: '1.4'
            }}>
              Delete Workflow
            </h3>
            <p style={{ 
              margin: '0.5rem 0 0 0', 
              fontSize: '0.875rem', 
              color: '#ef4444',
              lineHeight: '1.4',
              fontWeight: '500'
            }}>
              This action cannot be undone
            </p>
          </div>
        </div>

        {/* Workflow Info */}
        <div style={{
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '0.5rem'
          }}>
            <div>
              <h4 style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: '600',
                color: '#111827'
              }}>
                {displayInfo.title}
              </h4>
              <p style={{
                margin: '0.25rem 0 0 0',
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                {displayInfo.subtitle}
              </p>
            </div>
            <span style={{
              backgroundColor: '#ddd6fe',
              color: '#7c3aed',
              padding: '0.25rem 0.75rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '500'
            }}>
              {workflow.status || 'Active'}
            </span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: '#6b7280'
          }}>
            <div>
              <strong>Template:</strong> {displayInfo.template}
            </div>
            <div>
              <strong>Date:</strong> {displayInfo.date}
            </div>
          </div>
        </div>

        {/* Warning Message */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ 
            margin: 0, 
            fontSize: '0.95rem', 
            color: '#374151',
            lineHeight: '1.5',
            marginBottom: '0.75rem'
          }}>
            Are you sure you want to permanently delete this workflow?
          </p>
          <p style={{ 
            margin: 0, 
            fontSize: '0.875rem', 
            color: '#ef4444',
            lineHeight: '1.4',
            fontWeight: '500'
          }}>
            All workflow progress and step data will be permanently lost.
          </p>
        </div>

        {/* Actions */}
        <div style={{ 
          display: 'flex', 
          gap: '0.75rem', 
          justifyContent: 'flex-end' 
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.625rem 1.25rem',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              color: '#374151',
              borderRadius: '0.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = '#f9fafb';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = 'white';
              }
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '0.625rem 1.25rem',
              border: 'none',
              backgroundColor: loading ? '#fca5a5' : '#ef4444',
              color: 'white',
              borderRadius: '0.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s ease',
              minWidth: '140px',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = '#dc2626';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = '#ef4444';
              }
            }}
          >
            <Trash2 size={16} />
            {loading ? 'Deleting...' : 'Delete Workflow'}
          </button>
        </div>
      </div>
    </div>
  );

  // Render directly to document.body to avoid z-index issues
  return ReactDOM.createPortal(modalContent, document.body);
};

export default DeleteWorkflowModal;