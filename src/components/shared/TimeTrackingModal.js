// src/components/shared/TimeTrackingModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, 
  Clock, 
  Play, 
  Square, 
  Calendar,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getCurrentTimeEntry,
  clockIn,
  clockOut,
  getTimeEntries,
  getTodayTimeEntries,
  calculateTotalHours,
  formatDuration
} from '../../firebase/firestore';
// Removed getSessions - using cached data from DataCacheContext instead
import { useDataCache } from '../../contexts/DataCacheContext';
import './TimeTrackingModal.css';

const TimeTrackingModal = ({ isOpen, onClose }) => {
  const { user, organization } = useAuth();
  const { addToast } = useToast();
  const { sessions: cachedSessions } = useDataCache();
  
  const [currentEntry, setCurrentEntry] = useState(null);
  const [timeEntries, setTimeEntries] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState('today');

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && user && organization) {
      loadTimeData();
      loadSessions();
    }
  }, [isOpen, user, organization, currentDate, dateRange]);

  // Update elapsed time every second when clocked in
  useEffect(() => {
    let interval;
    
    if (currentEntry && currentEntry.clockInTime) {
      interval = setInterval(() => {
        const clockInTime = currentEntry.clockInTime.toDate 
          ? currentEntry.clockInTime.toDate() 
          : new Date(currentEntry.clockInTime);
        const now = new Date();
        const elapsed = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
        setElapsedTime(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentEntry]);

  const loadTimeData = async () => {
    try {
      // Get current active entry
      const activeEntry = await getCurrentTimeEntry(user.uid, organization.id);
      setCurrentEntry(activeEntry);

      // Get time entries based on date range
      let entries = [];
      if (dateRange === 'today') {
        entries = await getTodayTimeEntries(user.uid, organization.id);
      } else if (dateRange === 'week') {
        const startDate = getStartOfWeek(new Date()).toISOString().split('T')[0];
        const endDate = getEndOfWeek(new Date()).toISOString().split('T')[0];
        entries = await getTimeEntries(user.uid, organization.id, startDate, endDate);
      } else if (dateRange === 'month') {
        const startDate = getStartOfMonth(new Date()).toISOString().split('T')[0];
        const endDate = getEndOfMonth(new Date()).toISOString().split('T')[0];
        entries = await getTimeEntries(user.uid, organization.id, startDate, endDate);
      } else {
        entries = await getTimeEntries(user.uid, organization.id, currentDate, currentDate);
      }
      
      setTimeEntries(entries);
    } catch (error) {
      console.error('Error loading time data:', error);
      addToast('Failed to load time data', 'error');
    }
  };

  const loadSessions = async () => {
    try {
      // Use cached sessions data instead of fetching from Firestore
      if (!cachedSessions) {
        setSessions([]);
        return;
      }
      
      // Filter sessions for today or current date and where current user is assigned as photographer
      const todaySessions = cachedSessions.filter(session => {
        const sessionDate = session.date;
        const targetDate = dateRange === 'today' ? new Date().toISOString().split('T')[0] : currentDate;
        
        // Must be target date's session
        if (sessionDate !== targetDate) return false;
        
        // Check if user is assigned to this session
        // The cached sessions data already has photographerId field
        return session.photographerId === user.uid;
      });
      setSessions(todaySessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const handleClockIn = async () => {
    setLoading(true);
    try {
      await clockIn(user.uid, organization.id, selectedSession || null, notes || null);
      
      // Reload data
      await loadTimeData();
      setSelectedSession('');
      setNotes('');
      
      addToast('Clocked in successfully!', 'success');
    } catch (error) {
      console.error('Error clocking in:', error);
      addToast(error.message || 'Failed to clock in', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      await clockOut(user.uid, organization.id, notes || null);
      
      // Reload data
      await loadTimeData();
      setNotes('');
      
      addToast('Clocked out successfully!', 'success');
    } catch (error) {
      console.error('Error clocking out:', error);
      addToast(error.message || 'Failed to clock out', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate.toISOString().split('T')[0]);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '--:--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getSessionName = (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    return session ? `${session.schoolName} - ${session.sessionType}` : 'Unknown Session';
  };

  const getTotalHours = () => {
    const completedEntries = timeEntries.filter(entry => entry.status === 'clocked-out');
    const hours = calculateTotalHours(completedEntries);
    const currentHours = currentEntry ? elapsedTime : 0;
    return hours + currentHours;
  };

  // Utility functions for date ranges
  const getStartOfWeek = (date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day;
    return new Date(start.setDate(diff));
  };

  const getEndOfWeek = (date) => {
    const end = getStartOfWeek(date);
    end.setDate(end.getDate() + 6);
    return end;
  };

  const getStartOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  const getEndOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  };

  const isOnBreak = currentEntry && currentEntry.status === 'clocked-in';

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
        className="time-tracking-modal"
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
            <span>Time Tracking</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Current Status Section */}
          <div className="current-status-section">
            <div className="status-card">
              <div className="status-info">
                <div className={`status-indicator ${isOnBreak ? 'clocked-in' : 'clocked-out'}`}>
                  <div className={`status-dot ${isOnBreak ? 'active' : ''}`}></div>
                  <span>{isOnBreak ? 'Clocked In' : 'Clocked Out'}</span>
                </div>
                
                {isOnBreak && (
                  <div className="elapsed-time">
                    {formatDuration(elapsedTime)}
                  </div>
                )}
              </div>

              <div className="total-hours">
                <span className="total-label">Total Hours ({dateRange}):</span>
                <span className="total-value">{formatDuration(getTotalHours())}</span>
              </div>
            </div>

            {/* Clock In/Out Controls */}
            <div className="clock-controls">
              {!isOnBreak && (
                <div className="clock-in-section">
                  <div className="form-group">
                    <label>Session (Optional)</label>
                    <select 
                      value={selectedSession} 
                      onChange={(e) => setSelectedSession(e.target.value)}
                    >
                      <option value="">No specific session</option>
                      {sessions.map(session => (
                        <option key={session.id} value={session.id}>
                          {session.schoolName} - {session.sessionType} ({session.startTime} - {session.endTime})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Notes (Optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this work session..."
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {isOnBreak && (
                <div className="clock-out-section">
                  <div className="form-group">
                    <label>Notes (Optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this work session..."
                      rows={2}
                    />
                  </div>
                </div>
              )}

              <div className="action-buttons">
                {!isOnBreak ? (
                  <button
                    className="clock-btn clock-in-btn"
                    onClick={handleClockIn}
                    disabled={loading}
                  >
                    <Play size={18} />
                    {loading ? 'Clocking In...' : 'Clock In'}
                  </button>
                ) : (
                  <button
                    className="clock-btn clock-out-btn"
                    onClick={handleClockOut}
                    disabled={loading}
                  >
                    <Square size={18} />
                    {loading ? 'Clocking Out...' : 'Clock Out'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Date Range Controls */}
          <div className="date-controls">
            <div className="date-range-selector">
              <button 
                className={`range-btn ${dateRange === 'today' ? 'active' : ''}`}
                onClick={() => setDateRange('today')}
              >
                Today
              </button>
              <button 
                className={`range-btn ${dateRange === 'week' ? 'active' : ''}`}
                onClick={() => setDateRange('week')}
              >
                This Week
              </button>
              <button 
                className={`range-btn ${dateRange === 'month' ? 'active' : ''}`}
                onClick={() => setDateRange('month')}
              >
                This Month
              </button>
            </div>

            {dateRange === 'custom' && (
              <div className="date-navigation">
                <button onClick={() => handleDateChange(-1)}>
                  <ChevronLeft size={16} />
                </button>
                <span className="current-date">{formatDate(currentDate)}</span>
                <button onClick={() => handleDateChange(1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Time Entries List */}
          <div className="time-entries-section">
            <h3>Time Entries</h3>
            
            {timeEntries.length === 0 ? (
              <div className="no-entries">
                <Clock size={32} />
                <p>No time entries for this period</p>
              </div>
            ) : (
              <div className="entries-list">
                {timeEntries.map(entry => (
                  <div key={entry.id} className="entry-item">
                    <div className="entry-header">
                      <div className="entry-date">
                        {formatDate(entry.date)}
                      </div>
                      <div className={`entry-status ${entry.status}`}>
                        {entry.status === 'clocked-in' ? 'In Progress' : 'Completed'}
                      </div>
                    </div>
                    
                    <div className="entry-details">
                      <div className="entry-time">
                        <span>In: {formatTime(entry.clockInTime)}</span>
                        {entry.clockOutTime && (
                          <span>Out: {formatTime(entry.clockOutTime)}</span>
                        )}
                      </div>
                      
                      {entry.sessionId && (
                        <div className="entry-session">
                          <MapPin size={14} />
                          <span>{getSessionName(entry.sessionId)}</span>
                        </div>
                      )}
                      
                      {entry.notes && (
                        <div className="entry-notes">
                          <span>{entry.notes}</span>
                        </div>
                      )}
                    </div>
                    
                    {entry.status === 'clocked-out' && (
                      <div className="entry-duration">
                        {formatDuration(calculateTotalHours([entry]))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TimeTrackingModal;