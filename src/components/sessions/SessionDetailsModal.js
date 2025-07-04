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
  Tag,
} from "lucide-react";
import { getSession } from "../../firebase/firestore";

const SessionDetailsModal = ({
  isOpen,
  onClose,
  session, // This is the individual calendar entry (photographer shift)
  teamMembers,
  onEditSession, // Callback to open the edit modal
}) => {
  const [fullSessionData, setFullSessionData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load full session data when modal opens
  useEffect(() => {
    const loadSessionData = async () => {
      if (isOpen && session) {
        setLoading(true);
        try {
          const sessionId = session.sessionId || session.id;
          const fullData = await getSession(sessionId);
          setFullSessionData(fullData || session);
        } catch (error) {
          console.error("Error loading session data:", error);
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
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "scheduled":
        return "#007bff";
      case "in-progress":
        return "#ffc107";
      case "completed":
        return "#28a745";
      case "cancelled":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  const getSessionTypeColor = (type) => {
    switch (type) {
      case "sports":
        return "#8b5cf6";
      case "portrait":
        return "#3b82f6";
      case "event":
        return "#f59e0b";
      case "graduation":
        return "#10b981";
      default:
        return "#ef4444";
    }
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
                    alignItems: "center",
                    gap: "1rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "1.5rem",
                      fontWeight: "600",
                    }}
                  >
                    {session.title || `${session.sport} at ${session.location}`}
                  </h3>
                  <span
                    style={{
                      backgroundColor: getSessionTypeColor(session.type),
                      color: "white",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "1rem",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                      textTransform: "uppercase",
                    }}
                  >
                    {session.type || "Session"}
                  </span>
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    backgroundColor: getStatusColor(session.status),
                    color: "white",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "1rem",
                    fontSize: "0.75rem",
                    fontWeight: "500",
                  }}
                >
                  <Tag size={12} />
                  {(session.status || "scheduled").toUpperCase()}
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

              {/* Location and Sport */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1.5rem",
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
                    <MapPin size={16} />
                    LOCATION
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: "500" }}>
                    {session.location || "Not specified"}
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
                    <Tag size={16} />
                    SPORT/ACTIVITY
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: "500" }}>
                    {session.sport || "Not specified"}
                  </div>
                </div>
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
                  {allAssignedPhotographers.map((photographer, index) => (
                    <span
                      key={index}
                      style={{
                        backgroundColor:
                          photographer.id === session.photographerId
                            ? "#e3f2fd"
                            : "#f1f3f4",
                        border:
                          photographer.id === session.photographerId
                            ? "2px solid #007bff"
                            : "1px solid #dee2e6",
                        color:
                          photographer.id === session.photographerId
                            ? "#007bff"
                            : "#495057",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                        fontWeight:
                          photographer.id === session.photographerId
                            ? "600"
                            : "500",
                      }}
                    >
                      {photographer.name}
                      {photographer.id === session.photographerId && " (You)"}
                    </span>
                  ))}
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
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default SessionDetailsModal;
