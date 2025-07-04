// src/components/sports/folders/FolderCard.jsx
import React from "react";
import { Folder } from "lucide-react";

const FolderCard = ({ name, count, onClick }) => {
  return (
    <div
      className="col-6 col-md-4 col-lg-3 folder-card-container"
      onClick={onClick}
    >
      <div className="folder-card">
        <div className="folder-icon">
          <Folder size={48} color="#3a6ea5" />
        </div>
        <div className="folder-info">
          <h5 className="folder-name">{name}</h5>
          <p className="folder-count">
            {count} {count === 1 ? "item" : "items"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FolderCard;
