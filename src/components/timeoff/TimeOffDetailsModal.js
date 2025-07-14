import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, Clock, User, FileText, AlertTriangle } from 'lucide-react';
import { cancelTimeOffRequest } from '../../firebase/timeOffRequests';
import Button from '../shared/Button';
import '../shared/Modal.css';
import './TimeOffDetailsModal.css';

const TimeOffDetailsModal = ({ isOpen, onClose, timeOffEntry, userProfile, onStatusChange }) => {
  const [loading, setLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (!isOpen || !timeOffEntry) return null;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const canModify = () => {
    // User can modify their own requests, or admins can modify any requests
    const isOwnRequest = timeOffEntry.photographerId === userProfile?.id;
    const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'manager' || userProfile?.role === 'owner';
    return isOwnRequest || isAdmin;
  };

  const handleCancel = async () => {
    if (!canModify()) return;
    
    setLoading(true);
    try {
      await cancelTimeOffRequest(timeOffEntry.sessionId);
      onStatusChange?.();
      onClose();
    } catch (error) {
      console.error('Error cancelling time off request:', error);
      alert('Failed to cancel time off request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!canModify()) return;
    
    setLoading(true);
    try {
      // For now, we'll use cancel function since delete doesn't exist
      // This sets status to 'cancelled' which effectively removes it from calendar
      await cancelTimeOffRequest(timeOffEntry.sessionId);
      onStatusChange?.();
      onClose();
      setShowConfirmDelete(false);
    } catch (error) {
      console.error('Error deleting time off request:', error);
      alert('Failed to delete time off request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'pending': return '#ffc107';
      case 'denied': return '#dc3545';
      case 'cancelled': return '#6c757d';
      default: return '#6c757d';
    }
  };

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
            <h2 className="modal__title">Time Off Details</h2>
          </div>
          <button className="modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal__body">
          <div className="time-off-details">
            {/* Status Badge */}
            <div className="detail-section">
              <div 
                className="status-badge" 
                style={{ backgroundColor: getStatusColor(timeOffEntry.status) }}
              >
                {timeOffEntry.status?.toUpperCase() || 'APPROVED'}
              </div>
            </div>

            {/* Date Information */}
            <div className="detail-section">
              <div className="detail-row">
                <Calendar size={16} />
                <div className="detail-content">
                  <div className="detail-label">Date</div>
                  <div className="detail-value">{formatDate(timeOffEntry.date)}</div>
                </div>
              </div>
            </div>

            {/* Time Information (if partial day) */}
            {timeOffEntry.isPartialDay && (
              <div className="detail-section">
                <div className="detail-row">
                  <Clock size={16} />
                  <div className="detail-content">
                    <div className="detail-label">Time Range</div>
                    <div className="detail-value">
                      {formatTime(timeOffEntry.startTime)} - {formatTime(timeOffEntry.endTime)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Photographer Information */}
            <div className="detail-section">
              <div className="detail-row">
                <User size={16} />
                <div className="detail-content">
                  <div className="detail-label">Photographer</div>
                  <div className="detail-value">{timeOffEntry.photographerName}</div>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="detail-section">
              <div className="detail-row">
                <FileText size={16} />
                <div className="detail-content">
                  <div className="detail-label">Reason</div>
                  <div className="detail-value">{timeOffEntry.reason}</div>
                </div>
              </div>
            </div>

            {/* Notes (if any) */}
            {timeOffEntry.notes && (
              <div className="detail-section">
                <div className="detail-row">
                  <FileText size={16} />
                  <div className="detail-content">
                    <div className="detail-label">Additional Notes</div>
                    <div className="detail-value">{timeOffEntry.notes}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Type Badge */}
            <div className="detail-section">
              <div className={`type-badge ${timeOffEntry.isPartialDay ? 'partial' : 'full'}`}>
                {timeOffEntry.isPartialDay ? 'Partial Day' : 'Full Day'}
              </div>
            </div>
          </div>

          {/* Confirmation Dialog */}
          {showConfirmDelete && (
            <div className="confirm-overlay">
              <div className="confirm-dialog">
                <div className="confirm-header">
                  <AlertTriangle size={24} color="#dc3545" />
                  <h3>Confirm Deletion</h3>
                </div>
                <p>Are you sure you want to delete this time off request? This action cannot be undone.</p>
                <div className="confirm-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setShowConfirmDelete(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    {loading ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {canModify() && (
          <div className="modal__actions">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Close
            </Button>
            {timeOffEntry.status === 'pending' ? (
              <Button
                type="button"
                variant="warning"
                onClick={handleCancel}
                disabled={loading}
              >
                {loading ? 'Cancelling...' : 'Cancel Request'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="danger"
                onClick={() => setShowConfirmDelete(true)}
                disabled={loading}
              >
                Delete Time Off
              </Button>
            )}
          </div>
        )}

        {!canModify() && (
          <div className="modal__actions">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default TimeOffDetailsModal;