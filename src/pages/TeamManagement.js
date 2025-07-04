// src/pages/TeamManagement.js
import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Mail,
  User,
  Shield,
  Calendar,
  MoreVertical,
  Check,
  X,
  Search,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  getTeamMembers,
  inviteUser,
  updateUserRole,
} from "../firebase/firestore";
import Button from "../components/shared/Button";
import InviteUserModal from "../components/team/InviteUserModal";
import "./TeamManagement.css";

const TeamManagement = () => {
  const { userProfile, organization } = useAuth();
  const [teamMembers, setTeamMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);
  const [invitedUserData, setInvitedUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTeamMembers();
  }, [organization]);

  // Filtered and sorted team members using useMemo for performance
  const filteredAndSortedMembers = useMemo(() => {
    let filtered = teamMembers;

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = teamMembers.filter((member) => {
        const fullName = `${member.firstName || ""} ${
          member.lastName || ""
        }`.toLowerCase();
        const email = (member.email || "").toLowerCase();
        const role = (member.role || "").toLowerCase();
        const position = (member.position || "").toLowerCase();

        return (
          fullName.includes(term) ||
          email.includes(term) ||
          role.includes(term) ||
          position.includes(term)
        );
      });
    }

    // Sort by: Active status first, then by name
    return filtered.sort((a, b) => {
      // Active members first
      if (a.isActive !== b.isActive) {
        return b.isActive ? 1 : -1;
      }

      // Then sort by name
      const nameA =
        `${a.firstName || ""} ${a.lastName || ""}`.trim() || a.email;
      const nameB =
        `${b.firstName || ""} ${b.lastName || ""}`.trim() || b.email;
      return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
    });
  }, [teamMembers, searchTerm]);

  const loadTeamMembers = async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      const members = await getTeamMembers(organization.id);
      setTeamMembers(members);
    } catch (err) {
      setError("Failed to load team members");
      console.error("Error loading team:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (inviteData) => {
    try {
      await inviteUser(organization.id, inviteData);

      // Store the invited user data to show the success message with link
      setInvitedUserData(inviteData);
      setShowInviteModal(false);
      setShowInviteSuccess(true);

      await loadTeamMembers(); // Reload the team
    } catch (err) {
      setError("Failed to send invitation");
      console.error("Error inviting user:", err);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  const getInvitationLink = (email) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/accept-invitation?email=${encodeURIComponent(email)}`;
  };

  const copyInvitationLink = async (email) => {
    const link = getInvitationLink(email);
    try {
      await navigator.clipboard.writeText(link);
      // You could add a toast notification here
      alert("Invitation link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy link:", err);
      // Fallback: show the link in a dialog
      prompt("Copy this invitation link:", link);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "admin":
        return <Shield size={16} className="role-icon role-icon--admin" />;
      case "manager":
        return <User size={16} className="role-icon role-icon--manager" />;
      default:
        return <User size={16} className="role-icon role-icon--employee" />;
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case "admin":
        return "role-badge role-badge--admin";
      case "manager":
        return "role-badge role-badge--manager";
      default:
        return "role-badge role-badge--employee";
    }
  };

  if (loading) {
    return (
      <div className="team-loading">
        <p>Loading team members...</p>
      </div>
    );
  }

  return (
    <div className="team-management">
      <div className="team-header">
        <div className="team-header__content">
          <h1 className="team-title">Team Management</h1>
          <p className="team-subtitle">
            Manage your studio team and invite new members
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowInviteModal(true)}
          className="team-invite-btn"
        >
          <Plus size={16} />
          Invite Member
        </Button>
      </div>

      {error && <div className="team-error">{error}</div>}

      <div className="team-content">
        <div className="team-stats">
          <div className="team-stat">
            <h3 className="team-stat__number">{teamMembers.length}</h3>
            <p className="team-stat__label">Total Members</p>
          </div>
          <div className="team-stat">
            <h3 className="team-stat__number">
              {teamMembers.filter((m) => m.isActive).length}
            </h3>
            <p className="team-stat__label">Active</p>
          </div>
          <div className="team-stat">
            <h3 className="team-stat__number">
              {teamMembers.filter((m) => m.role === "admin").length}
            </h3>
            <p className="team-stat__label">Admins</p>
          </div>
          {searchTerm && (
            <div className="team-stat team-stat--search">
              <h3 className="team-stat__number">
                {filteredAndSortedMembers.length}
              </h3>
              <p className="team-stat__label">Search Results</p>
            </div>
          )}
        </div>

        <div className="team-list">
          <div className="team-list__header">
            <h2 className="team-list__title">Team Members</h2>

            {/* Search Bar */}
            <div className="team-search">
              <div className="team-search__input-wrapper">
                <Search size={16} className="team-search__icon" />
                <input
                  type="text"
                  placeholder="Search team by name, email, or role..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="team-search__input"
                />
                {searchTerm && (
                  <button onClick={clearSearch} className="team-search__clear">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredAndSortedMembers.length === 0 ? (
            <div className="team-empty">
              <User size={48} className="team-empty__icon" />
              {searchTerm ? (
                <>
                  <h3 className="team-empty__title">No team members found</h3>
                  <p className="team-empty__description">
                    No team members match your search for "{searchTerm}"
                  </p>
                  <Button variant="secondary" onClick={clearSearch}>
                    Clear Search
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="team-empty__title">No team members yet</h3>
                  <p className="team-empty__description">
                    Start by inviting your first team member to join your studio
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setShowInviteModal(true)}
                  >
                    <Plus size={16} />
                    Invite First Member
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="team-grid">
              {filteredAndSortedMembers.map((member) => (
                <div key={member.id} className="team-card">
                  <div className="team-card__header">
                    <div className="team-card__avatar">
                      {member.firstName?.[0] || member.email[0]}
                    </div>
                    <div className="team-card__info">
                      <h3 className="team-card__name">
                        {member.firstName && member.lastName
                          ? `${member.firstName} ${member.lastName}`
                          : member.email}
                      </h3>
                      <p className="team-card__email">{member.email}</p>
                    </div>
                    <button className="team-card__menu">
                      <MoreVertical size={16} />
                    </button>
                  </div>

                  <div className="team-card__details">
                    <div className="team-card__role">
                      {getRoleIcon(member.role)}
                      <span className={getRoleBadgeClass(member.role)}>
                        {member.role}
                      </span>
                    </div>

                    {member.position && (
                      <div className="team-card__position">
                        <Calendar size={14} />
                        <span>{member.position}</span>
                      </div>
                    )}

                    <div className="team-card__status">
                      <div
                        className={`status-indicator ${
                          member.isActive
                            ? "status-indicator--active"
                            : "status-indicator--pending"
                        }`}
                      >
                        {member.isActive ? "Active" : "Pending Invitation"}
                      </div>
                    </div>
                  </div>

                  {member.isActive && member.lastLogin && (
                    <div className="team-card__footer">
                      <p className="team-card__last-login">
                        Last login:{" "}
                        {new Date(
                          member.lastLogin.seconds * 1000
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {!member.isActive && (
                    <div className="team-card__actions">
                      <Button
                        variant="outline"
                        size="small"
                        onClick={() => copyInvitationLink(member.email)}
                      >
                        <Mail size={14} />
                        Copy Invitation Link
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInviteUser}
          organization={organization}
        />
      )}

      {showInviteSuccess && invitedUserData && (
        <InviteSuccessModal
          userData={invitedUserData}
          invitationLink={getInvitationLink(invitedUserData.email)}
          onClose={() => {
            setShowInviteSuccess(false);
            setInvitedUserData(null);
          }}
        />
      )}
    </div>
  );
};

const InviteSuccessModal = ({ userData, invitationLink, onClose }) => {
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      alert("Link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy link:", err);
      prompt("Copy this invitation link:", invitationLink);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">Invitation Sent!</h2>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="invite-success">
          <div className="invite-success__icon">
            <Check size={32} />
          </div>

          <h3 className="invite-success__title">
            {userData.firstName} {userData.lastName} has been invited!
          </h3>

          <p className="invite-success__description">
            Send them this invitation link to complete their signup:
          </p>

          <div className="invite-success__link">
            <input
              type="text"
              value={invitationLink}
              readOnly
              className="link-input"
            />
            <Button
              variant="primary"
              onClick={copyLink}
              className="copy-button"
            >
              <Mail size={16} />
              Copy Link
            </Button>
          </div>

          <div className="invite-success__instructions">
            <h4>Next Steps:</h4>
            <ol>
              <li>Copy the invitation link above</li>
              <li>Send it to {userData.firstName} via email or message</li>
              <li>They'll click the link to create their account</li>
              <li>
                Once complete, they can sign in with their email and password
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamManagement;
