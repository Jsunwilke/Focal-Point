import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { Upload, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import FileUploadPreview from "../roster/FileUploadPreview";
import { sportsJobsService } from "../../../services/sportsFirestoreService";
import { useToast } from "../../../contexts/ToastContext";

// Uncontrolled wrapper to prevent FileUploadPreview from re-rendering
const UncontrolledFileUpload = React.memo(({ onDataLoaded }) => {
  const hasLoadedRef = useRef(false);
  const mountedRef = useRef(true);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      hasLoadedRef.current = false;
    };
  }, []);
  
  const handleSetRosterData = useCallback((data) => {
    if (data.length > 0 && mountedRef.current) {
      onDataLoaded(data);
    }
  }, [onDataLoaded]);
  
  return (
    <FileUploadPreview
      rosterData={[]} // Always empty, making it uncontrolled
      setRosterData={handleSetRosterData}
    />
  );
});

const ImportRosterModal = ({ show, onHide, job }) => {
  const { showToast } = useToast();
  const [importedData, setImportedData] = useState([]);
  const [importMode, setImportMode] = useState("append");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  
  // Stable callback for file upload
  const handleDataLoaded = useCallback((data) => {
    setImportedData(data);
  }, []);

  // Reset form when modal closes
  useEffect(() => {
    if (!show) {
      setImportedData([]);
      setImportMode("append");
      setPreview(null);
    }
  }, [show]);

  const generatePreview = useCallback(() => {
    const currentRosterCount = job?.roster?.length || 0;
    const importCount = importedData.length;
    let duplicates = 0;
    let newAthletes = importCount;
    let finalCount = 0;

    if (importMode === "replace") {
      finalCount = importCount;
    } else if (importMode === "append") {
      finalCount = currentRosterCount + importCount;
    } else if (importMode === "merge") {
      // Check for duplicates based on athleteID or name match
      const existingIds = new Set(job?.roster?.map(a => a.athleteID) || []);
      const existingNames = new Set(
        job?.roster?.map(a => `${a.firstName}_${a.lastName}`.toLowerCase()) || []
      );

      duplicates = importedData.filter(athlete => {
        const nameKey = `${athlete.firstName}_${athlete.lastName}`.toLowerCase();
        return existingIds.has(athlete.athleteID) || existingNames.has(nameKey);
      }).length;

      newAthletes = importCount - duplicates;
      finalCount = currentRosterCount + newAthletes;
    }

    setPreview({
      currentCount: currentRosterCount,
      importCount,
      duplicates,
      newAthletes,
      finalCount,
    });
  }, [importedData, importMode, job]);

  useEffect(() => {
    if (importedData.length > 0 && job) {
      generatePreview();
    }
  }, [importedData, importMode, job, generatePreview]);

  const handleImport = async () => {
    if (!job || !job.id) {
      showToast("Error", "No job selected for import", "error");
      return;
    }
    
    if (importedData.length === 0) {
      showToast("Error", "No data to import. Please select a file first.", "error");
      return;
    }

    setLoading(true);
    try {
      let finalRoster = [];

      if (importMode === "replace") {
        finalRoster = importedData;
      } else if (importMode === "append") {
        finalRoster = [...(job.roster || []), ...importedData];
      } else if (importMode === "merge") {
        // Create a map of existing athletes for efficient lookup
        const existingMap = new Map();
        (job.roster || []).forEach(athlete => {
          const key = athlete.athleteID || `${athlete.firstName}_${athlete.lastName}`.toLowerCase();
          existingMap.set(key, athlete);
        });

        // Add existing athletes
        finalRoster = [...(job.roster || [])];

        // Add new athletes that don't exist
        importedData.forEach(athlete => {
          const idKey = athlete.athleteID;
          const nameKey = `${athlete.firstName}_${athlete.lastName}`.toLowerCase();
          
          if (!existingMap.has(idKey) && !existingMap.has(nameKey)) {
            finalRoster.push(athlete);
          }
        });
      }

      // Update the job roster in Firestore
      await sportsJobsService.updateJobRoster(job.id, finalRoster);

      showToast(
        "Success",
        `Successfully imported ${preview.newAthletes || importedData.length} athletes`,
        "success"
      );

      onHide(true); // Pass true to indicate refresh is needed
    } catch (error) {
      console.error("Error importing roster:", error);
      showToast(
        "Error",
        "Failed to import roster. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onHide(false);
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
          maxWidth: "700px",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px rgba(0, 0, 0, 0.15)",
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
          <h4 style={{ margin: 0, fontSize: "1.25rem" }}>
            Import Roster to {job?.schoolName || "Job"}
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
            ×
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
          {/* Import Mode Selection */}
          <div className="mb-3">
            <h6 className="mb-2" style={{ fontSize: "0.95rem" }}>Import Mode</h6>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                id="mode-append"
                name="importMode"
                value="append"
                checked={importMode === "append"}
                onChange={(e) => setImportMode(e.target.value)}
              />
              <label className="form-check-label" htmlFor="mode-append" style={{ fontSize: "0.9rem" }}>
                Add to existing roster
              </label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                id="mode-merge"
                name="importMode"
                value="merge"
                checked={importMode === "merge"}
                onChange={(e) => setImportMode(e.target.value)}
              />
              <label className="form-check-label" htmlFor="mode-merge" style={{ fontSize: "0.9rem" }}>
                Smart merge (skip duplicates)
              </label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                id="mode-replace"
                name="importMode"
                value="replace"
                checked={importMode === "replace"}
                onChange={(e) => setImportMode(e.target.value)}
              />
              <label className="form-check-label" htmlFor="mode-replace" style={{ fontSize: "0.9rem" }}>
                Replace entire roster
              </label>
            </div>
          </div>

          {/* File Upload */}
          <UncontrolledFileUpload onDataLoaded={handleDataLoaded} />

          {/* Import Preview */}
          {preview && importedData.length > 0 && (
            <div className="mt-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0" style={{ fontSize: "0.95rem" }}>
                  Import Preview:
                </h6>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                  onClick={() => generatePreview()}
                >
                  <RefreshCw size={12} />
                  Refresh
                </button>
              </div>

              <div
                style={{
                  padding: "1rem",
                  backgroundColor: importMode === "replace" ? "#f8d7da" : "#d1ecf1",
                  border: `1px solid ${importMode === "replace" ? "#f5c6cb" : "#bee5eb"}`,
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                }}
              >
                <div className="d-flex align-items-start">
                  {importMode === "replace" ? (
                    <AlertCircle size={20} className="me-2 flex-shrink-0 mt-1" style={{ color: "#721c24" }} />
                  ) : (
                    <CheckCircle size={20} className="me-2 flex-shrink-0 mt-1" style={{ color: "#0c5460" }} />
                  )}
                  <div>
                    <ul className="mb-0 ps-3">
                      <li>Current roster: {preview.currentCount} athletes</li>
                      <li>Importing: {preview.importCount} athletes</li>
                      {importMode === "merge" && preview.duplicates > 0 && (
                        <li className="text-muted">
                          Skipping {preview.duplicates} duplicate{preview.duplicates !== 1 ? "s" : ""}
                        </li>
                      )}
                      <li>
                        <strong>Final roster: {preview.finalCount} athletes</strong>
                      </li>
                    </ul>
                    {importMode === "replace" && (
                      <p className="mb-0 mt-2" style={{ color: "#721c24" }}>
                        <strong>Warning:</strong> This will delete all existing roster data!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <style>
            {`
              /* Hide the built-in preview from FileUploadPreview */
              .table-responsive {
                display: none !important;
              }
              
              /* Hide the preview but keep the file upload working */
              div[dangerouslySetInnerHTML] {
                display: none !important;
              }
            `}
          </style>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #dee2e6",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            className="btn btn-primary d-flex align-items-center gap-2"
            disabled={loading || importedData.length === 0}
          >
            {loading && (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
            )}
            <Upload size={16} />
            Import {preview?.newAthletes || importedData.length} Athletes
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default React.memo(ImportRosterModal);