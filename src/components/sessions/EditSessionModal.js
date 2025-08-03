// src/components/sessions/EditSessionModal.js - Professional Design
import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { 
  X, Clock, MapPin, Users, Check, ChevronDown, ChevronUp,
  Calendar, Building2, Camera, FileText, Trash2
} from "lucide-react";
import TimeSelect from "../shared/TimeSelect";
import SearchableSelect from "../shared/SearchableSelect";
import { updateSession, deleteSession, getSchools, getSession } from "../../firebase/firestore";
import { getOrganizationSessionTypes, getSessionTypeColor } from "../../utils/sessionTypes";
import "./CreateSessionModal.css";
import secureLogger from "../../utils/secureLogger";
import { useDataCache } from "../../contexts/DataCacheContext";

const EditSessionModal = ({ 
  isOpen, 
  onClose, 
  session,
  teamMembers, 
  organization, 
  userProfile, 
  onSessionUpdated,
  onSessionDeleted 
}) => {
  const { sessions: cachedSessions, updateSessionOptimistically } = useDataCache();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [schools, setSchools] = useState([]);
  const [showSessionTypes, setShowSessionTypes] = useState(false);
  const [sessionTypeSearch, setSessionTypeSearch] = useState("");
  const [showPhotographerNotes, setShowPhotographerNotes] = useState(true);
  const sessionTypesRef = useRef(null);
  const notesTextareaRef = useRef(null);
  
  const [formData, setFormData] = useState({
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

  // Load session data when modal opens
  useEffect(() => {
    const loadFullSession = async () => {
      if (isOpen && session) {
        console.log("Loading session data in EditSessionModal:", session);

        // Get the session ID from the calendar entry
        const sessionId = session.sessionId || session.id || session;
        
        try {
          // Load the full session document to get all photographer notes
          const fullSessionData = await getSession(sessionId);
          
          if (!fullSessionData) {
            console.error("Session not found:", sessionId);
            return;
          }
          
          let sessionData = fullSessionData;

      // Extract photographer IDs from the session
      let photographerIds = [];
      let photographerNotes = {};

      if (sessionData.photographers && Array.isArray(sessionData.photographers)) {
        photographerIds = sessionData.photographers.map((p) => p.id);
        sessionData.photographers.forEach((photographer) => {
          if (photographer.notes) {
            photographerNotes[photographer.id] = photographer.notes;
          }
        });
      } else if (sessionData.photographer?.id) {
        photographerIds = [sessionData.photographer.id];
      } else if (sessionData.photographerId) {
        photographerIds = [sessionData.photographerId];
      }

          setFormData({
            schoolId: sessionData.schoolId || "",
            date: sessionData.date || "",
            startTime: sessionData.startTime || "09:00",
            endTime: sessionData.endTime || "15:00",
            sessionTypes: Array.isArray(sessionData.sessionTypes) ? sessionData.sessionTypes : (sessionData.sessionType ? [sessionData.sessionType] : []),
            customSessionType: sessionData.customSessionType || "",
            photographerIds: photographerIds,
            photographerNotes: photographerNotes,
            notes: sessionData.notes || "",
            status: sessionData.status || "scheduled",
          });
        } catch (error) {
          console.error("Error loading full session data:", error);
          // Fall back to using the calendar entry data
          setFormData({
            schoolId: session.schoolId || "",
            date: session.date || "",
            startTime: session.startTime || "09:00",
            endTime: session.endTime || "15:00",
            sessionTypes: Array.isArray(session.sessionTypes) ? session.sessionTypes : (session.sessionType ? [session.sessionType] : []),
            customSessionType: session.customSessionType || "",
            photographerIds: session.photographerId ? [session.photographerId] : [],
            photographerNotes: {},
            notes: session.notes || "",
            status: session.status || "scheduled",
          });
        }
      }
    };
    
    loadFullSession();
  }, [isOpen, session]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sessionTypesRef.current && !sessionTypesRef.current.contains(event.target)) {
        setShowSessionTypes(false);
      }
    };
    
    if (showSessionTypes) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSessionTypes]);

  // Get session types from organization configuration
  const sessionTypes = getOrganizationSessionTypes(organization).map(type => ({
    value: type.id,
    label: type.name
  }));

  // Filter session types based on search
  const filteredSessionTypes = sessionTypes.filter(type =>
    type.label.toLowerCase().includes(sessionTypeSearch.toLowerCase())
  );


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

  const handleSessionTypeToggle = (sessionTypeId) => {
    setFormData((prev) => {
      const currentTypes = prev.sessionTypes || [];
      const isSelected = currentTypes.includes(sessionTypeId);
      
      let newTypes;
      let newCustomType = prev.customSessionType;
      
      if (isSelected) {
        newTypes = currentTypes.filter(id => id !== sessionTypeId);
        if (sessionTypeId === 'other') {
          newCustomType = "";
        }
      } else {
        newTypes = [...currentTypes, sessionTypeId];
      }
      
      return {
        ...prev,
        sessionTypes: newTypes,
        customSessionType: newCustomType
      };
    });

    if (errors.sessionTypes) {
      setErrors((prev) => ({
        ...prev,
        sessionTypes: "",
        customSessionType: "",
      }));
    }
    
    // Close the dropdown after selection
    setShowSessionTypes(false);
    setSessionTypeSearch(""); // Reset search
  };

  const handlePhotographerToggle = (photographerId) => {
    setFormData((prev) => ({
      ...prev,
      photographerIds: prev.photographerIds.includes(photographerId)
        ? prev.photographerIds.filter((id) => id !== photographerId)
        : [...prev.photographerIds, photographerId],
    }));

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

  const handleNotesChange = (e) => {
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

    // Auto-resize textarea
    if (notesTextareaRef.current) {
      notesTextareaRef.current.style.height = 'auto';
      notesTextareaRef.current.style.height = `${notesTextareaRef.current.scrollHeight}px`;
    }
  };

  // Auto-resize notes textarea on mount if there's initial content
  useEffect(() => {
    if (notesTextareaRef.current && formData.notes) {
      notesTextareaRef.current.style.height = 'auto';
      notesTextareaRef.current.style.height = `${notesTextareaRef.current.scrollHeight}px`;
    }
  }, [formData.notes, isOpen]);

  const getInitials = (firstName, lastName) => {
    const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
    return firstInitial + lastInitial || '?';
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

    if (!formData.sessionTypes || formData.sessionTypes.length === 0) {
      newErrors.sessionTypes = "At least one session type is required";
    }

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
          notes: formData.photographerNotes[member.id] || "",
        }));

      // Get school details
      const selectedSchool = schools.find(school => school.id === formData.schoolId);
      
      const updateData = {
        schoolId: formData.schoolId,
        schoolName: selectedSchool?.value || "",
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        sessionTypes: formData.sessionTypes,
        customSessionType: formData.customSessionType.trim() || null,
        photographers: selectedPhotographers,
        notes: formData.notes,
        status: formData.status,
      };

      // Optimistically update the UI immediately
      const sessionId = session.sessionId || session.id;
      updateSessionOptimistically(sessionId, updateData);

      // Close modal immediately for better UX
      handleClose();

      // Then update in Firestore (this will trigger the real-time listener)
      try {
        await updateSession(sessionId, updateData);
      } catch (error) {
        // If the update fails, the real-time listener will revert the optimistic update
        secureLogger.error("Error updating session in Firestore:", error);
        // Optionally show an error toast here
      }

      // Notify parent component
      if (onSessionUpdated) {
        onSessionUpdated();
      }
    } catch (error) {
      secureLogger.error("Error updating session:", error);
      setErrors({ general: "Failed to update session. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteSession(session.sessionId || session.id, organization?.id);

      // Notify parent component
      if (onSessionDeleted) {
        onSessionDeleted();
      }

      handleClose();
    } catch (error) {
      secureLogger.error("Error deleting session:", error);
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
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
        className="create-session-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <h2>Edit Session</h2>
          <button
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            {errors.general && (
              <div className="form-section" style={{
                backgroundColor: "#fef2f2",
                borderColor: "#fecaca",
                color: "#991b1b",
                padding: "12px 16px",
                marginBottom: "16px",
              }}>
                {errors.general}
              </div>
            )}

            {/* School & Date Section */}
            <div className="form-section">
              <div className="section-header">
                <h3 className="section-title">
                  <Building2 size={16} />
                  Session Details
                </h3>
              </div>

              <div className="form-group">
                <label className="form-label">
                  School
                  <span className="required-asterisk">*</span>
                </label>
                <SearchableSelect
                  name="schoolId"
                  value={formData.schoolId}
                  onChange={handleChange}
                  options={schools.sort((a, b) => (a.value || "").localeCompare(b.value || ""))}
                  placeholder="Select School"
                  searchPlaceholder="Search schools..."
                  error={errors.schoolId}
                  required={true}
                />
                {errors.schoolId && (
                  <div className="invalid-feedback">{errors.schoolId}</div>
                )}
              </div>

              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">
                    Date
                    <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className={`form-control ${errors.date ? "is-invalid" : ""}`}
                  />
                  {errors.date && (
                    <div className="invalid-feedback">{errors.date}</div>
                  )}
                </div>

                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Start
                      <span className="required-asterisk">*</span>
                    </label>
                    <TimeSelect
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleChange}
                      className={`form-select ${errors.startTime ? "is-invalid" : ""}`}
                    />
                    {errors.startTime && (
                      <div className="invalid-feedback">{errors.startTime}</div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      End
                      <span className="required-asterisk">*</span>
                    </label>
                    <TimeSelect
                      name="endTime"
                      value={formData.endTime}
                      onChange={handleChange}
                      className={`form-select ${errors.endTime ? "is-invalid" : ""}`}
                    />
                    {errors.endTime && (
                      <div className="invalid-feedback">{errors.endTime}</div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Session Types Section */}
            <div className="form-section">
              <div className="section-header">
                <h3 className="section-title">
                  <Camera size={16} />
                  Session Types
                </h3>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Select Types
                  <span className="required-asterisk">*</span>
                </label>
                
                <div className="session-types-container" ref={sessionTypesRef}>
                  <div className="session-types-dropdown">
                    <button
                      type="button"
                      className={`session-types-button ${errors.sessionTypes ? "is-invalid" : ""}`}
                      onClick={() => setShowSessionTypes(!showSessionTypes)}
                    >
                      <span style={{ color: formData.sessionTypes.length === 0 ? '#9ca3af' : '#111827' }}>
                        {formData.sessionTypes.length === 0 
                          ? "Select session types"
                          : `${formData.sessionTypes.length} selected`}
                      </span>
                      {showSessionTypes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showSessionTypes && (
                      <div className="session-types-menu">
                        <div className="session-types-search">
                          <input
                            type="text"
                            placeholder="Search types..."
                            value={sessionTypeSearch}
                            onChange={(e) => setSessionTypeSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        
                        {filteredSessionTypes.map((type) => (
                          <div
                            key={type.value}
                            className="session-type-option"
                            onClick={() => handleSessionTypeToggle(type.value)}
                          >
                            <div className={`session-type-checkbox ${formData.sessionTypes.includes(type.value) ? 'checked' : ''}`}>
                              <Check />
                            </div>
                            <div className="session-type-label">
                              <div 
                                className="session-type-dot" 
                                style={{ backgroundColor: getSessionTypeColor(type.value, organization) }}
                              />
                              {type.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {errors.sessionTypes && (
                  <div className="invalid-feedback">{errors.sessionTypes}</div>
                )}

                {formData.sessionTypes.length > 0 && (
                  <div className="selected-types-tags">
                    {formData.sessionTypes.map(typeId => {
                      const type = sessionTypes.find(t => t.value === typeId);
                      if (!type) return null;
                      return (
                        <span 
                          key={typeId} 
                          className="type-tag"
                          style={{ backgroundColor: getSessionTypeColor(typeId, organization) }}
                        >
                          {type.label}
                          <X 
                            size={12} 
                            className="type-tag-remove"
                            onClick={() => handleSessionTypeToggle(typeId)}
                          />
                        </span>
                      );
                    })}
                  </div>
                )}

                {formData.sessionTypes.includes('other') && (
                  <div className="custom-type-input">
                    <label className="form-label">
                      Custom Session Type <span className="required-asterisk">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.customSessionType}
                      onChange={(e) => setFormData(prev => ({ ...prev, customSessionType: e.target.value }))}
                      placeholder="Enter custom session type"
                      className={`form-control ${errors.customSessionType ? "is-invalid" : ""}`}
                    />
                    {errors.customSessionType && (
                      <div className="invalid-feedback">{errors.customSessionType}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Photographers Section */}
            <div className="form-section">
              <div className="section-header">
                <h3 className="section-title">
                  <Users size={16} />
                  Photographer Assignment
                </h3>
              </div>

              {errors.photographerIds && (
                <div className="invalid-feedback" style={{ display: "block", marginBottom: "12px" }}>
                  {errors.photographerIds}
                </div>
              )}

              <div className="photographers-container">
                <div className="photographers-grid">
                  {teamMembers
                    .filter((member) => member.isActive)
                    .map((member) => (
                      <div
                        key={member.id}
                        className={`photographer-card ${formData.photographerIds.includes(member.id) ? 'selected' : ''}`}
                        onClick={() => handlePhotographerToggle(member.id)}
                      >
                        <div className="photographer-avatar">
                          {member.photoURL ? (
                            <img 
                              src={member.photoURL} 
                              alt={`${member.firstName} ${member.lastName}`}
                            />
                          ) : (
                            getInitials(member.firstName, member.lastName)
                          )}
                        </div>
                        <div className="photographer-name">
                          {member.firstName} {member.lastName}
                        </div>
                        {formData.photographerIds.includes(member.id) && (
                          <div className="photographer-check">
                            <Check size={10} />
                          </div>
                        )}
                      </div>
                    ))}
                </div>

                {/* Individual photographer notes */}
                {formData.photographerIds.length > 0 && (
                  <div className="photographer-notes-section">
                    <div className="photographer-notes-header">
                      <div className="photographer-notes-title">
                        <FileText size={12} />
                        Individual Notes
                      </div>
                      <button
                        type="button"
                        className="notes-toggle"
                        onClick={() => setShowPhotographerNotes(!showPhotographerNotes)}
                      >
                        {showPhotographerNotes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                    
                    {showPhotographerNotes && (
                      <div className="photographer-notes-list">
                        {formData.photographerIds.map(photographerId => {
                          const member = teamMembers.find(m => m.id === photographerId);
                          if (!member) return null;
                          
                          return (
                            <div key={photographerId} className="photographer-note-field">
                              <label className="photographer-note-label">
                                {member.firstName} {member.lastName}
                              </label>
                              <input
                                type="text"
                                className="photographer-note-input"
                                placeholder={`Instructions for ${member.firstName}...`}
                                value={formData.photographerNotes[photographerId] || ""}
                                onChange={(e) => handlePhotographerNoteChange(photographerId, e.target.value)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* General Notes */}
            <div className="form-section">
              <div className="form-group">
                <label className="form-label">
                  General Session Notes
                </label>
                <textarea
                  ref={notesTextareaRef}
                  name="notes"
                  value={formData.notes}
                  onChange={handleNotesChange}
                  className="general-notes-textarea"
                  placeholder="Notes visible to all photographers..."
                />
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          {/* Delete Button */}
          {!showDeleteConfirm ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              style={{ 
                background: "#dc3545", 
                color: "white", 
                border: "1px solid #dc3545" 
              }}
            >
              <Trash2 size={12} />
              Delete
            </button>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                style={{ fontSize: "12px", padding: "4px 8px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{ 
                  background: "#dc3545", 
                  fontSize: "12px", 
                  padding: "4px 8px" 
                }}
              >
                {deleteLoading && <span className="loading-spinner" />}
                {deleteLoading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
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
              {loading && <span className="loading-spinner" />}
              {loading ? "Updating..." : "Update Session"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default EditSessionModal;