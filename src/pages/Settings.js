import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings as SettingsIcon,
  FileText,
  Users,
  User,
  Building2,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Button from "../components/shared/Button";
import ProfileSettingsModal from "../components/settings/ProfileSettingsModal";
import StudioSettingsModal from "../components/settings/StudioSettingsModal";
import ReportTemplatesModal from "../components/settings/ReportTemplatesModal";
import "./Settings.css";

const Settings = () => {
  const { userProfile, organization } = useAuth();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState(null);

  // Check if user is admin
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'manager';

  const settingsCards = [
    {
      id: "profile",
      title: "Profile Settings",
      description: "Update your personal information and preferences",
      icon: <User size={24} />,
      color: "blue",
      available: true,
      modal: "profile"
    },
    {
      id: "studio",
      title: "Studio Settings",
      description: "Manage studio information and organization settings",
      icon: <Building2 size={24} />,
      color: "green",
      available: isAdmin,
      modal: "studio"
    },
    {
      id: "templates",
      title: "Report Templates",
      description: "Create and manage custom daily report templates",
      icon: <FileText size={24} />,
      color: "purple",
      available: isAdmin,
      action: "navigate",
      path: "/settings/templates"
    },
    {
      id: "team",
      title: "Team Management",
      description: "Manage team members and permissions",
      icon: <Users size={24} />,
      color: "orange",
      available: isAdmin,
      action: "navigate",
      path: "/team"
    }
  ];

  const openModal = (modalType) => {
    setActiveModal(modalType);
  };

  const closeModal = () => {
    setActiveModal(null);
  };
  
  const handleCardClick = (card) => {
    if (!card.available) return;
    
    if (card.action === 'navigate' && card.path) {
      navigate(card.path);
    } else if (card.modal) {
      openModal(card.modal);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="settings-header__content">
          <div className="settings-header__title">
            <SettingsIcon size={32} className="settings-header__icon" />
            <div>
              <h1>Settings</h1>
              <p>Manage your studio, team, and preferences</p>
            </div>
          </div>
          <div className="settings-header__info">
            <div className="org-info">
              <p className="org-name">{organization?.displayName || "Your Studio"}</p>
              <p className="user-role">{userProfile?.role || "Member"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-content">
        <div className="settings-grid">
          {settingsCards.map((card) => (
            <div
              key={card.id}
              className={`settings-card ${!card.available ? 'settings-card--disabled' : ''}`}
              onClick={() => handleCardClick(card)}
            >
              <div className={`settings-card__icon settings-card__icon--${card.color}`}>
                {card.icon}
              </div>
              <div className="settings-card__content">
                <h3 className="settings-card__title">{card.title}</h3>
                <p className="settings-card__description">{card.description}</p>
                {!card.available && (
                  <p className="settings-card__restriction">Admin access required</p>
                )}
              </div>
              {card.available && (card.modal || card.action === 'navigate') && (
                <ChevronRight size={20} className="settings-card__arrow" />
              )}
            </div>
          ))}
        </div>

        {!isAdmin && (
          <div className="settings-notice">
            <div className="settings-notice__content">
              <h3>Limited Access</h3>
              <p>
                You currently have limited access to settings. Contact your studio administrator
                to request additional permissions or to make changes to studio-wide settings.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {activeModal === "profile" && (
        <ProfileSettingsModal 
          isOpen={activeModal === "profile"} 
          onClose={closeModal} 
        />
      )}

      {activeModal === "studio" && (
        <StudioSettingsModal 
          isOpen={activeModal === "studio"} 
          onClose={closeModal} 
        />
      )}

      {activeModal === "templates" && (
        <ReportTemplatesModal 
          isOpen={activeModal === "templates"} 
          onClose={closeModal} 
        />
      )}
    </div>
  );
};

export default Settings;