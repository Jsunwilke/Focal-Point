// src/components/settings/StudioSettingsModal.js
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
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
  Tag,
  Plus,
  Trash2,
  Calendar,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { updateOrganization } from "../../firebase/firestore";
import Button from "../shared/Button";
import { 
  getOrganizationSessionTypes, 
  createSessionType, 
  validateSessionType,
  getDefaultSessionTypesForNewOrg 
} from "../../utils/sessionTypes";
import PayPeriodForm from "./PayPeriodForm";
import "../shared/Modal.css";
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
    sessionTypes: [],
    payPeriodSettings: {
      isActive: false,
      type: 'bi-weekly',
      config: {
        startDate: new Date().toISOString().split('T')[0]
      }
    },
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("general");
  const [newSessionType, setNewSessionType] = useState({ name: '', color: '#3b82f6' });
  const [sessionTypeErrors, setSessionTypeErrors] = useState({});

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
        sessionTypes: organization.sessionTypes || getDefaultSessionTypesForNewOrg(),
        payPeriodSettings: organization.payPeriodSettings || {
          isActive: false,
          type: 'bi-weekly',
          config: {
            startDate: new Date().toISOString().split('T')[0]
          }
        },
      });
      console.log("Initialized session types:", organization.sessionTypes || getDefaultSessionTypesForNewOrg());
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

  // Session Type Management Functions
  const handleAddSessionType = () => {
    console.log("Adding session type:", newSessionType);
    const validation = validateSessionType(newSessionType);
    if (!validation.isValid) {
      console.log("Validation failed:", validation.errors);
      setSessionTypeErrors(validation.errors);
      return;
    }

    // Check for duplicate names
    const existingNames = formData.sessionTypes.map(type => type.name.toLowerCase());
    if (existingNames.includes(newSessionType.name.toLowerCase())) {
      console.log("Duplicate name found");
      setSessionTypeErrors({ name: 'Session type name already exists' });
      return;
    }

    const sessionType = createSessionType(newSessionType.name, newSessionType.color);
    console.log("Created session type:", sessionType);
    
    setFormData(prev => {
      const updated = {
        ...prev,
        sessionTypes: [...prev.sessionTypes, sessionType]
      };
      console.log("Updated session types:", updated.sessionTypes);
      return updated;
    });

    // Reset form
    setNewSessionType({ name: '', color: '#3b82f6' });
    setSessionTypeErrors({});
  };

  const handleRemoveSessionType = (sessionTypeId) => {
    // Prevent removing the "Other" type
    if (sessionTypeId === 'other') {
      return;
    }

    setFormData(prev => ({
      ...prev,
      sessionTypes: prev.sessionTypes.filter(type => type.id !== sessionTypeId)
    }));
  };

  const handleSessionTypeColorChange = (sessionTypeId, color) => {
    setFormData(prev => ({
      ...prev,
      sessionTypes: prev.sessionTypes.map(type => 
        type.id === sessionTypeId ? { ...type, color } : type
      )
    }));
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

    // Ensure we have at least one session type (should always have "Other")
    if (!formData.sessionTypes || formData.sessionTypes.length === 0) {
      console.log("No session types found, adding default");
      formData.sessionTypes = [{ id: 'other', name: 'Other', color: '#000000' }];
    }

    console.log("Form validation passed, session types:", formData.sessionTypes);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayPeriodChange = (payPeriodSettings) => {
    setFormData(prev => ({
      ...prev,
      payPeriodSettings
    }));
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

      console.log("Saving studio settings with session types:", updateData.sessionTypes);

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
    { id: "sessiontypes", label: "Session Types", icon: Tag },
    { id: "payperiods", label: "Pay Periods", icon: Calendar },
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
          handleCancel();
        }
      }}
    >
      <div 
        className="modal modal--large"
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
          width: "95%",
          maxWidth: "1000px",
          maxHeight: "95vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
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

        <form onSubmit={handleSubmit} className="modal__form" style={{ 
          display: "flex", 
          flexDirection: "column", 
          height: "100%",
          overflow: "hidden" 
        }}>
          {errors.submit && (
            <div className="form-error form-error--global">{errors.submit}</div>
          )}

          <div className="modal__content" style={{ 
            flex: 1, 
            overflow: "auto",
            minHeight: 0,
            padding: "0 1rem"
          }}>
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

            {activeTab === "sessiontypes" && (
              <div className="tab-content">
                <div className="form-section">
                  <h3 className="form-section__title">
                    <Tag size={16} />
                    Session Types
                  </h3>
                  <p className="form-section__description">
                    Customize the session types available for your organization. Each type has a unique color for easy identification.
                  </p>

                  {/* Add New Session Type */}
                  <div className="session-type-form">
                    <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>Add New Session Type</h4>
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 2 }}>
                        <label className="form-label">Session Type Name</label>
                        <input
                          type="text"
                          className={`form-input ${sessionTypeErrors.name ? 'form-input--error' : ''}`}
                          value={newSessionType.name}
                          onChange={(e) => {
                            setNewSessionType(prev => ({ ...prev, name: e.target.value }));
                            if (sessionTypeErrors.name) {
                              setSessionTypeErrors(prev => ({ ...prev, name: '' }));
                            }
                          }}
                          placeholder="e.g., School Dance, Team Photos"
                        />
                        {sessionTypeErrors.name && (
                          <span className="form-error-text">{sessionTypeErrors.name}</span>
                        )}
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Color</label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="color"
                            value={newSessionType.color}
                            onChange={(e) => setNewSessionType(prev => ({ ...prev, color: e.target.value }))}
                            style={{ width: '3rem', height: '2.5rem', border: 'none', borderRadius: '4px' }}
                          />
                          <input
                            type="text"
                            className="form-input"
                            value={newSessionType.color}
                            onChange={(e) => setNewSessionType(prev => ({ ...prev, color: e.target.value }))}
                            placeholder="#3b82f6"
                            style={{ flex: 1 }}
                          />
                        </div>
                        {sessionTypeErrors.color && (
                          <span className="form-error-text">{sessionTypeErrors.color}</span>
                        )}
                      </div>
                      <div className="form-group" style={{ flex: 0, display: 'flex', alignItems: 'end' }}>
                        <Button
                          type="button"
                          variant="primary"
                          onClick={handleAddSessionType}
                          style={{ height: '2.5rem' }}
                        >
                          <Plus size={16} />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Existing Session Types */}
                  <div className="session-types-list" style={{ marginTop: '2rem' }}>
                    <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>Current Session Types</h4>
                    <div className="session-types-grid" style={{ 
                      maxHeight: '300px', 
                      overflow: 'auto',
                      border: '1px solid var(--border-color, #dee2e6)',
                      borderRadius: '8px',
                      padding: '0.5rem'
                    }}>
                      {formData.sessionTypes.map((sessionType) => (
                        <div key={sessionType.id} className="session-type-item" style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '1rem',
                          border: '1px solid var(--border-color, #dee2e6)',
                          borderRadius: '8px',
                          marginBottom: '0.5rem'
                        }}>
                          <div style={{
                            width: '2rem',
                            height: '2rem',
                            backgroundColor: sessionType.color,
                            borderRadius: '4px',
                            border: '1px solid rgba(0,0,0,0.1)'
                          }}></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                              {sessionType.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6c757d)' }}>
                              {sessionType.color}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              type="color"
                              value={sessionType.color}
                              onChange={(e) => handleSessionTypeColorChange(sessionType.id, e.target.value)}
                              style={{ width: '2rem', height: '2rem', border: 'none', borderRadius: '4px' }}
                            />
                            {sessionType.id !== 'other' && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSessionType(sessionType.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--danger-color, #dc3545)',
                                  cursor: 'pointer',
                                  padding: '0.25rem'
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            {sessionType.id === 'other' && (
                              <div style={{ 
                                fontSize: '0.75rem', 
                                color: 'var(--text-secondary, #6c757d)',
                                fontStyle: 'italic',
                                padding: '0.25rem 0.5rem'
                              }}>
                                Default
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "payperiods" && (
              <div className="tab-content">
                <div className="form-section">
                  <h3 className="form-section__title">
                    <Calendar size={16} />
                    Pay Period Configuration
                  </h3>
                  <p className="form-section__description">
                    Configure how pay periods are calculated for timesheet reports and payroll processing.
                  </p>

                  <PayPeriodForm
                    value={formData.payPeriodSettings}
                    onChange={handlePayPeriodChange}
                    errors={errors}
                  />
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

          <div className="modal__actions" style={{ 
            flexShrink: 0,
            borderTop: "1px solid var(--border-color, #dee2e6)",
            padding: "1rem",
            backgroundColor: "var(--background, #ffffff)"
          }}>
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

  return ReactDOM.createPortal(modalContent, document.body);
};

export default StudioSettingsModal;
