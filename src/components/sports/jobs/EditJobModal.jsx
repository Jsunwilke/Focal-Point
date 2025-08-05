import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X } from "lucide-react";
import { useJobs } from "../../../contexts/JobsContext";
import { useAuth } from "../../../contexts/AuthContext";
import { getSchools } from "../../../firebase/firestore";
import { query, collection, where, getDocs } from "firebase/firestore";
import { firestore } from "../../../firebase/config";

const EditJobModal = ({ show, onHide, job }) => {
  const { updateJob } = useJobs();
  const { organization } = useAuth();

  const [formData, setFormData] = useState({
    schoolName: "",
    schoolId: "",
    sessionId: "",
    seasonType: "",
    sportName: "",
    shootDate: "",
    location: "",
    photographer: "",
    additionalNotes: "",
  });

  const [schools, setSchools] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState("");

  // Helper function to convert military time to standard US format
  const formatTimeToUS = (militaryTime) => {
    if (!militaryTime) return '';
    
    // Parse the time (expecting format like "14:30" or "1430")
    let hours, minutes;
    if (militaryTime.includes(':')) {
      [hours, minutes] = militaryTime.split(':').map(Number);
    } else if (militaryTime.length === 4) {
      hours = parseInt(militaryTime.substring(0, 2));
      minutes = parseInt(militaryTime.substring(2, 4));
    } else {
      return militaryTime; // Return as-is if format is unexpected
    }
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Initialize form data when job prop changes
  useEffect(() => {
    if (job && show) {
      let shootDate = "";

      try {
        // Handle different date formats
        if (job.shootDate) {
          if (job.shootDate.toDate) {
            // Firestore Timestamp
            shootDate = job.shootDate.toDate().toISOString().split("T")[0];
          } else if (job.shootDate instanceof Date) {
            // JavaScript Date object
            shootDate = job.shootDate.toISOString().split("T")[0];
          } else if (typeof job.shootDate === "string") {
            // String date
            const date = new Date(job.shootDate);
            if (!isNaN(date.getTime())) {
              shootDate = date.toISOString().split("T")[0];
            }
          } else {
            // Fallback for other formats
            const date = new Date(job.shootDate);
            if (!isNaN(date.getTime())) {
              shootDate = date.toISOString().split("T")[0];
            }
          }
        }
      } catch (error) {
        console.error("Error parsing shoot date:", error);
        shootDate = "";
      }

      setFormData({
        schoolName: job.schoolName || "",
        schoolId: job.schoolId || "",
        sessionId: job.sessionId || "",
        seasonType: job.seasonType || "",
        sportName: job.sportName || "",
        shootDate: shootDate,
        location: job.location || "",
        photographer: job.photographer || "",
        additionalNotes: job.additionalNotes || "",
      });
      
    }
  }, [job, show]);

  // Load school names and sessions when modal opens
  useEffect(() => {
    if (show && organization?.id) {
      loadSchoolNames();
      loadAvailableSessions();
    }
  }, [show, organization?.id]);

  // Reset error when modal closes
  useEffect(() => {
    if (!show) {
      setError("");
    }
  }, [show]);

  const loadSchoolNames = async () => {
    try {
      const schoolsData = await getSchools(organization.id);
      const schoolList = schoolsData
        .filter(school => school.id && (school.name || school.value))
        .map(school => ({
          id: school.id,
          name: school.name || school.value
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setSchools(schoolList);
    } catch (error) {
      console.error("Error loading school names:", error);
      // Note: You might want to add toast notifications back if available
    }
  };

  // Load all available sessions for the next 2 weeks
  const loadAvailableSessions = async () => {
    setLoadingSessions(true);
    try {
      // Get date range (today to 2 weeks from now)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const twoWeeksFromNow = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      // Format dates for Firestore query
      const formatDateString = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const todayString = formatDateString(today);
      const twoWeeksString = formatDateString(twoWeeksFromNow);

      // Query all sessions for the organization
      const q = query(
        collection(firestore, "sessions"),
        where("organizationID", "==", organization.id),
        where("date", ">=", todayString),
        where("date", "<=", twoWeeksString)
      );

      const snapshot = await getDocs(q);
      const sessionsData = [];
      
      snapshot.forEach((doc) => {
        const sessionData = { id: doc.id, ...doc.data() };
        // Include sessions that are either not linked or linked to current job
        if (!sessionData.hasSportsJob || sessionData.id === job?.sessionId) {
          sessionsData.push(sessionData);
        }
      });

      // Sort by date
      sessionsData.sort((a, b) => a.date.localeCompare(b.date));
      
      setSessions(sessionsData);
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoadingSessions(false);
    }
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "schoolId") {
      // When school changes, update both ID and name
      const selectedSchool = schools.find(s => s.id === value);
      setFormData((prev) => ({ 
        ...prev, 
        schoolId: value,
        schoolName: selectedSchool ? selectedSchool.name : ""
      }));
    } else if (name === "sessionId") {
      // When session is selected, auto-fill multiple fields
      const selectedSession = sessions.find(s => s.id === value);
      if (selectedSession) {
        // Find the school if we have the schoolId
        let schoolName = selectedSession.schoolName || "";
        let schoolId = selectedSession.schoolId || "";
        
        if (schoolId && schools.length > 0) {
          const school = schools.find(s => s.id === schoolId);
          if (school) {
            schoolName = school.name;
          }
        }
        
        setFormData((prev) => ({ 
          ...prev, 
          sessionId: value,
          schoolId: schoolId,
          schoolName: schoolName,
          shootDate: selectedSession.date || prev.shootDate,
          location: selectedSession.location || selectedSession.schoolName || prev.location
        }));
      } else {
        setFormData((prev) => ({ ...prev, sessionId: value }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (error) setError("");
  };

  const validateForm = () => {
    if (!formData.schoolName) {
      setError("Please select a school name");
      return false;
    }
    if (!formData.seasonType) {
      setError("Please select a season/type");
      return false;
    }
    if (!formData.shootDate) {
      setError("Please select a shoot date");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const updates = {
        schoolName: formData.schoolName,
        schoolId: formData.schoolId,
        sessionId: formData.sessionId,
        seasonType: formData.seasonType,
        sportName: formData.sportName,
        shootDate: new Date(formData.shootDate + "T00:00:00"), // Ensure consistent timezone handling
        location: formData.location,
        photographer: formData.photographer,
        additionalNotes: formData.additionalNotes,
      };

      await updateJob(job.id, updates);
      onHide();
    } catch (error) {
      console.error("Error updating job:", error);
      setError(error.message || "Failed to update job");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onHide();
  };

  if (!show || !job) return null;

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
        zIndex: 10001, // Higher than edit athlete modal
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
          maxWidth: "800px",
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
          <h4 style={{ margin: 0, fontSize: "1.25rem" }}>Edit Job Details</h4>
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
          {error && (
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
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Session Selection - First */}
            <div className="row">
              <div className="col-12 mb-3">
                <label className="form-label">
                  Select Session <span className="text-muted">(Next 2 weeks)</span>
                </label>
                <select
                  name="sessionId"
                  value={formData.sessionId}
                  onChange={handleInputChange}
                  className="form-select"
                  disabled={loadingSessions}
                >
                  <option value="">
                    {loadingSessions ? "Loading sessions..." : "Select a session to link this sports job to..."}
                  </option>
                  {sessions.map((session) => {
                    const date = new Date(session.date + 'T12:00:00');
                    const dateStr = date.toLocaleDateString('en-US', { 
                      weekday: 'short',
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    });
                    const timeStr = session.startTime ? 
                      ` at ${formatTimeToUS(session.startTime)}` : '';
                    const typeStr = session.sessionType || session.sessionTypes?.join(', ') || '';
                    const schoolStr = session.schoolName || 'Unknown School';
                    const isCurrent = session.id === job?.sessionId;
                    
                    return (
                      <option key={session.id} value={session.id}>
                        {dateStr}{timeStr} - {schoolStr} - {typeStr || 'Session'}{isCurrent ? ' (Current)' : ''}
                      </option>
                    );
                  })}
                </select>
                {sessions.length === 0 && !loadingSessions && (
                  <small className="text-muted">
                    No available sessions found for the next 2 weeks. Sessions must not already have a sports job attached.
                  </small>
                )}
              </div>
            </div>

            {/* School and Season Row */}
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">School Name *</label>
                <select
                  name="schoolId"
                  value={formData.schoolId}
                  onChange={handleInputChange}
                  className="form-select"
                  required
                >
                  <option value="">Select School...</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label">Season/Type *</label>
                <select
                  name="seasonType"
                  value={formData.seasonType}
                  onChange={handleInputChange}
                  className="form-select"
                  required
                >
                  <option value="">Select Season/Type...</option>
                  <option value="Fall Sports">Fall Sports</option>
                  <option value="Winter Sports">Winter Sports</option>
                  <option value="Spring Sports">Spring Sports</option>
                  <option value="League">League</option>
                </select>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">
                  Sport <span className="text-muted">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="sportName"
                  value={formData.sportName}
                  onChange={handleInputChange}
                  className="form-control"
                  placeholder="e.g., Basketball, Soccer, Baseball"
                />
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label">Shoot Date *</label>
                <input
                  type="date"
                  name="shootDate"
                  value={formData.shootDate}
                  onChange={handleInputChange}
                  className="form-control"
                  required
                />
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="form-control"
                />
              </div>

              <div className="col-md-6 mb-3">
                <label className="form-label">Photographer</label>
                <input
                  type="text"
                  name="photographer"
                  value={formData.photographer}
                  onChange={handleInputChange}
                  className="form-control"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Additional Notes</label>
              <textarea
                name="additionalNotes"
                value={formData.additionalNotes}
                onChange={handleInputChange}
                className="form-control"
                rows={3}
              />
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
            Update Job
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default EditJobModal;
