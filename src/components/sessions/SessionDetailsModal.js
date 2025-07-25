// src/components/sessions/SessionDetailsModal.js
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  FileText,
  Edit3,
  CalendarDays,
  Check,
} from "lucide-react";
import { getSession, getSchools, publishSession } from "../../firebase/firestore";
import { getSessionTypeColor, getSessionTypeColors, getSessionTypeNames, normalizeSessionTypes } from "../../utils/sessionTypes";
import secureLogger from "../../utils/secureLogger";

const SessionDetailsModal = ({
  isOpen,
  onClose,
  session, // This is the individual calendar entry (photographer shift)
  teamMembers,
  userProfile, // Current signed-in user
  organization,
  onEditSession, // Callback to open the edit modal
  onRescheduleToNextYear, // Callback to reschedule to next year
  showRescheduleOption = false, // Whether to show reschedule option
}) => {
  const [fullSessionData, setFullSessionData] = useState(null);
  const [schoolDetails, setSchoolDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRescheduleConfirm, setShowRescheduleConfirm] = useState(false);
  const [nextYearDate, setNextYearDate] = useState(null);

  // Helper function to check if there's a leap day (Feb 29) between two dates
  const hasLeapDayBetween = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Get the years we need to check
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    
    for (let year = startYear; year <= endYear; year++) {
      // Check if this year is a leap year
      const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      
      if (isLeapYear) {
        const feb29 = new Date(year, 1, 29); // February 29th of this year
        
        // Check if Feb 29 falls between our start and end dates
        if (feb29 > start && feb29 <= end) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Calculate next year date for the same day of week
  // Examples:
  // - 2024-08-21 (Wed) + 364 days = 2025-08-20 (Wed) ✓
  // - 2024-02-28 (Wed) + 364 days = 2025-02-26 (Wed) + 1 leap day = 2025-02-27 (Thu) → needs 365 days total
  // - 2023-08-21 (Mon) + 364 days = 2024-08-19 (Mon) ✓ (no leap day in range)
  const calculateNextYearDate = (dateString) => {
    // Parse the date string (YYYY-MM-DD format)
    const [year, month, day] = dateString.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day); // month is 0-indexed
    
    // Add exactly 52 weeks (364 days) to maintain the same day of the week
    const nextYearDate = new Date(currentDate);
    nextYearDate.setDate(currentDate.getDate() + 364);
    
    // Check if there's a leap day between the original date and the calculated next year date
    // If so, add 1 extra day to account for the leap year
    if (hasLeapDayBetween(currentDate, nextYearDate)) {
      nextYearDate.setDate(nextYearDate.getDate() + 1);
    }
    
    return nextYearDate;
  };

  // Handle reschedule to next year
  const handleRescheduleToNextYear = () => {
    if (!fullSessionData || !onRescheduleToNextYear) return;
    
    const sessionDate = fullSessionData.date || session.date;
    const calculatedNextYearDate = calculateNextYearDate(sessionDate);
    setNextYearDate(calculatedNextYearDate);
    setShowRescheduleConfirm(true);
  };

  // Confirm reschedule
  const confirmReschedule = () => {
    if (!nextYearDate || !fullSessionData) return;
    
    const formattedDate = nextYearDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    onRescheduleToNextYear({
      ...fullSessionData,
      date: formattedDate,
      // Remove photographer assignments - they will need to be reassigned for next year
      photographers: [],
      photographerId: null,
      photographer: null,
    });
    
    setShowRescheduleConfirm(false);
    setNextYearDate(null);
    onClose();
  };

  // Cancel reschedule
  const cancelReschedule = () => {
    setShowRescheduleConfirm(false);
    setNextYearDate(null);
  };

  // Load full session data when modal opens
  useEffect(() => {
    const loadSessionData = async () => {
      if (isOpen && session) {
        setLoading(true);
        try {
          const sessionId = session.sessionId || session.id;
          const fullData = await getSession(sessionId);
          setFullSessionData(fullData || session);

          // Load school details if we have a school ID
          const schoolId = (fullData || session)?.schoolId;
          if (schoolId && organization?.id) {
            const schools = await getSchools(organization.id);
            const school = schools.find(s => s.id === schoolId);
            setSchoolDetails(school);
          }
        } catch (error) {
          secureLogger.error("Error loading session data:", error);
          setFullSessionData(session); // Fallback to the clicked session
        } finally {
          setLoading(false);
        }
      }
    };

    loadSessionData();
  }, [isOpen, session]);

  if (!isOpen || !session) return null;

  // Get the photographer details for this specific shift
  const currentPhotographer = teamMembers.find(
    (member) => member.id === session.photographerId
  );

  // Get photographer-specific notes if available
  const photographerNotes =
    fullSessionData?.photographers?.find((p) => p.id === session.photographerId)
      ?.notes || "";

  // Get all assigned photographers for this session
  const allAssignedPhotographers =
    fullSessionData?.photographers ||
    (session.photographer ? [session.photographer] : []);

  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    // Parse date string in local timezone to avoid UTC offset issues
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };


  // Get session type color using organization configuration
  const getSessionTypeBadgeColor = (type) => {
    return getSessionTypeColor(type, organization);
  };

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          width: "90%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #dee2e6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f8f9fa",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "1.25rem",
                marginBottom: "0.25rem",
              }}
            >
              Session Details
            </h2>
            <div
              style={{
                fontSize: "0.875rem",
                color: "#6c757d",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <User size={14} />
              {currentPhotographer
                ? `${currentPhotographer.firstName} ${currentPhotographer.lastName}`
                : "Unknown Photographer"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              color: "#6c757d",
              borderRadius: "4px",
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: "1.5rem",
            overflow: "auto",
            flex: 1,
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <div style={{ marginBottom: "1rem" }}>
                Loading session details...
              </div>
            </div>
          ) : (
            <>
              {/* Session Title and Type */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "1rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "1.4rem",
                        fontWeight: "600",
                        color: "#333",
                        marginBottom: "0.25rem"
                      }}
                    >
                      {session.schoolName || 'School'}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.9rem",
                        color: "#666",
                        fontWeight: "400"
                      }}
                    >
                      {session.title || `${session.sessionType || 'Session'} Session`}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    {(() => {
                      const sessionTypes = normalizeSessionTypes(session.sessionTypes || session.sessionType);
                      const colors = getSessionTypeColors(sessionTypes, organization);
                      const names = getSessionTypeNames(sessionTypes, organization);
                      
                      return sessionTypes.map((type, index) => {
                        // Use custom session type if "other" is selected and custom type exists
                        let displayName = names[index];
                        if (type === 'other' && (fullSessionData?.customSessionType || session.customSessionType)) {
                          displayName = fullSessionData?.customSessionType || session.customSessionType;
                        }
                        
                        return (
                          <span
                            key={`${type}-${index}`}
                            style={{
                              backgroundColor: colors[index],
                              color: "white",
                              padding: "0.3rem 0.8rem",
                              borderRadius: "1rem",
                              fontSize: "0.75rem",
                              fontWeight: "500",
                              textTransform: "capitalize",
                            }}
                          >
                            {displayName}
                          </span>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Date and Time Info */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                  padding: "1rem",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "0.5rem",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                      color: "#6c757d",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                    }}
                  >
                    <Calendar size={16} />
                    DATE
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: "500" }}>
                    {formatDate(session.date)}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                      color: "#6c757d",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                    }}
                  >
                    <Clock size={16} />
                    TIME
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: "500" }}>
                    {formatTime(session.startTime)} -{" "}
                    {formatTime(session.endTime)}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                    color: "#6c757d",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  <MapPin size={16} />
                  SCHOOL
                </div>
                <div style={{ fontSize: "1rem", fontWeight: "500", marginBottom: "0.25rem" }}>
                  {session.schoolName || "Not specified"}
                </div>
                {schoolDetails && (schoolDetails.street || schoolDetails.city || schoolDetails.state) && (
                  <div style={{ fontSize: "0.875rem", color: "#6c757d", lineHeight: "1.4" }}>
                    {schoolDetails.street && (
                      <div>{schoolDetails.street}</div>
                    )}
                    {(schoolDetails.city || schoolDetails.state || schoolDetails.zipCode) && (
                      <div>
                        {schoolDetails.city && schoolDetails.city}
                        {schoolDetails.city && schoolDetails.state && ", "}
                        {schoolDetails.state && schoolDetails.state}
                        {schoolDetails.zipCode && ` ${schoolDetails.zipCode}`}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* All Assigned Photographers */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.75rem",
                    color: "#6c757d",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  <Users size={16} />
                  ALL ASSIGNED PHOTOGRAPHERS
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  {allAssignedPhotographers.map((photographer, index) => {
                    const isCurrentUser = photographer.id === userProfile?.id;
                    return (
                      <span
                        key={index}
                        style={{
                          backgroundColor: isCurrentUser ? "#e3f2fd" : "#f1f3f4",
                          border: isCurrentUser ? "2px solid #007bff" : "1px solid #dee2e6",
                          color: isCurrentUser ? "#007bff" : "#495057",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "0.5rem",
                          fontSize: "0.875rem",
                          fontWeight: isCurrentUser ? "600" : "500",
                        }}
                      >
                        {photographer.name}
                        {isCurrentUser && " (You)"}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Session Notes */}
              {fullSessionData?.notes && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.75rem",
                      color: "#6c757d",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                    }}
                  >
                    <FileText size={16} />
                    SESSION NOTES (SHARED)
                  </div>
                  <div
                    style={{
                      backgroundColor: "#f8f9fa",
                      border: "1px solid #dee2e6",
                      borderRadius: "0.375rem",
                      padding: "0.75rem",
                      fontSize: "0.875rem",
                      lineHeight: "1.5",
                    }}
                  >
                    {fullSessionData.notes}
                  </div>
                </div>
              )}

              {/* Photographer-Specific Notes */}
              {photographerNotes && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.75rem",
                      color: "#6c757d",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                    }}
                  >
                    <User size={16} />
                    NOTES FOR{" "}
                    {currentPhotographer?.firstName?.toUpperCase() || "YOU"}
                  </div>
                  <div
                    style={{
                      backgroundColor: "#fff3cd",
                      border: "1px solid #ffeaa7",
                      borderRadius: "0.375rem",
                      padding: "0.75rem",
                      fontSize: "0.875rem",
                      lineHeight: "1.5",
                    }}
                  >
                    {photographerNotes}
                  </div>
                </div>
              )}

              {/* Creator Information - Subtle */}
              <div style={{ marginBottom: "1rem", paddingTop: "0.5rem", borderTop: "1px solid #f1f3f4" }}>
                <div style={{ 
                  fontSize: "0.75rem", 
                  color: "#9ca3af", 
                  fontWeight: "400"
                }}>
                  Created by {fullSessionData?.createdBy?.name || 
                             userProfile?.displayName || 
                             `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || 
                             userProfile?.email || 
                             'Unknown User'}
                  {fullSessionData?.createdAt && (
                    <span style={{ marginLeft: "0.5rem" }}>
                      • {new Date(fullSessionData.createdAt.toDate ? fullSessionData.createdAt.toDate() : fullSessionData.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #dee2e6",
            display: "flex",
            justifyContent: "space-between",
            backgroundColor: "#f8f9fa",
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {showRescheduleOption && (
              <button
                type="button"
                className="btn btn-warning"
                onClick={handleRescheduleToNextYear}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  backgroundColor: "#ffc107",
                  borderColor: "#ffc107",
                  color: "#212529",
                }}
              >
                <CalendarDays size={16} />
                Duplicate to Next Year
              </button>
            )}
            {/* Publish Button - Only visible for unpublished sessions to admins/managers */}
            {fullSessionData?.isPublished === false && 
             (userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
              <button
                type="button"
                className="btn btn-success"
                onClick={async () => {
                  try {
                    await publishSession(fullSessionData.id);
                    alert('Session published successfully!');
                    onClose(); // Close modal to refresh data
                  } catch (error) {
                    secureLogger.error('Error publishing session:', error);
                    alert('Failed to publish session. Please try again.');
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  backgroundColor: "#28a745",
                  borderColor: "#28a745",
                  color: "white",
                }}
              >
                <Check size={16} />
                Publish Session
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose(); // Close this modal first
                onEditSession(); // Then open the edit modal
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Edit3 size={16} />
              Edit Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Confirmation modal content
  const confirmationModal = showRescheduleConfirm && (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10002, // Higher than main modal
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          cancelReschedule();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
          Duplicate Session for Next Year
        </h3>
        <p style={{ margin: '0 0 24px 0', lineHeight: '1.5', color: '#6c757d' }}>
          Are you sure you want to create a copy of this session for:
        </p>
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '6px', 
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <strong style={{ fontSize: '16px', color: '#495057' }}>
            {nextYearDate && nextYearDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={cancelReschedule}
            style={{
              padding: '8px 16px',
              border: '1px solid #6c757d',
              backgroundColor: 'transparent',
              color: '#6c757d',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmReschedule}
            style={{
              padding: '8px 16px',
              border: 'none',
              backgroundColor: '#ffc107',
              color: '#212529',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Create Duplicate
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(modalContent, document.body)}
      {confirmationModal && ReactDOM.createPortal(confirmationModal, document.body)}
    </>
  );
};

export default SessionDetailsModal;
