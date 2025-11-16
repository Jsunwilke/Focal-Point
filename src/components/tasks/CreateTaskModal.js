// src/components/tasks/CreateTaskModal.js - Professional Redesign
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  ListTodo,
  Calendar as CalendarIcon,
  Users,
  AlertCircle,
  Plus,
  Trash2,
  CheckSquare,
  Flag,
  FileText,
  Link as LinkIcon,
  Workflow,
  Check,
  ChevronDown,
  Paperclip
} from 'lucide-react';
import { useTask } from '../../contexts/TaskContext';
import DatePickerWithPresets from '../shared/DatePickerWithPresets';
import RichTextEditor from '../shared/RichTextEditor';
import FileUploadButton from '../shared/FileUploadButton';
import AttachmentList from './AttachmentList';
import TaskTemplateSelector from './TaskTemplateSelector';
import RecurringTaskForm from './RecurringTaskForm';
import { useDataCache } from '../../contexts/DataCacheContext';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { TASK_STATUS } from '../../constants/taskStatus';
import { useAuth } from '../../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import attachmentsService from '../../firebase/attachments';
import { createRecurringTask } from '../../firebase/recurringTasks';
import { sanitizeTaskTitle, sanitizeTaskDescription } from '../../utils/sanitize';
import './CreateTaskModal.css';

const CreateTaskModal = ({ isOpen, onClose, prefilledData = {} }) => {
  const { createTask } = useTask();
  const { teamMembers, sessions } = useDataCache();
  const { organizationWorkflows } = useWorkflow();
  const { userProfile, organization } = useAuth();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringConfig, setRecurringConfig] = useState(null);

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

  // Close modal on escape key
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isOpen, loading, onClose]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'general',
    sessionId: '',
    workflowId: '',
    workflowStepId: '',
    assignedTo: [],
    priority: 'medium',
    dueDate: '',
    estimatedHours: '',
    subtasks: []
  });

  // Attachment management - files to upload after task creation
  const [pendingAttachments, setPendingAttachments] = useState([]);

  // Initialize form with prefilled data (only on modal open)
  useEffect(() => {
    if (isOpen && prefilledData && Object.keys(prefilledData).length > 0) {
      setFormData(prev => ({
        ...prev,
        title: prefilledData.title || '',
        description: prefilledData.description || '',
        type: prefilledData.type || 'general',
        sessionId: prefilledData.sessionId || '',
        workflowId: prefilledData.workflowId || '',
        workflowStepId: prefilledData.workflowStepId || '',
        assignedTo: prefilledData.assignedTo || [],
        dueDate: prefilledData.dueDate ? new Date(prefilledData.dueDate).toISOString().split('T')[0] : '',
        priority: prefilledData.priority || 'medium',
        estimatedHours: prefilledData.estimatedHours || ''
      }));
    }
  }, [isOpen]); // Only depend on isOpen, not prefilledData to prevent constant resets

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        title: '',
        description: '',
        type: 'general',
        sessionId: '',
        workflowId: '',
        workflowStepId: '',
        assignedTo: [],
        priority: 'medium',
        dueDate: '',
        estimatedHours: '',
        subtasks: []
      });
      setPendingAttachments([]);
      setErrors({});
      setIsRecurring(false);
      setRecurringConfig(null);
    }
  }, [isOpen]);

  // Get active sessions for dropdown
  const activeSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions
      .filter(session => session.status !== TASK_STATUS.COMPLETED && session.status !== TASK_STATUS.CANCELLED)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [sessions]);

  // Get active workflows for dropdown
  const activeWorkflows = useMemo(() => {
    if (!organizationWorkflows) return [];
    return organizationWorkflows
      .filter(workflow => workflow.status === 'active' || workflow.status === TASK_STATUS.IN_PROGRESS)
      .sort((a, b) => (a.schoolName || '').localeCompare(b.schoolName || ''));
  }, [organizationWorkflows]);

  // Get steps for selected workflow
  const workflowSteps = useMemo(() => {
    if (!formData.workflowId || !activeWorkflows) return [];
    const workflow = activeWorkflows.find(w => w.id === formData.workflowId);
    return workflow?.steps || [];
  }, [formData.workflowId, activeWorkflows]);

  // Active team members for assignment
  const activeTeamMembers = useMemo(() => {
    if (!teamMembers) return [];
    return teamMembers
      .filter(member => member.isActive && !member.isAccountant)
      .sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`;
        const nameB = `${b.firstName} ${b.lastName}`;
        return nameA.localeCompare(nameB);
      });
  }, [teamMembers]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleDescriptionChange = (content) => {
    setFormData(prev => ({
      ...prev,
      description: content
    }));
  };

  const handleTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      type,
      sessionId: type === 'session' ? prev.sessionId : '',
      workflowId: type === 'workflow' ? prev.workflowId : '',
      workflowStepId: type === 'workflow' ? prev.workflowStepId : ''
    }));

    if (errors.sessionId || errors.workflowId || errors.workflowStepId) {
      setErrors(prev => ({
        ...prev,
        sessionId: '',
        workflowId: '',
        workflowStepId: ''
      }));
    }
  };

  const handleAssigneeToggle = (userId) => {
    setFormData(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter(id => id !== userId)
        : [...prev.assignedTo, userId]
    }));
  };

  const handleAddSubtask = () => {
    setFormData(prev => ({
      ...prev,
      subtasks: [
        ...prev.subtasks,
        { id: Date.now().toString(), title: '', completed: false }
      ]
    }));
  };

  const handleSubtaskChange = (subtaskId, value) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.map(subtask =>
        subtask.id === subtaskId ? { ...subtask, title: value } : subtask
      )
    }));
  };

  const handleRemoveSubtask = (subtaskId) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter(subtask => subtask.id !== subtaskId)
    }));
  };

  // Attachment handlers
  const handleFileSelect = (file) => {
    return new Promise((resolve, reject) => {
      try {
        // Validate file
        const validation = attachmentsService.validateFile(file);

        // Check attachment limit
        if (attachmentsService.isAttachmentLimitReached(pendingAttachments)) {
          reject(new Error(`Maximum ${attachmentsService.maxAttachmentsPerTask} attachments allowed per task`));
          return;
        }

        // Add to pending attachments with temporary preview
        const tempAttachment = {
          id: Date.now().toString(),
          file,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          category: validation.category,
          canPreview: validation.canPreview,
          isPending: true,
          uploadedAt: new Date()
        };

        setPendingAttachments(prev => [...prev, tempAttachment]);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  };

  const handleRemovePendingAttachment = (attachmentId) => {
    setPendingAttachments(prev => prev.filter(att => att.id !== attachmentId));
  };

  const handleTemplateSelect = (template) => {
    // Apply template data to form
    setFormData(prev => ({
      ...prev,
      title: template.title || prev.title,
      description: template.description || prev.description,
      type: template.type || prev.type,
      priority: template.priority || prev.priority,
      assignedTo: template.defaultAssignees || prev.assignedTo,
      estimatedHours: template.estimatedHours || prev.estimatedHours,
      subtasks: template.subtasks ? template.subtasks.map((st, idx) => ({
        id: Date.now().toString() + idx,
        title: st,
        completed: false
      })) : prev.subtasks
    }));
    setShowTemplateSelector(false);
  };

  const getInitials = (firstName, lastName) => {
    const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
    return firstInitial + lastInitial || '??';
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Task title is required';
    }

    if (formData.type === 'session' && !formData.sessionId) {
      newErrors.sessionId = 'Please select a session';
    }

    if (formData.type === 'workflow') {
      if (!formData.workflowId) {
        newErrors.workflowId = 'Please select a workflow';
      }
      if (!formData.workflowStepId) {
        newErrors.workflowStepId = 'Please select a workflow step';
      }
    }

    if (formData.estimatedHours && (isNaN(formData.estimatedHours) || parseFloat(formData.estimatedHours) < 0)) {
      newErrors.estimatedHours = 'Estimated hours must be a positive number';
    }

    // Validate due date
    if (formData.dueDate) {
      const [year, month, day] = formData.dueDate.split('-');
      const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 18, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if due date is in the past (only for non-completed tasks)
      if (dueDate < today && formData.status !== TASK_STATUS.COMPLETED) {
        newErrors.dueDate = 'Due date cannot be in the past for pending tasks';
      }

      // Check if due date is too far in the future (more than 2 years)
      const maxFutureDate = new Date();
      maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 2);
      if (dueDate > maxFutureDate) {
        newErrors.dueDate = 'Due date cannot be more than 2 years in the future';
      }
    }

    const emptySubtasks = formData.subtasks.filter(st => !st.title.trim());
    if (emptySubtasks.length > 0) {
      newErrors.subtasks = 'All subtasks must have a title or be removed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const validSubtasks = formData.subtasks.filter(st => st.title.trim());

      const taskData = {
        title: sanitizeTaskTitle(formData.title),
        description: sanitizeTaskDescription(formData.description),
        type: formData.type,
        priority: formData.priority,
        status: TASK_STATUS.TODO,
        assignedTo: formData.assignedTo,
        createdBy: userProfile?.id || userProfile?.uid,
        organizationID: organization?.id,
        subtasks: validSubtasks,
        commentCount: 0
      };

      if (formData.dueDate) {
        // Parse as local date to avoid timezone offset issues
        // Set to 6 PM (18:00) so "due today" means "by end of business day"
        const [year, month, day] = formData.dueDate.split('-');
        const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 18, 0, 0);
        taskData.dueDate = Timestamp.fromDate(localDate);
      }

      if (formData.estimatedHours) {
        taskData.estimatedHours = parseFloat(formData.estimatedHours);
      }

      if (formData.type === 'session' && formData.sessionId) {
        taskData.sessionId = formData.sessionId;
        const session = activeSessions.find(s => s.id === formData.sessionId);
        if (session) {
          taskData.sessionName = session.schoolName || 'Unknown Session';
          taskData.sessionDate = session.date;
        }
      }

      if (formData.type === 'workflow' && formData.workflowId && formData.workflowStepId) {
        taskData.workflowId = formData.workflowId;
        taskData.workflowStepId = formData.workflowStepId;
        const workflow = activeWorkflows.find(w => w.id === formData.workflowId);
        if (workflow) {
          taskData.workflowName = workflow.schoolName || 'Unknown Workflow';
          const step = workflowSteps.find(s => s.id === formData.workflowStepId);
          if (step) {
            taskData.workflowStepName = step.name;
          }
        }
      }

      const newTask = await createTask(taskData);

      // Create recurring task configuration if enabled
      if (isRecurring && recurringConfig) {
        try {
          await createRecurringTask({
            ...recurringConfig,
            taskTemplate: taskData,
            organizationID: organization?.id,
            createdBy: userProfile?.id || userProfile?.uid
          });
        } catch (recurringError) {
          console.error('Error creating recurring task:', recurringError);
          // Don't block task creation if recurring setup fails
        }
      }

      // Upload pending attachments if any
      if (pendingAttachments.length > 0 && newTask && newTask.id) {
        try {
          // Upload attachments in parallel
          const uploadPromises = pendingAttachments.map(attachment =>
            attachmentsService.uploadAttachment(
              attachment.file,
              newTask.id,
              organization.id,
              userProfile?.id || userProfile?.uid,
              () => {} // No progress tracking needed for post-creation uploads
            )
          );

          await Promise.all(uploadPromises);
        } catch (uploadError) {
          console.error('Error uploading attachments:', uploadError);
          // Task was created successfully, just warn about attachments
          // Don't block modal close or show error since task is created
        }
      }

      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
      setErrors({ general: 'Failed to create task. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="create-task-modal-overlay"
      onClick={handleOverlayClick}
    >
      <div
        className="create-task-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="create-task-modal-header">
          <div className="create-task-modal-header-content">
            <h2 className="create-task-modal-title">
              <ListTodo size={20} />
              Create New Task
            </h2>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setShowTemplateSelector(true)}
              disabled={loading}
              style={{ marginLeft: 'auto', marginRight: '0.5rem' }}
            >
              <FileText size={16} />
              Use Template
            </button>
          </div>
          <button
            className="create-task-modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="create-task-modal-body">
          <form onSubmit={handleSubmit} className="create-task-form">
            {errors.general && (
              <div className="error-banner">
                <AlertCircle size={16} />
                {errors.general}
              </div>
            )}

            {/* Basic Info Section */}
            <div className="form-section">
              <div className="form-group">
                <label htmlFor="title" className="form-label form-label--large">
                  Title <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className={`form-input ${errors.title ? 'form-input--error' : ''}`}
                  placeholder="Enter task title..."
                  disabled={loading}
                  autoFocus
                />
                {errors.title && <div className="form-error">{errors.title}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="description" className="form-label">
                  Description
                </label>
                <RichTextEditor
                  value={formData.description}
                  onChange={handleDescriptionChange}
                  placeholder="Describe what needs to be done..."
                  disabled={loading}
                  minHeight="150px"
                />
              </div>
            </div>

            {/* Type Section */}
            <div className="form-section">
              <div className="form-group">
                <label className="form-label">Task Type</label>
                <div className="type-selector">
                <button
                  type="button"
                  className={`type-option ${formData.type === 'general' ? 'type-option--active' : ''}`}
                  onClick={() => !loading && !prefilledData.type && handleTypeChange('general')}
                  disabled={loading || prefilledData.type}
                >
                  <FileText size={18} />
                  General
                </button>
                <button
                  type="button"
                  className={`type-option ${formData.type === 'session' ? 'type-option--active' : ''}`}
                  onClick={() => !loading && !prefilledData.type && handleTypeChange('session')}
                  disabled={loading || prefilledData.type}
                >
                  <CalendarIcon size={18} />
                  Session
                </button>
                <button
                  type="button"
                  className={`type-option ${formData.type === 'workflow' ? 'type-option--active' : ''}`}
                  onClick={() => !loading && !prefilledData.type && handleTypeChange('workflow')}
                  disabled={loading || prefilledData.type}
                >
                  <Workflow size={18} />
                  Workflow
                </button>
              </div>
            </div>
            </div>

            {/* Context Section (Session/Workflow) */}
            {(formData.type === 'session' || formData.type === 'workflow') && (
              <div className="form-section">
                {formData.type === 'session' && (
                  <div className="form-group">
                    <label htmlFor="sessionId" className="form-label">
                      Session <span className="required">*</span>
                    </label>
                    <select
                      id="sessionId"
                      name="sessionId"
                      value={formData.sessionId}
                      onChange={handleChange}
                      className={`form-select ${errors.sessionId ? 'form-input--error' : ''}`}
                      disabled={loading || prefilledData.sessionId}
                    >
                      <option value="">Select a session...</option>
                      {activeSessions.map(session => (
                        <option key={session.id} value={session.id}>
                          {session.schoolName} - {new Date(session.date).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                    {errors.sessionId && <div className="form-error">{errors.sessionId}</div>}
                  </div>
                )}

                {formData.type === 'workflow' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="workflowId" className="form-label">
                        Workflow <span className="required">*</span>
                      </label>
                      <select
                        id="workflowId"
                        name="workflowId"
                        value={formData.workflowId}
                        onChange={handleChange}
                        className={`form-select ${errors.workflowId ? 'form-input--error' : ''}`}
                        disabled={loading || prefilledData.workflowId}
                      >
                        <option value="">Select a workflow...</option>
                        {activeWorkflows.map(workflow => (
                          <option key={workflow.id} value={workflow.id}>
                            {workflow.schoolName} - {workflow.academicYear}
                          </option>
                        ))}
                      </select>
                      {errors.workflowId && <div className="form-error">{errors.workflowId}</div>}
                    </div>

                    {formData.workflowId && (
                      <div className="form-group">
                        <label htmlFor="workflowStepId" className="form-label">
                          Workflow Step <span className="required">*</span>
                        </label>
                        <select
                          id="workflowStepId"
                          name="workflowStepId"
                          value={formData.workflowStepId}
                          onChange={handleChange}
                          className={`form-select ${errors.workflowStepId ? 'form-input--error' : ''}`}
                          disabled={loading || prefilledData.workflowStepId}
                        >
                          <option value="">Select a step...</option>
                          {workflowSteps.map(step => (
                            <option key={step.id} value={step.id}>
                              {step.name}
                            </option>
                          ))}
                        </select>
                        {errors.workflowStepId && <div className="form-error">{errors.workflowStepId}</div>}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Timeline & Priority Section */}
            <div className="form-section">
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div className="form-group" style={{ flex: '1', minWidth: 0 }}>
                  <label htmlFor="priority" className="form-label">
                    Priority
                  </label>
                  <div className="priority-select-wrapper">
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
                    <div className={`priority-indicator priority-indicator--${formData.priority}`}></div>
                  </div>
                </div>

                <div className="form-group" style={{ flex: '1', minWidth: 0 }}>
                  <label htmlFor="dueDate" className="form-label">
                    Due Date
                  </label>
                  <DatePickerWithPresets
                    value={formData.dueDate}
                    onChange={(e) => handleChange({ target: { name: 'dueDate', value: e.target.value }})}
                    disabled={loading}
                    placeholder="Select due date"
                  />
                </div>

                <div className="form-group" style={{ flex: '1', minWidth: 0 }}>
                  <label htmlFor="estimatedHours" className="form-label">
                    Est. Hours
                  </label>
                  <input
                    type="number"
                    id="estimatedHours"
                    name="estimatedHours"
                    value={formData.estimatedHours}
                    onChange={handleChange}
                    className={`form-input ${errors.estimatedHours ? 'form-input--error' : ''}`}
                    placeholder="0"
                    min="0"
                    step="0.5"
                    disabled={loading}
                  />
                  {errors.estimatedHours && <div className="form-error">{errors.estimatedHours}</div>}
                </div>
              </div>
            </div>

            {/* Assignment Section */}
            <div className="form-section">
              <div className="form-group">
                <label className="form-label">Assign To</label>
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
                    <div className="assignee-dropdown">
                      {/* Selected members first */}
                      {activeTeamMembers
                        .filter(member => formData.assignedTo.includes(member.id))
                        .map(member => {
                          const isSelected = true;
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
                          const isSelected = false;
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

            {/* Subtasks Section */}
            <div className="form-section">
              <label className="form-label">Subtasks</label>
              {errors.subtasks && <div className="form-error">{errors.subtasks}</div>}
              <div className="subtask-list">
                {formData.subtasks.map((subtask, index) => (
                  <div key={subtask.id} className="subtask-item">
                    <span className="subtask-number">{index + 1}.</span>
                    <input
                      type="text"
                      value={subtask.title}
                      onChange={(e) => handleSubtaskChange(subtask.id, e.target.value)}
                      className="subtask-input"
                      placeholder="Subtask title..."
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(subtask.id)}
                      className="subtask-remove"
                      disabled={loading}
                      aria-label="Remove subtask"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  className="subtask-add-btn"
                  disabled={loading}
                >
                  <Plus size={16} />
                  Add Subtask
                </button>
              </div>
            </div>

            {/* Recurring Task Section */}
            <div className="form-section">
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    disabled={loading}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  Make this a recurring task
                </label>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', marginLeft: '1.5rem' }}>
                  Automatically create this task on a schedule
                </p>
              </div>

              {isRecurring && (
                <RecurringTaskForm
                  config={recurringConfig}
                  onChange={setRecurringConfig}
                  disabled={loading}
                />
              )}
            </div>

            {/* Attachments Section */}
            <div className="form-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Paperclip size={18} />
                <label className="form-label" style={{ margin: 0 }}>
                  Attachments
                </label>
                <span className="attachments-count">
                  {pendingAttachments.length}/{attachmentsService.maxAttachmentsPerTask}
                </span>
              </div>

              {pendingAttachments.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <AttachmentList
                    attachments={pendingAttachments}
                    onDelete={(attachmentId) => {
                      handleRemovePendingAttachment(attachmentId);
                      return Promise.resolve();
                    }}
                    canDelete={true}
                    compact={true}
                  />
                </div>
              )}

              <FileUploadButton
                onUpload={handleFileSelect}
                disabled={loading || attachmentsService.isAttachmentLimitReached(pendingAttachments)}
                maxFileSize={50}
                acceptedTypes="*"
                buttonText="Add File"
                buttonVariant="outline"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="create-task-modal-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <TaskTemplateSelector
          isOpen={showTemplateSelector}
          onClose={() => setShowTemplateSelector(false)}
          onSelectTemplate={handleTemplateSelect}
        />
      )}
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default CreateTaskModal;
