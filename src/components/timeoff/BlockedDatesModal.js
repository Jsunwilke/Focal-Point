// src/components/timeoff/BlockedDatesModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, Trash2 } from 'lucide-react';
import { 
  createBlockedDateRange, 
  getBlockedDates, 
  deleteBlockedDateRange 
} from '../../firebase/blockedDates';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Button from '../shared/Button';
import '../shared/Modal.css';
import './BlockedDatesModal.css';

const BlockedDatesModal = ({ isOpen, onClose, organization }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [blockedDates, setBlockedDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    allowHighPriority: false
  });
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);

  useEffect(() => {
    if (isOpen && organization) {
      loadBlockedDates();
    }
  }, [isOpen, organization]);

  const loadBlockedDates = async () => {
    try {
      const dates = await getBlockedDates(organization.id);
      setBlockedDates(dates);
    } catch (error) {
      console.error('Error loading blocked dates:', error);
      showToast('Error', 'Failed to load blocked dates', 'error');
    }
  };

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
    
    // Validation
    if (!formData.startDate || !formData.endDate) {
      setError('Please select both start and end dates');
      return;
    }
    
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setError('End date must be after start date');
      return;
    }
    
    if (!formData.reason.trim()) {
      setError('Please provide a reason');
      return;
    }

    setLoading(true);
    try {
      await createBlockedDateRange({
        organizationID: organization.id,
        startDate: new Date(formData.startDate + 'T00:00:00'),
        endDate: new Date(formData.endDate + 'T23:59:59'),
        reason: formData.reason.trim(),
        allowHighPriority: formData.allowHighPriority,
        createdBy: user.uid
      });

      showToast('Success', 'Blocked dates added successfully', 'success');
      
      // Reset form
      setFormData({
        startDate: '',
        endDate: '',
        reason: '',
        allowHighPriority: false
      });
      
      // Reload blocked dates
      await loadBlockedDates();
    } catch (error) {
      console.error('Error creating blocked dates:', error);
      setError('Failed to create blocked dates');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (blockedDate) => {
    setDeletingItem(blockedDate);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    
    setDeleting(deletingItem.id);
    setShowDeleteConfirm(false);
    
    try {
      await deleteBlockedDateRange(deletingItem.id);
      showToast('Success', 'Blocked dates removed successfully', 'success');
      await loadBlockedDates();
    } catch (error) {
      console.error('Error deleting blocked dates:', error);
      showToast('Error', 'Failed to delete blocked dates', 'error');
    } finally {
      setDeleting(null);
      setDeletingItem(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setDeletingItem(null);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="modal-overlay"
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
        className="modal modal--medium"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: '8px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          margin: 0,
          transform: 'none',
          width: '90%',
          maxWidth: '600px',
        }}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            <Calendar size={24} />
            Manage Blocked Dates
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {/* Add New Blocked Dates Form */}
          <form onSubmit={handleSubmit} className="blocked-dates-form">
            <h3 className="form-section-title">Add Blocked Date Range</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startDate">Start Date</label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="endDate">End Date</label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reason">Reason</label>
              <input
                type="text"
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                placeholder="e.g., Peak season, Holiday blackout"
                className="form-input"
              />
            </div>

            <div className="form-group toggle-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="allowHighPriority"
                  checked={formData.allowHighPriority}
                  onChange={handleInputChange}
                />
                <span className="checkbox-custom"></span>
                <span>Allow high priority override</span>
              </label>
              <p className="field-help">
                When enabled, users can request time off during this period by marking it as high priority
              </p>
            </div>

            {error && (
              <div className="form-error">{error}</div>
            )}

            <Button 
              type="submit" 
              variant="primary" 
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Blocked Dates'}
            </Button>
          </form>

          {/* Existing Blocked Dates List */}
          <div className="blocked-dates-list">
            <h3 className="list-title">Current Blocked Dates</h3>
            
            {blockedDates.length === 0 ? (
              <p className="empty-state">No blocked dates configured</p>
            ) : (
              <div className="blocked-dates-items">
                {blockedDates.map(blocked => (
                  <div key={blocked.id} className="blocked-date-item">
                    <div className="blocked-date-info">
                      <div className="blocked-date-dates">
                        {formatDate(blocked.startDate)} - {formatDate(blocked.endDate)}
                      </div>
                      <div className="blocked-date-reason">{blocked.reason}</div>
                      {blocked.allowHighPriority && (
                        <div className="blocked-date-override">
                          High priority override allowed
                        </div>
                      )}
                    </div>
                    <button
                      className="blocked-date-delete"
                      onClick={() => handleDeleteClick(blocked)}
                      disabled={deleting === blocked.id}
                      title="Delete blocked dates"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && deletingItem && (
          <div className="delete-confirm-overlay">
            <div className="delete-confirm-modal">
              <h3>Confirm Delete</h3>
              <p>Are you sure you want to delete this blocked date range?</p>
              <div className="delete-confirm-details">
                <strong>{formatDate(deletingItem.startDate)} - {formatDate(deletingItem.endDate)}</strong>
                <div className="delete-confirm-reason">{deletingItem.reason}</div>
              </div>
              <div className="delete-confirm-actions">
                <Button
                  variant="secondary"
                  onClick={handleDeleteCancel}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default BlockedDatesModal;