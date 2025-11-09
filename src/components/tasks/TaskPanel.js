// src/components/tasks/TaskPanel.js
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, ListTodo, ChevronDown } from 'lucide-react';
import { useTask } from '../../contexts/TaskContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { useNavigate } from 'react-router-dom';
import TaskPanelItem from './TaskPanelItem';
import TaskPanelDetail from './TaskPanelDetail';
import CreateTaskModal from './CreateTaskModal';
import './TaskPanel.css';

const TaskPanel = () => {
  const {
    isPanelOpen,
    closePanel,
    panelFilter,
    setPanelFilter,
    getPanelTasks,
    markTaskComplete,
    myTasks,
    teamTasks,
    canViewTeamTasks
  } = useTask();

  const { userProfile } = useAuth();
  const { teamMembers } = useDataCache();
  const navigate = useNavigate();
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('me'); // 'me' | 'all' | specific userId
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);

  // Check if user is manager or admin
  const isManagerOrAdmin = userProfile?.role === 'admin' || userProfile?.role === 'manager';

  // Close user dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    };

    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userDropdownOpen]);

  // Get tasks based on selected user
  const panelTasks = useMemo(() => {
    if (selectedUserId === 'me') {
      return getPanelTasks();
    } else if (selectedUserId === 'all') {
      // Show all team tasks
      return teamTasks.filter(task => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        switch (panelFilter) {
          case 'completed':
            return task.status === 'completed';
          case 'today':
            if (task.status === 'completed' || task.status === 'cancelled') return false;
            if (!task.dueDate) return false;
            const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
            return dueDate < tomorrow;
          case 'urgent':
            if (task.status === 'completed' || task.status === 'cancelled') return false;
            return task.priority === 'urgent' || task.priority === 'high';
          case 'all':
          default:
            return task.status !== 'completed' && task.status !== 'cancelled';
        }
      });
    } else {
      // Show specific user's tasks
      return teamTasks.filter(task => {
        // Filter to tasks assigned to or created by the selected user
        const belongsToUser = (task.assignedTo && task.assignedTo.includes(selectedUserId)) ||
                              (task.createdBy === selectedUserId && (!task.assignedTo || task.assignedTo.length === 0));

        if (!belongsToUser) return false;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        switch (panelFilter) {
          case 'completed':
            return task.status === 'completed';
          case 'today':
            if (task.status === 'completed' || task.status === 'cancelled') return false;
            if (!task.dueDate) return false;
            const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
            return dueDate < tomorrow;
          case 'urgent':
            if (task.status === 'completed' || task.status === 'cancelled') return false;
            return task.priority === 'urgent' || task.priority === 'high';
          case 'all':
          default:
            return task.status !== 'completed' && task.status !== 'cancelled';
        }
      });
    }
  }, [selectedUserId, panelFilter, myTasks, teamTasks, getPanelTasks]);

  // Get selected user name
  const getSelectedUserName = () => {
    if (selectedUserId === 'me') return 'My Tasks';
    if (selectedUserId === 'all') return 'All Tasks';
    const user = teamMembers?.find(m => m.id === selectedUserId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown User';
  };

  const handleTaskClick = (taskId) => {
    setSelectedTaskId(taskId);
  };

  const handleBackToList = () => {
    setSelectedTaskId(null);
  };

  const handleToggleComplete = async (taskId) => {
    try {
      await markTaskComplete(taskId);
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const handleQuickAction = (taskId, action) => {
    // Open task detail view for all actions
    setSelectedTaskId(taskId);

    // TODO: Could set a flag to auto-open specific tab or action
    // For now, just opening the detail view where user can perform the action
  };

  const handleNewTaskClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateModalClose = () => {
    setIsCreateModalOpen(false);
  };

  const handleViewAllClick = () => {
    navigate('/tasks');
    closePanel();
  };

  if (!isPanelOpen) return null;

  const panelContent = (
    <div className="task-panel">
      {selectedTaskId ? (
        // Detail View
        <TaskPanelDetail
          taskId={selectedTaskId}
          onBack={handleBackToList}
        />
      ) : (
        // List View
        <>
          {/* Header */}
          <div className="task-panel__header">
            <div className="task-panel__header-top">
              <div className="task-panel__header-title">
                <ListTodo size={20} />
                {isManagerOrAdmin && canViewTeamTasks ? (
                  <div className="task-panel__user-selector" ref={userDropdownRef}>
                    <button
                      className="task-panel__user-selector-btn"
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    >
                      <span>{getSelectedUserName()} ({panelTasks.length})</span>
                      <ChevronDown size={16} />
                    </button>
                    {userDropdownOpen && (
                      <div className="task-panel__user-dropdown">
                        <button
                          className={`task-panel__user-option ${selectedUserId === 'me' ? 'task-panel__user-option--active' : ''}`}
                          onClick={() => {
                            setSelectedUserId('me');
                            setUserDropdownOpen(false);
                          }}
                        >
                          My Tasks
                        </button>
                        <button
                          className={`task-panel__user-option ${selectedUserId === 'all' ? 'task-panel__user-option--active' : ''}`}
                          onClick={() => {
                            setSelectedUserId('all');
                            setUserDropdownOpen(false);
                          }}
                        >
                          All Tasks
                        </button>
                        <div className="task-panel__user-divider"></div>
                        {teamMembers?.filter(m => m.status !== 'inactive').map(member => (
                          <button
                            key={member.id}
                            className={`task-panel__user-option ${selectedUserId === member.id ? 'task-panel__user-option--active' : ''}`}
                            onClick={() => {
                              setSelectedUserId(member.id);
                              setUserDropdownOpen(false);
                            }}
                          >
                            {member.firstName} {member.lastName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span>Tasks ({panelTasks.length})</span>
                )}
              </div>
              <div className="task-panel__header-actions">
                <button
                  className="task-panel__new-task-btn"
                  onClick={handleNewTaskClick}
                  aria-label="New task"
                >
                  <Plus size={18} />
                  New
                </button>
                <button
                  className="task-panel__close-btn"
                  onClick={closePanel}
                  aria-label="Close tasks panel"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="task-panel__filters">
              <button
                className={`task-panel__filter-tab ${panelFilter === 'all' ? 'task-panel__filter-tab--active' : ''}`}
                onClick={() => setPanelFilter('all')}
              >
                All
              </button>
              <button
                className={`task-panel__filter-tab ${panelFilter === 'today' ? 'task-panel__filter-tab--active' : ''}`}
                onClick={() => setPanelFilter('today')}
              >
                Today
              </button>
              <button
                className={`task-panel__filter-tab ${panelFilter === 'urgent' ? 'task-panel__filter-tab--active' : ''}`}
                onClick={() => setPanelFilter('urgent')}
              >
                Urgent
              </button>
              <button
                className={`task-panel__filter-tab ${panelFilter === 'completed' ? 'task-panel__filter-tab--active' : ''}`}
                onClick={() => setPanelFilter('completed')}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Task list */}
          <div className="task-panel__list">
            {panelTasks.length === 0 ? (
              <div className="task-panel__empty">
                <ListTodo size={48} className="task-panel__empty-icon" />
                <p className="task-panel__empty-text">
                  {panelFilter === 'all' ? 'No tasks yet' :
                   panelFilter === 'completed' ? 'No completed tasks' :
                   `No ${panelFilter} tasks`}
                </p>
                {panelFilter !== 'completed' && (
                  <button
                    className="task-panel__empty-btn"
                    onClick={handleNewTaskClick}
                  >
                    Create your first task
                  </button>
                )}
              </div>
            ) : (
              panelTasks.map(task => (
                <TaskPanelItem
                  key={task.id}
                  task={task}
                  onClick={() => handleTaskClick(task.id)}
                  onToggleComplete={handleToggleComplete}
                  onQuickAction={handleQuickAction}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {panelTasks.length > 0 && (
            <div className="task-panel__footer">
              <button
                className="task-panel__view-all-btn"
                onClick={handleViewAllClick}
              >
                View all tasks →
              </button>
            </div>
          )}
        </>
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={handleCreateModalClose}
      />
    </div>
  );

  return ReactDOM.createPortal(panelContent, document.body);
};

export default TaskPanel;
