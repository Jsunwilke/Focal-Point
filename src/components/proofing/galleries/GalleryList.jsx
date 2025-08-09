// src/components/proofing/galleries/GalleryList.jsx
import React, { useMemo, useState } from "react";
import ModernGalleryCard from "./ModernGalleryCard";
import FolderCard from "../folders/FolderCard";
import FolderNavigation from "../folders/FolderNavigation";

const GalleryList = ({ galleries, isArchived, viewMode = "flat", searchState, onViewGallery, onEditGallery }) => {
  // Folder navigation state (only used when viewMode is "folders")
  const [currentFolderView, setCurrentFolderView] = useState({
    level: "root",
    school: null,
    year: null,
  });

  // Filter galleries based on archive status and search
  const filteredGalleries = useMemo(() => {
    let filtered = galleries.filter(g => g.isArchived === isArchived);

    // Apply search filter if active
    if (searchState.isActive && searchState.query) {
      const searchTerm = searchState.query.toLowerCase();
      filtered = filtered.filter(
        (gallery) => {
          // Search in gallery name
          if ((gallery.name || "").toLowerCase().includes(searchTerm)) return true;
          // Search in school name
          if ((gallery.schoolName || "").toLowerCase().includes(searchTerm)) return true;
          // Search in status
          if ((gallery.status || "").toLowerCase().includes(searchTerm)) return true;
          // Search in status labels
          const statusLabels = {
            'pending': 'pending review',
            'partial': 'in progress',
            'approved': 'approved all',
            'has_denials': 'denied denials'
          };
          const statusLabel = statusLabels[gallery.status] || '';
          if (statusLabel.includes(searchTerm)) return true;
          
          return false;
        }
      );
    }

    return filtered;
  }, [galleries, isArchived, searchState]);

  // Get year from date
  const getYearFromDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.getFullYear().toString();
  };

  // Organize galleries into folder structure (only used when viewMode is "folders")
  const folderStructure = useMemo(() => {
    if (viewMode !== "folders") return {};

    const structure = {};

    filteredGalleries.forEach((gallery) => {
      const schoolName = gallery.schoolName || "Unknown School";
      const year = getYearFromDate(gallery.createdAt);

      if (!structure[schoolName]) {
        structure[schoolName] = {};
      }

      if (!structure[schoolName][year]) {
        structure[schoolName][year] = [];
      }

      structure[schoolName][year].push(gallery);
    });

    return structure;
  }, [filteredGalleries, viewMode]);

  // Generate folder data based on current view level (only for folder view)
  const getCurrentViewData = () => {
    if (viewMode !== "folders") return filteredGalleries;

    if (currentFolderView.level === "root") {
      // Show schools
      return Object.keys(folderStructure).map((schoolName) => {
        const totalGalleries = Object.values(folderStructure[schoolName]).reduce(
          (acc, galleries) => acc + galleries.length,
          0
        );
        return {
          name: schoolName,
          count: totalGalleries,
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
      // Show galleries for selected school and year
      return (
        folderStructure[currentFolderView.school]?.[currentFolderView.year] || []
      );
    }
    return [];
  };

  const handleFolderClick = (folder) => {
    if (folder.type === "school") {
      setCurrentFolderView({
        level: "school",
        school: folder.name,
        year: null,
      });
    } else if (folder.type === "year") {
      setCurrentFolderView({
        ...currentFolderView,
        level: "year",
        year: folder.name,
      });
    }
  };

  const handleBreadcrumbClick = (level, value) => {
    if (level === "root") {
      setCurrentFolderView({ level: "root", school: null, year: null });
    } else if (level === "school") {
      setCurrentFolderView({
        level: "school",
        school: value,
        year: null,
      });
    }
  };

  const currentData = getCurrentViewData();

  // Render empty state
  if (currentData.length === 0) {
    return (
      <div className="empty-state">
        <h5 className="text-muted">
          {searchState.isActive
            ? "No galleries found matching your search"
            : isArchived
            ? "No archived galleries"
            : "No active galleries"}
        </h5>
        {!isArchived && !searchState.isActive && (
          <p className="text-muted">Create your first proofing gallery to get started</p>
        )}
      </div>
    );
  }

  // Render folder navigation if needed
  if (viewMode === "folders" && currentFolderView.level !== "root") {
    return (
      <>
        <FolderNavigation
          currentFolderView={currentFolderView}
          onBreadcrumbClick={handleBreadcrumbClick}
        />
        {currentFolderView.level === "year" ? (
          <div className="job-grid">
            {currentData.map((gallery) => (
              <ModernGalleryCard
                key={gallery.id}
                gallery={gallery}
                onView={() => onViewGallery(gallery)}
                onEdit={() => onEditGallery(gallery)}
                isArchived={isArchived}
              />
            ))}
          </div>
        ) : (
          <div className="row">
            {currentData.map((folder, index) => (
              <FolderCard
                key={index}
                name={folder.name}
                count={folder.count}
                onClick={() => handleFolderClick(folder)}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  // Render folders at root level for archived view
  if (viewMode === "folders") {
    return (
      <div className="row">
        {currentData.map((folder, index) => (
          <FolderCard
            key={index}
            name={folder.name}
            count={folder.count}
            onClick={() => handleFolderClick(folder)}
          />
        ))}
      </div>
    );
  }

  // Render flat list of galleries
  return (
    <div className="job-grid">
      {currentData.map((gallery) => (
        <ModernGalleryCard
          key={gallery.id}
          gallery={gallery}
          onView={() => onViewGallery(gallery)}
          onEdit={() => onEditGallery(gallery)}
          isArchived={isArchived}
        />
      ))}
    </div>
  );
};

export default GalleryList;