// src/components/auth/InvitationAcceptance.js
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Mail, User, Shield, Check } from "lucide-react";
import { createUser } from "../../firebase/auth";
import {
  acceptInvitation,
  getInvitationByEmail,
} from "../../firebase/firestore";
import organizationCacheService from "../../services/organizationCacheService";
import Button from "../shared/Button";
import LoadingSpinner from "../shared/LoadingSpinner";
import "./InvitationAcceptance.css";

const InvitationAcceptance = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState("verify"); // verify, setup, complete

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [loadingMessage, setLoadingMessage] = useState("");

  const email = searchParams.get("email");

  useEffect(() => {
    if (email) {
      loadInvitation();
    } else {
      setError("Invalid invitation link");
      setLoading(false);
    }
  }, [email]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      const invite = await getInvitationByEmail(email);

      if (!invite) {
        setError("Invitation not found or may have expired");
        return;
      }

      if (invite.isActive) {
        setError("This invitation has already been accepted");
        return;
      }

      setInvitation(invite);
      setStep("setup");
    } catch (err) {
      setError("Failed to load invitation");
      console.error("Error loading invitation:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAcceptInvitation = async (e) => {
    e.preventDefault();
    setError("");

    // Validate passwords
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      setLoadingMessage("Creating your account...");

      // Create Firebase auth account
      const user = await createUser(invitation.email, formData.password);
      
      setLoadingMessage("Setting up your profile...");
      
      // Small delay to show the message
      await new Promise(resolve => setTimeout(resolve, 500));

      // Activate the invitation (update the user record)
      await acceptInvitation(invitation.id, user.uid);
      
      setLoadingMessage("Finalizing setup...");
      
      // Clear the team members cache so Team Management page shows the new user
      if (invitation.organizationID) {
        organizationCacheService.clearTeamMembersCache(invitation.organizationID);
      }
      
      // Another small delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clear loading state before showing welcome screen
      setLoading(false);
      setLoadingMessage("");
      setStep("complete");

      // Redirect to dashboard after showing welcome
      // User is already signed in after createUser
      setTimeout(() => {
        navigate("/");
      }, 2500);
    } catch (err) {
      setError(err.message || "Failed to create account");
      setLoadingMessage("");
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "admin":
        return <Shield size={20} className="role-icon role-icon--admin" />;
      case "manager":
        return <User size={20} className="role-icon role-icon--manager" />;
      default:
        return <User size={20} className="role-icon role-icon--employee" />;
    }
  };

  const getRoleDescription = (role) => {
    switch (role) {
      case "admin":
        return "Full access to all studio features and settings";
      case "manager":
        return "Can manage team members and schedules";
      default:
        return "Access to assigned tasks and photography sessions";
    }
  };

  if (loading && step === "verify") {
    return (
      <div className="invitation-loading">
        <LoadingSpinner size="large" />
        <p>Verifying invitation...</p>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="invitation-error">
        <div className="invitation-error__content">
          <h1>Invalid Invitation</h1>
          <p>{error}</p>
          <Button variant="primary" onClick={() => navigate("/")}>
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (step === "complete") {
    return (
      <div className="invitation-success">
        <div className="invitation-success__content">
          <div className="success-icon">
            <Check size={48} />
          </div>
          <h1>Welcome to {invitation?.organizationName}!</h1>
          <h2>Great to have you on the team, {invitation?.firstName}!</h2>
          <div className="success-details">
            <p>✓ Account created successfully</p>
            <p>✓ Profile set up as {invitation?.role}</p>
            <p>✓ Access granted to studio features</p>
          </div>
          <p className="redirect-message">Taking you to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="invitation-page">
      <div className="invitation-container">
        <div className="invitation-header">
          <h1 className="invitation-title">Join the Team</h1>
          <p className="invitation-subtitle">
            You've been invited to join {invitation?.organizationName}
          </p>
        </div>

        {invitation && (
          <div className="invitation-details">
            <div className="invitation-info">
              <h3 className="invitation-info__title">
                <Mail size={16} />
                Your Invitation Details
              </h3>

              <div className="invitation-info__content">
                <div className="info-item">
                  <span className="info-label">Name:</span>
                  <span className="info-value">
                    {invitation.firstName} {invitation.lastName}
                  </span>
                </div>

                <div className="info-item">
                  <span className="info-label">Email:</span>
                  <span className="info-value">{invitation.email}</span>
                </div>

                <div className="info-item">
                  <span className="info-label">Role:</span>
                  <div className="role-display">
                    {getRoleIcon(invitation.role)}
                    <span className="role-name">{invitation.role}</span>
                  </div>
                </div>

                {invitation.position && (
                  <div className="info-item">
                    <span className="info-label">Position:</span>
                    <span className="info-value">{invitation.position}</span>
                  </div>
                )}

                <div className="role-description">
                  <p>{getRoleDescription(invitation.role)}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAcceptInvitation} className="invitation-form">
              <h3 className="form-title">Create Your Account</h3>

              {error && <div className="form-error">{error}</div>}
              
              {loading && loadingMessage && (
                <div className="loading-overlay">
                  <div className="loading-content">
                    <LoadingSpinner size="medium" />
                    <p>{loadingMessage}</p>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Create Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="form-input"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter a secure password"
                  required
                />
                <span className="form-hint">Must be at least 6 characters</span>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  className="form-input"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="large"
                className="invitation-submit"
                loading={loading}
              >
                {loading ? loadingMessage : "Accept Invitation & Create Account"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitationAcceptance;
