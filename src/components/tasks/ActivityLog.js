// src/components/tasks/ActivityLog.js
import React, { useState, useEffect, useCallback } from 'react';
import { Clock, User } from 'lucide-react';
import { getTaskActivities, subscribeToTaskActivities, formatActivityDescription } from '../../firebase/activity';
import { activityCacheService } from '../../services/activityCacheService';
import { useDataCache } from '../../contexts/DataCacheContext';
import { readCounter } from '../../services/readCounter';
import './ActivityLog.css';

const ActivityLog = ({ taskId }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const { teamMembers } = useDataCache();

  // Create user map for quick lookup
  const userMap = React.useMemo(() => {
    if (!teamMembers) return {};
    return teamMembers.reduce((map, member) => {
      map[member.id] = member;
      return map;
    }, {});
  }, [teamMembers]);

  // Load activities from cache first, then fetch from Firestore
  const loadActivities = useCallback(async () => {
    if (!taskId) return;

    try {
      setLoading(true);

      // Check cache first
      const cachedActivities = activityCacheService.getCachedActivities(taskId);
      if (cachedActivities && cachedActivities.length > 0) {
        setActivities(cachedActivities);
        readCounter.recordCacheHit('taskActivities', 'ActivityLog', cachedActivities.length);
        setLoading(false);
        return;
      }

      // Cache miss - fetch from Firestore
      readCounter.recordCacheMiss('taskActivities', 'ActivityLog');
      const fetchedActivities = await getTaskActivities(taskId);

      // Cache the activities
      activityCacheService.setCachedActivities(taskId, fetchedActivities);
      setActivities(fetchedActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Set up real-time listener for new activities
  useEffect(() => {
    if (!taskId) return;

    // Load cached activities first
    loadActivities();

    // Get latest timestamp from cache for optimized listener
    const latestTimestamp = activityCacheService.getLatestTimestamp(taskId);

    // Set up real-time listener
    const unsubscribe = subscribeToTaskActivities(
      taskId,
      (newActivities, isIncremental) => {
        if (isIncremental && latestTimestamp) {
          // Merge new activities with cached activities
          const updatedActivities = activityCacheService.appendNewActivities(taskId, newActivities);
          setActivities(updatedActivities);
        } else {
          // Full refresh
          setActivities(newActivities);
          activityCacheService.setCachedActivities(taskId, newActivities);
        }
      },
      latestTimestamp
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [taskId, loadActivities]);

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60 * 1000) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }

    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    // More than 7 days - show actual date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Get user avatar/initials
  const getUserAvatar = (userId) => {
    const user = userMap[userId];
    if (!user) {
      return (
        <div className="activity-log__avatar activity-log__avatar--placeholder">
          <User size={14} />
        </div>
      );
    }

    if (user.photoURL) {
      return (
        <img
          src={user.photoURL}
          alt={`${user.firstName} ${user.lastName}`}
          className="activity-log__avatar"
        />
      );
    }

    const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
    return (
      <div className="activity-log__avatar activity-log__avatar--initials">
        {initials}
      </div>
    );
  };

  if (loading && activities.length === 0) {
    return (
      <div className="activity-log__loading">
        <Clock size={16} className="activity-log__loading-icon" />
        Loading activity...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="activity-log__empty">
        <Clock size={24} />
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className="activity-log">
      <div className="activity-log__timeline">
        {activities.map((activity, index) => (
          <div key={activity.id} className="activity-log__item">
            <div className="activity-log__item-avatar">
              {getUserAvatar(activity.userId)}
            </div>
            <div className="activity-log__item-content">
              <div className="activity-log__item-description">
                {formatActivityDescription(activity, userMap)}
              </div>
              <div className="activity-log__item-timestamp">
                <Clock size={12} />
                {formatTimestamp(activity.timestamp)}
              </div>
            </div>
            {index < activities.length - 1 && (
              <div className="activity-log__timeline-line" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityLog;
