// src/pages/TasksPage.js
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTask } from '../contexts/TaskContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { secureLogger } from '../services/secureLogger';
import { ListTodo, Plus, Search, Filter, X, CheckSquare, Clock, AlertCircle, LayoutGrid, List, GitBranch } from 'lucide-react';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import TaskBoardView from '../components/tasks/TaskBoardView';
import BulkActionsBar from '../components/tasks/BulkActionsBar';
import BulkEditModal from '../components/tasks/BulkEditModal';
import TaskExportButton from '../components/tasks/TaskExportButton';
import './TasksPage.css';

// LocalStorage keys
const TASKS_VIEW_MODE_KEY = 'tasks_view_mode';
const TASKS_FILTER_SETTINGS_KEY = 'tasks_filter_settings';

// Default filter settings
const DEFAULT_FILTERS = {
  status: ['todo', 'in_progress', 'on_hold', 'completed'],
  assignee: 'me', // 'me' | 'all' | specific userId
  priority: [],
  type: []
};

const TasksPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { myTasks, teamTasks, canViewTeamTasks, loading, openPanelWithTask, updateTask, deleteTask } = useTask();
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    // Load view preference from localStorage
    return localStorage.getItem(TASKS_VIEW_MODE_KEY) || 'list';
  });
  const [filters, setFilters] = useState(() => {
    // Load filter settings from localStorage or use defaults
    try {
      const saved = localStorage.getItem(TASKS_FILTER_SETTINGS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading filter settings:', error);
    }
    return DEFAULT_FILTERS;
  });

  // Save view mode preference to localStorage
  useEffect(() => {
    localStorage.setItem(TASKS_VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  // Save filter settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TASKS_FILTER_SETTINGS_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('Error saving filter settings:', error);
    }
  }, [filters]);

  // Check for quickAdd param from task panel
  useEffect(() => {
    const quickAdd = searchParams.get('quickAdd');
    if (quickAdd) {
      // Open CreateTaskModal
      setIsCreateModalOpen(true);
      // Clear the param
      searchParams.delete('quickAdd');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let tasks = filters.assignee === 'me' ? myTasks : teamTasks;

    // When showing "my tasks", filter to only show:
    // 1. Tasks assigned to me, OR
    // 2. Tasks I created that are unassigned
    if (filters.assignee === 'me') {
      tasks = tasks.filter(task => {
        // If task is assigned to me, include it
        if (task.assignedTo && task.assignedTo.includes(userProfile.id)) {
          return true;
        }
        // If I created it and it's unassigned, include it
        if (task.createdBy === userProfile.id && (!task.assignedTo || task.assignedTo.length === 0)) {
          return true;
        }
        // Otherwise exclude (tasks I created but assigned to others)
        return false;
      });
    }

    // Apply status filter
    if (filters.status.length > 0) {
      tasks = tasks.filter(task => filters.status.includes(task.status));
    }

    // Apply priority filter
    if (filters.priority.length > 0) {
      tasks = tasks.filter(task => filters.priority.includes(task.priority));
    }

    // Apply type filter
    if (filters.type.length > 0) {
      tasks = tasks.filter(task => filters.type.includes(task.type));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      tasks = tasks.filter(task =>
        task.title.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query))
      );
    }

    // Sort by due date (earliest first), then by priority
    return tasks.sort((a, b) => {
      // Overdue tasks first
      const aOverdue = a.dueDate && a.dueDate.toDate && a.dueDate.toDate() < new Date();
      const bOverdue = b.dueDate && b.dueDate.toDate && b.dueDate.toDate() < new Date();

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // Then by due date
      if (a.dueDate && b.dueDate) {
        const aTime = a.dueDate.toMillis ? a.dueDate.toMillis() : 0;
        const bTime = b.dueDate.toMillis ? b.dueDate.toMillis() : 0;
        if (aTime !== bTime) return aTime - bTime;
      } else if (a.dueDate) {
        return -1;
      } else if (b.dueDate) {
        return 1;
      }

      // Then by priority
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
  }, [myTasks, teamTasks, filters, searchQuery]);

  // Calculate task counts
  const taskCounts = useMemo(() => {
    const counts = {
      todo: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0
    };

    const now = new Date();
    filteredTasks.forEach(task => {
      if (task.status === 'todo') counts.todo++;
      if (task.status === 'in_progress') counts.in_progress++;
      if (task.status === 'completed') counts.completed++;
      if (task.dueDate && task.dueDate.toDate && task.dueDate.toDate() < now && task.status !== 'completed') {
        counts.overdue++;
      }
    });

    return counts;
  }, [filteredTasks]);

  // Toggle status filter
  const toggleStatusFilter = (status) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  // Toggle priority filter
  const togglePriorityFilter = (priority) => {
    setFilters(prev => ({
      ...prev,
      priority: prev.priority.includes(priority)
        ? prev.priority.filter(p => p !== priority)
        : [...prev.priority, priority]
    }));
  };

  // Toggle type filter
  const toggleTypeFilter = (type) => {
    setFilters(prev => ({
      ...prev,
      type: prev.type.includes(type)
        ? prev.type.filter(t => t !== type)
        : [...prev.type, type]
    }));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery('');
  };

  // Bulk selection handlers
  const handleToggleTaskSelection = (taskId) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleClearSelection = () => {
    setSelectedTaskIds([]);
  };

  const handleBulkStatusChange = async (newStatus) => {
    try {
      await Promise.all(
        selectedTaskIds.map(taskId => updateTask(taskId, { status: newStatus }))
      );
      showToast(`Updated ${selectedTaskIds.length} task${selectedTaskIds.length !== 1 ? 's' : ''}`, 'success');
      setSelectedTaskIds([]);
    } catch (error) {
      console.error('Error updating tasks:', error);
      showToast('Failed to update tasks', 'error');
    }
  };

  const handleBulkEdit = () => {
    setIsBulkEditModalOpen(true);
  };

  const handleBulkUpdate = async (updates) => {
    try {
      await Promise.all(
        selectedTaskIds.map(taskId => updateTask(taskId, updates))
      );
      showToast(`Updated ${selectedTaskIds.length} task${selectedTaskIds.length !== 1 ? 's' : ''}`, 'success');
      setSelectedTaskIds([]);
      setIsBulkEditModalOpen(false);
    } catch (error) {
      console.error('Error updating tasks:', error);
      showToast('Failed to update tasks', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedTaskIds.length} task${selectedTaskIds.length !== 1 ? 's' : ''}?`)) {
      return;
    }

    try {
      await Promise.all(
        selectedTaskIds.map(taskId => deleteTask(taskId))
      );
      showToast(`Deleted ${selectedTaskIds.length} task${selectedTaskIds.length !== 1 ? 's' : ''}`, 'success');
      setSelectedTaskIds([]);
    } catch (error) {
      secureLogger.error('Error deleting tasks', { error: error.message, count: selectedTaskIds.length });
      showToast('Failed to delete tasks', 'error');
    }
  };

  // Handle task click
  const handleTaskClick = (taskId) => {
    openPanelWithTask(taskId);
  };

  // Format due date
  const formatDueDate = (dueDate) => {
    if (!dueDate || !dueDate.toDate) return '';

    const date = dueDate.toDate();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date < today) {
      const daysOverdue = Math.ceil((today - date) / (1000 * 60 * 60 * 24));
      return `Overdue ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`;
    } else if (date >= today && date < tomorrow) {
      return 'Due today';
    } else if (date >= tomorrow) {
      const tomorrow2 = new Date(tomorrow);
      tomorrow2.setDate(tomorrow2.getDate() + 1);
      if (date < tomorrow2) {
        return 'Due tomorrow';
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return '';
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return '#ef4444';
      case 'high':
        return '#f59e0b';
      case 'medium':
        return '#3b82f6';
      case 'low':
      default:
        return '#6b7280';
    }
  };

  // Check if task is overdue
  const isOverdue = (task) => {
    return task.dueDate && task.dueDate.toDate && task.dueDate.toDate() < new Date() && task.status !== 'completed';
  };

  if (loading) {
    return (
      <div className="tasks-page tasks-page--loading">
        <div className="loading-spinner"></div>
        <p>Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      {/* Header */}
      <div className="tasks-page__header">
        <div className="tasks-page__header-left">
          <ListTodo size={28} className="tasks-page__icon" />
          <div>
            <h1 className="tasks-page__title">Tasks</h1>
            <p className="tasks-page__subtitle">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="tasks-page__header-right">
          <TaskExportButton tasks={filteredTasks} filename="tasks-export" />
          <div className="tasks-page__view-toggle">
            <button
              className={`tasks-page__view-btn ${viewMode === 'list' ? 'tasks-page__view-btn--active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List size={18} />
            </button>
            <button
              className={`tasks-page__view-btn ${viewMode === 'board' ? 'tasks-page__view-btn--active' : ''}`}
              onClick={() => setViewMode('board')}
              title="Board view"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
          <button
            className="tasks-page__new-btn"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={20} />
            New Task
          </button>
        </div>
      </div>

      {/* Task count cards */}
      <div className="tasks-page__stats">
        <div className="tasks-page__stat-card">
          <div className="tasks-page__stat-icon tasks-page__stat-icon--todo">
            <ListTodo size={20} />
          </div>
          <div>
            <div className="tasks-page__stat-value">{taskCounts.todo}</div>
            <div className="tasks-page__stat-label">To Do</div>
          </div>
        </div>

        <div className="tasks-page__stat-card">
          <div className="tasks-page__stat-icon tasks-page__stat-icon--progress">
            <Clock size={20} />
          </div>
          <div>
            <div className="tasks-page__stat-value">{taskCounts.in_progress}</div>
            <div className="tasks-page__stat-label">In Progress</div>
          </div>
        </div>

        <div className="tasks-page__stat-card">
          <div className="tasks-page__stat-icon tasks-page__stat-icon--completed">
            <CheckSquare size={20} />
          </div>
          <div>
            <div className="tasks-page__stat-value">{taskCounts.completed}</div>
            <div className="tasks-page__stat-label">Completed</div>
          </div>
        </div>

        {taskCounts.overdue > 0 && (
          <div className="tasks-page__stat-card tasks-page__stat-card--overdue">
            <div className="tasks-page__stat-icon tasks-page__stat-icon--overdue">
              <AlertCircle size={20} />
            </div>
            <div>
              <div className="tasks-page__stat-value">{taskCounts.overdue}</div>
              <div className="tasks-page__stat-label">Overdue</div>
            </div>
          </div>
        )}
      </div>

      <div className="tasks-page__content">
        {/* Sidebar Filters */}
        <div className="tasks-page__sidebar">
          <div className="tasks-page__filter-section">
            <div className="tasks-page__filter-header">
              <h3 className="tasks-page__filter-title">
                <Filter size={16} />
                Filters
              </h3>
              {(filters.status.length !== 2 || filters.priority.length > 0 || filters.type.length > 0 || searchQuery) && (
                <button
                  className="tasks-page__filter-reset"
                  onClick={resetFilters}
                >
                  Reset
                </button>
              )}
            </div>

            {/* Search */}
            <div className="tasks-page__search">
              <Search size={16} className="tasks-page__search-icon" />
              <input
                type="text"
                className="tasks-page__search-input"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="tasks-page__search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Assignee Filter */}
            <div className="tasks-page__filter-group">
              <h4 className="tasks-page__filter-group-title">Assignee</h4>
              <label className="tasks-page__filter-checkbox">
                <input
                  type="radio"
                  name="assignee"
                  checked={filters.assignee === 'me'}
                  onChange={() => setFilters(prev => ({ ...prev, assignee: 'me' }))}
                />
                <span>My Tasks</span>
              </label>
              {canViewTeamTasks && (
                <label className="tasks-page__filter-checkbox">
                  <input
                    type="radio"
                    name="assignee"
                    checked={filters.assignee === 'all'}
                    onChange={() => setFilters(prev => ({ ...prev, assignee: 'all' }))}
                  />
                  <span>All Team Tasks</span>
                </label>
              )}
            </div>

            {/* Status Filter */}
            <div className="tasks-page__filter-group">
              <h4 className="tasks-page__filter-group-title">Status</h4>
              <label className="tasks-page__filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.status.includes('todo')}
                  onChange={() => toggleStatusFilter('todo')}
                />
                <span>To Do</span>
              </label>
              <label className="tasks-page__filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.status.includes('in_progress')}
                  onChange={() => toggleStatusFilter('in_progress')}
                />
                <span>In Progress</span>
              </label>
              <label className="tasks-page__filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.status.includes('on_hold')}
                  onChange={() => toggleStatusFilter('on_hold')}
                />
                <span>On Hold</span>
              </label>
              <label className="tasks-page__filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.status.includes('completed')}
                  onChange={() => toggleStatusFilter('completed')}
                />
                <span>Completed</span>
              </label>
            </div>

            {/* Priority Filter */}
            <div className="tasks-page__filter-group">
              <h4 className="tasks-page__filter-group-title">Priority</h4>
              <label className="tasks-page__filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.priority.includes('urgent')}
                  onChange={() => togglePriorityFilter('urgent')}
                />
                <span>Urgent</span>
              </label>
              <label className="tasks-page__filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.priority.includes('high')}
                  onChange={() => togglePriorityFilter('high')}
                />
                <span>High</span>
              </label>
              <label className="tasks-page__filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.priority.includes('medium')}
                  onChange={() => togglePriorityFilter('medium')}
                />
                <span>Medium</span>
              </label>
              <label className="tasks-page__filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.priority.includes('low')}
                  onChange={() => togglePriorityFilter('low')}
                />
                <span>Low</span>
              </label>
            </div>

            {/* Type Filter */}
            <div className="tasks-page__filter-group">
              <h4 className="tasks-page__filter-group-title">Type</h4>
              <label className="tasks-page__filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.type.includes('general')}
                  onChange={() => toggleTypeFilter('general')}
                />
                <span>General</span>
              </label>
              <label className="tasks-page__filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.type.includes('session')}
                  onChange={() => toggleTypeFilter('session')}
                />
                <span>Session</span>
              </label>
              <label className="tasks-page__filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.type.includes('workflow')}
                  onChange={() => toggleTypeFilter('workflow')}
                />
                <span>Workflow</span>
              </label>
            </div>
          </div>
        </div>

        {/* Task List or Board */}
        <div className={`tasks-page__main ${viewMode === 'board' ? 'tasks-page__main--board' : ''}`}>
          {filteredTasks.length === 0 ? (
            <div className="tasks-page__empty">
              <ListTodo size={64} className="tasks-page__empty-icon" />
              <h3 className="tasks-page__empty-title">
                {searchQuery || filters.status.length < 2 || filters.priority.length > 0 || filters.type.length > 0
                  ? 'No tasks found'
                  : 'No tasks yet'}
              </h3>
              <p className="tasks-page__empty-text">
                {searchQuery || filters.status.length < 2 || filters.priority.length > 0 || filters.type.length > 0
                  ? 'Try adjusting your filters or search query'
                  : 'Create your first task to get started'}
              </p>
              {!(searchQuery || filters.status.length < 2 || filters.priority.length > 0 || filters.type.length > 0) && (
                <button
                  className="tasks-page__empty-btn"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  <Plus size={20} />
                  Create First Task
                </button>
              )}
            </div>
          ) : viewMode === 'board' ? (
            <TaskBoardView
              tasks={filteredTasks}
              onTaskClick={(task) => handleTaskClick(task.id)}
              filterSettings={filters}
            />
          ) : (
            <div className="tasks-page__list">
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  className={`tasks-page__task ${isOverdue(task) ? 'tasks-page__task--overdue' : ''} ${task.status === 'completed' ? 'tasks-page__task--completed' : ''} ${selectedTaskIds.includes(task.id) ? 'tasks-page__task--selected' : ''}`}
                >
                  <div className="tasks-page__task-left">
                    <input
                      type="checkbox"
                      className="tasks-page__task-checkbox"
                      checked={selectedTaskIds.includes(task.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleTaskSelection(task.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div
                      className="tasks-page__task-priority"
                      style={{ backgroundColor: getPriorityColor(task.priority) }}
                      title={`${task.priority} priority`}
                    />
                    <div className="tasks-page__task-content" onClick={() => handleTaskClick(task.id)}>
                      <h3 className="tasks-page__task-title">{task.title}</h3>
                      <div className="tasks-page__task-meta">
                        {task.type && (
                          <span className="tasks-page__task-type">{task.type}</span>
                        )}
                        {task.workflowId && (
                          <span className="tasks-page__task-workflow" title="Linked to workflow">
                            <GitBranch size={12} />
                            Workflow
                          </span>
                        )}
                        {task.dueDate && (
                          <span className={`tasks-page__task-due ${isOverdue(task) ? 'tasks-page__task-due--overdue' : ''}`}>
                            <Clock size={12} />
                            {formatDueDate(task.dueDate)}
                          </span>
                        )}
                        {task.subtasks && task.subtasks.length > 0 && (
                          <span className="tasks-page__task-subtasks">
                            <CheckSquare size={12} />
                            {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="tasks-page__task-right">
                    <span className={`tasks-page__task-status tasks-page__task-status--${task.status}`}>
                      {task.status === 'todo' && 'To Do'}
                      {task.status === 'in_progress' && 'In Progress'}
                      {task.status === 'on_hold' && 'On Hold'}
                      {task.status === 'completed' && 'Completed'}
                      {task.status === 'cancelled' && 'Cancelled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedTasks={filteredTasks.filter(t => selectedTaskIds.includes(t.id))}
        onBulkUpdate={handleBulkUpdate}
      />

      {/* Bulk Actions Bar */}
      {selectedTaskIds.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedTaskIds.length}
          onClearSelection={handleClearSelection}
          onBulkEdit={handleBulkEdit}
          onBulkDelete={handleBulkDelete}
          onBulkStatusChange={handleBulkStatusChange}
        />
      )}
    </div>
  );
};

export default TasksPage;
