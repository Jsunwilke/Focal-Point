// src/components/mileage/EditMileageModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, 
  Navigation, 
  Calendar,
  MapPin,
  Save,
  AlertCircle,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { updateDailyJobReport } from '../../firebase/firestore';
import Button from '../shared/Button';
import './EditMileageModal.css';

const EditMileageModal = ({ isOpen, onClose, onSuccess, jobReport, mileageRate }) => {
  const { user, organization } = useAuth();
  const { addToast } = useToast();
  
  const [formData, setFormData] = useState({
    totalMileage: '',
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Initialize form data when modal opens or jobReport changes
  useEffect(() => {
    if (isOpen && jobReport) {
      setFormData({
        totalMileage: jobReport.totalMileage?.toString() || '',
        notes: jobReport.notes || ''
      });
      setErrors({});
    }
  }, [isOpen, jobReport]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        totalMileage: '',
        notes: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors = {};
    
    // Validate mileage
    const mileage = parseFloat(formData.totalMileage);
    if (!formData.totalMileage || formData.totalMileage.trim() === '') {
      newErrors.totalMileage = 'Mileage is required';
    } else if (isNaN(mileage) || mileage < 0) {
      newErrors.totalMileage = 'Mileage must be a positive number';
    } else if (mileage > 1000) {
      newErrors.totalMileage = 'Mileage seems unusually high (over 1000 miles)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const updatedData = {
        totalMileage: parseFloat(formData.totalMileage),
        notes: formData.notes.trim()
      };
      
      await updateDailyJobReport(jobReport.id, updatedData);
      
      addToast({
        type: 'success',
        message: 'Mileage updated successfully'
      });
      
      // Call success callback to refresh data
      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (error) {
      console.error('Error updating mileage:', error);
      addToast({
        type: 'error',
        message: 'Failed to update mileage. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateCompensation = () => {
    const mileage = parseFloat(formData.totalMileage) || 0;
    const rate = mileageRate || 0;
    return (mileage * rate).toFixed(2);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="modal-overlay"
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
        zIndex: 10001
      }}
      onClick={onClose}
    >
      <div 
        className="edit-mileage-modal"
        style={{
          position: 'relative',
          margin: 0,
          transform: 'none'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            <Navigation size={20} />
            Edit Mileage
          </h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Job Information */}
          <div className="job-info">
            <div className="job-info-item">
              <Calendar size={16} />
              <span>{formatDate(jobReport?.date)}</span>
            </div>
            <div className="job-info-item">
              <MapPin size={16} />
              <span>{jobReport?.schoolOrDestination || 'Unknown Location'}</span>
            </div>
            <div className="job-info-item">
              <DollarSign size={16} />
              <span>${mileageRate?.toFixed(2) || '0.00'} per mile</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="edit-mileage-form">
            <div className="form-group">
              <label htmlFor="totalMileage" className="form-label">
                <Navigation size={16} />
                Total Mileage
              </label>
              <input
                type="number"
                id="totalMileage"
                name="totalMileage"
                value={formData.totalMileage}
                onChange={handleInputChange}
                className={`form-input ${errors.totalMileage ? 'error' : ''}`}
                placeholder="Enter total miles"
                step="0.1"
                min="0"
                max="1000"
              />
              {errors.totalMileage && (
                <div className="error-message">
                  <AlertCircle size={16} />
                  {errors.totalMileage}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="notes" className="form-label">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className="form-input form-textarea"
                placeholder="Add any notes about this mileage..."
                rows="3"
              />
            </div>

            {/* Compensation Preview */}
            <div className="compensation-preview">
              <div className="compensation-item">
                <span className="label">Miles:</span>
                <span className="value">{formData.totalMileage || '0'}</span>
              </div>
              <div className="compensation-item">
                <span className="label">Rate:</span>
                <span className="value">${mileageRate?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="compensation-item total">
                <span className="label">Total Compensation:</span>
                <span className="value">${calculateCompensation()}</span>
              </div>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || !formData.totalMileage}
            loading={loading}
          >
            <Save size={16} />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default EditMileageModal;