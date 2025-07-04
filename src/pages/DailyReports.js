// src/pages/DailyReports.js
import React, { useState, useEffect, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Search,
  X,
  Calendar,
  User,
  Camera,
  FileText,
  Download,
  Eye,
  Edit3,
  Save,
  XCircle,
  ChevronDown,
  ArrowUpDown,
  Image as ImageIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  subscribeToDailyJobReports,
  updateDailyJobReport,
  getSchools,
  getTeamMembers,
} from "../firebase/firestore";
import Button from "../components/shared/Button";
import "./DailyReports.css";

const DailyReports = () => {
  const { userProfile, organization } = useAuth();
  const [reports, setReports] = useState([]);
  const [schools, setSchools] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState("database"); // 'card' or 'database'
  const [selectedReport, setSelectedReport] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImage, setCurrentImage] = useState("");
  const [editingReport, setEditingReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Job description options (from your original app)
  const JOB_DESCRIPTION_OPTIONS = [
    "Fall Original Day",
    "Fall Makeup Day",
    "Classroom Groups",
    "Fall Sports",
    "Winter Sports",
    "Spring Sports",
    "Spring Photos",
    "Homecoming",
    "Prom",
    "Graduation",
    "Yearbook Candid's",
    "Yearbook Groups and Clubs",
    "Sports League",
    "District Office Photos",
    "Banner Photos",
    "In Studio Photos",
    "School Board Photos",
    "Dr. Office Head Shots",
    "Dr. Office Cards",
    "Dr. Office Candid's",
    "Deliveries",
    "NONE",
  ];

  const EXTRA_ITEMS_OPTIONS = [
    "Underclass Makeup",
    "Staff Makeup",
    "ID card Images",
    "Sports Makeup",
    "Class Groups",
    "Yearbook Groups and Clubs",
    "Class Candids",
    "Students from other schools",
    "Siblings",
    "Office Staff Photos",
    "Deliveries",
    "NONE",
  ];

  const RADIO_OPTIONS_YES_NO_NA = ["Yes", "No", "N/A"];
  const RADIO_OPTIONS_YES_NO = ["Yes", "No"];

  // Sort options
  const sortOptions = [
    { value: "date", label: "Date" },
    { value: "yourName", label: "Photographer" },
    { value: "schoolOrDestination", label: "School/Destination" },
    { value: "timestamp", label: "Submitted" },
  ];

  // Table columns for database view
  const tableColumns = [
    { key: "date", label: "Date" },
    { key: "yourName", label: "Photographer" },
    { key: "schoolOrDestination", label: "School/Destination" },
    { key: "jobDescriptions", label: "Job Descriptions" },
    { key: "extraItems", label: "Extra Items" },
    { key: "jobBoxAndCameraCards", label: "Job Box/Cards" },
    { key: "sportsBackgroundShot", label: "Sports BG Shot" },
    { key: "cardsScannedChoice", label: "Cards Scanned" },
    { key: "photoURLs", label: "Photo" },
    { key: "photoshootNoteText", label: "Photoshoot Notes" },
    { key: "jobDescriptionText", label: "Extra Notes" },
  ];

  // Load data effect
  useEffect(() => {
    if (!organization?.id) return;

    let unsubscribe;
    
    const loadInitialData = async () => {
      try {
        setLoading(true);

        // Load schools and photographers
        const [schoolsData, photographersData] = await Promise.all([
          getSchools(organization.id),
          getTeamMembers(organization.id),
        ]);

        setSchools(schoolsData.map((s) => s.value || s.name));
        setPhotographers(
          photographersData.map((p) => p.firstName).filter(Boolean)
        );

        // Subscribe to real-time reports updates
        unsubscribe = subscribeToDailyJobReports(
          organization.id,
          (reportsData) => {
            setReports(reportsData);
            setLoading(false);
          },
          (err) => {
            setError("Failed to load daily reports");
            console.error("Error loading reports:", err);
            setLoading(false);
          }
        );
      } catch (err) {
        setError("Failed to load data");
        console.error("Error loading data:", err);
        setLoading(false);
      }
    };

    loadInitialData();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [organization]);

  // Filtered and sorted reports
  const filteredAndSortedReports = useMemo(() => {
    let filtered = reports;

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = reports.filter((report) => {
        const searchableFields = [
          report.yourName,
          report.schoolOrDestination,
          Array.isArray(report.jobDescriptions)
            ? report.jobDescriptions.join(" ")
            : "",
          Array.isArray(report.extraItems) ? report.extraItems.join(" ") : "",
          report.photoshootNoteText,
          report.jobDescriptionText,
          report.jobBoxAndCameraCards,
          report.sportsBackgroundShot,
          report.cardsScannedChoice,
        ];

        return searchableFields.some(
          (field) => field && String(field).toLowerCase().includes(term)
        );
      });
    }

    // Sort the filtered results
    const sorted = [...filtered].sort((a, b) => {
      let aValue = a[sortField] || "";
      let bValue = b[sortField] || "";

      // Handle date fields
      if (sortField === "date" || sortField === "timestamp") {
        aValue = a[sortField]?.seconds || a[sortField]?.toDate?.() || 0;
        bValue = b[sortField]?.seconds || b[sortField]?.toDate?.() || 0;
      } else {
        // Convert to string for comparison
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return sorted;
  }, [reports, searchTerm, sortField, sortDirection]);

  // Setup column resizing after table renders - simplified
  useEffect(() => {
    const timer = setTimeout(() => {
      const table = document.querySelector(".report-table");
      if (!table) return;

      // Fix column widths
      const cols = table.querySelectorAll("col");
      const ths = table.querySelectorAll("th");
      ths.forEach((th, index) => {
        const computedWidth = window.getComputedStyle(th).width;
        if (cols[index]) {
          cols[index].style.width = computedWidth;
        }
      });

      // Enable column resize
      const minWidth = 50;
      ths.forEach((th, index) => {
        const resizer = th.querySelector(".resizer");
        if (!resizer) return;

        // Remove existing event listeners to prevent duplicates
        resizer.removeEventListener("mousedown", resizer._resizeHandler);

        const resizeHandler = (e) => {
          e.preventDefault();
          let startX = e.clientX;
          const colCurrent = cols[index];
          const colNext = cols[index + 1];
          if (!colNext) return;

          const startWidthCurrent = colCurrent.offsetWidth;
          const startWidthNext = colNext.offsetWidth;

          const resizeColumn = (e) => {
            const delta = e.clientX - startX;
            let newWidthCurrent = startWidthCurrent + delta;
            let newWidthNext = startWidthNext - delta;

            if (newWidthCurrent < minWidth) {
              newWidthCurrent = minWidth;
              newWidthNext = startWidthCurrent + startWidthNext - minWidth;
            } else if (newWidthNext < minWidth) {
              newWidthNext = minWidth;
              newWidthCurrent = startWidthCurrent + startWidthNext - minWidth;
            }

            colCurrent.style.width = newWidthCurrent + "px";
            colNext.style.width = newWidthNext + "px";
          };

          const stopResize = () => {
            window.removeEventListener("mousemove", resizeColumn);
            window.removeEventListener("mouseup", stopResize);
          };

          window.addEventListener("mousemove", resizeColumn);
          window.addEventListener("mouseup", stopResize);
        };

        // Store the handler reference for cleanup
        resizer._resizeHandler = resizeHandler;
        resizer.addEventListener("mousedown", resizeHandler);
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [reports]); // Only depend on reports, not the filtered/sorted data

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);

  const handleSort = useCallback(
    (field) => {
      if (sortField === field) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
      setShowSortMenu(false);
    },
    [sortField, sortDirection]
  );

  const getCurrentSortLabel = useCallback(() => {
    const option = sortOptions.find((opt) => opt.value === sortField);
    const direction = sortDirection === "asc" ? "A-Z" : "Z-A";
    return `${option?.label || "Date"} (${direction})`;
  }, [sortField, sortDirection]);

  const formatDate = useCallback((dateField) => {
    if (!dateField) return "N/A";
    if (typeof dateField.toDate === "function") {
      return dateField.toDate().toLocaleDateString();
    }
    const parsed = new Date(dateField);
    return isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleDateString();
  }, []);

  const openImageModal = useCallback((imageSrc) => {
    setCurrentImage(imageSrc);
    setShowImageModal(true);
  }, []);

  const openReportModal = useCallback((report) => {
    setSelectedReport(report);
  }, []);

  const closeReportModal = useCallback(() => {
    setSelectedReport(null);
    setEditingReport(null);
  }, []);

  const startEditing = useCallback((report) => {
    setEditingReport({ ...report });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingReport || !editingReport.id) return;
    
    try {
      const { id, ...reportData } = editingReport;
      await updateDailyJobReport(id, reportData);
      setEditingReport(null);
      setSelectedReport(null);
    } catch (error) {
      console.error("Error saving report:", error);
      alert("Failed to save changes. Please try again.");
    }
  }, [editingReport]);

  const cancelEdit = useCallback(() => {
    setEditingReport(null);
  }, []);

  // Render card view
  const renderCardView = () => {
    return (
      <div className="reports-cards">
        {filteredAndSortedReports.map((report) => (
          <div
            key={report.id}
            className="report-card"
            onClick={() => openReportModal(report)}
          >
            <div className="report-header">
              <h2 className="report-title">{report.yourName || "Unknown"}</h2>
              <div className="header-footer">
                <p className="school-name">{report.schoolOrDestination || "Unknown"}</p>
                <p className="report-date">{formatDate(report.date)}</p>
              </div>
            </div>
            <div className="report-content">
              <p><strong>Job Descriptions:</strong> {(report.jobDescriptions || []).join(", ")}</p>
              <p><strong>Extra Items:</strong> {(report.extraItems || []).join(", ")}</p>
              <p><strong>Job Box/Cards:</strong> {report.jobBoxAndCameraCards || "N/A"}</p>
              <p><strong>Sports BG Shot:</strong> {report.sportsBackgroundShot || "N/A"}</p>
              <p><strong>Cards Scanned:</strong> {report.cardsScannedChoice || "N/A"}</p>
              {(report.photoshootNoteText || report.jobDescriptionText) && (
                <div className="notes-box">
                  {report.photoshootNoteText && (
                    <p><strong>Photoshoot Notes:</strong> {report.photoshootNoteText}</p>
                  )}
                  {report.jobDescriptionText && (
                    <p><strong>Extra Notes:</strong> {report.jobDescriptionText}</p>
                  )}
                </div>
              )}
              {report.photoURLs && report.photoURLs.length > 0 && (
                <div className="card-photos">
                  {report.photoURLs.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt="Daily Job Photo"
                      className="card-photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        openImageModal(url);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="reports-loading">
        <p>Loading daily reports...</p>
      </div>
    );
  }

  return (
    <div className="daily-reports">
      <div className="reports-header">
        <div className="reports-header__content">
          <h1 className="reports-title">Daily Reports</h1>
          <p className="reports-subtitle">
            View and manage daily job reports from your photography team
          </p>
        </div>
      </div>

      {error && <div className="reports-error">{error}</div>}

      <div className="reports-content">
        {/* Stats Section */}
        <div className="reports-stats">
          <div className="reports-stat">
            <h3 className="reports-stat__number">{reports.length}</h3>
            <p className="reports-stat__label">Total Reports</p>
          </div>
          <div className="reports-stat">
            <h3 className="reports-stat__number">
              {
                reports.filter((r) => r.photoURLs && r.photoURLs.length > 0)
                  .length
              }
            </h3>
            <p className="reports-stat__label">With Photos</p>
          </div>
          <div className="reports-stat">
            <h3 className="reports-stat__number">
              {new Set(reports.map((r) => r.yourName)).size}
            </h3>
            <p className="reports-stat__label">Photographers</p>
          </div>
          {searchTerm && (
            <div className="reports-stat reports-stat--search">
              <h3 className="reports-stat__number">
                {filteredAndSortedReports.length}
              </h3>
              <p className="reports-stat__label">Search Results</p>
            </div>
          )}
        </div>

        {/* Controls Section */}
        <div className="reports-controls">
          {/* Search Bar */}
          <div className="reports-search">
            <div className="reports-search__input-wrapper">
              <Search size={16} className="reports-search__icon" />
              <input
                type="text"
                placeholder="Search reports by photographer, school, notes..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="reports-search__input"
              />
              {searchTerm && (
                <button onClick={clearSearch} className="reports-search__clear">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* View Toggle */}
          <div className="toggle-switch">
            <label>
              <input
                type="checkbox"
                checked={viewMode === "database"}
                onChange={(e) => setViewMode(e.target.checked ? "database" : "card")}
              />
              Database View
            </label>
          </div>

          {/* Sort Menu */}
          <div className="reports-sort">
            <button
              className="reports-sort__button"
              onClick={() => setShowSortMenu(!showSortMenu)}
            >
              <ArrowUpDown size={16} />
              <span>Sort: {getCurrentSortLabel()}</span>
              <ChevronDown size={16} />
            </button>

            {showSortMenu && (
              <div className="reports-sort__menu">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`reports-sort__option ${
                      sortField === option.value
                        ? "reports-sort__option--active"
                        : ""
                    }`}
                    onClick={() => handleSort(option.value)}
                  >
                    <span>{option.label}</span>
                    {sortField === option.value && (
                      <span className="reports-sort__direction">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reports Table/Cards */}
        <div className="reports-list">
          {filteredAndSortedReports.length === 0 ? (
            <div className="reports-empty">
              <FileText size={48} className="reports-empty__icon" />
              {searchTerm ? (
                <>
                  <h3 className="reports-empty__title">No reports found</h3>
                  <p className="reports-empty__description">
                    No reports match your search for "{searchTerm}"
                  </p>
                  <Button variant="secondary" onClick={clearSearch}>
                    Clear Search
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="reports-empty__title">No daily reports yet</h3>
                  <p className="reports-empty__description">
                    Daily job reports submitted by your team will appear here
                  </p>
                </>
              )}
            </div>
          ) : viewMode === "card" ? (
            renderCardView()
          ) : (
            <div className="reports-table-container">
              <table className="report-table">
                <colgroup>
                  {tableColumns.map((column, index) => (
                    <col key={index} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {tableColumns.map((column) => (
                      <th key={column.key} data-col={column.key}>
                        <span
                          className="sort-trigger"
                          onClick={() => handleSort(column.key)}
                        >
                          {column.label}
                        </span>
                        <span
                          className="sort-icon"
                          onClick={() => handleSort(column.key)}
                        >
                          {sortField === column.key
                            ? sortDirection === "asc"
                              ? " ▲"
                              : " ▼"
                            : ""}
                        </span>
                        <div className="resizer"></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedReports.map((report) => (
                    <tr key={report.id} onClick={() => openReportModal(report)}>
                      {tableColumns.map((column) => (
                        <td key={column.key}>
                          {column.key === "date" ? (
                            formatDate(report[column.key])
                          ) : column.key === "photoURLs" ? (
                            report.photoURLs && report.photoURLs.length > 0 ? (
                              <img
                                src={report.photoURLs[0]}
                                alt="Thumbnail"
                                className="thumbnail"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openImageModal(report.photoURLs[0]);
                                }}
                              />
                            ) : null
                          ) : Array.isArray(report[column.key]) ? (
                            report[column.key].join(", ")
                          ) : (
                            report[column.key] || ""
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sort Menu Overlay */}
      {showSortMenu && (
        <div
          className="reports-sort__overlay"
          onClick={() => setShowSortMenu(false)}
        />
      )}

      {/* Image Modal */}
      {showImageModal && ReactDOM.createPortal(
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10002,
            padding: "20px",
          }}
          onClick={() => setShowImageModal(false)}
        >
          <div className="image-modal__content">
            <button
              className="image-modal__close"
              onClick={() => setShowImageModal(false)}
            >
              <X size={24} />
            </button>
            <img
              src={currentImage}
              alt="Full size"
              className="image-modal__img"
            />
            <div className="image-modal__actions">
              <a href={currentImage} download className="image-modal__download">
                <Download size={16} />
                Download Image
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          editingReport={editingReport}
          onClose={closeReportModal}
          onStartEdit={startEditing}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
          onImageClick={openImageModal}
          jobDescriptionOptions={JOB_DESCRIPTION_OPTIONS}
          extraItemsOptions={EXTRA_ITEMS_OPTIONS}
          radioOptionsYesNoNA={RADIO_OPTIONS_YES_NO_NA}
          radioOptionsYesNo={RADIO_OPTIONS_YES_NO}
          schools={schools}
          photographers={photographers}
        />
      )}
    </div>
  );
};

// Report Detail Modal Component
const ReportDetailModal = ({
  report,
  editingReport,
  onClose,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onImageClick,
  jobDescriptionOptions,
  extraItemsOptions,
  radioOptionsYesNoNA,
  radioOptionsYesNo,
  schools,
  photographers,
}) => {
  const formatDate = (dateField) => {
    if (!dateField) return "N/A";
    if (typeof dateField.toDate === "function") {
      return dateField.toDate().toLocaleDateString();
    }
    const parsed = new Date(dateField);
    return isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleDateString();
  };

  const handleEditChange = (field, value) => {
    onStartEdit({ ...editingReport, [field]: value });
  };

  const handleCheckboxChange = (field, option, checked) => {
    const currentValues = editingReport[field] || [];
    const newValues = checked
      ? [...currentValues, option]
      : currentValues.filter((v) => v !== option);
    handleEditChange(field, newValues);
  };

  if (editingReport) {
    return ReactDOM.createPortal(
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
          className="modal modal--large"
          style={{
            position: "relative",
            margin: "0",
            transform: "none",
          }}
        >
          <div className="modal__header">
            <h2 className="modal__title">Edit Report</h2>
            <button className="modal__close" onClick={onClose} type="button">
              <X size={20} />
            </button>
          </div>
          <div className="modal__form" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="edit-form-section form-box">
              <label className="form-label">Date:</label>
              <div className="form-value">{formatDate(editingReport.date)}</div>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Photographer:</label>
              <select
                className="form-select"
                value={editingReport.yourName || ""}
                onChange={(e) => handleEditChange("yourName", e.target.value)}
              >
                <option value="">--Select--</option>
                {photographers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">School or Destination:</label>
              <select
                className="form-select"
                value={editingReport.schoolOrDestination || ""}
                onChange={(e) => handleEditChange("schoolOrDestination", e.target.value)}
              >
                <option value="">--Select--</option>
                {schools.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Job Descriptions (select all that apply):</label>
              <div className="checkbox-group">
                {jobDescriptionOptions.map((option) => (
                  <label key={option}>
                    <input
                      type="checkbox"
                      checked={(editingReport.jobDescriptions || []).includes(option)}
                      onChange={(e) =>
                        handleCheckboxChange("jobDescriptions", option, e.target.checked)
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Extra Items Added (select all that apply):</label>
              <div className="checkbox-group">
                {extraItemsOptions.map((option) => (
                  <label key={option}>
                    <input
                      type="checkbox"
                      checked={(editingReport.extraItems || []).includes(option)}
                      onChange={(e) =>
                        handleCheckboxChange("extraItems", option, e.target.checked)
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Job Box and Camera Cards Turned In:</label>
              <div className="radio-group">
                {radioOptionsYesNoNA.map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name="jobBoxAndCameraCards"
                      value={option}
                      checked={editingReport.jobBoxAndCameraCards === option}
                      onChange={(e) =>
                        handleEditChange("jobBoxAndCameraCards", e.target.value)
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Sports BG Shot:</label>
              <div className="radio-group">
                {radioOptionsYesNoNA.map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name="sportsBackgroundShot"
                      value={option}
                      checked={editingReport.sportsBackgroundShot === option}
                      onChange={(e) =>
                        handleEditChange("sportsBackgroundShot", e.target.value)
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Cards Scanned:</label>
              <div className="radio-group">
                {radioOptionsYesNo.map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name="cardsScannedChoice"
                      value={option}
                      checked={editingReport.cardsScannedChoice === option}
                      onChange={(e) =>
                        handleEditChange("cardsScannedChoice", e.target.value)
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Photoshoot Notes:</label>
              <textarea
                className="form-textarea"
                value={editingReport.photoshootNoteText || ""}
                onChange={(e) => handleEditChange("photoshootNoteText", e.target.value)}
              />
            </div>

            <div className="edit-form-section form-box">
              <label className="form-label">Extra Notes:</label>
              <textarea
                className="form-textarea"
                value={editingReport.jobDescriptionText || ""}
                onChange={(e) => handleEditChange("jobDescriptionText", e.target.value)}
              />
            </div>

            <div className="modal__actions">
              <Button variant="secondary" onClick={onCancelEdit}>
                Cancel
              </Button>
              <Button variant="primary" onClick={onSaveEdit}>
                <Save size={16} />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return ReactDOM.createPortal(
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
        className="modal modal--large"
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
        }}
      >
        <div className="modal__header">
          <h2 className="modal__title">
            {report.yourName || "Unknown Photographer"}
          </h2>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="modal__form">
          <div className="report-detail__header">
            <div className="report-detail__info">
              <h3>{report.schoolOrDestination || "Unknown Location"}</h3>
              <p className="report-detail__date">{formatDate(report.date)}</p>
            </div>
            <Button variant="outline" onClick={() => onStartEdit(report)}>
              <Edit3 size={16} />
              Edit
            </Button>
          </div>

          <div className="form-section">
            <label className="form-label">Job Descriptions:</label>
            <div className="form-value">
              {Array.isArray(report.jobDescriptions)
                ? report.jobDescriptions.join(", ")
                : "None"}
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Extra Items:</label>
            <div className="form-value">
              {Array.isArray(report.extraItems)
                ? report.extraItems.join(", ")
                : "None"}
            </div>
          </div>

          <div className="form-row">
            <div className="form-section">
              <label className="form-label">Job Box/Cards:</label>
              <div className="form-value">
                {report.jobBoxAndCameraCards || "N/A"}
              </div>
            </div>
            <div className="form-section">
              <label className="form-label">Sports BG Shot:</label>
              <div className="form-value">
                {report.sportsBackgroundShot || "N/A"}
              </div>
            </div>
            <div className="form-section">
              <label className="form-label">Cards Scanned:</label>
              <div className="form-value">
                {report.cardsScannedChoice || "N/A"}
              </div>
            </div>
          </div>

          {report.photoshootNoteText && (
            <div className="form-section">
              <label className="form-label">Photoshoot Notes:</label>
              <div className="form-value form-value--notes">
                {report.photoshootNoteText}
              </div>
            </div>
          )}

          {report.jobDescriptionText && (
            <div className="form-section">
              <label className="form-label">Extra Notes:</label>
              <div className="form-value form-value--notes">
                {report.jobDescriptionText}
              </div>
            </div>
          )}

          {report.photoURLs && report.photoURLs.length > 0 && (
            <div className="form-section">
              <label className="form-label">Photos:</label>
              <div className="report-photos">
                {report.photoURLs.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Report photo ${index + 1}`}
                    className="report-photo"
                    onClick={() => onImageClick(url)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DailyReports;
