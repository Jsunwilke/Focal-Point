// src/components/proofing/PasswordPrompt.js
import React, { useState } from "react";
import { Lock, AlertCircle } from "lucide-react";
import "./PasswordPrompt.css";

const PasswordPrompt = ({ onSubmit, galleryName }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const isValid = await onSubmit(password);
    
    if (!isValid) {
      setError("Incorrect password. Please try again.");
      setPassword("");
    }
    
    setLoading(false);
  };

  return (
    <div className="password-prompt-container">
      <div className="password-prompt-card">
        <div className="lock-icon">
          <Lock size={48} />
        </div>
        
        <h2>Password Required</h2>
        {galleryName && <p className="gallery-name">{galleryName}</p>}
        <p className="prompt-text">
          This gallery is password protected. Please enter the password to continue.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-submit"
            disabled={loading || !password}
          >
            {loading ? "Verifying..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordPrompt;