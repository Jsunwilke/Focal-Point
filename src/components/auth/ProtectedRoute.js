// src/components/auth/ProtectedRoute.js
import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import LoadingSpinner from "../shared/LoadingSpinner";
import "./ProtectedRoute.css";

const ProtectedRoute = ({ children }) => {
  const { user, userProfile, organization, loading } = useAuth();

  console.log("🛡️ PROTECTED ROUTE CHECK:", {
    loading,
    user: !!user,
    userProfile: !!userProfile,
    organization: !!organization,
    userProfileOrgId: userProfile?.organizationID,
    organizationId: organization?.id
  });

  if (loading) {
    console.log("⏳ Protected route: Still loading...");
    return (
      <div className="protected-route-loading">
        <LoadingSpinner size="large" />
        <p>Loading your studio...</p>
      </div>
    );
  }

  if (!user || !userProfile || !organization) {
    console.log("❌ Protected route: Missing required data, returning null (white screen):", {
      missingUser: !user,
      missingUserProfile: !userProfile, 
      missingOrganization: !organization
    });
    // This will trigger the auth flow in App.js
    return null;
  }

  console.log("✅ Protected route: All checks passed, rendering children");
  return children;
};

export default ProtectedRoute;
