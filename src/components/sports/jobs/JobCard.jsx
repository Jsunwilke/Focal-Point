// src/components/sports/jobs/JobCard.jsx
import React, { useState } from "react";
import {
  Eye,
  CheckCircle,
  RotateCcw,
  Trash2,
  Calendar,
  MapPin,
  Camera,
  Mail,
  GraduationCap,
  Backpack,
} from "lucide-react";
import { useJobs } from "../../../contexts/JobsContext";
import {
  countValidAthletes,
  countPhotographedAthletes,
} from "../../../utils/calculations";
import DeleteConfirmationModal from "../common/DeleteConfirmationModal";

const JobCard = ({ job, isArchived, onView }) => {
  const { deleteJob, toggleJobArchiveStatus } = useJobs();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
        });
      } else {
        return dateObj.toLocaleDateString();
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  };

  // Format date
  const formattedDate = formatJobDate(job.shootDate);

  // Calculate basic stats
  const rosterCount = countValidAthletes(job.roster);
  const totalRosterEntries = job.roster ? job.roster.length : 0;
  const blankCount = totalRosterEntries - rosterCount;
  const photographedCount = countPhotographedAthletes(job.roster);
  const groupImagesCount = job.groupImages ? job.groupImages.length : 0;

  // Calculate unique groups/sports count
  const uniqueGroupsCount =
    job.roster && Array.isArray(job.roster)
      ? new Set(
          job.roster
            .filter(
              (athlete) => athlete.lastName && athlete.lastName.trim() !== ""
            )
            .map((athlete) => athlete.group || "No Group")
            .filter((group) => group && group.trim() !== "")
        ).size
      : 0;

  // Calculate email statistics
  const calculateEmailStats = () => {
    if (!job.roster || !Array.isArray(job.roster)) {
      return { total: 0, percentage: 0 };
    }

    let emailCount = 0;
    const validAthletes = job.roster.filter(
      (athlete) => athlete.lastName && athlete.lastName.trim() !== ""
    );

    validAthletes.forEach((athlete) => {
      if (athlete.email && athlete.email.trim() !== "") {
        emailCount++;
      }
    });

    const percentage =
      validAthletes.length > 0
        ? Math.round((emailCount / validAthletes.length) * 100)
        : 0;

    return { total: emailCount, percentage };
  };

  // Calculate grade level statistics
  const calculateGradeStats = () => {
    if (!job.roster || !Array.isArray(job.roster)) {
      return { seniors: null, eighthGraders: null };
    }

    const gradeStats = {
      seniors: { total: 0, photographed: 0, percentage: 0 },
      eighthGraders: { total: 0, photographed: 0, percentage: 0 },
    };

    const validAthletes = job.roster.filter(
      (athlete) => athlete.lastName && athlete.lastName.trim() !== ""
    );

    validAthletes.forEach((athlete) => {
      const special = (athlete.teacher || "").toLowerCase().trim();
      const hasImages =
        athlete.imageNumbers && athlete.imageNumbers.trim() !== "";

      if (special === "s") {
        gradeStats.seniors.total++;
        if (hasImages) {
          gradeStats.seniors.photographed++;
        }
      }

      if (special === "8") {
        gradeStats.eighthGraders.total++;
        if (hasImages) {
          gradeStats.eighthGraders.photographed++;
        }
      }
    });

    // Calculate percentages and determine what to show
    let seniorsResult = null;
    let eighthGradersResult = null;

    if (gradeStats.seniors.total > 0) {
      gradeStats.seniors.percentage = Math.round(
        (gradeStats.seniors.photographed / gradeStats.seniors.total) * 100
      );
      seniorsResult = gradeStats.seniors;
    }

    if (gradeStats.eighthGraders.total > 0) {
      gradeStats.eighthGraders.percentage = Math.round(
        (gradeStats.eighthGraders.photographed /
          gradeStats.eighthGraders.total) *
          100
      );
      eighthGradersResult = gradeStats.eighthGraders;
    }

    return { seniors: seniorsResult, eighthGraders: eighthGradersResult };
  };

  const emailStats = calculateEmailStats();
  const gradeStats = calculateGradeStats();

  // Display season/type and optional sport
  const seasonTypeDisplay = job.seasonType || job.sportName || "";
  const sportDisplay =
    job.sportName && job.seasonType ? ` - ${job.sportName}` : "";

  const handleView = () => {
    onView(job.id);
  };

  const handleDelete = async () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteJob(job.id);
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Error deleting job:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  const getJobDisplayName = () => {
    const schoolName = job.schoolName || "Unknown School";
    const seasonType = job.seasonType || job.sportName || "Unknown Season";
    const date = job.shootDate?.toDate
      ? job.shootDate.toDate()
      : new Date(job.shootDate);
    const formattedDate = date.toLocaleDateString();

    return `${schoolName} - ${seasonType} (${formattedDate})`;
  };

  const handleToggleArchive = async () => {
    setIsToggling(true);
    try {
      await toggleJobArchiveStatus(job.id, !isArchived);
    } catch (error) {
      console.error("Error toggling archive status:", error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <>
      <div className={`compact-job-card ${isArchived ? "archived-job" : ""}`}>
        {/* Compact Header */}
        <div className="sports-card-header">
          <div className="school-info">
            <h4 className="school-name">{job.schoolName}</h4>
            <div className="date-text">
              <Calendar size={12} />
              {formattedDate}
            </div>
          </div>
          <span className="season-tag">
            {seasonTypeDisplay}
            {sportDisplay}
          </span>
        </div>

        {/* Location & Photographer Meta */}
        {(job.location || job.photographer) && (
          <div className="job-meta">
            {job.location && (
              <div className="meta-item">
                <MapPin size={12} />
                {job.location}
              </div>
            )}
            {job.photographer && (
              <div className="meta-item">
                <Camera size={12} />
                {job.photographer}
              </div>
            )}
          </div>
        )}

        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-num">{rosterCount}</span>
            <span className="stat-lbl">ATHLETES</span>
            {blankCount > 0 && (
              <span className="stat-warn">{blankCount} blank</span>
            )}
          </div>
          <div className="stat-item">
            <span className="stat-num">{photographedCount}</span>
            <span className="stat-lbl">SHOT</span>
            {rosterCount > 0 && (
              <span className="stat-pct">
                {Math.round((photographedCount / rosterCount) * 100)}%
              </span>
            )}
          </div>
          <div className="stat-item">
            <span className="stat-num">{uniqueGroupsCount}</span>
            <span className="stat-lbl">GROUPS</span>
          </div>
        </div>

        {/* Extra Stats */}
        <div className="extra-stats">
          <div className="extra-stat">
            <div className="stat-icon-sm">
              <Mail size={10} />
            </div>
            <span className="stat-text">
              {emailStats.total} ({emailStats.percentage}%)
            </span>
          </div>
          {gradeStats.eighthGraders && (
            <div className="extra-stat">
              <div className="stat-icon-sm">
                <GraduationCap size={10} />
              </div>
              <span className="stat-text">
                {gradeStats.eighthGraders.total} 8th (
                {gradeStats.eighthGraders.percentage}%)
              </span>
            </div>
          )}
        </div>

        {/* Compact Actions */}
        <div className="compact-actions">
          <button
            onClick={handleView}
            disabled={isDeleting || isToggling}
            style={{
              flex: 1,
              padding: "6px 10px",
              border: "1px solid #3a6ea5",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              minHeight: "28px",
              background: "white",
              color: "#3a6ea5",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#3a6ea5";
              e.target.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "white";
              e.target.style.color = "#3a6ea5";
            }}
          >
            <Eye size={14} />
            View
          </button>

          <button
            onClick={handleToggleArchive}
            disabled={isDeleting || isToggling}
            style={{
              flex: 1,
              padding: "6px 10px",
              border: isArchived ? "1px solid #007bff" : "1px solid #28a745",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              minHeight: "28px",
              background: "white",
              color: isArchived ? "#007bff" : "#28a745",
            }}
            onMouseEnter={(e) => {
              const color = isArchived ? "#007bff" : "#28a745";
              e.target.style.background = color;
              e.target.style.color = "white";
            }}
            onMouseLeave={(e) => {
              const color = isArchived ? "#007bff" : "#28a745";
              e.target.style.background = "white";
              e.target.style.color = color;
            }}
          >
            {isToggling ? (
              <div className="spinner-sm" />
            ) : isArchived ? (
              <RotateCcw size={14} />
            ) : (
              <CheckCircle size={14} />
            )}
            {isArchived ? "Activate" : "Complete"}
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting || isToggling}
            style={{
              flex: "0 0 auto",
              width: "32px",
              padding: "6px",
              border: "1px solid #dc3545",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "28px",
              background: "white",
              color: "#dc3545",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#dc3545";
              e.target.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "white";
              e.target.style.color = "#dc3545";
            }}
          >
            {isDeleting ? <div className="spinner-sm" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      <DeleteConfirmationModal
        show={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Sports Job"
        message="Are you sure you want to delete this sports job? This will permanently remove all job data including roster information and group images."
        confirmText="Delete Job"
        cancelText="Cancel"
        isLoading={isDeleting}
        jobName={getJobDisplayName()}
      />
    </>
  );
};

export default JobCard;
