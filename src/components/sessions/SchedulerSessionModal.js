// src/components/sessions/SchedulerSessionModal.js
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Calendar, Clock, School as SchoolIcon, Settings } from "lucide-react";
import { createSession, getSchools } from "../../firebase/firestore";
import secureLogger from "../../utils/secureLogger";
import "../shared/Modal.css";
import "./SchedulerSessionModal.css";

const SchedulerSessionModal = ({ isOpen, onClose, organization, userProfile }) => {
  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState([]);
  const [formData, setFormData] = useState({
    schoolId: "",
    date: "",
    startTime: "09:00",
    endTime: "15:00",
    schedulerConfigurationId: "",
    notes: ""
  });
  const [errors, setErrors] = useState({});
  const [selectedSchool, setSelectedSchool] = useState(null);

  // Load schools when modal opens
  useEffect(() => {
    const loadSchools = async () => {
      if (isOpen && organization?.id) {
        try {
          const schoolsData = await getSchools(organization.id);
          // Only show schools that have scheduler configurations
          const schoolsWithConfigs = schoolsData.filter(
            school => school.schedulerConfigurations && school.schedulerConfigurations.length > 0
          );
          setSchools(schoolsWithConfigs);
        } catch (error) {
          secureLogger.error("Error loading schools:", error);
        }
      }
    };
    loadSchools();
  }, [isOpen, organization?.id]);

  // Update selected school when schoolId changes
  useEffect(() => {
    if (formData.schoolId) {
      const school = schools.find(s => s.id === formData.schoolId);
      setSelectedSchool(school);
      // Reset configuration selection when school changes
      if (formData.schedulerConfigurationId) {
        setFormData(prev => ({ ...prev, schedulerConfigurationId: "" }));
      }
    } else {
      setSelectedSchool(null);
    }
  }, [formData.schoolId, schools]);

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

  const validateForm = () => {
    const newErrors = {};

    if (!formData.schoolId) {
      newErrors.schoolId = "School is required";
    }

    if (!formData.date) {
      newErrors.date = "Date is required";
    }

    if (!formData.schedulerConfigurationId) {
      newErrors.schedulerConfigurationId = "Scheduler configuration is required";
    }

    if (!formData.startTime) {
      newErrors.startTime = "Start time is required";
    }

    if (!formData.endTime) {
      newErrors.endTime = "End time is required";
    }

    // Validate end time is after start time
    if (formData.startTime && formData.endTime) {
      if (formData.endTime <= formData.startTime) {
        newErrors.endTime = "End time must be after start time";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const school = schools.find(s => s.id === formData.schoolId);
      const config = school?.schedulerConfigurations?.find(
        c => c.id === formData.schedulerConfigurationId
      );

      if (!config) {
        throw new Error("Scheduler configuration not found");
      }

      // Create empty scheduler assignments based on the configuration
      const schedulerAssignments = [];

      // Create session data
      const sessionData = {
        schoolId: formData.schoolId,
        schoolName: school.value || school.name,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        schedulerConfigurationId: formData.schedulerConfigurationId,
        schedulerAssignments,
        notes: formData.notes || "",
        status: "scheduled",
        isPublished: false,
        photographers: [], // Empty for scheduler sessions
        sessionTypes: [config.name], // Use config name as session type
      };

      await createSession(organization.id, sessionData);
      onClose();
    } catch (error) {
      secureLogger.error("Error creating scheduler session:", error);
      setErrors({ submit: error.message || "Failed to create session" });
    } finally {
      setLoading(false);
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
        backgroundColor: "rgba(0, 0, 0, 0.5)",
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
        className="modal"
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
          maxWidth: "600px",
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">Create Scheduler Session</h2>
            <p className="modal__subtitle">
              Create a new session with position-based worker assignments
            </p>
          </div>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          {errors.submit && (
            <div className="form-error form-error--global">{errors.submit}</div>
          )}

          <div className="modal__content">
            {/* School Selection */}
            <div className="form-group">
              <label htmlFor="schoolId" className="form-label">
                <SchoolIcon size={14} style={{ display: 'inline', marginRight: '6px' }} />
                School *
              </label>
              <select
                id="schoolId"
                name="schoolId"
                className={`form-input ${errors.schoolId ? "form-input--error" : ""}`}
                value={formData.schoolId}
                onChange={handleChange}
                required
              >
                <option value="">Select a school</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.value || school.name} ({school.schedulerConfigurations?.length || 0} configs)
                  </option>
                ))}
              </select>
              {errors.schoolId && (
                <span className="form-error-text">{errors.schoolId}</span>
              )}
              {schools.length === 0 && (
                <span className="form-hint form-hint--warning">
                  No schools with scheduler configurations found. Please add scheduler configurations to your schools first.
                </span>
              )}
            </div>

            {/* Scheduler Configuration Selection */}
            {selectedSchool && (
              <div className="form-group">
                <label htmlFor="schedulerConfigurationId" className="form-label">
                  <Settings size={14} style={{ display: 'inline', marginRight: '6px' }} />
                  Scheduler Configuration *
                </label>
                <select
                  id="schedulerConfigurationId"
                  name="schedulerConfigurationId"
                  className={`form-input ${errors.schedulerConfigurationId ? "form-input--error" : ""}`}
                  value={formData.schedulerConfigurationId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a configuration</option>
                  {selectedSchool.schedulerConfigurations?.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name} ({config.positions?.length || 0} positions)
                    </option>
                  ))}
                </select>
                {errors.schedulerConfigurationId && (
                  <span className="form-error-text">{errors.schedulerConfigurationId}</span>
                )}
              </div>
            )}

            {/* Date */}
            <div className="form-group">
              <label htmlFor="date" className="form-label">
                <Calendar size={14} style={{ display: 'inline', marginRight: '6px' }} />
                Date *
              </label>
              <input
                type="date"
                id="date"
                name="date"
                className={`form-input ${errors.date ? "form-input--error" : ""}`}
                value={formData.date}
                onChange={handleChange}
                required
              />
              {errors.date && (
                <span className="form-error-text">{errors.date}</span>
              )}
            </div>

            {/* Time */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startTime" className="form-label">
                  <Clock size={14} style={{ display: 'inline', marginRight: '6px' }} />
                  Start Time *
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  className={`form-input ${errors.startTime ? "form-input--error" : ""}`}
                  value={formData.startTime}
                  onChange={handleChange}
                  required
                />
                {errors.startTime && (
                  <span className="form-error-text">{errors.startTime}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="endTime" className="form-label">
                  <Clock size={14} style={{ display: 'inline', marginRight: '6px' }} />
                  End Time *
                </label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  className={`form-input ${errors.endTime ? "form-input--error" : ""}`}
                  value={formData.endTime}
                  onChange={handleChange}
                  required
                />
                {errors.endTime && (
                  <span className="form-error-text">{errors.endTime}</span>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="notes" className="form-label">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                className="form-textarea"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Optional notes about this session"
                rows={3}
              />
            </div>
          </div>

          <div className="modal__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || schools.length === 0}
            >
              {loading ? "Creating..." : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return ReactDOM.createPortal(modalContent, document.body);
};

export default SchedulerSessionModal;
