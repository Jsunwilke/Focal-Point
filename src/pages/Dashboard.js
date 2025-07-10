// src/pages/Dashboard.js
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import TimeTrackingWidget from "../components/dashboard/TimeTrackingWidget";
import "./Dashboard.css";

const Dashboard = () => {
  const { userProfile, organization } = useAuth();

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <h1 className="dashboard__title">Dashboard</h1>
        <p className="dashboard__subtitle">
          Welcome to your studio management dashboard
        </p>
      </div>

      <div className="dashboard__content">
        {/* Time Tracking Widget */}
        <TimeTrackingWidget />

        <div className="dashboard__welcome-card">
          <h2 className="dashboard__welcome-title">
            Welcome to iconik, {userProfile?.firstName}!
          </h2>
          <p className="dashboard__welcome-description">
            Your studio <strong>{organization?.name}</strong> is ready to go.
            Use the sidebar to navigate when features are added.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
