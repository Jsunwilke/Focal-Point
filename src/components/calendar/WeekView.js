// src/components/calendar/WeekView.js - Clean version with Multiple Photographers Support
import React, { useState } from "react";

const WeekView = ({
  currentDate,
  dateRange,
  sessions = [],
  teamMembers = [],
  scheduleType,
  userProfile,
  onUpdateSession,
  onSessionClick, // New prop for handling session clicks
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

  // Get user initials for avatar
  const getUserInitials = (member) => {
    if (member.firstName && member.lastName) {
      return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
    }
    return member.email?.[0]?.toUpperCase() || "U";
  };

  // Get user avatar component
  const getUserAvatar = (member) => {
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

  // Filter team members based on schedule type
  const displayMembers =
    scheduleType === "my"
      ? teamMembers.filter((member) => member.id === userProfile?.id)
      : teamMembers.filter((member) => member.isActive);

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

    // Check if anything actually changed
    if (
      draggedSession.photographerId === newPhotographerId &&
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

      // Update the session with the original photographer ID for accurate tracking
      const updatedSession = {
        ...draggedSession,
        photographerId: newPhotographerId,
        date: newDateString,
        originalPhotographerId: draggedSession.photographerId, // Pass the ORIGINAL photographer ID
      };

      console.log("WeekView sending update:", {
        actualSessionId,
        updatedSession,
        originalPhotographerId: draggedSession.photographerId,
        newPhotographerId: newPhotographerId,
      });

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

  // Get session color based on type
  const getSessionColor = (sessionType) => {
    switch (sessionType) {
      case "sports":
        return "#8b5cf6";
      case "portrait":
        return "#3b82f6";
      case "event":
        return "#f59e0b";
      case "graduation":
        return "#10b981";
      default:
        return "#ef4444";
    }
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
    gridTemplateColumns: "200px repeat(7, 1fr)",
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
    gridTemplateColumns: "200px repeat(7, 1fr)",
    minHeight: "80px",
    borderBottom: "1px solid var(--border-color, #dee2e6)",
  };

  const photographerCellStyle = {
    display: "flex",
    alignItems: "center",
    gap: "var(--spacing-sm, 8px)",
    padding: "var(--spacing-sm, 8px)",
    borderRight: "2px solid var(--primary-color, #007bff)",
    backgroundColor: "var(--background, #ffffff)",
    position: "sticky",
    left: 0,
    zIndex: 5,
    width: "200px",
    boxSizing: "border-box",
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

  const getSessionBlockStyle = (session) => {
    const baseStyle = {
      backgroundColor: getSessionColor(session.type),
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
        {displayMembers.map((member) => (
          <div key={member.id} className="calendar-row" style={rowStyle}>
            {/* Photographer Name Cell */}
            <div
              className="calendar-row__photographer"
              style={photographerCellStyle}
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
                  0h • $0.00
                </div>
              </div>
            </div>

            {/* Day Cells */}
            {weekDays.map((day, dayIndex) => {
              const daySessions = getSessionsForPhotographerOnDay(
                member.id,
                day
              );
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

                  {daySessions.map((session) => (
                    <div
                      key={session.id}
                      className={`session-block session-block--${session.type}`}
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, session)}
                      onDragEnd={handleDragEnd}
                      onClick={() => {
                        if (onSessionClick) {
                          onSessionClick(session);
                        }
                      }}
                      style={getSessionBlockStyle(session)}
                    >
                      <div
                        className="session-block__title"
                        style={{ fontWeight: "500", marginBottom: "2px" }}
                      >
                        {session.startTime} - {session.endTime}
                      </div>
                      <div
                        className="session-block__details"
                        style={{ opacity: 0.9, fontSize: "11px" }}
                      >
                        {session.sport} • {session.location || session.title}
                      </div>
                      {session.notes && (
                        <div
                          className="session-block__notes"
                          style={{
                            fontSize: "10px",
                            opacity: 0.8,
                            fontStyle: "italic",
                            marginTop: "2px",
                          }}
                        >
                          {session.notes.length > 30
                            ? `${session.notes.substring(0, 30)}...`
                            : session.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}

        {displayMembers.length === 0 && (
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
