// src/components/sessions/ConvertToSchedulerModal.js
import React, { useState } from "react";
import ReactDOM from "react-dom";
import { X, Settings, AlertCircle, CheckCircle } from "lucide-react";
import "../shared/Modal.css";
import "./SchedulerSessionModal.css";

const ConvertToSchedulerModal = ({ isOpen, onClose, session, school, onConvert }) => {
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConvert = async (e) => {
    e.preventDefault();

    if (!selectedConfigId) {
      setError("Please select a scheduler configuration");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onConvert(session.id, selectedConfigId);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to convert session");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10002, // Higher than SessionDetailsModal
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal"
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
          maxWidth: "500px",
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">Convert to Scheduler Session</h2>
            <p className="modal__subtitle">
              Select a scheduler configuration for this session
            </p>
          </div>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleConvert} className="modal__form">
          <div className="modal__content">
            {/* Info Banner */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                padding: "12px",
                backgroundColor: "#e3f2fd",
                border: "1px solid #90caf9",
                borderRadius: "6px",
                marginBottom: "20px",
              }}
            >
              <AlertCircle size={20} style={{ color: "#1976d2", flexShrink: 0 }} />
              <div style={{ fontSize: "13px", color: "#1565c0", lineHeight: "1.5" }}>
                This will add position-based worker assignments to this session. The session
                will appear in both the scheduler view and regular calendar views.
              </div>
            </div>

            {/* Session Info */}
            <div
              style={{
                padding: "12px",
                backgroundColor: "#f8f9fa",
                borderRadius: "6px",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>
                {session.schoolName}
              </div>
              <div style={{ fontSize: "13px", color: "#6c757d" }}>
                {new Date(session.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>

            {/* Configuration Selection */}
            {school?.schedulerConfigurations?.length > 0 ? (
              <div className="form-group">
                <label htmlFor="configId" className="form-label">
                  <Settings size={14} style={{ display: "inline", marginRight: "6px" }} />
                  Scheduler Configuration *
                </label>
                <select
                  id="configId"
                  className="form-input"
                  value={selectedConfigId}
                  onChange={(e) => {
                    setSelectedConfigId(e.target.value);
                    setError("");
                  }}
                  required
                >
                  <option value="">Select a configuration</option>
                  {school.schedulerConfigurations.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name} ({config.positions?.length || 0} positions)
                    </option>
                  ))}
                </select>
                {error && <span className="form-error-text">{error}</span>}

                {/* Show selected configuration details */}
                {selectedConfigId && (() => {
                  const config = school.schedulerConfigurations.find(c => c.id === selectedConfigId);
                  return config && (
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "10px",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "4px",
                        fontSize: "13px",
                      }}
                    >
                      <div style={{ fontWeight: "600", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <CheckCircle size={14} style={{ color: "#28a745" }} />
                        Positions that will be added:
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {config.positions?.map((pos, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: "4px 10px",
                              backgroundColor: "#e3f2fd",
                              color: "#1976d2",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: "500",
                            }}
                          >
                            {pos.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#fff3cd",
                  border: "1px solid #ffc107",
                  borderRadius: "6px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "14px", color: "#856404", marginBottom: "8px" }}>
                  No scheduler configurations found for this school.
                </div>
                <div style={{ fontSize: "13px", color: "#856404" }}>
                  Please add scheduler configurations in School Management first.
                </div>
              </div>
            )}
          </div>

          <div className="modal__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !school?.schedulerConfigurations?.length}
            >
              {loading ? "Converting..." : "Convert to Scheduler"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ConvertToSchedulerModal;
