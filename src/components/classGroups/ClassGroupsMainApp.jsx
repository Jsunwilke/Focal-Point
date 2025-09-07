// src/components/classGroups/ClassGroupsMainApp.jsx
import React, { useState, useMemo } from "react";
import { Plus, Search, ChevronUp, ChevronDown } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useClassGroups } from "../../contexts/ClassGroupsContext";
import ClassGroupJobCard from "./ClassGroupJobCard";
import ClassGroupFolderCard from "./ClassGroupFolderCard";
import ClassGroupFolderNavigation from "./ClassGroupFolderNavigation";
import ClassGroupModal from "./ClassGroupModal";
import ClassGroupSpreadsheetModal from "./ClassGroupSpreadsheetModal";
import LoadingSpinner from "../shared/LoadingSpinner";
import { getSchoolYear } from "../../utils/dateHelpers";

const ClassGroupsMainApp = () => {
  const { userProfile, organization } = useAuth();
  const { 
    loading, 
    searchQuery, 
    setSearchQuery,
    filterSchool,
    setFilterSchool,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    deleteClassGroupJob,
    getFilteredAndSortedJobs
  } = useClassGroups();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showSpreadsheetModal, setShowSpreadsheetModal] = useState(false);
  
  // Folder navigation state
  const [currentFolderView, setCurrentFolderView] = useState({
    level: "root",
    school: null,
    year: null,
  });

  // Organize jobs into folder structure - must be before any conditional returns
  const folderStructure = useMemo(() => {
    const structure = {};
    const jobs = getFilteredAndSortedJobs();

    jobs.forEach((job) => {
      const schoolName = job.schoolName || "Unknown School";
      const year = getSchoolYear(job.sessionDate);

      if (!structure[schoolName]) {
        structure[schoolName] = {};
      }

      if (!structure[schoolName][year]) {
        structure[schoolName][year] = [];
      }

      structure[schoolName][year].push(job);
    });

    return structure;
  }, [getFilteredAndSortedJobs]);

  // Reset folder view when search changes - must be before any conditional returns
  React.useEffect(() => {
    if (searchQuery.trim()) {
      // When searching, reset to root but keep the search results visible
      setCurrentFolderView({
        level: "root",
        school: null,
        year: null,
      });
    }
  }, [searchQuery]);

  // Show loading spinner while data is loading
  if (loading) {
    return (
      <div className="empty-state">
        <LoadingSpinner text="Loading Class Groups..." />
      </div>
    );
  }

  const handleCreateNew = () => {
    setSelectedJob(null);
    setShowCreateModal(true);
  };

  const handleEditJob = (job) => {
    setSelectedJob(job);
    setShowCreateModal(true);
  };

  const handleViewSpreadsheet = (job) => {
    setSelectedJob(job);
    setShowSpreadsheetModal(true);
  };

  const handleDeleteJob = async (jobId) => {
    await deleteClassGroupJob(jobId);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setShowSpreadsheetModal(false);
    setSelectedJob(null);
  };

  const toggleSortDirection = () => {
    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
  };

  // Get current view data based on folder level
  const getCurrentViewData = () => {
    // If searching, show flat results
    if (searchQuery.trim()) {
      return getFilteredAndSortedJobs();
    }

    if (currentFolderView.level === "root") {
      // Show schools
      return Object.keys(folderStructure)
        .sort((a, b) => a.localeCompare(b))
        .map((schoolName) => {
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
      return Object.keys(schoolData)
        .sort((a, b) => b.localeCompare(a)) // Most recent year first
        .map((year) => ({
          name: year,
          count: schoolData[year].length,
          type: "year",
        }));
    } else if (currentFolderView.level === "year") {
      // Show jobs for selected school and year
      return (
        folderStructure[currentFolderView.school]?.[currentFolderView.year] || []
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

  return (
    <div className="class-groups-container">
      {/* Header */}
      <div className="class-groups-header">
        <div>
          <h1>Class Groups</h1>
          <p>
            Managing class groups for{" "}
            <span style={{ fontWeight: 600 }}>{organization?.name}</span>
          </p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={handleCreateNew}>
            <Plus size={16} />
            Create New Class Group
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="class-groups-controls">
        <div className="controls-left">
          {/* Search */}
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search grades, teachers, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="clear-search"
                onClick={() => setSearchQuery("")}
              >
                ×
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="sort-controls">
            <div className="sort-select-wrapper">
              <select 
                value={sortField} 
                onChange={(e) => setSortField(e.target.value)}
                className="form-select with-sort-arrows"
              >
                <option value="sessionDate">Session Date</option>
                <option value="schoolName">School Name</option>
                <option value="createdAt">Date Created</option>
                <option value="updatedAt">Last Modified</option>
              </select>
              <div className="sort-arrows">
                <button 
                  className={`sort-arrow ${sortDirection === 'asc' ? 'active' : ''}`}
                  onClick={() => setSortDirection('asc')}
                  title="Sort Ascending"
                >
                  <ChevronUp size={12} />
                </button>
                <button 
                  className={`sort-arrow ${sortDirection === 'desc' ? 'active' : ''}`}
                  onClick={() => setSortDirection('desc')}
                  title="Sort Descending"
                >
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Breadcrumb Navigation */}
      {currentFolderView.level !== "root" && !searchQuery.trim() && (
        <ClassGroupFolderNavigation
          currentFolderView={currentFolderView}
          onBreadcrumbClick={handleBreadcrumbClick}
        />
      )}

      {/* Main Content */}
      <div className="class-groups-content">
        {(() => {
          const currentData = getCurrentViewData();
          
          // Empty state
          if (currentData.length === 0) {
            const message = searchQuery.trim()
              ? `No jobs found matching "${searchQuery}"`
              : "No class group jobs found. Create your first job to get started.";
              
            return (
              <div className="empty-state">
                <div className="empty-icon">📚</div>
                <h3>No Class Groups Found</h3>
                <p>{message}</p>
              </div>
            );
          }

          // Search results - show flat job cards
          if (searchQuery.trim()) {
            return (
              <div className="class-groups-grid">
                {currentData.map((job) => (
                  <ClassGroupJobCard
                    key={job.id}
                    job={job}
                    onClick={handleViewSpreadsheet}
                    onEdit={handleEditJob}
                    onDelete={handleDeleteJob}
                  />
                ))}
              </div>
            );
          }

          // Folder view
          if (currentFolderView.level === "root" || currentFolderView.level === "school") {
            return (
              <div className="class-groups-folder-grid">
                {currentData.map((item, index) => (
                  <ClassGroupFolderCard
                    key={`${item.type}-${item.name}-${index}`}
                    name={item.name}
                    count={item.count}
                    type={item.type}
                    onClick={() => handleFolderClick(item)}
                  />
                ))}
              </div>
            );
          }

          // Job cards at year level
          if (currentFolderView.level === "year") {
            return (
              <div className="class-groups-grid">
                {currentData.map((job) => (
                  <ClassGroupJobCard
                    key={job.id}
                    job={job}
                    onClick={handleViewSpreadsheet}
                    onEdit={handleEditJob}
                    onDelete={handleDeleteJob}
                  />
                ))}
              </div>
            );
          }
        })()}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <ClassGroupModal
          job={selectedJob}
          onClose={handleCloseModal}
        />
      )}

      {/* Spreadsheet Modal */}
      {showSpreadsheetModal && selectedJob && (
        <ClassGroupSpreadsheetModal
          job={selectedJob}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default ClassGroupsMainApp;