// src/components/tasks/TaskPanelDetail.js
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, FileText, Users, CalendarIcon, Clock, Flag, CheckSquare, MessageSquare,
  Edit2, Trash2, Check, Plus, Send, LinkIcon, Workflow, Paperclip, Eye, EyeOff, X, ChevronDown
} from 'lucide-react';
import { useTask } from '../../contexts/TaskContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { Timestamp } from 'firebase/firestore';
import DatePickerWithPresets from '../shared/DatePickerWithPresets';
import RichTextEditor from '../shared/RichTextEditor';
import ActivityLog from './ActivityLog';
import FileUploadButton from '../shared/FileUploadButton';
import AttachmentList from './AttachmentList';
import TaskTimeTracking from './TaskTimeTracking';
import TaskTimeCounter from './TaskTimeCounter';
import MentionTextarea from './MentionTextarea';
import MentionRenderer from './MentionRenderer';
import TaskDependencyManager from './TaskDependencyManager';
import attachmentsService from '../../firebase/attachments';
import { attachmentCacheService } from '../../services/attachmentCacheService';
import { taskCommentsCacheService } from '../../services/taskCommentsCacheService';
import { readCounter } from '../../services/readCounter';
import { logActivity, ACTIVITY_TYPES } from '../../firebase/activity';
import { getCurrentTimeEntry, updateTimeEntryTask, clockIn, clockOutTaskTimeEntry } from '../../firebase/firestore';
import { getTaskComments, subscribeToTaskComments } from '../../firebase/tasks';
import './TaskPanelDetail.css';

const TaskPanelDetail = ({ taskId, onBack }) => {
  const { myTasks, teamTasks, updateTask, deleteTask, markTaskComplete, updateSubtaskStatus, addComment, watchTask, unwatchTask, isWatchingTask, canEditTask, canDeleteTask } = useTask();
  const { userProfile, organization } = useAuth();
  const { teamMembers, users } = useDataCache();
  const { sessions, workflows } = useWorkflow();

  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [dropdownDirection, setDropdownDirection] = useState('down');

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

  // Load attachments with cache-first pattern
  useEffect(() => {
    if (!taskId) return;

    const loadAttachments = async () => {
      setLoadingAttachments(true);

      try {
        // Check cache first
        const cachedAttachments = attachmentCacheService.getCachedAttachments(taskId);

        if (cachedAttachments) {
          setAttachments(cachedAttachments);
          readCounter.recordCacheHit('taskAttachments', 'TaskPanelDetail', cachedAttachments.length);
        } else {
          readCounter.recordCacheMiss('taskAttachments', 'TaskPanelDetail');
        }

        // Fetch from Firestore
        const fetchedAttachments = await attachmentsService.getTaskAttachments(taskId);
        setAttachments(fetchedAttachments);

        // Update cache
        attachmentCacheService.setCachedAttachments(taskId, fetchedAttachments);
      } catch (error) {
        console.error('Error loading attachments:', error);
      } finally {
        setLoadingAttachments(false);
      }
    };

    loadAttachments();
  }, [taskId]);

  // Load comments with cache-first pattern and real-time updates
  useEffect(() => {
    if (!taskId) return;

    let unsubscribe = null;

    const loadComments = async () => {
      try {
        // Check cache first
        const cachedComments = taskCommentsCacheService.getCachedComments(taskId);

        if (cachedComments) {
          setComments(cachedComments);
          readCounter.recordCacheHit('taskComments', 'TaskPanelDetail', cachedComments.length);
        } else {
          readCounter.recordCacheMiss('taskComments', 'TaskPanelDetail');
        }

        // Fetch from Firestore
        const fetchedComments = await getTaskComments(taskId);
        setComments(fetchedComments);

        // Update cache
        taskCommentsCacheService.setCachedComments(taskId, fetchedComments);

        // Set up real-time listener for new comments
        const latestTimestamp = taskCommentsCacheService.getLatestCommentTimestamp(taskId);
        unsubscribe = subscribeToTaskComments(taskId, (newComments) => {
          if (newComments && newComments.length > 0) {
            // Append new comments to existing ones
            const updatedComments = taskCommentsCacheService.appendNewComments(taskId, newComments);
            setComments(updatedComments);
          }
        }, latestTimestamp);
      } catch (error) {
        console.error('Error loading comments:', error);
      }
    };

    loadComments();

    // Cleanup listener on unmount or task change
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [taskId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (assigneeDropdownOpen && !event.target.closest('.assignee-select-wrapper')) {
        setAssigneeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [assigneeDropdownOpen]);

  // Calculate dropdown position based on available space
  useEffect(() => {
    if (assigneeDropdownOpen) {
      const trigger = document.querySelector('.assignee-select-trigger');
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = 280; // max-height from CSS

        // Open upward if not enough space below AND more space above
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
          setDropdownDirection('up');
        } else {
          setDropdownDirection('down');
        }
      }
    }
  }, [assigneeDropdownOpen]);

  // Format Firestore timestamp for date input
  const formatDateForInput = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    // Use local date components to avoid timezone conversion
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  // Get priority badge class
  const getPriorityBadgeClass = (priority) => {
    return `task-panel-detail__badge--priority-${priority || 'medium'}`;
  };

  // Get priority label
  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'Urgent';
      case 'high':
        return 'High';
      case 'medium':
        return 'Medium';
      case 'low':
        return 'Low';
      default:
        return 'Medium';
    }
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

  // Handle description change from rich text editor
  const handleDescriptionChange = (content) => {
    setFormData(prev => ({
      ...prev,
      description: content
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
  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;

    const subtask = {
      id: `subtask_${Date.now()}`,
      title: newSubtask.trim(),
      completed: false
    };

    const updatedSubtasks = [...(task.subtasks || []), subtask];

    try {
      await updateTask(task.id, { subtasks: updatedSubtasks });
      setNewSubtask('');
    } catch (error) {
      console.error('Error adding subtask:', error);
    }
  };

  // Remove subtask
  const handleRemoveSubtask = async (subtaskId) => {
    try {
      const updatedSubtasks = task.subtasks.filter(st => st.id !== subtaskId);
      await updateTask(task.id, { subtasks: updatedSubtasks });
    } catch (error) {
      console.error('Error removing subtask:', error);
    }
  };

  // Save task updates
  const handleSave = async () => {
    setLoading(true);
    try {
      const updates = {
        ...formData
      };

      // Parse date as local date to avoid timezone offset issues
      if (formData.dueDate) {
        const [year, month, day] = formData.dueDate.split('-');
        const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
        updates.dueDate = Timestamp.fromDate(localDate);
      } else {
        updates.dueDate = null;
      }

      // Check for status changes and handle time tracking
      const oldStatus = task.status;
      const newStatus = formData.status;

      // Auto-start tracking when moving TO "in_progress"
      if (oldStatus !== 'in_progress' && newStatus === 'in_progress') {
        try {
          // Check if user is already clocked in
          const currentEntry = await getCurrentTimeEntry(userProfile.id, organization.id);

          if (currentEntry) {
            // Update existing time entry to add this taskId
            await updateTimeEntryTask(currentEntry.id, taskId);
          } else {
            // Clock in with this taskId
            await clockIn(userProfile.id, organization.id, null, null, taskId);
          }

          // Log activity
          await logActivity(
            taskId,
            ACTIVITY_TYPES.TIME_LOGGED,
            { action: 'auto_started_tracking' },
            userProfile.id,
            organization.id
          );
        } catch (trackError) {
          console.error('Failed to auto-start tracking:', trackError);
          // Don't fail task update if tracking fails
        }
      }

      // Auto-stop tracking when moving FROM "in_progress"
      if (oldStatus === 'in_progress' && newStatus !== 'in_progress') {
        try {
          await clockOutTaskTimeEntry(userProfile.id, organization.id, taskId);

          // Log activity
          await logActivity(
            taskId,
            ACTIVITY_TYPES.TIME_LOGGED,
            { action: 'auto_stopped_tracking' },
            userProfile.id,
            organization.id
          );
        } catch (trackError) {
          console.error('Failed to auto-stop tracking:', trackError);
          // Don't fail task update if tracking fails
        }
      }

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

  // Extract mentions from comment text
  const extractMentions = (text) => {
    const mentionPattern = /@([A-Z][a-z]+(?: [A-Z][a-z]+)+)/g;
    const mentions = [];
    let match;

    while ((match = mentionPattern.exec(text)) !== null) {
      const mentionName = match[1];
      // Find user by full name
      const user = users?.find(u => `${u.firstName} ${u.lastName}` === mentionName);

      if (user && !mentions.find(m => m.userId === user.id)) {
        mentions.push({
          userId: user.id,
          userName: mentionName
        });
      }
    }

    return mentions;
  };

  // Handle comment submission
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const mentions = extractMentions(newComment.trim());

      await addComment(task.id, {
        text: newComment.trim(),
        attachments: [],
        mentions: mentions
      });

      setNewComment('');

      // Refresh comments list to show the newly added comment
      const updatedComments = await getTaskComments(taskId);
      setComments(updatedComments);
      taskCommentsCacheService.setCachedComments(taskId, updatedComments);
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    setLoading(true);
    try {
      const uploadedAttachments = await attachmentsService.uploadAttachments(
        taskId,
        files,
        userProfile.id,
        organization.id
      );

      // Update state with new attachments
      setAttachments(prev => [...prev, ...uploadedAttachments]);

      // Update cache
      const updatedAttachments = [...attachments, ...uploadedAttachments];
      attachmentCacheService.setCachedAttachments(taskId, updatedAttachments);

      // Log activity for each uploaded attachment
      for (const attachment of uploadedAttachments) {
        await logActivity(
          taskId,
          ACTIVITY_TYPES.ATTACHMENT_UPLOADED,
          {
            fileName: attachment.originalFileName,
            fileSize: attachment.fileSize,
            fileType: attachment.fileType,
            attachmentId: attachment.id
          },
          userProfile.id,
          organization.id
        );
      }
    } catch (error) {
      console.error('Error uploading attachments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle attachment deletion
  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;

    setLoading(true);
    try {
      // Get attachment details before deleting for activity log
      const attachment = attachments.find(att => att.id === attachmentId);

      await attachmentsService.deleteAttachment(attachmentId, taskId, organization.id);

      // Update state
      setAttachments(prev => prev.filter(att => att.id !== attachmentId));

      // Update cache
      const updatedAttachments = attachments.filter(att => att.id !== attachmentId);
      attachmentCacheService.setCachedAttachments(taskId, updatedAttachments);

      // Log activity for attachment deletion
      if (attachment) {
        await logActivity(
          taskId,
          ACTIVITY_TYPES.ATTACHMENT_DELETED,
          {
            fileName: attachment.originalFileName,
            fileSize: attachment.fileSize,
            fileType: attachment.fileType,
            attachmentId: attachment.id
          },
          userProfile.id,
          organization.id
        );
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
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

  // Handle watch/unwatch toggle
  const handleWatchToggle = async () => {
    setLoading(true);
    try {
      const watching = isWatchingTask(task);
      if (watching) {
        await unwatchTask(task.id);
      } else {
        await watchTask(task.id);
      }
    } catch (error) {
      console.error('Error toggling watch:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  const canEdit = canEditTask(userProfile, task);
  const canDelete = canDeleteTask(userProfile, task);
  const isCompleted = task.status === 'completed';
  const isWatching = isWatchingTask(task);

  return (
    <div className="task-panel-detail">
      {/* Header */}
      <div className="task-panel-detail__header">
        <div className="task-panel-detail__header-row">
          <button
            onClick={onBack}
            className="task-panel-detail__back-btn"
            disabled={loading}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="task-panel-detail__header-title">
            <FileText size={18} />
            <h2 className="task-panel-detail__title">{isEditing ? 'Edit Task' : task.title}</h2>
          </div>
        </div>
        {!isEditing && (
          <div className="task-panel-detail__header-badges">
            <span className={`task-panel-detail__badge ${getPriorityBadgeClass(task.priority)}`}>
              <Flag size={12} />
              {getPriorityLabel(task.priority)}
            </span>
            {isCompleted && (
              <span className="task-panel-detail__badge task-panel-detail__badge--completed">
                <Check size={12} />
                Done
              </span>
            )}
            <TaskTimeCounter taskId={taskId} />
            <button
              onClick={handleWatchToggle}
              className={`task-panel-detail__watch-btn ${isWatching ? 'task-panel-detail__watch-btn--watching' : ''}`}
              disabled={loading}
              title={isWatching ? 'Stop watching this task' : 'Watch this task'}
            >
              {isWatching ? <Eye size={18} /> : <EyeOff size={18} />}
              {isWatching ? 'Watching' : 'Watch'}
            </button>
          </div>
        )}
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
        <button
          className={`task-panel-detail__tab ${activeTab === 'activity' ? 'task-panel-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <Clock size={14} />
          Activity
        </button>
        <button
          className={`task-panel-detail__tab ${activeTab === 'attachments' ? 'task-panel-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('attachments')}
        >
          <Paperclip size={14} />
          Attachments
          {attachments.length > 0 && (
            <span className="task-panel-detail__tab-count">{attachments.length}</span>
          )}
        </button>
        <button
          className={`task-panel-detail__tab ${activeTab === 'time' ? 'task-panel-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('time')}
        >
          <Clock size={14} />
          Time
        </button>
        <button
          className={`task-panel-detail__tab ${activeTab === 'dependencies' ? 'task-panel-detail__tab--active' : ''}`}
          onClick={() => setActiveTab('dependencies')}
        >
          <LinkIcon size={14} />
          Dependencies
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
                  <RichTextEditor
                    value={formData.description}
                    onChange={handleDescriptionChange}
                    placeholder="Describe what needs to be done..."
                    disabled={loading}
                    minHeight="150px"
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
                    <DatePickerWithPresets
                      value={formData.dueDate}
                      onChange={(e) => handleChange({ target: { name: 'dueDate', value: e.target.value }})}
                      disabled={loading}
                      placeholder="Select due date"
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
                  <div className="assignee-select-wrapper">
                    <div
                      className={`assignee-select-trigger ${assigneeDropdownOpen ? 'assignee-select-trigger--open' : ''}`}
                      onClick={() => !loading && setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                    >
                      <div className={`assignee-select-value ${formData.assignedTo.length === 0 ? 'assignee-select-value--placeholder' : ''}`}>
                        {formData.assignedTo.length === 0
                          ? 'Select team members...'
                          : formData.assignedTo.length === 1
                          ? activeTeamMembers.find(m => m.id === formData.assignedTo[0])?.firstName + ' ' + activeTeamMembers.find(m => m.id === formData.assignedTo[0])?.lastName
                          : `${formData.assignedTo.length} people selected`
                        }
                      </div>
                      <ChevronDown size={18} className={`assignee-select-icon ${assigneeDropdownOpen ? 'assignee-select-icon--open' : ''}`} />
                    </div>

                    {assigneeDropdownOpen && (
                      <div
                        className={`assignee-dropdown ${dropdownDirection === 'up' ? 'assignee-dropdown--up' : 'assignee-dropdown--down'}`}>
                        {/* Selected members first */}
                        {activeTeamMembers
                          .filter(member => formData.assignedTo.includes(member.id))
                          .map(member => {
                            return (
                              <div
                                key={member.id}
                                className={`assignee-option assignee-option--selected`}
                                onClick={() => !loading && handleAssigneeToggle(member.id)}
                              >
                                <div className="assignee-option-checkbox">
                                  <Check size={12} />
                                </div>
                                <div className="assignee-option-avatar">
                                  {member.photoURL ? (
                                    <img src={member.photoURL} alt={`${member.firstName} ${member.lastName}`} />
                                  ) : (
                                    getInitials(member.firstName, member.lastName)
                                  )}
                                </div>
                                <div className="assignee-option-name">
                                  {member.firstName} {member.lastName}
                                </div>
                              </div>
                            );
                          })}

                        {/* Unselected members */}
                        {activeTeamMembers
                          .filter(member => !formData.assignedTo.includes(member.id))
                          .map(member => {
                            return (
                              <div
                                key={member.id}
                                className={`assignee-option`}
                                onClick={() => !loading && handleAssigneeToggle(member.id)}
                              >
                                <div className="assignee-option-checkbox">
                                </div>
                                <div className="assignee-option-avatar">
                                  {member.photoURL ? (
                                    <img src={member.photoURL} alt={`${member.firstName} ${member.lastName}`} />
                                  ) : (
                                    getInitials(member.firstName, member.lastName)
                                  )}
                                </div>
                                <div className="assignee-option-name">
                                  {member.firstName} {member.lastName}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
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
                    <div className="task-panel-detail__description">
                      <RichTextEditor
                        value={task.description}
                        onChange={() => {}}
                        readOnly={true}
                      />
                    </div>
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
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveSubtask(subtask.id)}
                          className="task-panel-detail__subtask-delete"
                          disabled={loading}
                          title="Delete subtask"
                        >
                          <X size={14} />
                        </button>
                      )}
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
                <MentionTextarea
                  value={newComment}
                  onChange={setNewComment}
                  placeholder="Add a comment... (use @ to mention someone)"
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
                      <p className="task-panel-detail__comment-text">
                        <MentionRenderer text={comment.text} mentions={comment.mentions} />
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="task-panel-detail__empty">No comments yet</p>
              )}
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="task-panel-detail__content">
            <div className="task-panel-detail__section">
              <div className="task-panel-detail__section-header">
                <Clock size={14} />
                <h3>Activity</h3>
              </div>
              <ActivityLog taskId={taskId} />
            </div>
          </div>
        )}

        {/* Attachments Tab */}
        {activeTab === 'attachments' && (
          <div className="task-panel-detail__content">
            <div className="task-panel-detail__section">
              <div className="task-panel-detail__section-header">
                <Paperclip size={14} />
                <h3>Attachments</h3>
              </div>

              {/* Upload Button */}
              {canEdit && (
                <div className="task-panel-detail__attachment-upload">
                  <FileUploadButton
                    onUpload={handleFileUpload}
                    disabled={loading}
                    acceptedTypes={['image/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip']}
                    maxSizeMB={10}
                  />
                </div>
              )}

              {/* Attachments List */}
              {loadingAttachments ? (
                <p className="task-panel-detail__empty">Loading attachments...</p>
              ) : attachments.length > 0 ? (
                <AttachmentList
                  attachments={attachments}
                  onDelete={canEdit ? handleDeleteAttachment : null}
                  readOnly={!canEdit}
                />
              ) : (
                <p className="task-panel-detail__empty">No attachments yet</p>
              )}
            </div>
          </div>
        )}

        {/* Time Tab */}
        {activeTab === 'time' && (
          <div className="task-panel-detail__content">
            <div className="task-panel-detail__section">
              <div className="task-panel-detail__section-header">
                <Clock size={14} />
                <h3>Time Tracking</h3>
              </div>
              <TaskTimeTracking taskId={taskId} />
            </div>
          </div>
        )}

        {/* Dependencies Tab */}
        {activeTab === 'dependencies' && (
          <div className="task-panel-detail__content">
            <div className="task-panel-detail__section">
              <div className="task-panel-detail__section-header">
                <LinkIcon size={14} />
                <h3>Task Dependencies</h3>
              </div>
              <TaskDependencyManager
                taskId={taskId}
                organizationID={organization?.id}
              />
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
