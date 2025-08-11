// src/components/calendar/WeekView.js - Clean version with Multiple Photographers Support
import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Menu } from "lucide-react";
import { getSessionTypeColor, getSessionTypeColors, getSessionTypeNames, normalizeSessionTypes } from "../../utils/sessionTypes";
import { updateSession } from "../../firebase/firestore";

const WeekView = ({
  currentDate,
  dateRange,
  sessions = [],
  teamMembers = [],
  scheduleType,
  userProfile,
  organization,
  blockedDates = [],
  isAdmin,
  onUpdateSession,
  onSessionClick, // New prop for handling session clicks
  onTimeOffClick, // New prop for handling time off clicks
  onHeaderDateClick, // New prop for handling header date clicks
  onAddSession, // New prop for handling add session clicks
  onEmployeeReorder, // New prop for handling employee reordering
  onResetEmployeeOrder, // New prop for resetting employee order
  hasCustomOrder, // New prop to show/hide reset button
}) => {
  const [draggedSession, setDraggedSession] = useState(null);
  const [dragOver, setDragOver] = useState({
    photographerId: null,
    date: null,
  });
  const [hoveredCell, setHoveredCell] = useState({
    photographerId: null,
    date: null,
  });
  const [draggedEmployee, setDraggedEmployee] = useState(null);
  const [dragOverEmployee, setDragOverEmployee] = useState(null);
  const [dropPosition, setDropPosition] = useState(null);
  
  // No tracking needed - only update legacy sessions once // "before" or "after"

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
    if (member.displayName) {
      const parts = member.displayName.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return member.displayName[0]?.toUpperCase() || "U";
    }
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
          alt={member.displayName || `${member.firstName} ${member.lastName}`}
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
      : teamMembers.filter((member) => member.isActive && !member.isAccountant);

  // Create virtual "unassigned" member for unassigned sessions
  const unassignedMember = {
    id: 'unassigned',
    firstName: 'Unassigned',
    lastName: 'Sessions',
    email: 'unassigned@system',
    isActive: true,
    photoURL: null
  };

  // Memoize unassigned sessions calculation to prevent recalculation on every render
  const unassignedSessions = useMemo(() => {
    const unassigned = sessions.filter((session) => {
      // Check if session has no photographers assigned
      return !session.photographerId && (!session.photographers || session.photographers.length === 0);
    });
    
    return unassigned;
  }, [sessions]);

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

  // Hover handlers
  const handleCellMouseEnter = (photographerId, date) => {
    setHoveredCell({
      photographerId,
      date: formatLocalDate(date)
    });
  };

  const handleCellMouseLeave = () => {
    setHoveredCell({
      photographerId: null,
      date: null
    });
  };

  // Check if a cell is being hovered
  const isHoveredCell = (photographerId, date) => {
    return (
      hoveredCell.photographerId === photographerId &&
      hoveredCell.date === formatLocalDate(date)
    );
  };

  // Handle add session click
  const handleAddSessionClick = (photographerId, date) => {
    if (onAddSession) {
      onAddSession(photographerId, date);
    }
  };

  // Employee drag handlers
  const handleEmployeeDragStart = (e, member) => {
    setDraggedEmployee(member);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleEmployeeDragOver = (e, memberId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    // Calculate if we're in the top or bottom half of the row
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const position = y < rect.height / 2 ? "before" : "after";
    
    setDragOverEmployee(memberId);
    setDropPosition(position);
  };

  const handleEmployeeDragLeave = () => {
    setDragOverEmployee(null);
    setDropPosition(null);
  };

  const handleEmployeeDrop = (e, targetMember) => {
    e.preventDefault();
    
    if (draggedEmployee && draggedEmployee.id !== targetMember.id && onEmployeeReorder) {
      onEmployeeReorder(draggedEmployee.id, targetMember.id);
    }
    
    setDraggedEmployee(null);
    setDragOverEmployee(null);
    setDropPosition(null);
  };

  const handleEmployeeDragEnd = () => {
    setDraggedEmployee(null);
    setDragOverEmployee(null);
    setDropPosition(null);
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

  // Smart session color updates - only for legacy sessions missing sessionColor
  const updateSessionColorIfNeeded = async (session, calculatedColor) => {
    // Only update legacy sessions that don't have a sessionColor field yet
    if (!session || !session.id || session.isTimeOff || !calculatedColor) {
      return;
    }
    
    // Only update if session has no sessionColor field (legacy session)
    if (session.sessionColor !== undefined) {
      return; // Session already has a color, don't update
    }

    try {
      await updateSession(session.id, { sessionColor: calculatedColor });
    } catch (error) {
      console.error("Failed to update legacy session color:", error);
    }
  };

  // Get session type color for badges using organization configuration
  const getSessionTypeBadgeColor = (type) => {
    return getSessionTypeColor(type, organization);
  };

  // Get global session order for consistent colors across views
  const getGlobalSessionOrderForDay = (day) => {
    const dayFormatted = formatLocalDate(day);
    
    
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
    backgroundColor: "#e9f1fc",
    color: "var(--primary-color, #007bff)",
  };

  const bodyStyle = {
    flex: 1,
    minHeight: 0,
    paddingBottom: "80px",
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
      baseStyle.backgroundColor = "#e9f1fc";
    }

    // Add drag over styling (highest priority)
    if (isDragOverCell(photographerId, day)) {
      baseStyle.backgroundColor = "#e8f5e8";
      baseStyle.border = "2px dashed #28a745";
    }

    return baseStyle;
  };

  const getSessionBlockStyle = (session, orderIndex, isHovered = false) => {
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
        width: isHovered ? "calc(100% - 35px)" : "100%",
      };

      // Different styling for pending vs approved status
      if (session.status === 'pending') {
        // Pending requests: blue dashed border, no fill
        return {
          ...baseTimeOffStyle,
          backgroundColor: "transparent",
          border: "2px dashed #007bff",
          color: "#007bff",
          fontWeight: "500",
        };
      } else if (session.status === 'under_review') {
        // Under review requests: orange dashed border, no fill
        return {
          ...baseTimeOffStyle,
          backgroundColor: "transparent",
          border: "2px dashed #ff6b35",
          color: "#ff6b35",
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
            color: "#333",
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
      width: isHovered ? "calc(100% - 35px)" : "100%",
    };
    
    // Apply unpublished styling if session is not published
    if (session.isPublished === false) {
      // For unassigned sessions, use red color
      const sessionColor = session.photographerId === null || session.photographerId === undefined 
        ? "#dc3545" 
        : getSessionColorByOrder(orderIndex);
      
      baseStyle.border = "2px dashed " + sessionColor;
      baseStyle.backgroundColor = sessionColor + "40"; // 40 = 25% opacity in hex
      baseStyle.color = sessionColor;
    }

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
                  ...(isDateBlocked(day) ? { backgroundColor: '#ffe6e6' } : {}),
                  position: 'relative'
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
                    cursor: isAdmin ? (isDateBlocked(day) ? "not-allowed" : "pointer") : "default",
                    userSelect: "none",
                  }}
                  onClick={() => {
                    if (isAdmin && onHeaderDateClick && !isDateBlocked(day)) {
                      onHeaderDateClick(day);
                    }
                  }}
                  title={
                    isAdmin 
                      ? (isDateBlocked(day) 
                          ? `Already blocked: ${getBlockedInfoForDate(day)?.reason || "Blocked"}` 
                          : "Click to block this date")
                      : ""
                  }
                >
                  {day.getDate()}
                </div>
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
                      padding: "1px 4px",
                      borderRadius: "3px",
                      fontWeight: "500",
                      whiteSpace: "nowrap",
                    }}
                    title={getBlockedInfoForDate(day)?.reason || "Blocked"}
                  >
                    BLOCKED
                  </div>
                )}
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
                  onMouseEnter={() => handleCellMouseEnter('unassigned', day)}
                  onMouseLeave={handleCellMouseLeave}
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

                  {/* Add Session Button - Only for admins/managers */}
                  {isHoveredCell('unassigned', day) && onAddSession && 
                   (userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                    <button
                      className="calendar-cell__add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddSessionClick('unassigned', day);
                      }}
                      style={{
                        position: "absolute",
                        top: daySessions.length > 0 ? "4px" : "50%",
                        right: daySessions.length > 0 ? "4px" : "50%",
                        transform: daySessions.length > 0 ? "none" : "translate(50%, -50%)",
                        width: daySessions.length > 0 ? "28px" : "80%",
                        height: daySessions.length > 0 ? "calc(100% - 8px)" : "80%",
                        borderRadius: "4px",
                        backgroundColor: "transparent",
                        border: "2px solid #007bff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        opacity: 0.85,
                        transition: "all 0.2s ease",
                        zIndex: 10,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.backgroundColor = "rgba(0, 123, 255, 0.1)";
                        e.currentTarget.style.transform = daySessions.length > 0 ? "scale(1.05)" : "translate(50%, -50%) scale(1.05)";
                        e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "0.85";
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.transform = daySessions.length > 0 ? "scale(1)" : "translate(50%, -50%) scale(1)";
                        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.15)";
                      }}
                      title="Add session"
                    >
                      <Plus size={daySessions.length > 0 ? 20 : 16} color="#007bff" />
                    </button>
                  )}


                  {daySessions.map((session) => {
                    // Calculate the color based on global order
                    const globalSessionOrder = getGlobalSessionOrderForDay(day);
                    const globalOrderIndex = globalSessionOrder.findIndex(
                      globalSession => globalSession.id === session.id || 
                      (globalSession.sessionId && globalSession.sessionId === session.sessionId)
                    );
                    
                    // Handle case where session is not found in global order
                    const validOrderIndex = globalOrderIndex >= 0 ? globalOrderIndex : 0;
                    const calculatedColor = getSessionColorByOrder(validOrderIndex);
                    
                    // Use stored sessionColor if available, otherwise use calculated color
                    const sessionColor = session.sessionColor || calculatedColor;
                    
                    // DISABLED: Update legacy sessions that don't have sessionColor field
                    // updateSessionColorIfNeeded(session, calculatedColor);
                    
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
                          backgroundColor: sessionColor,
                          color: "white",
                          padding: "var(--spacing-xs, 4px)",
                          borderRadius: "var(--radius-sm, 4px)",
                          marginBottom: "var(--spacing-xs, 4px)",
                          fontSize: "var(--font-size-xs, 12px)",
                          cursor: "grab",
                          transition: "all 0.15s ease",
                          userSelect: "none",
                          minWidth: 0,
                          display: "flex",
                          flexDirection: "column",
                          ...(session.isPublished === false ? {
                            border: "2px dashed " + sessionColor,
                            backgroundColor: sessionColor + "40",
                            color: sessionColor
                          } : {}),
                          ...(session.isPublished !== false ? {
                            backgroundColor: "#dc3545",
                            border: "1px dashed #ffffff",
                            color: "white"
                          } : {})
                        }}
                      >
                        <div
                          className="session-block__time"
                          style={{ 
                            fontSize: "11px",
                            fontWeight: "500",
                            marginBottom: "3px",
                            opacity: 0.9,
                            lineHeight: "1.2",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: "0 0 auto"
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
                            fontSize: "11px",
                            fontWeight: "600",
                            lineHeight: "1.2",
                            color: session.isTimeOff ? "#333" : (session.isPublished === false ? "#333" : "white"),
                            marginBottom: "3px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: "1 1 auto",
                            minWidth: 0
                          }}
                        >
                          {session.isTimeOff ? (session.reason || 'Time Off') : (session.schoolName || 'School')}
                        </div>
                        {(session.sessionTypes || session.sessionType) && (
                          <div style={{ display: 'flex', gap: '2px', flexWrap: 'nowrap', marginTop: '2px', overflow: 'hidden' }}>
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
                        {(session.notes || session.photographerNotes) && (
                          <div
                            className="session-block__notes"
                            style={{
                              fontSize: "10px",
                              opacity: 0.7,
                              fontStyle: "italic",
                              marginTop: "3px",
                              borderTop: "1px solid rgba(255,255,255,0.2)",
                              paddingTop: "2px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: "0 0 auto"
                            }}
                          >
                            {session.photographerNotes && !session.notes && "📝 "}
                            {session.notes || (session.photographerNotes ? "Has photographer notes" : "")}
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
          style={{
            ...cornerCellStyle,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div className="calendar-header__day">TEAM</div>
          {hasCustomOrder && onResetEmployeeOrder && (
            <button
              onClick={onResetEmployeeOrder}
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "500",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#0056b3";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#007bff";
              }}
              title="Reset to alphabetical order"
            >
              Reset Order
            </button>
          )}
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
              ...(isDateBlocked(day) ? { backgroundColor: '#ffe6e6' } : {}),
              position: 'relative',
              cursor: isDateBlocked(day) ? "not-allowed" : "pointer",
              userSelect: "none",
              transition: "background-color 0.2s"
            }}
            onClick={(event) => {
              if (onHeaderDateClick && !isDateBlocked(day)) {
                onHeaderDateClick(day, event);
              }
            }}
            onMouseEnter={(e) => {
              if (!isDateBlocked(day)) {
                e.currentTarget.style.backgroundColor = isToday(day) ? '#e6f3ff' : '#f0f8ff';
              }
            }}
            onMouseLeave={(e) => {
              if (!isDateBlocked(day)) {
                e.currentTarget.style.backgroundColor = isToday(day) ? todayHeaderStyle.backgroundColor : '';
              } else {
                e.currentTarget.style.backgroundColor = '#ffe6e6';
              }
            }}
            title={
              isDateBlocked(day) 
                ? `Already blocked: ${getBlockedInfoForDate(day)?.reason || "Blocked"}`
                : isAdmin 
                  ? "Shift+Click to block date, Click to view day"
                  : "Click to view day"
            }
          >
            <div
              className="calendar-header__day"
              style={{ marginBottom: "4px", pointerEvents: "none" }}
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
                pointerEvents: "none"
              }}
            >
              {day.getDate()}
            </div>
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
                  padding: "1px 4px",
                  borderRadius: "3px",
                  fontWeight: "500",
                  whiteSpace: "nowrap",
                }}
                title={getBlockedInfoForDate(day)?.reason || "Blocked"}
              >
                BLOCKED
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Body with Team Members and Sessions */}
      <div className="calendar-body" style={bodyStyle}>
        {finalDisplayMembers.map((member) => (
          <div 
            key={member.id} 
            className="calendar-row" 
            style={{
              ...rowStyle,
              opacity: draggedEmployee?.id === member.id ? 0.5 : 1,
              backgroundColor: dragOverEmployee === member.id && !dropPosition ? "rgba(0, 123, 255, 0.05)" : "transparent",
              transition: "background-color 0.2s ease",
              position: "relative",
            }}
            draggable={isAdmin || userProfile?.role === 'manager'}
            onDragStart={(e) => handleEmployeeDragStart(e, member)}
            onDragOver={(e) => handleEmployeeDragOver(e, member.id)}
            onDragLeave={handleEmployeeDragLeave}
            onDrop={(e) => handleEmployeeDrop(e, member)}
            onDragEnd={handleEmployeeDragEnd}
          >
            {/* Drop Indicator Line */}
            {dropPosition && dragOverEmployee === member.id && draggedEmployee && draggedEmployee.id !== member.id && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: "2px",
                  backgroundColor: "#007bff",
                  top: dropPosition === "before" ? -1 : "auto",
                  bottom: dropPosition === "after" ? -1 : "auto",
                  zIndex: 10,
                  pointerEvents: "none",
                }}
              />
            )}
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
                cursor: (isAdmin || userProfile?.role === 'manager') ? "move" : "default",
              }}
            >
              {/* Drag Handle */}
              {(isAdmin || userProfile?.role === 'manager') && (
                <div 
                  style={{
                    color: "#6c757d",
                    cursor: "grab",
                    marginRight: "-4px",
                  }}
                  title="Drag to reorder"
                >
                  <Menu size={16} />
                </div>
              )}
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
                  {member.displayName || `${member.firstName} ${member.lastName}`}
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
                  onMouseEnter={() => handleCellMouseEnter(member.id, day)}
                  onMouseLeave={handleCellMouseLeave}
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

                  {/* Add Session Button - Only for admins/managers */}
                  {isHoveredCell(member.id, day) && onAddSession && 
                   (userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                    <button
                      className="calendar-cell__add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddSessionClick(member.id, day);
                      }}
                      style={{
                        position: "absolute",
                        top: daySessions.length > 0 ? "4px" : "50%",
                        right: daySessions.length > 0 ? "4px" : "50%",
                        transform: daySessions.length > 0 ? "none" : "translate(50%, -50%)",
                        width: daySessions.length > 0 ? "28px" : "80%",
                        height: daySessions.length > 0 ? "calc(100% - 8px)" : "80%",
                        borderRadius: "4px",
                        backgroundColor: "transparent",
                        border: "2px solid #007bff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        opacity: 0.85,
                        transition: "all 0.2s ease",
                        zIndex: 10,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.backgroundColor = "rgba(0, 123, 255, 0.1)";
                        e.currentTarget.style.transform = daySessions.length > 0 ? "scale(1.05)" : "translate(50%, -50%) scale(1.05)";
                        e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "0.85";
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.transform = daySessions.length > 0 ? "scale(1)" : "translate(50%, -50%) scale(1)";
                        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.15)";
                      }}
                      title="Add session"
                    >
                      <Plus size={daySessions.length > 0 ? 20 : 16} color="#007bff" />
                    </button>
                  )}


                  {daySessions.map((session) => {
                    // Calculate the color based on global order (skip for time off)
                    let sessionColor = "#666"; // Default for time off
                    if (!session.isTimeOff) {
                      const globalSessionOrder = getGlobalSessionOrderForDay(day);
                      const globalOrderIndex = globalSessionOrder.findIndex(
                        globalSession => globalSession.id === session.id || 
                        (globalSession.sessionId && globalSession.sessionId === session.sessionId)
                      );
                      
                      // Handle case where session is not found in global order
                      const validOrderIndex = globalOrderIndex >= 0 ? globalOrderIndex : 0;
                      const calculatedColor = getSessionColorByOrder(validOrderIndex);
                      
                      // Use stored sessionColor if available, otherwise use calculated color
                      sessionColor = session.sessionColor || calculatedColor;
                      
                      // DISABLED: Update legacy sessions that don't have sessionColor field
                      // updateSessionColorIfNeeded(session, calculatedColor);
                    }
                    
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
                          ...getSessionBlockStyle(session, null, isHoveredCell(member.id, day)),
                          ...(session.isTimeOff ? {} : {
                            backgroundColor: sessionColor,
                            color: "white"
                          }),
                          ...(session.isPublished === false && !session.isTimeOff ? {
                            border: "2px dashed " + sessionColor,
                            backgroundColor: sessionColor + "40",
                            color: sessionColor
                          } : {}),
                          minWidth: 0,
                          display: "flex",
                          flexDirection: "column"
                        }}
                      >
                      <div
                        className="session-block__time"
                        style={{ 
                          fontSize: "11px",
                          fontWeight: "500",
                          marginBottom: "3px",
                          opacity: 0.9,
                          lineHeight: "1.2",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: "0 0 auto"
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
                          fontSize: "11px",
                          fontWeight: "600",
                          lineHeight: "1.2",
                          color: session.isTimeOff ? "#333" : (session.isPublished === false ? "#333" : "white"),
                          marginBottom: "3px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: "1 1 auto",
                          minWidth: 0
                        }}
                      >
                        {session.isTimeOff ? (session.reason || 'Time Off') : (session.schoolName || 'School')}
                      </div>
                      {(session.sessionTypes || session.sessionType) && (
                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'nowrap', marginTop: '2px', overflow: 'hidden' }}>
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
                      {(session.notes || session.photographerNotes) && (
                        <div
                          className="session-block__notes"
                          style={{
                            fontSize: "10px",
                            opacity: 0.7,
                            fontStyle: "italic",
                            marginTop: "3px",
                            borderTop: "1px solid rgba(255,255,255,0.2)",
                            paddingTop: "2px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: "0 0 auto"
                          }}
                        >
                          {session.photographerNotes && !session.notes && "📝 "}
                          {session.notes || (session.photographerNotes ? "Has photographer notes" : "")}
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
