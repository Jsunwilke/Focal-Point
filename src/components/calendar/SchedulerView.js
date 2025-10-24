// src/components/calendar/SchedulerView.js
import React, { useState, useMemo } from "react";
import { Camera, Users as UsersIcon, Plus, X } from "lucide-react";
import "./SchedulerView.css";

const SchedulerView = ({
  dateRange,
  sessions,
  teamMembers,
  schools,
  onUpdateSchedulerAssignments,
  onCreateSchedulerSession,
  userProfile
}) => {
  const [draggedPhotographer, setDraggedPhotographer] = useState(null);
  const [draggedFromPosition, setDraggedFromPosition] = useState(null);

  // Show all sessions in date range (whether they have scheduler config or not)
  const schedulerSessions = useMemo(() => {
    return sessions.filter(session => {
      // Parse date in local timezone to avoid UTC offset issues
      const sessionDate = new Date(session.date + 'T00:00:00');
      return sessionDate >= dateRange.start && sessionDate <= dateRange.end;
    });
  }, [sessions, dateRange]);

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const grouped = {};
    schedulerSessions.forEach(session => {
      const date = session.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(session);
    });

    // Sort dates
    const sortedDates = Object.keys(grouped).sort();
    const result = {};
    sortedDates.forEach(date => {
      // Sort sessions by start time
      result[date] = grouped[date].sort((a, b) => {
        if (a.startTime && b.startTime) {
          return a.startTime.localeCompare(b.startTime);
        }
        return 0;
      });
    });

    return result;
  }, [schedulerSessions]);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format time for display
  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Get position icon
  const getPositionIcon = (type) => {
    switch (type) {
      case 'individual_camera':
      case 'group_camera':
        return <Camera size={14} />;
      case 'helper':
        return <UsersIcon size={14} />;
      default:
        return null;
    }
  };

  // Drag handlers
  const handleDragStart = (e, photographer, fromPosition = null) => {
    setDraggedPhotographer(photographer);
    setDraggedFromPosition(fromPosition);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, session, positionId) => {
    e.preventDefault();

    if (!draggedPhotographer) return;

    // Get current assignments
    const currentAssignments = session.schedulerAssignments || [];

    // If dragging from another position in the same session, remove from old position
    let updatedAssignments = currentAssignments.filter(
      assignment => assignment.positionId !== positionId
    );

    // If coming from another position, remove from there too
    if (draggedFromPosition) {
      updatedAssignments = updatedAssignments.filter(
        assignment => assignment.positionId !== draggedFromPosition.positionId
      );
    }

    // Find the position configuration
    const school = schools.find(s => s.id === session.schoolId);
    const config = school?.schedulerConfigurations?.find(
      c => c.id === session.schedulerConfigurationId
    );
    const position = config?.positions?.find(p => p.id === positionId);

    // Add new assignment
    if (position) {
      updatedAssignments.push({
        positionId,
        positionType: position.type,
        label: position.label,
        photographerId: draggedPhotographer.id,
        photographerName: `${draggedPhotographer.firstName} ${draggedPhotographer.lastName}`
      });
    }

    // Update Firestore
    await onUpdateSchedulerAssignments(session.sessionId || session.id, updatedAssignments);

    // Clear drag state
    setDraggedPhotographer(null);
    setDraggedFromPosition(null);
  };

  const handleRemoveAssignment = async (session, positionId) => {
    const updatedAssignments = (session.schedulerAssignments || []).filter(
      assignment => assignment.positionId !== positionId
    );
    await onUpdateSchedulerAssignments(session.sessionId || session.id, updatedAssignments);
  };

  // Get photographer info for an assignment
  const getAssignedPhotographer = (session, positionId) => {
    const assignment = session.schedulerAssignments?.find(a => a.positionId === positionId);
    if (!assignment) return null;

    return teamMembers.find(m => m.id === assignment.photographerId);
  };

  return (
    <div className="scheduler-view">
      {/* Left Panel: Sessions */}
      <div className="scheduler-view__sessions">
        <div className="scheduler-view__sessions-header">
          <h3>Sessions</h3>
          {Object.keys(sessionsByDate).length === 0 && (
            <button
              className="scheduler-view__create-btn"
              onClick={() => onCreateSchedulerSession && onCreateSchedulerSession()}
            >
              <Plus size={16} />
              Create Session
            </button>
          )}
        </div>

        {Object.keys(sessionsByDate).length === 0 ? (
          <div className="scheduler-view__empty">
            <p>No scheduler sessions in this date range.</p>
            <button
              className="scheduler-view__create-btn-large"
              onClick={() => onCreateSchedulerSession && onCreateSchedulerSession()}
            >
              <Plus size={20} />
              Create Your First Scheduler Session
            </button>
          </div>
        ) : (
          <div className="scheduler-view__sessions-list">
            {Object.entries(sessionsByDate).map(([date, dateSessions]) => (
              <div key={date} className="scheduler-view__date-group">
                <div className="scheduler-view__date-header">
                  {formatDate(date)}
                </div>

                {dateSessions.map(session => {
                  const school = schools.find(s => s.id === session.schoolId);
                  const config = school?.schedulerConfigurations?.find(
                    c => c.id === session.schedulerConfigurationId
                  );

                  return (
                    <div key={session.id} className="scheduler-session-card">
                      <div className="scheduler-session-card__header">
                        <div className="scheduler-session-card__title">
                          {session.schoolName || school?.value || 'Unknown School'}
                        </div>
                        <div className="scheduler-session-card__time">
                          {formatTime(session.startTime)} - {formatTime(session.endTime)}
                        </div>
                      </div>

                      {config && (
                        <div className="scheduler-session-card__config-name">
                          {config.name}
                        </div>
                      )}

                      {!config && (
                        <div className="scheduler-session-card__no-config">
                          No scheduler configuration
                        </div>
                      )}

                      {config && (
                        <div className="scheduler-session-card__positions">
                          {config.positions?.map((position) => {
                          const assignedPhotographer = getAssignedPhotographer(session, position.id);

                          return (
                            <div
                              key={position.id}
                              className={`scheduler-position ${assignedPhotographer ? 'scheduler-position--filled' : ''}`}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, session, position.id)}
                            >
                              <div className="scheduler-position__icon">
                                {getPositionIcon(position.type)}
                              </div>
                              <div className="scheduler-position__label">
                                {position.label}
                              </div>
                              {assignedPhotographer ? (
                                <div className="scheduler-position__assigned">
                                  <div
                                    className="photographer-chip"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, assignedPhotographer, position)}
                                  >
                                    <div className="photographer-chip__avatar">
                                      {assignedPhotographer.photoURL ? (
                                        <img src={assignedPhotographer.photoURL} alt="" />
                                      ) : (
                                        <span>
                                          {assignedPhotographer.firstName?.[0]}
                                          {assignedPhotographer.lastName?.[0]}
                                        </span>
                                      )}
                                    </div>
                                    <span className="photographer-chip__name">
                                      {assignedPhotographer.firstName} {assignedPhotographer.lastName}
                                    </span>
                                  </div>
                                  <button
                                    className="scheduler-position__remove"
                                    onClick={() => handleRemoveAssignment(session, position.id)}
                                    title="Remove"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="scheduler-position__empty">
                                  Drop photographer here
                                </div>
                              )}
                            </div>
                          );
                        })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Panel: Photographers */}
      <div className="scheduler-view__photographers">
        <div className="scheduler-view__photographers-header">
          <h3>Photographers</h3>
          <span className="scheduler-view__photographers-count">
            {teamMembers.length}
          </span>
        </div>

        <div className="scheduler-view__photographers-list">
          {teamMembers.map(member => (
            <div
              key={member.id}
              className="photographer-card"
              draggable
              onDragStart={(e) => handleDragStart(e, member)}
            >
              <div className="photographer-card__avatar">
                {member.photoURL ? (
                  <img src={member.photoURL} alt={`${member.firstName} ${member.lastName}`} />
                ) : (
                  <span>
                    {member.firstName?.[0]}
                    {member.lastName?.[0]}
                  </span>
                )}
              </div>
              <div className="photographer-card__info">
                <div className="photographer-card__name">
                  {member.firstName} {member.lastName}
                </div>
                <div className="photographer-card__role">
                  {member.role || 'Photographer'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SchedulerView;
