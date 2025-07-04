// src/components/auth/ProtectedRoute.js
import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import LoadingSpinner from "../shared/LoadingSpinner";
import "./ProtectedRoute.css";

const ProtectedRoute = ({ children }) => {
  const { user, userProfile, organization, loading } = useAuth();

  if (loading) {
    return (
      <div className="protected-route-loading">
        <LoadingSpinner size="large" />
        <p>Loading your studio...</p>
      </div>
    );
  }

  if (!user || !userProfile || !organization) {
    // This will trigger the auth flow in App.js
    return null;
  }

  return children;
};

export default ProtectedRoute;
