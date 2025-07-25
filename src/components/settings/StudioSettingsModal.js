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
  Upload,
  Image,
  GripVertical,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { updateOrganization } from "../../firebase/firestore";
import { storage } from "../../firebase/config";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import Button from "../shared/Button";
import { 
  getOrganizationSessionTypes, 
  createSessionType, 
  validateSessionType,
  getDefaultSessionTypesForNewOrg,
  reorderSessionTypes,
  getNextSessionTypeOrder
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
    enableSessionPublishing: false,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("general");
  const [newSessionType, setNewSessionType] = useState({ name: '', color: '#3b82f6' });
  const [sessionTypeErrors, setSessionTypeErrors] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

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
        enableSessionPublishing: organization.enableSessionPublishing || false,
      });
      console.log("Initialized session types:", organization.sessionTypes || getDefaultSessionTypesForNewOrg());
      
      // Set logo preview if organization has a logo
      if (organization.logoURL) {
        setLogoPreview(organization.logoURL);
      }
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

    const sessionType = {
      ...createSessionType(newSessionType.name, newSessionType.color),
      order: getNextSessionTypeOrder(formData.sessionTypes)
    };
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

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    const sessionType = formData.sessionTypes[index];
    // Don't allow dragging the "Other" type
    if (sessionType.id === 'other') {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    const sessionType = formData.sessionTypes[index];
    // Don't allow dropping on "Other" type
    if (sessionType.id === 'other' || draggedIndex === null) return;
    
    setDragOverIndex(index);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const sessionType = formData.sessionTypes[dropIndex];
    // Don't allow dropping on "Other" type
    if (sessionType.id === 'other') {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder the session types
    const reorderedTypes = reorderSessionTypes(formData.sessionTypes, draggedIndex, dropIndex);
    
    setFormData(prev => ({
      ...prev,
      sessionTypes: reorderedTypes
    }));

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
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

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setErrors({ ...errors, logo: 'Please select a valid image file (PNG, JPG, or SVG)' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, logo: 'Image size must be less than 5MB' });
      return;
    }

    setLogoFile(file);
    setErrors({ ...errors, logo: null });

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadLogo = async () => {
    if (!logoFile || !organization?.id) return null;

    try {
      setUploadingLogo(true);
      
      // Delete old logo if exists
      if (organization.logoURL) {
        try {
          const oldLogoRef = ref(storage, `organizations/${organization.id}/logo`);
          await deleteObject(oldLogoRef);
        } catch (error) {
          // Ignore if old logo doesn't exist
          console.log('No old logo to delete');
        }
      }

      // Upload new logo
      const logoRef = ref(storage, `organizations/${organization.id}/logo`);
      const snapshot = await uploadBytes(logoRef, logoFile);
      const logoURL = await getDownloadURL(snapshot.ref);
      
      return logoURL;
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw new Error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Upload logo if changed
      let logoURL = organization.logoURL;
      if (logoFile) {
        logoURL = await uploadLogo();
      }

      // Prepare update data
      const updateData = {
        ...formData,
        ...(logoURL && { logoURL }),
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
    { id: "schedule", label: "Schedule", icon: Calendar },
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

                  <div className="form-section">
                    <h3 className="form-section__title">
                      <Image size={16} />
                      Studio Logo
                    </h3>
                    
                    <div className="form-group">
                      <label className="form-label">
                        Upload your studio logo
                      </label>
                      <p className="form-text">
                        Recommended size: 512x512px. Supports PNG, JPG, and SVG.
                      </p>
                      
                      <div className="logo-upload-container">
                        {logoPreview && (
                          <div className="logo-preview">
                            <img src={logoPreview} alt="Studio logo preview" />
                          </div>
                        )}
                        
                        <div className="logo-upload-controls">
                          <input
                            type="file"
                            id="logo-upload"
                            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                            onChange={handleLogoChange}
                            style={{ display: 'none' }}
                          />
                          <label
                            htmlFor="logo-upload"
                            className="btn btn-outline-primary"
                            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <Upload size={16} />
                            {logoPreview ? 'Change Logo' : 'Upload Logo'}
                          </label>
                          
                          {logoPreview && (
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              onClick={() => {
                                setLogoFile(null);
                                setLogoPreview(null);
                              }}
                              style={{ marginLeft: '0.5rem' }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        
                        {errors.logo && (
                          <span className="form-error-text">{errors.logo}</span>
                        )}
                        
                        {uploadingLogo && (
                          <div className="upload-progress">
                            <div className="spinner-border spinner-border-sm" role="status">
                              <span className="visually-hidden">Uploading...</span>
                            </div>
                            <span style={{ marginLeft: '0.5rem' }}>Uploading logo...</span>
                          </div>
                        )}
                      </div>
                    </div>
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
                    Customize the session types available for your organization. Each type has a unique color for easy identification. Drag items to reorder.
                  </p>

                  {/* Compact Add New Session Type Form */}
                  <div style={{ 
                    backgroundColor: 'var(--background-light, #f8f9fa)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.75rem'
                    }}>
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
                        placeholder="New session type name..."
                        style={{ 
                          flex: 1, 
                          height: '36px',
                          fontSize: '0.875rem'
                        }}
                      />
                      <input
                        type="color"
                        value={newSessionType.color}
                        onChange={(e) => setNewSessionType(prev => ({ ...prev, color: e.target.value }))}
                        style={{ 
                          width: '36px', 
                          height: '36px', 
                          border: '1px solid var(--border-color, #dee2e6)', 
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                        title="Choose color"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleAddSessionType}
                        style={{ 
                          height: '36px',
                          padding: '0 1rem',
                          fontSize: '0.875rem'
                        }}
                      >
                        <Plus size={14} />
                        Add
                      </Button>
                    </div>
                    {(sessionTypeErrors.name || sessionTypeErrors.color) && (
                      <div style={{ marginTop: '0.5rem' }}>
                        {sessionTypeErrors.name && (
                          <span className="form-error-text" style={{ fontSize: '0.75rem' }}>
                            {sessionTypeErrors.name}
                          </span>
                        )}
                        {sessionTypeErrors.color && (
                          <span className="form-error-text" style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                            {sessionTypeErrors.color}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Existing Session Types */}
                  <div className="session-types-list" style={{ marginTop: '1.5rem' }}>
                    <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary, #6c757d)' }}>
                      Current Session Types ({formData.sessionTypes.length})
                    </h4>
                    <div className="session-types-grid" style={{ 
                      display: 'grid',
                      gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(auto-fill, minmax(250px, 1fr))',
                      gap: '0.5rem',
                      maxHeight: '400px', 
                      overflow: 'auto',
                      padding: '0.5rem',
                      backgroundColor: 'var(--background-light, #f8f9fa)',
                      borderRadius: '8px'
                    }}>
                      {formData.sessionTypes.map((sessionType, index) => (
                        <div 
                          key={sessionType.id} 
                          className="session-type-item" 
                          draggable={sessionType.id !== 'other'}
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem',
                            border: `1px solid ${dragOverIndex === index ? 'var(--primary-color, #007bff)' : 'var(--border-color, #dee2e6)'}`,
                            borderRadius: '6px',
                            backgroundColor: dragOverIndex === index ? 'rgba(0, 123, 255, 0.05)' : 'white',
                            opacity: draggedIndex === index ? 0.5 : 1,
                            cursor: sessionType.id !== 'other' ? 'move' : 'default',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                          }}>
                          {sessionType.id !== 'other' ? (
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.25rem',
                              flexShrink: 0
                            }}>
                              <span style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '10px',
                                backgroundColor: 'var(--background-light, #f0f0f0)',
                                color: 'var(--text-secondary, #6c757d)',
                                fontSize: '0.7rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {formData.sessionTypes.filter(t => t.id !== 'other').findIndex(t => t.id === sessionType.id) + 1}
                              </span>
                              <GripVertical 
                                size={16} 
                                style={{ 
                                  color: 'var(--text-light, #6c757d)', 
                                  cursor: 'grab'
                                }} 
                              />
                            </div>
                          ) : (
                            <span style={{
                              padding: '0 0.5rem',
                              fontSize: '0.7rem',
                              fontWeight: '500',
                              color: 'var(--text-secondary, #6c757d)',
                              fontStyle: 'italic',
                              flexShrink: 0
                            }}>
                              Last
                            </span>
                          )}
                          <div style={{
                            width: '1rem',
                            height: '1rem',
                            backgroundColor: sessionType.color,
                            borderRadius: '3px',
                            border: '1px solid rgba(0,0,0,0.2)',
                            flexShrink: 0
                          }}></div>
                          <div style={{ 
                            flex: 1,
                            minWidth: 0,
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {sessionType.name}
                            {sessionType.id === 'other' && (
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: 'var(--text-secondary, #6c757d)',
                                marginLeft: '0.25rem',
                                fontWeight: 'normal'
                              }}>
                                (fixed)
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const input = document.createElement('input');
                                input.type = 'color';
                                input.value = sessionType.color;
                                input.onchange = (e) => handleSessionTypeColorChange(sessionType.id, e.target.value);
                                input.click();
                              }}
                              style={{
                                width: '24px',
                                height: '24px',
                                backgroundColor: sessionType.color,
                                border: '1px solid var(--border-color, #dee2e6)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                padding: 0
                              }}
                              title="Change color"
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
                                  padding: '0.25rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  opacity: 0.7,
                                  transition: 'opacity 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = 0.7}
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
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

            {activeTab === "schedule" && (
              <div className="tab-content">
                <div className="form-section">
                  <h3 className="form-section__title">
                    <Calendar size={16} />
                    Schedule Settings
                  </h3>
                  
                  <div className="form-group">
                    <div className="form-toggle-container">
                      <label className="form-toggle">
                        <input
                          type="checkbox"
                          name="enableSessionPublishing"
                          checked={formData.enableSessionPublishing || false}
                          onChange={(e) => {
                            setFormData(prev => ({
                              ...prev,
                              enableSessionPublishing: e.target.checked
                            }));
                          }}
                        />
                        <span className="form-toggle__slider"></span>
                        <span className="form-toggle__label">
                          Enable session publishing approval
                        </span>
                      </label>
                      <p className="form-text" style={{ marginTop: '0.5rem' }}>
                        When enabled, newly created sessions will require manual publishing before they are visible to employees. 
                        Administrators and managers can always see unpublished sessions.
                      </p>
                    </div>
                  </div>
                  
                  <div className="form-info" style={{
                    backgroundColor: '#e3f2fd',
                    border: '1px solid #2196f3',
                    borderRadius: '4px',
                    padding: '1rem',
                    marginTop: '1rem'
                  }}>
                    <h4 style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '600',
                      marginBottom: '0.5rem',
                      color: '#1976d2'
                    }}>
                      How Session Publishing Works
                    </h4>
                    <ul style={{ 
                      fontSize: '0.875rem', 
                      margin: '0',
                      paddingLeft: '1.25rem',
                      color: '#424242'
                    }}>
                      <li>Unpublished sessions appear with a dotted border and muted colors</li>
                      <li>A green "Publish" button appears in the schedule header when unpublished sessions exist</li>
                      <li>Sessions can be published individually or in bulk</li>
                      <li>When disabled, all sessions are automatically visible upon creation</li>
                    </ul>
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
