// src/components/schools/SchedulerConfigurationEditor.js
import React, { useState } from "react";
import { Plus, Trash2, Edit2, Camera, Users as UsersIcon, X } from "lucide-react";
import { getOrganizationSessionTypes } from "../../utils/sessionTypes";
import "./SchedulerConfigurationEditor.css";

const SchedulerConfigurationEditor = ({ configurations = [], onChange, organization }) => {
  const [editingConfig, setEditingConfig] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const sessionTypes = getOrganizationSessionTypes(organization);

  const getSessionTypeName = (sessionTypeId) => {
    const type = sessionTypes.find(t => t.id === sessionTypeId);
    return type ? type.name : 'Unknown';
  };

  const handleAddConfiguration = () => {
    setEditingConfig({
      id: `config_${Date.now()}`,
      name: "",
      positions: []
    });
    setShowConfigModal(true);
  };

  const handleEditConfiguration = (config) => {
    setEditingConfig({ ...config });
    setShowConfigModal(true);
  };

  const handleDeleteConfiguration = (configId) => {
    if (window.confirm("Are you sure you want to delete this scheduler configuration?")) {
      onChange(configurations.filter(c => c.id !== configId));
    }
  };

  const handleSaveConfiguration = (config) => {
    const existingIndex = configurations.findIndex(c => c.id === config.id);
    let newConfigurations;

    if (existingIndex >= 0) {
      newConfigurations = [...configurations];
      newConfigurations[existingIndex] = config;
    } else {
      newConfigurations = [...configurations, config];
    }

    onChange(newConfigurations);
    setShowConfigModal(false);
    setEditingConfig(null);
  };

  const handleCancelEdit = () => {
    setShowConfigModal(false);
    setEditingConfig(null);
  };

  return (
    <div className="scheduler-config-editor">
      <div className="scheduler-config-editor__header">
        <h3>Scheduler Configurations</h3>
        <p>Define worker position templates for different shoot types at this school</p>
      </div>

      {configurations.length > 0 && (
        <div className="scheduler-config-list">
          {configurations.map((config) => (
            <div key={config.id} className="scheduler-config-card">
              <div className="scheduler-config-card__header">
                <div className="scheduler-config-card__title-row">
                  <h4>{config.name}</h4>
                  {config.sessionTypeId && (
                    <span className="scheduler-config-session-type-badge">
                      {getSessionTypeName(config.sessionTypeId)}
                    </span>
                  )}
                </div>
                <div className="scheduler-config-card__actions">
                  <button
                    type="button"
                    onClick={() => handleEditConfiguration(config)}
                    className="scheduler-config-btn scheduler-config-btn--edit"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteConfiguration(config.id)}
                    className="scheduler-config-btn scheduler-config-btn--delete"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="scheduler-config-card__positions">
                {config.positions.map((position, idx) => (
                  <div key={idx} className="position-badge">
                    {getPositionIcon(position.type)}
                    <span>{position.label}</span>
                  </div>
                ))}
                {config.positions.length === 0 && (
                  <p className="text-muted">No positions configured</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleAddConfiguration}
        className="scheduler-config-add-btn"
      >
        <Plus size={16} />
        <span>Add Configuration</span>
      </button>

      {showConfigModal && editingConfig && (
        <ConfigurationModal
          config={editingConfig}
          onSave={handleSaveConfiguration}
          onCancel={handleCancelEdit}
          organization={organization}
        />
      )}
    </div>
  );
};

const getPositionIcon = (type) => {
  switch (type) {
    case 'individual_camera':
      return <Camera size={14} />;
    case 'group_camera':
      return <Camera size={14} />;
    case 'helper':
      return <UsersIcon size={14} />;
    default:
      return null;
  }
};

const ConfigurationModal = ({ config, onSave, onCancel, organization }) => {
  const [name, setName] = useState(config.name || "");
  const [sessionTypeId, setSessionTypeId] = useState(config.sessionTypeId || "");
  const [positions, setPositions] = useState(config.positions || []);

  const sessionTypes = getOrganizationSessionTypes(organization);

  const positionTypes = [
    { value: 'individual_camera', label: 'Individual Camera' },
    { value: 'group_camera', label: 'Group Camera' },
    { value: 'helper', label: 'Helper' }
  ];

  const handleAddPosition = (type) => {
    const typeLabel = positionTypes.find(t => t.value === type)?.label || type;
    const existingCount = positions.filter(p => p.type === type).length;
    const newPosition = {
      type,
      label: existingCount > 0 ? `${typeLabel} ${existingCount + 1}` : typeLabel,
      id: `position_${Date.now()}_${Math.random()}`
    };
    setPositions([...positions, newPosition]);
  };

  const handleRemovePosition = (index) => {
    setPositions(positions.filter((_, idx) => idx !== index));
  };

  const handleUpdatePositionLabel = (index, newLabel) => {
    const updated = [...positions];
    updated[index] = { ...updated[index], label: newLabel };
    setPositions(updated);
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert("Please enter a configuration name");
      return;
    }
    if (!sessionTypeId) {
      alert("Please select a session type");
      return;
    }
    if (positions.length === 0) {
      alert("Please add at least one position");
      return;
    }
    onSave({
      ...config,
      name: name.trim(),
      sessionTypeId,
      positions
    });
  };

  return (
    <div className="scheduler-config-modal-overlay">
      <div className="scheduler-config-modal">
        <div className="scheduler-config-modal__header">
          <h3>{config.name ? 'Edit' : 'New'} Scheduler Configuration</h3>
          <button type="button" onClick={onCancel} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="scheduler-config-modal__body">
          <div className="form-group">
            <label>Session Type *</label>
            <select
              value={sessionTypeId}
              onChange={(e) => setSessionTypeId(e.target.value)}
              className="form-input"
            >
              <option value="">Select session type</option>
              {sessionTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <span className="form-hint">
              This configuration will be used when this session type is selected as priority
            </span>
          </div>

          <div className="form-group">
            <label>Configuration Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Underclass, Spring Photos, Retake Day"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Worker Positions</label>
            <div className="position-type-buttons">
              {positionTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleAddPosition(type.value)}
                  className="position-type-btn"
                >
                  {getPositionIcon(type.value)}
                  <span>Add {type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {positions.length > 0 && (
            <div className="positions-list">
              {positions.map((position, idx) => (
                <div key={position.id || idx} className="position-item">
                  <div className="position-item__icon">
                    {getPositionIcon(position.type)}
                  </div>
                  <input
                    type="text"
                    value={position.label}
                    onChange={(e) => handleUpdatePositionLabel(idx, e.target.value)}
                    className="position-item__input"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePosition(idx)}
                    className="position-item__remove"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="scheduler-config-modal__footer">
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="btn btn-primary">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchedulerConfigurationEditor;
