// src/components/tasks/TaskPanelDetail.js
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, FileText, Users, CalendarIcon, Clock, Flag, CheckSquare, MessageSquare,
  Edit2, Trash2, Check, Plus, Send, LinkIcon, Workflow
} from 'lucide-react';
import { useTask } from '../../contexts/TaskContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { Timestamp } from 'firebase/firestore';
import './TaskPanelDetail.css';

const TaskPanelDetail = ({ taskId, onBack }) => {
  const { myTasks, teamTasks, updateTask, deleteTask, markTaskComplete, updateSubtaskStatus, addComment, canEditTask, canDeleteTask } = useTask();
  const { userProfile, organization } = useAuth();
  const { teamMembers } = useDataCache();
  const { sessions, workflows } = useWorkflow();

  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');

  // Find the task from either myTasks or teamTasks
  const task = [...myTasks, ...teamTasks].find(t => t.id === taskId);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'general',
    priority: 'medium',
    status: 'pending',
    assignedTo: [],
    dueDate: '',
    estimatedHours: 0,
    sessionID: '',
    workflowID: '',
    workflowStepID: '',
    subtasks: []
  });

  // Load task data into form when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        type: task.type || 'general',
        priority: task.priority || 'medium',
        status: task.status || 'pending',
        assignedTo: task.assignedTo || [],
        dueDate: task.dueDate ? formatDateForInput(task.dueDate) : '',
        estimatedHours: task.estimatedHours || 0,
        sessionID: task.sessionID || '',
        workflowID: task.workflowID || '',
        workflowStepID: task.workflowStepID || '',
        subtasks: task.subtasks || []
      });
    }
  }, [task]);

  // Format Firestore timestamp for date input
  const formatDateForInput = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toISOString().split('T')[0];
  };

  // Format date for display
  const formatDateForDisplay = (timestamp) => {
    if (!timestamp) return 'No due date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get assignee names
  const getAssigneeNames = () => {
    if (!task?.assignedTo || task.assignedTo.length === 0) return 'Unassigned';
    if (!teamMembers || teamMembers.length === 0) return 'Loading...';
    return task.assignedTo.map(id => {
      const member = teamMembers.find(m => m.id === id);
      return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
    }).join(', ');
  };

  // Get session name
  const getSessionName = () => {
    if (!task?.sessionID) return null;
    if (!sessions) return task.sessionID;
    const session = sessions.find(s => s.id === task.sessionID);
    return session ? `${session.schoolName} - ${formatDateForDisplay(session.date)}` : task.sessionID;
  };

  // Get workflow name
  const getWorkflowName = () => {
    if (!task?.workflowID) return null;
    if (!workflows) return task.workflowID;
    const workflow = workflows.find(w => w.id === task.workflowID);
    return workflow ? workflow.name : task.workflowID;
  };

  // Get initials for avatar
  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  // Get active team members (exclude inactive)
  const activeTeamMembers = (teamMembers && Array.isArray(teamMembers))
    ? teamMembers.filter(member => member.status !== 'inactive')
    : [];

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  // Handle assignee toggle
  const handleAssigneeToggle = (memberId) => {
    setFormData(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(memberId)
        ? prev.assignedTo.filter(id => id !== memberId)
        : [...prev.assignedTo, memberId]
    }));
  };

  // Handle subtask completion toggle
  const handleSubtaskToggle = async (subtaskId) => {
    const subtask = task.subtasks.find(st => st.id === subtaskId);
    if (!subtask) return;

    try {
      await updateSubtaskStatus(task.id, subtaskId, !subtask.completed);
    } catch (error) {
      console.error('Error toggling subtask:', error);
    }
  };

  // Add new subtask
  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;

    const subtask = {
      id: `subtask_${Date.now()}`,
      title: newSubtask.trim(),
      completed: false,
      createdAt: Timestamp.now()
    };

    setFormData(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, subtask]
    }));

    setNewSubtask('');
  };

  // Save task updates
  const handleSave = async () => {
    setLoading(true);
    try {
      const updates = {
        ...formData,
        dueDate: formData.dueDate ? Timestamp.fromDate(new Date(formData.dueDate)) : null
      };

      await updateTask(task.id, updates);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle task completion
  const handleMarkComplete = async () => {
    setLoading(true);
    try {
      await markTaskComplete(task.id);
      onBack();
    } catch (error) {
      console.error('Error marking task complete:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle task deletion
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    setLoading(true);
    try {
      await deleteTask(task.id);
      onBack();
    } catch (error) {
      console.error('Error deleting task:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle comment submission
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      await addComment(task.id, {
        text: newComment.trim(),
        attachments: [],
        mentions: []
      });

      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        type: task.type || 'general',
        priority: task.priority || 'medium',
        status: task.status || 'pending',
        assignedTo: task.assignedTo || [],
        dueDate: task.dueDate ? formatDateForInput(task.dueDate) : '',
        estimatedHours: task.estimatedHours || 0,
        sessionID: task.sessionID || '',
        workflowID: task.workflowID || '',
        workflowStepID: task.workflowStepID || '',
        subtasks: task.subtasks || []
      });
    }
    setIsEditing(false);
  };

  if (!task) return null;

  const canEdit = canEditTask(userProfile, task);
  const canDelete = canDeleteTask(userProfile, task);
  const isCompleted = task.status === 'completed';

  return (
    <div className="task-panel-detail">
      {/* Header */}
      <div className="task-panel-detail__header">
        <button
          onClick={onBack}
          className="task-panel-detail__back-btn"
          disabled={loading}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="task-panel-detail__header-content">
          <FileText size={18} />
          <h2 className="task-panel-detail__title">{isEditing ? 'Edit Task' : task.title}</h2>
          {isCompleted && (
            <span className="task-panel-detail__badge task-panel-detail__badge--completed">
              <Check size={12} />
              Done
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="task-panel-detail__tabs">
        <button
          className={`task-panel-detail__tab ${activeTab === 'details' ? 'task-panel-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          <FileText size={14} />
          Details
        </button>
        <button
          className={`task-panel-detail__tab ${activeTab === 'subtasks' ? 'task-panel-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('subtasks')}
        >
          <CheckSquare size={14} />
          Subtasks
          {task.subtasks?.length > 0 && (
            <span className="task-panel-detail__tab-count">{task.subtasks.length}</span>
          )}
        </button>
        <button
          className={`task-panel-detail__tab ${activeTab === 'comments' ? 'task-panel-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          <MessageSquare size={14} />
          Comments
          {task.commentCount > 0 && (
            <span className="task-panel-detail__tab-count">{task.commentCount}</span>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="task-panel-detail__body">
        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="task-panel-detail__content">
            {isEditing ? (
              // Edit Mode
              <div className="task-panel-detail__edit-form">
                {/* Title */}
                <div className="form-group">
                  <label htmlFor="title" className="form-label form-label--title">
                    Task Title <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="form-input"
                    disabled={loading}
                    required
                  />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label htmlFor="description" className="form-label">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="form-textarea"
                    rows={4}
                    disabled={loading}
                  />
                </div>

                {/* Priority & Status */}
                <div className="form-row form-row--two">
                  <div className="form-group">
                    <label htmlFor="priority" className="form-label">Priority</label>
                    <div className="priority-select-wrapper">
                      <div className={`priority-indicator priority-indicator--${formData.priority}`}></div>
                      <select
                        id="priority"
                        name="priority"
                        value={formData.priority}
                        onChange={handleChange}
                        className="form-select"
                        disabled={loading}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="status" className="form-label">Status</label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="form-select"
                      disabled={loading}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {/* Due Date & Est Hours */}
                <div className="form-row form-row--two">
                  <div className="form-group">
                    <label htmlFor="dueDate" className="form-label">Due Date</label>
                    <input
                      type="date"
                      id="dueDate"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleChange}
                      className="form-input"
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="estimatedHours" className="form-label">Est. Hours</label>
                    <input
                      type="number"
                      id="estimatedHours"
                      name="estimatedHours"
                      value={formData.estimatedHours}
                      onChange={handleChange}
                      className="form-input"
                      min="0"
                      step="0.5"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Assignees */}
                <div className="form-group">
                  <label className="form-label">Assigned To</label>
                  <div className="assignee-grid">
                    {activeTeamMembers.map(member => {
                      const isSelected = formData.assignedTo.includes(member.id);
                      return (
                        <div
                          key={member.id}
                          className={`assignee-card ${isSelected ? 'assignee-card--selected' : ''}`}
                          onClick={() => !loading && handleAssigneeToggle(member.id)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            disabled={loading}
                          />
                          <div className="assignee-avatar">
                            {member.photoURL ? (
                              <img src={member.photoURL} alt={`${member.firstName} ${member.lastName}`} />
                            ) : (
                              getInitials(member.firstName, member.lastName)
                            )}
                          </div>
                          <div className="assignee-name">
                            {member.firstName}<br />{member.lastName}
                          </div>
                          {isSelected && (
                            <div className="assignee-check">
                              <Check size={12} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              // View Mode
              <div className="task-panel-detail__view">
                {/* Description */}
                {task.description && (
                  <div className="task-panel-detail__section">
                    <div className="task-panel-detail__section-header">
                      <FileText size={14} />
                      <h3>Description</h3>
                    </div>
                    <p className="task-panel-detail__description">{task.description}</p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="task-panel-detail__section">
                  <div className="task-panel-detail__section-header">
                    <Flag size={14} />
                    <h3>Details</h3>
                  </div>
                  <div className="task-panel-detail__grid">
                    <div className="task-panel-detail__field">
                      <span className="task-panel-detail__label">Priority</span>
                      <span className={`task-panel-detail__priority task-panel-detail__priority--${task.priority}`}>
                        <div className={`priority-indicator priority-indicator--${task.priority}`}></div>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </span>
                    </div>

                    <div className="task-panel-detail__field">
                      <span className="task-panel-detail__label">Status</span>
                      <span className={`task-panel-detail__status task-panel-detail__status--${task.status}`}>
                        {task.status === 'in_progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                      </span>
                    </div>

                    <div className="task-panel-detail__field">
                      <span className="task-panel-detail__label">Due Date</span>
                      <span className="task-panel-detail__value">
                        <CalendarIcon size={12} />
                        {formatDateForDisplay(task.dueDate)}
                      </span>
                    </div>

                    <div className="task-panel-detail__field">
                      <span className="task-panel-detail__label">Est. Hours</span>
                      <span className="task-panel-detail__value">
                        <Clock size={12} />
                        {task.estimatedHours || 0}h
                      </span>
                    </div>

                    <div className="task-panel-detail__field">
                      <span className="task-panel-detail__label">Assigned To</span>
                      <span className="task-panel-detail__value">
                        <Users size={12} />
                        {getAssigneeNames()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="task-panel-detail__metadata">
                  <span>Created {formatDateForDisplay(task.createdAt)}</span>
                  {task.updatedAt && task.updatedAt !== task.createdAt && (
                    <span>• Updated {formatDateForDisplay(task.updatedAt)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Subtasks Tab */}
        {activeTab === 'subtasks' && (
          <div className="task-panel-detail__content">
            <div className="task-panel-detail__section">
              <div className="task-panel-detail__section-header">
                <CheckSquare size={14} />
                <h3>Subtasks</h3>
                {task.subtasks?.length > 0 && (
                  <span className="task-panel-detail__subtask-count">
                    {task.subtasks.filter(st => st.completed).length} / {task.subtasks.length} completed
                  </span>
                )}
              </div>

              {/* Subtask List */}
              {task.subtasks?.length > 0 ? (
                <div className="task-panel-detail__subtask-list">
                  {task.subtasks.map(subtask => (
                    <div
                      key={subtask.id}
                      className={`task-panel-detail__subtask-item ${subtask.completed ? 'task-panel-detail__subtask-item--completed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={subtask.completed}
                        onChange={() => handleSubtaskToggle(subtask.id)}
                        className="task-panel-detail__subtask-checkbox"
                        disabled={loading || !canEdit}
                      />
                      <span className="task-panel-detail__subtask-title">{subtask.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="task-panel-detail__empty">No subtasks yet</p>
              )}

              {/* Add Subtask */}
              {(isEditing || canEdit) && (
                <div className="task-panel-detail__subtask-add">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddSubtask()}
                    placeholder="Add a subtask..."
                    className="subtask-input"
                    disabled={loading}
                  />
                  <button
                    onClick={handleAddSubtask}
                    className="btn btn--secondary btn--sm"
                    disabled={loading || !newSubtask.trim()}
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <div className="task-panel-detail__content">
            <div className="task-panel-detail__section">
              <div className="task-panel-detail__section-header">
                <MessageSquare size={14} />
                <h3>Comments</h3>
              </div>

              {/* Comment Input */}
              <div className="task-panel-detail__comment-input">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="form-textarea"
                  rows={3}
                  disabled={loading}
                />
                <button
                  onClick={handleSubmitComment}
                  className="btn btn--primary btn--sm"
                  disabled={loading || !newComment.trim()}
                >
                  <Send size={14} />
                  Post
                </button>
              </div>

              {/* Comments List */}
              {comments.length > 0 ? (
                <div className="task-panel-detail__comments-list">
                  {comments.map(comment => (
                    <div key={comment.id} className="task-panel-detail__comment">
                      <div className="task-panel-detail__comment-header">
                        <strong>{comment.userName}</strong>
                        <span>{formatDateForDisplay(comment.createdAt)}</span>
                      </div>
                      <p className="task-panel-detail__comment-text">{comment.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="task-panel-detail__empty">No comments yet</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="task-panel-detail__footer">
        {isEditing ? (
          // Edit mode buttons
          <>
            <button
              onClick={handleCancelEdit}
              className="btn btn--secondary btn--sm"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn btn--primary btn--sm"
              disabled={loading || !formData.title.trim()}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </>
        ) : (
          // View mode buttons
          <>
            <div className="task-panel-detail__footer-left">
              {canDelete && !isCompleted && (
                <button
                  onClick={handleDelete}
                  className="btn btn--danger btn--sm"
                  disabled={loading}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </div>
            <div className="task-panel-detail__footer-right">
              {!isCompleted && canEdit && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn btn--secondary btn--sm"
                    disabled={loading}
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                  <button
                    onClick={handleMarkComplete}
                    className="btn btn--primary btn--sm"
                    disabled={loading}
                  >
                    <Check size={14} />
                    Complete
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TaskPanelDetail;
