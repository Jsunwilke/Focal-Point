// src/components/mileage/MileageTable.js
import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Calendar, 
  DollarSign,
  Navigation,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit
} from 'lucide-react';
import EditMileageModal from './EditMileageModal';
import './MileageTable.css';

const MileageTable = ({ mileageData, currentUserId, onDataRefresh }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [editingReport, setEditingReport] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { userBreakdown } = mileageData;

  // Sort the individual drive reports based on current sort configuration
  const sortedReports = useMemo(() => {
    if (!userBreakdown?.reports) return [];
    
    const reports = [...userBreakdown.reports];
    
    reports.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      // Handle date sorting
      if (sortConfig.key === 'date') {
        aValue = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        bValue = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      }
      
      // Handle other data types
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortConfig.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    return reports;
  }, [userBreakdown?.reports, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };


  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown size={14} className="sort-icon" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="sort-icon sort-icon--active" />
      : <ArrowDown size={14} className="sort-icon sort-icon--active" />;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatMiles = (miles) => {
    return miles ? miles.toFixed(1) : '0.0';
  };

  const formatCurrency = (amount) => {
    return `$${(amount || 0).toFixed(2)}`;
  };

  const handleEditMileage = (report) => {
    setEditingReport({ ...report, employee: userBreakdown });
    setShowEditModal(true);
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setEditingReport(null);
    // Refresh the data
    if (onDataRefresh) {
      onDataRefresh();
    }
  };

  const handleEditCancel = () => {
    setShowEditModal(false);
    setEditingReport(null);
  };

  const canEditMileage = () => {
    // User can always edit their own mileage
    return true;
  };

  if (!userBreakdown || !userBreakdown.reports || userBreakdown.reports.length === 0) {
    return (
      <div className="mileage-table-empty">
        <MapPin size={48} className="empty-icon" />
        <h3>No Mileage Data</h3>
        <p>No mileage data found for the selected period.</p>
      </div>
    );
  }

  return (
    <div className="mileage-table-container">
      <div className="mileage-table-header">
        <h3>
          Your Mileage Details
        </h3>
        <span className="mileage-table-subtitle">
          {sortedReports.length} {sortedReports.length === 1 ? 'drive' : 'drives'} • 
          {userBreakdown.totalJobs} total jobs
        </span>
      </div>

      <div className="mileage-table-wrapper">
        <table className="mileage-table">
          <thead>
            <tr>
              <th 
                className="sortable-header"
                onClick={() => handleSort('date')}
              >
                <div className="header-content">
                  <Calendar size={16} />
                  <span>Date</span>
                  {getSortIcon('date')}
                </div>
              </th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('schoolOrDestination')}
              >
                <div className="header-content">
                  <MapPin size={16} />
                  <span>Location</span>
                  {getSortIcon('schoolOrDestination')}
                </div>
              </th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('totalMileage')}
              >
                <div className="header-content">
                  <Navigation size={16} />
                  <span>Miles</span>
                  {getSortIcon('totalMileage')}
                </div>
              </th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('compensation')}
              >
                <div className="header-content">
                  <DollarSign size={16} />
                  <span>Compensation</span>
                  {getSortIcon('compensation')}
                </div>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedReports.map((report, index) => {
              const compensation = (report.totalMileage || 0) * (userBreakdown.mileageRate || 0);
              return (
                <tr key={report.id || index} className="drive-row">
                  <td className="date-cell">
                    <span className="date-value">{formatDate(report.date)}</span>
                  </td>
                  <td className="location-cell">
                    <span className="location-value">{report.schoolOrDestination || 'Unknown Location'}</span>
                    {report.notes && (
                      <div className="notes-preview" title={report.notes}>
                        {report.notes}
                      </div>
                    )}
                  </td>
                  <td className="miles-cell">
                    <span className="miles-value">{formatMiles(report.totalMileage)}</span>
                  </td>
                  <td className="compensation-cell">
                    <span className="compensation-value">{formatCurrency(compensation)}</span>
                  </td>
                  <td className="actions-cell">
                    {canEditMileage() && (
                      <button
                        className="edit-mileage-btn"
                        onClick={() => handleEditMileage(report)}
                        title="Edit mileage for this drive"
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mileage-table-footer">
        <div className="table-summary">
          <div className="summary-item">
            <span className="summary-label">Total Miles:</span>
            <span className="summary-value">{formatMiles(userBreakdown.totalMiles)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Jobs:</span>
            <span className="summary-value">{userBreakdown.totalJobs}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Compensation:</span>
            <span className="summary-value">{formatCurrency(userBreakdown.totalCompensation)}</span>
          </div>
        </div>
      </div>

      {/* Edit Mileage Modal */}
      <EditMileageModal
        isOpen={showEditModal}
        onClose={handleEditCancel}
        onSuccess={handleEditSuccess}
        jobReport={editingReport}
        mileageRate={userBreakdown?.mileageRate || 0}
      />
    </div>
  );
};

export default MileageTable;