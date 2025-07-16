// src/components/workflow/DeleteConfirmationModal.js
import React from 'react';
import ReactDOM from 'react-dom';
import { Trash2, AlertCircle } from 'lucide-react';

const DeleteConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  templateName, 
  loading = false 
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
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
          maxWidth: '450px',
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
              Delete Template
            </h3>
            <p style={{ 
              margin: '0.5rem 0 0 0', 
              fontSize: '0.875rem', 
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              This action cannot be undone
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ 
            margin: 0, 
            fontSize: '0.95rem', 
            color: '#374151',
            lineHeight: '1.5'
          }}>
            Are you sure you want to delete "<strong style={{ color: '#111827' }}>{templateName}</strong>"?
          </p>
          <p style={{ 
            margin: '0.75rem 0 0 0', 
            fontSize: '0.875rem', 
            color: '#6b7280',
            lineHeight: '1.4'
          }}>
            Any workflows created from this template will not be affected, but you won't be able to create new workflows from this template.
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
              transition: 'all 0.2s ease',
              ':hover': {
                backgroundColor: '#f9fafb'
              }
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
              minWidth: '120px',
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
            {loading ? 'Deleting...' : 'Delete Template'}
          </button>
        </div>
      </div>
    </div>
  );

  // Render directly to document.body to avoid z-index issues
  return ReactDOM.createPortal(modalContent, document.body);
};

export default DeleteConfirmationModal;