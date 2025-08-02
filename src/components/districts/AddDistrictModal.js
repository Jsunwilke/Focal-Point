// src/components/districts/AddDistrictModal.js
import React, { useState } from "react";
import ReactDOM from "react-dom";
import { X, Building2, Save } from "lucide-react";
import Button from "../shared/Button";
import "../shared/Modal.css";
import "./AddDistrictModal.css";

const AddDistrictModal = ({
  district = null,
  onClose,
  onAdd,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState({
    name: district?.name || "",
    description: district?.description || "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "District name is required";
    }

    if (formData.name.length > 100) {
      newErrors.name = "District name must be less than 100 characters";
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
      const cleanedData = {
        name: formData.name.trim(),
      };
      
      if (formData.description?.trim()) {
        cleanedData.description = formData.description.trim();
      }

      await onAdd(cleanedData);
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

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
        zIndex: 10001,
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
            <h2 className="modal__title">
              {isEditing ? "Edit District" : "Add District"}
            </h2>
            <p className="modal__subtitle">
              {isEditing 
                ? "Update district information" 
                : "Create a new district to group schools together"}
            </p>
          </div>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          {errors.submit && (
            <div className="form-error form-error--global">{errors.submit}</div>
          )}

          <div className="modal__content">
            <div className="form-section">
              <h3 className="form-section__title">
                <Building2 size={16} />
                District Information
              </h3>

              <div className="form-group">
                <label htmlFor="name" className="form-label">
                  District Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className={`form-input ${
                    errors.name ? "form-input--error" : ""
                  }`}
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., North District, Central Region"
                  maxLength={100}
                  required
                  autoFocus
                />
                {errors.name && (
                  <span className="form-error-text">{errors.name}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="description" className="form-label">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  className="form-textarea"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Optional description or notes about this district"
                  rows={3}
                />
              </div>
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
              {isEditing ? "Save Changes" : "Add District"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default AddDistrictModal;