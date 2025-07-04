import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X } from "lucide-react";
import { useJobs } from "../../../contexts/JobsContext";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { firestore } from "../../../firebase/config";

const EditJobModal = ({ show, onHide, job }) => {
  const { updateJob } = useJobs();

  const [formData, setFormData] = useState({
    schoolName: "",
    seasonType: "",
    sportName: "",
    shootDate: "",
    location: "",
    photographer: "",
    additionalNotes: "",
  });

  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        seasonType: job.seasonType || "",
        sportName: job.sportName || "",
        shootDate: shootDate,
        location: job.location || "",
        photographer: job.photographer || "",
        additionalNotes: job.additionalNotes || "",
      });
    }
  }, [job, show]);

  // Load school names when modal opens
  useEffect(() => {
    if (show) {
      loadSchoolNames();
    }
  }, [show]);

  // Reset error when modal closes
  useEffect(() => {
    if (!show) {
      setError("");
    }
  }, [show]);

  const loadSchoolNames = async () => {
    try {
      // Adjust this to match your current app's school collection structure
      const schoolsQuery = query(
        collection(firestore, "schools"),
        orderBy("name", "asc")
      );

      const querySnapshot = await getDocs(schoolsQuery);
      const schoolList = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.name) {
          schoolList.push(data.name);
        }
      });

      setSchools(schoolList);
    } catch (error) {
      console.error("Error loading school names:", error);
      // Note: You might want to add toast notifications back if available
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

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
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">School Name *</label>
                <select
                  name="schoolName"
                  value={formData.schoolName}
                  onChange={handleInputChange}
                  className="form-select"
                  required
                >
                  <option value="">Select School...</option>
                  {schools.map((school) => (
                    <option key={school} value={school}>
                      {school}
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
