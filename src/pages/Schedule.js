// src/pages/Schedule.js - With Real-time Firestore Listeners and Secure Logging
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import secureLogger from "../utils/secureLogger";
import {
  getTeamMembers,
  updateSession,
  getSession,
  getSchools,
} from "../firebase/firestore";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { firestore } from "../firebase/config";
import CalendarView from "../components/calendar/CalendarView";
import CreateSessionModal from "../components/sessions/CreateSessionModal";
import EditSessionModal from "../components/sessions/EditSessionModal";
import SessionDetailsModal from "../components/sessions/SessionDetailsModal";
import StatsModal from "../components/stats/StatsModal";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Users,
  Map,
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

// Secure storage utility functions
const generateStorageKey = (base) => {
  // Create a simple hash-based key to obfuscate storage keys
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `fp_${Math.abs(hash).toString(36)}`;
};

const simpleEncrypt = (text, key) => {
  try {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return btoa(result); // Base64 encode
  } catch (error) {
    secureLogger.error('Encryption error:', error);
    return text; // Fallback to plaintext
  }
};

const simpleDecrypt = (encodedText, key) => {
  try {
    const text = atob(encodedText); // Base64 decode
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (error) {
    secureLogger.error('Decryption error:', error);
    return null;
  }
};

// Helper functions for saving/loading photographer preferences with encryption
const savePhotographerPreferences = (organizationId, photographerIds) => {
  try {
    const key = generateStorageKey(`schedule-photographers-${organizationId}`);
    const data = JSON.stringify(Array.from(photographerIds));
    const encryptionKey = `${organizationId}-preferences`;
    const encryptedData = simpleEncrypt(data, encryptionKey);
    
    // Set expiration (30 days)
    const expirationTime = Date.now() + (30 * 24 * 60 * 60 * 1000);
    const storageObject = {
      data: encryptedData,
      expires: expirationTime
    };
    
    localStorage.setItem(key, JSON.stringify(storageObject));
  } catch (error) {
    secureLogger.error("Error saving photographer preferences:", error);
  }
};

const loadPhotographerPreferences = (organizationId) => {
  try {
    const key = generateStorageKey(`schedule-photographers-${organizationId}`);
    const saved = localStorage.getItem(key);
    
    if (!saved) return null;
    
    const storageObject = JSON.parse(saved);
    
    // Check if data has expired
    if (Date.now() > storageObject.expires) {
      localStorage.removeItem(key);
      return null;
    }
    
    const encryptionKey = `${organizationId}-preferences`;
    const decryptedData = simpleDecrypt(storageObject.data, encryptionKey);
    
    return decryptedData ? JSON.parse(decryptedData) : null;
  } catch (error) {
    secureLogger.error("Error loading photographer preferences:", error);
    // Clean up corrupted data
    const key = generateStorageKey(`schedule-photographers-${organizationId}`);
    localStorage.removeItem(key);
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
  const [showSchoolFilter, setShowSchoolFilter] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [schools, setSchools] = useState([]);
  const [visiblePhotographers, setVisiblePhotographers] = useState(new Set());
  const [visibleSchools, setVisibleSchools] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Real-time listener for sessions
  useEffect(() => {
    if (!organization?.id) return;


    const sessionsQuery = query(
      collection(firestore, "sessions"),
      where("organizationID", "==", organization.id)
    );

    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {

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
                  session.title || `${session.sessionType || 'Session'} at ${session.schoolName || 'School'}`,
                date: sessionDate,
                startTime: session.startTime,
                endTime: session.endTime,
                photographerId: photographer.id,
                photographerName: photographer.name,
                sessionType: session.sessionType || "session",
                sessionTypes: session.sessionTypes || [session.sessionType || "session"],
                customSessionType: session.customSessionType, // Include custom session type
                status: session.status || "scheduled",
                schoolId: session.schoolId,
                schoolName: session.schoolName || session.location || "",
                location: session.location || session.schoolName || "",
                notes: session.notes,
              }));
            } else {
              // Fallback for sessions with single photographer (legacy format)
              return [
                {
                  id: session.id,
                  sessionId: session.id,
                  title:
                    session.title || `${session.sessionType || 'Session'} at ${session.schoolName || 'School'}`,
                  date: sessionDate,
                  startTime: session.startTime,
                  endTime: session.endTime,
                  photographerId: session.photographer?.id || null,
                  photographerName: session.photographer?.name || null,
                  sessionType: session.sessionType || "session",
                  sessionTypes: session.sessionTypes || [session.sessionType || "session"],
                  customSessionType: session.customSessionType, // Include custom session type
                  status: session.status || "scheduled",
                  schoolId: session.schoolId,
                  schoolName: session.schoolName || session.location || "",
                  location: session.location || session.schoolName || "",
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
        secureLogger.error("Error in sessions listener:", error);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [organization?.id]);

  // Real-time listener for team members
  useEffect(() => {
    if (!organization?.id) return;


    const teamQuery = query(
      collection(firestore, "users"),
      where("organizationID", "==", organization.id)
    );

    const unsubscribe = onSnapshot(
      teamQuery,
      (snapshot) => {

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

        if (savedPreferences && Array.isArray(savedPreferences) && savedPreferences.length > 0) {
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
        secureLogger.error("Error in team members listener:", error);
      }
    );

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [organization?.id]);

  // Load schools when organization changes
  useEffect(() => {
    const loadSchools = async () => {
      if (!organization?.id) return;

      try {
        const schoolsData = await getSchools(organization.id);
        setSchools(schoolsData);
        
        // Initialize visible schools to show all schools by default
        setVisibleSchools(new Set(schoolsData.map(school => school.id)));
      } catch (error) {
        secureLogger.error("Error loading schools:", error);
      }
    };

    loadSchools();
  }, [organization?.id]);

  // Handle session updates (for drag & drop)
  const handleUpdateSession = async (sessionId, updatedSessionData) => {
    setUpdating(true);
    try {

      // Find the new photographer details
      const newPhotographer = teamMembers.find(
        (member) => member.id === updatedSessionData.photographerId
      );

      if (!newPhotographer) {
        throw new Error("Photographer not found");
      }

      // Get the original photographer ID from the dragged session
      const originalPhotographerId = updatedSessionData.originalPhotographerId;


      // If only the date changed (same photographer), update the date for all photographers
      if (originalPhotographerId === updatedSessionData.photographerId) {
        const updateData = {
          date: updatedSessionData.date,
        };

        await updateSession(sessionId, updateData);
        // Note: Real-time listener will automatically update the UI
      } else {

        // Get the full session data first to preserve all photographer notes
        const fullSessionData = await getSession(sessionId);

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


        const updateData = {
          date: updatedSessionData.date,
          photographers: updatedPhotographers,
        };

        await updateSession(sessionId, updateData);
        // Note: Real-time listener will automatically update the UI
      }
    } catch (error) {
      secureLogger.error("Error updating session:", error);
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

  // Handle school filter toggle
  const handleSchoolFilterToggle = (schoolId) => {
    setVisibleSchools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(schoolId)) {
        newSet.delete(schoolId);
      } else {
        newSet.add(schoolId);
      }
      return newSet;
    });
  };

  // Handle show/hide all schools
  const handleShowAllSchools = () => {
    const allSchoolIds = new Set(schools.map((school) => school.id));
    setVisibleSchools(allSchoolIds);
  };

  const handleHideAllSchools = () => {
    const emptySet = new Set();
    setVisibleSchools(emptySet);
  };

  // Handle session click to open details modal (not edit modal)
  const handleSessionClick = (session) => {
    setSelectedSession(session); // Use the individual calendar entry for details
    setShowDetailsModal(true);
  };

  // Handle edit session button click from details modal
  const handleEditSessionFromDetails = async () => {
    try {
      // Get the full session data for editing
      const sessionId = selectedSession.sessionId || selectedSession.id;

      const fullSessionData = await getSession(sessionId);

      if (fullSessionData) {
        setSelectedSession(fullSessionData); // Set full session data for editing
        setShowEditModal(true);
      } else {
        secureLogger.error("Could not fetch full session data for editing");
        setSelectedSession(selectedSession); // Fallback
        setShowEditModal(true);
      }
    } catch (error) {
      secureLogger.error("Error loading session data for editing:", error);
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

  // Filter sessions based on schedule type, visible photographers, and visible schools
  const filteredSessions = sessions.filter((session) => {
    // First filter by schedule type (my vs full)
    const passesScheduleFilter =
      scheduleType === "my" ? session.photographerId === userProfile?.id : true;

    // Then filter by visible photographers
    const passesPhotographerFilter = visiblePhotographers.has(
      session.photographerId
    );

    // Then filter by visible schools (if any schools are selected)
    const passesSchoolFilter = 
      visibleSchools.size === 0 || visibleSchools.has(session.schoolId);

    return passesScheduleFilter && passesPhotographerFilter && passesSchoolFilter;
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
            <button
              className={`schedule__filter-btn ${
                showSchoolFilter ? "schedule__filter-btn--active" : ""
              }`}
              onClick={() => setShowSchoolFilter(!showSchoolFilter)}
            >
              <Map size={16} />
              <span>Schools ({visibleSchools.size})</span>
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
          </div>

          {/* Action Buttons */}
          <button 
            className="schedule__stats-btn"
            onClick={() => setShowStatsModal(true)}
          >
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
          organization={organization}
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
          userProfile={userProfile}
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

      {/* School Filter Dropdown */}
      {showSchoolFilter && (
        <div
          style={{
            position: "fixed",
            top: "0",
            left: "0",
            right: "0",
            bottom: "0",
            zIndex: 9999,
          }}
          onClick={() => setShowSchoolFilter(false)}
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
                  Filter Schools
                </h4>
                <button
                  onClick={() => setShowSchoolFilter(false)}
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
                  onClick={handleShowAllSchools}
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
                  onClick={handleHideAllSchools}
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
              {schools
                .sort((a, b) => (a.value || "").localeCompare(b.value || ""))
                .map((school) => (
                  <div
                    key={school.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      borderBottom: "1px solid #f1f3f4",
                      cursor: "pointer",
                      backgroundColor: visibleSchools.has(school.id)
                        ? "#f8f9fa"
                        : "white",
                      transition: "background-color 0.2s",
                    }}
                    onClick={() => handleSchoolFilterToggle(school.id)}
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
                        backgroundColor: visibleSchools.has(school.id)
                          ? "#007bff"
                          : "white",
                        borderColor: visibleSchools.has(school.id)
                          ? "#007bff"
                          : "#dee2e6",
                      }}
                    >
                      {visibleSchools.has(school.id) && (
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
                        {school.value}
                      </div>
                    </div>
                    {/* Show session count for this school */}
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#6c757d",
                        backgroundColor: "#f1f3f4",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "12px",
                      }}
                    >
                      {sessions.filter((s) => s.schoolId === school.id).length}{" "}
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
          userProfile={userProfile}
          organization={organization}
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

      {/* Stats Modal */}
      {showStatsModal && (
        <StatsModal
          isOpen={showStatsModal}
          onClose={() => setShowStatsModal(false)}
          sessions={sessions}
          teamMembers={teamMembers}
          schools={schools}
          userProfile={userProfile}
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
