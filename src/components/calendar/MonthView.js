// src/components/calendar/MonthView.js
import React from "react";
import { User } from "lucide-react";
import { getSessionTypeColor, getSessionTypeColors, getSessionTypeNames, normalizeSessionTypes } from "../../utils/sessionTypes";

const MonthView = ({
  currentDate,
  sessions,
  teamMembers,
  scheduleType,
  userProfile,
  organization,
  blockedDates = [],
  onSessionClick,
  onTimeOffClick,
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

  // Helper function to format dates consistently
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Check if a date is blocked
  const isDateBlocked = (date) => {
    const dateString = formatLocalDate(date);
    return blockedDates.some(blocked => {
      const startDate = blocked.startDate.toDate ? blocked.startDate.toDate() : new Date(blocked.startDate);
      const endDate = blocked.endDate.toDate ? blocked.endDate.toDate() : new Date(blocked.endDate);
      const start = formatLocalDate(startDate);
      const end = formatLocalDate(endDate);
      return dateString >= start && dateString <= end;
    });
  };

  // Get blocked info for a date
  const getBlockedInfoForDate = (date) => {
    const dateString = formatLocalDate(date);
    const blockedRange = blockedDates.find(blocked => {
      const startDate = blocked.startDate.toDate ? blocked.startDate.toDate() : new Date(blocked.startDate);
      const endDate = blocked.endDate.toDate ? blocked.endDate.toDate() : new Date(blocked.endDate);
      const start = formatLocalDate(startDate);
      const end = formatLocalDate(endDate);
      return dateString >= start && dateString <= end;
    });
    return blockedRange;
  };

  // Get global session order for consistent colors across views
  const getGlobalSessionOrderForDay = (day) => {
    // Get ALL sessions for this day across all photographers (excluding time off)
    const allDaySessions = sessions.filter((session) => {
      // Exclude time off sessions from color ordering
      if (session.isTimeOff) {
        return false;
      }
      
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

  // Get sessions for a specific day - including time off
  const getSessionsForDay = (day) => {
    // Get ALL sessions for this day
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
    
    // Separate time off from regular sessions
    const timeOffSessions = allDaySessions.filter(s => s.isTimeOff);
    const regularSessions = allDaySessions.filter(s => !s.isTimeOff);
    
    // Group only regular sessions by unique identifier to avoid duplicates
    const uniqueSessions = {};
    regularSessions.forEach((session) => {
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
    
    // Combine grouped regular sessions with individual time off entries
    const finalSessions = [...uniqueSessionsArray, ...timeOffSessions];
    
    // Sort sessions by start time, then by end time
    const sortedSessions = finalSessions.sort((a, b) => {
      // First sort by start time
      if (a.startTime && b.startTime) {
        const startComparison = a.startTime.localeCompare(b.startTime);
        if (startComparison !== 0) {
          return startComparison;
        }
        // If start times are the same, sort by end time
        if (a.endTime && b.endTime) {
          return a.endTime.localeCompare(b.endTime);
        }
      }
      // Keep time off sessions at the end if no time specified
      if (a.isTimeOff && !b.isTimeOff) return 1;
      if (!a.isTimeOff && b.isTimeOff) return -1;
      return 0;
    });
    
    // Filter based on schedule type
    if (scheduleType === "my") {
      return sortedSessions.filter((session) =>
        session.photographerId === userProfile?.id || 
        (session.photographerIds && session.photographerIds.includes(userProfile?.id)) ||
        (session.allPhotographers && session.allPhotographers.includes(userProfile?.id))
      );
    }
    
    return sortedSessions;
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
    if (session.isTimeOff) {
      return session.reason || "Time Off";
    }
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
    // Use custom colors from organization settings if available
    const customColors = organization?.sessionOrderColors;
    const defaultColors = [
      "#3b82f6", // Blue - 1st session
      "#10b981", // Green - 2nd session 
      "#8b5cf6", // Purple - 3rd session
      "#f59e0b", // Orange - 4th session
      "#ef4444", // Red - 5th session
      "#06b6d4", // Cyan - 6th session
      "#8b5a3c", // Brown - 7th session
      "#6b7280", // Gray - 8th+ sessions
    ];
    
    const colors = customColors && customColors.length >= 8 ? customColors : defaultColors;
    return colors[orderIndex] || colors[colors.length - 1];
  };

  // Get time off styling based on status
  const getTimeOffStyle = (session) => {
    if (!session.isTimeOff) return {};
    
    if (session.status === 'pending') {
      return {
        backgroundColor: "transparent",
        border: "2px dashed #007bff",
        color: "#007bff"
      };
    } else if (session.status === 'under_review') {
      return {
        backgroundColor: "transparent",
        border: "2px dashed #ff6b35",
        color: "#ff6b35"
      };
    } else if (session.status === 'approved') {
      // Match the week view styling for approved time off
      if (session.isPartialDay) {
        return {
          backgroundColor: "#fff4e6",
          background: "repeating-linear-gradient(45deg, #fff4e6, #fff4e6 8px, #ffe0b3 8px, #ffe0b3 16px)",
          border: "1px solid #ff9800",
          color: "#e65100"
        };
      } else {
        return {
          backgroundColor: "#e0e0e0",
          background: "repeating-linear-gradient(45deg, #e0e0e0, #e0e0e0 10px, #d0d0d0 10px, #d0d0d0 20px)",
          border: "1px solid #bbb",
          color: "#333"
        };
      }
    }
    
    return {};
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

      {/* Calendar Body */}
      <div className="month-body">
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
              style={{
                backgroundColor: isDateBlocked(day) ? '#ffe6e6' : 'transparent',
                position: 'relative'
              }}
            >
              <div className="month-cell__date">{day.getDate()}</div>
              
              {/* Blocked Date Indicator */}
              {isDateBlocked(day) && (
                <div
                  style={{
                    position: "absolute",
                    top: "2px",
                    right: "2px",
                    fontSize: "9px",
                    color: "#dc3545",
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    padding: "1px 3px",
                    borderRadius: "3px",
                    fontWeight: "500",
                  }}
                  title={getBlockedInfoForDate(day)?.reason || "Blocked"}
                >
                  BLOCKED
                </div>
              )}

              {/* Sessions for this day */}
              {daySessions
                .map((session) => {
                // Get global order for this session to determine consistent color
                const globalSessionOrder = getGlobalSessionOrderForDay(day);
                const globalOrderIndex = globalSessionOrder.findIndex(
                  globalSession => globalSession.id === session.id || 
                  (globalSession.sessionId && globalSession.sessionId === session.sessionId)
                );
                
                
                const schoolName = getSchoolName(session);
                const sessionType = formatSessionType(session.sessionType);
                const sessionColor = getSessionColorByOrder(globalOrderIndex);
                const photographerCount = session.allPhotographers?.length || 1;
                
                // Check if session is unpublished
                const isUnpublished = session.isPublished === false;
                const unpublishedSessionColor = session.photographerId === null || session.photographerId === undefined 
                  ? "#dc3545" 
                  : sessionColor;
                
                return (
                  <div
                    key={session.id}
                    className="month-session"
                    style={{
                      backgroundColor: isUnpublished ? unpublishedSessionColor + "40" : sessionColor,
                      color: isUnpublished ? unpublishedSessionColor : "white",
                      border: isUnpublished ? `2px dashed ${unpublishedSessionColor}` : "none",
                      padding: "0.3rem 0.4rem",
                      marginBottom: "0.2rem",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      lineHeight: "1.2",
                      ...getTimeOffStyle(session)
                    }}
                    onClick={() => {
                      if (session.isTimeOff && onTimeOffClick) {
                        onTimeOffClick(session);
                      } else if (onSessionClick && !session.isTimeOff) {
                        onSessionClick(session);
                      }
                    }}
                  >
                    <div style={{ 
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.75rem", 
                      color: session.isTimeOff ? "#666" : (isUnpublished ? "inherit" : "rgba(255, 255, 255, 0.9)"),
                      marginBottom: "0.15rem",
                      lineHeight: "1"
                    }}>
                      <span>{formatTime(session.startTime)} - {formatTime(session.endTime)}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.2rem", color: "inherit" }}>
                        <User size={10} />
                        <span>{photographerCount}</span>
                      </span>
                    </div>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.15rem"
                    }}>
                      <div className="month-session__school" style={{ 
                        fontSize: "0.75rem", 
                        fontWeight: "500",
                        color: session.isTimeOff ? "inherit" : (isUnpublished ? "inherit" : "white"),
                        lineHeight: "1.1",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1
                      }}>
                        {schoolName}
                      </div>
                      {session.isTimeOff && (
                        <span style={{ 
                          fontSize: "0.65rem", 
                          textTransform: "capitalize",
                          color: "inherit",
                          marginLeft: "0.5rem"
                        }}>
                          {session.status}
                        </span>
                      )}
                    </div>
                    {((session.sessionTypes || session.sessionType) || session.isTimeOff) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.1rem', marginTop: '0.1rem' }}>
                        {(session.sessionTypes || session.sessionType) && (
                          <div style={{ display: 'flex', gap: '0.1rem', flexWrap: 'wrap' }}>
                            {(() => {
                              const sessionTypes = normalizeSessionTypes(session.sessionTypes || session.sessionType);
                              const colors = getSessionTypeColors(sessionTypes, organization);
                              const names = getSessionTypeNames(sessionTypes, organization);
                              
                              return sessionTypes.map((type, index) => {
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
                                      padding: "0.1rem 0.15rem",
                                      borderRadius: "0.15rem",
                                      textTransform: "capitalize",
                                      fontWeight: "500",
                                      display: "inline-block",
                                      lineHeight: "1"
                                    }}
                                  >
                                    {displayName}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        )}
                        {session.isTimeOff && (
                          <span style={{ 
                            fontSize: "0.65rem", 
                            fontWeight: "500",
                            color: "inherit",
                            marginLeft: "auto"
                          }}>
                            {session.photographerName}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default MonthView;
