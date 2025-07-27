import React, { useState, useEffect } from 'react';
import { Package, Check } from 'lucide-react';
import { JOB_BOX_STATUSES, resolveUserName } from '../../services/trackingService';
import secureLogger from '../../utils/secureLogger';

const JobBoxStatusTracker = ({ jobBox, organizationID }) => {
  const [currentUserName, setCurrentUserName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserName = async () => {
      if (!jobBox) {
        setLoading(false);
        return;
      }

      try {
        const userName = await resolveUserName(jobBox.userId, organizationID);
        setCurrentUserName(userName);
      } catch (error) {
        secureLogger.error('Error resolving user name:', error);
        setCurrentUserName('Unknown User');
      } finally {
        setLoading(false);
      }
    };

    loadUserName();
  }, [jobBox, organizationID]);

  if (!jobBox) return null;

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  const getStatusIndex = (status) => {
    return JOB_BOX_STATUSES.indexOf(status);
  };

  const currentStatusIndex = getStatusIndex(jobBox.status);

  // Short status names for compact display
  const shortStatusNames = ['Packed', 'Picked Up', 'Left Job', 'Turned In'];

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
          color: '#6c757d',
          fontSize: '0.875rem',
          fontWeight: '500',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package size={16} />
          JOB BOX STATUS
        </div>
        <span style={{ fontWeight: '600', color: '#333' }}>
          Box #{jobBox.boxNumber}
        </span>
      </div>

      <div
        style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '0.375rem',
          padding: '0.75rem',
        }}
      >
        {/* Horizontal Status Timeline */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
          position: 'relative',
        }}>
          {/* Background line */}
          <div
            style={{
              position: 'absolute',
              left: '1rem',
              right: '1rem',
              top: '50%',
              height: '2px',
              backgroundColor: '#dee2e6',
              transform: 'translateY(-50%)',
              zIndex: 0,
            }}
          />
          
          {/* Progress line */}
          <div
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              height: '2px',
              backgroundColor: '#28a745',
              transform: 'translateY(-50%)',
              width: `${(currentStatusIndex / (JOB_BOX_STATUSES.length - 1)) * 100}%`,
              maxWidth: 'calc(100% - 2rem)',
              zIndex: 1,
            }}
          />

          {/* Status indicators */}
          {JOB_BOX_STATUSES.map((status, index) => {
            const isCompleted = index <= currentStatusIndex;
            const isCurrent = index === currentStatusIndex;

            return (
              <div
                key={status}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                {/* Status circle */}
                <div
                  style={{
                    width: '1rem',
                    height: '1rem',
                    borderRadius: '50%',
                    backgroundColor: isCompleted ? '#28a745' : 'white',
                    border: isCompleted ? 'none' : '2px solid #dee2e6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                    boxShadow: isCurrent ? '0 0 0 3px rgba(40, 167, 69, 0.2)' : 'none',
                  }}
                >
                  {isCompleted && (
                    <Check size={10} color="white" strokeWidth={3} />
                  )}
                </div>
                
                {/* Status label */}
                <span
                  style={{
                    fontSize: '0.65rem',
                    color: isCompleted ? '#333' : '#6c757d',
                    fontWeight: isCurrent ? '600' : '400',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shortStatusNames[index]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Current status info */}
        {!loading && (
          <div
            style={{
              fontSize: '0.75rem',
              color: '#6c757d',
              textAlign: 'center',
              marginTop: '0.25rem',
            }}
          >
            Current: <strong>{jobBox.status}</strong> • 
            By {currentUserName} • 
            {formatTimestamp(jobBox.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobBoxStatusTracker;