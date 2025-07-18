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
  organization,
  onUpdateSession,
  onSessionClick, // New prop for handling session clicks
  onTimeOffClick, // New prop for handling time off clicks
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
            organization={organization}
            onUpdateSession={onUpdateSession}
            onSessionClick={onSessionClick} // Pass the click handler
            onTimeOffClick={onTimeOffClick} // Pass the time off click handler
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
            organization={organization}
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
            organization={organization}
            onUpdateSession={onUpdateSession}
            onSessionClick={onSessionClick} // Pass the click handler
          />
        );
    }
  };

  return <div className="calendar-view">{renderView()}</div>;
};

export default CalendarView;
