// src/components/calendar/MonthView.js
import React from "react";
import { getSessionTypeColor, getSessionTypeColors, getSessionTypeNames, normalizeSessionTypes } from "../../utils/sessionTypes";

const MonthView = ({
  currentDate,
  sessions,
  teamMembers,
  scheduleType,
  userProfile,
  organization,
  onSessionClick,
}) => {
  // Generate calendar grid for the month
  const generateMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // First day of the calendar grid (might be from previous month)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // Last day of the calendar grid (might be from next month)
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    const days = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const monthDays = generateMonthDays();
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Check if a date is today
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is in current month
  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  // Check if two dates are the same day
  const isSameDay = (date1, date2) => {
    return date1.toDateString() === date2.toDateString();
  };

  // Get global session order for consistent colors across views
  const getGlobalSessionOrderForDay = (day) => {
    // Get ALL sessions for this day across all photographers
    const allDaySessions = sessions.filter((session) => {
      let sessionDate;
      if (typeof session.date === "string") {
        const [year, month, dayOfMonth] = session.date.split("-").map(Number);
        sessionDate = new Date(year, month - 1, dayOfMonth);
      } else {
        sessionDate = new Date(session.date);
      }
      return isSameDay(sessionDate, day);
    });

    // Group sessions by unique identifier to avoid duplicates
    const uniqueSessions = {};
    allDaySessions.forEach((session) => {
      // Create unique key based on session properties to properly deduplicate multi-photographer sessions
      const key = `${session.date}-${session.startTime}-${session.schoolId}-${session.sessionType || 'default'}`;
      
      if (!uniqueSessions[key]) {
        // Store the session with all photographer information
        uniqueSessions[key] = {
          ...session,
          allPhotographers: []
        };
      }
      
      // Add photographer info to the session
      if (session.photographerId) {
        uniqueSessions[key].allPhotographers.push(session.photographerId);
      }
      if (session.photographerIds) {
        uniqueSessions[key].allPhotographers.push(...session.photographerIds);
      }
    });

    // Get unique sessions array
    const uniqueSessionsArray = Object.values(uniqueSessions).map(session => ({
      ...session,
      allPhotographers: [...new Set(session.allPhotographers)] // Remove duplicate photographer IDs
    }));

    // Sort by start time, then by session ID for consistent ordering when times are identical
    const sortedSessions = uniqueSessionsArray.sort((a, b) => {
      if (a.startTime && b.startTime) {
        const timeComparison = a.startTime.localeCompare(b.startTime);
        if (timeComparison !== 0) {
          return timeComparison;
        }
        // If start times are identical, sort by session ID for consistency
        return (a.id || '').localeCompare(b.id || '');
      }
      return 0;
    });
    
    return sortedSessions;
  };

  // Get sessions for a specific day - deduplicated by unique session
  const getSessionsForDay = (day) => {
    const globalSessions = getGlobalSessionOrderForDay(day);
    
    // Filter based on schedule type
    if (scheduleType === "my") {
      return globalSessions.filter((session) =>
        session.photographerId === userProfile?.id || 
        (session.photographerIds && session.photographerIds.includes(userProfile?.id)) ||
        (session.allPhotographers && session.allPhotographers.includes(userProfile?.id))
      );
    }
    
    return globalSessions;
  };



  // Format time to AM/PM format
  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Calculate session duration
  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return "";
    
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0 && diffMins > 0) {
      return `${diffHours}h ${diffMins}m`;
    } else if (diffHours > 0) {
      return `${diffHours}h`;
    } else if (diffMins > 0) {
      return `${diffMins}m`;
    }
    return "";
  };

  // Get school name from session
  const getSchoolName = (session) => {
    return session.schoolName || session.school?.name || "School TBD";
  };

  // Format session type for display
  const formatSessionType = (sessionType) => {
    if (!sessionType) return "";
    return sessionType.charAt(0).toUpperCase() + sessionType.slice(1);
  };

  // Get session type color for badges using organization configuration
  const getSessionTypeBadgeColor = (type) => {
    return getSessionTypeColor(type, organization);
  };

  // Get session color based on order within the day
  const getSessionColorByOrder = (orderIndex) => {
    const colors = [
      "#3b82f6", // Blue - 1st session
      "#10b981", // Green - 2nd session 
      "#8b5cf6", // Purple - 3rd session
      "#f59e0b", // Orange - 4th session
      "#ef4444", // Red - 5th session
      "#06b6d4", // Cyan - 6th session
      "#8b5a3c", // Brown - 7th session
      "#6b7280", // Gray - 8th+ sessions
    ];
    return colors[orderIndex] || colors[colors.length - 1];
  };


  // Split days into weeks
  const weeks = [];
  for (let i = 0; i < monthDays.length; i += 7) {
    weeks.push(monthDays.slice(i, i + 7));
  }

  return (
    <div className="month-view">
      {/* Day Headers */}
      <div className="month-header">
        {dayNames.map((dayName) => (
          <div key={dayName} className="month-header__cell">
            {dayName.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="month-grid">
        {monthDays.map((day, index) => {
          const daySessions = getSessionsForDay(day);
          const isOtherMonth = !isCurrentMonth(day);
          const todayClass = isToday(day) ? "month-cell--today" : "";
          const otherMonthClass = isOtherMonth ? "month-cell--other-month" : "";

          return (
            <div
              key={index}
              className={`month-cell ${todayClass} ${otherMonthClass}`}
            >
              <div className="month-cell__date">{day.getDate()}</div>

              {/* Sessions for this day */}
              {daySessions
                .slice(0, 3)
                .map((session) => {
                // Get global order for this session to determine consistent color
                const globalSessionOrder = getGlobalSessionOrderForDay(day);
                const globalOrderIndex = globalSessionOrder.findIndex(
                  globalSession => globalSession.id === session.id || 
                  (globalSession.sessionId && globalSession.sessionId === session.sessionId)
                );
                
                
                const duration = calculateDuration(session.startTime, session.endTime);
                const schoolName = getSchoolName(session);
                const sessionType = formatSessionType(session.sessionType);
                const sessionColor = getSessionColorByOrder(globalOrderIndex);
                
                return (
                  <div
                    key={session.id}
                    className="month-session"
                    style={{
                      backgroundColor: sessionColor,
                      color: "white",
                      padding: "0.4rem",
                      marginBottom: "0.2rem",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      lineHeight: "1.2"
                    }}
                    onClick={() => {
                      if (onSessionClick) {
                        onSessionClick(session);
                      }
                    }}
                  >
                    <div className="month-session__time" style={{ 
                      fontSize: "0.7rem", 
                      color: "rgba(255, 255, 255, 0.9)",
                      marginBottom: "0.2rem",
                      lineHeight: "1.2"
                    }}>
                      {formatTime(session.startTime)} - {formatTime(session.endTime)}
                      {duration && ` (${duration})`}
                    </div>
                    <div className="month-session__school" style={{ 
                      fontSize: "0.8rem", 
                      fontWeight: "600",
                      color: "white",
                      lineHeight: "1.2",
                      marginBottom: "0.2rem"
                    }}>
                      {schoolName}
                    </div>
                    {(session.sessionTypes || session.sessionType) && (
                      <div style={{ display: 'flex', gap: '0.1rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                        {(() => {
                          const sessionTypes = normalizeSessionTypes(session.sessionTypes || session.sessionType);
                          const colors = getSessionTypeColors(sessionTypes, organization);
                          const names = getSessionTypeNames(sessionTypes, organization);
                          
                          // For month view, show max 2 badges to save space
                          const maxBadges = 2;
                          const visibleTypes = sessionTypes.slice(0, maxBadges);
                          const hasMore = sessionTypes.length > maxBadges;
                          
                          return (
                            <>
                              {visibleTypes.map((type, index) => {
                                // Use custom session type if "other" is selected and custom type exists
                                let displayName = names[index];
                                if (type === 'other' && session.customSessionType) {
                                  displayName = session.customSessionType;
                                }
                                
                                return (
                                  <div
                                    key={`${type}-${index}`}
                                    className="month-session__badge"
                                    style={{
                                      fontSize: "0.5rem",
                                      backgroundColor: colors[index],
                                      color: "white",
                                      padding: "0.05rem 0.2rem",
                                      borderRadius: "0.2rem",
                                      textTransform: "capitalize",
                                      fontWeight: "500",
                                      display: "inline-block",
                                      lineHeight: "1.2"
                                    }}
                                  >
                                    {displayName}
                                  </div>
                                );
                              })}
                              {hasMore && (
                                <div
                                  style={{
                                    fontSize: "0.5rem",
                                    backgroundColor: "#6c757d",
                                    color: "white",
                                    padding: "0.05rem 0.2rem",
                                    borderRadius: "0.2rem",
                                    fontWeight: "500",
                                    display: "inline-block",
                                    lineHeight: "1.2"
                                  }}
                                >
                                  +{sessionTypes.length - maxBadges}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Show more indicator if there are additional sessions */}
              {daySessions.length > 3 && (
                <div className="month-session__more">
                  +{daySessions.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
