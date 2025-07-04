// src/components/sports/jobs/JobList.jsx
import React, { useMemo, useState } from "react";
import { useJobs } from "../../../contexts/JobsContext";
import { getSchoolYear, getLeagueYear } from "../../../utils/dateHelpers";
import JobCard from "./JobCard";
import FolderCard from "../folders/FolderCard";
import FolderNavigation from "../folders/FolderNavigation";
import LoadingSpinner from "../common/LoadingSpinner";

const JobList = ({ isArchived, searchState, onViewJob, viewMode = "flat" }) => {
  const { allJobs, loading, getJobsByStatus } = useJobs();

  // Folder navigation state (only used when viewMode is "folders")
  const [currentFolderView, setCurrentFolderView] = useState({
    level: "root",
    school: null,
    year: null,
  });

  // Filter jobs based on tab and search
  const filteredJobs = useMemo(() => {
    let jobs = getJobsByStatus(isArchived);

    // Apply search filter if active
    if (
      searchState.isActive &&
      searchState.type === "jobs" &&
      searchState.query
    ) {
      const searchTerm = searchState.query.toLowerCase();
      jobs = jobs.filter(
        (job) =>
          (job.schoolName || "").toLowerCase().includes(searchTerm) ||
          (job.seasonType || "").toLowerCase().includes(searchTerm) ||
          (job.sportName || "").toLowerCase().includes(searchTerm) ||
          (job.location || "").toLowerCase().includes(searchTerm) ||
          (job.photographer || "").toLowerCase().includes(searchTerm) ||
          (job.additionalNotes || "").toLowerCase().includes(searchTerm)
      );
    }

    return jobs;
  }, [allJobs, isArchived, searchState, getJobsByStatus]);

  // Organize jobs into folder structure (only used when viewMode is "folders")
  const folderStructure = useMemo(() => {
    if (viewMode !== "folders") return {};

    const structure = {};

    filteredJobs.forEach((job) => {
      const schoolName = job.schoolName || "Unknown School";
      const year =
        job.seasonType === "League"
          ? getLeagueYear(job.shootDate)
          : getSchoolYear(job.shootDate);

      if (!structure[schoolName]) {
        structure[schoolName] = {};
      }

      if (!structure[schoolName][year]) {
        structure[schoolName][year] = [];
      }

      structure[schoolName][year].push(job);
    });

    return structure;
  }, [filteredJobs, viewMode]);

  // Generate folder data based on current view level (only for folder view)
  const getCurrentViewData = () => {
    if (viewMode !== "folders") return filteredJobs;

    if (currentFolderView.level === "root") {
      // Show schools
      return Object.keys(folderStructure).map((schoolName) => {
        const totalJobs = Object.values(folderStructure[schoolName]).reduce(
          (acc, jobs) => acc + jobs.length,
          0
        );
        return {
          name: schoolName,
          count: totalJobs,
          type: "school",
        };
      });
    } else if (currentFolderView.level === "school") {
      // Show years for selected school
      const schoolData = folderStructure[currentFolderView.school] || {};
      return Object.keys(schoolData).map((year) => ({
        name: year,
        count: schoolData[year].length,
        type: "year",
      }));
    } else if (currentFolderView.level === "year") {
      // Show jobs for selected school and year
      return (
        folderStructure[currentFolderView.school]?.[currentFolderView.year] ||
        []
      );
    }

    return [];
  };

  const handleFolderClick = (item) => {
    if (item.type === "school") {
      setCurrentFolderView({
        level: "school",
        school: item.name,
        year: null,
      });
    } else if (item.type === "year") {
      setCurrentFolderView({
        level: "year",
        school: currentFolderView.school,
        year: item.name,
      });
    }
  };

  const handleBreadcrumbClick = (level, school = null) => {
    if (level === "root") {
      setCurrentFolderView({
        level: "root",
        school: null,
        year: null,
      });
    } else if (level === "school") {
      setCurrentFolderView({
        level: "school",
        school: school,
        year: null,
      });
    }
  };

  // Reset folder view when switching between archived/active or when search changes
  React.useEffect(() => {
    if (viewMode === "folders") {
      setCurrentFolderView({
        level: "root",
        school: null,
        year: null,
      });
    }
  }, [isArchived, searchState.isActive, viewMode]);

  if (loading) {
    return (
      <div className="empty-state">
        <LoadingSpinner
          text={`Loading ${isArchived ? "completed" : "active"} jobs...`}
        />
      </div>
    );
  }

  const currentData = getCurrentViewData();

  if (filteredJobs.length === 0) {
    const message = searchState.isActive
      ? `No jobs found matching "${searchState.query}"`
      : isArchived
      ? "No completed jobs found. Jobs marked as complete will appear here."
      : "No active sports jobs found. Create your first job to get started.";

    return (
      <div className="empty-state">
        <div className="empty-state-icon">📷</div>
        <h3>No Jobs Found</h3>
        <p>{message}</p>
      </div>
    );
  }

  // Render folder view
  if (viewMode === "folders") {
    return (
      <div>
        {/* Breadcrumb Navigation */}
        {currentFolderView.level !== "root" && (
          <FolderNavigation
            currentFolderView={currentFolderView}
            onBreadcrumbClick={handleBreadcrumbClick}
          />
        )}

        {/* Folder/Job Grid */}
        {currentFolderView.level === "year" ? (
          // Show individual job cards
          <div className="job-grid">
            {currentData.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isArchived={isArchived}
                onView={onViewJob}
              />
            ))}
          </div>
        ) : (
          // Show folder cards
          <div className="row">
            {currentData.map((item) => (
              <FolderCard
                key={item.name}
                name={item.name}
                count={item.count}
                onClick={() => handleFolderClick(item)}
              />
            ))}
          </div>
        )}

        {/* Show folder summary */}
        {currentFolderView.level !== "year" && currentData.length > 0 && (
          <div className="mt-4 text-center">
            <p className="text-muted">
              {currentFolderView.level === "root"
                ? `${currentData.length} schools with ${
                    isArchived ? "completed" : "active"
                  } jobs`
                : `${currentData.length} school years with ${
                    isArchived ? "completed" : "active"
                  } jobs`}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Render flat view (default)
  return (
    <div className="job-grid">
      {currentData.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          isArchived={isArchived}
          onView={onViewJob}
        />
      ))}
    </div>
  );
};

export default JobList;
