// src/components/team/EditTeamMemberModal.js
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Save,
  DollarSign,
  Shield,
  Map,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { updateUserProfile } from "../../firebase/firestore";
import { useToast } from "../../contexts/ToastContext";
import Button from "../shared/Button";
import MapModal from "../shared/MapModal";
import "../shared/Modal.css";
import "./EditTeamMemberModal.css";

const EditTeamMemberModal = ({ isOpen, onClose, teamMember, onUpdate }) => {
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    displayName: "",
    email: "",
    phone: "",
    position: "",
    role: "",
    bio: "",
    amountPerMile: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "USA",
    },
    homeAddress: "", // GPS coordinates in "lat,lng" format
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showMapModal, setShowMapModal] = useState(false);

  // Initialize form data when modal opens or team member changes
  useEffect(() => {
    if (isOpen && teamMember) {
      setFormData({
        firstName: teamMember.firstName || "",
        lastName: teamMember.lastName || "",
        displayName: teamMember.displayName || "",
        email: teamMember.email || "",
        phone: teamMember.phone || "",
        position: teamMember.position || "",
        role: teamMember.role || "",
        bio: teamMember.bio || "",
        amountPerMile: teamMember.amountPerMile ? teamMember.amountPerMile.toFixed(2) : "", // Display as dollar amount
        address: {
          street: teamMember.address?.street || "",
          city: teamMember.address?.city || "",
          state: teamMember.address?.state || "",
          zipCode: teamMember.address?.zipCode || "",
          country: teamMember.address?.country || "USA",
        },
        homeAddress: teamMember.homeAddress || "", // GPS coordinates
      });
    }
  }, [isOpen, teamMember]);

  // Check if current user is admin
  const isAdmin = userProfile?.role === "admin";

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Handle address fields
    if (name.startsWith("address.")) {
      const addressField = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } 
    // Special handling for mileage rate - only allow numbers and decimal point
    else if (name === "amountPerMile") {
      // Allow only numbers and one decimal point
      const numericValue = value.replace(/[^0-9.]/g, "");
      
      // Ensure only one decimal point
      const parts = numericValue.split(".");
      if (parts.length > 2) {
        return; // Don't update if more than one decimal point
      }
      
      // Limit to 2 decimal places
      if (parts[1] && parts[1].length > 2) {
        return;
      }
      
      setFormData((prev) => ({
        ...prev,
        [name]: numericValue,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
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

  const isValidAddress = () => {
    return formData.address?.street?.trim() && 
           formData.address?.city?.trim() && 
           formData.address?.state?.trim();
  };

  const getFormattedAddress = () => {
    if (!isValidAddress()) return "";
    const { street, city, state, zipCode } = formData.address;
    return `${street.trim()}, ${city.trim()}, ${state.trim()}${zipCode?.trim() ? ` ${zipCode.trim()}` : ""}`;
  };

  const parseInitialCoordinates = () => {
    if (!formData.homeAddress) return [39.7817, -89.6501]; // Default to Springfield, IL
    
    const coords = formData.homeAddress.split(",");
    if (coords.length === 2) {
      const lat = parseFloat(coords[0].trim());
      const lng = parseFloat(coords[1].trim());
      if (!isNaN(lat) && !isNaN(lng)) {
        return [lat, lng];
      }
    }
    return [39.7817, -89.6501]; // Fallback to default
  };

  const handleCoordinatesFromMap = (coordinates) => {
    const coordString = `${coordinates[0]},${coordinates[1]}`;
    setFormData((prev) => ({
      ...prev,
      homeAddress: coordString,
    }));
    setShowMapModal(false);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
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

    // Validate mileage rate
    if (formData.amountPerMile) {
      const mileageValue = parseFloat(formData.amountPerMile);
      if (isNaN(mileageValue) || mileageValue < 0) {
        newErrors.amountPerMile = "Please enter a valid mileage rate";
      } else if (mileageValue > 9.99) {
        newErrors.amountPerMile = "Mileage rate cannot exceed $9.99 per mile";
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
      // Prepare update data
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        displayName: formData.displayName || `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.phone,
        position: formData.position,
        role: formData.role,
        bio: formData.bio,
        address: formData.address,
        homeAddress: formData.homeAddress,
        updatedAt: new Date(),
      };

      // Add mileage rate if provided (already in dollar format)
      if (formData.amountPerMile) {
        updateData.amountPerMile = parseFloat(formData.amountPerMile);
      } else {
        updateData.amountPerMile = null;
      }

      // Update user profile in Firestore
      await updateUserProfile(teamMember.id, updateData);

      // Call onUpdate callback if provided
      if (onUpdate) {
        onUpdate();
      }

      // Show success message
      showToast("Team member updated successfully", "success");

      // Close modal
      onClose();
    } catch (error) {
      console.error("Error updating team member:", error);
      setErrors({ submit: "Failed to update team member. Please try again." });
      showToast("Failed to update team member", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setErrors({});
    onClose();
  };

  if (!isOpen || !teamMember) return null;

  // Only allow admins to edit team members
  if (!isAdmin) {
    return null;
  }

  const roles = [
    { value: "admin", label: "Admin" },
    { value: "manager", label: "Manager" },
    { value: "employee", label: "Employee" },
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
        padding: "40px 20px",
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
          maxHeight: "80vh",
          width: "100%",
          maxWidth: "800px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">Edit Team Member</h2>
            <p className="modal__subtitle">
              Update {teamMember.displayName || `${teamMember.firstName} ${teamMember.lastName}`}'s information
            </p>
          </div>
          <button className="modal__close" onClick={handleCancel} type="button">
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: "1", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {errors.submit && (
              <div className="form-error form-error--global" style={{ margin: "0 24px 16px 24px" }}>{errors.submit}</div>
            )}

            <div className="modal__content" style={{ flex: "1", overflowY: "auto", padding: "0 24px" }}>
            <div className="tab-content">
              <div className="form-section">
                <h3 className="form-section__title">
                  <User size={16} />
                  Personal Information
                </h3>

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
                      onChange={handleInputChange}
                      required
                    />
                    {errors.firstName && (
                      <span className="form-error-text">
                        {errors.firstName}
                      </span>
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
                      onChange={handleInputChange}
                      required
                    />
                    {errors.lastName && (
                      <span className="form-error-text">{errors.lastName}</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="displayName" className="form-label">
                    Display Name
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    name="displayName"
                    className="form-input"
                    value={formData.displayName}
                    onChange={handleInputChange}
                    placeholder="How their name should appear"
                  />
                  <span className="form-hint">
                    Leave blank to use "First Name Last Name"
                  </span>
                </div>

                <div className="form-row">
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
                      onChange={handleInputChange}
                      placeholder="e.g., Lead Photographer, Assistant"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="role" className="form-label">
                      Role *
                    </label>
                    <select
                      id="role"
                      name="role"
                      className="form-select"
                      value={formData.role}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select role...</option>
                      {roles.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="bio" className="form-label">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    className="form-textarea"
                    value={formData.bio}
                    onChange={handleInputChange}
                    placeholder="Brief description about team member..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="form-section">
                <h3 className="form-section__title">
                  <Mail size={16} />
                  Contact Information
                </h3>

                <div className="form-row">
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
                      onChange={handleInputChange}
                      required
                    />
                    {errors.email && (
                      <span className="form-error-text">{errors.email}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="phone" className="form-label">
                      Phone Number
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
                  <label htmlFor="street" className="form-label">
                    Street Address
                  </label>
                  <input
                    type="text"
                    id="street"
                    name="address.street"
                    className="form-input"
                    value={formData.address.street}
                    onChange={handleInputChange}
                    placeholder="123 Main Street"
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
                      name="address.city"
                      className="form-input"
                      value={formData.address.city}
                      onChange={handleInputChange}
                      placeholder="New York"
                    />
                  </div>

                  <div className="form-group" style={{ flex: "0 0 120px" }}>
                    <label htmlFor="state" className="form-label">
                      State
                    </label>
                    <input
                      type="text"
                      id="state"
                      name="address.state"
                      className="form-input"
                      value={formData.address.state}
                      onChange={handleInputChange}
                      placeholder="NY"
                      maxLength="2"
                    />
                  </div>

                  <div className="form-group" style={{ flex: "0 0 140px" }}>
                    <label htmlFor="zipCode" className="form-label">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      id="zipCode"
                      name="address.zipCode"
                      className="form-input"
                      value={formData.address.zipCode}
                      onChange={handleInputChange}
                      placeholder="10001"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="country" className="form-label">
                    Country
                  </label>
                  <input
                    type="text"
                    id="country"
                    name="address.country"
                    className="form-input"
                    value={formData.address.country}
                    onChange={handleInputChange}
                    placeholder="USA"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Home Location
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <input
                      type="text"
                      value={formData.homeAddress || "No location set"}
                      className="form-input"
                      disabled
                      style={{ flex: 1 }}
                    />
                    {isValidAddress() && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowMapModal(true)}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        <Map size={16} />
                        Set on Map
                      </Button>
                    )}
                  </div>
                  <span className="form-hint">
                    {isValidAddress() 
                      ? "Click 'Set on Map' to pinpoint the exact home location"
                      : "Complete the address fields above to enable map location setting"
                    }
                  </span>
                </div>
              </div>

              <div className="form-section">
                <h3 className="form-section__title">
                  <DollarSign size={16} />
                  Compensation
                </h3>

                <div className="form-group">
                  <label htmlFor="amountPerMile" className="form-label">
                    Mileage Rate (dollars per mile)
                  </label>
                  <div className="form-input-group">
                    <span className="form-input-prefix">$</span>
                    <input
                      type="text"
                      id="amountPerMile"
                      name="amountPerMile"
                      className={`form-input form-input--with-prefix ${
                        errors.amountPerMile ? "form-input--error" : ""
                      }`}
                      value={formData.amountPerMile}
                      onChange={handleInputChange}
                      placeholder="0.30"
                    />
                    <span className="form-input-suffix">/mile</span>
                  </div>
                  {errors.amountPerMile && (
                    <span className="form-error-text">{errors.amountPerMile}</span>
                  )}
                  <span className="form-hint">
                    Enter the rate in dollars (e.g., 0.30 for $0.30 per mile)
                  </span>
                </div>
              </div>
            </div>
            </div>

            <div className="modal__actions" style={{ flexShrink: 0 }}>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
              >
                <Save size={16} />
                Update
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(modalContent, document.body)}
      
      {/* Map Modal */}
      <MapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        initialCoordinates={parseInitialCoordinates()}
        initialAddress={getFormattedAddress()}
        onCoordinatesChange={handleCoordinatesFromMap}
        title="Set Home Location"
        subtitle="Drag the pin or click on the map to set the exact home/driveway location"
      />
    </>
  );
};

export default EditTeamMemberModal;