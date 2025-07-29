import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Calendar, RefreshCw } from "lucide-react";
import { useJobs } from "../../../contexts/JobsContext";
import { useToast } from "../../../contexts/ToastContext";
import FileUploadPreview from "../roster/FileUploadPreview";
import { getSchools } from "../../../firebase/firestore";
import { useAuth } from "../../../contexts/AuthContext";

const CreateJobModal = ({ show, onHide }) => {
  const { createJob } = useJobs();
  const { showToast } = useToast();
  const { organization } = useAuth();

  const [formData, setFormData] = useState({
    schoolName: "",
    seasonType: "",
    sportName: "",
    shootDate: "",
    location: "",
    photographer: "",
    additionalNotes: "",
  });

  const [rosterData, setRosterData] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load school names when modal opens
  useEffect(() => {
    if (show && organization?.id) {
      loadSchoolNames();
    }
  }, [show, organization?.id]);

  // Reset form when modal closes
  useEffect(() => {
    if (!show) {
      setFormData({
        schoolName: "",
        seasonType: "",
        sportName: "",
        shootDate: "",
        location: "",
        photographer: "",
        additionalNotes: "",
      });
      setRosterData([]);
      setError("");
    }
  }, [show]);

  const loadSchoolNames = async () => {
    try {
      const schoolsData = await getSchools(organization.id);
      const schoolList = schoolsData
        .filter(school => school.name || school.value)
        .map(school => school.name || school.value)
        .sort();
      
      setSchools(schoolList);
    } catch (error) {
      console.error("Error loading school names:", error);
      showToast("Warning", "Failed to load school names", "warning");
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
      const jobData = {
        ...formData,
        shootDate: new Date(formData.shootDate + "T00:00:00"),
        roster: rosterData,
        groupImages: [],
      };

      await createJob(jobData);
      onHide();
    } catch (error) {
      console.error("Error creating job:", error);
      setError(error.message || "Failed to create job");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onHide();
  };

  if (!show) return null;

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
          width: "95%",
          maxWidth: "900px",
          maxHeight: "80vh",
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
            padding: "0.75rem 1.5rem",
            borderBottom: "1px solid #dee2e6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f8f9fa",
            flexShrink: 0,
          }}
        >
          <h4 style={{ margin: 0, fontSize: "1.25rem" }}>
            Create New Sports Job
          </h4>
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
            padding: "0.75rem 1.5rem",
            overflow: "auto",
            flex: 1,
            minHeight: 0,
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
              <div className="col-md-6 mb-2">
                <label
                  className="form-label"
                  style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}
                >
                  School Name *
                </label>
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

              <div className="col-md-6 mb-2">
                <label
                  className="form-label"
                  style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}
                >
                  Season/Type *
                </label>
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
              <div className="col-md-6 mb-2">
                <label
                  className="form-label"
                  style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}
                >
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

              <div className="col-md-6 mb-2">
                <label
                  className="form-label"
                  style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}
                >
                  Shoot Date *
                </label>
                <div
                  style={{
                    position: "relative",
                    cursor: "pointer",
                  }}
                  onClick={() => document.getElementById("shootDate").click()}
                >
                  <input
                    type="date"
                    id="shootDate"
                    name="shootDate"
                    value={formData.shootDate}
                    onChange={handleInputChange}
                    className="form-control"
                    style={{
                      cursor: "pointer",
                      width: "100%",
                    }}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-2">
                <label
                  className="form-label"
                  style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}
                >
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="form-control"
                />
              </div>

              <div className="col-md-6 mb-2">
                <label
                  className="form-label"
                  style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}
                >
                  Photographer
                </label>
                <input
                  type="text"
                  name="photographer"
                  value={formData.photographer}
                  onChange={handleInputChange}
                  className="form-control"
                />
              </div>
            </div>

            <div className="mb-2">
              <label
                className="form-label"
                style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}
              >
                Additional Notes
              </label>
              <textarea
                name="additionalNotes"
                value={formData.additionalNotes}
                onChange={handleInputChange}
                className="form-control"
                rows={2}
              />
            </div>

            <FileUploadPreview
              rosterData={rosterData}
              setRosterData={setRosterData}
            />

            {/* Better Roster Preview - Override the crappy one above */}
            {rosterData.length > 0 && (
              <div className="mt-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0" style={{ fontSize: "0.95rem" }}>
                    Roster Preview:
                  </h6>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                    onClick={() => {
                      // Trigger refresh of preview if needed
                      console.log("Refresh preview");
                    }}
                  >
                    <RefreshCw size={12} />
                    Refresh
                  </button>
                </div>

                <div
                  style={{
                    border: "1px solid #e0e6ed",
                    borderRadius: "6px",
                    overflow: "hidden",
                    maxHeight: "140px",
                    overflowY: "auto",
                    backgroundColor: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 0.8fr 1fr",
                      fontSize: "0.75rem",
                    }}
                  >
                    {/* Header */}
                    <div
                      style={{
                        padding: "8px 10px",
                        backgroundColor: "#f8f9fc",
                        fontWeight: "600",
                        borderBottom: "1px solid #e0e6ed",
                        color: "#4a5568",
                      }}
                    >
                      Last Name
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "#718096",
                          fontWeight: "400",
                        }}
                      >
                        (Name)
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "8px 10px",
                        backgroundColor: "#f8f9fc",
                        fontWeight: "600",
                        borderBottom: "1px solid #e0e6ed",
                        color: "#4a5568",
                      }}
                    >
                      First Name
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "#718096",
                          fontWeight: "400",
                        }}
                      >
                        (Subject ID)
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "8px 10px",
                        backgroundColor: "#f8f9fc",
                        fontWeight: "600",
                        borderBottom: "1px solid #e0e6ed",
                        color: "#4a5568",
                      }}
                    >
                      Teacher
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "#718096",
                          fontWeight: "400",
                        }}
                      >
                        (Special)
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "8px 10px",
                        backgroundColor: "#f8f9fc",
                        fontWeight: "600",
                        borderBottom: "1px solid #e0e6ed",
                        color: "#4a5568",
                      }}
                    >
                      Group
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "#718096",
                          fontWeight: "400",
                        }}
                      >
                        (Sport/Team)
                      </div>
                    </div>

                    {/* Data Rows */}
                    {rosterData.slice(0, 4).map((entry, index) => (
                      <React.Fragment key={index}>
                        <div
                          style={{
                            padding: "5px 8px",
                            borderBottom:
                              index < 3 ? "1px solid #f1f5f9" : "none",
                            backgroundColor:
                              index % 2 === 0 ? "#fff" : "#fafbfc",
                          }}
                        >
                          {entry.lastName ? (
                            <span
                              style={{ color: "#2d3748", fontWeight: "500" }}
                            >
                              {entry.lastName}
                            </span>
                          ) : (
                            <span
                              style={{ color: "#a0aec0", fontStyle: "italic" }}
                            >
                              Blank
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            padding: "5px 8px",
                            borderBottom:
                              index < 3 ? "1px solid #f1f5f9" : "none",
                            backgroundColor:
                              index % 2 === 0 ? "#fff" : "#fafbfc",
                          }}
                        >
                          {entry.firstName ? (
                            <span style={{ color: "#4a5568" }}>
                              {entry.firstName}
                            </span>
                          ) : (
                            <span style={{ color: "#a0aec0" }}>-</span>
                          )}
                        </div>
                        <div
                          style={{
                            padding: "5px 8px",
                            borderBottom:
                              index < 3 ? "1px solid #f1f5f9" : "none",
                            backgroundColor:
                              index % 2 === 0 ? "#fff" : "#fafbfc",
                          }}
                        >
                          {entry.teacher ? (
                            <span style={{ color: "#4a5568" }}>
                              {entry.teacher}
                            </span>
                          ) : (
                            <span style={{ color: "#a0aec0" }}>-</span>
                          )}
                        </div>
                        <div
                          style={{
                            padding: "5px 8px",
                            borderBottom:
                              index < 3 ? "1px solid #f1f5f9" : "none",
                            backgroundColor:
                              index % 2 === 0 ? "#fff" : "#fafbfc",
                          }}
                        >
                          {entry.group ? (
                            <span style={{ color: "#4a5568" }}>
                              {entry.group}
                            </span>
                          ) : (
                            <span style={{ color: "#a0aec0" }}>-</span>
                          )}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div
                  className="mt-2"
                  style={{ fontSize: "0.75rem", color: "#718096" }}
                >
                  <strong>Total athletes:</strong>{" "}
                  {
                    rosterData.filter(
                      (entry) => entry.lastName && entry.lastName.trim()
                    ).length
                  }
                  {rosterData.length >
                    rosterData.filter(
                      (entry) => entry.lastName && entry.lastName.trim()
                    ).length && (
                    <span style={{ color: "#d69e2e", marginLeft: "8px" }}>
                      (
                      {rosterData.length -
                        rosterData.filter(
                          (entry) => entry.lastName && entry.lastName.trim()
                        ).length}{" "}
                      blank entries)
                    </span>
                  )}
                  {rosterData.length > 4 && (
                    <span style={{ marginLeft: "8px" }}>
                      • Showing first 4 of {rosterData.length} entries
                    </span>
                  )}
                </div>
              </div>
            )}

            <style>
              {`
                /* Hide the crappy blue roster preview from FileUploadPreview */
                .table-responsive {
                  display: none !important;
                }
                
                /* Hide the ugly preview but keep the file upload working */
                div[dangerouslySetInnerHTML] {
                  display: none !important;
                }
              `}
            </style>
          </form>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "0.75rem 1.5rem",
            borderTop: "1px solid #dee2e6",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            backgroundColor: "#f8f9fa",
            flexShrink: 0,
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
            Create Job
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default CreateJobModal;
