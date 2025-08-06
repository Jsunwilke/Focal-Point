// src/components/timeoff/TimeOffPartialApprovalModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, 
  Calendar, 
  CheckCircle, 
  XCircle,
  MessageSquare,
  AlertCircle,
  Clock
} from 'lucide-react';
import Button from '../shared/Button';
import '../shared/Modal.css';
import './TimeOffPartialApprovalModal.css';

// Utility function to get all dates between start and end
const getDatesBetween = (startDate, endDate) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

// Format date for display
const formatDateForDisplay = (date) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return {
    dayOfWeek: days[date.getDay()],
    date: `${months[date.getMonth()]} ${date.getDate()}`,
    year: date.getFullYear(),
    dateString: date.toISOString().split('T')[0]
  };
};

const TimeOffPartialApprovalModal = ({ 
  isOpen, 
  onClose, 
  request, 
  userProfile,
  onApprove 
}) => {
  const [dayStatuses, setDayStatuses] = useState({});
  const [denialReasons, setDenialReasons] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize day statuses when request changes
  useEffect(() => {
    if (request && isOpen) {
      const start = request.startDate.toDate ? request.startDate.toDate() : new Date(request.startDate);
      const end = request.endDate.toDate ? request.endDate.toDate() : new Date(request.endDate);
      const dates = getDatesBetween(start, end);
      
      const initialStatuses = {};
      const initialReasons = {};
      
      dates.forEach(date => {
        const dateStr = date.toISOString().split('T')[0];
        
        // Check if there's already a status for this day
        if (request.dayStatuses && request.dayStatuses[dateStr]) {
          initialStatuses[dateStr] = request.dayStatuses[dateStr].status;
          if (request.dayStatuses[dateStr].status === 'denied' && request.dayStatuses[dateStr].reason) {
            initialReasons[dateStr] = request.dayStatuses[dateStr].reason;
          }
        } else {
          initialStatuses[dateStr] = 'pending';
        }
      });
      
      setDayStatuses(initialStatuses);
      setDenialReasons(initialReasons);
    }
  }, [request, isOpen]);

  const handleStatusChange = (dateStr, status) => {
    setDayStatuses(prev => ({
      ...prev,
      [dateStr]: status
    }));
    
    // Clear denial reason if not denied
    if (status !== 'denied') {
      setDenialReasons(prev => {
        const newReasons = { ...prev };
        delete newReasons[dateStr];
        return newReasons;
      });
    }
  };

  const handleReasonChange = (dateStr, reason) => {
    setDenialReasons(prev => ({
      ...prev,
      [dateStr]: reason
    }));
  };

  const handleApproveAll = () => {
    const newStatuses = {};
    Object.keys(dayStatuses).forEach(date => {
      newStatuses[date] = 'approved';
    });
    setDayStatuses(newStatuses);
    setDenialReasons({});
  };

  const handleDenyAll = () => {
    const newStatuses = {};
    Object.keys(dayStatuses).forEach(date => {
      newStatuses[date] = 'denied';
    });
    setDayStatuses(newStatuses);
  };

  const validateForm = () => {
    // Check if any denied days are missing reasons
    for (const [date, status] of Object.entries(dayStatuses)) {
      if (status === 'denied' && !denialReasons[date]?.trim()) {
        setError(`Please provide a reason for denying ${formatDateForDisplay(new Date(date)).date}`);
        return false;
      }
    }
    
    // Check if at least one day has been reviewed
    const hasReviewed = Object.values(dayStatuses).some(status => status !== 'pending');
    if (!hasReviewed) {
      setError('Please review at least one day');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Prepare the day approvals data
      const dayApprovals = {};
      
      Object.entries(dayStatuses).forEach(([date, status]) => {
        if (status !== 'pending') {
          dayApprovals[date] = {
            status,
            ...(status === 'approved' && {
              approvedBy: userProfile.id,
              approverName: `${userProfile.firstName} ${userProfile.lastName}`,
              approvedAt: new Date()
            }),
            ...(status === 'denied' && {
              deniedBy: userProfile.id,
              denierName: `${userProfile.firstName} ${userProfile.lastName}`,
              deniedAt: new Date(),
              reason: denialReasons[date]
            })
          };
        }
      });
      
      await onApprove(request.id, dayApprovals);
      onClose();
    } catch (error) {
      console.error('Error submitting partial approval:', error);
      setError('Failed to submit approval. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !request) return null;

  const start = request.startDate.toDate ? request.startDate.toDate() : new Date(request.startDate);
  const end = request.endDate.toDate ? request.endDate.toDate() : new Date(request.endDate);
  const dates = getDatesBetween(start, end);

  // Count statuses
  const statusCounts = {
    approved: Object.values(dayStatuses).filter(s => s === 'approved').length,
    denied: Object.values(dayStatuses).filter(s => s === 'denied').length,
    pending: Object.values(dayStatuses).filter(s => s === 'pending').length
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
        zIndex: 10002,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="modal modal--large partial-approval-modal"
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxWidth: "800px"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">Review Time Off Request - Day by Day</h2>
            <p className="modal__subtitle">
              {request.photographerName} • {dates.length} days requested
            </p>
          </div>
          <button className="modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal__body" style={{ padding: '0', overflow: 'auto' }}>
          {error && (
            <div className="error-banner" style={{ margin: '16px 16px 0' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="request-summary" style={{ padding: '16px', borderBottom: '1px solid #e9ecef' }}>
            <div className="summary-row">
              <MessageSquare size={16} />
              <span>Reason: <strong>{request.reason}</strong></span>
            </div>
            {request.notes && (
              <div className="summary-row">
                <span>Notes: {request.notes}</span>
              </div>
            )}
          </div>

          <div className="status-summary" style={{ padding: '16px', background: '#f8f9fa' }}>
            <div className="status-counts">
              <span className="status-count approved">
                <CheckCircle size={16} />
                {statusCounts.approved} Approved
              </span>
              <span className="status-count denied">
                <XCircle size={16} />
                {statusCounts.denied} Denied
              </span>
              <span className="status-count pending">
                <Clock size={16} />
                {statusCounts.pending} Pending
              </span>
            </div>
          </div>

          <div className="bulk-actions" style={{ padding: '16px', borderBottom: '1px solid #e9ecef' }}>
            <Button
              variant="success"
              size="small"
              onClick={handleApproveAll}
              disabled={loading}
            >
              Approve All Days
            </Button>
            <Button
              variant="danger"
              size="small"
              onClick={handleDenyAll}
              disabled={loading}
              style={{ marginLeft: '8px' }}
            >
              Deny All Days
            </Button>
          </div>

          <div className="days-list" style={{ padding: '16px' }}>
            {dates.map((date, index) => {
              const dateInfo = formatDateForDisplay(date);
              const dateStr = dateInfo.dateString;
              const status = dayStatuses[dateStr] || 'pending';
              
              return (
                <div key={dateStr} className={`day-row ${status}`} style={{
                  padding: '12px',
                  marginBottom: index < dates.length - 1 ? '8px' : '0',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  background: status === 'approved' ? '#f0f9ff' : 
                           status === 'denied' ? '#fef2f2' : 
                           '#f8f9fa'
                }}>
                  <div className="day-info" style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: status === 'denied' ? '8px' : '0'
                  }}>
                    <div>
                      <Calendar size={16} style={{ display: 'inline', marginRight: '8px' }} />
                      <strong>{dateInfo.dayOfWeek}, {dateInfo.date}</strong>
                    </div>
                    
                    <div className="day-actions" style={{ display: 'flex', gap: '8px' }}>
                      <Button
                        variant={status === 'approved' ? 'success' : 'secondary'}
                        size="small"
                        onClick={() => handleStatusChange(dateStr, 'approved')}
                        disabled={loading}
                      >
                        <CheckCircle size={14} style={{ marginRight: '4px' }} />
                        Approve
                      </Button>
                      <Button
                        variant={status === 'denied' ? 'danger' : 'secondary'}
                        size="small"
                        onClick={() => handleStatusChange(dateStr, 'denied')}
                        disabled={loading}
                      >
                        <XCircle size={14} style={{ marginRight: '4px' }} />
                        Deny
                      </Button>
                      {status !== 'pending' && (
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => handleStatusChange(dateStr, 'pending')}
                          disabled={loading}
                          title="Reset to pending"
                        >
                          <Clock size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {status === 'denied' && (
                    <div className="denial-reason-input" style={{ marginTop: '8px' }}>
                      <input
                        type="text"
                        placeholder="Reason for denial (required)"
                        value={denialReasons[dateStr] || ''}
                        onChange={(e) => handleReasonChange(dateStr, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          border: '1px solid #dc3545',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal__footer" style={{ 
          padding: '16px',
          borderTop: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px'
        }}>
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
            disabled={loading || Object.values(dayStatuses).every(s => s === 'pending')}
          >
            {loading ? 'Submitting...' : 'Submit Review'}
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default TimeOffPartialApprovalModal;