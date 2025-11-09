// src/components/tasks/TaskTimeTracking.js
import React, { useState, useEffect } from 'react';
import { Clock, Play, User, Calendar, PlayCircle } from 'lucide-react';
import { getTaskTimeEntries, getCurrentTimeEntry, clockIn, updateTimeEntryTask } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { useToast } from '../../contexts/ToastContext';
import { logActivity, ACTIVITY_TYPES } from '../../firebase/activity';
import './TaskTimeTracking.css';

const TaskTimeTracking = ({ taskId }) => {
  const { userProfile, organization } = useAuth();
  const { users } = useDataCache();
  const { showToast } = useToast();
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalHours, setTotalHours] = useState(0);
  const [trackingTime, setTrackingTime] = useState(false);

  useEffect(() => {
    if (!taskId || !organization?.id) return;

    const loadTimeEntries = async () => {
      setLoading(true);
      try {
        const entries = await getTaskTimeEntries(taskId, organization.id);

        // Calculate total hours
        const total = entries.reduce((sum, entry) => {
          if (entry.clockInTime && entry.clockOutTime) {
            const clockIn = entry.clockInTime.toDate ? entry.clockInTime.toDate() : new Date(entry.clockInTime);
            const clockOut = entry.clockOutTime.toDate ? entry.clockOutTime.toDate() : new Date(entry.clockOutTime);
            const hours = (clockOut - clockIn) / (1000 * 60 * 60);
            return sum + hours;
          }
          return sum;
        }, 0);

        setTimeEntries(entries);
        setTotalHours(total);
      } catch (error) {
        console.error('Error loading time entries:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTimeEntries();
  }, [taskId, organization?.id]);

  // Format duration
  const formatDuration = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // Get user name
  const getUserName = (userId) => {
    if (!users || users.length === 0) return 'Unknown User';
    const user = users.find(u => u.id === userId || u.uid === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown User';
  };

  // Calculate entry duration
  const getEntryDuration = (entry) => {
    if (!entry.clockInTime || !entry.clockOutTime) return null;
    const clockIn = entry.clockInTime.toDate ? entry.clockInTime.toDate() : new Date(entry.clockInTime);
    const clockOut = entry.clockOutTime.toDate ? entry.clockOutTime.toDate() : new Date(entry.clockOutTime);
    const hours = (clockOut - clockIn) / (1000 * 60 * 60);
    return hours;
  };

  // Handle start tracking time
  const handleStartTracking = async () => {
    if (!userProfile?.id || !organization?.id) return;

    setTrackingTime(true);
    try {
      // Check if user is already clocked in
      const currentEntry = await getCurrentTimeEntry(userProfile.id, organization.id);

      if (currentEntry) {
        // Update existing time entry to add this taskId
        await updateTimeEntryTask(currentEntry.id, taskId);
        showToast('Started tracking time on this task', 'success');
      } else {
        // Clock in with this taskId
        await clockIn(userProfile.id, organization.id, null, null, taskId);
        showToast('Clocked in and tracking time on this task', 'success');
      }

      // Log activity
      await logActivity(
        taskId,
        ACTIVITY_TYPES.TIME_LOGGED,
        { action: 'started_tracking' },
        userProfile.id,
        organization.id
      );

      // Reload time entries
      const entries = await getTaskTimeEntries(taskId, organization.id);
      const total = entries.reduce((sum, entry) => {
        if (entry.clockInTime && entry.clockOutTime) {
          const clockIn = entry.clockInTime.toDate ? entry.clockInTime.toDate() : new Date(entry.clockInTime);
          const clockOut = entry.clockOutTime.toDate ? entry.clockOutTime.toDate() : new Date(entry.clockOutTime);
          const hours = (clockOut - clockIn) / (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0);
      setTimeEntries(entries);
      setTotalHours(total);
    } catch (error) {
      console.error('Error starting time tracking:', error);
      showToast(error.message || 'Failed to start tracking time', 'error');
    } finally {
      setTrackingTime(false);
    }
  };

  if (loading) {
    return (
      <div className="task-time-tracking">
        <p className="task-time-tracking__loading">Loading time entries...</p>
      </div>
    );
  }

  return (
    <div className="task-time-tracking">
      {/* Total Hours */}
      <div className="task-time-tracking__summary">
        <div className="task-time-tracking__summary-item">
          <Clock size={16} />
          <span className="task-time-tracking__summary-label">Total Time Logged</span>
          <span className="task-time-tracking__summary-value">{formatDuration(totalHours)}</span>
        </div>
        <div className="task-time-tracking__summary-item">
          <Play size={16} />
          <span className="task-time-tracking__summary-label">Entries</span>
          <span className="task-time-tracking__summary-value">{timeEntries.length}</span>
        </div>
      </div>

      {/* Start Tracking Button */}
      <div className="task-time-tracking__actions">
        <button
          onClick={handleStartTracking}
          disabled={trackingTime}
          className="task-time-tracking__track-btn"
        >
          <PlayCircle size={16} />
          {trackingTime ? 'Starting...' : 'Track Time on This Task'}
        </button>
      </div>

      {/* Time Entries List */}
      {timeEntries.length > 0 ? (
        <div className="task-time-tracking__entries">
          {timeEntries.map(entry => {
            const duration = getEntryDuration(entry);
            const isActive = entry.status === 'clocked-in';

            return (
              <div key={entry.id} className={`task-time-tracking__entry ${isActive ? 'task-time-tracking__entry--active' : ''}`}>
                <div className="task-time-tracking__entry-header">
                  <div className="task-time-tracking__entry-user">
                    <User size={14} />
                    <span>{getUserName(entry.userId)}</span>
                  </div>
                  <div className="task-time-tracking__entry-date">
                    <Calendar size={14} />
                    <span>{formatDate(entry.clockInTime)}</span>
                  </div>
                </div>

                <div className="task-time-tracking__entry-times">
                  <div className="task-time-tracking__entry-time">
                    <span className="task-time-tracking__entry-time-label">Clock In</span>
                    <span className="task-time-tracking__entry-time-value">{formatTime(entry.clockInTime)}</span>
                  </div>
                  <span className="task-time-tracking__entry-separator">→</span>
                  <div className="task-time-tracking__entry-time">
                    <span className="task-time-tracking__entry-time-label">Clock Out</span>
                    <span className="task-time-tracking__entry-time-value">
                      {entry.clockOutTime ? formatTime(entry.clockOutTime) : <span className="task-time-tracking__active-badge">Active</span>}
                    </span>
                  </div>
                  {duration !== null && (
                    <div className="task-time-tracking__entry-duration">
                      <Clock size={12} />
                      <span>{formatDuration(duration)}</span>
                    </div>
                  )}
                </div>

                {entry.notes && (
                  <div className="task-time-tracking__entry-notes">
                    <span className="task-time-tracking__entry-notes-label">Notes:</span>
                    <span className="task-time-tracking__entry-notes-text">{entry.notes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="task-time-tracking__empty">No time logged for this task yet</p>
      )}
    </div>
  );
};

export default TaskTimeTracking;
