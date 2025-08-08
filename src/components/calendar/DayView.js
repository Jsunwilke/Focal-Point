// src/components/calendar/DayView.js - Horizontal Timeline Day View
import React, { useState, useEffect, useRef } from "react";
import { Plus, Menu } from "lucide-react";
import { getSessionTypeColors, getSessionTypeNames, normalizeSessionTypes } from "../../utils/sessionTypes";
import "./DayView.css";

const DayView = ({
  currentDate,
  sessions = [],
  teamMembers = [],
  scheduleType,
  userProfile,
  organization,
  blockedDates = [],
  isAdmin,
  onUpdateSession,
  onSessionClick,
  onTimeOffClick,
  onAddSession,
  onEmployeeReorder,
  onResetEmployeeOrder,
  hasCustomOrder,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [draggedSession, setDraggedSession] = useState(null);
  const [draggedEmployee, setDraggedEmployee] = useState(null);
  const [dragOverEmployee, setDragOverEmployee] = useState(null);
  const [hoveredTimeSlot, setHoveredTimeSlot] = useState(null);
  const timelineRef = useRef(null);
  const employeesRef = useRef(null);
  const timelineContainerRef = useRef(null);
  const unassignedTimelineRef = useRef(null);
  const headerTimelineRef = useRef(null);

  // Configuration
  const START_HOUR = 6; // 6 AM
  const END_HOUR = 22; // 10 PM
  const TOTAL_HOURS = END_HOUR - START_HOUR;
  const HOUR_WIDTH = 100; // pixels per hour
  const TIMELINE_WIDTH = (TOTAL_HOURS + 1) * HOUR_WIDTH; // Add extra hour for space after END_HOUR
  const PIXELS_PER_MINUTE = HOUR_WIDTH / 60;
  const BASE_SESSION_HEIGHT = 75; // Base height for session cards without notes
  const SESSION_WITH_NOTES_HEIGHT = 95; // Height for session cards with notes
  const SESSION_SPACING = 4; // Spacing between stacked sessions
  const BASE_ROW_HEIGHT = 90; // Base height when no stacking

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Synchronize vertical scrolling between employees and timeline
  useEffect(() => {
    const handleEmployeeScroll = () => {
      if (timelineContainerRef.current && employeesRef.current) {
        timelineContainerRef.current.scrollTop = employeesRef.current.scrollTop;
      }
    };

    const handleTimelineScroll = () => {
      if (employeesRef.current && timelineContainerRef.current) {
        employeesRef.current.scrollTop = timelineContainerRef.current.scrollTop;
      }
    };
    
    // Synchronize horizontal scrolling for unassigned section
    const handleUnassignedScroll = () => {
      if (unassignedTimelineRef.current && timelineContainerRef.current) {
        timelineContainerRef.current.scrollLeft = unassignedTimelineRef.current.scrollLeft;
      }
    };
    
    const handleMainTimelineHorizontalScroll = () => {
      if (unassignedTimelineRef.current && timelineContainerRef.current) {
        unassignedTimelineRef.current.scrollLeft = timelineContainerRef.current.scrollLeft;
      }
      // Also sync the header timeline
      if (headerTimelineRef.current && timelineContainerRef.current) {
        headerTimelineRef.current.scrollLeft = timelineContainerRef.current.scrollLeft;
      }
    };
    
    // Synchronize header timeline horizontal scrolling
    const handleHeaderTimelineScroll = () => {
      if (headerTimelineRef.current && timelineContainerRef.current) {
        timelineContainerRef.current.scrollLeft = headerTimelineRef.current.scrollLeft;
      }
      if (headerTimelineRef.current && unassignedTimelineRef.current) {
        unassignedTimelineRef.current.scrollLeft = headerTimelineRef.current.scrollLeft;
      }
    };

    const employeesEl = employeesRef.current;
    const timelineEl = timelineContainerRef.current;
    const unassignedTimelineEl = unassignedTimelineRef.current;
    const headerTimelineEl = headerTimelineRef.current;

    if (employeesEl) {
      employeesEl.addEventListener('scroll', handleEmployeeScroll);
    }
    if (timelineEl) {
      timelineEl.addEventListener('scroll', handleTimelineScroll);
      timelineEl.addEventListener('scroll', handleMainTimelineHorizontalScroll);
    }
    if (unassignedTimelineEl) {
      unassignedTimelineEl.addEventListener('scroll', handleUnassignedScroll);
    }
    if (headerTimelineEl) {
      headerTimelineEl.addEventListener('scroll', handleHeaderTimelineScroll);
    }

    return () => {
      if (employeesEl) {
        employeesEl.removeEventListener('scroll', handleEmployeeScroll);
      }
      if (timelineEl) {
        timelineEl.removeEventListener('scroll', handleTimelineScroll);
        timelineEl.removeEventListener('scroll', handleMainTimelineHorizontalScroll);
      }
      if (unassignedTimelineEl) {
        unassignedTimelineEl.removeEventListener('scroll', handleUnassignedScroll);
      }
      if (headerTimelineEl) {
        headerTimelineEl.removeEventListener('scroll', handleHeaderTimelineScroll);
      }
    };
  }, []);

  // Generate hour labels
  const generateHourLabels = () => {
    const hours = [];
    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
      hours.push(hour);
    }
    return hours;
  };

  const hourLabels = generateHourLabels();

  // Format hour for display
  const formatHour = (hour) => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  // Format time for current time indicator
  const formatCurrentTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  // Calculate current time position
  const getCurrentTimePosition = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Only show indicator during business hours
    if (hours < START_HOUR || hours >= END_HOUR) {
      return null;
    }
    
    const hoursFromStart = hours - START_HOUR;
    const totalMinutes = hoursFromStart * 60 + minutes;
    return totalMinutes * PIXELS_PER_MINUTE;
  };

  const currentTimePosition = getCurrentTimePosition();

  // Format date for display
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Check if viewing today
  const isToday = () => {
    const today = new Date();
    return currentDate.toDateString() === today.toDateString();
  };

  // Get user initials for avatar
  const getUserInitials = (member) => {
    if (member.id === 'unassigned') {
      return '?';
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
            fontSize: "12px",
            fontWeight: "600",
          }}
        >
          ?
        </div>
      );
    }

    if (member.profilePhotoUrl || member.photoURL) {
      return (
        <img
          src={member.profilePhotoUrl || member.photoURL}
          alt={`${member.firstName} ${member.lastName}`}
          style={{
            width: "2rem",
            height: "2rem",
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      );
    }

    // Generate color based on user ID
    const colors = [
      "#4A90E2", "#7B68EE", "#00CED1", "#20B2AA",
      "#48D1CC", "#4682B4", "#1E90FF", "#6495ED",
    ];
    const colorIndex = member.id ? 
      member.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length 
      : 0;
    const backgroundColor = colors[colorIndex];

    return (
      <div
        style={{
          width: "2rem",
          height: "2rem",
          borderRadius: "50%",
          backgroundColor,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: "600",
        }}
      >
        {getUserInitials(member)}
      </div>
    );
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

  // Calculate photographer hours for the day
  const calculatePhotographerHours = (photographerId) => {
    const daySessions = getSessionsForPhotographer(photographerId);
    
    return daySessions.reduce((total, session) => {
      if (!session.startTime || !session.endTime || session.isTimeOff) {
        return total;
      }
      
      const [startHour, startMin] = session.startTime.split(':').map(Number);
      const [endHour, endMin] = session.endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const sessionMinutes = endMinutes - startMinutes;
      
      return total + (sessionMinutes / 60);
    }, 0);
  };

  // Check if date is blocked
  const isDateBlocked = () => {
    const dateString = formatLocalDate(currentDate);
    return blockedDates.some(blocked => {
      const startDate = blocked.startDate.toDate ? blocked.startDate.toDate() : new Date(blocked.startDate);
      const endDate = blocked.endDate.toDate ? blocked.endDate.toDate() : new Date(blocked.endDate);
      const start = formatLocalDate(startDate);
      const end = formatLocalDate(endDate);
      return dateString >= start && dateString <= end;
    });
  };

  // Get sessions for a specific photographer on current day
  const getSessionsForPhotographer = (photographerId) => {
    const currentDateStr = formatLocalDate(currentDate);
    
    return sessions.filter((session) => {
      // Handle date comparison
      let sessionDate;
      if (typeof session.date === "string") {
        sessionDate = session.date;
      } else {
        sessionDate = formatLocalDate(new Date(session.date));
      }

      // Handle unassigned sessions
      if (photographerId === 'unassigned') {
        return (
          (!session.photographerId && (!session.photographers || session.photographers.length === 0)) &&
          sessionDate === currentDateStr
        );
      }

      return (
        session.photographerId === photographerId &&
        sessionDate === currentDateStr
      );
    });
  };

  // Check if two sessions overlap in time
  const sessionsOverlap = (session1, session2) => {
    if (!session1.startTime || !session1.endTime || !session2.startTime || !session2.endTime) {
      return false;
    }
    
    const [s1StartHour, s1StartMin] = session1.startTime.split(':').map(Number);
    const [s1EndHour, s1EndMin] = session1.endTime.split(':').map(Number);
    const [s2StartHour, s2StartMin] = session2.startTime.split(':').map(Number);
    const [s2EndHour, s2EndMin] = session2.endTime.split(':').map(Number);
    
    const s1Start = s1StartHour * 60 + s1StartMin;
    const s1End = s1EndHour * 60 + s1EndMin;
    const s2Start = s2StartHour * 60 + s2StartMin;
    const s2End = s2EndHour * 60 + s2EndMin;
    
    // Sessions overlap if one starts before the other ends
    return s1Start < s2End && s2Start < s1End;
  };

  // Check if session has notes
  const sessionHasNotes = (session) => {
    return !!(session.notes || session.photographerNotes);
  };

  // Calculate layout for sessions (assign lanes to avoid overlaps)
  const calculateSessionLayout = (sessions) => {
    const layoutMap = new Map();
    const sortedSessions = [...sessions].sort((a, b) => {
      const [aHour, aMin] = (a.startTime || '00:00').split(':').map(Number);
      const [bHour, bMin] = (b.startTime || '00:00').split(':').map(Number);
      const aTime = aHour * 60 + aMin;
      const bTime = bHour * 60 + bMin;
      return aTime - bTime;
    });
    
    sortedSessions.forEach(session => {
      let lane = 0;
      let foundLane = false;
      const hasNotes = sessionHasNotes(session);
      const sessionHeight = hasNotes ? SESSION_WITH_NOTES_HEIGHT : BASE_SESSION_HEIGHT;
      
      while (!foundLane) {
        let canUseLane = true;
        
        // Check if this lane conflicts with any already placed sessions
        for (const [otherSession, otherLayout] of layoutMap.entries()) {
          if (otherLayout.lane === lane && sessionsOverlap(session, otherSession)) {
            canUseLane = false;
            break;
          }
        }
        
        if (canUseLane) {
          foundLane = true;
        } else {
          lane++;
        }
      }
      
      // Calculate max lanes for this session (how many concurrent sessions)
      let maxLanes = 1;
      sortedSessions.forEach(otherSession => {
        if (otherSession !== session && sessionsOverlap(session, otherSession)) {
          const otherLayout = layoutMap.get(otherSession);
          if (otherLayout) {
            maxLanes = Math.max(maxLanes, otherLayout.lane + 1);
          }
        }
      });
      
      layoutMap.set(session, { 
        lane, 
        totalLanes: Math.max(maxLanes, lane + 1),
        height: sessionHeight,
        hasNotes
      });
    });
    
    // Update total lanes for all overlapping sessions and track max height in each lane
    let maxTotalLanes = 1;
    const laneHeights = new Map();
    
    for (const [session, layout] of layoutMap.entries()) {
      let sessionMaxLanes = layout.totalLanes;
      for (const [otherSession, otherLayout] of layoutMap.entries()) {
        if (sessionsOverlap(session, otherSession)) {
          sessionMaxLanes = Math.max(sessionMaxLanes, otherLayout.totalLanes);
        }
      }
      layout.totalLanes = sessionMaxLanes;
      maxTotalLanes = Math.max(maxTotalLanes, sessionMaxLanes);
      
      // Track the max height needed for each lane
      const currentLaneHeight = laneHeights.get(layout.lane) || 0;
      laneHeights.set(layout.lane, Math.max(currentLaneHeight, layout.height));
    }
    
    return { layoutMap, maxLanes: maxTotalLanes, laneHeights };
  };

  // Calculate row height based on lane heights
  const calculateRowHeight = (layoutInfo) => {
    if (!layoutInfo || layoutInfo.maxLanes <= 1) {
      // Single session or no sessions
      if (layoutInfo && layoutInfo.laneHeights && layoutInfo.laneHeights.size === 1) {
        // Single session - use its height
        const singleHeight = Array.from(layoutInfo.laneHeights.values())[0];
        return Math.max(singleHeight + 10, BASE_ROW_HEIGHT); // 10px padding
      }
      return BASE_ROW_HEIGHT;
    }
    
    // Multiple lanes - sum up the heights
    let totalHeight = 10; // Start with top padding
    for (let i = 0; i < layoutInfo.maxLanes; i++) {
      const laneHeight = layoutInfo.laneHeights.get(i) || BASE_SESSION_HEIGHT;
      totalHeight += laneHeight;
      if (i < layoutInfo.maxLanes - 1) {
        totalHeight += SESSION_SPACING;
      }
    }
    totalHeight += 5; // Bottom padding
    
    return Math.max(totalHeight, BASE_ROW_HEIGHT);
  };

  // Calculate session position and width
  const getSessionStyle = (session, layoutInfo, laneHeights) => {
    if (!session.startTime || !session.endTime) {
      return { display: 'none' };
    }

    const [startHour, startMin] = session.startTime.split(':').map(Number);
    const [endHour, endMin] = session.endTime.split(':').map(Number);
    
    // Calculate positions
    const startMinutesFromDayStart = (startHour - START_HOUR) * 60 + startMin;
    const endMinutesFromDayStart = (endHour - START_HOUR) * 60 + endMin;
    
    // Don't show sessions outside business hours
    if (startHour < START_HOUR || endHour > END_HOUR) {
      return { display: 'none' };
    }
    
    const left = startMinutesFromDayStart * PIXELS_PER_MINUTE;
    const width = (endMinutesFromDayStart - startMinutesFromDayStart) * PIXELS_PER_MINUTE;
    
    // Session height depends on whether it has notes
    const height = layoutInfo?.height || (sessionHasNotes(session) ? SESSION_WITH_NOTES_HEIGHT : BASE_SESSION_HEIGHT);
    let top = 5; // 5px padding from top for single session
    
    if (layoutInfo && layoutInfo.totalLanes > 1) {
      const { lane } = layoutInfo;
      // Calculate top position based on heights of sessions above this one
      top = 5;
      for (let i = 0; i < lane; i++) {
        const laneHeight = laneHeights?.get(i) || BASE_SESSION_HEIGHT;
        top += laneHeight + SESSION_SPACING;
      }
    }
    
    return {
      position: 'absolute',
      left: `${left}px`,
      width: `${width}px`,
      top: `${top}px`,
      height: `${height}px`,
      minWidth: '40px' // Minimum width for very short sessions
    };
  };

  // Handle timeline click to add session
  const handleTimelineClick = (e, photographerId) => {
    if (!isAdmin || !onAddSession) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Calculate time from click position
    const minutesFromStart = x / PIXELS_PER_MINUTE;
    const totalMinutes = START_HOUR * 60 + minutesFromStart;
    const clickHour = Math.floor(totalMinutes / 60);
    const clickMinute = Math.round((totalMinutes % 60) / 30) * 30; // Round to nearest 30 minutes
    
    // Create a date object for the clicked time
    const clickedDate = new Date(currentDate);
    clickedDate.setHours(clickHour, clickMinute, 0, 0);
    
    onAddSession(photographerId, currentDate);
  };
  
  // Handle row click (for unassigned section)
  const handleRowClick = (e, photographerId) => {
    handleTimelineClick(e, photographerId);
  };
  
  // Handle row mouse move (for hover add button)
  const handleRowMouseMove = (e, photographerId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Calculate time from mouse position
    const minutesFromStart = x / PIXELS_PER_MINUTE;
    const totalMinutes = START_HOUR * 60 + minutesFromStart;
    const hoverHour = Math.floor(totalMinutes / 60);
    const hoverMinute = Math.round((totalMinutes % 60) / 30) * 30;
    
    setHoveredTimeSlot({
      photographerId,
      x: x,
      time: `${hoverHour}:${hoverMinute.toString().padStart(2, '0')}`
    });
  };
  
  // Handle row mouse leave
  const handleRowMouseLeave = () => {
    setHoveredTimeSlot(null);
  };
  
  // Handle add button click
  const handleAddClick = (photographerId, time) => {
    if (!onAddSession) return;
    onAddSession(photographerId, currentDate);
  };
  
  // Simple drag over handler (for unassigned section)
  const handleDragOver = (e, photographerId) => {
    handleSessionDragOver(e);
  };
  
  // Simple drop handler (for unassigned section)
  const handleDrop = (e, photographerId) => {
    handleSessionDrop(e, photographerId);
  };

  // Handle session drag start
  const handleSessionDragStart = (e, session) => {
    setDraggedSession(session);
    e.dataTransfer.effectAllowed = "move";
  };

  // Handle session drag over
  const handleSessionDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Handle session drop
  const handleSessionDrop = (e, photographerId) => {
    e.preventDefault();
    
    if (!draggedSession || !onUpdateSession) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Calculate new time from drop position
    const minutesFromStart = x / PIXELS_PER_MINUTE;
    const duration = calculateDurationMinutes(draggedSession.startTime, draggedSession.endTime);
    
    const newStartTotalMinutes = START_HOUR * 60 + minutesFromStart;
    const newStartHour = Math.floor(newStartTotalMinutes / 60);
    const newStartMinute = Math.round((newStartTotalMinutes % 60) / 15) * 15; // Round to nearest 15 minutes
    
    const newEndTotalMinutes = newStartTotalMinutes + duration;
    const newEndHour = Math.floor(newEndTotalMinutes / 60);
    const newEndMinute = newEndTotalMinutes % 60;
    
    // Format new times
    const newStartTime = `${String(newStartHour).padStart(2, '0')}:${String(newStartMinute).padStart(2, '0')}`;
    const newEndTime = `${String(newEndHour).padStart(2, '0')}:${String(newEndMinute).padStart(2, '0')}`;
    
    // Update session
    onUpdateSession(draggedSession.sessionId, {
      ...draggedSession,
      photographerId: photographerId,
      startTime: newStartTime,
      endTime: newEndTime,
      originalPhotographerId: draggedSession.photographerId,
      date: formatLocalDate(currentDate)
    });
    
    setDraggedSession(null);
  };

  // Calculate duration in minutes
  const calculateDurationMinutes = (startTime, endTime) => {
    if (!startTime || !endTime) return 60; // Default 1 hour
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    return (endHour * 60 + endMin) - (startHour * 60 + startMin);
  };

  // Get session color based on order within the day
  const getSessionColorByOrder = (orderIndex) => {
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
    
    return defaultColors[orderIndex] || defaultColors[defaultColors.length - 1];
  };

  // Get all sessions for the day to determine order colors
  const getGlobalSessionOrderForDay = () => {
    const dayFormatted = formatLocalDate(currentDate);
    
    // Get ALL sessions for this day across all photographers (excluding time off)
    const allDaySessions = sessions.filter((session) => {
      if (session.isTimeOff) return false;
      
      let sessionDate;
      if (typeof session.date === "string") {
        sessionDate = session.date;
      } else {
        sessionDate = formatLocalDate(new Date(session.date));
      }
      
      return sessionDate === dayFormatted;
    });

    // Group sessions by unique identifier to avoid duplicates
    const uniqueSessions = {};
    allDaySessions.forEach((session) => {
      const key = `${session.date}-${session.startTime}-${session.schoolId}-${session.sessionType || 'default'}`;
      
      if (!uniqueSessions[key]) {
        uniqueSessions[key] = { ...session };
      }
    });

    // Sort by start time
    const sortedSessions = Object.values(uniqueSessions).sort((a, b) => {
      if (a.startTime && b.startTime) {
        const timeComparison = a.startTime.localeCompare(b.startTime);
        if (timeComparison !== 0) return timeComparison;
        return (a.id || '').localeCompare(b.id || '');
      }
      return 0;
    });
    
    return sortedSessions;
  };

  // Handle employee drag start
  const handleEmployeeDragStart = (e, employee) => {
    setDraggedEmployee(employee);
    e.dataTransfer.effectAllowed = "move";
  };

  // Handle employee drag over
  const handleEmployeeDragOver = (e, employee) => {
    e.preventDefault();
    if (!draggedEmployee || draggedEmployee.id === employee.id) return;
    setDragOverEmployee(employee.id);
  };

  // Handle employee drop
  const handleEmployeeDrop = (e, targetEmployee) => {
    e.preventDefault();
    if (!draggedEmployee || !onEmployeeReorder) return;
    
    if (draggedEmployee.id !== targetEmployee.id) {
      onEmployeeReorder(draggedEmployee.id, targetEmployee.id);
    }
    
    setDraggedEmployee(null);
    setDragOverEmployee(null);
  };

  // Check if there are any unassigned sessions for the current day
  const unassignedSessionsForDay = getSessionsForPhotographer('unassigned');
  const showUnassignedSection = unassignedSessionsForDay.length > 0;
  
  // Create unassigned member object
  const unassignedMember = {
    id: 'unassigned',
    firstName: 'Unassigned',
    lastName: 'Sessions',
    isUnassigned: true
  };
  
  // Team members list without unassigned
  const allRows = teamMembers;

  return (
    <div className="day-view">
      {/* Unassigned Section - Only show if there are unassigned sessions for this day */}
      {showUnassignedSection && (
        <div className="day-view__unassigned-section">
          {/* Unassigned Body (no header needed) */}
          <div className="day-view__body day-view__body--unassigned">
            {/* Unassigned employee cell */}
            <div className="day-view__employees day-view__employees--unassigned">
              <div
                className="day-view__employee day-view__employee--unassigned"
                style={{
                  height: `${calculateRowHeight(calculateSessionLayout(getSessionsForPhotographer('unassigned')))}px`,
                  minHeight: `${BASE_ROW_HEIGHT}px`,
                  borderRight: '2px solid #dc3545',
                  backgroundColor: '#fff8e1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  boxSizing: 'border-box'
                }}
              >
                {/* Avatar */}
                <div className="day-view__employee-avatar-container">
                  {getUserAvatar(unassignedMember)}
                </div>
                
                {/* Name and Stats */}
                <div className="day-view__employee-info" style={{ flex: 1 }}>
                  <div 
                    className="day-view__employee-name"
                    style={{
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#333",
                      lineHeight: "1.2"
                    }}
                  >
                    {unassignedMember.firstName} {unassignedMember.lastName}
                  </div>
                  <div 
                    className="day-view__employee-stats"
                    style={{
                      fontSize: "12px",
                      color: "#6c757d",
                      marginTop: "2px"
                    }}
                  >
                    Needs Assignment
                  </div>
                </div>
              </div>
            </div>
            
            {/* Unassigned timeline */}
            <div className="day-view__timeline-container day-view__timeline-container--unassigned" ref={unassignedTimelineRef}>
              <div 
                className="day-view__timeline" 
                style={{ width: `${TIMELINE_WIDTH}px` }}
              >
                {/* Grid lines */}
                <div className="day-view__grid">
                  {hourLabels.map((hour) => (
                    <div
                      key={`unassigned-grid-${hour}`}
                      className="day-view__grid-line"
                      style={{ left: `${(hour - START_HOUR) * HOUR_WIDTH}px` }}
                    />
                  ))}
                  {/* Half-hour lines */}
                  {hourLabels.slice(0, -1).map((hour) => (
                    <div
                      key={`unassigned-grid-half-${hour}`}
                      className="day-view__grid-line day-view__grid-line--half"
                      style={{ left: `${(hour - START_HOUR) * HOUR_WIDTH + HOUR_WIDTH / 2}px` }}
                    />
                  ))}
                </div>
                
                {/* Unassigned row */}
                <div
                  className="day-view__row day-view__row--unassigned"
                  style={{
                    height: `${calculateRowHeight(calculateSessionLayout(getSessionsForPhotographer('unassigned')))}px`,
                    minHeight: `${BASE_ROW_HEIGHT}px`
                  }}
                  onDragOver={(e) => handleDragOver(e, 'unassigned')}
                  onDrop={(e) => handleDrop(e, 'unassigned')}
                  onClick={(e) => handleRowClick(e, 'unassigned')}
                  onMouseMove={(e) => handleRowMouseMove(e, 'unassigned')}
                  onMouseLeave={handleRowMouseLeave}
                >
                  {/* Add button on hover */}
                  {hoveredTimeSlot?.photographerId === 'unassigned' && isAdmin && (
                    <button 
                      className="day-view__add-btn"
                      style={{ left: `${hoveredTimeSlot.x - 12}px` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddClick('unassigned', hoveredTimeSlot.time);
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                  
                  {/* Unassigned sessions */}
                  {(() => {
                    const unassignedSessionsForRow = getSessionsForPhotographer('unassigned');
                    if (unassignedSessionsForRow.length === 0) return null;
                    
                    const { layoutMap, laneHeights } = calculateSessionLayout(unassignedSessionsForRow);
                    
                    return unassignedSessionsForRow.map((session) => {
                      const sessionLayoutInfo = layoutMap.get(session);
                      const sessionStyle = getSessionStyle(session, sessionLayoutInfo, laneHeights);
                      
                      // Calculate session color
                      let sessionColor = "#666";
                      if (!session.isTimeOff) {
                        const globalSessionOrder = getGlobalSessionOrderForDay();
                        const globalOrderIndex = globalSessionOrder.findIndex(
                          globalSession => globalSession.id === session.id || 
                          (globalSession.sessionId && globalSession.sessionId === session.sessionId)
                        );
                        
                        const validOrderIndex = globalOrderIndex >= 0 ? globalOrderIndex : 0;
                        const calculatedColor = getSessionColorByOrder(validOrderIndex);
                        sessionColor = session.sessionColor || calculatedColor;
                      }
                      
                      // Calculate duration
                      const duration = calculateDurationMinutes(session.startTime, session.endTime);
                      const durationHours = Math.floor(duration / 60);
                      const durationMins = duration % 60;
                      const durationText = durationHours > 0 
                        ? (durationMins > 0 ? `${durationHours}h ${durationMins}m` : `${durationHours}h`)
                        : `${durationMins}m`;
                      
                      // Format time display
                      const formatTimeShort = (time) => {
                        if (!time) return "";
                        const [hours, minutes] = time.split(":");
                        const hour = parseInt(hours);
                        const ampm = hour >= 12 ? "PM" : "AM";
                        const hour12 = hour % 12 || 12;
                        return `${hour12}:${minutes} ${ampm}`;
                      };
                      
                      // Apply session styles
                      const finalSessionStyle = {
                        ...sessionStyle,
                        backgroundColor: sessionColor,
                        color: "white",
                        ...(session.isPublished === false && !session.isTimeOff ? {
                          border: `2px dashed ${sessionColor}`,
                          backgroundColor: sessionColor + "40",
                          color: sessionColor
                        } : {})
                      };
                      
                      return (
                        <div
                          key={session.id}
                          className="day-view__session"
                          style={finalSessionStyle}
                          draggable={isAdmin && !session.isTimeOff}
                          onDragStart={(e) => !session.isTimeOff && handleSessionDragStart(e, session)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (session.isTimeOff && onTimeOffClick) {
                              onTimeOffClick(session);
                            } else if (onSessionClick) {
                              onSessionClick(session);
                            }
                          }}
                          title={`${session.title || session.schoolName || 'Session'} - ${session.startTime} to ${session.endTime}`}
                        >
                          {/* Session content - same as regular sessions */}
                          <div style={{ fontSize: "12px", fontWeight: "500", marginBottom: "4px", opacity: 0.9, lineHeight: "1.3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {formatTimeShort(session.startTime)} - {formatTimeShort(session.endTime)}
                            {duration > 0 && ` (${durationText})`}
                          </div>
                          <div style={{ fontSize: "13px", fontWeight: "600", lineHeight: "1.3", color: session.isTimeOff ? "#333" : (session.isPublished === false ? "#333" : "white"), marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {session.isTimeOff ? (session.reason || 'Time Off') : (session.schoolName || 'School')}
                          </div>
                          {(session.sessionTypes || session.sessionType) && !session.isTimeOff && (
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
                                    <div key={`${type}-${index}`} style={{ fontSize: "9px", backgroundColor: colors[index], color: "white", padding: "2px 5px", borderRadius: "6px", textTransform: "capitalize", fontWeight: "500", display: "inline-block", lineHeight: "1.2" }}>
                                      {displayName}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}
                          {(session.notes || session.photographerNotes) && (
                            <div style={{ fontSize: "11px", opacity: 0.8, fontStyle: "italic", marginTop: "4px", borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {session.photographerNotes && !session.notes && "📝 "}
                              {session.notes || (session.photographerNotes ? "Has photographer notes" : "")}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Header with time labels */}
      <div className="day-view__header">
        <div className="day-view__corner">
          {/* Empty corner above employee names */}
          <div className="day-view__date-display">
            {currentDate.toLocaleDateString("en-US", {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
          </div>
        </div>
        <div className="day-view__timeline-header" ref={headerTimelineRef}>
          <div style={{ display: 'flex', width: `${TIMELINE_WIDTH}px` }}>
            {hourLabels.map((hour) => (
              <div 
                key={hour} 
                className="day-view__hour-label"
                style={{ width: `${HOUR_WIDTH}px` }}
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body with employee rows and timeline */}
      <div className="day-view__body">
        {/* Employee column */}
        <div className="day-view__employees" ref={employeesRef}>
          {hasCustomOrder && (
            <button 
              className="day-view__reset-order-btn"
              onClick={onResetEmployeeOrder}
              title="Reset custom order"
            >
              <Menu size={14} />
            </button>
          )}
          
          {allRows.map((member) => {
            // Calculate row height based on overlapping sessions
            const memberSessions = getSessionsForPhotographer(member.id);
            const layoutInfo = memberSessions.length > 0 
              ? calculateSessionLayout(memberSessions) 
              : null;
            const rowHeight = calculateRowHeight(layoutInfo);
            
            return (
            <div
              key={member.id}
              className={`day-view__employee ${member.isUnassigned ? 'day-view__employee--unassigned' : ''}`}
              draggable={!member.isUnassigned && (isAdmin || userProfile?.role === 'manager')}
              onDragStart={(e) => !member.isUnassigned && handleEmployeeDragStart(e, member)}
              onDragOver={(e) => !member.isUnassigned && handleEmployeeDragOver(e, member)}
              onDrop={(e) => !member.isUnassigned && handleEmployeeDrop(e, member)}
              style={{
                opacity: draggedEmployee?.id === member.id ? 0.5 : 1,
                borderTop: dragOverEmployee === member.id ? '2px solid #007bff' : 'none',
                height: `${rowHeight}px`,
                minHeight: `${BASE_ROW_HEIGHT}px`,
                borderRight: '2px solid #007bff',
                backgroundColor: member.isUnassigned ? '#fff8e1' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                boxSizing: 'border-box',
                cursor: (isAdmin || userProfile?.role === 'manager') && !member.isUnassigned ? 'move' : 'default'
              }}
            >
              {/* Drag Handle */}
              {(isAdmin || userProfile?.role === 'manager') && !member.isUnassigned && (
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
              
              {/* Avatar */}
              <div className="day-view__employee-avatar-container">
                {getUserAvatar(member)}
              </div>
              
              {/* Name and Stats */}
              <div className="day-view__employee-info" style={{ flex: 1 }}>
                <div 
                  className="day-view__employee-name"
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#333",
                    lineHeight: "1.2"
                  }}
                >
                  {member.displayName || `${member.firstName} ${member.lastName}`}
                </div>
                <div 
                  className="day-view__employee-stats"
                  style={{
                    fontSize: "12px",
                    color: "#6c757d",
                    marginTop: "2px"
                  }}
                >
                  {member.isUnassigned 
                    ? 'Needs Assignment' 
                    : formatHours(calculatePhotographerHours(member.id))
                  }
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* Timeline area */}
        <div className="day-view__timeline-container" ref={timelineContainerRef}>
          <div 
            className="day-view__timeline" 
            ref={timelineRef}
            style={{ 
              width: `${TIMELINE_WIDTH}px`
            }}
          >
            {/* Content wrapper for grid and rows */}
            <div className="day-view__content" style={{ position: 'relative' }}>
              {/* Grid lines */}
              <div className="day-view__grid">
                {hourLabels.map((hour) => (
                  <div
                    key={hour}
                    className="day-view__grid-line"
                    style={{ left: `${(hour - START_HOUR) * HOUR_WIDTH}px` }}
                  />
                ))}
                {/* Half-hour lines */}
                {hourLabels.slice(0, -1).map((hour) => (
                  <div
                    key={`${hour}-half`}
                    className="day-view__grid-line day-view__grid-line--half"
                    style={{ left: `${(hour - START_HOUR) * HOUR_WIDTH + HOUR_WIDTH / 2}px` }}
                  />
                ))}
              </div>

              {/* Current time indicator */}
              {isToday() && currentTimePosition !== null && (
                <div 
                  className="day-view__current-time"
                  style={{ left: `${currentTimePosition}px` }}
                >
                  <div className="day-view__current-time-label">
                    {formatCurrentTime(currentTime)}
                  </div>
                  <div className="day-view__current-time-line" />
                </div>
              )}

              {/* Session rows */}
              {allRows.map((member) => {
              // Calculate row height based on overlapping sessions
              const memberSessions = getSessionsForPhotographer(member.id);
              const layoutInfo = memberSessions.length > 0 
                ? calculateSessionLayout(memberSessions) 
                : null;
              const rowHeight = calculateRowHeight(layoutInfo);
              
              return (
              <div
                key={member.id}
                className="day-view__row"
                style={{
                  height: `${rowHeight}px`,
                  minHeight: `${BASE_ROW_HEIGHT}px`
                }}
                onClick={(e) => {
                  // Only handle click if it's directly on the row, not on a session
                  if (e.target === e.currentTarget) {
                    handleTimelineClick(e, member.id);
                  }
                }}
                onDragOver={handleSessionDragOver}
                onDrop={(e) => handleSessionDrop(e, member.id)}
              >
                {/* Add session button at beginning of row */}
                {isAdmin && (
                  <button
                    className="day-view__add-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSession && onAddSession(member.id, currentDate);
                    }}
                    title="Add session"
                  >
                    <Plus size={14} />
                  </button>
                )}
                
                {/* Sessions */}
                {(() => {
                  const photographerSessions = getSessionsForPhotographer(member.id);
                  const { layoutMap, laneHeights } = layoutInfo || { layoutMap: new Map(), laneHeights: new Map() };
                  
                  return photographerSessions.map((session) => {
                    const sessionLayoutInfo = layoutMap.get(session);
                    const sessionStyle = getSessionStyle(session, sessionLayoutInfo, laneHeights);
                    
                    // Calculate session color based on order (for non-time-off sessions)
                  let sessionColor = "#666"; // Default for time off
                  if (!session.isTimeOff) {
                    const globalSessionOrder = getGlobalSessionOrderForDay();
                    const globalOrderIndex = globalSessionOrder.findIndex(
                      globalSession => globalSession.id === session.id || 
                      (globalSession.sessionId && globalSession.sessionId === session.sessionId)
                    );
                    
                    const validOrderIndex = globalOrderIndex >= 0 ? globalOrderIndex : 0;
                    const calculatedColor = getSessionColorByOrder(validOrderIndex);
                    sessionColor = session.sessionColor || calculatedColor;
                  }
                  
                  // Calculate duration for display
                  const duration = calculateDurationMinutes(session.startTime, session.endTime);
                  const durationHours = Math.floor(duration / 60);
                  const durationMins = duration % 60;
                  const durationText = durationHours > 0 
                    ? (durationMins > 0 ? `${durationHours}h ${durationMins}m` : `${durationHours}h`)
                    : `${durationMins}m`;
                  
                  // Format time display
                  const formatTimeShort = (time) => {
                    if (!time) return "";
                    const [hours, minutes] = time.split(":");
                    const hour = parseInt(hours);
                    const ampm = hour >= 12 ? "PM" : "AM";
                    const hour12 = hour % 12 || 12;
                    return `${hour12}:${minutes} ${ampm}`;
                  };
                  
                  // Apply session styles with unpublished state
                  const finalSessionStyle = {
                    ...sessionStyle,
                    backgroundColor: sessionColor,
                    color: "white",
                    ...(session.isPublished === false && !session.isTimeOff ? {
                      border: `2px dashed ${sessionColor}`,
                      backgroundColor: sessionColor + "40",
                      color: sessionColor
                    } : {})
                  };
                  
                  return (
                    <div
                      key={session.id}
                      className="day-view__session"
                      style={finalSessionStyle}
                      draggable={isAdmin && !session.isTimeOff}
                      onDragStart={(e) => !session.isTimeOff && handleSessionDragStart(e, session)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (session.isTimeOff && onTimeOffClick) {
                          onTimeOffClick(session);
                        } else if (onSessionClick) {
                          onSessionClick(session);
                        }
                      }}
                      title={`${session.title || session.schoolName || 'Session'} - ${session.startTime} to ${session.endTime}`}
                    >
                      {/* Time with duration */}
                      <div
                        style={{ 
                          fontSize: "12px",
                          fontWeight: "500",
                          marginBottom: "4px",
                          opacity: 0.9,
                          lineHeight: "1.3",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {formatTimeShort(session.startTime)} - {formatTimeShort(session.endTime)}
                        {duration > 0 && ` (${durationText})`}
                      </div>
                      
                      {/* School/Location */}
                      <div
                        style={{ 
                          fontSize: "13px",
                          fontWeight: "600",
                          lineHeight: "1.3",
                          color: session.isTimeOff ? "#333" : (session.isPublished === false ? "#333" : "white"),
                          marginBottom: "3px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {session.isTimeOff ? (session.reason || 'Time Off') : (session.schoolName || 'School')}
                      </div>
                      
                      {/* Session Type Badges */}
                      {(session.sessionTypes || session.sessionType) && !session.isTimeOff && (
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
                                  style={{
                                    fontSize: "9px",
                                    backgroundColor: colors[index],
                                    color: "white",
                                    padding: "2px 5px",
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
                      
                      {/* Notes indicator */}
                      {(session.notes || session.photographerNotes) && (
                        <div
                          style={{
                            fontSize: "11px",
                            opacity: 0.8,
                            fontStyle: "italic",
                            marginTop: "4px",
                            borderTop: "1px solid rgba(255,255,255,0.2)",
                            paddingTop: "3px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {session.photographerNotes && !session.notes && "📝 "}
                          {session.notes || (session.photographerNotes ? "Has photographer notes" : "")}
                        </div>
                      )}
                    </div>
                  );
                  });
                })()}
              </div>
              );
            })}
            </div>
            {/* Padding spacer for scrolling */}
            <div style={{ height: '80px' }} />
          </div>
        </div>
      </div>

      {/* Blocked date overlay */}
      {isDateBlocked() && (
        <div className="day-view__blocked-overlay">
          <div className="day-view__blocked-message">
            This date is blocked
          </div>
        </div>
      )}
    </div>
  );
};

export default DayView;