// src/components/tasks/TaskDetailModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  X, FileText, Users, CalendarIcon, Clock, Flag, CheckSquare, MessageSquare,
  Edit2, Trash2, Check, Plus, Send, LinkIcon, Workflow
} from 'lucide-react';
import { useTask } from '../../contexts/TaskContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { Timestamp } from 'firebase/firestore';
import './TaskDetailModal.css';

const TaskDetailModal = ({ isOpen, onClose, taskId }) => {
  const { myTasks, teamTasks, updateTask, deleteTask, markTaskComplete, updateSubtaskStatus, addComment, canEditTask, canDeleteTask } = useTask();
  const { userProfile, organization, teamMembers } = useAuth();
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
    sessionId: '',
    workflowId: '',
    workflowStepId: '',
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
        sessionId: task.sessionId || '',
        workflowId: task.workflowId || '',
        workflowStepId: task.workflowStepId || '',
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
    return task.assignedTo.map(id => {
      const member = teamMembers.find(m => m.id === id);
      return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
    }).join(', ');
  };

  // Get session name
  const getSessionName = () => {
    if (!task?.sessionId) return null;
    const session = sessions?.find(s => s.id === task.sessionId);
    return session ? `${session.schoolName} - ${formatDateForDisplay(session.date)}` : task.sessionId;
  };

  // Get workflow name
  const getWorkflowName = () => {
    if (!task?.workflowId) return null;
    const workflow = workflows?.find(w => w.id === task.workflowId);
    return workflow ? workflow.name : task.workflowId;
  };

  // Get initials for avatar
  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  // Get active team members (exclude inactive)
  const activeTeamMembers = teamMembers?.filter(member => member.status !== 'inactive') || [];

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
      // Task will update via real-time listener
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

  // Remove subtask
  const handleRemoveSubtask = (subtaskId) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter(st => st.id !== subtaskId)
    }));
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
      onClose();
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
      onClose();
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
      // Comments will update via real-time listener
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
        sessionId: task.sessionId || '',
        workflowId: task.workflowId || '',
        workflowStepId: task.workflowStepId || '',
        subtasks: task.subtasks || []
      });
    }
    setIsEditing(false);
  };

  if (!isOpen || !task) return null;

  const canEdit = canEditTask(userProfile, task);
  const canDelete = canDeleteTask(userProfile, task);
  const isCompleted = task.status === 'completed';

  const modalContent = (
    <div className="task-detail-modal-panel">
        {/* Header */}
        <div className="task-detail-panel-header">
          <div className="task-detail-panel-header-content">
            <FileText size={20} />
            <h2 className="task-detail-panel-title">{isEditing ? 'Edit Task' : task.title}</h2>
            {isCompleted && (
              <span className="task-detail-badge task-detail-badge--completed">
                <Check size={14} />
                Completed
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="task-detail-panel-close"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="task-detail-tabs">
          <button
            className={`task-detail-tab ${activeTab === 'details' ? 'task-detail-tab--active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            <FileText size={16} />
            Details
          </button>
          <button
            className={`task-detail-tab ${activeTab === 'subtasks' ? 'task-detail-tab--active' : ''}`}
            onClick={() => setActiveTab('subtasks')}
          >
            <CheckSquare size={16} />
            Subtasks
            {task.subtasks?.length > 0 && (
              <span className="task-detail-tab-count">{task.subtasks.length}</span>
            )}
          </button>
          <button
            className={`task-detail-tab ${activeTab === 'comments' ? 'task-detail-tab--active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            <MessageSquare size={16} />
            Comments
            {task.commentCount > 0 && (
              <span className="task-detail-tab-count">{task.commentCount}</span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="task-detail-panel-body">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="task-detail-content">
              {isEditing ? (
                // Edit Mode
                <div className="task-detail-edit-form">
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

                  {/* Timeline & Priority */}
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

                  {/* Due Date & Estimated Hours */}
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
                <div className="task-detail-view">
                  {/* Description */}
                  {task.description && (
                    <div className="task-detail-section">
                      <div className="task-detail-section-header">
                        <FileText size={16} />
                        <h3>Description</h3>
                      </div>
                      <p className="task-detail-description">{task.description}</p>
                    </div>
                  )}

                  {/* Details Grid */}
                  <div className="task-detail-section">
                    <div className="task-detail-section-header">
                      <Flag size={16} />
                      <h3>Details</h3>
                    </div>
                    <div className="task-detail-grid">
                      <div className="task-detail-field">
                        <span className="task-detail-label">Priority</span>
                        <span className={`task-detail-priority task-detail-priority--${task.priority}`}>
                          <div className={`priority-indicator priority-indicator--${task.priority}`}></div>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                      </div>

                      <div className="task-detail-field">
                        <span className="task-detail-label">Status</span>
                        <span className={`task-detail-status task-detail-status--${task.status}`}>
                          {task.status === 'in_progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                        </span>
                      </div>

                      <div className="task-detail-field">
                        <span className="task-detail-label">Due Date</span>
                        <span className="task-detail-value">
                          <CalendarIcon size={14} />
                          {formatDateForDisplay(task.dueDate)}
                        </span>
                      </div>

                      <div className="task-detail-field">
                        <span className="task-detail-label">Estimated Hours</span>
                        <span className="task-detail-value">
                          <Clock size={14} />
                          {task.estimatedHours || 0}h
                        </span>
                      </div>

                      <div className="task-detail-field">
                        <span className="task-detail-label">Type</span>
                        <span className="task-detail-value">
                          {task.type === 'general' && <FileText size={14} />}
                          {task.type === 'session' && <LinkIcon size={14} />}
                          {task.type === 'workflow' && <Workflow size={14} />}
                          {task.type === 'general' ? 'General Task' : task.type === 'session' ? 'Session Task' : 'Workflow Task'}
                        </span>
                      </div>

                      <div className="task-detail-field">
                        <span className="task-detail-label">Assigned To</span>
                        <span className="task-detail-value">
                          <Users size={14} />
                          {getAssigneeNames()}
                        </span>
                      </div>

                      {task.sessionId && (
                        <div className="task-detail-field task-detail-field--full">
                          <span className="task-detail-label">Session</span>
                          <span className="task-detail-value">
                            <LinkIcon size={14} />
                            {getSessionName()}
                          </span>
                        </div>
                      )}

                      {task.workflowId && (
                        <div className="task-detail-field task-detail-field--full">
                          <span className="task-detail-label">Workflow</span>
                          <span className="task-detail-value">
                            <Workflow size={14} />
                            {getWorkflowName()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="task-detail-metadata">
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
            <div className="task-detail-content">
              <div className="task-detail-section">
                <div className="task-detail-section-header">
                  <CheckSquare size={16} />
                  <h3>Subtasks</h3>
                  {task.subtasks?.length > 0 && (
                    <span className="task-detail-subtask-count">
                      {task.subtasks.filter(st => st.completed).length} / {task.subtasks.length} completed
                    </span>
                  )}
                </div>

                {/* Subtask List */}
                {task.subtasks?.length > 0 ? (
                  <div className="task-detail-subtask-list">
                    {task.subtasks.map(subtask => (
                      <div
                        key={subtask.id}
                        className={`task-detail-subtask-item ${subtask.completed ? 'task-detail-subtask-item--completed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={subtask.completed}
                          onChange={() => handleSubtaskToggle(subtask.id)}
                          className="task-detail-subtask-checkbox"
                          disabled={loading || !canEdit}
                        />
                        <span className="task-detail-subtask-title">{subtask.title}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="task-detail-empty">No subtasks yet</p>
                )}

                {/* Add Subtask (only in edit mode or if can edit) */}
                {(isEditing || canEdit) && (
                  <div className="task-detail-subtask-add">
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
                      className="btn btn--secondary"
                      disabled={loading || !newSubtask.trim()}
                    >
                      <Plus size={16} />
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Comments Tab */}
          {activeTab === 'comments' && (
            <div className="task-detail-content">
              <div className="task-detail-section">
                <div className="task-detail-section-header">
                  <MessageSquare size={16} />
                  <h3>Comments</h3>
                </div>

                {/* Comment Input */}
                <div className="task-detail-comment-input">
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
                    className="btn btn--primary"
                    disabled={loading || !newComment.trim()}
                  >
                    <Send size={16} />
                    Post Comment
                  </button>
                </div>

                {/* Comments List */}
                {comments.length > 0 ? (
                  <div className="task-detail-comments-list">
                    {comments.map(comment => (
                      <div key={comment.id} className="task-detail-comment">
                        <div className="task-detail-comment-header">
                          <strong>{comment.userName}</strong>
                          <span>{formatDateForDisplay(comment.createdAt)}</span>
                        </div>
                        <p className="task-detail-comment-text">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="task-detail-empty">No comments yet</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="task-detail-panel-footer">
          {isEditing ? (
            // Edit mode buttons
            <>
              <button
                onClick={handleCancelEdit}
                className="btn btn--secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn btn--primary"
                disabled={loading || !formData.title.trim()}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            // View mode buttons
            <>
              <div className="task-detail-panel-footer-left">
                {canDelete && !isCompleted && (
                  <button
                    onClick={handleDelete}
                    className="btn btn--danger"
                    disabled={loading}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                )}
              </div>
              <div className="task-detail-panel-footer-right">
                {!isCompleted && canEdit && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn btn--secondary"
                      disabled={loading}
                    >
                      <Edit2 size={16} />
                      Edit
                    </button>
                    <button
                      onClick={handleMarkComplete}
                      className="btn btn--primary"
                      disabled={loading}
                    >
                      <Check size={16} />
                      Mark Complete
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default TaskDetailModal;
