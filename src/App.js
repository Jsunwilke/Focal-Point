// src/App.js
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { WorkflowProvider } from "./contexts/WorkflowContext";
import { ToastProvider } from "./contexts/ToastContext";
import LoginPage from "./components/auth/LoginPage";
import StudioSignup from "./components/auth/StudioSignup";
import InvitationAcceptance from "./components/auth/InvitationAcceptance";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Layout from "./components/layout/Layout";
import TemplateBuilderLayout from "./components/layout/TemplateBuilderLayout";
import Dashboard from "./pages/Dashboard";
import TeamManagement from "./pages/TeamManagement";
import SchoolManagement from "./pages/SchoolManagement";
import DailyReports from "./pages/DailyReports";
import Sports from "./pages/Sports";
import Schedule from "./pages/Schedule";
import Settings from "./pages/Settings";
import TimeTracking from "./pages/TimeTracking";
import PayrollTimesheets from "./pages/PayrollTimesheets";
import TemplatesList from "./pages/TemplatesList";
import TemplateBuilder from "./pages/TemplateBuilder";
import WorkflowDashboard from "./components/workflow/WorkflowDashboard";
import "./App.css";

const AppContent = () => {
  const { user, loading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  // Show loading spinner while Firebase initializes
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading iconik studio...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/accept-invitation" element={<InvitationAcceptance />} />

        {/* Auth routes - only show if not logged in */}
        {!user && (
          <>
            <Route
              path="/signup"
              element={<StudioSignup onBack={() => setShowSignup(false)} />}
            />
            <Route
              path="/*"
              element={
                showSignup ? (
                  <StudioSignup onBack={() => setShowSignup(false)} />
                ) : (
                  <LoginPage onShowSignup={() => setShowSignup(true)} />
                )
              }
            />
          </>
        )}

        {/* Protected routes - only show if logged in */}
        {user && (
          <>
            {/* Template Builder routes with dedicated layout */}
            <Route
              path="/settings/templates/new"
              element={
                <ProtectedRoute>
                  <TemplateBuilderLayout>
                    <TemplateBuilder />
                  </TemplateBuilderLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/templates/:templateId"
              element={
                <ProtectedRoute>
                  <TemplateBuilderLayout>
                    <TemplateBuilder />
                  </TemplateBuilderLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Regular app routes with standard layout */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/schedule" element={<Schedule />} />
                      <Route path="/time-tracking" element={<TimeTracking />} />
                      <Route path="/workflows" element={<WorkflowDashboard />} />
                      <Route path="/payroll-timesheets" element={<PayrollTimesheets />} />
                      <Route path="/team" element={<TeamManagement />} />
                      <Route path="/schools" element={<SchoolManagement />} />
                      <Route path="/sports" element={<Sports />} />
                      <Route path="/daily-reports" element={<DailyReports />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/settings/templates" element={<TemplatesList />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </>
        )}
      </Routes>
    </Router>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <WorkflowProvider>
          <div className="app">
            <AppContent />
          </div>
        </WorkflowProvider>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
