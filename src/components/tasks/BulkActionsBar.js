// src/components/tasks/BulkActionsBar.js
import React from 'react';
import { X, Trash2, Edit, CheckSquare, Square, Clock, AlertCircle } from 'lucide-react';
import './BulkActionsBar.css';

const BulkActionsBar = ({ selectedCount, onClearSelection, onBulkEdit, onBulkDelete, onBulkStatusChange }) => {
  return (
    <div className="bulk-actions-bar">
      <div className="bulk-actions-bar__content">
        <div className="bulk-actions-bar__info">
          <CheckSquare size={20} className="bulk-actions-bar__icon" />
          <span className="bulk-actions-bar__count">
            {selectedCount} task{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="bulk-actions-bar__actions">
          {/* Status change buttons */}
          <div className="bulk-actions-bar__group">
            <button
              className="bulk-actions-bar__btn"
              onClick={() => onBulkStatusChange('todo')}
              title="Move to To Do"
            >
              <Square size={16} />
              <span>To Do</span>
            </button>
            <button
              className="bulk-actions-bar__btn"
              onClick={() => onBulkStatusChange('in_progress')}
              title="Move to In Progress"
            >
              <Clock size={16} />
              <span>In Progress</span>
            </button>
            <button
              className="bulk-actions-bar__btn"
              onClick={() => onBulkStatusChange('in_review')}
              title="Move to In Review"
            >
              <AlertCircle size={16} />
              <span>In Review</span>
            </button>
            <button
              className="bulk-actions-bar__btn"
              onClick={() => onBulkStatusChange('completed')}
              title="Move to Completed"
            >
              <CheckSquare size={16} />
              <span>Completed</span>
            </button>
          </div>

          {/* Edit and delete */}
          <div className="bulk-actions-bar__group">
            <button
              className="bulk-actions-bar__btn"
              onClick={onBulkEdit}
              title="Edit selected tasks"
            >
              <Edit size={16} />
              <span>Edit</span>
            </button>
            <button
              className="bulk-actions-bar__btn bulk-actions-bar__btn--danger"
              onClick={onBulkDelete}
              title="Delete selected tasks"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </div>

          <button
            className="bulk-actions-bar__close"
            onClick={onClearSelection}
            title="Clear selection"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActionsBar;
