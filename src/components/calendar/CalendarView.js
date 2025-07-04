// src/components/calendar/CalendarView.js - Complete with Session Click Handler
import React from "react";
import WeekView from "./WeekView";
import MonthView from "./MonthView";

const CalendarView = ({
  viewMode,
  currentDate,
  dateRange,
  sessions,
  teamMembers,
  scheduleType,
  userProfile,
  onUpdateSession,
  onSessionClick, // New prop for handling session clicks
}) => {
  const renderView = () => {
    switch (viewMode) {
      case "week":
        return (
          <WeekView
            currentDate={currentDate}
            dateRange={dateRange}
            sessions={sessions}
            teamMembers={teamMembers}
            scheduleType={scheduleType}
            userProfile={userProfile}
            onUpdateSession={onUpdateSession}
            onSessionClick={onSessionClick} // Pass the click handler
          />
        );
      case "month":
        return (
          <MonthView
            currentDate={currentDate}
            dateRange={dateRange}
            sessions={sessions}
            teamMembers={teamMembers}
            scheduleType={scheduleType}
            userProfile={userProfile}
            onUpdateSession={onUpdateSession} // Pass the update handler (for future month view drag & drop)
            onSessionClick={onSessionClick} // Pass the click handler (for future month view)
          />
        );
      default:
        return (
          <WeekView
            currentDate={currentDate}
            dateRange={dateRange}
            sessions={sessions}
            teamMembers={teamMembers}
            scheduleType={scheduleType}
            userProfile={userProfile}
            onUpdateSession={onUpdateSession}
            onSessionClick={onSessionClick} // Pass the click handler
          />
        );
    }
  };

  return <div className="calendar-view">{renderView()}</div>;
};

export default CalendarView;
