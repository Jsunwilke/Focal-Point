// src/components/dashboard/TimeTrackingWidget.js
import React, { useState, useEffect } from 'react';
import { Clock, Play, Square, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getCurrentTimeEntry,
  clockIn,
  clockOut,
  getTodayTimeEntries,
  calculateTotalHours,
  formatDuration,
  getTodaySessions
} from '../../firebase/firestore';
import TimeTrackingModal from '../shared/TimeTrackingModal';
import './TimeTrackingWidget.css';

const TimeTrackingWidget = () => {
  const { user, organization } = useAuth();
  const { addToast } = useToast();
  const [currentEntry, setCurrentEntry] = useState(null);
  const [todayHours, setTodayHours] = useState(0);
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');

  // Load current time entry and today's hours
  useEffect(() => {
    const loadTimeData = async () => {
      if (!user || !organization) return;

      try {
        // Get current active entry
        const activeEntry = await getCurrentTimeEntry(user.uid, organization.id);
        setCurrentEntry(activeEntry);

        // Get today's completed entries to calculate total hours
        const todayEntries = await getTodayTimeEntries(user.uid, organization.id);
        const completedEntries = todayEntries.filter(entry => entry.status === 'clocked-out');
        const hours = calculateTotalHours(completedEntries);
        setTodayHours(hours);
      } catch (error) {
        console.error('Error loading time data:', error);
      }
    };

    loadTimeData();
  }, [user, organization]);

  // Load today's sessions
  useEffect(() => {
    const loadSessions = async () => {
      if (!user || !organization) return;

      try {
        // Use optimized query that only fetches today's sessions
        const sessionsData = await getTodaySessions(organization.id);
        // Filter for sessions where current user is assigned as photographer
        const todaySessions = sessionsData.filter(session => {
          // Check if user is assigned to this session
          if (session.photographers && Array.isArray(session.photographers)) {
            // Multiple photographers format
            return session.photographers.some(photographer => photographer.id === user.uid);
          } else if (session.photographer) {
            // Legacy single photographer format
            return session.photographer.id === user.uid;
          }
          
          return false;
        });
        setSessions(todaySessions);
      } catch (error) {
        console.error('Error loading sessions:', error);
      }
    };

    loadSessions();
  }, [user, organization]);

  // Update elapsed time every second when clocked in
  useEffect(() => {
    let interval;
    
    if (currentEntry && currentEntry.clockInTime) {
      interval = setInterval(() => {
        const clockInTime = currentEntry.clockInTime.toDate 
          ? currentEntry.clockInTime.toDate() 
          : new Date(currentEntry.clockInTime);
        const now = new Date();
        const elapsed = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60); // hours
        setElapsedTime(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentEntry]);

  const handleClockIn = async () => {
    if (!user || !organization) return;

    setLoading(true);
    try {
      await clockIn(user.uid, organization.id, selectedSession || null);
      
      // Reload current entry
      const activeEntry = await getCurrentTimeEntry(user.uid, organization.id);
      setCurrentEntry(activeEntry);
      
      // Clear selected session
      setSelectedSession('');
      
      addToast('Clocked in successfully!', 'success');
    } catch (error) {
      console.error('Error clocking in:', error);
      addToast(error.message || 'Failed to clock in', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user || !organization) return;

    setLoading(true);
    try {
      await clockOut(user.uid, organization.id);
      
      // Clear current entry and reload today's hours
      setCurrentEntry(null);
      setElapsedTime(0);
      
      const todayEntries = await getTodayTimeEntries(user.uid, organization.id);
      const completedEntries = todayEntries.filter(entry => entry.status === 'clocked-out');
      const hours = calculateTotalHours(completedEntries);
      setTodayHours(hours);
      
      addToast('Clocked out successfully!', 'success');
    } catch (error) {
      console.error('Error clocking out:', error);
      addToast(error.message || 'Failed to clock out', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isOnBreak = currentEntry && currentEntry.status === 'clocked-in';

  return (
    <div className="time-tracking-widget">
      <div className="widget-header">
        <div className="widget-title">
          <Clock size={20} />
          <span>Time Tracking</span>
        </div>
        <button 
          className="widget-expand-btn"
          onClick={() => setShowModal(true)}
          title="View full time tracking"
        >
          <Calendar size={16} />
        </button>
      </div>

      <div className="widget-content">
        {/* Compact Status and Hours */}
        <div className="compact-status">
          <div className={`status-indicator ${isOnBreak ? 'clocked-in' : 'clocked-out'}`}>
            {isOnBreak ? (
              <>
                <div className="status-dot active"></div>
                <span>Clocked In</span>
              </>
            ) : (
              <>
                <div className="status-dot"></div>
                <span>Clocked Out</span>
              </>
            )}
          </div>
          <div className="time-display">
            <div className="time-value">{formatDuration(todayHours + (isOnBreak ? elapsedTime : 0))}</div>
            <div className="time-label">Today's Hours</div>
          </div>
        </div>

        {/* Compact Action Button */}
        <div className="compact-actions">
          {!isOnBreak ? (
            <button
              className="clock-btn clock-in-btn"
              onClick={handleClockIn}
              disabled={loading}
            >
              <Play size={16} />
              {loading ? 'Clocking In...' : 'Clock In'}
            </button>
          ) : (
            <button
              className="clock-btn clock-out-btn"
              onClick={handleClockOut}
              disabled={loading}
            >
              <Square size={16} />
              {loading ? 'Clocking Out...' : 'Clock Out'}
            </button>
          )}
        </div>
      </div>

      {/* Time Tracking Modal */}
      <TimeTrackingModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
      />
    </div>
  );
};

export default TimeTrackingWidget;