import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Table, Grid } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getJobBoxRecords, deleteJobBoxRecord, JOB_BOX_STATUSES, searchJobBoxes, resolveUserNames } from '../../services/trackingService';
import ManualEntryModal from './ManualEntryModal';
import LoadingSpinner from '../shared/LoadingSpinner';
import RecordTable from './RecordTable';

const JobBoxTab = ({ organizationID }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState(() => {
    // Default to table on desktop, cards on mobile
    return window.innerWidth > 768 ? 'table' : 'cards';
  });
  const { userProfile } = useAuth(); // eslint-disable-line no-unused-vars

  useEffect(() => {
    loadRecords();
  }, [organizationID]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecords = async () => {
    setLoading(true);
    try {
      const result = await getJobBoxRecords(organizationID, { limit: 50 });
      if (result.success) {
        const recordsWithNames = await resolveUserNames(result.data, organizationID);
        setRecords(recordsWithNames);
      } else {
        console.error('Failed to load job box records:', result.error);
      }
    } catch (error) {
      console.error('Error loading job box records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadRecords();
      return;
    }

    setLoading(true);
    try {
      const result = await searchJobBoxes(organizationID, searchTerm, searchField);
      if (result.success) {
        const recordsWithNames = await resolveUserNames(result.data, organizationID);
        setRecords(recordsWithNames);
      } else {
        console.error('Search failed:', result.error);
      }
    } catch (error) {
      console.error('Error searching job boxes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordId) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        const result = await deleteJobBoxRecord(recordId);
        if (result.success) {
          setRecords(records.filter(record => record.id !== recordId));
        } else {
          alert('Failed to delete record: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting record:', error);
        alert('Error deleting record');
      }
    }
  };

  const handleAddRecord = () => {
    setShowAddModal(true);
  };

  const handleRecordAdded = () => {
    setShowAddModal(false);
    loadRecords();
  };

  const getStatusColor = (status) => {
    const colors = {
      'Packed': '#3b82f6',
      'Picked Up': '#10b981',
      'Left Job': '#f59e0b',
      'Turned In': '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const filteredRecords = records.filter(record => {
    if (statusFilter === 'all') return true;
    return record.status === statusFilter;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="job-box-tab">
      <div className="tab-header">
        <h2>Job Box Tracking</h2>
        <div className="header-actions">
          <div className="view-toggle">
            <button 
              className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <Table size={16} />
            </button>
            <button 
              className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Card View"
            >
              <Grid size={16} />
            </button>
          </div>
          <button 
            className="btn btn-primary"
            onClick={handleAddRecord}
          >
            <Plus size={16} />
            Add Record
          </button>
        </div>
      </div>

      <div className="search-controls">
        <div className="search-bar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search job boxes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}>Search</button>
        </div>

        <div className="filters">
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
          >
            <option value="all">All Fields</option>
            <option value="boxNumber">Box Number</option>
            <option value="photographer">Photographer</option>
            <option value="school">School</option>
            <option value="status">Status</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {JOB_BOX_STATUSES.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="records-container">
        {viewMode === 'table' ? (
          <RecordTable 
            records={filteredRecords}
            type="jobbox"
            onDelete={handleDelete}
          />
        ) : (
          <div className="records-grid">
            {filteredRecords.length === 0 ? (
              <div className="empty-state">
                <p>No job box records found</p>
                <button 
                  className="btn btn-primary"
                  onClick={handleAddRecord}
                >
                  Add First Record
                </button>
              </div>
            ) : (
              filteredRecords.map(record => (
                <div key={record.id} className="record-card">
                  <div className="record-header">
                    <div className="box-number">Box #{record.boxNumber}</div>
                    <div className="record-actions">
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(record.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="record-content">
                    <div className="record-field">
                      <span className="label">Photographer:</span>
                      <span className="value">{record.photographerName}</span>
                    </div>
                    
                    <div className="record-field">
                      <span className="label">School:</span>
                      <span className="value">{record.school}</span>
                    </div>
                    
                    <div className="record-field">
                      <span className="label">Status:</span>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(record.status) }}
                      >
                        {record.status}
                      </span>
                    </div>
                    
                    <div className="record-field">
                      <span className="label">Timestamp:</span>
                      <span className="value">{formatDate(record.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <ManualEntryModal
          type="jobbox"
          organizationID={organizationID}
          onClose={() => setShowAddModal(false)}
          onSave={handleRecordAdded}
        />
      )}
    </div>
  );
};

export default JobBoxTab;