// src/components/schools/AddSchoolModal.js
import React, { useState } from "react";
import ReactDOM from "react-dom";
import { X, School, MapPin, User, Mail, Phone, Save, Map } from "lucide-react";
import Button from "../shared/Button";
import MapModal from "../shared/MapModal";
import "../shared/Modal.css";
import "./AddSchoolModal.css";

const AddSchoolModal = ({
  school = null,
  onClose,
  onAdd,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState({
    // School name (using 'value' to match your current structure)
    value: school?.value || school?.name || "",

    // Address fields
    street: school?.street || "",
    city: school?.city || "",
    state: school?.state || "",
    zipCode: school?.zipCode || "",

    // Coordinates (keep your current format)
    coordinates: school?.coordinates || school?.schoolAddress || "",

    // Contact information
    contactName: school?.contactName || "",
    contactEmail: school?.contactEmail || "",
    contactPhone: school?.contactPhone || "",

    // Notes
    notes: school?.notes || "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showMapModal, setShowMapModal] = useState(false);

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

    if (!formData.value.trim()) {
      newErrors.value = "School name is required";
    }

    // Validate coordinates format if provided
    if (formData.coordinates && formData.coordinates.trim()) {
      const coordPattern = /^-?\d+\.?\d*,-?\d+\.?\d*$/;
      if (!coordPattern.test(formData.coordinates.trim())) {
        newErrors.coordinates =
          "Coordinates must be in format: latitude,longitude (e.g., 39.7817,-89.6501)";
      }
    }

    // Validate email format if provided
    if (formData.contactEmail && formData.contactEmail.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(formData.contactEmail)) {
        newErrors.contactEmail = "Please enter a valid email address";
      }
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
      // Clean up the data before submitting
      const cleanedData = {};
      Object.keys(formData).forEach((key) => {
        const value = formData[key]?.trim();
        if (value) {
          cleanedData[key] = value;
        }
      });

      await onAdd(cleanedData);
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCoordinatesFromMap = (coordinates) => {
    const coordString = `${coordinates[0]},${coordinates[1]}`;
    setFormData((prev) => ({
      ...prev,
      coordinates: coordString,
    }));
    setShowMapModal(false);
    
    // Clear any coordinate errors
    if (errors.coordinates) {
      setErrors((prev) => ({
        ...prev,
        coordinates: "",
      }));
    }
  };

  const parseInitialCoordinates = () => {
    if (!formData.coordinates) return [39.7817, -89.6501]; // Default to Springfield, IL
    
    const coords = formData.coordinates.split(",");
    if (coords.length === 2) {
      const lat = parseFloat(coords[0].trim());
      const lng = parseFloat(coords[1].trim());
      if (!isNaN(lat) && !isNaN(lng)) {
        return [lat, lng];
      }
    }
    return [39.7817, -89.6501]; // Fallback to default
  };

  const isValidAddress = () => {
    return formData.street?.trim() && 
           formData.city?.trim() && 
           formData.state?.trim();
  };

  const getFormattedAddress = () => {
    if (!isValidAddress()) return "";
    return `${formData.street.trim()}, ${formData.city.trim()}, ${formData.state.trim()}${formData.zipCode?.trim() ? ` ${formData.zipCode.trim()}` : ""}`;
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
        className="modal modal--large"
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">
              {isEditing ? "Edit School" : "Add School"}
            </h2>
            <p className="modal__subtitle">
              {isEditing ? "Update school information and contact details" : "Add a new school to your organization"}
            </p>
          </div>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <form 
          onSubmit={handleSubmit} 
          className="modal__form"
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column"
          }}
        >
          {errors.submit && (
            <div className="form-error form-error--global">{errors.submit}</div>
          )}

          <div 
            className="modal__content"
            style={{
              maxHeight: "60vh",
              overflowY: "auto",
              flex: "1"
            }}
          >
            <div className="form-section">
            <h3 className="form-section__title">
              <School size={16} />
              School Information
            </h3>

            <div className="form-group">
              <label htmlFor="value" className="form-label">
                School Name *
              </label>
              <input
                type="text"
                id="value"
                name="value"
                className={`form-input ${
                  errors.value ? "form-input--error" : ""
                }`}
                value={formData.value}
                onChange={handleChange}
                placeholder="e.g., Lincoln Elementary School"
                required
              />
              {errors.value && (
                <span className="form-error-text">{errors.value}</span>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section__title">
              <MapPin size={16} />
              Location
            </h3>

            <div className="form-group">
              <label htmlFor="street" className="form-label">
                Street Address
              </label>
              <input
                type="text"
                id="street"
                name="street"
                className="form-input"
                value={formData.street}
                onChange={handleChange}
                placeholder="123 School Street"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="city" className="form-label">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  className="form-input"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Springfield"
                />
              </div>

              <div className="form-group">
                <label htmlFor="state" className="form-label">
                  State
                </label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  className="form-input"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="IL"
                />
              </div>

              <div className="form-group">
                <label htmlFor="zipCode" className="form-label">
                  ZIP Code
                </label>
                <input
                  type="text"
                  id="zipCode"
                  name="zipCode"
                  className="form-input"
                  value={formData.zipCode}
                  onChange={handleChange}
                  placeholder="62701"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="coordinates" className="form-label">
                GPS Coordinates
              </label>
              <div className="form-input-group">
                <input
                  type="text"
                  id="coordinates"
                  name="coordinates"
                  className={`form-input ${
                    errors.coordinates ? "form-input--error" : ""
                  }`}
                  value={formData.coordinates}
                  readOnly
                  placeholder={isValidAddress() ? "Will be set from map location" : "Enter address first to set location"}
                />
                {isValidAddress() && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowMapModal(true)}
                    className="form-input-button"
                  >
                    <Map size={16} />
                    Set on Map
                  </Button>
                )}
              </div>
              {errors.coordinates && (
                <span className="form-error-text">{errors.coordinates}</span>
              )}
              <span className="form-hint">
                {isValidAddress() 
                  ? "Click 'Set on Map' to pinpoint the exact school location"
                  : "Complete the address fields above to enable map location setting"
                }
              </span>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section__title">
              <User size={16} />
              Contact Information
            </h3>

            <div className="form-group">
              <label htmlFor="contactName" className="form-label">
                Contact Name
              </label>
              <input
                type="text"
                id="contactName"
                name="contactName"
                className="form-input"
                value={formData.contactName}
                onChange={handleChange}
                placeholder="Principal Smith"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="contactEmail" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="contactEmail"
                  name="contactEmail"
                  className={`form-input ${
                    errors.contactEmail ? "form-input--error" : ""
                  }`}
                  value={formData.contactEmail}
                  onChange={handleChange}
                  placeholder="principal@school.edu"
                />
                {errors.contactEmail && (
                  <span className="form-error-text">{errors.contactEmail}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="contactPhone" className="form-label">
                  Phone
                </label>
                <input
                  type="tel"
                  id="contactPhone"
                  name="contactPhone"
                  className="form-input"
                  value={formData.contactPhone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section__title">Additional Information</h3>

            <div className="form-group">
              <label htmlFor="notes" className="form-label">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                className="form-textarea"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any special instructions, parking info, etc."
                rows={3}
              />
            </div>
          </div>
          </div>

          <div 
            className="modal__actions"
            style={{
              flexShrink: 0,
              marginTop: "auto"
            }}
          >
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              <Save size={16} />
              {isEditing ? "Save Changes" : "Add School"}
            </Button>
          </div>
        </form>
      </div>

      {/* Map Modal */}
      <MapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        initialCoordinates={parseInitialCoordinates()}
        initialAddress={getFormattedAddress()}
        onCoordinatesChange={handleCoordinatesFromMap}
      />
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default AddSchoolModal;
