// src/components/auth/LoginPage.js
import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Button from "../shared/Button";
import LoadingSpinner from "../shared/LoadingSpinner";
import "./LoginPage.css";

const LoginPage = ({ onShowSignup }) => {
  const { signin, loading } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await signin(formData.email, formData.password);
    } catch (err) {
      setError(err.message || "Failed to sign in");
    }
  };

  if (loading) {
    return (
      <div className="login-loading">
        <LoadingSpinner size="large" />
        <p>Signing you in...</p>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title">iconik</h1>
          <h2 className="login-subtitle">Studio Management</h2>
          <p className="login-description">Sign in to your studio account</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-input"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="large"
            className="login-submit"
            loading={loading}
          >
            Sign In
          </Button>

          <div className="login-footer">
            <p>
              Don't have a studio account?{" "}
              <button
                type="button"
                className="login-link"
                onClick={onShowSignup}
              >
                Create Studio
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
