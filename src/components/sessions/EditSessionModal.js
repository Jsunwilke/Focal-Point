// src/components/sessions/EditSessionModal.js
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Calendar, Clock, MapPin, Users, Check, Trash2 } from "lucide-react";
import Button from "../shared/Button";
import { updateSession, deleteSession, getSchools } from "../../firebase/firestore";

const EditSessionModal = ({
  isOpen,
  onClose,
  session,
  teamMembers,
  organization,
  onSessionUpdated,
  onSessionDeleted,
}) => {
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [schools, setSchools] = useState([]);
  const [formData, setFormData] = useState({
    schoolId: "",
    date: "",
    startTime: "09:00",
    endTime: "17:00",
    sessionType: "sports",
    photographerIds: [],
    notes: "",
    photographerNotes: {}, // New field for photographer-specific notes
    status: "scheduled",
  });
  const [errors, setErrors] = useState({});

  // Load schools when modal opens
  useEffect(() => {
    const loadSchools = async () => {
      if (isOpen && organization?.id) {
        try {
          const schoolsData = await getSchools(organization.id);
          setSchools(schoolsData);
        } catch (error) {
          console.error("Error loading schools:", error);
        }
      }
    };
    loadSchools();
  }, [isOpen, organization?.id]);

  const sessionTypes = [
    { value: "sports", label: "Sports Photography" },
    { value: "portrait", label: "Portrait Day" },
    { value: "event", label: "School Event" },
    { value: "graduation", label: "Graduation" },
    { value: "other", label: "Other" },
  ];

  const statusOptions = [
    { value: "scheduled", label: "Scheduled" },
    { value: "in-progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  // Load session data when modal opens
  useEffect(() => {
    if (isOpen && session) {
      console.log("Loading session data in EditSessionModal:", session);

      // Extract photographer IDs from the session
      let photographerIds = [];

      // The session should now be the full session data from getSession()
      // which includes the complete photographers array
      if (session.photographers && Array.isArray(session.photographers)) {
        photographerIds = session.photographers.map((p) => p.id);
        console.log("Found photographers array:", session.photographers);
        console.log("Extracted photographer IDs:", photographerIds);
      }
      // Fallback: try single photographer format
      else if (session.photographer?.id) {
        photographerIds = [session.photographer.id];
        console.log("Found single photographer:", session.photographer);
      }
      // Last resort: if we somehow get a calendar entry instead of full session
      else if (session.photographerId) {
        photographerIds = [session.photographerId];
        console.log(
          "Using photographer ID from calendar entry:",
          session.photographerId
        );
      }

      // Extract photographer-specific notes
      let photographerNotes = {};
      if (session.photographers && Array.isArray(session.photographers)) {
        session.photographers.forEach((photographer) => {
          if (photographer.notes) {
            photographerNotes[photographer.id] = photographer.notes;
          }
        });
      }

      console.log("Final photographer IDs for form:", photographerIds);
      console.log("Photographer notes:", photographerNotes);

      setFormData({
        schoolId: session.schoolId || "",
        date: session.date || "",
        startTime: session.startTime || "09:00",
        endTime: session.endTime || "17:00",
        sessionType: session.sessionType || session.type || "sports",
        photographerIds: photographerIds,
        notes: session.notes || "",
        photographerNotes: photographerNotes,
        status: session.status || "scheduled",
      });
      setErrors({});
      setShowDeleteConfirm(false);
    }
  }, [isOpen, session]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handlePhotographerNoteChange = (photographerId, note) => {
    setFormData((prev) => ({
      ...prev,
      photographerNotes: {
        ...prev.photographerNotes,
        [photographerId]: note,
      },
    }));
  };
  const handlePhotographerToggle = (photographerId) => {
    setFormData((prev) => ({
      ...prev,
      photographerIds: prev.photographerIds.includes(photographerId)
        ? prev.photographerIds.filter((id) => id !== photographerId)
        : [...prev.photographerIds, photographerId],
    }));

    // Clear photographer error if any photographer is selected
    if (errors.photographerIds) {
      setErrors((prev) => ({
        ...prev,
        photographerIds: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.schoolId) {
      newErrors.schoolId = "School is required";
    }

    if (!formData.date) {
      newErrors.date = "Date is required";
    }

    if (!formData.startTime) {
      newErrors.startTime = "Start time is required";
    }

    if (!formData.endTime) {
      newErrors.endTime = "End time is required";
    }

    if (formData.photographerIds.length === 0) {
      newErrors.photographerIds = "At least one photographer is required";
    }

    // Validate time range
    if (formData.startTime && formData.endTime) {
      const start = new Date(`2000-01-01 ${formData.startTime}`);
      const end = new Date(`2000-01-01 ${formData.endTime}`);
      if (end <= start) {
        newErrors.endTime = "End time must be after start time";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      // Get photographer details for selected photographers
      const selectedPhotographers = teamMembers
        .filter((member) => formData.photographerIds.includes(member.id))
        .map((member) => ({
          id: member.id,
          name: `${member.firstName} ${member.lastName}`,
          email: member.email,
          notes: formData.photographerNotes[member.id] || "", // Include photographer-specific notes
        }));

      // Get school details
      const selectedSchool = schools.find(school => school.id === formData.schoolId);
      
      const updateData = {
        schoolId: formData.schoolId,
        schoolName: selectedSchool?.value || "",
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        sessionType: formData.sessionType,
        photographers: selectedPhotographers,
        notes: formData.notes,
        status: formData.status,
      };

      await updateSession(session.sessionId || session.id, updateData);

      // Notify parent component
      if (onSessionUpdated) {
        onSessionUpdated();
      }

      handleClose();
    } catch (error) {
      console.error("Error updating session:", error);
      setErrors({ general: "Failed to update session. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteSession(session.sessionId || session.id);

      // Notify parent component
      if (onSessionDeleted) {
        onSessionDeleted();
      }

      handleClose();
    } catch (error) {
      console.error("Error deleting session:", error);
      setErrors({ general: "Failed to delete session. Please try again." });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleClose = () => {
    setShowDeleteConfirm(false);
    onClose();
  };

  if (!isOpen || !session) return null;

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
          handleClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          width: "90%",
          maxWidth: "700px",
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
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Edit Session</h2>
          <button
            onClick={handleClose}
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
          {errors.general && (
            <div
              style={{
                padding: "0.75rem 1rem",
                marginBottom: "1rem",
                backgroundColor: "#f8d7da",
                border: "1px solid #f5c6cb",
                borderRadius: "0.375rem",
                color: "#721c24",
              }}
            >
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Basic Information */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  marginBottom: "1rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid #dee2e6",
                }}
              >
                Session Details
              </h3>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label
                    className="form-label d-flex align-items-center gap-2"
                    style={{ fontWeight: "500", marginBottom: "0.5rem" }}
                  >
                    <MapPin size={16} />
                    School
                    <span style={{ color: "#dc3545" }}>*</span>
                  </label>
                  <select
                    name="schoolId"
                    value={formData.schoolId}
                    onChange={handleChange}
                    className={`form-select ${
                      errors.schoolId ? "is-invalid" : ""
                    }`}
                  >
                    <option value="">Select School</option>
                    {schools
                      .sort((a, b) => (a.value || "").localeCompare(b.value || ""))
                      .map((school) => (
                        <option key={school.id} value={school.id}>
                          {school.value}
                        </option>
                      ))}
                  </select>
                  {errors.schoolId && (
                    <div className="invalid-feedback">{errors.schoolId}</div>
                  )}
                </div>

                <div className="col-md-3 mb-3">
                  <label
                    className="form-label"
                    style={{ fontWeight: "500", marginBottom: "0.5rem" }}
                  >
                    Session Type
                  </label>
                  <select
                    name="sessionType"
                    value={formData.sessionType}
                    onChange={handleChange}
                    className="form-select"
                  >
                    {sessionTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3 mb-3">
                  <label
                    className="form-label"
                    style={{ fontWeight: "500", marginBottom: "0.5rem" }}
                  >
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="form-select"
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Date and Time */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  marginBottom: "1rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid #dee2e6",
                }}
              >
                Schedule
              </h3>

              <div className="row">
                <div className="col-md-4 mb-3">
                  <label
                    className="form-label"
                    style={{ fontWeight: "500", marginBottom: "0.5rem" }}
                  >
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className={`form-control ${
                      errors.date ? "is-invalid" : ""
                    }`}
                  />
                  {errors.date && (
                    <div className="invalid-feedback">{errors.date}</div>
                  )}
                </div>

                <div className="col-md-4 mb-3">
                  <label
                    className="form-label d-flex align-items-center gap-2"
                    style={{ fontWeight: "500", marginBottom: "0.5rem" }}
                  >
                    <Clock size={16} />
                    Start Time
                  </label>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                    className={`form-control ${
                      errors.startTime ? "is-invalid" : ""
                    }`}
                  />
                  {errors.startTime && (
                    <div className="invalid-feedback">{errors.startTime}</div>
                  )}
                </div>

                <div className="col-md-4 mb-3">
                  <label
                    className="form-label"
                    style={{ fontWeight: "500", marginBottom: "0.5rem" }}
                  >
                    End Time
                  </label>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleChange}
                    className={`form-control ${
                      errors.endTime ? "is-invalid" : ""
                    }`}
                  />
                  {errors.endTime && (
                    <div className="invalid-feedback">{errors.endTime}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Photographer Assignment */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  marginBottom: "1rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid #dee2e6",
                }}
              >
                Photographer Assignment
              </h3>

              <div className="mb-3">
                <label
                  className="form-label d-flex align-items-center gap-2"
                  style={{ fontWeight: "500", marginBottom: "0.5rem" }}
                >
                  <Users size={16} />
                  Select Photographers
                  <span style={{ color: "#dc3545" }}>*</span>
                </label>

                {errors.photographerIds && (
                  <div
                    style={{
                      color: "#dc3545",
                      fontSize: "0.875rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {errors.photographerIds}
                  </div>
                )}

                <div
                  style={{
                    border: "1px solid #dee2e6",
                    borderRadius: "0.375rem",
                    maxHeight: "300px",
                    overflowY: "auto",
                    backgroundColor: "#f8f9fa",
                  }}
                >
                  {teamMembers
                    .filter((member) => member.isActive)
                    .map((member) => (
                      <div
                        key={member.id}
                        style={{
                          borderBottom: "1px solid #e9ecef",
                          backgroundColor: formData.photographerIds.includes(
                            member.id
                          )
                            ? "#e3f2fd"
                            : "transparent",
                        }}
                      >
                        {/* Photographer Selection Row */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "0.75rem",
                            cursor: "pointer",
                            transition: "background-color 0.2s",
                          }}
                          onClick={() => handlePhotographerToggle(member.id)}
                        >
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              border: "2px solid #dee2e6",
                              borderRadius: "4px",
                              marginRight: "0.75rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor:
                                formData.photographerIds.includes(member.id)
                                  ? "#007bff"
                                  : "white",
                              borderColor: formData.photographerIds.includes(
                                member.id
                              )
                                ? "#007bff"
                                : "#dee2e6",
                            }}
                          >
                            {formData.photographerIds.includes(member.id) && (
                              <Check size={12} color="white" />
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: "500" }}>
                              {member.firstName} {member.lastName}
                            </div>
                            <div
                              style={{ fontSize: "0.875rem", color: "#6c757d" }}
                            >
                              {member.email}
                            </div>
                          </div>
                        </div>

                        {/* Photographer-Specific Notes (only show if selected) */}
                        {formData.photographerIds.includes(member.id) && (
                          <div
                            style={{
                              padding: "0 0.75rem 0.75rem 2.5rem",
                              borderTop: "1px solid #e9ecef",
                              backgroundColor: "#f8f9fa",
                            }}
                          >
                            <label
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: "500",
                                color: "#6c757d",
                                marginBottom: "0.25rem",
                                display: "block",
                              }}
                            >
                              Notes for {member.firstName}:
                            </label>
                            <textarea
                              placeholder={`Specific notes for ${member.firstName}...`}
                              value={
                                formData.photographerNotes[member.id] || ""
                              }
                              onChange={(e) =>
                                handlePhotographerNoteChange(
                                  member.id,
                                  e.target.value
                                )
                              }
                              style={{
                                width: "100%",
                                minHeight: "60px",
                                padding: "0.5rem",
                                border: "1px solid #dee2e6",
                                borderRadius: "0.25rem",
                                fontSize: "0.875rem",
                                resize: "vertical",
                                fontFamily: "inherit",
                              }}
                              onClick={(e) => e.stopPropagation()} // Prevent toggle when clicking in textarea
                            />
                          </div>
                        )}
                      </div>
                    ))}
                </div>

                {formData.photographerIds.length > 0 && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#6c757d",
                    }}
                  >
                    {formData.photographerIds.length} photographer
                    {formData.photographerIds.length > 1 ? "s" : ""} selected
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label
                  className="form-label"
                  style={{ fontWeight: "500", marginBottom: "0.5rem" }}
                >
                  Session Notes (Shared)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="form-control"
                  rows={3}
                  placeholder="General session notes visible to all photographers..."
                />
                <small className="text-muted">
                  These notes are shared across all photographers for this
                  session.
                </small>
              </div>
            </div>
          </form>
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
          <div>
            {!showDeleteConfirm ? (
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                <Trash2 size={16} className="me-1" />
                Delete Session
              </button>
            ) : (
              <div
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
              >
                <span
                  style={{
                    fontSize: "0.875rem",
                    color: "#dc3545",
                    marginRight: "0.5rem",
                  }}
                >
                  Are you sure?
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={handleDelete}
                  disabled={deleteLoading}
                >
                  {deleteLoading && (
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      role="status"
                    ></span>
                  )}
                  Delete
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading && (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                ></span>
              )}
              Update Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default EditSessionModal;
