// src/components/districts/AssignSchoolsModal.js
import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { X, School, Search, Building2, CheckSquare, Square } from "lucide-react";
import { getSchools } from "../../firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import Button from "../shared/Button";
import "../shared/Modal.css";
import "./AssignSchoolsModal.css";

const AssignSchoolsModal = ({
  district,
  onClose,
  onAssign,
}) => {
  const { organization } = useAuth();
  const [schools, setSchools] = useState([]);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSchools();
  }, [organization]);

  const loadSchools = async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      const schoolsData = await getSchools(organization.id);
      setSchools(schoolsData);
      
      // Pre-select schools already in this district
      const preSelected = new Set(
        schoolsData
          .filter(school => school.districtId === district.id)
          .map(school => school.id)
      );
      setSelectedSchoolIds(preSelected);
    } catch (err) {
      console.error("Error loading schools:", err);
      setError("Failed to load schools");
    } finally {
      setLoading(false);
    }
  };

  const filteredSchools = useMemo(() => {
    if (!searchTerm.trim()) return schools;

    const term = searchTerm.toLowerCase();
    return schools.filter((school) => {
      const name = (school.value || school.name || "").toLowerCase();
      const city = (school.city || "").toLowerCase();
      const currentDistrict = (school.districtName || "").toLowerCase();

      return (
        name.includes(term) ||
        city.includes(term) ||
        currentDistrict.includes(term)
      );
    });
  }, [schools, searchTerm]);

  const schoolsByDistrict = useMemo(() => {
    const grouped = {
      [district.id]: [],
      unassigned: [],
      other: {}
    };

    filteredSchools.forEach(school => {
      if (school.districtId === district.id) {
        grouped[district.id].push(school);
      } else if (!school.districtId) {
        grouped.unassigned.push(school);
      } else {
        if (!grouped.other[school.districtName]) {
          grouped.other[school.districtName] = [];
        }
        grouped.other[school.districtName].push(school);
      }
    });

    return grouped;
  }, [filteredSchools, district.id]);

  const toggleSchool = (schoolId) => {
    setSelectedSchoolIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(schoolId)) {
        newSet.delete(schoolId);
      } else {
        newSet.add(schoolId);
      }
      return newSet;
    });
  };

  const toggleAll = (schoolList) => {
    const allSelected = schoolList.every(school => selectedSchoolIds.has(school.id));
    
    setSelectedSchoolIds(prev => {
      const newSet = new Set(prev);
      schoolList.forEach(school => {
        if (allSelected) {
          newSet.delete(school.id);
        } else {
          newSet.add(school.id);
        }
      });
      return newSet;
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onAssign(Array.from(selectedSchoolIds));
      onClose();
    } catch (error) {
      setError("Failed to update school assignments");
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="modal modal--large"
        style={{
          position: "relative",
          margin: "0",
          transform: "none",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">
              Manage Schools for {district.name}
            </h2>
            <p className="modal__subtitle">
              Select which schools belong to this district
            </p>
          </div>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="modal__content" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {error && (
            <div className="form-error form-error--global">{error}</div>
          )}

          <div className="assign-schools__search">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search schools by name or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading schools...</p>
            </div>
          ) : (
            <div className="assign-schools__list">
              {/* Current District Schools */}
              {schoolsByDistrict[district.id].length > 0 && (
                <div className="school-group">
                  <div className="school-group__header">
                    <h3>
                      <Building2 size={16} />
                      Currently in {district.name}
                    </h3>
                    <button 
                      className="select-all-btn"
                      onClick={() => toggleAll(schoolsByDistrict[district.id])}
                    >
                      {schoolsByDistrict[district.id].every(s => selectedSchoolIds.has(s.id)) 
                        ? "Deselect All" 
                        : "Select All"}
                    </button>
                  </div>
                  <div className="school-group__items">
                    {schoolsByDistrict[district.id].map(school => (
                      <SchoolItem
                        key={school.id}
                        school={school}
                        selected={selectedSchoolIds.has(school.id)}
                        onToggle={() => toggleSchool(school.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Unassigned Schools */}
              {schoolsByDistrict.unassigned.length > 0 && (
                <div className="school-group">
                  <div className="school-group__header">
                    <h3>
                      <School size={16} />
                      Unassigned Schools
                    </h3>
                    <button 
                      className="select-all-btn"
                      onClick={() => toggleAll(schoolsByDistrict.unassigned)}
                    >
                      {schoolsByDistrict.unassigned.every(s => selectedSchoolIds.has(s.id)) 
                        ? "Deselect All" 
                        : "Select All"}
                    </button>
                  </div>
                  <div className="school-group__items">
                    {schoolsByDistrict.unassigned.map(school => (
                      <SchoolItem
                        key={school.id}
                        school={school}
                        selected={selectedSchoolIds.has(school.id)}
                        onToggle={() => toggleSchool(school.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Other Districts */}
              {Object.entries(schoolsByDistrict.other).map(([districtName, districtSchools]) => (
                <div key={districtName} className="school-group">
                  <div className="school-group__header">
                    <h3>
                      <Building2 size={16} />
                      {districtName}
                    </h3>
                    <button 
                      className="select-all-btn"
                      onClick={() => toggleAll(districtSchools)}
                    >
                      {districtSchools.every(s => selectedSchoolIds.has(s.id)) 
                        ? "Deselect All" 
                        : "Select All"}
                    </button>
                  </div>
                  <div className="school-group__items">
                    {districtSchools.map(school => (
                      <SchoolItem
                        key={school.id}
                        school={school}
                        selected={selectedSchoolIds.has(school.id)}
                        onToggle={() => toggleSchool(school.id)}
                        showCurrentDistrict
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal__actions">
          <div className="selection-summary">
            {selectedSchoolIds.size} school{selectedSchoolIds.size !== 1 ? 's' : ''} selected
          </div>
          <Button 
            type="button" 
            variant="secondary" 
            onClick={onClose} 
            disabled={saving}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            variant="primary" 
            onClick={handleSubmit}
            loading={saving}
          >
            Save Assignments
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

const SchoolItem = ({ school, selected, onToggle, showCurrentDistrict }) => {
  return (
    <div className={`school-item ${selected ? 'selected' : ''}`} onClick={onToggle}>
      <div className="school-item__checkbox">
        {selected ? <CheckSquare size={20} /> : <Square size={20} />}
      </div>
      <div className="school-item__info">
        <div className="school-item__name">{school.value || school.name}</div>
        <div className="school-item__details">
          {school.city && school.state && (
            <span>{school.city}, {school.state}</span>
          )}
          {showCurrentDistrict && school.districtName && (
            <span className="school-item__district">
              Currently in: {school.districtName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignSchoolsModal;