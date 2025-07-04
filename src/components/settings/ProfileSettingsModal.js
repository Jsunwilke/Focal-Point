// src/components/settings/ProfileSettingsModal.js
import React, { useState, useEffect, useRef } from "react";
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Save,
  Camera,
  Upload,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  updateUserProfile,
  updateUserPhotoWithCrop,
} from "../../firebase/firestore";
import {
  uploadUserPhotoWithCrop,
  deleteUserPhoto,
  recropUserPhoto,
} from "../../services/photoUpload";
import Button from "../shared/Button";
import ImageCropModal from "../shared/ImageCropModal";
import "./ProfileSettingsModal.css";

const ProfileSettingsModal = ({ isOpen, onClose }) => {
  const { userProfile, user, loadUserProfile } = useAuth();
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    displayName: "",
    email: "",
    phone: "",
    position: "",
    bio: "",
    photoURL: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "US",
    },
    preferences: {
      emailNotifications: true,
      pushNotifications: true,
      weeklyDigest: true,
      scheduleReminders: true,
    },
  });

  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("personal");
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);

  // Initialize form data when modal opens or user profile changes
  useEffect(() => {
    if (isOpen && userProfile) {
      setFormData({
        firstName: userProfile.firstName || "",
        lastName: userProfile.lastName || "",
        displayName: userProfile.displayName || "",
        email: userProfile.email || user?.email || "",
        phone: userProfile.phone || "",
        position: userProfile.position || "",
        bio: userProfile.bio || "",
        photoURL: userProfile.photoURL || "",
        originalPhotoURL: userProfile.originalPhotoURL || "",
        photoCropSettings: userProfile.photoCropSettings || null,
        address: {
          street: userProfile.address?.street || "",
          city: userProfile.address?.city || "",
          state: userProfile.address?.state || "",
          zipCode: userProfile.address?.zipCode || "",
          country: userProfile.address?.country || "US",
        },
        preferences: {
          emailNotifications:
            userProfile.preferences?.emailNotifications ?? true,
          pushNotifications: userProfile.preferences?.pushNotifications ?? true,
          weeklyDigest: userProfile.preferences?.weeklyDigest ?? true,
          scheduleReminders: userProfile.preferences?.scheduleReminders ?? true,
        },
      });
    }
  }, [isOpen, userProfile, user]);

  const handlePhotoSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setErrors({
        photo: "Invalid file type. Please upload a JPEG, PNG, or WebP image.",
      });
      return;
    }

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      setErrors({
        photo: "File size too large. Please upload an image smaller than 20MB.",
      });
      return;
    }

    // Clear any previous errors
    setErrors((prev) => ({ ...prev, photo: "" }));

    // Set the selected file and show crop modal
    setSelectedImageFile(file);
    setShowCropModal(true);

    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePhotoUpload = async (croppedFile, cropSettings) => {
    setPhotoLoading(true);
    setShowCropModal(false);

    try {
      // Upload both original and cropped photos with crop settings
      const photoData = await uploadUserPhotoWithCrop(
        user.uid,
        selectedImageFile, // Original file
        cropSettings,
        formData.photoURL // Pass existing photo URL to delete it
      );

      // Update form data with all photo information
      setFormData((prev) => ({
        ...prev,
        photoURL: photoData.croppedURL,
        originalPhotoURL: photoData.originalURL,
        photoCropSettings: photoData.cropSettings,
      }));

      // Update user profile in Firestore with crop metadata
      await updateUserPhotoWithCrop(user.uid, photoData);

      // Reload user profile to reflect changes
      await loadUserProfile();
    } catch (error) {
      console.error("Error uploading photo:", error);
      setErrors({ photo: error.message });
    } finally {
      setPhotoLoading(false);
      setSelectedImageFile(null);
    }
  };

  const handleRecropPhoto = () => {
    if (formData.originalPhotoURL && formData.photoCropSettings) {
      // Re-open crop modal with existing settings for re-editing
      setSelectedImageFile(null); // Will load from originalPhotoURL
      setShowCropModal(true);
    }
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setSelectedImageFile(null);
  };

  const handlePhotoDelete = async () => {
    if (!formData.photoURL) return;

    if (
      !window.confirm("Are you sure you want to delete your profile photo?")
    ) {
      return;
    }

    setPhotoLoading(true);
    try {
      // Delete from Firebase Storage
      await deleteUserPhoto(formData.photoURL);

      // Update form data
      setFormData((prev) => ({
        ...prev,
        photoURL: "",
      }));

      // Update user profile in Firestore
      await updateUserPhotoURL(user.uid, "");

      // Reload user profile to reflect changes
      await loadUserProfile();
    } catch (error) {
      console.error("Error deleting photo:", error);
      setErrors({ photo: error.message });
    } finally {
      setPhotoLoading(false);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getUserInitials = () => {
    if (formData.firstName && formData.lastName) {
      return `${formData.firstName[0]}${formData.lastName[0]}`.toUpperCase();
    }
    if (userProfile?.firstName && userProfile?.lastName) {
      return `${userProfile.firstName[0]}${userProfile.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || "U";
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === "checkbox" ? checked : value,
        },
      }));
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

    // Clear photo errors when other fields change
    if (errors.photo) {
      setErrors((prev) => ({
        ...prev,
        photo: "",
      }));
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
        displayName:
          formData.displayName || `${formData.firstName} ${formData.lastName}`,
        updatedAt: new Date(),
      };

      // Update user profile in Firestore
      await updateUserProfile(user.uid, updateData);

      // Reload user profile to get fresh data
      await loadUserProfile();

      // Close modal
      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
      setErrors({ submit: "Failed to update profile. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  const tabs = [
    { id: "personal", label: "Personal Info", icon: User },
    { id: "contact", label: "Contact & Address", icon: MapPin },
    { id: "preferences", label: "Notifications", icon: Mail },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal modal--large">
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">Profile Settings</h2>
            <p className="modal__subtitle">
              Manage your personal information and preferences
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
            {activeTab === "personal" && (
              <div className="tab-content">
                <div className="profile-avatar-section">
                  <div className="profile-avatar">
                    <div className="profile-avatar__image">
                      {formData.photoURL ? (
                        <img
                          src={formData.photoURL}
                          alt="Profile"
                          className="profile-avatar__photo"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className="profile-avatar__initials"
                        style={{ display: formData.photoURL ? "none" : "flex" }}
                      >
                        {getUserInitials()}
                      </div>
                    </div>
                    <div className="profile-avatar__actions">
                      <button
                        type="button"
                        className="profile-avatar__change"
                        onClick={triggerFileInput}
                        disabled={photoLoading}
                      >
                        {photoLoading ? (
                          <>
                            <div className="spinner-sm"></div>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload size={14} />
                            {formData.photoURL
                              ? "Change Photo"
                              : "Upload Photo"}
                          </>
                        )}
                      </button>
                      {formData.photoURL && (
                        <>
                          <button
                            type="button"
                            className="profile-avatar__delete"
                            onClick={handlePhotoDelete}
                            disabled={photoLoading}
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                          {formData.originalPhotoURL && (
                            <button
                              type="button"
                              className="profile-avatar__recrop"
                              onClick={handleRecropPhoto}
                              disabled={photoLoading}
                            >
                              <Camera size={14} />
                              Adjust Crop
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      style={{ display: "none" }}
                    />
                  </div>
                  <div className="profile-avatar__info">
                    <h3>Profile Photo</h3>
                    <p>
                      Upload a profile photo to help your team recognize you
                    </p>
                    {errors.photo && (
                      <p className="form-error-text">{errors.photo}</p>
                    )}
                    <div className="profile-avatar__requirements">
                      <p>• JPEG, PNG, or WebP format</p>
                      <p>• Maximum 20MB file size</p>
                      <p>• Recommended: High resolution for best quality</p>
                    </div>
                  </div>
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
                    placeholder="How you'd like your name to appear"
                  />
                  <span className="form-hint">
                    Leave blank to use "First Name Last Name"
                  </span>
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
                    onChange={handleInputChange}
                    placeholder="e.g., Lead Photographer, Assistant"
                  />
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
                    placeholder="Tell your team a little about yourself..."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {activeTab === "contact" && (
              <div className="tab-content">
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
                      onChange={handleInputChange}
                      required
                      disabled // Email changes should go through Firebase Auth
                    />
                    {errors.email && (
                      <span className="form-error-text">{errors.email}</span>
                    )}
                    <span className="form-hint">
                      Contact your administrator to change your email address
                    </span>
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

                <div className="form-section">
                  <h3 className="form-section__title">
                    <MapPin size={16} />
                    Address
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
                      placeholder="123 Main Street"
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
              </div>
            )}

            {activeTab === "preferences" && (
              <div className="tab-content">
                <div className="form-section">
                  <h3 className="form-section__title">
                    <Mail size={16} />
                    Notification Preferences
                  </h3>
                  <p className="form-section__description">
                    Choose how you'd like to receive notifications and updates
                  </p>

                  <div className="preference-group">
                    <div className="preference-item">
                      <div className="preference-item__info">
                        <h4 className="preference-item__title">
                          Email Notifications
                        </h4>
                        <p className="preference-item__description">
                          Receive important updates via email
                        </p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          name="preferences.emailNotifications"
                          checked={formData.preferences.emailNotifications}
                          onChange={handleInputChange}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="preference-item">
                      <div className="preference-item__info">
                        <h4 className="preference-item__title">
                          Push Notifications
                        </h4>
                        <p className="preference-item__description">
                          Receive instant notifications in your browser
                        </p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          name="preferences.pushNotifications"
                          checked={formData.preferences.pushNotifications}
                          onChange={handleInputChange}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="preference-item">
                      <div className="preference-item__info">
                        <h4 className="preference-item__title">
                          Weekly Digest
                        </h4>
                        <p className="preference-item__description">
                          Get a summary of your week every Monday
                        </p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          name="preferences.weeklyDigest"
                          checked={formData.preferences.weeklyDigest}
                          onChange={handleInputChange}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="preference-item">
                      <div className="preference-item__info">
                        <h4 className="preference-item__title">
                          Schedule Reminders
                        </h4>
                        <p className="preference-item__description">
                          Get reminders about upcoming sessions
                        </p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          name="preferences.scheduleReminders"
                          checked={formData.preferences.scheduleReminders}
                          onChange={handleInputChange}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
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
              className="profile-save-btn"
            >
              <Save size={16} />
              Save Changes
            </Button>
          </div>
        </form>
      </div>

      {/* Image Crop Modal */}
      <ImageCropModal
        isOpen={showCropModal}
        imageFile={selectedImageFile}
        existingCropSettings={formData.photoCropSettings}
        originalImageURL={formData.originalPhotoURL}
        onCrop={handlePhotoUpload}
        onCancel={handleCropCancel}
      />
    </div>
  );
};

export default ProfileSettingsModal;
