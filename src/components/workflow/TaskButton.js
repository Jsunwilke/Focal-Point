// src/components/workflow/TaskButton.js
import React, { useState, useRef, useEffect } from 'react';
import { CheckSquare, Plus, Circle } from 'lucide-react';
import { useWorkflow } from '../../contexts/WorkflowContext';
import './TaskButton.css';

/**
 * TaskButton - Compact button for workflow matrix cells
 * Shows task count and allows creating/viewing tasks for a workflow step
 */
const TaskButton = ({
  workflowId,
  stepId,
  sessionID,
  tasks = [],
  onTaskClick
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { createTaskForWorkflowStep } = useWorkflow();

  const taskCount = tasks.length;
  const incompleteTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const hasIncompleteTasks = incompleteTasks.length > 0;
  const hasUrgent = tasks.some(t => t.priority === 'urgent' && t.status !== 'completed');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleCreateTask = (e) => {
    e.stopPropagation();
    createTaskForWorkflowStep(workflowId, stepId, sessionID);
    setIsOpen(false);
  };

  const handleTaskClick = (taskId, e) => {
    e.stopPropagation();
    onTaskClick(taskId);
    setIsOpen(false);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#dc2626';
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  return (
    <div className="task-button-wrapper" ref={dropdownRef}>
      <button
        className={`task-button ${hasIncompleteTasks ? 'task-button--has-tasks' : ''} ${hasUrgent ? 'task-button--urgent' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={taskCount > 0 ? `${taskCount} task${taskCount !== 1 ? 's' : ''}` : 'Create task'}
      >
        <CheckSquare size={12} />
        {taskCount > 0 && (
          <span className="task-button-count">{taskCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="task-button-dropdown">
          {/* Header */}
          <div className="task-button-dropdown-header">
            <span className="task-button-dropdown-title">
              Tasks {taskCount > 0 && `(${taskCount})`}
            </span>
            <button
              className="task-button-create"
              onClick={handleCreateTask}
              title="Create new task"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Task List */}
          {taskCount > 0 ? (
            <div className="task-button-list">
              {tasks.map(task => (
                <button
                  key={task.id}
                  className={`task-button-item task-button-item--${task.status}`}
                  onClick={(e) => handleTaskClick(task.id, e)}
                >
                  <div className="task-button-item-header">
                    <Circle
                      size={8}
                      fill={getPriorityColor(task.priority)}
                      color={getPriorityColor(task.priority)}
                    />
                    <span className="task-button-item-title">{task.title}</span>
                  </div>
                  <span className="task-button-item-status">
                    {getStatusLabel(task.status)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="task-button-empty">
              <p>No tasks yet</p>
              <button className="task-button-empty-create" onClick={handleCreateTask}>
                <Plus size={14} />
                Create Task
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskButton;
