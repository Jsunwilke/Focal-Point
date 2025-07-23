// src/components/timeoff/QuickBlockDateModal.js
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { createBlockedDateRange } from '../../firebase/blockedDates';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Button from '../shared/Button';

const QuickBlockDateModal = ({ isOpen, onClose, selectedDate, organization }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    reason: '',
    allowHighPriority: false
  });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.reason.trim()) {
      setError('Please provide a reason');
      return;
    }

    setLoading(true);
    try {
      // Set start of day and end of day for the selected date
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      await createBlockedDateRange({
        organizationID: organization.id,
        startDate: startDate,
        endDate: endDate,
        reason: formData.reason.trim(),
        allowHighPriority: formData.allowHighPriority,
        createdBy: user.uid
      });

      showToast('Success', 'Date blocked successfully', 'success');
      
      // Reset form
      setFormData({
        reason: '',
        allowHighPriority: false
      });
      
      onClose();
    } catch (error) {
      console.error('Error blocking date:', error);
      setError('Failed to block date');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !selectedDate) return null;

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '350px',
          margin: 0,
          transform: 'none',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #e9ecef'
        }}>
          <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 600 }}>Block Date</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              color: '#6c757d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '0.75rem 1rem' }}>
          <form onSubmit={handleSubmit}>
            {/* Date Display */}
            <div style={{ 
              marginBottom: '0.5rem', 
              padding: '0.25rem', 
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              textAlign: 'center',
              fontSize: '0.85rem',
              fontWeight: '500'
            }}>
              {formatDate(selectedDate)}
            </div>

            {/* Reason Input */}
            <div style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="reason" style={{ fontSize: '0.8rem', marginBottom: '0.2rem', display: 'block' }}>Reason *</label>
              <input
                type="text"
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                placeholder="e.g., Holiday, Peak season"
                style={{ 
                  width: '100%',
                  padding: '0.3rem 0.5rem', 
                  fontSize: '0.8rem', 
                  height: '28px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
            </div>

            {/* Allow High Priority Toggle */}
            <div style={{ marginBottom: '0' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                cursor: 'pointer', 
                fontSize: '0.8rem' 
              }}>
                <input
                  type="checkbox"
                  name="allowHighPriority"
                  checked={formData.allowHighPriority}
                  onChange={handleInputChange}
                  style={{ display: 'none' }}
                />
                <span style={{
                  width: '36px',
                  height: '20px',
                  backgroundColor: formData.allowHighPriority ? '#007bff' : '#ccc',
                  borderRadius: '10px',
                  position: 'relative',
                  transition: 'background-color 0.3s',
                  flexShrink: 0,
                  display: 'block'
                }}>
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    left: formData.allowHighPriority ? '18px' : '2px',
                    width: '16px',
                    height: '16px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: 'left 0.3s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}></span>
                </span>
                <span>Allow high priority override</span>
              </label>
              {formData.allowHighPriority && (
                <p style={{ 
                  marginTop: '0.2rem', 
                  marginLeft: '2.5rem', 
                  fontSize: '0.7rem', 
                  lineHeight: '1.2',
                  color: '#6c757d',
                  margin: '0.2rem 0 0 2.5rem'
                }}>
                  Users can override by marking as high priority
                </p>
              )}
            </div>

            {error && (
              <div style={{ 
                marginTop: '0.3rem', 
                fontSize: '0.75rem', 
                padding: '0.2rem 0',
                color: '#dc3545'
              }}>
                {error}
              </div>
            )}
          </form>
        </div>

        <div style={{ 
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem', 
          borderTop: '1px solid #e9ecef'
        }}>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Blocking...' : 'Block Date'}
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default QuickBlockDateModal;