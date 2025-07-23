// src/components/sessions/CreateSessionModal.js - Updated with multiple photographers support
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Clock, MapPin, Users, Check } from "lucide-react";
import TimeSelect from "../shared/TimeSelect";
import { createSession, getSchools } from "../../firebase/firestore";
import { getOrganizationSessionTypes, getSessionTypeColor } from "../../utils/sessionTypes";

import secureLogger from "../../utils/secureLogger";

const CreateSessionModal = ({ isOpen, onClose, teamMembers, organization, userProfile, initialPhotographerId, initialDate }) => {
  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState([]);
  const [formData, setFormData] = useState({
    schoolId: "",
    date: initialDate || "",
    startTime: "09:00",
    endTime: "15:00",
    sessionTypes: [], // No session types selected by default
    customSessionType: "", // Custom session type when "other" is selected
    photographerIds: initialPhotographerId ? [initialPhotographerId] : [], // Pre-populate if provided
    photographerNotes: {}, // New field for photographer-specific notes
    notes: "",
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
          secureLogger.error("Error loading schools:", error);
        }
      }
    };
    loadSchools();
  }, [isOpen, organization?.id]);

  // Update form data when initial values change
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        date: initialDate || prev.date,
        photographerIds: initialPhotographerId ? [initialPhotographerId] : prev.photographerIds
      }));
    }
  }, [isOpen, initialDate, initialPhotographerId]);

  // Get session types from organization configuration
  const sessionTypes = getOrganizationSessionTypes(organization).map(type => ({
    value: type.id,
    label: type.name
  }));

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

  // Handle session type checkbox changes
  const handleSessionTypeChange = (sessionTypeId) => {
    setFormData((prev) => {
      const currentTypes = prev.sessionTypes || [];
      const isSelected = currentTypes.includes(sessionTypeId);
      
      let newTypes;
      let newCustomType = prev.customSessionType;
      
      if (isSelected) {
        // Remove the session type
        newTypes = currentTypes.filter(id => id !== sessionTypeId);
        // Clear custom type if "other" is being deselected
        if (sessionTypeId === 'other') {
          newCustomType = "";
        }
      } else {
        // Add the session type
        newTypes = [...currentTypes, sessionTypeId];
      }
      
      return {
        ...prev,
        sessionTypes: newTypes,
        customSessionType: newCustomType
      };
    });

    // Clear errors when user makes selection
    if (errors.sessionTypes) {
      setErrors((prev) => ({
        ...prev,
        sessionTypes: "",
        customSessionType: "",
      }));
    }
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

  const handlePhotographerNoteChange = (photographerId, note) => {
    setFormData((prev) => ({
      ...prev,
      photographerNotes: {
        ...prev.photographerNotes,
        [photographerId]: note,
      },
    }));
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

    // Photographer assignment is now optional - sessions can be created without photographers
    // if (formData.photographerIds.length === 0) {
    //   newErrors.photographerIds = "At least one photographer is required";
    // }

    if (!formData.sessionTypes || formData.sessionTypes.length === 0) {
      newErrors.sessionTypes = "At least one session type is required";
    }

    // Validate custom session type if "other" is selected
    if (formData.sessionTypes.includes('other') && !formData.customSessionType.trim()) {
      newErrors.customSessionType = "Please specify a custom session type";
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
      
      const sessionData = {
        schoolId: formData.schoolId,
        schoolName: selectedSchool?.value || "",
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        sessionTypes: formData.sessionTypes,
        customSessionType: formData.customSessionType.trim() || null, // Include custom session type
        photographers: selectedPhotographers, // Array of photographer objects
        notes: formData.notes,
        status: formData.status,
        // Add creator information
        createdBy: {
          id: userProfile?.id || userProfile?.uid,
          name: userProfile?.displayName || `${userProfile?.firstName} ${userProfile?.lastName}` || userProfile?.email,
          email: userProfile?.email,
        },
        createdAt: new Date(),
      };


      console.log("🚀 MODAL: About to call createSession with data:", {
        organizationId: organization.id,
        sessionData
      });
      
      await createSession(organization.id, sessionData);
      
      console.log("✅ MODAL: createSession completed successfully");

      // Reset form and close modal
      setFormData({
        schoolId: "",
        date: "",
        startTime: "09:00",
        endTime: "15:00",
        sessionTypes: [],
        customSessionType: "",
        photographerIds: [],
        photographerNotes: {},
        notes: "",
        status: "scheduled",
      });
      setErrors({});
      onClose();

      // Instead of refreshing the entire page, just trigger a re-fetch of data
      // The parent component should handle refreshing sessions data
      console.log("✅ MODAL: Session created successfully, modal closed");
    } catch (error) {
      secureLogger.error("Error creating session:", error);
      setErrors({ general: "Failed to create session. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

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
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Create New Session</h2>
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
                <div className="col-md-8 mb-3">
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

                <div className="col-md-4 mb-3">
                  <label
                    className="form-label"
                    style={{ fontWeight: "500", marginBottom: "0.5rem" }}
                  >
                    Session Types
                    <span style={{ color: "#dc3545" }}>*</span>
                  </label>
                  <div style={{ 
                    border: `1px solid ${errors.sessionTypes ? '#dc3545' : '#dee2e6'}`,
                    borderRadius: '0.375rem',
                    padding: '0.5rem',
                    maxHeight: '120px',
                    overflow: 'auto'
                  }}>
                    {sessionTypes.map((type) => (
                      <div key={type.value} style={{ marginBottom: '0.5rem' }}>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}>
                          <input
                            type="checkbox"
                            checked={formData.sessionTypes.includes(type.value)}
                            onChange={() => handleSessionTypeChange(type.value)}
                            style={{ marginRight: '0.25rem' }}
                          />
                          <div style={{
                            width: '12px',
                            height: '12px',
                            backgroundColor: getSessionTypeColor(type.value, organization),
                            borderRadius: '2px',
                            border: '1px solid rgba(0,0,0,0.2)'
                          }}></div>
                          {type.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  {errors.sessionTypes && (
                    <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      {errors.sessionTypes}
                    </div>
                  )}

                  {/* Custom Session Type Input - appears when "other" is selected */}
                  {formData.sessionTypes.includes('other') && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <label 
                        className="form-label"
                        style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}
                      >
                        Custom Session Type <span style={{ color: "#dc3545" }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.customSessionType}
                        onChange={(e) => setFormData(prev => ({ ...prev, customSessionType: e.target.value }))}
                        placeholder="Enter custom session type (e.g., Team Photos, Award Ceremony)"
                        className={`form-control ${errors.customSessionType ? "is-invalid" : ""}`}
                        style={{ fontSize: '0.875rem' }}
                      />
                      {errors.customSessionType && (
                        <div className="invalid-feedback" style={{ fontSize: '0.75rem' }}>
                          {errors.customSessionType}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Selected Types Preview */}
                  {formData.sessionTypes.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: '0.25rem' }}>
                        Selected:
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {formData.sessionTypes.map(typeId => {
                          const type = sessionTypes.find(t => t.value === typeId);
                          if (!type) return null;
                          
                          // Show custom type if "other" is selected and custom type is provided
                          const displayLabel = typeId === 'other' && formData.customSessionType 
                            ? formData.customSessionType 
                            : type.label;
                          
                          return (
                            <span key={typeId} style={{
                              backgroundColor: getSessionTypeColor(typeId, organization),
                              color: 'white',
                              padding: '0.125rem 0.375rem',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              {displayLabel}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                  <TimeSelect
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                    className={`form-select ${
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
                  <TimeSelect
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleChange}
                    className={`form-select ${
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
            justifyContent: "flex-end",
            gap: "0.75rem",
            backgroundColor: "#f8f9fa",
          }}
        >
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
            Create Session
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default CreateSessionModal;
