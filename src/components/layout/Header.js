// src/components/layout/Header.js
import React, { useState } from "react";
import { ChevronDown, LogOut, User, Settings } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import Button from "../shared/Button";
import ProfileSettingsModal from "../settings/ProfileSettingsModal";
import StudioSettingsModal from "../settings/StudioSettingsModal";
import "./Header.css";

const Header = () => {
  const { userProfile, organization, signout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showStudioSettings, setShowStudioSettings] = useState(false);

  const handleSignOut = async () => {
    try {
      await signout();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleProfileSettings = () => {
    setShowUserMenu(false);
    setShowProfileSettings(true);
  };

  const handleStudioSettings = () => {
    setShowUserMenu(false);
    setShowStudioSettings(true);
  };

  const getUserInitials = () => {
    if (userProfile?.firstName && userProfile?.lastName) {
      return `${userProfile.firstName[0]}${userProfile.lastName[0]}`.toUpperCase();
    }
    return userProfile?.email?.[0]?.toUpperCase() || "U";
  };

  const getUserDisplayName = () => {
    if (userProfile?.displayName) {
      return userProfile.displayName;
    }
    if (userProfile?.firstName && userProfile?.lastName) {
      return `${userProfile.firstName} ${userProfile.lastName}`;
    }
    return userProfile?.email || "User";
  };

  const renderAvatar = (className = "header__avatar") => {
    if (userProfile?.photoURL) {
      return (
        <img
          src={userProfile.photoURL}
          alt="Profile"
          className={`${className} ${className}--photo`}
          onError={(e) => {
            e.target.style.display = "none";
            e.target.nextSibling.style.display = "flex";
          }}
        />
      );
    }
    return <div className={className}>{getUserInitials()}</div>;
  };

  return (
    <>
      <header className="header">
        <div className="header__content">
          <div className="header__left">
            <h2 className="header__greeting">
              Welcome back, {userProfile?.firstName || "User"}
            </h2>
            <p className="header__date">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="header__right">
            {organization && (
              <div className="header__organization">
                <span className="header__org-name">{organization.name}</span>
              </div>
            )}

            <div className="header__user">
              <button
                className="header__user-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="header__avatar-container">
                  {userProfile?.photoURL ? (
                    <>
                      <img
                        src={userProfile.photoURL}
                        alt="Profile"
                        className="header__avatar header__avatar--photo"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                      <div
                        className="header__avatar header__avatar--fallback"
                        style={{ display: "none" }}
                      >
                        {getUserInitials()}
                      </div>
                    </>
                  ) : (
                    <div className="header__avatar">{getUserInitials()}</div>
                  )}
                </div>
                <div className="header__user-info">
                  <span className="header__user-name">
                    {getUserDisplayName()}
                  </span>
                  <span className="header__user-role">{userProfile?.role}</span>
                </div>
                <ChevronDown className="header__dropdown-icon" size={16} />
              </button>

              {showUserMenu && (
                <div className="header__user-menu">
                  <div className="header__menu-section">
                    <div className="header__menu-user-info">
                      <div className="header__menu-avatar-container">
                        {userProfile?.photoURL ? (
                          <>
                            <img
                              src={userProfile.photoURL}
                              alt="Profile"
                              className="header__menu-avatar header__menu-avatar--photo"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                            <div
                              className="header__menu-avatar header__menu-avatar--fallback"
                              style={{ display: "none" }}
                            >
                              {getUserInitials()}
                            </div>
                          </>
                        ) : (
                          <div className="header__menu-avatar">
                            {getUserInitials()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="header__menu-name">
                          {getUserDisplayName()}
                        </div>
                        <div className="header__menu-email">
                          {userProfile?.email}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="header__menu-section">
                    <button
                      className="header__menu-item"
                      onClick={handleProfileSettings}
                    >
                      <User size={16} />
                      Profile Settings
                    </button>
                    {userProfile?.role === "admin" && (
                      <button
                        className="header__menu-item"
                        onClick={handleStudioSettings}
                      >
                        <Settings size={16} />
                        Studio Settings
                      </button>
                    )}
                  </div>

                  <div className="header__menu-section">
                    <button
                      className="header__menu-item header__menu-item--danger"
                      onClick={handleSignOut}
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {showUserMenu && (
          <div
            className="header__overlay"
            onClick={() => setShowUserMenu(false)}
          />
        )}
      </header>

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
      />

      {/* Studio Settings Modal */}
      <StudioSettingsModal
        isOpen={showStudioSettings}
        onClose={() => setShowStudioSettings(false)}
      />
    </>
  );
};

export default Header;
