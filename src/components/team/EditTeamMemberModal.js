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
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { updateUserProfile, deleteUser } from "../../firebase/firestore";
import { useToast } from "../../contexts/ToastContext";
import Button from "../shared/Button";
import SimpleAddressField from "../shared/SimpleAddressField";
import "../shared/Modal.css";
import "./EditTeamMemberModal.css";

const EditTeamMemberModal = ({ isOpen, onClose, teamMember, onUpdate }) => {
  const { userProfile, organization } = useAuth();
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
    address: "", // Single string address
    homeAddress: "", // GPS coordinates in "lat,lng" format
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [addressDisplay, setAddressDisplay] = useState("");

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
        address: "", // Will be set below after checking format
        homeAddress: teamMember.homeAddress || "", // GPS coordinates
      });
      
      // Handle backward compatibility for address field
      let userAddress = "";
      if (typeof teamMember.address === 'string') {
        userAddress = teamMember.address;
      } else if (teamMember.address && typeof teamMember.address === 'object') {
        // Convert old format to string
        const { street, city, state, zipCode } = teamMember.address;
        const parts = [street, city, state, zipCode].filter(Boolean);
        userAddress = parts.join(", ");
      }
      
      // Update formData with the address
      setFormData(prev => ({
        ...prev,
        address: userAddress
      }));
      
      
      setAddressDisplay(userAddress);
    }
  }, [isOpen, teamMember]);

  // Check if current user is admin
  const isAdmin = userProfile?.role === "admin";

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for mileage rate - only allow numbers and decimal point
    if (name === "amountPerMile") {
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

  const handleAddressChange = (newAddress) => {
    setFormData(prev => ({
      ...prev,
      address: newAddress
    }));
    setAddressDisplay(newAddress);
  };

  const handleCoordinatesChange = (coordinates) => {
    // Update homeAddress with coordinates
    const coordString = `${coordinates[0]},${coordinates[1]}`;
    setFormData(prev => ({
      ...prev,
      homeAddress: coordString
    }));
    
    // Reverse geocode to get address from coordinates
    if (window.google?.maps?.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat: coordinates[0], lng: coordinates[1] } }, (results, status) => {
        if (status === "OK" && results[0]) {
          const address = results[0].formatted_address;
          setFormData(prev => ({
            ...prev,
            address: address
          }));
          setAddressDisplay(address);
        }
      });
    }
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
    setShowDeletePrompt(false);
    onClose();
  };

  const handleDeleteUser = async () => {
    setLoading(true);
    try {
      // Debug logging
      console.log("Current user:", userProfile);
      console.log("Team member to delete:", teamMember);
      console.log("Is current user admin?", userProfile?.role === "admin");
      
      // Use organization ID from auth context
      const orgId = teamMember.organizationID || organization?.id;
      if (!orgId) {
        throw new Error("Organization ID not found");
      }
      
      await deleteUser(teamMember.id, orgId);
      
      showToast("Team member deleted successfully", "success");
      
      // Update the team list
      if (onUpdate) {
        onUpdate();
      }
      
      // Close the edit modal
      onClose();
    } catch (error) {
      console.error("Error deleting team member:", error);
      
      // Provide more specific error messages
      if (error.code === 'permission-denied') {
        showToast("You don't have permission to delete users. Only admins can delete team members.", "error");
      } else {
        showToast("Failed to delete team member", "error");
      }
      
      setShowDeletePrompt(false);
    } finally {
      setLoading(false);
    }
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

                <SimpleAddressField
                  value={formData.address}
                  onChange={handleAddressChange}
                  onCoordinatesChange={handleCoordinatesChange}
                  placeholder="No address set"
                  label="Home Address"
                  hint="This address will be used to calculate mileage for reimbursements"
                  initialCoordinates={parseInitialCoordinates()}
                  organizationAddress={organization?.address}
                />
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

            <div className="modal__actions" style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                {/* Only show delete button if current user is not the same as team member */}
                {userProfile?.id !== teamMember.id && !showDeletePrompt && (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setShowDeletePrompt(true)}
                    disabled={loading}
                  >
                    Delete User
                  </Button>
                )}
                
                {/* Show confirmation prompt */}
                {showDeletePrompt && (
                  <>
                    <span style={{ color: 'var(--error-color)', fontWeight: 'var(--font-weight-medium)' }}>
                      Are you sure?
                    </span>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={handleDeleteUser}
                      disabled={loading}
                    >
                      Yes, Delete
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowDeletePrompt(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
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
                  disabled={loading}
                >
                  <Save size={16} />
                  Update
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(modalContent, document.body)}
    </>
  );
};

export default EditTeamMemberModal;