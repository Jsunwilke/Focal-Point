// src/components/tasks/TaskPanel.js
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, ListTodo, ChevronDown, Search } from 'lucide-react';
import { useTask } from '../../contexts/TaskContext';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { useNavigate, useLocation } from 'react-router-dom';
import TaskPanelItem from './TaskPanelItem';
import TaskPanelDetail from './TaskPanelDetail';
import CreateTaskModal from './CreateTaskModal';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { batchUpdateTaskOrders } from '../../firebase/tasks';
import { TASK_STATUS } from '../../constants/taskStatus';
import './TaskPanel.css';

const TaskPanel = () => {
  const {
    isPanelOpen,
    closePanel,
    panelFilter,
    setPanelFilter,
    getPanelTasks,
    markTaskComplete,
    duplicateTask,
    deleteTask,
    updateTask,
    myTasks,
    teamTasks,
    canViewTeamTasks,
    selectedTaskId,
    setSelectedTaskId,
    clearSelectedTask
  } = useTask();

  const { userProfile } = useAuth();
  const { teamMembers } = useDataCache();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('me'); // 'me' | 'all' | specific userId
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [optimisticOrder, setOptimisticOrder] = useState(null); // Store optimistic order during drag
  const userDropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const panelRef = useRef(null);

  // Check if user is manager or admin
  const isManagerOrAdmin = userProfile?.role === 'admin' || userProfile?.role === 'manager';

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  // Close panel on click outside (only on tasks page)
  useEffect(() => {
    const isTasksPage = location.pathname === '/tasks';

    const handleClickOutsidePanel = (event) => {
      // Only close if we're on tasks page and panel is open
      if (isTasksPage && panelRef.current && !panelRef.current.contains(event.target)) {
        // Don't close if clicking on a modal or dropdown
        const isModalClick = event.target.closest('.modal-overlay') ||
                             event.target.closest('.create-task-modal') ||
                             event.target.closest('.create-task-modal-overlay') ||
                             event.target.closest('.create-task-modal-container') ||
                             event.target.closest('.bulk-edit-modal');
        if (!isModalClick) {
          closePanel();
        }
      }
    };

    if (isPanelOpen && isTasksPage) {
      // Small delay to prevent closing immediately if panel was just opened by click
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutsidePanel);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutsidePanel);
      };
    }
  }, [isPanelOpen, location.pathname, closePanel]);

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
            return task.status === TASK_STATUS.COMPLETED;
          case 'today':
            if (task.status === TASK_STATUS.COMPLETED || task.status === TASK_STATUS.CANCELLED) return false;
            if (!task.dueDate) return false;
            const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
            return dueDate < tomorrow;
          case 'urgent':
            if (task.status === TASK_STATUS.COMPLETED || task.status === TASK_STATUS.CANCELLED) return false;
            return task.priority === 'urgent' || task.priority === 'high';
          case 'all':
          default:
            return task.status !== TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.CANCELLED;
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
            return task.status === TASK_STATUS.COMPLETED;
          case 'today':
            if (task.status === TASK_STATUS.COMPLETED || task.status === TASK_STATUS.CANCELLED) return false;
            if (!task.dueDate) return false;
            const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
            return dueDate < tomorrow;
          case 'urgent':
            if (task.status === TASK_STATUS.COMPLETED || task.status === TASK_STATUS.CANCELLED) return false;
            return task.priority === 'urgent' || task.priority === 'high';
          case 'all':
          default:
            return task.status !== TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.CANCELLED;
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

  // Get assignee names for search
  const getTaskAssigneeNames = (task) => {
    if (!task?.assignedTo || task.assignedTo.length === 0) return '';
    if (!teamMembers || teamMembers.length === 0) return '';
    return task.assignedTo
      .map(id => {
        const member = teamMembers.find(m => m.id === id);
        return member ? `${member.firstName} ${member.lastName}` : '';
      })
      .join(' ');
  };

  // Apply search filtering
  const filteredTasks = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return panelTasks;

    const query = debouncedSearchQuery.toLowerCase().trim();

    return panelTasks.filter(task => {
      const titleMatch = task.title?.toLowerCase().includes(query);
      const descMatch = task.description?.toLowerCase().includes(query);
      const assigneeMatch = getTaskAssigneeNames(task).toLowerCase().includes(query);

      return titleMatch || descMatch || assigneeMatch;
    });
  }, [panelTasks, debouncedSearchQuery, teamMembers]);

  // Sort tasks by order (for drag & drop) or default sorting
  const sortedTasks = useMemo(() => {
    // If we have optimistic order (during drag), use it
    if (optimisticOrder) {
      return optimisticOrder;
    }

    return [...filteredTasks].sort((a, b) => {
      // Use order if available, otherwise use fallback of 999999 to put at end
      const orderA = a.order ?? 999999;
      const orderB = b.order ?? 999999;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // If both don't have order, sort by createdAt
      const timeA = a.createdAt?.toMillis?.() ?? 0;
      const timeB = b.createdAt?.toMillis?.() ?? 0;
      return timeB - timeA; // Newest first
    });
  }, [filteredTasks, optimisticOrder]);

  const handleTaskClick = (taskId) => {
    setSelectedTaskId(taskId);
  };

  const handleBackToList = () => {
    clearSelectedTask();
  };

  const handleToggleComplete = async (taskId) => {
    try {
      await markTaskComplete(taskId);
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const handleQuickAction = async (taskId, action) => {
    if (action === 'duplicate') {
      try {
        const newTask = await duplicateTask(taskId);
        // Open the duplicated task in detail view
        setSelectedTaskId(newTask.id);
      } catch (error) {
        console.error('Failed to duplicate task:', error);
      }
    } else if (action === 'delete') {
      // Confirm before deleting
      if (window.confirm('Are you sure you want to delete this task?')) {
        try {
          await deleteTask(taskId);
        } catch (error) {
          console.error('Failed to delete task:', error);
        }
      }
    } else {
      // For other actions (add-deadline, add-subtask), open task detail view
      setSelectedTaskId(taskId);
    }
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

  // Handle drag and drop reordering
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    const items = Array.from(sortedTasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Set optimistic order immediately for smooth UX
    setOptimisticOrder(items);

    try {
      // Prepare batch updates for tasks that need order changes
      const updates = items
        .map((task, index) => {
          // Only update if order has changed
          if (task.order !== index) {
            return {
              taskId: task.id,
              order: index
            };
          }
          return null;
        })
        .filter(update => update !== null);

      // Use batch operation for efficient Firestore updates
      if (updates.length > 0) {
        await batchUpdateTaskOrders(updates);
      }

      // Clear optimistic order after a delay to allow Firebase to sync
      setTimeout(() => {
        setOptimisticOrder(null);
      }, 500);
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
      // Clear optimistic order on error to revert to real data
      setOptimisticOrder(null);
    }
  };

  // Keyboard shortcuts for task panel
  useKeyboardShortcuts({
    // Escape: Close panel or go back to list
    'escape': () => {
      if (selectedTaskId) {
        handleBackToList();
      } else if (isPanelOpen) {
        closePanel();
      }
    },
    // /: Focus search
    '/': () => {
      if (!selectedTaskId && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    },
    // Numbers 1-4: Switch filter tabs
    '1': () => !selectedTaskId && setPanelFilter('all'),
    '2': () => !selectedTaskId && setPanelFilter('today'),
    '3': () => !selectedTaskId && setPanelFilter('urgent'),
    '4': () => !selectedTaskId && setPanelFilter('completed')
  }, {
    enabled: isPanelOpen,
    allowInInputs: ['escape']
  });

  if (!isPanelOpen) return null;

  const panelContent = (
    <div className="task-panel" ref={panelRef}>
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
                      <span>{getSelectedUserName()} ({filteredTasks.length})</span>
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
                  <span>Tasks ({filteredTasks.length})</span>
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

            {/* Search */}
            <div className="task-panel__search">
              <div className="task-panel__search-wrapper">
                <Search size={16} className="task-panel__search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="task-panel__search-input"
                  aria-label="Search tasks"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="task-panel__search-clear"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {debouncedSearchQuery && (
                <div className="task-panel__search-results" role="status" aria-live="polite">
                  {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} found
                </div>
              )}
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
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="task-list">
              {(provided, snapshot) => (
                <div
                  className={`task-panel__list ${snapshot.isDraggingOver ? 'task-panel__list--dragging' : ''}`}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {sortedTasks.length === 0 ? (
                    <div className="task-panel__empty">
                      <ListTodo size={48} className="task-panel__empty-icon" />
                      <p className="task-panel__empty-text">
                        {debouncedSearchQuery ?
                          `No tasks found for "${debouncedSearchQuery}"` :
                          panelFilter === 'all' ? 'No tasks yet' :
                          panelFilter === 'completed' ? 'No completed tasks' :
                          `No ${panelFilter} tasks`
                        }
                      </p>
                      {!debouncedSearchQuery && panelFilter !== 'completed' && (
                        <button
                          className="task-panel__empty-btn"
                          onClick={handleNewTaskClick}
                        >
                          Create your first task
                        </button>
                      )}
                    </div>
                  ) : (
                    sortedTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.8 : 1
                            }}
                          >
                            <TaskPanelItem
                              task={task}
                              onClick={() => handleTaskClick(task.id)}
                              onToggleComplete={handleToggleComplete}
                              onQuickAction={handleQuickAction}
                              isDragging={snapshot.isDragging}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Footer */}
          {filteredTasks.length > 0 && (
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
