// src/components/dashboard/UpcomingSessionsWidget.js
import React, { useState, useEffect } from 'react';
import { CalendarClock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserUpcomingSessions } from '../../firebase/firestore';
import { getSessionTypeColors, getSessionTypeNames, normalizeSessionTypes } from '../../utils/sessionTypes';
import './UpcomingSessionsWidget.css';

const UpcomingSessionsWidget = ({ onSessionClick }) => {
  const { user, organization } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUpcomingSessions = async () => {
      if (!user || !organization) return;

      try {
        setLoading(true);
        setError('');

        // Get upcoming sessions for the next 14 days to have more to show
        const upcomingSessions = await getUserUpcomingSessions(user.uid, organization.id, 14);
        setSessions(upcomingSessions.slice(0, 8)); // Limit to 8 sessions for display
      } catch (err) {
        console.error('Error loading upcoming sessions:', err);
        setError('Unable to load sessions');
      } finally {
        setLoading(false);
      }
    };

    loadUpcomingSessions();
  }, [user, organization]);

  // Format time exactly like WeekView schedule cards
  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes}${ampm}`;
  };

  // Calculate duration exactly like WeekView
  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '';
    
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end - start;
    const diffMins = diffMs / (1000 * 60);
    
    if (diffMins >= 60) {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    if (diffMins > 0) {
      return `${diffMins}m`;
    }
    return "";
  };

  // Get session background color based on order (like WeekView)
  const getSessionColorByOrder = (orderIndex) => {
    const colors = ['#ef4444', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#6b7280'];
    return colors[orderIndex % colors.length];
  };

  if (loading) {
    return (
      <div className="upcoming-sessions-widget">
        <div className="widget-header">
          <div className="widget-title">
            <CalendarClock size={20} />
            <span>Upcoming Sessions</span>
          </div>
        </div>
        <div className="widget-loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="upcoming-sessions-widget">
        <div className="widget-header">
          <div className="widget-title">
            <CalendarClock size={20} />
            <span>Upcoming Sessions</span>
          </div>
        </div>
        <div className="widget-error">{error}</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="upcoming-sessions-widget">
        <div className="widget-header">
          <div className="widget-title">
            <CalendarClock size={20} />
            <span>Upcoming Sessions</span>
          </div>
        </div>
        <div className="no-sessions">
          <CalendarClock size={32} />
          <p>No upcoming sessions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="upcoming-sessions-widget">
      <div className="widget-header">
        <div className="widget-title">
          <CalendarClock size={20} />
          <span>Upcoming Sessions</span>
        </div>
        <div className="session-count">{sessions.length}</div>
      </div>

      <div className="widget-content">
        <div className="sessions-container">
          {sessions.map((session, index) => (
            <div
              key={session.id}
              className="session-block"
              onClick={() => {
                if (onSessionClick) {
                  onSessionClick(session);
                }
              }}
              style={{
                backgroundColor: session.sessionColor || getSessionColorByOrder(index),
                color: "white",
                padding: "var(--spacing-xs)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "var(--spacing-xs)",
                fontSize: "var(--font-size-xs)",
                cursor: "pointer",
                transition: "all var(--transition-fast)"
              }}
            >
              <div
                className="session-block__time"
                style={{ 
                  fontSize: "11px",
                  fontWeight: "500",
                  marginBottom: "3px",
                  opacity: 0.9,
                  lineHeight: "1.2"
                }}
              >
                {formatTime(session.startTime)} - {formatTime(session.endTime)}
                {calculateDuration(session.startTime, session.endTime) && 
                  ` (${calculateDuration(session.startTime, session.endTime)})`
                }
              </div>
              <div
                className="session-block__school"
                style={{ 
                  fontSize: "12px",
                  fontWeight: "600",
                  lineHeight: "1.2",
                  color: "white",
                  marginBottom: "3px"
                }}
              >
                {session.schoolName || session.location || 'School'}
              </div>
              {(session.sessionTypes || session.sessionType) && (
                <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', marginTop: '2px' }}>
                  {(() => {
                    const sessionTypes = normalizeSessionTypes(session.sessionTypes || session.sessionType);
                    const colors = getSessionTypeColors(sessionTypes, organization);
                    const names = getSessionTypeNames(sessionTypes, organization);
                    
                    return sessionTypes.map((type, idx) => {
                      let displayName = names[idx];
                      if (type === 'other' && session.customSessionType) {
                        displayName = session.customSessionType;
                      }
                      
                      return (
                        <div
                          key={`${type}-${idx}`}
                          className="session-block__badge"
                          style={{
                            fontSize: "8px",
                            backgroundColor: colors[idx],
                            color: "white",
                            padding: "1px 4px",
                            borderRadius: "6px",
                            textTransform: "capitalize",
                            fontWeight: "500",
                            display: "inline-block",
                            lineHeight: "1.2"
                          }}
                        >
                          {displayName}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
              {session.notes && (
                <div
                  className="session-block__notes"
                  style={{
                    fontSize: "10px",
                    opacity: 0.7,
                    fontStyle: "italic",
                    marginTop: "3px",
                    borderTop: "1px solid rgba(255,255,255,0.2)",
                    paddingTop: "2px"
                  }}
                >
                  {session.notes.length > 25
                    ? `${session.notes.substring(0, 25)}...`
                    : session.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UpcomingSessionsWidget;