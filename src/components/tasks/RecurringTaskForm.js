// src/components/tasks/RecurringTaskForm.js
import React, { useState } from 'react';
import { Repeat, X } from 'lucide-react';
import { createRecurringTask, getRecurrenceDescription } from '../../firebase/recurringTasks';
import { useAuth } from '../../contexts/AuthContext';
import { useDataCache } from '../../contexts/DataCacheContext';
import './RecurringTaskForm.css';

const RecurringTaskForm = ({ onClose, onCreated }) => {
  const { organization, userProfile } = useAuth();
  const { users } = useDataCache();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    frequency: 'weekly',
    interval: 1,
    priority: 'medium',
    type: 'general',
    assignedTo: '',
    daysUntilDue: 7,
    tags: []
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'interval' || name === 'daysUntilDue' ? parseInt(value) || 1 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createRecurringTask(organization.id, userProfile.id, formData);
      onCreated?.();
      onClose();
    } catch (error) {
      console.error('Error creating recurring task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="recurring-task-form">
      <div className="recurring-task-form__header">
        <div>
          <h3>
            <Repeat size={18} />
            Create Recurring Task
          </h3>
          <p className="recurring-task-form__description">
            {getRecurrenceDescription(formData.frequency, formData.interval)}
          </p>
        </div>
        <button className="recurring-task-form__close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="recurring-task-form__form">
        <div className="form-group">
          <label htmlFor="title" className="form-label">Title *</label>
          <input
            type="text"
            id="title"
            name="title"
            className="form-input"
            value={formData.title}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">Description</label>
          <textarea
            id="description"
            name="description"
            className="form-textarea"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="frequency" className="form-label">Frequency *</label>
            <select
              id="frequency"
              name="frequency"
              className="form-input"
              value={formData.frequency}
              onChange={handleInputChange}
              required
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="interval" className="form-label">Every</label>
            <input
              type="number"
              id="interval"
              name="interval"
              className="form-input"
              value={formData.interval}
              onChange={handleInputChange}
              min="1"
              max="365"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="priority" className="form-label">Priority</label>
            <select
              id="priority"
              name="priority"
              className="form-input"
              value={formData.priority}
              onChange={handleInputChange}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="type" className="form-label">Type</label>
            <select
              id="type"
              name="type"
              className="form-input"
              value={formData.type}
              onChange={handleInputChange}
            >
              <option value="general">General</option>
              <option value="session">Session</option>
              <option value="workflow">Workflow</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="assignedTo" className="form-label">Assign To</label>
          <select
            id="assignedTo"
            name="assignedTo"
            className="form-input"
            value={formData.assignedTo}
            onChange={handleInputChange}
          >
            <option value="">Unassigned</option>
            {users && users.map(user => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="daysUntilDue" className="form-label">Days Until Due</label>
          <input
            type="number"
            id="daysUntilDue"
            name="daysUntilDue"
            className="form-input"
            value={formData.daysUntilDue}
            onChange={handleInputChange}
            min="1"
            max="365"
          />
          <span className="form-hint">
            Tasks will be due {formData.daysUntilDue} day{formData.daysUntilDue !== 1 ? 's' : ''} after creation
          </span>
        </div>

        <div className="recurring-task-form__actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Recurring Task'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RecurringTaskForm;
