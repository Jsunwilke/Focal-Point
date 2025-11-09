// src/components/tasks/TaskDependencyManager.js
import React, { useState, useEffect } from 'react';
import { Link, Unlink, AlertCircle, X } from 'lucide-react';
import { addTaskDependency, removeTaskDependency, getTaskDependencies, getTaskDependents } from '../../firebase/taskDependencies';
import { useAuth } from '../../contexts/AuthContext';
import './TaskDependencyManager.css';

const TaskDependencyManager = ({ taskId, allTasks }) => {
  const { organization } = useAuth();
  const [dependencies, setDependencies] = useState([]);
  const [dependents, setDependents] = useState([]);
  const [showAddDependency, setShowAddDependency] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDependencies();
  }, [taskId, organization?.id]);

  const loadDependencies = async () => {
    if (!taskId || !organization?.id) return;

    try {
      const [deps, depts] = await Promise.all([
        getTaskDependencies(taskId, organization.id),
        getTaskDependents(taskId, organization.id)
      ]);

      setDependencies(deps);
      setDependents(depts);
    } catch (error) {
      console.error('Error loading dependencies:', error);
    }
  };

  const handleAddDependency = async () => {
    if (!selectedTaskId) {
      setError('Please select a task');
      return;
    }

    if (selectedTaskId === taskId) {
      setError('A task cannot depend on itself');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await addTaskDependency(taskId, selectedTaskId, organization.id);
      await loadDependencies();
      setSelectedTaskId('');
      setShowAddDependency(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDependency = async (dependencyId) => {
    try {
      await removeTaskDependency(dependencyId);
      await loadDependencies();
    } catch (error) {
      console.error('Error removing dependency:', error);
    }
  };

  const getTaskById = (id) => {
    return allTasks.find(t => t.id === id);
  };

  const availableTasks = allTasks.filter(t => t.id !== taskId);

  return (
    <div className="dependency-manager">
      <div className="dependency-manager__section">
        <div className="dependency-manager__header">
          <h4>
            <Link size={16} />
            Blocks (Dependencies)
          </h4>
          <button
            className="dependency-manager__add-btn"
            onClick={() => setShowAddDependency(!showAddDependency)}
          >
            {showAddDependency ? <X size={14} /> : <Link size={14} />}
            {showAddDependency ? 'Cancel' : 'Add'}
          </button>
        </div>

        {showAddDependency && (
          <div className="dependency-manager__add-form">
            <select
              className="dependency-manager__select"
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
            >
              <option value="">Select a task this depends on...</option>
              {availableTasks.map(task => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
            <button
              className="dependency-manager__submit-btn"
              onClick={handleAddDependency}
              disabled={loading || !selectedTaskId}
            >
              Add Dependency
            </button>
            {error && (
              <div className="dependency-manager__error">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>
        )}

        {dependencies.length === 0 ? (
          <p className="dependency-manager__empty">No dependencies</p>
        ) : (
          <div className="dependency-manager__list">
            {dependencies.map(dep => {
              const task = getTaskById(dep.dependsOnTaskId);
              if (!task) return null;

              return (
                <div key={dep.id} className="dependency-manager__item">
                  <div className="dependency-manager__item-content">
                    <span className="dependency-manager__item-title">{task.title}</span>
                    <span className={`dependency-manager__item-status dependency-manager__item-status--${task.status}`}>
                      {task.status === 'completed' ? '✓ Completed' : task.status.replace('_', ' ')}
                    </span>
                  </div>
                  <button
                    className="dependency-manager__remove-btn"
                    onClick={() => handleRemoveDependency(dep.id)}
                    title="Remove dependency"
                  >
                    <Unlink size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {dependents.length > 0 && (
        <div className="dependency-manager__section">
          <div className="dependency-manager__header">
            <h4>
              <AlertCircle size={16} />
              Blocked By (Dependents)
            </h4>
          </div>

          <div className="dependency-manager__list">
            {dependents.map(dep => {
              const task = getTaskById(dep.taskId);
              if (!task) return null;

              return (
                <div key={dep.id} className="dependency-manager__item dependency-manager__item--readonly">
                  <div className="dependency-manager__item-content">
                    <span className="dependency-manager__item-title">{task.title}</span>
                    <span className="dependency-manager__item-note">
                      is waiting for this task
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskDependencyManager;
