// src/components/tasks/TaskTimeCounter.js
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Clock } from 'lucide-react';
import { subscribeToTaskTimeEntries } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import timeEntryCacheService from '../../services/timeEntryCacheService';
import { readCounter } from '../../services/readCounter';
import './TaskTimeCounter.css';

const TaskTimeCounter = ({ taskId }) => {
  const { organization } = useAuth();
  const [timeEntries, setTimeEntries] = useState([]);
  const [totalTime, setTotalTime] = useState(0); // Total logged time in hours
  const [activeTime, setActiveTime] = useState(0); // Active session time in seconds
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const unsubscribeRef = useRef(null);

  // Calculate active entries - memoized to prevent unnecessary recalculations
  const activeEntries = useMemo(() => {
    return timeEntries.filter(
      entry => entry.status === 'clocked-in' && entry.taskId === taskId
    );
  }, [timeEntries, taskId]);

  // Calculate total logged time - memoized
  const calculateTotalTime = useCallback((entries) => {
    return entries.reduce((sum, entry) => {
      if (entry.clockInTime && entry.clockOutTime) {
        const clockIn = entry.clockInTime.toDate ? entry.clockInTime.toDate() : new Date(entry.clockInTime);
        const clockOut = entry.clockOutTime.toDate ? entry.clockOutTime.toDate() : new Date(entry.clockOutTime);
        const hours = (clockOut - clockIn) / (1000 * 60 * 60);
        return sum + hours;
      }
      return sum;
    }, 0);
  }, []);

  // Load time entries with cache-first strategy
  useEffect(() => {
    if (!taskId || !organization?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadTimeData = () => {
      try {
        // 1. Load from cache immediately
        const cachedEntries = timeEntryCacheService.getCachedTaskEntries(taskId);

        if (cachedEntries && isMounted) {
          setTimeEntries(cachedEntries);
          setTotalTime(calculateTotalTime(cachedEntries));
          setLoading(false);
          readCounter.recordCacheHit('taskTimeEntries', 'TaskTimeCounter', cachedEntries.length);
        } else {
          readCounter.recordCacheMiss('taskTimeEntries', 'TaskTimeCounter');
        }

        // 2. Subscribe to real-time updates
        const handleSnapshot = (entries) => {
          if (!isMounted) return;

          setTimeEntries(entries);
          setTotalTime(calculateTotalTime(entries));
          setLoading(false);
          setError(null);

          // Update cache
          timeEntryCacheService.setCachedTaskEntries(taskId, entries);
        };

        const handleError = (err) => {
          if (!isMounted) return;

          console.error('Error in time entries listener:', err);
          setError('Failed to load time tracking data');
          setLoading(false);
        };

        unsubscribeRef.current = subscribeToTaskTimeEntries(
          taskId,
          organization.id,
          handleSnapshot,
          handleError
        );

      } catch (err) {
        if (isMounted) {
          console.error('Error loading time data:', err);
          setError('Failed to initialize time tracking');
          setLoading(false);
        }
      }
    };

    loadTimeData();

    // Cleanup
    return () => {
      isMounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [taskId, organization?.id, calculateTotalTime]);

  // Update active time counter every second - only when there are active entries
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (activeEntries.length === 0) {
      setActiveTime(0);
      return;
    }

    const updateActiveTime = () => {
      const now = Date.now();
      let totalActiveSeconds = 0;

      activeEntries.forEach(entry => {
        // Use taskStartTime if available (for task-specific tracking), otherwise clockInTime
        const startTime = entry.taskStartTime || entry.clockInTime;
        const startDate = startTime?.toDate ? startTime.toDate() : new Date(startTime);
        const secondsElapsed = Math.floor((now - startDate.getTime()) / 1000);
        totalActiveSeconds += Math.max(0, secondsElapsed); // Ensure non-negative
      });

      setActiveTime(totalActiveSeconds);
    };

    // Update immediately
    updateActiveTime();

    // Then update every second
    intervalRef.current = setInterval(updateActiveTime, 1000);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeEntries]);

  // Format time for display - memoized
  const formatTime = useCallback((hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0 && m === 0) return '0m';
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }, []);

  const formatActiveTime = useCallback((seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }, []);

  // Don't show while loading or if error and no cached data
  if (loading && timeEntries.length === 0) {
    return null;
  }

  // Don't show if no time logged and no active tracking
  if (totalTime === 0 && activeEntries.length === 0) {
    return null;
  }

  // Show error state only if we have no data at all
  if (error && timeEntries.length === 0) {
    return (
      <div className="task-time-counter task-time-counter--error" title={error}>
        <Clock size={14} className="task-time-counter__icon" />
        <span className="task-time-counter__error">!</span>
      </div>
    );
  }

  return (
    <div className="task-time-counter">
      <Clock size={14} className="task-time-counter__icon" />
      <div className="task-time-counter__content">
        {activeEntries.length > 0 && (
          <span
            className="task-time-counter__active"
            title="Active tracking time"
          >
            {formatActiveTime(activeTime)}
          </span>
        )}
        {totalTime > 0 && (
          <span
            className="task-time-counter__total"
            title="Total logged time"
          >
            ({formatTime(totalTime)})
          </span>
        )}
      </div>
    </div>
  );
};

export default TaskTimeCounter;
