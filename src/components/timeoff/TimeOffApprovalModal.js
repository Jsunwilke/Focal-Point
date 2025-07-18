// src/components/timeoff/TimeOffApprovalModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, 
  Calendar, 
  User, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  MessageSquare 
} from 'lucide-react';
import { 
  getTimeOffRequests, 
  approveTimeOffRequest, 
  denyTimeOffRequest 
} from '../../firebase/timeOffRequests';
import Button from '../shared/Button';
import '../shared/Modal.css';
import './TimeOffApprovalModal.css';

const TimeOffApprovalModal = ({ isOpen, onClose, userProfile, organization, onStatusChange }) => {
  const [activeTab, setActiveTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [denialReason, setDenialReason] = useState('');
  const [showDenialDialog, setShowDenialDialog] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadRequests();
    }
  }, [isOpen, activeTab]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const filters = activeTab === 'pending' ? { status: 'pending' } : {};
      const allRequests = await getTimeOffRequests(organization.id, filters);
      
      // Sort by date
      const sortedRequests = allRequests.sort((a, b) => {
        if (activeTab === 'pending') {
          return b.createdAt?.seconds - a.createdAt?.seconds;
        }
        return b.updatedAt?.seconds - a.updatedAt?.seconds;
      });

      setRequests(sortedRequests);
    } catch (error) {
      console.error('Error loading time off requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request) => {
    setProcessingId(request.id);
    try {
      await approveTimeOffRequest(
        request.id, 
        userProfile.id, 
        `${userProfile.firstName} ${userProfile.lastName}`
      );
      await loadRequests();
      onStatusChange?.();
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async () => {
    if (!denialReason.trim()) {
      alert('Please provide a reason for denial');
      return;
    }

    setProcessingId(showDenialDialog.id);
    try {
      await denyTimeOffRequest(
        showDenialDialog.id,
        userProfile.id,
        `${userProfile.firstName} ${userProfile.lastName}`,
        denialReason.trim()
      );
      setShowDenialDialog(null);
      setDenialReason('');
      await loadRequests();
      onStatusChange?.();
    } catch (error) {
      console.error('Error denying request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const calculateDays = (startDate, endDate, isPartialDay = false) => {
    if (isPartialDay) {
      return 'Partial day';
    }
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate.toDate ? endDate.toDate() : new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={16} className="status-icon approved" />;
      case 'denied':
        return <XCircle size={16} className="status-icon denied" />;
      default:
        return <Clock size={16} className="status-icon pending" />;
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
        className="modal modal--large time-off-approval-modal"
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">Time Off Requests</h2>
          </div>
          <button className="modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="approval-tabs">
          <button
            className={`approval-tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending ({requests.filter(r => r.status === 'pending').length})
          </button>
          <button
            className={`approval-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </div>

        <div className="approval-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <Calendar size={48} />
              <p>No {activeTab === 'pending' ? 'pending' : ''} time off requests</p>
            </div>
          ) : (
            <div className="requests-list">
              {requests.map(request => (
                <div key={request.id} className="request-card">
                  <div className="request-header">
                    <div className="request-photographer">
                      <User size={20} />
                      <div>
                        <h4>{request.photographerName}</h4>
                        <span className="photographer-email">{request.photographerEmail}</span>
                      </div>
                    </div>
                    {getStatusIcon(request.status)}
                  </div>

                  <div className="request-details">
                    <div className="detail-row">
                      <Calendar size={16} />
                      <span>
                        {request.isPartialDay ? (
                          <>
                            {formatDate(request.startDate)}
                            {request.startTime && request.endTime && (
                              <span> ({formatTime(request.startTime)} - {formatTime(request.endTime)})</span>
                            )}
                            <strong> (Partial day)</strong>
                          </>
                        ) : (
                          <>
                            {formatDate(request.startDate)} - {formatDate(request.endDate)}
                            <strong> ({calculateDays(request.startDate, request.endDate, request.isPartialDay)})</strong>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="detail-row">
                      <MessageSquare size={16} />
                      <span>Reason: <strong>{request.reason}</strong></span>
                    </div>
                    {request.notes && (
                      <div className="detail-row">
                        <span className="notes">Notes: {request.notes}</span>
                      </div>
                    )}
                  </div>

                  {request.status === 'pending' ? (
                    <div className="request-actions">
                      <Button
                        variant="success"
                        size="small"
                        onClick={() => handleApprove(request)}
                        disabled={processingId === request.id}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => setShowDenialDialog(request)}
                        disabled={processingId === request.id}
                      >
                        Deny
                      </Button>
                    </div>
                  ) : (
                    <div className="request-status">
                      {request.status === 'approved' && (
                        <span className="status-text approved">
                          Approved by {request.approverName} on {formatDate(request.approvedAt)}
                        </span>
                      )}
                      {request.status === 'denied' && (
                        <>
                          <span className="status-text denied">
                            Denied by {request.denierName} on {formatDate(request.deniedAt)}
                          </span>
                          {request.denialReason && (
                            <span className="denial-reason">
                              Reason: {request.denialReason}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Denial Dialog */}
      {showDenialDialog && (
        <div className="denial-dialog-overlay" onClick={() => setShowDenialDialog(null)}>
          <div className="denial-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Deny Time Off Request</h3>
            <p>Please provide a reason for denying this request:</p>
            <textarea
              value={denialReason}
              onChange={(e) => setDenialReason(e.target.value)}
              placeholder="Enter reason for denial..."
              rows={4}
              autoFocus
            />
            <div className="dialog-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDenialDialog(null);
                  setDenialReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeny}
                disabled={!denialReason.trim() || processingId === showDenialDialog.id}
              >
                Confirm Denial
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default TimeOffApprovalModal;