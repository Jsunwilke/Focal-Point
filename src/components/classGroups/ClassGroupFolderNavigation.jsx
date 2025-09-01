// src/components/classGroups/ClassGroupFolderNavigation.jsx
import React from "react";
import { ChevronRight, Home } from "lucide-react";

const ClassGroupFolderNavigation = ({ currentFolderView, onBreadcrumbClick }) => {
  return (
    <div className="class-group-folder-navigation">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li
            className={`breadcrumb-item ${
              currentFolderView.level === "root" ? "active" : ""
            }`}
          >
            {currentFolderView.level === "root" ? (
              <span>
                <Home size={14} />
                All Schools
              </span>
            ) : (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onBreadcrumbClick("root");
                }}
              >
                <Home size={14} />
                All Schools
              </a>
            )}
          </li>

          {currentFolderView.school && (
            <>
              <li className="breadcrumb-separator">
                <ChevronRight size={14} />
              </li>
              <li
                className={`breadcrumb-item ${
                  currentFolderView.level === "school" && !currentFolderView.year
                    ? "active"
                    : ""
                }`}
              >
                {currentFolderView.level === "school" &&
                !currentFolderView.year ? (
                  <span>{currentFolderView.school}</span>
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
            </>
          )}

          {currentFolderView.year && (
            <>
              <li className="breadcrumb-separator">
                <ChevronRight size={14} />
              </li>
              <li className="breadcrumb-item active">
                <span>{currentFolderView.year}</span>
              </li>
            </>
          )}
        </ol>
      </nav>
    </div>
  );
};

export default ClassGroupFolderNavigation;