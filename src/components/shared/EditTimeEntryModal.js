// src/components/shared/EditTimeEntryModal.js
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
  updateTimeEntry,
  checkTimeOverlap
} from '../../firebase/firestore';
import { useDataCache } from '../../contexts/DataCacheContext';
import './EditTimeEntryModal.css';

const EditTimeEntryModal = ({ isOpen, onClose, onSuccess, timeEntry }) => {
  const { user, organization } = useAuth();
  const { addToast } = useToast();
  const { sessions: cachedSessions } = useDataCache();
  
  const [formData, setFormData] = useState({
    date: '',
    sessionId: '',
    clockInTime: '',
    clockOutTime: '',
    notes: ''
  });
  
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [overlapWarning, setOverlapWarning] = useState(null);

  // Initialize form data when modal opens or timeEntry changes
  useEffect(() => {
    if (isOpen && timeEntry) {
      const clockInDate = timeEntry.clockInTime?.toDate ? timeEntry.clockInTime.toDate() : new Date(timeEntry.clockInTime);
      const clockOutDate = timeEntry.clockOutTime?.toDate ? timeEntry.clockOutTime.toDate() : new Date(timeEntry.clockOutTime);
      
      setFormData({
        date: timeEntry.date,
        sessionId: timeEntry.sessionId || '',
        clockInTime: clockInDate.toTimeString().slice(0, 5), // HH:MM format
        clockOutTime: clockOutDate.toTimeString().slice(0, 5), // HH:MM format
        notes: timeEntry.notes || ''
      });
      setErrors({});
      setOverlapWarning(null);
    }
  }, [isOpen, timeEntry]);

  // Load sessions when date changes
  useEffect(() => {
    if (!user || !organization || !formData.date || !cachedSessions) {
      setSessions([]);
      return;
    }

    // Use cached sessions data instead of fetching from Firestore
    // Filter sessions for selected date and where user is assigned
    const dateSessions = cachedSessions.filter(session => {
      if (session.date !== formData.date) return false;
      
      // Check if user is assigned to this session
      // The cached sessions data already has photographerId field
      return session.photographerId === user.uid;
    });
    
    setSessions(dateSessions);
  }, [user, organization, formData.date, cachedSessions]);

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
        newErrors.date = 'Cannot edit entries for future dates';
      }
      
      // Check 30-day edit restriction
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (selectedDate < thirtyDaysAgo) {
        newErrors.date = 'Cannot edit entries older than 30 days';
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
    
    // Sanitize input to prevent XSS
    let sanitizedValue = value;
    if (name === 'notes') {
      // Basic XSS prevention - strip potentially dangerous characters
      sanitizedValue = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                           .replace(/javascript:/gi, '')
                           .replace(/on\w+="[^"]*"/gi, '');
      
      // Limit notes length
      if (sanitizedValue.length > 500) {
        sanitizedValue = sanitizedValue.substring(0, 500);
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: sanitizedValue
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
      // Check for time overlaps with other entries (excluding current entry)
      const clockInDateTime = new Date(`${formData.date}T${formData.clockInTime}`);
      const clockOutDateTime = new Date(`${formData.date}T${formData.clockOutTime}`);
      
      const overlapResult = await checkTimeOverlap(
        user.uid,
        organization.id,
        clockInDateTime,
        clockOutDateTime,
        timeEntry.id // Exclude current entry from overlap check
      );
      
      if (overlapResult.hasOverlap) {
        setOverlapWarning(`Time overlap detected with ${overlapResult.conflictCount} existing time ${overlapResult.conflictCount === 1 ? 'entry' : 'entries'}. Please adjust your times.`);
        setLoading(false);
        return;
      }

      // Create update data
      const updateData = {
        clockInTime: clockInDateTime,
        clockOutTime: clockOutDateTime,
        date: formData.date,
        notes: formData.notes || null
      };

      if (formData.sessionId) {
        updateData.sessionId = formData.sessionId;
      } else {
        updateData.sessionId = null;
      }

      await updateTimeEntry(timeEntry.id, updateData);
      
      // Safe toast call with fallback
      if (addToast && typeof addToast === 'function') {
        addToast('Time entry updated successfully!', 'success');
      } else {
      }
      
      onSuccess?.();
      onClose();
      
    } catch (error) {
      console.error('Error updating time entry:', error);
      
      // Safe toast call with fallback
      if (addToast && typeof addToast === 'function') {
        addToast(error.message || 'Failed to update time entry', 'error');
      } else {
        console.error('Failed to update time entry:', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceUpdate = async () => {
    setLoading(true);
    setOverlapWarning(null);
    
    try {
      const clockInDateTime = new Date(`${formData.date}T${formData.clockInTime}`);
      const clockOutDateTime = new Date(`${formData.date}T${formData.clockOutTime}`);
      
      const updateData = {
        clockInTime: clockInDateTime,
        clockOutTime: clockOutDateTime,
        date: formData.date,
        notes: formData.notes || null
      };

      if (formData.sessionId) {
        updateData.sessionId = formData.sessionId;
      } else {
        updateData.sessionId = null;
      }

      await updateTimeEntry(timeEntry.id, updateData);
      
      // Safe toast call with fallback
      if (addToast && typeof addToast === 'function') {
        addToast('Time entry updated successfully!', 'success');
      } else {
      }
      
      onSuccess?.();
      onClose();
      
    } catch (error) {
      console.error('Error force updating time entry:', error);
      
      // Safe toast call with fallback
      if (addToast && typeof addToast === 'function') {
        addToast(error.message || 'Failed to update time entry', 'error');
      } else {
        console.error('Failed to update time entry:', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    // Parse date string in local timezone to avoid UTC offset issues
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
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

  if (!isOpen || !timeEntry) return null;

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
        className="edit-time-entry-modal"
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
            <span>Edit Time Entry</span>
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

            {/* Overlap Warning */}
            {overlapWarning && (
              <div className="overlap-warning">
                <AlertCircle size={16} />
                <div className="warning-content">
                  <div className="warning-title">Time Overlap Detected</div>
                  <div className="warning-message">{overlapWarning}</div>
                  <div className="warning-actions">
                    <button
                      type="button"
                      className="warning-btn secondary"
                      onClick={() => setOverlapWarning(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="warning-btn primary"
                      onClick={handleForceUpdate}
                      disabled={loading}
                    >
                      Update Anyway
                    </button>
                  </div>
                </div>
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
          {!overlapWarning && (
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
                {loading ? 'Updating...' : 'Update Entry'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
};

export default EditTimeEntryModal;