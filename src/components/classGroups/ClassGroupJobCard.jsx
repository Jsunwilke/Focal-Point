// src/components/classGroups/ClassGroupJobCard.jsx
import React from "react";
import { 
  Calendar, 
  School, 
  Users, 
  Camera,
  Edit, 
  Trash2
} from "lucide-react";
import { useClassGroups } from "../../contexts/ClassGroupsContext";

const ClassGroupJobCard = ({ job, onClick, onEdit, onDelete }) => {
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const totalGroups = job.classGroups?.length || 0;
  const groupsWithImages = job.classGroups?.filter(group => 
    group.imageNumbers && group.imageNumbers.trim() !== ''
  ).length || 0;

  const handleCardClick = () => {
    onClick(job);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(job);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this class group job?')) {
      onDelete(job.id);
    }
  };

  return (
    <div className="class-group-job-card" onClick={handleCardClick}>
      <div className="job-card-header">
        <School size={16} />
        <h3>{job.schoolName || 'Unknown School'}</h3>
      </div>
      
      <div className="job-card-body">
        <div className="job-stat">
          <Calendar size={14} />
          <span>{formatDate(job.sessionDate)}</span>
        </div>
        
        <div className="job-stats-row">
          <div className="job-stat">
            <Users size={14} />
            <span>{totalGroups} groups</span>
          </div>
          <div className="job-stat">
            <Camera size={14} />
            <span>{groupsWithImages} {groupsWithImages === 1 ? 'group' : 'groups'} with images</span>
          </div>
        </div>
      </div>

      <div className="job-card-actions">
        <button 
          className="btn-icon-small"
          onClick={handleEdit}
          title="Edit Job"
        >
          <Edit size={14} />
        </button>
        <button 
          className="btn-icon-small danger"
          onClick={handleDelete}
          title="Delete Job"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default ClassGroupJobCard;