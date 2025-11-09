// src/pages/TasksPage.js
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTask } from '../contexts/TaskContext';
import { useAuth } from '../contexts/AuthContext';
import { ListTodo, Plus, Search, Filter, X, CheckSquare, Clock, AlertCircle } from 'lucide-react';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import './TasksPage.css';

const TasksPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { myTasks, teamTasks, canViewTeamTasks, loading, openPanel } = useTask();
  const { userProfile } = useAuth();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: ['todo', 'in_progress'],
    assignee: 'me', // 'me' | 'all' | specific userId
    priority: [],
    type: []
  });

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
    setFilters({
      status: ['todo', 'in_progress'],
      assignee: 'me',
      priority: [],
      type: []
    });
    setSearchQuery('');
  };

  // Handle task click
  const handleTaskClick = (taskId) => {
    setSelectedTaskId(taskId);
    // TODO: Open TaskDetailModal
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
                  checked={filters.status.includes('blocked')}
                  onChange={() => toggleStatusFilter('blocked')}
                />
                <span>Blocked</span>
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

        {/* Task List */}
        <div className="tasks-page__main">
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
          ) : (
            <div className="tasks-page__list">
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  className={`tasks-page__task ${isOverdue(task) ? 'tasks-page__task--overdue' : ''} ${task.status === 'completed' ? 'tasks-page__task--completed' : ''}`}
                  onClick={() => handleTaskClick(task.id)}
                >
                  <div className="tasks-page__task-left">
                    <div
                      className="tasks-page__task-priority"
                      style={{ backgroundColor: getPriorityColor(task.priority) }}
                      title={`${task.priority} priority`}
                    />
                    <div className="tasks-page__task-content">
                      <h3 className="tasks-page__task-title">{task.title}</h3>
                      <div className="tasks-page__task-meta">
                        {task.type && (
                          <span className="tasks-page__task-type">{task.type}</span>
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
                      {task.status === 'blocked' && 'Blocked'}
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
    </div>
  );
};

export default TasksPage;
