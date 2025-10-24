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
  Building2,
  BookOpen,
  Image,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useDistricts } from "../contexts/DistrictContext";
import { getSchools, createSchool, updateSchool } from "../firebase/firestore";
import organizationCacheService from "../services/organizationCacheService";
import Button from "../components/shared/Button";
import AddSchoolModal from "../components/schools/AddSchoolModal";
import SchoolSessionsModal from "../components/schools/SchoolSessionsModal";
import CreateTrackingWorkflowModal from "../components/shared/CreateTrackingWorkflowModal";
import DistrictCard from "../components/districts/DistrictCard";
import AddDistrictModal from "../components/districts/AddDistrictModal";
import AssignSchoolsModal from "../components/districts/AssignSchoolsModal";
import YearbookShootListModal from "../components/yearbook/YearbookShootListModal";
import LocationPhotosModal from "../components/sessions/LocationPhotosModal";
import "./SchoolManagement.css";

const SchoolManagement = () => {
  const { userProfile, organization } = useAuth();
  const { 
    districts, 
    loading: districtsLoading, 
    createDistrict, 
    updateDistrict, 
    deleteDistrict,
    assignSchoolsToDistrict,
    getDistrictsSorted 
  } = useDistricts();
  const [activeTab, setActiveTab] = useState("schools");
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
  const [showYearbookModal, setShowYearbookModal] = useState(false);
  const [yearbookSchool, setYearbookSchool] = useState(null);
  const [showLocationPhotos, setShowLocationPhotos] = useState(false);
  const [locationPhotosSchool, setLocationPhotosSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  // District state
  const [showAddDistrictModal, setShowAddDistrictModal] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState(null);
  const [assigningDistrict, setAssigningDistrict] = useState(null);
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState("");

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

    // Filter by district
    if (selectedDistrictFilter) {
      if (selectedDistrictFilter === "unassigned") {
        filtered = schools.filter(school => !school.districtId);
      } else {
        filtered = schools.filter(school => school.districtId === selectedDistrictFilter);
      }
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((school) => {
        const name = (school.value || school.name || "").toLowerCase();
        const city = (school.city || "").toLowerCase();
        const state = (school.state || "").toLowerCase();
        const contactName = (school.contactName || "").toLowerCase();
        const contactEmail = (school.contactEmail || "").toLowerCase();
        const street = (school.street || "").toLowerCase();
        const notes = (school.notes || "").toLowerCase();
        const districtName = (school.districtName || "").toLowerCase();

        return (
          name.includes(term) ||
          city.includes(term) ||
          state.includes(term) ||
          contactName.includes(term) ||
          contactEmail.includes(term) ||
          street.includes(term) ||
          notes.includes(term) ||
          districtName.includes(term)
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
  }, [schools, searchTerm, sortField, sortDirection, selectedDistrictFilter]);


  // Filtered districts for search
  const filteredDistricts = useMemo(() => {
    if (!searchTerm.trim()) return getDistrictsSorted();
    
    const term = searchTerm.toLowerCase();
    return getDistrictsSorted().filter(district => {
      const name = (district.name || "").toLowerCase();
      return name.includes(term);
    });
  }, [districts, searchTerm, getDistrictsSorted]);

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

  const handleRefresh = async () => {
    if (!organization?.id) return;
    
    try {
      setRefreshing(true);
      // Clear the schools cache to force fresh data
      organizationCacheService.clearSchoolsCache(organization.id);
      // Reload schools from Firestore
      const schoolsList = await getSchools(organization.id);
      setSchools(schoolsList);
      setError(""); // Clear any previous errors
    } catch (err) {
      setError("Failed to refresh schools");
      console.error("Error refreshing schools:", err);
    } finally {
      setRefreshing(false);
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

  const handleViewYearbook = (school) => {
    setYearbookSchool(school);
    setShowYearbookModal(true);
  };

  const handleCloseYearbookModal = () => {
    setShowYearbookModal(false);
    setYearbookSchool(null);
  };

  const handleViewLocationPhotos = (school) => {
    setLocationPhotosSchool(school);
    setShowLocationPhotos(true);
  };

  const handleCloseLocationPhotos = () => {
    setShowLocationPhotos(false);
    setLocationPhotosSchool(null);
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

  // District handlers
  const handleAddDistrict = async (districtData) => {
    try {
      await createDistrict(districtData);
      setShowAddDistrictModal(false);
    } catch (err) {
      setError("Failed to add district");
      console.error("Error adding district:", err);
    }
  };

  const handleUpdateDistrict = async (districtData) => {
    try {
      await updateDistrict(editingDistrict.id, districtData);
      setEditingDistrict(null);
    } catch (err) {
      setError("Failed to update district");
      console.error("Error updating district:", err);
    }
  };

  const handleDeleteDistrict = async (district) => {
    if (window.confirm(`Are you sure you want to delete "${district.name}"? All schools will be unassigned from this district.`)) {
      try {
        await deleteDistrict(district.id);
      } catch (err) {
        setError("Failed to delete district");
        console.error("Error deleting district:", err);
      }
    }
  };

  const handleAssignSchools = async (schoolIds) => {
    try {
      await assignSchoolsToDistrict(assigningDistrict.id, schoolIds);
      setAssigningDistrict(null);
      await loadSchools(); // Reload schools to show updated assignments
    } catch (err) {
      setError("Failed to assign schools to district");
      console.error("Error assigning schools:", err);
    }
  };

  const handleViewDistrictSchools = (district) => {
    setSelectedDistrictFilter(district.id);
    setActiveTab("schools");
  };

  const clearDistrictFilter = () => {
    setSelectedDistrictFilter("");
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

  if (loading || districtsLoading) {
    return (
      <div className="schools-loading">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="school-management">
      <div className="schools-header">
        <div className="schools-header__content">
          <h1 className="schools-title">School & District Management</h1>
          <p className="schools-subtitle">
            Manage your partner schools and organize them into districts
          </p>
        </div>
        <div className="schools-header__actions">
          <div className="tab-buttons">
            <button
              className={`tab-button ${activeTab === "schools" ? "active" : ""}`}
              onClick={() => setActiveTab("schools")}
            >
              <School size={16} />
              Schools
            </button>
            <button
              className={`tab-button ${activeTab === "districts" ? "active" : ""}`}
              onClick={() => setActiveTab("districts")}
            >
              <Building2 size={16} />
              Districts
            </button>
          </div>
          <Button
            variant="secondary"
            onClick={handleRefresh}
            className="schools-refresh-btn"
            disabled={refreshing || loading}
            title="Refresh schools data"
          >
            <RefreshCw size={16} className={refreshing ? "spinning" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            variant="primary"
            onClick={() => activeTab === "schools" ? setShowAddModal(true) : setShowAddDistrictModal(true)}
            className="schools-add-btn"
          >
            <Plus size={16} />
            Add {activeTab === "schools" ? "School" : "District"}
          </Button>
        </div>
      </div>

      {error && <div className="schools-error">{error}</div>}

      <div className="schools-content">
        {activeTab === "schools" ? (
          <div className="schools-stats">
            <div className="schools-stat">
              <h3 className="schools-stat__number">{schools.length}</h3>
              <p className="schools-stat__label">Total Schools</p>
            </div>
            <div className="schools-stat">
              <h3 className="schools-stat__number">
                {schools.filter((s) => s.districtId).length}
              </h3>
              <p className="schools-stat__label">In Districts</p>
            </div>
            <div className="schools-stat">
              <h3 className="schools-stat__number">
                {schools.filter((s) => s.contactEmail).length}
              </h3>
              <p className="schools-stat__label">With Email</p>
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
        ) : (
          <div className="schools-stats">
            <div className="schools-stat">
              <h3 className="schools-stat__number">{districts.length}</h3>
              <p className="schools-stat__label">Total Districts</p>
            </div>
            <div className="schools-stat">
              <h3 className="schools-stat__number">
                {districts.reduce((sum, d) => sum + (d.schoolCount || 0), 0)}
              </h3>
              <p className="schools-stat__label">Total Schools</p>
            </div>
            {searchTerm && (
              <div className="schools-stat schools-stat--search">
                <h3 className="schools-stat__number">
                  {filteredDistricts.length}
                </h3>
                <p className="schools-stat__label">Search Results</p>
              </div>
            )}
          </div>
        )}

        <div className="schools-list">
          <div className="schools-list__header">
            <h2 className="schools-list__title">
              {activeTab === "schools" ? "Schools" : "Districts"}
            </h2>
            {selectedDistrictFilter && activeTab === "schools" && (
              <div className="district-filter-badge">
                <Building2 size={14} />
                <span>
                  {selectedDistrictFilter === "unassigned" 
                    ? "Unassigned Schools" 
                    : districts.find(d => d.id === selectedDistrictFilter)?.name}
                </span>
                <button onClick={clearDistrictFilter}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Search and Sort Controls */}
            <div className="schools-controls">
              {/* Search Bar */}
              <div className="schools-search">
                <div className="schools-search__input-wrapper">
                  <Search size={16} className="schools-search__icon" />
                  <input
                    type="text"
                    placeholder={activeTab === "schools" 
                      ? "Search schools by name, city, district..." 
                      : "Search districts by name..."}
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

              {/* Sort Menu - Only for schools */}
              {activeTab === "schools" && (
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
              )}
            </div>
          </div>

          {activeTab === "schools" ? (
            filteredAndSortedSchools.length === 0 ? (
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
                      {school.districtName && (
                        <div className="school-card__district">
                          <Building2 size={12} />
                          <span>{school.districtName}</span>
                        </div>
                      )}
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
                        onClick={() => handleViewYearbook(school)}
                        title="Yearbook Shoot List"
                      >
                        <BookOpen size={16} />
                      </button>
                      {school.locationPhotos?.length > 0 && (
                        <button
                          className="school-card__menu-btn"
                          onClick={() => handleViewLocationPhotos(school)}
                          title="View Location Photos"
                          style={{ position: 'relative' }}
                        >
                          <Image size={16} />
                          <span
                            style={{
                              position: 'absolute',
                              top: '-4px',
                              right: '-4px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              fontSize: '0.625rem',
                              borderRadius: '10px',
                              padding: '2px 4px',
                              minWidth: '16px',
                              textAlign: 'center',
                              fontWeight: '600',
                            }}
                          >
                            {school.locationPhotos.length}
                          </span>
                        </button>
                      )}
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
            )
          ) : (
            /* Districts Tab */
            filteredDistricts.length === 0 ? (
              <div className="schools-empty">
                <Building2 size={48} className="schools-empty__icon" />
                {searchTerm ? (
                  <>
                    <h3 className="schools-empty__title">No districts found</h3>
                    <p className="schools-empty__description">
                      No districts match your search for "{searchTerm}"
                    </p>
                    <Button variant="secondary" onClick={clearSearch}>
                      Clear Search
                    </Button>
                  </>
                ) : (
                  <>
                    <h3 className="schools-empty__title">No districts yet</h3>
                    <p className="schools-empty__description">
                      Create districts to organize your schools
                    </p>
                    <Button
                      variant="primary"
                      onClick={() => setShowAddDistrictModal(true)}
                    >
                      <Plus size={16} />
                      Create First District
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="districts-grid">
                {filteredDistricts.map((district) => (
                  <DistrictCard
                    key={district.id}
                    district={district}
                    onEdit={setEditingDistrict}
                    onDelete={handleDeleteDistrict}
                    onViewSchools={handleViewDistrictSchools}
                    onManageSchools={setAssigningDistrict}
                  />
                ))}
              </div>
            )
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
          organization={organization}
        />
      )}

      {editingSchool && (
        <AddSchoolModal
          school={editingSchool}
          onClose={() => setEditingSchool(null)}
          onAdd={handleUpdateSchool}
          isEditing={true}
          organization={organization}
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

      {showYearbookModal && yearbookSchool && (
        <YearbookShootListModal
          isOpen={showYearbookModal}
          onClose={handleCloseYearbookModal}
          schoolId={yearbookSchool.id}
          schoolName={yearbookSchool.value || yearbookSchool.name}
        />
      )}

      {showLocationPhotos && locationPhotosSchool && (
        <LocationPhotosModal
          isOpen={showLocationPhotos}
          onClose={handleCloseLocationPhotos}
          photos={locationPhotosSchool.locationPhotos}
          schoolName={locationPhotosSchool.value || locationPhotosSchool.name}
          lastUpdated={locationPhotosSchool.locationPhotosLastUpdated}
        />
      )}

      {/* District Modals */}
      {showAddDistrictModal && (
        <AddDistrictModal
          onClose={() => setShowAddDistrictModal(false)}
          onAdd={handleAddDistrict}
        />
      )}

      {editingDistrict && (
        <AddDistrictModal
          district={editingDistrict}
          onClose={() => setEditingDistrict(null)}
          onAdd={handleUpdateDistrict}
          isEditing={true}
        />
      )}

      {assigningDistrict && (
        <AssignSchoolsModal
          district={assigningDistrict}
          onClose={() => setAssigningDistrict(null)}
          onAssign={handleAssignSchools}
        />
      )}
    </div>
  );
};

export default SchoolManagement;
