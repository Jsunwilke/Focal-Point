// Helper function to format dates consistently
const formatJobDate = (date) => {
  try {
    let dateObj;

    if (!date) return "No date";

    if (date.toDate) {
      // Firestore Timestamp
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      // JavaScript Date object
      dateObj = date;
    } else if (typeof date === "string") {
      // String date - handle ISO format specifically
      dateObj = new Date(date);
    } else {
      // Fallback for other formats
      dateObj = new Date(date);
    }

    if (isNaN(dateObj.getTime())) {
      return "Invalid date";
    }

    // Use UTC methods to avoid timezone shifts for date-only values
    if (typeof date === "string" && date.includes("T00:00:00")) {
      // This is likely a date-only value stored as ISO string
      return dateObj.toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } else {
      return dateObj.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
}; // src/components/sports/jobs/ViewJobModal.jsx
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { Button, Tab, Tabs } from "react-bootstrap";
import { Edit3, Upload } from "lucide-react";
import { useJobs } from "../../../contexts/JobsContext";
import { formatDate } from "../../../utils/dateHelpers";
import {
  countValidAthletes,
  countPhotographedAthletes,
} from "../../../utils/calculations";
import RosterTable from "../roster/RosterTable";
import GroupsList from "../groups/GroupsList";
import JobStats from "../stats/JobStats";
import ExportModal from "../common/ExportModal";
import EditJobModal from "./EditJobModal";
import LoadingSpinner from "../common/LoadingSpinner";

const ViewJobModal = ({ show, onHide, jobId, highlightPlayerId, onImportJob }) => {
  const {
    getJob,
    toggleJobArchiveStatus,
    currentJobID,
    setCurrentJobID,
    rosterData,
    setRosterData,
    groupsData,
    setGroupsData,
  } = useJobs();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("roster");
  const [showExportModal, setShowExportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Load job data when modal opens
  useEffect(() => {
    if (show && jobId) {
      loadJobData();
    }
  }, [show, jobId]);

  // Set current job ID for context
  useEffect(() => {
    if (show && jobId) {
      setCurrentJobID(jobId);
    }

    return () => {
      if (!show) {
        setCurrentJobID("");
        // Don't clear roster/groups data here as it causes issues with sub-modals
      }
    };
  }, [show, jobId, setCurrentJobID]);

  const loadJobData = async () => {
    setLoading(true);

    try {
      const jobData = await getJob(jobId);
      if (jobData) {
        setJob(jobData);
        setRosterData(jobData.roster || []);
        setGroupsData(jobData.groupImages || []);
      }
    } catch (error) {
      console.error("Error loading job:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!job) return;

    setArchiveLoading(true);

    try {
      await toggleJobArchiveStatus(job.id, !job.isArchived);
      // Refresh job data to get updated status
      await loadJobData();
      // Close modal after successful archive/unarchive
      onHide();
    } catch (error) {
      console.error("Error toggling archive status:", error);
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleClose = () => {
    setJob(null);
    setActiveTab("roster");
    onHide();
  };

  if (!show) return null;

  if (loading || !job) {
    const loadingModal = (
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
          zIndex: 9999,
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: "8px",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <LoadingSpinner text="Loading job details..." />
        </div>
      </div>
    );

    return ReactDOM.createPortal(loadingModal, document.body);
  }

  // Calculate stats
  const validAthleteCount = countValidAthletes(rosterData);
  const totalRosterEntries = rosterData.length;
  const blankCount = totalRosterEntries - validAthleteCount;
  const photographedCount = countPhotographedAthletes(rosterData);
  const groupsCount = groupsData.length;

  // Display season/type and optional sport
  const seasonTypeDisplay = job.seasonType || job.sportName || "";
  const sportDisplay =
    job.sportName && job.seasonType ? ` - ${job.sportName}` : "";
  const modalTitle = `${job.schoolName} - ${seasonTypeDisplay}${sportDisplay}`;

  const archiveBtnClass = job.isArchived
    ? "btn-outline-primary"
    : "btn-outline-success";
  const archiveBtnIcon = job.isArchived
    ? "bi-arrow-counterclockwise"
    : "bi-check-circle";
  const archiveBtnText = job.isArchived
    ? "Mark as Active"
    : "Mark as Completed";

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
        zIndex: 9999,
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          maxWidth: "none",
          width: "85vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #dee2e6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h4 style={{ margin: 0, fontSize: "1.25rem" }}>{modalTitle}</h4>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setShowEditModal(true)}
            >
              <Edit3 size={16} className="me-1" />
              Edit Details
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => onImportJob && onImportJob(job)}
              disabled={!job}
            >
              <Upload size={16} className="me-1" />
              Import
            </Button>
            <button
              onClick={handleClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: "1.5rem",
            overflow: "auto",
            flex: 1,
          }}
        >
          {/* Job Overview */}
          <div className="row mb-4">
            <div className="col-md-6">
              <h4>{job.schoolName}</h4>
              <h5 className="text-primary">
                {seasonTypeDisplay}
                {sportDisplay}
              </h5>
              <p className="text-muted">
                <strong>Date:</strong> {formatJobDate(job.shootDate)}
                {job.location && (
                  <>
                    <br />
                    <strong>Location:</strong> {job.location}
                  </>
                )}
                {job.photographer && (
                  <>
                    <br />
                    <strong>Photographer:</strong> {job.photographer}
                  </>
                )}
              </p>
            </div>
            <div className="col-md-6">
              <div className="d-flex justify-content-end mb-3">
                <Button
                  variant={
                    job.isArchived ? "outline-primary" : "outline-success"
                  }
                  onClick={handleArchiveToggle}
                  disabled={archiveLoading}
                >
                  {archiveLoading ? (
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                    ></span>
                  ) : (
                    <i className={`bi ${archiveBtnIcon} me-1`}></i>
                  )}
                  {archiveBtnText}
                </Button>
              </div>

              <div className="card">
                <div className="card-body p-3">
                  <div className="row text-center">
                    <div className="col-4 border-end">
                      <h3>{validAthleteCount}</h3>
                      <p className="mb-0 text-muted">Athletes</p>
                      {blankCount > 0 && (
                        <small className="text-warning">
                          {blankCount} blank
                        </small>
                      )}
                    </div>
                    <div className="col-4 border-end">
                      <h3>{photographedCount}</h3>
                      <p className="mb-0 text-muted">Photographed</p>
                      {validAthleteCount > 0 && (
                        <small className="text-info">
                          {Math.round(
                            (photographedCount / validAthleteCount) * 100
                          )}
                          %
                        </small>
                      )}
                    </div>
                    <div className="col-4">
                      <h3>{groupsCount}</h3>
                      <p className="mb-0 text-muted">Groups</p>
                    </div>
                  </div>
                </div>
              </div>

              {job.additionalNotes && (
                <div className="mt-3">
                  <h6>Notes:</h6>
                  <p className="text-muted">{job.additionalNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-3">
            <Tab eventKey="roster" title="Athletes Roster">
              <RosterTable
                roster={rosterData}
                jobId={job.id}
                highlightPlayerId={highlightPlayerId}
              />
            </Tab>

            <Tab eventKey="groups" title="Group Images">
              <GroupsList groups={groupsData} jobId={job.id} />
            </Tab>

            <Tab eventKey="stats" title="Job Stats">
              <JobStats job={job} />
            </Tab>

            <Tab eventKey="export" title="Export Data">
              <div className="row mt-3">
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-header">
                      <h5 className="mb-0">Export Options</h5>
                    </div>
                    <div className="card-body">
                      <Button
                        variant="success"
                        className="w-100"
                        onClick={() => setShowExportModal(true)}
                      >
                        <i className="bi bi-download"></i> Export Data
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-header">
                      <h5 className="mb-0">Export Tips</h5>
                    </div>
                    <div className="card-body">
                      <p className="mb-2">
                        The exported file includes mappings for Captura
                        Workflow:
                      </p>
                      <ul className="small mb-0">
                        <li>
                          <strong>Last Name</strong> column maps to{" "}
                          <strong>Name</strong>
                        </li>
                        <li>
                          <strong>First Name</strong> column maps to{" "}
                          <strong>Subject ID</strong>
                        </li>
                        <li>
                          <strong>Teacher</strong> column maps to{" "}
                          <strong>Special</strong>
                        </li>
                        <li>
                          <strong>Group</strong> column maps to{" "}
                          <strong>Sport/Team</strong>
                        </li>
                        <li>
                          <strong>Images</strong> column contains photographer
                          data
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </Tab>
          </Tabs>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #dee2e6",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div>
            <Button
              variant={job.isArchived ? "outline-primary" : "outline-success"}
              onClick={handleArchiveToggle}
              disabled={archiveLoading}
            >
              {archiveLoading ? (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                ></span>
              ) : (
                <i className={`bi ${archiveBtnIcon} me-1`}></i>
              )}
              {archiveBtnText}
            </Button>
          </div>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(modalContent, document.body)}
      {showExportModal && (
        <ExportModal
          show={showExportModal}
          onHide={() => setShowExportModal(false)}
          job={job}
          rosterData={rosterData}
          groupsData={groupsData}
        />
      )}
      {showEditModal && (
        <EditJobModal
          show={showEditModal}
          onHide={() => setShowEditModal(false)}
          job={job}
        />
      )}
    </>
  );
};

export default ViewJobModal;
