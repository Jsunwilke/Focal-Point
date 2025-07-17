import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { addSDCardRecord, addJobBoxRecord, SD_CARD_STATUSES, JOB_BOX_STATUSES } from '../../services/trackingService';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { firestore } from '../../firebase/config';

const ManualEntryModal = ({ type, organizationID, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    cardNumber: '',
    boxNumber: '',
    school: '',
    status: '',
    uploadedFromJasonsHouse: '',
    uploadedFromAndysHouse: '',
    shiftUid: ''
  });
  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState([]);
  const [users, setUsers] = useState([]);
  const { userProfile } = useAuth();

  useEffect(() => {
    loadSchools();
    loadUsers();
  }, [organizationID]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSchools = async () => {
    try {
      const schoolsQuery = query(
        collection(firestore, 'schools'),
        where('organizationID', '==', organizationID)
      );
      const schoolsSnapshot = await getDocs(schoolsQuery);
      const schoolsList = schoolsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSchools(schoolsList);
    } catch (error) {
      console.error('Error loading schools:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const usersQuery = query(
        collection(firestore, 'users'),
        where('organizationID', '==', organizationID)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const recordData = {
        ...formData,
        userId: userProfile.uid,
        organizationID: organizationID,
        timestamp: new Date()
      };

      let result;
      if (type === 'sdcard') {
        if (!formData.cardNumber || !formData.school || !formData.status) {
          alert('Please fill in all required fields');
          setLoading(false);
          return;
        }
        result = await addSDCardRecord(recordData);
      } else {
        if (!formData.boxNumber || !formData.school || !formData.status) {
          alert('Please fill in all required fields');
          setLoading(false);
          return;
        }
        result = await addJobBoxRecord(recordData);
      }

      if (result.success) {
        onSave();
      } else {
        alert('Error saving record: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving record:', error);
      alert('Error saving record');
    } finally {
      setLoading(false);
    }
  };

  const statuses = type === 'sdcard' ? SD_CARD_STATUSES : JOB_BOX_STATUSES;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Add {type === 'sdcard' ? 'SD Card' : 'Job Box'} Record</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor={type === 'sdcard' ? 'cardNumber' : 'boxNumber'}>
              {type === 'sdcard' ? 'Card Number' : 'Box Number'} *
            </label>
            <input
              type="text"
              id={type === 'sdcard' ? 'cardNumber' : 'boxNumber'}
              name={type === 'sdcard' ? 'cardNumber' : 'boxNumber'}
              value={type === 'sdcard' ? formData.cardNumber : formData.boxNumber}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="school">School *</label>
            <select
              id="school"
              name="school"
              value={formData.school}
              onChange={handleInputChange}
              required
            >
              <option value="">Select School</option>
              {schools.map(school => (
                <option key={school.id} value={school.name}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="status">Status *</label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Status</option>
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {type === 'sdcard' && (
            <>
              <div className="form-group">
                <label htmlFor="uploadedFromJasonsHouse">Uploaded from Jason's House</label>
                <select
                  id="uploadedFromJasonsHouse"
                  name="uploadedFromJasonsHouse"
                  value={formData.uploadedFromJasonsHouse}
                  onChange={handleInputChange}
                >
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="uploadedFromAndysHouse">Uploaded from Andy's House</label>
                <select
                  id="uploadedFromAndysHouse"
                  name="uploadedFromAndysHouse"
                  value={formData.uploadedFromAndysHouse}
                  onChange={handleInputChange}
                >
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </>
          )}

          {type === 'jobbox' && (
            <div className="form-group">
              <label htmlFor="shiftUid">Shift (Optional)</label>
              <input
                type="text"
                id="shiftUid"
                name="shiftUid"
                value={formData.shiftUid}
                onChange={handleInputChange}
                placeholder="Shift UID"
              />
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualEntryModal;