// src/components/calendar/MonthView.js
import React from "react";

const MonthView = ({
  currentDate,
  sessions,
  teamMembers,
  scheduleType,
  userProfile,
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

  // Get sessions for a specific day
  const getSessionsForDay = (day) => {
    return sessions.filter((session) => {
      const sessionDate = new Date(session.date);
      if (scheduleType === "my") {
        return (
          isSameDay(sessionDate, day) &&
          session.photographerId === userProfile?.id
        );
      }
      return isSameDay(sessionDate, day);
    });
  };

  // Get photographer name for session
  const getPhotographerName = (photographerId) => {
    const photographer = teamMembers.find(
      (member) => member.id === photographerId
    );
    if (photographer) {
      return `${photographer.firstName} ${photographer.lastName}`;
    }
    return "Unknown";
  };

  // Get photographer data for session
  const getPhotographer = (photographerId) => {
    return teamMembers.find((member) => member.id === photographerId);
  };

  // Get user initials for avatar
  const getUserInitials = (member) => {
    if (member.firstName && member.lastName) {
      return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
    }
    return member.email?.[0]?.toUpperCase() || "U";
  };

  // Get user avatar component (small version for month view)
  const getUserAvatar = (member, size = "1.5rem") => {
    if (member.photoURL) {
      return (
        <img
          src={member.photoURL}
          alt={`${member.firstName} ${member.lastName}`}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            objectFit: "cover",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            marginRight: "0.25rem",
          }}
        />
      );
    }
    
    // Fallback to initials
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.65rem",
          fontWeight: "600",
          marginRight: "0.25rem",
        }}
      >
        {getUserInitials(member)}
      </div>
    );
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
              {daySessions.slice(0, 3).map((session) => {
                const photographer = getPhotographer(session.photographerId);
                return (
                  <div
                    key={session.id}
                    className={`month-session ${
                      session.type === "sports" ? "month-session--sports" : ""
                    }`}
                    onClick={() => {
                      // Handle session click
                      console.log("Session clicked:", session);
                    }}
                  >
                    <div className="month-session__title" style={{ display: "flex", alignItems: "center" }}>
                      {scheduleType === "full" && photographer ? (
                        <>
                          {getUserAvatar(photographer, "1.2rem")}
                          <span>{getPhotographerName(session.photographerId)}</span>
                        </>
                      ) : (
                        "My Session"
                      )}
                    </div>
                    <div className="month-session__details">
                      {session.startTime} • {session.location || session.title}
                    </div>
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
