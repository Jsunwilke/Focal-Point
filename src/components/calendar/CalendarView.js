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
  blockedDates,
  isAdmin,
  onUpdateSession,
  onSessionClick, // New prop for handling session clicks
  onTimeOffClick, // New prop for handling time off clicks
  onHeaderDateClick, // New prop for handling header date clicks
  onAddSession, // New prop for handling add session button clicks
  onEmployeeReorder, // New prop for handling employee reordering
  onResetEmployeeOrder, // New prop for resetting employee order
  hasCustomOrder, // New prop to show/hide reset button
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
            blockedDates={blockedDates}
            isAdmin={isAdmin}
            onUpdateSession={onUpdateSession}
            onSessionClick={onSessionClick} // Pass the click handler
            onTimeOffClick={onTimeOffClick} // Pass the time off click handler
            onHeaderDateClick={onHeaderDateClick} // Pass the header date click handler
            onAddSession={onAddSession} // Pass the add session handler
            onEmployeeReorder={onEmployeeReorder} // Pass the employee reorder handler
            onResetEmployeeOrder={onResetEmployeeOrder} // Pass the reset employee order handler
            hasCustomOrder={hasCustomOrder} // Pass the custom order flag
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
            blockedDates={blockedDates}
            onUpdateSession={onUpdateSession} // Pass the update handler (for future month view drag & drop)
            onSessionClick={onSessionClick} // Pass the click handler
            onTimeOffClick={onTimeOffClick} // Pass the time off click handler
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
            blockedDates={blockedDates}
            isAdmin={isAdmin}
            onUpdateSession={onUpdateSession}
            onSessionClick={onSessionClick} // Pass the click handler
            onTimeOffClick={onTimeOffClick} // Pass the time off click handler
            onHeaderDateClick={onHeaderDateClick} // Pass the header date click handler
            onAddSession={onAddSession} // Pass the add session handler
            onEmployeeReorder={onEmployeeReorder} // Pass the employee reorder handler
            onResetEmployeeOrder={onResetEmployeeOrder} // Pass the reset employee order handler
            hasCustomOrder={hasCustomOrder} // Pass the custom order flag
          />
        );
    }
  };

  return <div className="calendar-view">{renderView()}</div>;
};

export default CalendarView;
