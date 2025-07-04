// src/components/team/InviteUserModal.js
import React, { useState } from "react";
import { X, Mail, User, Shield } from "lucide-react";
import Button from "../shared/Button";
import { isValidEmail } from "../../utils/validation";
import "./InviteUserModal.css";

const InviteUserModal = ({ onClose, onInvite, organization }) => {
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "employee",
    position: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const roles = [
    {
      value: "employee",
      label: "Employee",
      icon: User,
      description: "Basic access to assigned tasks",
    },
    {
      value: "manager",
      label: "Manager",
      icon: Shield,
      description: "Can manage team and schedules",
    },
    {
      value: "admin",
      label: "Admin",
      icon: Shield,
      description: "Full access to all features",
    },
  ];

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

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
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
      await onInvite({
        ...formData,
        organizationID: organization.id,
      });
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">Invite Team Member</h2>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          {errors.submit && <div className="form-error">{errors.submit}</div>}

          <div className="form-section">
            <h3 className="form-section__title">
              <Mail size={16} />
              Contact Information
            </h3>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className={`form-input ${
                  errors.email ? "form-input--error" : ""
                }`}
                value={formData.email}
                onChange={handleChange}
                placeholder="john@example.com"
              />
              {errors.email && (
                <span className="form-error-text">{errors.email}</span>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName" className="form-label">
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  className={`form-input ${
                    errors.firstName ? "form-input--error" : ""
                  }`}
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                />
                {errors.firstName && (
                  <span className="form-error-text">{errors.firstName}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="lastName" className="form-label">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  className={`form-input ${
                    errors.lastName ? "form-input--error" : ""
                  }`}
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Smith"
                />
                {errors.lastName && (
                  <span className="form-error-text">{errors.lastName}</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="position" className="form-label">
                Position/Title
              </label>
              <input
                type="text"
                id="position"
                name="position"
                className="form-input"
                value={formData.position}
                onChange={handleChange}
                placeholder="e.g. Lead Photographer, Assistant"
              />
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section__title">
              <Shield size={16} />
              Role & Permissions
            </h3>

            <div className="role-selection">
              {roles.map((role) => {
                const IconComponent = role.icon;
                return (
                  <label key={role.value} className="role-option">
                    <input
                      type="radio"
                      name="role"
                      value={role.value}
                      checked={formData.role === role.value}
                      onChange={handleChange}
                      className="role-radio"
                    />
                    <div className="role-content">
                      <div className="role-header">
                        <IconComponent size={16} className="role-icon" />
                        <span className="role-name">{role.label}</span>
                      </div>
                      <p className="role-description">{role.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="modal__actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              Send Invitation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteUserModal;
