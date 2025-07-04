// src/components/settings/StudioSettingsModal.js
import React, { useState, useEffect } from "react";
import {
  X,
  Building,
  Mail,
  Phone,
  MapPin,
  Save,
  Clock,
  DollarSign,
  Camera,
  Shield,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { updateOrganization } from "../../firebase/firestore";
import Button from "../shared/Button";
import "./StudioSettingsModal.css";

const StudioSettingsModal = ({ isOpen, onClose }) => {
  const { userProfile, organization, loadOrganization } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "US",
    },
    businessInfo: {
      taxId: "",
      businessType: "LLC",
      license: "",
    },
    operatingHours: {
      monday: { open: "09:00", close: "17:00", closed: false },
      tuesday: { open: "09:00", close: "17:00", closed: false },
      wednesday: { open: "09:00", close: "17:00", closed: false },
      thursday: { open: "09:00", close: "17:00", closed: false },
      friday: { open: "09:00", close: "17:00", closed: false },
      saturday: { open: "09:00", close: "15:00", closed: false },
      sunday: { open: "10:00", close: "16:00", closed: true },
    },
    pricing: {
      defaultPackage: "",
      schoolRate: "",
      travelRate: "",
      overtimeRate: "",
    },
    policies: {
      cancellationPolicy: "",
      retakePolicy: "",
      paymentTerms: "",
      privacyPolicy: "",
    },
    preferences: {
      timezone: "America/Chicago",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
      currency: "USD",
      defaultSessionDuration: 60,
      bufferTime: 15,
    },
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("general");

  // Check if user has admin permissions
  const isAdmin = userProfile?.role === "admin";

  // Initialize form data when modal opens or organization changes
  useEffect(() => {
    if (isOpen && organization) {
      setFormData({
        name: organization.name || "",
        email: organization.email || "",
        phone: organization.phone || "",
        website: organization.website || "",
        address: {
          street: organization.address?.street || "",
          city: organization.address?.city || "",
          state: organization.address?.state || "",
          zipCode: organization.address?.zipCode || "",
          country: organization.address?.country || "US",
        },
        businessInfo: {
          taxId: organization.businessInfo?.taxId || "",
          businessType: organization.businessInfo?.businessType || "LLC",
          license: organization.businessInfo?.license || "",
        },
        operatingHours: {
          monday: organization.operatingHours?.monday || {
            open: "09:00",
            close: "17:00",
            closed: false,
          },
          tuesday: organization.operatingHours?.tuesday || {
            open: "09:00",
            close: "17:00",
            closed: false,
          },
          wednesday: organization.operatingHours?.wednesday || {
            open: "09:00",
            close: "17:00",
            closed: false,
          },
          thursday: organization.operatingHours?.thursday || {
            open: "09:00",
            close: "17:00",
            closed: false,
          },
          friday: organization.operatingHours?.friday || {
            open: "09:00",
            close: "17:00",
            closed: false,
          },
          saturday: organization.operatingHours?.saturday || {
            open: "09:00",
            close: "15:00",
            closed: false,
          },
          sunday: organization.operatingHours?.sunday || {
            open: "10:00",
            close: "16:00",
            closed: true,
          },
        },
        pricing: {
          defaultPackage: organization.pricing?.defaultPackage || "",
          schoolRate: organization.pricing?.schoolRate || "",
          travelRate: organization.pricing?.travelRate || "",
          overtimeRate: organization.pricing?.overtimeRate || "",
        },
        policies: {
          cancellationPolicy: organization.policies?.cancellationPolicy || "",
          retakePolicy: organization.policies?.retakePolicy || "",
          paymentTerms: organization.policies?.paymentTerms || "",
          privacyPolicy: organization.policies?.privacyPolicy || "",
        },
        preferences: {
          timezone: organization.preferences?.timezone || "America/Chicago",
          dateFormat: organization.preferences?.dateFormat || "MM/DD/YYYY",
          timeFormat: organization.preferences?.timeFormat || "12h",
          currency: organization.preferences?.currency || "USD",
          defaultSessionDuration:
            organization.preferences?.defaultSessionDuration || 60,
          bufferTime: organization.preferences?.bufferTime || 15,
        },
      });
    }
  }, [isOpen, organization]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.includes(".")) {
      const parts = name.split(".");
      if (parts.length === 2) {
        const [parent, child] = parts;
        setFormData((prev) => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: type === "checkbox" ? checked : value,
          },
        }));
      } else if (parts.length === 3) {
        const [parent, child, grandchild] = parts;
        setFormData((prev) => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: {
              ...prev[parent][child],
              [grandchild]: type === "checkbox" ? checked : value,
            },
          },
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }

    // Clear errors for this field
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
      newErrors.name = "Studio name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (
      formData.phone &&
      !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/\s/g, ""))
    ) {
      newErrors.phone = "Please enter a valid phone number";
    }

    if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
      newErrors.website =
        "Please enter a valid website URL (include http:// or https://)";
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
      // Prepare update data
      const updateData = {
        ...formData,
        updatedAt: new Date(),
      };

      // Update organization in Firestore
      await updateOrganization(organization.id, updateData);

      // Reload organization to get fresh data
      await loadOrganization();

      // Close modal
      onClose();
    } catch (error) {
      console.error("Error updating studio settings:", error);
      setErrors({
        submit: "Failed to update studio settings. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  // Only allow admins to access studio settings
  if (!isAdmin) {
    return (
      <div className="modal-overlay">
        <div className="modal modal--medium">
          <div className="modal__header">
            <h2 className="modal__title">Access Denied</h2>
            <button
              className="modal__close"
              onClick={handleCancel}
              type="button"
            >
              <X size={20} />
            </button>
          </div>
          <div className="modal__content">
            <div className="access-denied">
              <Shield size={48} className="access-denied__icon" />
              <h3>Admin Access Required</h3>
              <p>Only administrators can access studio settings.</p>
            </div>
          </div>
          <div className="modal__actions">
            <Button variant="primary" onClick={handleCancel}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "general", label: "General", icon: Building },
    { id: "hours", label: "Hours", icon: Clock },
    { id: "pricing", label: "Pricing", icon: DollarSign },
    { id: "policies", label: "Policies", icon: SettingsIcon },
  ];

  const days = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal modal--large">
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">Studio Settings</h2>
            <p className="modal__subtitle">
              Manage your studio information and preferences
            </p>
          </div>
          <button className="modal__close" onClick={handleCancel} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="modal__tabs">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                className={`modal__tab ${
                  activeTab === tab.id ? "modal__tab--active" : ""
                }`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <IconComponent size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          {errors.submit && (
            <div className="form-error form-error--global">{errors.submit}</div>
          )}

          <div className="modal__content">
            {activeTab === "general" && (
              <div className="tab-content">
                <div className="form-section">
                  <h3 className="form-section__title">
                    <Building size={16} />
                    Studio Information
                  </h3>

                  <div className="form-group">
                    <label htmlFor="name" className="form-label">
                      Studio Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      className={`form-input ${
                        errors.name ? "form-input--error" : ""
                      }`}
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                    {errors.name && (
                      <span className="form-error-text">{errors.name}</span>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="email" className="form-label">
                        Email *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className={`form-input ${
                          errors.email ? "form-input--error" : ""
                        }`}
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                      />
                      {errors.email && (
                        <span className="form-error-text">{errors.email}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="phone" className="form-label">
                        Phone
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        className={`form-input ${
                          errors.phone ? "form-input--error" : ""
                        }`}
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="(555) 123-4567"
                      />
                      {errors.phone && (
                        <span className="form-error-text">{errors.phone}</span>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="website" className="form-label">
                      Website
                    </label>
                    <input
                      type="url"
                      id="website"
                      name="website"
                      className={`form-input ${
                        errors.website ? "form-input--error" : ""
                      }`}
                      value={formData.website}
                      onChange={handleInputChange}
                      placeholder="https://yourstudio.com"
                    />
                    {errors.website && (
                      <span className="form-error-text">{errors.website}</span>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section__title">
                    <MapPin size={16} />
                    Studio Address
                  </h3>

                  <div className="form-group">
                    <label htmlFor="address.street" className="form-label">
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="address.street"
                      name="address.street"
                      className="form-input"
                      value={formData.address.street}
                      onChange={handleInputChange}
                      placeholder="123 Photography Lane"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="address.city" className="form-label">
                        City
                      </label>
                      <input
                        type="text"
                        id="address.city"
                        name="address.city"
                        className="form-input"
                        value={formData.address.city}
                        onChange={handleInputChange}
                        placeholder="Springfield"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="address.state" className="form-label">
                        State
                      </label>
                      <input
                        type="text"
                        id="address.state"
                        name="address.state"
                        className="form-input"
                        value={formData.address.state}
                        onChange={handleInputChange}
                        placeholder="IL"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="address.zipCode" className="form-label">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        id="address.zipCode"
                        name="address.zipCode"
                        className="form-input"
                        value={formData.address.zipCode}
                        onChange={handleInputChange}
                        placeholder="62701"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section__title">
                    <SettingsIcon size={16} />
                    Preferences
                  </h3>

                  <div className="form-row">
                    <div className="form-group">
                      <label
                        htmlFor="preferences.timezone"
                        className="form-label"
                      >
                        Timezone
                      </label>
                      <select
                        id="preferences.timezone"
                        name="preferences.timezone"
                        className="form-input"
                        value={formData.preferences.timezone}
                        onChange={handleInputChange}
                      >
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">
                          Pacific Time
                        </option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label
                        htmlFor="preferences.dateFormat"
                        className="form-label"
                      >
                        Date Format
                      </label>
                      <select
                        id="preferences.dateFormat"
                        name="preferences.dateFormat"
                        className="form-input"
                        value={formData.preferences.dateFormat}
                        onChange={handleInputChange}
                      >
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label
                        htmlFor="preferences.defaultSessionDuration"
                        className="form-label"
                      >
                        Default Session Duration (minutes)
                      </label>
                      <input
                        type="number"
                        id="preferences.defaultSessionDuration"
                        name="preferences.defaultSessionDuration"
                        className="form-input"
                        value={formData.preferences.defaultSessionDuration}
                        onChange={handleInputChange}
                        min="15"
                        max="480"
                      />
                    </div>

                    <div className="form-group">
                      <label
                        htmlFor="preferences.bufferTime"
                        className="form-label"
                      >
                        Buffer Time (minutes)
                      </label>
                      <input
                        type="number"
                        id="preferences.bufferTime"
                        name="preferences.bufferTime"
                        className="form-input"
                        value={formData.preferences.bufferTime}
                        onChange={handleInputChange}
                        min="0"
                        max="60"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "hours" && (
              <div className="tab-content">
                <div className="form-section">
                  <h3 className="form-section__title">
                    <Clock size={16} />
                    Operating Hours
                  </h3>
                  <p className="form-section__description">
                    Set your studio's operating hours for each day of the week
                  </p>

                  <div className="hours-grid">
                    {days.map((day) => (
                      <div key={day.key} className="hours-row">
                        <div className="hours-day">
                          <label className="hours-checkbox">
                            <input
                              type="checkbox"
                              name={`operatingHours.${day.key}.closed`}
                              checked={formData.operatingHours[day.key].closed}
                              onChange={handleInputChange}
                            />
                            <span className="day-label">{day.label}</span>
                          </label>
                        </div>

                        {!formData.operatingHours[day.key].closed ? (
                          <div className="hours-inputs">
                            <input
                              type="time"
                              name={`operatingHours.${day.key}.open`}
                              value={formData.operatingHours[day.key].open}
                              onChange={handleInputChange}
                              className="form-input form-input--time"
                            />
                            <span className="hours-separator">to</span>
                            <input
                              type="time"
                              name={`operatingHours.${day.key}.close`}
                              value={formData.operatingHours[day.key].close}
                              onChange={handleInputChange}
                              className="form-input form-input--time"
                            />
                          </div>
                        ) : (
                          <div className="hours-closed">
                            <span>Closed</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "pricing" && (
              <div className="tab-content">
                <div className="form-section">
                  <h3 className="form-section__title">
                    <DollarSign size={16} />
                    Pricing Information
                  </h3>
                  <p className="form-section__description">
                    Set your default pricing structure
                  </p>

                  <div className="form-row">
                    <div className="form-group">
                      <label
                        htmlFor="pricing.schoolRate"
                        className="form-label"
                      >
                        School Rate (per session)
                      </label>
                      <input
                        type="number"
                        id="pricing.schoolRate"
                        name="pricing.schoolRate"
                        className="form-input"
                        value={formData.pricing.schoolRate}
                        onChange={handleInputChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>

                    <div className="form-group">
                      <label
                        htmlFor="pricing.travelRate"
                        className="form-label"
                      >
                        Travel Rate (per mile)
                      </label>
                      <input
                        type="number"
                        id="pricing.travelRate"
                        name="pricing.travelRate"
                        className="form-input"
                        value={formData.pricing.travelRate}
                        onChange={handleInputChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="pricing.overtimeRate"
                      className="form-label"
                    >
                      Overtime Rate (per hour)
                    </label>
                    <input
                      type="number"
                      id="pricing.overtimeRate"
                      name="pricing.overtimeRate"
                      className="form-input"
                      value={formData.pricing.overtimeRate}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "policies" && (
              <div className="tab-content">
                <div className="form-section">
                  <h3 className="form-section__title">
                    <SettingsIcon size={16} />
                    Studio Policies
                  </h3>

                  <div className="form-group">
                    <label
                      htmlFor="policies.cancellationPolicy"
                      className="form-label"
                    >
                      Cancellation Policy
                    </label>
                    <textarea
                      id="policies.cancellationPolicy"
                      name="policies.cancellationPolicy"
                      className="form-textarea"
                      value={formData.policies.cancellationPolicy}
                      onChange={handleInputChange}
                      placeholder="Describe your cancellation policy..."
                      rows={4}
                    />
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="policies.retakePolicy"
                      className="form-label"
                    >
                      Retake Policy
                    </label>
                    <textarea
                      id="policies.retakePolicy"
                      name="policies.retakePolicy"
                      className="form-textarea"
                      value={formData.policies.retakePolicy}
                      onChange={handleInputChange}
                      placeholder="Describe your retake policy..."
                      rows={4}
                    />
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="policies.paymentTerms"
                      className="form-label"
                    >
                      Payment Terms
                    </label>
                    <textarea
                      id="policies.paymentTerms"
                      name="policies.paymentTerms"
                      className="form-textarea"
                      value={formData.policies.paymentTerms}
                      onChange={handleInputChange}
                      placeholder="Describe your payment terms..."
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal__actions">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="studio-save-btn"
            >
              <Save size={16} />
              Save Settings
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudioSettingsModal;
