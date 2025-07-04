import React from "react";

const FolderNavigation = ({ currentFolderView, onBreadcrumbClick }) => {
  return (
    <div className="folder-navigation mb-3">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li
            className={`breadcrumb-item ${
              currentFolderView.level === "root" ? "active" : ""
            }`}
          >
            {currentFolderView.level === "root" ? (
              "All Schools"
            ) : (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onBreadcrumbClick("root");
                }}
              >
                All Schools
              </a>
            )}
          </li>

          {currentFolderView.school && (
            <li
              className={`breadcrumb-item ${
                currentFolderView.level === "school" && !currentFolderView.year
                  ? "active"
                  : ""
              }`}
            >
              {currentFolderView.level === "school" &&
              !currentFolderView.year ? (
                currentFolderView.school
              ) : (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onBreadcrumbClick("school", currentFolderView.school);
                  }}
                >
                  {currentFolderView.school}
                </a>
              )}
            </li>
          )}

          {currentFolderView.year && (
            <li className="breadcrumb-item active">{currentFolderView.year}</li>
          )}
        </ol>
      </nav>
    </div>
  );
};

export default FolderNavigation;
