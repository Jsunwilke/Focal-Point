// src/pages/SchoolManagement.js
import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  School,
  MapPin,
  Phone,
  Mail,
  MoreVertical,
  Edit,
  Trash2,
  Search,
  X,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Calendar,
  FileText,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getSchools, createSchool, updateSchool } from "../firebase/firestore";
import Button from "../components/shared/Button";
import AddSchoolModal from "../components/schools/AddSchoolModal";
import SchoolSessionsModal from "../components/schools/SchoolSessionsModal";
import CreateTrackingWorkflowModal from "../components/shared/CreateTrackingWorkflowModal";
import "./SchoolManagement.css";

const SchoolManagement = () => {
  const { userProfile, organization } = useAuth();
  const [schools, setSchools] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("value"); // Default sort by name
  const [sortDirection, setSortDirection] = useState("asc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflowSchool, setWorkflowSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Sort options
  const sortOptions = [
    { value: "value", label: "School Name", field: "value" },
    { value: "city", label: "City", field: "city" },
    { value: "state", label: "State", field: "state" },
    { value: "contactName", label: "Contact Name", field: "contactName" },
    { value: "createdAt", label: "Date Added", field: "createdAt" },
  ];

  useEffect(() => {
    loadSchools();
  }, [organization]);

  // Filtered and sorted schools using useMemo for performance
  const filteredAndSortedSchools = useMemo(() => {
    let filtered = schools;

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = schools.filter((school) => {
        const name = (school.value || school.name || "").toLowerCase();
        const city = (school.city || "").toLowerCase();
        const state = (school.state || "").toLowerCase();
        const contactName = (school.contactName || "").toLowerCase();
        const contactEmail = (school.contactEmail || "").toLowerCase();
        const street = (school.street || "").toLowerCase();
        const notes = (school.notes || "").toLowerCase();

        return (
          name.includes(term) ||
          city.includes(term) ||
          state.includes(term) ||
          contactName.includes(term) ||
          contactEmail.includes(term) ||
          street.includes(term) ||
          notes.includes(term)
        );
      });
    }

    // Sort the filtered results
    const sorted = [...filtered].sort((a, b) => {
      let aValue = a[sortField] || "";
      let bValue = b[sortField] || "";

      // Handle special cases
      if (sortField === "createdAt") {
        aValue = a.createdAt?.seconds || 0;
        bValue = b.createdAt?.seconds || 0;
      } else {
        // Convert to string for comparison
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return sorted;
  }, [schools, searchTerm, sortField, sortDirection]);

  const loadSchools = async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      const schoolsList = await getSchools(organization.id);
      setSchools(schoolsList);
    } catch (err) {
      setError("Failed to load schools");
      console.error("Error loading schools:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSchool = async (schoolData) => {
    try {
      await createSchool(organization.id, schoolData);
      setShowAddModal(false);
      await loadSchools(); // Reload the schools
    } catch (err) {
      setError("Failed to add school");
      console.error("Error adding school:", err);
    }
  };

  const handleUpdateSchool = async (schoolData) => {
    try {
      await updateSchool(editingSchool.id, schoolData);
      setEditingSchool(null);
      await loadSchools(); // Reload the schools
    } catch (err) {
      setError("Failed to update school");
      console.error("Error updating school:", err);
    }
  };

  const handleViewSessions = (school) => {
    setSelectedSchool(school);
    setShowSessionsModal(true);
  };

  const handleCloseSessionsModal = () => {
    setShowSessionsModal(false);
    setSelectedSchool(null);
  };

  const handleCreateWorkflow = (school) => {
    setWorkflowSchool(school);
    setShowWorkflowModal(true);
  };

  const handleCloseWorkflowModal = () => {
    setShowWorkflowModal(false);
    setWorkflowSchool(null);
  };

  const handleWorkflowSuccess = (workflowId) => {
    console.log("✅ Workflow created successfully:", workflowId);
    // Could show a success message or redirect to workflow view
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
    setShowSortMenu(false);
  };

  const getCurrentSortLabel = () => {
    const option = sortOptions.find((opt) => opt.value === sortField);
    const direction = sortDirection === "asc" ? "A-Z" : "Z-A";
    return `${option?.label || "Name"} (${direction})`;
  };

  const getCoordinatesDisplay = (coordinates) => {
    if (!coordinates) return "";
    // Handle both "lat,lng" format and separate lat/lng fields
    if (typeof coordinates === "string") {
      const [lat, lng] = coordinates.split(",");
      return `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
    }
    return coordinates;
  };

  const formatAddress = (school) => {
    const addressParts = [];
    if (school.street) addressParts.push(school.street);
    if (school.city) addressParts.push(school.city);
    if (school.state) addressParts.push(school.state);
    if (school.zipCode) addressParts.push(school.zipCode);

    if (addressParts.length > 0) {
      return addressParts.join(", ");
    }

    // Fallback to old schoolAddress if new fields don't exist
    return school.schoolAddress || "No address provided";
  };

  if (loading) {
    return (
      <div className="schools-loading">
        <p>Loading schools...</p>
      </div>
    );
  }

  return (
    <div className="school-management">
      <div className="schools-header">
        <div className="schools-header__content">
          <h1 className="schools-title">School Management</h1>
          <p className="schools-subtitle">
            Manage your partner schools and contact information
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowAddModal(true)}
          className="schools-add-btn"
        >
          <Plus size={16} />
          Add School
        </Button>
      </div>

      {error && <div className="schools-error">{error}</div>}

      <div className="schools-content">
        <div className="schools-stats">
          <div className="schools-stat">
            <h3 className="schools-stat__number">{schools.length}</h3>
            <p className="schools-stat__label">Total Schools</p>
          </div>
          <div className="schools-stat">
            <h3 className="schools-stat__number">
              {schools.filter((s) => s.contactEmail).length}
            </h3>
            <p className="schools-stat__label">With Email</p>
          </div>
          <div className="schools-stat">
            <h3 className="schools-stat__number">
              {schools.filter((s) => s.coordinates || s.schoolAddress).length}
            </h3>
            <p className="schools-stat__label">With Location</p>
          </div>
          {searchTerm && (
            <div className="schools-stat schools-stat--search">
              <h3 className="schools-stat__number">
                {filteredAndSortedSchools.length}
              </h3>
              <p className="schools-stat__label">Search Results</p>
            </div>
          )}
        </div>

        <div className="schools-list">
          <div className="schools-list__header">
            <h2 className="schools-list__title">Schools</h2>

            {/* Search and Sort Controls */}
            <div className="schools-controls">
              {/* Search Bar */}
              <div className="schools-search">
                <div className="schools-search__input-wrapper">
                  <Search size={16} className="schools-search__icon" />
                  <input
                    type="text"
                    placeholder="Search schools by name, city, contact..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="schools-search__input"
                  />
                  {searchTerm && (
                    <button
                      onClick={clearSearch}
                      className="schools-search__clear"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Sort Menu */}
              <div className="schools-sort">
                <button
                  className="schools-sort__button"
                  onClick={() => setShowSortMenu(!showSortMenu)}
                >
                  <ArrowUpDown size={16} />
                  <span>Sort: {getCurrentSortLabel()}</span>
                  <ChevronDown size={16} />
                </button>

                {showSortMenu && (
                  <div className="schools-sort__menu">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        className={`schools-sort__option ${
                          sortField === option.value
                            ? "schools-sort__option--active"
                            : ""
                        }`}
                        onClick={() => handleSort(option.value)}
                      >
                        <span>{option.label}</span>
                        {sortField === option.value && (
                          <span className="schools-sort__direction">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {filteredAndSortedSchools.length === 0 ? (
            <div className="schools-empty">
              <School size={48} className="schools-empty__icon" />
              {searchTerm ? (
                <>
                  <h3 className="schools-empty__title">No schools found</h3>
                  <p className="schools-empty__description">
                    No schools match your search for "{searchTerm}"
                  </p>
                  <Button variant="secondary" onClick={clearSearch}>
                    Clear Search
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="schools-empty__title">No schools yet</h3>
                  <p className="schools-empty__description">
                    Start by adding your first partner school
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setShowAddModal(true)}
                  >
                    <Plus size={16} />
                    Add First School
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="schools-grid">
              {filteredAndSortedSchools.map((school) => (
                <div key={school.id} className="school-card">
                  <div className="school-card__header">
                    <div className="school-card__icon">
                      <School size={24} />
                    </div>
                    <div className="school-card__info">
                      <h3 className="school-card__name">
                        {school.value || school.name || "Unnamed School"}
                      </h3>
                      <div className="school-card__address">
                        <MapPin size={14} />
                        <span>{formatAddress(school)}</span>
                      </div>
                    </div>
                    <div className="school-card__menu">
                      <button
                        className="school-card__menu-btn"
                        onClick={() => handleCreateWorkflow(school)}
                        title="Create Tracking Workflow"
                      >
                        <FileText size={16} />
                      </button>
                      <button
                        className="school-card__menu-btn"
                        onClick={() => handleViewSessions(school)}
                        title="View Sessions"
                      >
                        <Calendar size={16} />
                      </button>
                      <button
                        className="school-card__menu-btn"
                        onClick={() => setEditingSchool(school)}
                        title="Edit School"
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="school-card__details">
                    {school.contactName && (
                      <div className="school-card__contact">
                        <strong>Contact:</strong> {school.contactName}
                      </div>
                    )}

                    {school.contactEmail && (
                      <div className="school-card__contact">
                        <Mail size={14} />
                        <a href={`mailto:${school.contactEmail}`}>
                          {school.contactEmail}
                        </a>
                      </div>
                    )}

                    {school.contactPhone && (
                      <div className="school-card__contact">
                        <Phone size={14} />
                        <a href={`tel:${school.contactPhone}`}>
                          {school.contactPhone}
                        </a>
                      </div>
                    )}

                    {(school.coordinates || school.schoolAddress) && (
                      <div className="school-card__coordinates">
                        <MapPin size={14} />
                        <span>
                          {getCoordinatesDisplay(
                            school.coordinates || school.schoolAddress
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {school.notes && (
                    <div className="school-card__notes">
                      <p>{school.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sort Menu Overlay */}
      {showSortMenu && (
        <div
          className="schools-sort__overlay"
          onClick={() => setShowSortMenu(false)}
        />
      )}

      {showAddModal && (
        <AddSchoolModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddSchool}
        />
      )}

      {editingSchool && (
        <AddSchoolModal
          school={editingSchool}
          onClose={() => setEditingSchool(null)}
          onAdd={handleUpdateSchool}
          isEditing={true}
        />
      )}

      {showSessionsModal && selectedSchool && (
        <SchoolSessionsModal
          school={selectedSchool}
          onClose={handleCloseSessionsModal}
        />
      )}

      {showWorkflowModal && workflowSchool && (
        <CreateTrackingWorkflowModal
          isOpen={showWorkflowModal}
          onClose={handleCloseWorkflowModal}
          school={workflowSchool}
          organizationID={organization?.id}
          onSuccess={handleWorkflowSuccess}
        />
      )}
    </div>
  );
};

export default SchoolManagement;
