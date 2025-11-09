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
  ChevronDown
} from 'lucide-react';
import { useTask } from '../../contexts/TaskContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { useAuth } from '../../contexts/AuthContext';
import './CreateTaskModal.css';

const CreateTaskModal = ({ isOpen, onClose, prefilledData = {} }) => {
  const { createTask } = useTask();
  const { teamMembers, sessions } = useDataCache();
  const { organizationWorkflows } = useWorkflow();
  const { userProfile, organization } = useAuth();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);

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
      setErrors({});
    }
  }, [isOpen]);

  // Get active sessions for dropdown
  const activeSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions
      .filter(session => session.status !== 'completed' && session.status !== 'cancelled')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [sessions]);

  // Get active workflows for dropdown
  const activeWorkflows = useMemo(() => {
    if (!organizationWorkflows) return [];
    return organizationWorkflows
      .filter(workflow => workflow.status === 'active' || workflow.status === 'in_progress')
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
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        priority: formData.priority,
        status: 'todo',
        assignedTo: formData.assignedTo,
        createdBy: userProfile?.id || userProfile?.uid,
        organizationID: organization?.id,
        subtasks: validSubtasks,
        commentCount: 0
      };

      if (formData.dueDate) {
        taskData.dueDate = new Date(formData.dueDate);
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

      await createTask(taskData);
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
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="form-textarea"
                  rows="3"
                  placeholder="Describe what needs to be done..."
                  disabled={loading}
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
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default CreateTaskModal;
