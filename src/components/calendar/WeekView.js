// src/components/calendar/WeekView.js - Clean version with Multiple Photographers Support
import React, { useState } from "react";
import { getSessionTypeColor, getSessionTypeColors, getSessionTypeNames, normalizeSessionTypes } from "../../utils/sessionTypes";

const WeekView = ({
  currentDate,
  dateRange,
  sessions = [],
  teamMembers = [],
  scheduleType,
  userProfile,
  organization,
  onUpdateSession,
  onSessionClick, // New prop for handling session clicks
  onTimeOffClick, // New prop for handling time off clicks
}) => {
  const [draggedSession, setDraggedSession] = useState(null);
  const [dragOver, setDragOver] = useState({
    photographerId: null,
    date: null,
  });

  // Generate days for the week
  const generateWeekDays = () => {
    const days = [];
    const start = new Date(dateRange.start);

    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }

    return days;
  };

  const weekDays = generateWeekDays();
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  // Check if a date is today
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Get sessions for a specific photographer on a specific day
  const getSessionsForPhotographerOnDay = (photographerId, day) => {
    return sessions.filter((session) => {
      // Handle both string dates and Date objects
      let sessionDate;
      if (typeof session.date === "string") {
        // Parse YYYY-MM-DD string as local date
        const [year, month, dayOfMonth] = session.date.split("-").map(Number);
        sessionDate = new Date(year, month - 1, dayOfMonth);
      } else {
        sessionDate = new Date(session.date);
      }

      const dayFormatted = formatLocalDate(day);
      const sessionFormatted = formatLocalDate(sessionDate);

      // Handle unassigned sessions
      if (photographerId === 'unassigned') {
        return (
          (!session.photographerId && (!session.photographers || session.photographers.length === 0)) &&
          sessionFormatted === dayFormatted
        );
      }

      return (
        session.photographerId === photographerId &&
        sessionFormatted === dayFormatted
      );
    });
  };

  // Helper function to format dates consistently
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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

  // Get user initials for avatar
  const getUserInitials = (member) => {
    if (member.firstName && member.lastName) {
      return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
    }
    return member.email?.[0]?.toUpperCase() || "U";
  };

  // Get user avatar component
  const getUserAvatar = (member) => {
    // Special handling for unassigned member
    if (member.id === 'unassigned') {
      return (
        <div
          style={{
            width: "2rem",
            height: "2rem",
            borderRadius: "50%",
            backgroundColor: "#dc3545",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "var(--font-size-xs, 12px)",
            fontWeight: "var(--font-weight-semibold, 600)",
          }}
        >
          ?
        </div>
      );
    }

    if (member.photoURL) {
      return (
        <img
          src={member.photoURL}
          alt={`${member.firstName} ${member.lastName}`}
          style={{
            width: "2rem",
            height: "2rem",
            borderRadius: "50%",
            objectFit: "cover",
            border: "2px solid var(--background, #ffffff)",
          }}
        />
      );
    }
    
    // Fallback to initials
    return (
      <div
        style={{
          width: "2rem",
          height: "2rem",
          borderRadius: "50%",
          backgroundColor: "var(--text-secondary, #6c757d)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "var(--font-size-xs, 12px)",
          fontWeight: "var(--font-weight-semibold, 600)",
        }}
      >
        {getUserInitials(member)}
      </div>
    );
  };

  // Get unassigned sessions (sessions without photographers or with empty photographers array)
  const getUnassignedSessions = () => {
    const unassigned = sessions.filter((session) => {
      // Check if session has no photographers assigned
      return !session.photographerId && (!session.photographers || session.photographers.length === 0);
    });
    console.log('WeekView - Unassigned sessions found:', unassigned);
    return unassigned;
  };

  // Filter team members based on schedule type
  const displayMembers =
    scheduleType === "my"
      ? teamMembers.filter((member) => member.id === userProfile?.id)
      : teamMembers.filter((member) => member.isActive);

  // Create virtual "unassigned" member for unassigned sessions
  const unassignedMember = {
    id: 'unassigned',
    firstName: 'Unassigned',
    lastName: 'Sessions',
    email: 'unassigned@system',
    isActive: true,
    photoURL: null
  };

  // Handle unassigned sessions separately
  const unassignedSessions = getUnassignedSessions();
  const showUnassignedSection = unassignedSessions.length > 0;
  
  // Don't include unassigned member in main display members
  const finalDisplayMembers = displayMembers;

  // Calculate total hours for a photographer in the current week
  const calculatePhotographerHours = (photographerId) => {
    // Don't calculate hours for unassigned sessions
    if (photographerId === 'unassigned') {
      return 0;
    }

    const photographerSessions = sessions.filter((session) => {
      // Check if session is in current week
      let sessionDate;
      if (typeof session.date === "string") {
        const [year, month, dayOfMonth] = session.date.split("-").map(Number);
        sessionDate = new Date(year, month - 1, dayOfMonth);
      } else {
        sessionDate = new Date(session.date);
      }
      
      const weekStart = dateRange.start;
      const weekEnd = dateRange.end;
      
      return (
        session.photographerId === photographerId &&
        sessionDate >= weekStart &&
        sessionDate <= weekEnd
      );
    });

    return photographerSessions.reduce((totalHours, session) => {
      if (session.startTime && session.endTime) {
        const start = new Date(`2000-01-01 ${session.startTime}`);
        const end = new Date(`2000-01-01 ${session.endTime}`);
        const duration = (end - start) / (1000 * 60 * 60); // Convert to hours
        return totalHours + duration;
      }
      return totalHours;
    }, 0);
  };

  // Format hours for display
  const formatHours = (hours) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours % 1) * 60);
    
    if (minutes === 0) {
      return `${wholeHours}h`;
    } else {
      return `${wholeHours}h ${minutes}m`;
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, session) => {
    setDraggedSession(session);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target.outerHTML);
    e.target.style.opacity = "0.5";
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = "1";
    setDraggedSession(null);
    setDragOver({ photographerId: null, date: null });
  };

  const handleDragOver = (e, photographerId, date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const dateString = formatLocalDate(date);
    setDragOver({ photographerId, date: dateString });
  };

  const handleDragLeave = (e) => {
    // Only clear drag over if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver({ photographerId: null, date: null });
    }
  };

  const handleDrop = async (e, newPhotographerId, newDate) => {
    e.preventDefault();

    if (!draggedSession || !onUpdateSession) {
      return;
    }

    const newDateString = formatLocalDate(newDate);

    // Handle original date
    let originalDate;
    if (typeof draggedSession.date === "string") {
      originalDate = draggedSession.date;
    } else {
      const [year, month, dayOfMonth] = draggedSession.date
        .split("-")
        .map(Number);
      const dateObj = new Date(year, month - 1, dayOfMonth);
      originalDate = formatLocalDate(dateObj);
    }

    // Get original photographer ID (handle unassigned sessions)
    const originalPhotographerId = draggedSession.photographerId || 'unassigned';

    // Check if anything actually changed
    if (
      originalPhotographerId === newPhotographerId &&
      originalDate === newDateString
    ) {
      setDraggedSession(null);
      setDragOver({ photographerId: null, date: null });
      return;
    }

    try {
      // For sessions that were created from multi-photographer sessions,
      // we need to use the actual session ID, not the compound ID
      const actualSessionId = draggedSession.sessionId || draggedSession.id;

      // Update the session with the new photographer ID
      const updatedSession = {
        ...draggedSession,
        photographerId: newPhotographerId === 'unassigned' ? null : newPhotographerId,
        date: newDateString,
        originalPhotographerId: originalPhotographerId === 'unassigned' ? null : originalPhotographerId,
      };

      await onUpdateSession(actualSessionId, updatedSession);

      // Clear drag state
      setDraggedSession(null);
      setDragOver({ photographerId: null, date: null });
    } catch (error) {
      console.error("Error updating session:", error);
    }
  };

  // Check if a cell should show drag over styling
  const isDragOverCell = (photographerId, date) => {
    return (
      dragOver.photographerId === photographerId &&
      dragOver.date === formatLocalDate(date)
    );
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

  // Get session type color for badges using organization configuration
  const getSessionTypeBadgeColor = (type) => {
    return getSessionTypeColor(type, organization);
  };

  // Get global session order for consistent colors across views
  const getGlobalSessionOrderForDay = (day) => {
    const dayFormatted = formatLocalDate(day);
    
    
    // Get ALL sessions for this day across all photographers
    const allDaySessions = sessions.filter((session) => {
      let sessionDate;
      if (typeof session.date === "string") {
        const [year, month, dayOfMonth] = session.date.split("-").map(Number);
        sessionDate = new Date(year, month - 1, dayOfMonth);
      } else {
        sessionDate = new Date(session.date);
      }
      
      const sessionFormatted = formatLocalDate(sessionDate);
      return sessionFormatted === dayFormatted;
    });

    // Group sessions by unique identifier to avoid duplicates (same logic as MonthView)
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

  // Sort sessions by start time to determine order
  const getSortedSessionsForDay = (photographerId, day) => {
    const sessions = getSessionsForPhotographerOnDay(photographerId, day);
    return sessions.sort((a, b) => {
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
  };

  // Inline styles
  const containerStyle = {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  const headerStyle = {
    display: "grid",
    backgroundColor: "var(--background-secondary, #f8f9fa)",
    borderBottom: "1px solid var(--border-color, #dee2e6)",
    position: "sticky",
    top: 0,
    zIndex: 10,
    minHeight: "60px",
  };

  const headerCellStyle = {
    padding: "var(--spacing-sm, 8px)",
    textAlign: "center",
    fontSize: "var(--font-size-sm, 14px)",
    fontWeight: "var(--font-weight-medium, 500)",
    color: "var(--text-secondary, #6c757d)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    borderRight: "1px solid var(--border-color, #dee2e6)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  };

  const cornerCellStyle = {
    ...headerCellStyle,
    backgroundColor: "var(--background-muted, #e9ecef)",
    fontWeight: "var(--font-weight-semibold, 600)",
    borderRight: "2px solid var(--primary-color, #007bff)",
  };

  const todayHeaderStyle = {
    backgroundColor: "var(--primary-light, #e3f2fd)",
    color: "var(--primary-color, #007bff)",
  };

  const bodyStyle = {
    flex: 1,
    overflow: "auto",
  };

  const rowStyle = {
    display: "grid",
    minHeight: "80px",
    borderBottom: "1px solid var(--border-color, #dee2e6)",
  };

  const getPhotographerCellStyle = (member) => {
    const baseStyle = {
      display: "flex",
      alignItems: "center",
      gap: "var(--spacing-sm, 8px)",
      padding: "var(--spacing-sm, 8px)",
      borderRight: "2px solid var(--primary-color, #007bff)",
      backgroundColor: "var(--background, #ffffff)",
      position: "sticky",
      left: 0,
      zIndex: 5,
      boxSizing: "border-box",
    };

    // Special styling for unassigned row
    if (member.id === 'unassigned') {
      baseStyle.backgroundColor = "#f8f9fa";
      baseStyle.borderRight = "2px solid #dc3545";
    }

    return baseStyle;
  };

  const getDayCellStyle = (photographerId, day) => {
    const baseStyle = {
      padding: "var(--spacing-xs, 4px)",
      borderRight: "1px solid var(--border-color, #dee2e6)",
      minHeight: "80px",
      backgroundColor: "var(--background, #ffffff)",
      boxSizing: "border-box",
      position: "relative",
      transition: "background-color 0.2s ease",
    };

    // Add today styling
    if (isToday(day)) {
      baseStyle.backgroundColor = "var(--primary-light, #e3f2fd)";
    }

    // Add drag over styling
    if (isDragOverCell(photographerId, day)) {
      baseStyle.backgroundColor = "#e8f5e8";
      baseStyle.border = "2px dashed #28a745";
    }

    return baseStyle;
  };

  const getSessionBlockStyle = (session, orderIndex) => {
    // Check if this is a time off entry
    if (session.isTimeOff) {
      const baseTimeOffStyle = {
        color: "#666",
        padding: "var(--spacing-xs, 4px)",
        borderRadius: "var(--radius-sm, 4px)",
        marginBottom: "var(--spacing-xs, 4px)",
        fontSize: "var(--font-size-xs, 12px)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        userSelect: "none",
        opacity: 0.8,
      };

      // Different styling for pending vs approved status
      if (session.status === 'pending') {
        // Pending requests: dotted border, no fill
        return {
          ...baseTimeOffStyle,
          backgroundColor: "transparent",
          border: "2px dashed #007bff",
          color: "#007bff",
          fontWeight: "500",
        };
      } else if (session.status === 'approved') {
        // Approved requests: filled with pattern
        if (session.isPartialDay) {
          return {
            ...baseTimeOffStyle,
            backgroundColor: "#fff4e6",
            background: "repeating-linear-gradient(45deg, #fff4e6, #fff4e6 8px, #ffe0b3 8px, #ffe0b3 16px)",
            border: "1px solid #ff9800",
            color: "#e65100"
          };
        } else {
          return {
            ...baseTimeOffStyle,
            backgroundColor: "#e0e0e0",
            background: "repeating-linear-gradient(45deg, #e0e0e0, #e0e0e0 10px, #d0d0d0 10px, #d0d0d0 20px)",
            border: "1px solid #bbb",
          };
        }
      }
    }

    const baseStyle = {
      backgroundColor: getSessionColorByOrder(orderIndex),
      color: "white",
      padding: "var(--spacing-xs, 4px)",
      borderRadius: "var(--radius-sm, 4px)",
      marginBottom: "var(--spacing-xs, 4px)",
      fontSize: "var(--font-size-xs, 12px)",
      cursor: "grab",
      transition: "all 0.15s ease",
      userSelect: "none",
    };

    // Add dragging style
    if (
      draggedSession &&
      (draggedSession.id === session.id ||
        draggedSession.sessionId === session.sessionId)
    ) {
      baseStyle.opacity = "0.5";
      baseStyle.transform = "rotate(5deg)";
    }

    return baseStyle;
  };

  return (
    <div className="week-view" style={containerStyle}>
      {/* Unassigned Sessions Section */}
      {showUnassignedSection && (
        <div className="unassigned-section">
          {/* Unassigned Header */}
          <div className="unassigned-header" style={headerStyle}>
            {/* Corner cell for unassigned label */}
            <div
              className="calendar-header__cell calendar-header__cell--corner"
              style={{...cornerCellStyle, backgroundColor: "#f8f9fa", borderRight: "2px solid #dc3545"}}
            >
              <div className="calendar-header__day">UNASSIGNED</div>
            </div>

            {/* Day columns */}
            {weekDays.map((day, index) => (
              <div
                key={`unassigned-header-${index}`}
                className={`calendar-header__cell ${
                  isToday(day) ? "calendar-header__cell--today" : ""
                }`}
                style={{
                  ...headerCellStyle,
                  ...(isToday(day) ? todayHeaderStyle : {}),
                }}
              >
                <div
                  className="calendar-header__day"
                  style={{ marginBottom: "4px" }}
                >
                  {dayNames[index]}
                </div>
                <div
                  className={`calendar-header__date ${
                    isToday(day) ? "calendar-header__date--today" : ""
                  }`}
                  style={{
                    fontSize: "var(--font-size-lg, 16px)",
                    fontWeight: "var(--font-weight-semibold, 600)",
                  }}
                >
                  {day.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Unassigned Row */}
          <div className="calendar-row calendar-row--unassigned" style={rowStyle}>
            {/* Unassigned Label Cell */}
            <div
              className="calendar-row__photographer"
              style={getPhotographerCellStyle(unassignedMember)}
            >
              <div className="photographer-avatar">
                {getUserAvatar(unassignedMember)}
              </div>
              <div className="photographer-info" style={{ flex: 1 }}>
                <div
                  className="photographer-name"
                  style={{
                    fontSize: "var(--font-size-sm, 14px)",
                    fontWeight: "var(--font-weight-medium, 500)",
                    color: "var(--text-primary, #333)",
                  }}
                >
                  {unassignedMember.firstName} {unassignedMember.lastName}
                </div>
                <div
                  className="photographer-stats"
                  style={{
                    fontSize: "var(--font-size-xs, 12px)",
                    color: "var(--text-secondary, #6c757d)",
                  }}
                >
                  Needs Assignment
                </div>
              </div>
            </div>

            {/* Day Cells for Unassigned Sessions */}
            {weekDays.map((day, dayIndex) => {
              const daySessions = getSortedSessionsForDay('unassigned', day);
              
              return (
                <div
                  key={`unassigned-cell-${dayIndex}`}
                  className={`calendar-cell ${
                    isToday(day) ? "calendar-cell--today" : ""
                  }`}
                  style={getDayCellStyle('unassigned', day)}
                  onDragOver={(e) => handleDragOver(e, 'unassigned', day)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'unassigned', day)}
                >
                  {/* Drag Over Indicator */}
                  {isDragOverCell('unassigned', day) && (
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        fontSize: "24px",
                        color: "#28a745",
                        pointerEvents: "none",
                      }}
                    >
                      📅
                    </div>
                  )}

                  {daySessions.map((session) => {
                    // Get global order for this session
                    const globalSessionOrder = getGlobalSessionOrderForDay(day);
                    const globalOrderIndex = globalSessionOrder.findIndex(
                      globalSession => globalSession.id === session.id || 
                      (globalSession.sessionId && globalSession.sessionId === session.sessionId)
                    );
                    
                    return (
                      <div
                        key={session.id}
                        className="session-block"
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, session)}
                        onDragEnd={handleDragEnd}
                        onClick={() => {
                          if (onSessionClick) {
                            onSessionClick(session);
                          }
                        }}
                        style={{
                          ...getSessionBlockStyle(session, globalOrderIndex),
                          backgroundColor: "#dc3545",
                          border: "1px dashed #ffffff",
                          color: "white"
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
                          {session.schoolName || 'School'}
                        </div>
                        {(session.sessionTypes || session.sessionType) && (
                          <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', marginTop: '2px' }}>
                            {(() => {
                              const sessionTypes = normalizeSessionTypes(session.sessionTypes || session.sessionType);
                              const colors = getSessionTypeColors(sessionTypes, organization);
                              const names = getSessionTypeNames(sessionTypes, organization);
                              
                              return sessionTypes.map((type, index) => {
                                let displayName = names[index];
                                if (type === 'other' && session.customSessionType) {
                                  displayName = session.customSessionType;
                                }
                                
                                return (
                                  <div
                                    key={`${type}-${index}`}
                                    className="session-block__badge"
                                    style={{
                                      fontSize: "8px",
                                      backgroundColor: colors[index],
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
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Header Row with Days */}
      <div className="calendar-header" style={headerStyle}>
        {/* Corner cell for photographer column */}
        <div
          className="calendar-header__cell calendar-header__cell--corner"
          style={cornerCellStyle}
        >
          <div className="calendar-header__day">TEAM</div>
        </div>

        {/* Day columns */}
        {weekDays.map((day, index) => (
          <div
            key={`header-${index}`}
            className={`calendar-header__cell ${
              isToday(day) ? "calendar-header__cell--today" : ""
            }`}
            style={{
              ...headerCellStyle,
              ...(isToday(day) ? todayHeaderStyle : {}),
            }}
          >
            <div
              className="calendar-header__day"
              style={{ marginBottom: "4px" }}
            >
              {dayNames[index]}
            </div>
            <div
              className={`calendar-header__date ${
                isToday(day) ? "calendar-header__date--today" : ""
              }`}
              style={{
                fontSize: "var(--font-size-lg, 16px)",
                fontWeight: "var(--font-weight-semibold, 600)",
              }}
            >
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Body with Team Members and Sessions */}
      <div className="calendar-body" style={bodyStyle}>
        {finalDisplayMembers.map((member) => (
          <div key={member.id} className="calendar-row" style={rowStyle}>
            {/* Photographer Name Cell */}
            <div
              className="calendar-row__photographer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-sm, 8px)",
                padding: "var(--spacing-sm, 8px)",
                borderRight: "2px solid var(--primary-color, #007bff)",
                backgroundColor: "var(--background, #ffffff)",
                position: "sticky",
                left: 0,
                zIndex: 5,
                boxSizing: "border-box",
              }}
            >
              <div className="photographer-avatar">
                {getUserAvatar(member)}
              </div>
              <div className="photographer-info" style={{ flex: 1 }}>
                <div
                  className="photographer-name"
                  style={{
                    fontSize: "var(--font-size-sm, 14px)",
                    fontWeight: "var(--font-weight-medium, 500)",
                    color: "var(--text-primary, #333)",
                  }}
                >
                  {member.firstName} {member.lastName}
                </div>
                <div
                  className="photographer-stats"
                  style={{
                    fontSize: "var(--font-size-xs, 12px)",
                    color: "var(--text-secondary, #6c757d)",
                  }}
                >
                  {formatHours(calculatePhotographerHours(member.id))}
                </div>
              </div>
            </div>

            {/* Day Cells */}
            {weekDays.map((day, dayIndex) => {
              const daySessions = getSortedSessionsForDay(member.id, day);
              
              return (
                <div
                  key={`cell-${member.id}-${dayIndex}`}
                  className={`calendar-cell ${
                    isToday(day) ? "calendar-cell--today" : ""
                  }`}
                  style={getDayCellStyle(member.id, day)}
                  onDragOver={(e) => handleDragOver(e, member.id, day)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, member.id, day)}
                >
                  {/* Drag Over Indicator */}
                  {isDragOverCell(member.id, day) && (
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        fontSize: "24px",
                        color: "#28a745",
                        pointerEvents: "none",
                      }}
                    >
                      📅
                    </div>
                  )}

                  {daySessions.map((session) => {
                    // Get global order for this session - same logic as MonthView
                    const globalSessionOrder = getGlobalSessionOrderForDay(day);
                    const globalOrderIndex = globalSessionOrder.findIndex(
                      globalSession => globalSession.id === session.id || 
                      (globalSession.sessionId && globalSession.sessionId === session.sessionId)
                    );
                    
                    
                    return (
                      <div
                        key={session.id}
                        className="session-block"
                        draggable={!session.isTimeOff}
                        onDragStart={(e) => !session.isTimeOff && handleDragStart(e, session)}
                        onDragEnd={!session.isTimeOff ? handleDragEnd : undefined}
                        onClick={() => {
                          if (session.isTimeOff && onTimeOffClick) {
                            onTimeOffClick(session);
                          } else if (onSessionClick && !session.isTimeOff) {
                            onSessionClick(session);
                          }
                        }}
                        style={{
                          ...getSessionBlockStyle(session, globalOrderIndex),
                          ...(session.isTimeOff ? {} : {
                            backgroundColor: getSessionColorByOrder(globalOrderIndex),
                            color: "white"
                          })
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
                        {session.schoolName || 'School'}
                      </div>
                      {(session.sessionTypes || session.sessionType) && (
                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', marginTop: '2px' }}>
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
                                  className="session-block__badge"
                                  style={{
                                    fontSize: "8px",
                                    backgroundColor: colors[index],
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
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}

        {finalDisplayMembers.length === 0 && (
          <div
            className="calendar-empty"
            style={{
              padding: "var(--spacing-xl, 24px)",
              textAlign: "center",
              color: "var(--text-secondary, #6c757d)",
              fontStyle: "italic",
            }}
          >
            <p>No team members to display</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeekView;
