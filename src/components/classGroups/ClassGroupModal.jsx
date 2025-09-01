// src/components/classGroups/ClassGroupModal.jsx
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  Calendar,
  School,
  Users,
  Edit2
} from "lucide-react";
import { useClassGroups } from "../../contexts/ClassGroupsContext";
import { useAuth } from "../../contexts/AuthContext";
import { getSchools } from "../../firebase/firestore";
import { Timestamp } from "firebase/firestore";

const ClassGroupModal = ({ job, onClose }) => {
  const { createClassGroupJob, updateClassGroupJob } = useClassGroups();
  const { organization } = useAuth();
  const isEditing = !!job;

  const [formData, setFormData] = useState({
    schoolId: job?.schoolId || "",
    schoolName: job?.schoolName || "",
    sessionDate: job?.sessionDate 
      ? new Date(job.sessionDate.seconds * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    sessionId: job?.sessionId || "",
    classGroups: job?.classGroups || []
  });

  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(true);

  useEffect(() => {
    loadSchools();
  }, [organization]);

  const loadSchools = async () => {
    if (!organization?.id) return;
    
    setLoadingSchools(true);
    try {
      const schoolsList = await getSchools(organization.id);
      setSchools(schoolsList);
    } catch (error) {
      console.error("Error loading schools:", error);
    } finally {
      setLoadingSchools(false);
    }
  };

  const handleSchoolChange = (e) => {
    const schoolId = e.target.value;
    const school = schools.find(s => s.id === schoolId);
    setFormData({
      ...formData,
      schoolId,
      schoolName: school?.value || school?.name || ""
    });
  };

  const addClassGroup = () => {
    const newGroup = {
      id: crypto.randomUUID(),
      grade: "",
      teacher: "",
      imageNumbers: "",
      notes: ""
    };
    setFormData({
      ...formData,
      classGroups: [...formData.classGroups, newGroup]
    });
  };

  const updateClassGroup = (groupId, field, value) => {
    setFormData({
      ...formData,
      classGroups: formData.classGroups.map(group =>
        group.id === groupId ? { ...group, [field]: value } : group
      )
    });
  };

  const removeClassGroup = (groupId) => {
    setFormData({
      ...formData,
      classGroups: formData.classGroups.filter(group => group.id !== groupId)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.schoolId) {
      alert("Please select a school");
      return;
    }

    if (formData.classGroups.length === 0) {
      alert("Please add at least one class group");
      return;
    }

    setLoading(true);

    const jobData = {
      ...formData,
      sessionDate: Timestamp.fromDate(new Date(formData.sessionDate))
    };

    let success;
    if (isEditing) {
      success = await updateClassGroupJob(job.id, jobData);
    } else {
      const jobId = await createClassGroupJob(jobData);
      success = !!jobId;
    }

    if (success) {
      onClose();
    }
    
    setLoading(false);
  };

  const modalContent = (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10001
    }}>
      <div className="modal-container class-group-modal" style={{
        position: 'relative',
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div className="modal-header">
          <h2>
            {isEditing ? 'Edit Class Group Job' : 'Create Class Group Job'}
          </h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-section">
            <h3>Job Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>
                  <School size={16} />
                  School *
                </label>
                <select
                  value={formData.schoolId}
                  onChange={handleSchoolChange}
                  required
                  disabled={loadingSchools}
                >
                  <option value="">Select a school...</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>
                      {school.value || school.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>
                  <Calendar size={16} />
                  Session Date *
                </label>
                <input
                  type="date"
                  value={formData.sessionDate}
                  onChange={(e) => setFormData({ ...formData, sessionDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Session ID</label>
              <input
                type="text"
                value={formData.sessionId}
                onChange={(e) => setFormData({ ...formData, sessionId: e.target.value })}
                placeholder="Optional session identifier"
              />
            </div>
          </div>

          <div className="form-section">
            <div className="section-header">
              <h3>
                <Users size={18} />
                Class Groups
              </h3>
              <button 
                type="button" 
                className="btn btn-outline-primary btn-sm"
                onClick={addClassGroup}
              >
                <Plus size={16} />
                Add Group
              </button>
            </div>

            <div className="class-groups-editor">
              {formData.classGroups.length === 0 ? (
                <div className="empty-groups">
                  <p>No class groups added yet.</p>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={addClassGroup}
                  >
                    <Plus size={16} />
                    Add First Group
                  </button>
                </div>
              ) : (
                <div className="groups-list">
                  {formData.classGroups.map((group, index) => (
                    <div key={group.id} className="group-editor">
                      <div className="group-header">
                        <span className="group-number">Group {index + 1}</span>
                        <button
                          type="button"
                          className="btn-icon danger"
                          onClick={() => removeClassGroup(group.id)}
                          title="Remove group"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="group-fields">
                        <div className="field-row">
                          <input
                            type="text"
                            placeholder="Grade (e.g., Kindergarten)"
                            value={group.grade}
                            onChange={(e) => updateClassGroup(group.id, 'grade', e.target.value)}
                            required
                          />
                          <input
                            type="text"
                            placeholder="Teacher Name"
                            value={group.teacher}
                            onChange={(e) => updateClassGroup(group.id, 'teacher', e.target.value)}
                          />
                        </div>
                        <div className="field-row">
                          <input
                            type="text"
                            placeholder="Image Numbers (e.g., 4949-53)"
                            value={group.imageNumbers}
                            onChange={(e) => updateClassGroup(group.id, 'imageNumbers', e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="Notes"
                            value={group.notes}
                            onChange={(e) => updateClassGroup(group.id, 'notes', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading || formData.classGroups.length === 0}
            >
              {loading ? (
                <>Saving...</>
              ) : (
                <>
                  <Save size={16} />
                  {isEditing ? 'Save Changes' : 'Create Job'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ClassGroupModal;