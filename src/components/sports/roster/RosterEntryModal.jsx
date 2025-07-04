import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  X,
  User,
  Users,
  Mail,
  Phone,
  Trophy,
  GraduationCap,
} from "lucide-react";
import { useJobs } from "../../../contexts/JobsContext";
import { generateUniqueId } from "../../../utils/calculations";

const RosterEntryModal = ({ show, onHide, jobId, editingEntry, roster }) => {
  const { updateJobRoster } = useJobs();
  const [formData, setFormData] = useState({
    id: "",
    lastName: "",
    firstName: "",
    teacher: "",
    group: "",
    email: "",
    phone: "",
    imageNumbers: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show) {
      if (editingEntry) {
        setFormData(editingEntry);
      } else {
        setFormData({
          id: "",
          lastName: "",
          firstName: "",
          teacher: "",
          group: "",
          email: "",
          phone: "",
          imageNumbers: "",
          notes: "",
        });
      }
    }
  }, [show, editingEntry]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const entryData = {
        ...formData,
        id: formData.id || generateUniqueId(),
      };

      let updatedRoster;
      if (editingEntry) {
        // Update existing entry
        updatedRoster = roster.map((entry) =>
          entry.id === editingEntry.id ? entryData : entry
        );
      } else {
        // Add new entry
        updatedRoster = [...roster, entryData];
      }

      await updateJobRoster(jobId, updatedRoster);
      onHide();
    } catch (error) {
      console.error("Error saving roster entry:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onHide();
  };

  if (!show) return null;

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000, // Higher than ViewJobModal (9999)
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          width: "90%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #dee2e6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f8f9fa",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <User size={24} style={{ color: "#0d6efd" }} />
            <h4 style={{ margin: 0, fontSize: "1.25rem" }}>
              {editingEntry ? "Edit Athlete" : "Add New Athlete"}
            </h4>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              color: "#6c757d",
              borderRadius: "4px",
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: "1.5rem",
            overflow: "auto",
            flex: 1,
          }}
        >
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label d-flex align-items-center gap-2">
                  <User size={16} />
                  Last Name <span className="text-danger">*</span>
                  <small className="text-muted">(Name)</small>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="form-control"
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label d-flex align-items-center gap-2">
                  <User size={16} />
                  First Name
                  <small className="text-muted">(Subject ID)</small>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="form-control"
                />
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label d-flex align-items-center gap-2">
                  <GraduationCap size={16} />
                  Teacher/Grade
                  <small className="text-muted">(Special)</small>
                </label>
                <input
                  type="text"
                  name="teacher"
                  value={formData.teacher}
                  onChange={handleInputChange}
                  className="form-control"
                  placeholder="e.g., Smith, Grade 10, s, 8"
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label d-flex align-items-center gap-2">
                  <Trophy size={16} />
                  Group/Sport
                  <small className="text-muted">(Sport/Team)</small>
                </label>
                <input
                  type="text"
                  name="group"
                  value={formData.group}
                  onChange={handleInputChange}
                  className="form-control"
                  placeholder="e.g., Football, Basketball"
                />
              </div>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label d-flex align-items-center gap-2">
                  <Mail size={16} />
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="form-control"
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label d-flex align-items-center gap-2">
                  <Phone size={16} />
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="form-control"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Image Numbers</label>
              <input
                type="text"
                name="imageNumbers"
                value={formData.imageNumbers}
                onChange={handleInputChange}
                className="form-control"
                placeholder="e.g., 001-010, 15, 22-25"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className="form-control"
                rows={3}
              />
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #dee2e6",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            backgroundColor: "#f8f9fa",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading && (
              <span
                className="spinner-border spinner-border-sm me-2"
                role="status"
              ></span>
            )}
            {editingEntry ? "Update" : "Add"} Athlete
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default RosterEntryModal;
