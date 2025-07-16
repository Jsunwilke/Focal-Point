// src/components/mileage/MileageTable.js
import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  MapPin, 
  Calendar, 
  DollarSign,
  TrendingUp,
  User,
  Navigation,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import './MileageTable.css';

const MileageTable = ({ mileageData, isAdmin, showAllUsers, currentUserId }) => {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'totalMiles', direction: 'desc' });

  const { summary } = mileageData;

  // Sort the employee breakdowns based on current sort configuration
  const sortedEmployees = useMemo(() => {
    const employees = [...summary.employeeBreakdowns];
    
    employees.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      // Handle different data types
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
    
    return employees;
  }, [summary.employeeBreakdowns, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const toggleRowExpansion = (userId) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(userId)) {
      newExpandedRows.delete(userId);
    } else {
      newExpandedRows.add(userId);
    }
    setExpandedRows(newExpandedRows);
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

  if (!summary || !summary.employeeBreakdowns || summary.employeeBreakdowns.length === 0) {
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
          {showAllUsers && isAdmin ? 'Employee Mileage Breakdown' : 'Your Mileage Details'}
        </h3>
        <span className="mileage-table-subtitle">
          {sortedEmployees.length} {sortedEmployees.length === 1 ? 'employee' : 'employees'} • 
          {summary.totalJobs} total jobs
        </span>
      </div>

      <div className="mileage-table-wrapper">
        <table className="mileage-table">
          <thead>
            <tr>
              <th className="expand-column"></th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('userName')}
              >
                <User size={16} />
                Employee
                {getSortIcon('userName')}
              </th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('totalMiles')}
              >
                <MapPin size={16} />
                Total Miles
                {getSortIcon('totalMiles')}
              </th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('totalJobs')}
              >
                <Navigation size={16} />
                Jobs
                {getSortIcon('totalJobs')}
              </th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('averageMilesPerJob')}
              >
                <TrendingUp size={16} />
                Avg/Job
                {getSortIcon('averageMilesPerJob')}
              </th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('mileageRate')}
              >
                <DollarSign size={16} />
                Rate
                {getSortIcon('mileageRate')}
              </th>
              <th 
                className="sortable-header"
                onClick={() => handleSort('totalCompensation')}
              >
                <DollarSign size={16} />
                Compensation
                {getSortIcon('totalCompensation')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEmployees.map((employee) => (
              <React.Fragment key={employee.userId}>
                <tr className={`employee-row ${employee.userId === currentUserId ? 'current-user' : ''}`}>
                  <td className="expand-cell">
                    <button
                      className="expand-button"
                      onClick={() => toggleRowExpansion(employee.userId)}
                      aria-label={`${expandedRows.has(employee.userId) ? 'Collapse' : 'Expand'} details for ${employee.userName}`}
                    >
                      {expandedRows.has(employee.userId) ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </button>
                  </td>
                  <td className="employee-name">
                    <div className="employee-info">
                      <span className="name">{employee.userName}</span>
                      {employee.userId === currentUserId && (
                        <span className="current-user-badge">You</span>
                      )}
                    </div>
                  </td>
                  <td className="miles-cell">
                    <span className="miles-value">{formatMiles(employee.totalMiles)}</span>
                  </td>
                  <td className="jobs-cell">
                    <span className="jobs-value">{employee.totalJobs}</span>
                  </td>
                  <td className="average-cell">
                    <span className="average-value">{formatMiles(employee.averageMilesPerJob)}</span>
                  </td>
                  <td className="rate-cell">
                    <span className="rate-value">{formatCurrency(employee.mileageRate)}</span>
                  </td>
                  <td className="compensation-cell">
                    <span className="compensation-value">{formatCurrency(employee.totalCompensation)}</span>
                  </td>
                </tr>
                
                {expandedRows.has(employee.userId) && (
                  <tr className="expanded-row">
                    <td colSpan="7">
                      <div className="job-details">
                        <h4>Job Details</h4>
                        {employee.reports && employee.reports.length > 0 ? (
                          <div className="job-list">
                            {employee.reports.map((report, index) => (
                              <div key={report.id || index} className="job-item">
                                <div className="job-item-header">
                                  <div className="job-date">
                                    <Calendar size={14} />
                                    {formatDate(report.date)}
                                  </div>
                                  <div className="job-location">
                                    <MapPin size={14} />
                                    {report.schoolOrDestination || 'Unknown Location'}
                                  </div>
                                </div>
                                <div className="job-item-details">
                                  <div className="job-miles">
                                    <span className="label">Miles:</span>
                                    <span className="value">{formatMiles(report.totalMileage)}</span>
                                  </div>
                                  <div className="job-compensation">
                                    <span className="label">Compensation:</span>
                                    <span className="value">
                                      {formatCurrency((report.totalMileage || 0) * (employee.mileageRate || 0))}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="no-jobs">
                            <p>No job details available for this employee.</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mileage-table-footer">
        <div className="table-summary">
          <div className="summary-item">
            <span className="summary-label">Total Miles:</span>
            <span className="summary-value">{formatMiles(summary.totalMiles)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Jobs:</span>
            <span className="summary-value">{summary.totalJobs}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Compensation:</span>
            <span className="summary-value">{formatCurrency(summary.totalCompensation)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MileageTable;