// src/components/timeoff/TimeOffRequestModal.js
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, AlertCircle, Clock } from 'lucide-react';
import { createTimeOffRequest, checkTimeOffConflicts } from '../../firebase/timeOffRequests';
import Button from '../shared/Button';
import '../shared/Modal.css';
import './TimeOffRequestModal.css';

const TimeOffRequestModal = ({ isOpen, onClose, userProfile, organization }) => {
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    notes: '',
    isPartialDay: false,
    startTime: '09:00',
    endTime: '17:00'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  const handleDateChange = async (e) => {
    handleInputChange(e);
    
    // Check for conflicts when both dates are selected
    if (formData.startDate && formData.endDate || 
        (e.target.name === 'startDate' && formData.endDate) ||
        (e.target.name === 'endDate' && formData.startDate)) {
      
      setCheckingConflicts(true);
      try {
        const start = new Date(e.target.name === 'startDate' ? e.target.value : formData.startDate);
        const end = new Date(e.target.name === 'endDate' ? e.target.value : formData.endDate);
        
        const conflictingSessions = await checkTimeOffConflicts(
          organization.id,
          userProfile.id,
          start,
          end
        );
        
        setConflicts(conflictingSessions);
      } catch (error) {
        console.error('Error checking conflicts:', error);
      } finally {
        setCheckingConflicts(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.startDate) {
      setError('Please select a start date');
      return;
    }
    
    if (!formData.isPartialDay && !formData.endDate) {
      setError('Please select an end date');
      return;
    }
    
    if (!formData.reason.trim()) {
      setError('Please provide a reason for your time off request');
      return;
    }
    
    const startDate = new Date(formData.startDate);
    const endDate = formData.isPartialDay ? new Date(formData.startDate) : new Date(formData.endDate);
    
    if (!formData.isPartialDay && startDate > endDate) {
      setError('End date must be after start date');
      return;
    }
    
    if (startDate < new Date().setHours(0, 0, 0, 0)) {
      setError('Start date cannot be in the past');
      return;
    }
    
    // Validate times for partial day requests
    if (formData.isPartialDay) {
      if (!formData.startTime || !formData.endTime) {
        setError('Please specify both start and end times');
        return;
      }
      
      const startTimeDate = new Date(`2000-01-01T${formData.startTime}`);
      const endTimeDate = new Date(`2000-01-01T${formData.endTime}`);
      
      if (startTimeDate >= endTimeDate) {
        setError('End time must be after start time');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const requestData = {
        organizationID: organization.id,
        photographerId: userProfile.id,
        photographerName: `${userProfile.firstName} ${userProfile.lastName}`,
        photographerEmail: userProfile.email,
        startDate: startDate,
        endDate: endDate,
        reason: formData.reason.trim(),
        notes: formData.notes.trim(),
        isPartialDay: formData.isPartialDay,
        ...(formData.isPartialDay && {
          startTime: formData.startTime,
          endTime: formData.endTime
        })
      };

      await createTimeOffRequest(requestData);
      
      // Reset form and close modal
      setFormData({
        startDate: '',
        endDate: '',
        reason: '',
        notes: '',
        isPartialDay: false,
        startTime: '09:00',
        endTime: '17:00'
      });
      setConflicts([]);
      onClose();
    } catch (error) {
      console.error('Error creating time off request:', error);
      setError('Failed to submit time off request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="modal modal--medium"
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">Request Time Off</h2>
          </div>
          <button className="modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal__body">
          <form onSubmit={handleSubmit} className="time-off-form">
            {/* Partial Day Toggle - moved to top */}
            <div className="form-group partial-day-toggle">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="isPartialDay"
                  checked={formData.isPartialDay}
                  onChange={(e) => {
                    handleInputChange(e);
                    // Set end date same as start date for partial day
                    if (e.target.checked && formData.startDate) {
                      setFormData(prev => ({
                        ...prev,
                        endDate: prev.startDate,
                        isPartialDay: true
                      }));
                    }
                  }}
                />
                <span className="checkbox-custom"></span>
                Partial day only (specify time range)
              </label>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startDate">
                  <Calendar size={16} />
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleDateChange}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              {!formData.isPartialDay && (
                <div className="form-group">
                  <label htmlFor="endDate">
                    <Calendar size={16} />
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleDateChange}
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              )}
            </div>

            {/* Time Range for Partial Day */}
            {formData.isPartialDay && (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="startTime">
                    <Clock size={16} />
                    Start Time
                  </label>
                  <input
                    type="time"
                    id="startTime"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="endTime">
                    <Clock size={16} />
                    End Time
                  </label>
                  <input
                    type="time"
                    id="endTime"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="reason">Reason *</label>
              <select
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                required
              >
                <option value="">Select a reason</option>
                <option value="Vacation">Vacation</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Personal Day">Personal Day</option>
                <option value="Family Emergency">Family Emergency</option>
                <option value="Medical Appointment">Medical Appointment</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Additional Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                placeholder="Any additional information..."
              />
            </div>

            {/* Conflict Warning */}
            {conflicts.length > 0 && (
              <div className="conflict-warning">
                <AlertCircle size={20} />
                <div>
                  <strong>Warning: You have {conflicts.length} scheduled session{conflicts.length > 1 ? 's' : ''} during this period.</strong>
                  <p>Your manager will need to reassign these sessions if your request is approved.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="error-message">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </form>
        </div>

        <div className="modal__actions">
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
            disabled={loading || checkingConflicts}
            onClick={handleSubmit}
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default TimeOffRequestModal;