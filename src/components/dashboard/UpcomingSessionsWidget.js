// src/components/dashboard/UpcomingSessionsWidget.js
import React, { useState, useEffect } from 'react';
import { CalendarClock, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { getSessionTypeColors, getSessionTypeNames, normalizeSessionTypes } from '../../utils/sessionTypes';
import './UpcomingSessionsWidget.css';

const UpcomingSessionsWidget = ({ onSessionClick }) => {
  const { user, organization } = useAuth();
  const { sessions: cachedSessions, loading: cacheLoading } = useDataCache();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const filterUpcomingSessions = () => {
      if (!user || !organization || cacheLoading.sessions) {
        setLoading(cacheLoading.sessions);
        return;
      }

      try {
        setLoading(true);
        setError('');

        // Filter cached sessions for upcoming user sessions
        const now = new Date(); // Current date/time
        const today = new Date(now);
        today.setHours(0, 0, 0, 0); // Start of today
        
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 14); // Next 14 days
        endDate.setHours(23, 59, 59, 999); // End of the 14th day

        // Format dates as strings for consistent comparison
        const formatDateString = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };
        
        const todayString = formatDateString(today);
        const endDateString = formatDateString(endDate);


        const upcomingSessions = cachedSessions
          .filter(session => {
            // Check if user is assigned to this session
            // Check both the photographerId field AND the composite ID pattern
            const isAssigned = session.photographerId === user.uid || 
                             (session.id && session.id.endsWith(`-${user.uid}`));
            
            if (!isAssigned) return false;

            // Check date range using string comparison
            // This avoids timezone issues when parsing dates
            const sessionDateString = session.date; // Already in YYYY-MM-DD format
            
            // Include sessions from today through the end date
            const isInRange = sessionDateString >= todayString && sessionDateString <= endDateString;
            return isInRange;
          })
          .sort((a, b) => new Date(a.date) - new Date(b.date)) // Sort by date
          .slice(0, 8); // Limit to 8 sessions for display

        setSessions(upcomingSessions);
      } catch (err) {
        console.error('Error filtering upcoming sessions:', err);
        setError('Unable to load sessions');
      } finally {
        setLoading(false);
      }
    };

    filterUpcomingSessions();
  }, [user, organization, cachedSessions, cacheLoading.sessions]);

  // Format time exactly like WeekView schedule cards
  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes}${ampm}`;
  };
  
  // Format date for display
  const formatSessionDate = (dateString) => {
    const date = new Date(dateString + 'T12:00:00'); // Add time to avoid timezone issues
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = dateString === formatDateString(today);
    const isTomorrow = dateString === formatDateString(tomorrow);
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (isToday) {
      return 'Today';
    } else if (isTomorrow) {
      return 'Tomorrow';
    } else {
      const dayName = dayNames[date.getDay()];
      const month = monthNames[date.getMonth()];
      const day = date.getDate();
      return `${dayName}, ${month} ${day}`;
    }
  };
  
  // Helper to format date string
  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  
  // Get employee count for a session
  const getEmployeeCount = (session) => {
    // For sessions with composite IDs (multiple photographers)
    if (session.sessionId) {
      // Count how many composite entries exist for this base session
      const baseSessionEntries = cachedSessions.filter(s => s.sessionId === session.sessionId);
      return baseSessionEntries.length;
    }
    
    // For regular sessions, check if it has photographers array
    if (session.photographers && Array.isArray(session.photographers)) {
      return session.photographers.length;
    }
    
    // Single photographer session
    return session.photographerId ? 1 : 0;
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
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                marginBottom: "var(--spacing-xs)",
                fontSize: "var(--font-size-xs)",
                cursor: "pointer",
                transition: "all var(--transition-fast)"
              }}
            >
              {/* Top Row: Date and Employee Count */}
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "4px"
              }}>
                <div
                  className="session-block__date"
                  style={{ 
                    fontSize: "12px",
                    fontWeight: "600",
                    lineHeight: "1.2"
                  }}
                >
                  {formatSessionDate(session.date)}
                </div>
                <div
                  className="session-block__employees"
                  style={{ 
                    fontSize: "14px",
                    fontWeight: "600",
                    opacity: 1,
                    lineHeight: "1.2",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "rgba(255, 255, 255, 0.2)",
                    padding: "2px 6px",
                    borderRadius: "12px"
                  }}
                >
                  <Users size={14} />
                  <span>{getEmployeeCount(session)}</span>
                </div>
              </div>
              
              {/* School Name - Full Width */}
              <div
                className="session-block__school"
                style={{ 
                  fontSize: "13px",
                  fontWeight: "600",
                  lineHeight: "1.3",
                  color: "white",
                  marginBottom: "4px"
                }}
              >
                {session.schoolName || session.location || 'School'}
              </div>
              
              {/* Bottom Row: Time and Session Types */}
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "flex-end",
                gap: "8px"
              }}>
                <div
                  className="session-block__time"
                  style={{ 
                    fontSize: "11px",
                    fontWeight: "500",
                    opacity: 0.9,
                    lineHeight: "1.2",
                    flex: "0 0 auto"
                  }}
                >
                  {formatTime(session.startTime)} - {formatTime(session.endTime)}
                  {calculateDuration(session.startTime, session.endTime) && 
                    ` (${calculateDuration(session.startTime, session.endTime)})`
                  }
                </div>
                
                {/* Session Type Badges */}
                {(session.sessionTypes || session.sessionType) && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '2px', 
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                    flex: "1 1 auto"
                  }}>
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
              </div>
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