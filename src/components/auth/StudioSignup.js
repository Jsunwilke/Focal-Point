// src/components/auth/StudioSignup.js
import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Button from "../shared/Button";
import "./StudioSignup.css";

const StudioSignup = ({ onBack }) => {
  const { createStudio, loading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState("");

  const [studioData, setStudioData] = useState({
    name: "",
    email: "",
    phone: "",
    address: {
      street: "",
      city: "",
      state: "",
      zip: "",
      country: "US",
    },
  });

  const [userData, setUserData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleStudioChange = (e) => {
    const { name, value } = e.target;
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setStudioData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setStudioData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleUserChange = (e) => {
    const { name, value } = e.target;
    setUserData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleStep1Submit = (e) => {
    e.preventDefault();
    setError("");

    // Basic validation
    if (!studioData.name || !studioData.email) {
      setError("Please fill in all required fields");
      return;
    }

    setCurrentStep(2);
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (
      !userData.firstName ||
      !userData.lastName ||
      !userData.email ||
      !userData.password
    ) {
      setError("Please fill in all required fields");
      return;
    }

    if (userData.password !== userData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (userData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      await createStudio(
        userData.email,
        userData.password,
        studioData,
        userData
      );
    } catch (err) {
      setError(err.message || "Failed to create studio");
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="signup-header">
          <h1 className="signup-title">Create Your Studio</h1>
          <div className="signup-steps">
            <div className={`step ${currentStep >= 1 ? "step--active" : ""}`}>
              <span className="step-number">1</span>
              <span className="step-label">Studio Info</span>
            </div>
            <div className="step-divider"></div>
            <div className={`step ${currentStep >= 2 ? "step--active" : ""}`}>
              <span className="step-number">2</span>
              <span className="step-label">Admin Account</span>
            </div>
          </div>
        </div>

        {error && <div className="signup-error">{error}</div>}

        {currentStep === 1 && (
          <form onSubmit={handleStep1Submit} className="signup-form">
            <h3 className="form-section-title">Studio Information</h3>

            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Studio Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className="form-input"
                value={studioData.name}
                onChange={handleStudioChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Studio Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-input"
                value={studioData.email}
                onChange={handleStudioChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone" className="form-label">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                className="form-input"
                value={studioData.phone}
                onChange={handleStudioChange}
              />
            </div>

            <h4 className="form-subsection-title">Address</h4>

            <div className="form-group">
              <label htmlFor="street" className="form-label">
                Street Address
              </label>
              <input
                type="text"
                id="street"
                name="address.street"
                className="form-input"
                value={studioData.address.street}
                onChange={handleStudioChange}
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
                  value={studioData.address.city}
                  onChange={handleStudioChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="state" className="form-label">
                  State
                </label>
                <input
                  type="text"
                  id="state"
                  name="address.state"
                  className="form-input"
                  value={studioData.address.state}
                  onChange={handleStudioChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="zip" className="form-label">
                  ZIP
                </label>
                <input
                  type="text"
                  id="zip"
                  name="address.zip"
                  className="form-input"
                  value={studioData.address.zip}
                  onChange={handleStudioChange}
                />
              </div>
            </div>

            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={onBack}>
                Back to Login
              </Button>
              <Button type="submit" variant="primary">
                Next Step
              </Button>
            </div>
          </form>
        )}

        {currentStep === 2 && (
          <form onSubmit={handleStep2Submit} className="signup-form">
            <h3 className="form-section-title">Admin Account</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName" className="form-label">
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  className="form-input"
                  value={userData.firstName}
                  onChange={handleUserChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName" className="form-label">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  className="form-input"
                  value={userData.lastName}
                  onChange={handleUserChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="userEmail" className="form-label">
                Your Email *
              </label>
              <input
                type="email"
                id="userEmail"
                name="email"
                className="form-input"
                value={userData.email}
                onChange={handleUserChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password *
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="form-input"
                value={userData.password}
                onChange={handleUserChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm Password *
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                className="form-input"
                value={userData.confirmPassword}
                onChange={handleUserChange}
                required
              />
            </div>

            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCurrentStep(1)}
              >
                Back
              </Button>
              <Button type="submit" variant="primary" loading={loading}>
                Create Studio
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default StudioSignup;
