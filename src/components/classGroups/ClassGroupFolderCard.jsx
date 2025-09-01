// src/components/classGroups/ClassGroupFolderCard.jsx
import React from "react";
import { Folder, School, Calendar } from "lucide-react";

const ClassGroupFolderCard = ({ name, count, type, onClick }) => {
  const getIcon = () => {
    if (type === "school") {
      return <School size={36} className="folder-icon" />;
    } else {
      return <Calendar size={36} className="folder-icon" />;
    }
  };

  return (
    <div className="class-group-folder-card" onClick={onClick}>
      <div className="folder-visual">
        {getIcon()}
      </div>
      <div className="folder-info">
        <h4 className="folder-name">{name}</h4>
        <p className="folder-count">
          {count} {count === 1 ? "job" : "jobs"}
        </p>
      </div>
    </div>
  );
};

export default ClassGroupFolderCard;