import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, Clock, User, FileText, AlertTriangle, RotateCcw } from 'lucide-react';
import { cancelTimeOffRequest, revertTimeOffRequestStatus } from '../../firebase/timeOffRequests';
import Button from '../shared/Button';
import '../shared/Modal.css';
import './TimeOffDetailsModal.css';

// Utility function to get day of week abbreviation
const getDayOfWeek = (dateStr) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const date = new Date(dateStr);
  return days[date.getDay()];
};

const TimeOffDetailsModal = ({ isOpen, onClose, timeOffEntry, userProfile, onStatusChange }) => {
  const [loading, setLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);

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

  const formatDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startFormatted = start.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const endFormatted = end.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Calculate number of days
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    const startDay = getDayOfWeek(startDate);
    const endDay = getDayOfWeek(endDate);
    
    if (diffDays === 1) {
      return `${startFormatted} (${startDay})`;
    }
    
    return `${startFormatted} - ${endFormatted} (${diffDays} days, ${startDay}-${endDay})`;
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

  const canUndoStatus = () => {
    // Only admins can undo, and only for approved/denied requests within 24 hours
    const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'manager' || userProfile?.role === 'owner';
    if (!isAdmin) return false;
    
    if (timeOffEntry.status !== 'approved' && timeOffEntry.status !== 'denied') return false;
    
    const statusTimestamp = timeOffEntry.status === 'approved' ? timeOffEntry.approvedAt : timeOffEntry.deniedAt;
    if (!statusTimestamp) return false;
    
    const statusDate = statusTimestamp.toDate ? statusTimestamp.toDate() : new Date(statusTimestamp);
    const hoursSinceStatus = (Date.now() - statusDate.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceStatus <= 24; // Allow undo within 24 hours
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

  const handleUndoStatus = async () => {
    if (!canUndoStatus()) return;

    setLoading(true);
    try {
      await revertTimeOffRequestStatus(
        timeOffEntry.sessionId || timeOffEntry.id,
        userProfile.id,
        `${userProfile.firstName} ${userProfile.lastName}`
      );
      onStatusChange?.();
      onClose();
      setShowUndoConfirm(false);
    } catch (error) {
      console.error('Error reverting time off request status:', error);
      alert('Failed to undo status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'pending': return '#ffc107';
      case 'under_review': return '#17a2b8';
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
                  <div className="detail-value">{formatDate(timeOffEntry.date)} ({getDayOfWeek(timeOffEntry.date)})</div>
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

          {/* Undo Confirmation Dialog */}
          {showUndoConfirm && (
            <div className="confirm-overlay">
              <div className="confirm-dialog">
                <div className="confirm-header">
                  <RotateCcw size={24} color="#ffc107" />
                  <h3>Undo {timeOffEntry.status === 'approved' ? 'Approval' : 'Denial'}</h3>
                </div>
                <p>
                  Are you sure you want to undo this {timeOffEntry.status === 'approved' ? 'approval' : 'denial'}? 
                  The request will be moved back to "Under Review" status.
                </p>
                {timeOffEntry.status === 'approved' && (
                  <p style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                    Note: This action will not automatically notify the photographer. You may need to inform them separately.
                  </p>
                )}
                <div className="confirm-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setShowUndoConfirm(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="warning"
                    onClick={handleUndoStatus}
                    disabled={loading}
                  >
                    <RotateCcw size={16} style={{ marginRight: '4px' }} />
                    {loading ? 'Undoing...' : 'Undo Status'}
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
            {canUndoStatus() && (
              <Button
                type="button"
                variant="warning"
                onClick={() => setShowUndoConfirm(true)}
                disabled={loading}
                title="Undo this action and return to Under Review"
              >
                <RotateCcw size={16} style={{ marginRight: '4px' }} />
                Undo {timeOffEntry.status === 'approved' ? 'Approval' : 'Denial'}
              </Button>
            )}
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