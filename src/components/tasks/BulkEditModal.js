// src/components/tasks/BulkEditModal.js
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Save, AlertTriangle } from 'lucide-react';
import { useDataCache } from '../../contexts/DataCacheContext';
import Button from '../shared/Button';
import '../shared/Modal.css';
import './BulkEditModal.css';

const BulkEditModal = ({ isOpen, onClose, selectedTasks, onBulkUpdate }) => {
  const { users } = useDataCache();
  const [formData, setFormData] = useState({
    status: '',
    priority: '',
    assignedTo: '',
    dueDate: '',
    tags: []
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Only include fields that have values (not empty strings)
      const updates = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== '' && formData[key].length !== 0) {
          updates[key] = formData[key];
        }
      });

      // Convert date string to Date object if dueDate is set
      if (updates.dueDate) {
        updates.dueDate = new Date(updates.dueDate);
      }

      await onBulkUpdate(updates);

      // Reset form and close
      setFormData({
        status: '',
        priority: '',
        assignedTo: '',
        dueDate: '',
        tags: []
      });
      onClose();
    } catch (error) {
      console.error('Error updating tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal modal--medium"
        style={{
          position: 'relative',
          margin: '0',
          transform: 'none'
        }}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">Bulk Edit Tasks</h2>
            <p className="modal__subtitle">
              Update {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          <div className="modal__content">
            <div className="bulk-edit-modal__notice">
              <AlertTriangle size={16} />
              <span>Only fields you fill will be updated. Empty fields will remain unchanged.</span>
            </div>

            <div className="form-group">
              <label htmlFor="status" className="form-label">Status</label>
              <select
                id="status"
                name="status"
                className="form-input"
                value={formData.status}
                onChange={handleInputChange}
              >
                <option value="">-- No Change --</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="priority" className="form-label">Priority</label>
              <select
                id="priority"
                name="priority"
                className="form-input"
                value={formData.priority}
                onChange={handleInputChange}
              >
                <option value="">-- No Change --</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
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
                <option value="">-- No Change --</option>
                <option value="unassigned">Unassigned</option>
                {users && users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="dueDate" className="form-label">Due Date</label>
              <input
                type="date"
                id="dueDate"
                name="dueDate"
                className="form-input"
                value={formData.dueDate}
                onChange={handleInputChange}
              />
              <span className="form-hint">Leave empty to keep existing due dates</span>
            </div>
          </div>

          <div className="modal__actions">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
            >
              <Save size={16} />
              Update {selectedTasks.length} Task{selectedTasks.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default BulkEditModal;
