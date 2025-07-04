// src/pages/Schedule.js - With Real-time Firestore Listeners
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  getTeamMembers,
  updateSession,
  getSession,
} from "../firebase/firestore";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { firestore } from "../firebase/config";
import CalendarView from "../components/calendar/CalendarView";
import CreateSessionModal from "../components/sessions/CreateSessionModal";
import EditSessionModal from "../components/sessions/EditSessionModal";
import SessionDetailsModal from "../components/sessions/SessionDetailsModal";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Users,
  Map,
  Calendar as CalendarIcon,
  Tag,
  X,
} from "lucide-react";

// Date utility functions
const startOfWeek = (date, weekStartsOn = 0) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfWeek = (date, weekStartsOn = 0) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() + (6 - diff));
  d.setHours(23, 59, 59, 999);
  return d;
};

const addWeeks = (date, weeks) => {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
};

const subWeeks = (date, weeks) => {
  return addWeeks(date, -weeks);
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const subMonths = (date, months) => {
  return addMonths(date, -months);
};

// Helper functions for saving/loading photographer preferences
const savePhotographerPreferences = (organizationId, photographerIds) => {
  try {
    const key = `schedule-photographers-${organizationId}`;
    localStorage.setItem(key, JSON.stringify(Array.from(photographerIds)));
  } catch (error) {
    console.error("Error saving photographer preferences:", error);
  }
};

const loadPhotographerPreferences = (organizationId) => {
  try {
    const key = `schedule-photographers-${organizationId}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("Error loading photographer preferences:", error);
    return null;
  }
};

const Schedule = () => {
  const { userProfile, organization } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week");
  const [scheduleType, setScheduleType] = useState("full");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTeamFilter, setShowTeamFilter] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [visiblePhotographers, setVisiblePhotographers] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Real-time listener for sessions
  useEffect(() => {
    if (!organization?.id) return;

    console.log("Setting up real-time listener for sessions...");

    const sessionsQuery = query(
      collection(firestore, "sessions"),
      where("organizationID", "==", organization.id)
    );

    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        console.log("Sessions updated from Firestore:", snapshot.docs.length);

        const sessionsData = [];
        snapshot.forEach((doc) => {
          sessionsData.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        // Convert sessions to calendar format
        const sessionData = sessionsData
          .map((session) => {
            // Handle date properly to avoid timezone issues
            let sessionDate = session.date;
            if (typeof session.date === "string") {
              sessionDate = session.date;
            } else if (session.date && session.date.toDate) {
              const date = session.date.toDate();
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, "0");
              const day = String(date.getDate()).padStart(2, "0");
              sessionDate = `${year}-${month}-${day}`;
            } else if (session.date instanceof Date) {
              const year = session.date.getFullYear();
              const month = String(session.date.getMonth() + 1).padStart(
                2,
                "0"
              );
              const day = String(session.date.getDate()).padStart(2, "0");
              sessionDate = `${year}-${month}-${day}`;
            }

            // For sessions with multiple photographers, create separate entries for each
            if (session.photographers && Array.isArray(session.photographers)) {
              return session.photographers.map((photographer) => ({
                id: `${session.id}-${photographer.id}`,
                sessionId: session.id,
                title:
                  session.title || `${session.sport} at ${session.location}`,
                date: sessionDate,
                startTime: session.startTime,
                endTime: session.endTime,
                photographerId: photographer.id,
                photographerName: photographer.name,
                type: session.sessionType || "session",
                status: session.status || "scheduled",
                location: session.location,
                sport: session.sport,
                notes: session.notes,
              }));
            } else {
              // Fallback for sessions with single photographer (legacy format)
              return [
                {
                  id: session.id,
                  sessionId: session.id,
                  title:
                    session.title || `${session.sport} at ${session.location}`,
                  date: sessionDate,
                  startTime: session.startTime,
                  endTime: session.endTime,
                  photographerId: session.photographer?.id || null,
                  photographerName: session.photographer?.name || null,
                  type: session.sessionType || "session",
                  status: session.status || "scheduled",
                  location: session.location,
                  sport: session.sport,
                  notes: session.notes,
                },
              ];
            }
          })
          .flat();

        setSessions(sessionData);
        setLoading(false);
      },
      (error) => {
        console.error("Error in sessions listener:", error);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log("Cleaning up sessions listener");
      unsubscribe();
    };
  }, [organization?.id]);

  // Real-time listener for team members
  useEffect(() => {
    if (!organization?.id) return;

    console.log("Setting up real-time listener for team members...");

    const teamQuery = query(
      collection(firestore, "users"),
      where("organizationID", "==", organization.id)
    );

    const unsubscribe = onSnapshot(
      teamQuery,
      (snapshot) => {
        console.log(
          "Team members updated from Firestore:",
          snapshot.docs.length
        );

        const members = [];
        snapshot.forEach((doc) => {
          members.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        // Sort by active status first, then by name
        const sortedMembers = members.sort((a, b) => {
          if (a.isActive !== b.isActive) {
            return b.isActive ? 1 : -1; // Active users first
          }
          const nameA =
            a.displayName || `${a.firstName} ${a.lastName}` || a.email;
          const nameB =
            b.displayName || `${b.firstName} ${b.lastName}` || b.email;
          return nameA.localeCompare(nameB);
        });

        setTeamMembers(sortedMembers);

        // Load saved photographer preferences or initialize with all active members
        const activeMembers = sortedMembers.filter((member) => member.isActive);
        const savedPreferences = loadPhotographerPreferences(organization.id);

        if (savedPreferences && savedPreferences.length > 0) {
          // Use saved preferences, but only include photographers that still exist and are active
          const validSavedIds = savedPreferences.filter((id) =>
            activeMembers.some((member) => member.id === id)
          );
          setVisiblePhotographers(new Set(validSavedIds));
        } else {
          // No saved preferences, show all active members by default
          setVisiblePhotographers(
            new Set(activeMembers.map((member) => member.id))
          );
        }
      },
      (error) => {
        console.error("Error in team members listener:", error);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log("Cleaning up team members listener");
      unsubscribe();
    };
  }, [organization?.id]);

  // Handle session updates (for drag & drop)
  const handleUpdateSession = async (sessionId, updatedSessionData) => {
    setUpdating(true);
    try {
      console.log("handleUpdateSession called with:", {
        sessionId,
        updatedSessionData,
      });

      // Find the new photographer details
      const newPhotographer = teamMembers.find(
        (member) => member.id === updatedSessionData.photographerId
      );

      if (!newPhotographer) {
        throw new Error("Photographer not found");
      }

      // Get the original photographer ID from the dragged session
      const originalPhotographerId = updatedSessionData.originalPhotographerId;

      console.log("Photographer assignment change:", {
        from: originalPhotographerId,
        to: updatedSessionData.photographerId,
        sessionId: sessionId,
      });

      // If only the date changed (same photographer), update the date for all photographers
      if (originalPhotographerId === updatedSessionData.photographerId) {
        console.log("Date only change - updating date for entire session");
        const updateData = {
          date: updatedSessionData.date,
        };

        await updateSession(sessionId, updateData);
        // Note: Real-time listener will automatically update the UI
      } else {
        console.log("Photographer change - updating photographers array");

        // Get the full session data first to preserve all photographer notes
        const fullSessionData = await getSession(sessionId);
        console.log("Full session data for preserving notes:", fullSessionData);

        // Build the updated photographers array while preserving notes
        const updatedPhotographers = [];

        // Add all existing photographers except the one being moved, preserving their notes
        if (
          fullSessionData?.photographers &&
          Array.isArray(fullSessionData.photographers)
        ) {
          fullSessionData.photographers.forEach((photographer) => {
            if (photographer.id !== originalPhotographerId) {
              // Keep this photographer with all their original data including notes
              updatedPhotographers.push({
                id: photographer.id,
                name: photographer.name,
                email: photographer.email,
                notes: photographer.notes || "", // Preserve existing notes
              });
            }
          });
        } else {
          // Fallback: reconstruct from calendar entries but try to preserve any existing notes
          const currentSessionEntries = sessions.filter(
            (s) => s.sessionId === sessionId
          );
          console.log(
            "Current session entries for fallback:",
            currentSessionEntries
          );

          currentSessionEntries.forEach((entry) => {
            if (entry.photographerId !== originalPhotographerId) {
              // Try to find if this photographer had notes in the original session
              const originalPhotographerData =
                fullSessionData?.photographers?.find(
                  (p) => p.id === entry.photographerId
                );

              updatedPhotographers.push({
                id: entry.photographerId,
                name: entry.photographerName,
                email:
                  teamMembers.find((m) => m.id === entry.photographerId)
                    ?.email || "",
                notes: originalPhotographerData?.notes || "", // Preserve notes if they exist
              });
            }
          });
        }

        // Add the new photographer (they start with empty notes unless they were previously assigned)
        const existingNewPhotographerData =
          fullSessionData?.photographers?.find(
            (p) => p.id === newPhotographer.id
          );

        updatedPhotographers.push({
          id: newPhotographer.id,
          name: `${newPhotographer.firstName} ${newPhotographer.lastName}`,
          email: newPhotographer.email,
          notes: existingNewPhotographerData?.notes || "", // Keep their existing notes if they had any
        });

        console.log(
          "Updated photographers array with preserved notes:",
          updatedPhotographers
        );

        const updateData = {
          date: updatedSessionData.date,
          photographers: updatedPhotographers,
        };

        await updateSession(sessionId, updateData);
        // Note: Real-time listener will automatically update the UI
      }
    } catch (error) {
      console.error("Error updating session:", error);
      throw error;
    } finally {
      setUpdating(false);
    }
  };

  // Handle photographer filter toggle
  const handlePhotographerFilterToggle = (photographerId) => {
    setVisiblePhotographers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(photographerId)) {
        newSet.delete(photographerId);
      } else {
        newSet.add(photographerId);
      }

      // Save preferences to localStorage
      savePhotographerPreferences(organization.id, newSet);

      return newSet;
    });
  };

  // Handle show/hide all photographers
  const handleShowAllPhotographers = () => {
    const activeMembers = teamMembers.filter((member) => member.isActive);
    const allIds = new Set(activeMembers.map((member) => member.id));

    setVisiblePhotographers(allIds);
    savePhotographerPreferences(organization.id, allIds);
  };

  const handleHideAllPhotographers = () => {
    const emptySet = new Set();
    setVisiblePhotographers(emptySet);
    savePhotographerPreferences(organization.id, emptySet);
  };

  // Handle session click to open details modal (not edit modal)
  const handleSessionClick = (session) => {
    console.log("Session clicked, opening details modal:", session);
    setSelectedSession(session); // Use the individual calendar entry for details
    setShowDetailsModal(true);
  };

  // Handle edit session button click from details modal
  const handleEditSessionFromDetails = async () => {
    try {
      // Get the full session data for editing
      const sessionId = selectedSession.sessionId || selectedSession.id;
      console.log("Opening edit modal for session:", sessionId);

      const fullSessionData = await getSession(sessionId);

      if (fullSessionData) {
        setSelectedSession(fullSessionData); // Set full session data for editing
        setShowEditModal(true);
      } else {
        console.error("Could not fetch full session data for editing");
        setSelectedSession(selectedSession); // Fallback
        setShowEditModal(true);
      }
    } catch (error) {
      console.error("Error loading session data for editing:", error);
      setSelectedSession(selectedSession); // Fallback
      setShowEditModal(true);
    }
  };

  // Handle session updated from edit modal
  const handleSessionUpdated = () => {
    // Real-time listener will automatically update the UI
    // No need for manual state updates
  };

  // Handle session deleted from edit modal
  const handleSessionDeleted = () => {
    // Real-time listener will automatically update the UI
    // No need for manual state updates
  };

  // Get date range based on view mode
  const getDateRange = () => {
    if (viewMode === "week") {
      return {
        start: startOfWeek(currentDate, 0),
        end: endOfWeek(currentDate, 0),
      };
    } else {
      const monthStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const monthEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0
      );
      return {
        start: monthStart,
        end: monthEnd,
      };
    }
  };

  const dateRange = getDateRange();

  // Navigation functions
  const navigatePrevious = () => {
    if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Format date range for display
  const formatDateRange = () => {
    if (viewMode === "week") {
      const start = dateRange.start;
      const end = dateRange.end;
      const startMonth = start.toLocaleDateString("en-US", { month: "short" });
      const endMonth = end.toLocaleDateString("en-US", { month: "short" });
      const startDay = start.getDate();
      const endDay = end.getDate();

      if (startMonth === endMonth) {
        return `${startMonth} ${startDay} - ${endDay}`;
      } else {
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
      }
    } else {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
  };

  // Filter sessions based on schedule type and visible photographers
  const filteredSessions = sessions.filter((session) => {
    // First filter by schedule type (my vs full)
    const passesScheduleFilter =
      scheduleType === "my" ? session.photographerId === userProfile?.id : true;

    // Then filter by visible photographers
    const passesPhotographerFilter = visiblePhotographers.has(
      session.photographerId
    );

    return passesScheduleFilter && passesPhotographerFilter;
  });

  // Filter team members for display in calendar
  const filteredTeamMembers = teamMembers.filter((member) => {
    const isActiveAndVisible =
      member.isActive && visiblePhotographers.has(member.id);

    if (scheduleType === "my") {
      return member.id === userProfile?.id && isActiveAndVisible;
    }

    return isActiveAndVisible;
  });

  // Calculate stats
  const calculateStats = () => {
    const relevantSessions = filteredSessions.filter((session) => {
      const sessionDate = new Date(session.date);
      return sessionDate >= dateRange.start && sessionDate <= dateRange.end;
    });

    const totalHours = relevantSessions.reduce((sum, session) => {
      if (session.startTime && session.endTime) {
        const start = new Date(`2000-01-01 ${session.startTime}`);
        const end = new Date(`2000-01-01 ${session.endTime}`);
        const duration = (end - start) / (1000 * 60 * 60);
        return sum + duration;
      }
      return sum;
    }, 0);

    return {
      wages: 0,
      cost: 0,
      scheduledHours: totalHours,
      overtime: Math.max(0, totalHours - 40),
      laborPercentage: 0,
      absences: 0,
      shifts: relevantSessions.length,
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="schedule-loading">
        <div className="loading-spinner"></div>
        <p>Loading schedule...</p>
      </div>
    );
  }

  return (
    <div className="schedule">
      {/* Real-time Status Indicator */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          background: "#28a745",
          color: "white",
          padding: "8px 12px",
          borderRadius: "20px",
          fontSize: "12px",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            backgroundColor: "#fff",
            borderRadius: "50%",
            animation: "pulse 2s infinite",
          }}
        ></div>
        Live Updates Active
      </div>

      {/* Updating Indicator */}
      {updating && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            background: "#007bff",
            color: "white",
            padding: "10px 20px",
            borderRadius: "5px",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          Updating session...
        </div>
      )}

      {/* Header Tabs */}
      <div className="schedule__tabs">
        <button
          className={`schedule__tab ${
            scheduleType === "full" ? "schedule__tab--active" : ""
          }`}
          onClick={() => setScheduleType("full")}
        >
          FULL SCHEDULE
        </button>
        <button
          className={`schedule__tab ${
            scheduleType === "my" ? "schedule__tab--active" : ""
          }`}
          onClick={() => setScheduleType("my")}
        >
          MY SCHEDULE
        </button>
      </div>

      {/* Controls Bar */}
      <div className="schedule__controls">
        <div className="schedule__controls-left">
          {/* View Mode Selector */}
          <div className="schedule__view-selector">
            <button
              className={`schedule__view-btn ${
                viewMode === "week" ? "schedule__view-btn--active" : ""
              }`}
              onClick={() => setViewMode("week")}
            >
              Week
            </button>
            <button
              className={`schedule__view-btn ${
                viewMode === "month" ? "schedule__view-btn--active" : ""
              }`}
              onClick={() => setViewMode("month")}
            >
              Month
            </button>
          </div>

          {/* Date Navigation */}
          <div className="schedule__date-nav">
            <button className="schedule__nav-btn" onClick={navigatePrevious}>
              <ChevronLeft size={20} />
            </button>
            <button className="schedule__nav-btn" onClick={navigateNext}>
              <ChevronRight size={20} />
            </button>
            <h2 className="schedule__date-range">{formatDateRange()}</h2>
          </div>

          <button className="schedule__today-btn" onClick={goToToday}>
            Today
          </button>
        </div>

        <div className="schedule__controls-right">
          {/* Filter Buttons */}
          <div className="schedule__filters">
            <button className="schedule__filter-btn">
              <Map size={16} />
              <span>Locations</span>
            </button>
            <button
              className={`schedule__filter-btn ${
                showTeamFilter ? "schedule__filter-btn--active" : ""
              }`}
              onClick={() => setShowTeamFilter(!showTeamFilter)}
            >
              <Users size={16} />
              <span>Team ({visiblePhotographers.size})</span>
            </button>
            <button className="schedule__filter-btn">
              <Tag size={16} />
              <span>Tags</span>
            </button>
            <button className="schedule__filter-btn">
              <CalendarIcon size={16} />
              <span>Events</span>
            </button>
          </div>

          {/* Action Buttons */}
          <button className="schedule__stats-btn">
            <Filter size={16} />
            <span>Stats</span>
          </button>
          <button
            className="schedule__create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            <span>Create Session</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="schedule__stats">
        <div className="schedule__stat">
          <span className="schedule__stat-label">EST. WAGES</span>
          <span className="schedule__stat-value">
            ${stats.wages.toFixed(2)}
          </span>
        </div>
        <div className="schedule__stat">
          <span className="schedule__stat-label">SCHEDULED HOURS</span>
          <span className="schedule__stat-value">
            {Math.floor(stats.scheduledHours)}h{" "}
            {Math.round((stats.scheduledHours % 1) * 60)}min
          </span>
        </div>
        <div className="schedule__stat">
          <span className="schedule__stat-label">O/T HOURS</span>
          <span className="schedule__stat-value">
            {stats.overtime.toFixed(0)}h
          </span>
        </div>
        <div className="schedule__stat">
          <span className="schedule__stat-label">SHIFTS</span>
          <span className="schedule__stat-value">{stats.shifts}</span>
        </div>
      </div>

      {/* Calendar View */}
      <div className="schedule__calendar">
        <CalendarView
          viewMode={viewMode}
          currentDate={currentDate}
          dateRange={dateRange}
          sessions={filteredSessions}
          teamMembers={filteredTeamMembers}
          scheduleType={scheduleType}
          userProfile={userProfile}
          onUpdateSession={handleUpdateSession}
          onSessionClick={handleSessionClick}
        />
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <CreateSessionModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          teamMembers={teamMembers}
          organization={organization}
        />
      )}

      {/* Team Filter Dropdown */}
      {showTeamFilter && (
        <div
          style={{
            position: "fixed",
            top: "0",
            left: "0",
            right: "0",
            bottom: "0",
            zIndex: 9999,
          }}
          onClick={() => setShowTeamFilter(false)}
        >
          <div
            style={{
              position: "absolute",
              top: "120px",
              right: "20px",
              backgroundColor: "white",
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
              minWidth: "300px",
              maxHeight: "400px",
              overflow: "hidden",
              zIndex: 10000,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Filter Header */}
            <div
              style={{
                padding: "1rem",
                borderBottom: "1px solid #dee2e6",
                backgroundColor: "#f8f9fa",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                }}
              >
                <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: "600" }}>
                  Filter Team Members
                </h4>
                <button
                  onClick={() => setShowTeamFilter(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.25rem",
                    color: "#6c757d",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={handleShowAllPhotographers}
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Show All
                </button>
                <button
                  onClick={handleHideAllPhotographers}
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Hide All
                </button>
              </div>
            </div>

            {/* Filter List */}
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              {teamMembers
                .filter((member) => member.isActive)
                .map((member) => (
                  <div
                    key={member.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      borderBottom: "1px solid #f1f3f4",
                      cursor: "pointer",
                      backgroundColor: visiblePhotographers.has(member.id)
                        ? "#f8f9fa"
                        : "white",
                      transition: "background-color 0.2s",
                    }}
                    onClick={() => handlePhotographerFilterToggle(member.id)}
                  >
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        border: "2px solid #dee2e6",
                        borderRadius: "3px",
                        marginRight: "0.75rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: visiblePhotographers.has(member.id)
                          ? "#007bff"
                          : "white",
                        borderColor: visiblePhotographers.has(member.id)
                          ? "#007bff"
                          : "#dee2e6",
                      }}
                    >
                      {visiblePhotographers.has(member.id) && (
                        <div
                          style={{
                            width: "10px",
                            height: "10px",
                            backgroundColor: "white",
                            borderRadius: "1px",
                          }}
                        />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "500", fontSize: "0.875rem" }}>
                        {member.firstName} {member.lastName}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6c757d" }}>
                        {member.email}
                      </div>
                    </div>
                    {/* Show session count for this photographer */}
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#6c757d",
                        backgroundColor: "#f1f3f4",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "12px",
                      }}
                    >
                      {
                        sessions.filter((s) => s.photographerId === member.id)
                          .length
                      }{" "}
                      sessions
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Session Details Modal */}
      {showDetailsModal && selectedSession && (
        <SessionDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedSession(null);
          }}
          session={selectedSession}
          teamMembers={teamMembers}
          onEditSession={handleEditSessionFromDetails}
        />
      )}

      {/* Edit Session Modal */}
      {showEditModal && selectedSession && (
        <EditSessionModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setShowDetailsModal(false); // Also close details modal if it was open
            setSelectedSession(null);
          }}
          session={selectedSession}
          teamMembers={teamMembers}
          organization={organization}
          onSessionUpdated={handleSessionUpdated}
          onSessionDeleted={handleSessionDeleted}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default Schedule;
