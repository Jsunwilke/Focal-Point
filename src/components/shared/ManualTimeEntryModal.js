// src/components/shared/ManualTimeEntryModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, 
  Clock, 
  Calendar,
  MapPin,
  Save,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  createManualTimeEntry,
  getSessions
} from '../../firebase/firestore';
import './ManualTimeEntryModal.css';

const ManualTimeEntryModal = ({ isOpen, onClose, onSuccess }) => {
  const { user, organization } = useAuth();
  const { addToast } = useToast();
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    sessionId: '',
    clockInTime: '09:00',
    clockOutTime: '17:00',
    notes: ''
  });
  
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        sessionId: '',
        clockInTime: '09:00',
        clockOutTime: '17:00',
        notes: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  // Load sessions when date changes
  useEffect(() => {
    const loadSessions = async () => {
      if (!user || !organization || !formData.date) return;

      try {
        const sessionsData = await getSessions(organization.id);
        // Filter sessions for selected date and where user is assigned
        const dateSessions = sessionsData.filter(session => {
          if (session.date !== formData.date) return false;
          
          // Check if user is assigned to this session
          if (session.photographers && Array.isArray(session.photographers)) {
            return session.photographers.some(photographer => photographer.id === user.uid);
          } else if (session.photographer) {
            return session.photographer.id === user.uid;
          }
          
          return false;
        });
        
        setSessions(dateSessions);
      } catch (error) {
        console.error('Error loading sessions:', error);
      }
    };

    loadSessions();
  }, [user, organization, formData.date]);

  const validateForm = () => {
    const newErrors = {};

    // Date validation
    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      if (selectedDate > today) {
        newErrors.date = 'Cannot create entries for future dates';
      }
    }

    // Time validation
    if (!formData.clockInTime) {
      newErrors.clockInTime = 'Clock in time is required';
    }
    
    if (!formData.clockOutTime) {
      newErrors.clockOutTime = 'Clock out time is required';
    }

    if (formData.clockInTime && formData.clockOutTime) {
      const clockIn = new Date(`${formData.date}T${formData.clockInTime}`);
      const clockOut = new Date(`${formData.date}T${formData.clockOutTime}`);
      
      if (clockOut <= clockIn) {
        newErrors.clockOutTime = 'Clock out time must be after clock in time';
      }

      // Check for reasonable work hours (not more than 16 hours)
      const diffHours = (clockOut - clockIn) / (1000 * 60 * 60);
      if (diffHours > 16) {
        newErrors.clockOutTime = 'Work session cannot exceed 16 hours';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Create manual time entry data
      const clockInDateTime = new Date(`${formData.date}T${formData.clockInTime}`);
      const clockOutDateTime = new Date(`${formData.date}T${formData.clockOutTime}`);
      
      const timeEntryData = {
        userId: user.uid,
        organizationID: organization.id,
        clockInTime: clockInDateTime,
        clockOutTime: clockOutDateTime,
        date: formData.date,
        status: 'clocked-out',
        notes: formData.notes || null
      };

      if (formData.sessionId) {
        timeEntryData.sessionId = formData.sessionId;
      }

      await createManualTimeEntry(timeEntryData);
      
      addToast('Manual time entry created successfully!', 'success');
      onSuccess?.();
      onClose();
      
    } catch (error) {
      console.error('Error creating manual time entry:', error);
      addToast(error.message || 'Failed to create time entry', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { 
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    });
  };

  const calculateDuration = () => {
    if (formData.clockInTime && formData.clockOutTime) {
      const clockIn = new Date(`${formData.date}T${formData.clockInTime}`);
      const clockOut = new Date(`${formData.date}T${formData.clockOutTime}`);
      
      if (clockOut > clockIn) {
        const diffMs = clockOut - clockIn;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours === 0) {
          return `${minutes}m`;
        } else if (minutes === 0) {
          return `${hours}h`;
        } else {
          return `${hours}h ${minutes}m`;
        }
      }
    }
    return '';
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
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
        zIndex: 10001,
      }}
      onClick={onClose}
    >
      <div 
        className="manual-time-entry-modal"
        style={{
          position: 'relative',
          margin: 0,
          transform: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Clock size={24} />
            <span>Manual Time Entry</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="modal-content">
          {/* Date Selection */}
          <div className="form-section">
            <div className="form-group">
              <label>Date *</label>
              <div className="date-input-group">
                <Calendar size={16} />
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  max={new Date().toISOString().split('T')[0]}
                  className={errors.date ? 'error' : ''}
                  required
                />
              </div>
              {errors.date && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  <span>{errors.date}</span>
                </div>
              )}
              {formData.date && (
                <div className="date-preview">
                  {formatDate(formData.date)}
                </div>
              )}
            </div>
          </div>

          {/* Session Selection */}
          <div className="form-section">
            <div className="form-group">
              <label>Session (Optional)</label>
              <div className="select-input-group">
                <MapPin size={16} />
                <select
                  name="sessionId"
                  value={formData.sessionId}
                  onChange={handleInputChange}
                >
                  <option value="">No specific session</option>
                  {sessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {session.schoolName} - {session.sessionType} ({session.startTime}-{session.endTime})
                    </option>
                  ))}
                </select>
              </div>
              {sessions.length === 0 && formData.date && (
                <div className="info-message">
                  No sessions assigned to you for this date
                </div>
              )}
            </div>
          </div>

          {/* Time Inputs */}
          <div className="form-section">
            <div className="time-inputs-grid">
              <div className="form-group">
                <label>Clock In Time *</label>
                <input
                  type="time"
                  name="clockInTime"
                  value={formData.clockInTime}
                  onChange={handleInputChange}
                  className={errors.clockInTime ? 'error' : ''}
                  required
                />
                {errors.clockInTime && (
                  <div className="error-message">
                    <AlertCircle size={14} />
                    <span>{errors.clockInTime}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Clock Out Time *</label>
                <input
                  type="time"
                  name="clockOutTime"
                  value={formData.clockOutTime}
                  onChange={handleInputChange}
                  className={errors.clockOutTime ? 'error' : ''}
                  required
                />
                {errors.clockOutTime && (
                  <div className="error-message">
                    <AlertCircle size={14} />
                    <span>{errors.clockOutTime}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Duration Display */}
            {calculateDuration() && (
              <div className="duration-display">
                <Clock size={16} />
                <span>Duration: {calculateDuration()}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="form-section">
            <div className="form-group">
              <label>Notes (Optional)</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Add any notes about this work session..."
                rows={3}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={loading}
            >
              <Save size={16} />
              {loading ? 'Creating...' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ManualTimeEntryModal;