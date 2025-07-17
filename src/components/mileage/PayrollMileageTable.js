// src/components/mileage/PayrollMileageTable.js
import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Calendar, 
  DollarSign,
  Navigation,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Users
} from 'lucide-react';
import './PayrollMileageTable.css';

const PayrollMileageTable = ({ mileageData, loading }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'totalMiles', direction: 'desc' });
  const [expandedEmployees, setExpandedEmployees] = useState(new Set());

  // Initialize all employees as collapsed
  React.useEffect(() => {
    if (mileageData?.summary?.employeeBreakdowns) {
      setExpandedEmployees(new Set()); // Start with all collapsed
    }
  }, [mileageData]);

  const toggleEmployee = (userId) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedEmployees(newExpanded);
  };

  const toggleAllEmployees = () => {
    if (expandedEmployees.size === 0) {
      // Expand all
      const allEmployeeIds = mileageData.summary.employeeBreakdowns.map(emp => emp.userId);
      setExpandedEmployees(new Set(allEmployeeIds));
    } else {
      // Collapse all
      setExpandedEmployees(new Set());
    }
  };

  // Sort employees based on current sort configuration
  const sortedEmployees = useMemo(() => {
    if (!mileageData?.summary?.employeeBreakdowns) return [];
    
    const employees = [...mileageData.summary.employeeBreakdowns];
    
    employees.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      // Handle string sorting (names)
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
  }, [mileageData, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown size={16} className="sort-icon" />;
    }
    return sortConfig.direction === 'desc' 
      ? <ArrowDown size={16} className="sort-icon sort-icon--active" />
      : <ArrowUp size={16} className="sort-icon sort-icon--active" />;
  };

  const formatDate = (dateValue) => {
    try {
      let date;
      if (dateValue?.toDate) {
        date = dateValue.toDate();
      } else {
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <div className="payroll-mileage-table payroll-mileage-table--loading">
        <div className="loading-spinner"></div>
        <p>Loading mileage data...</p>
      </div>
    );
  }

  if (!mileageData || !mileageData.summary || !mileageData.summary.employeeBreakdowns || mileageData.summary.employeeBreakdowns.length === 0) {
    return (
      <div className="payroll-mileage-table payroll-mileage-table--empty">
        <MapPin size={48} className="empty-icon" />
        <h3>No Mileage Data</h3>
        <p>No mileage records found for the selected period.</p>
      </div>
    );
  }

  return (
    <div className="payroll-mileage-table">
      <div className="payroll-mileage-header">
        <div className="payroll-mileage-header-info">
          <h3 className="payroll-mileage-title">
            <Navigation size={20} />
            Employee Mileage Summary
          </h3>
          <p className="payroll-mileage-subtitle">
            {sortedEmployees.length} employee{sortedEmployees.length !== 1 ? 's' : ''} • {mileageData.summary.totalMiles.toFixed(1)} total miles • ${mileageData.summary.totalCompensation.toFixed(2)} total compensation
          </p>
        </div>
        <button 
          className="expand-all-btn"
          onClick={toggleAllEmployees}
          type="button"
        >
          {expandedEmployees.size === 0 ? (
            <>
              <ChevronRight size={16} />
              Expand All
            </>
          ) : (
            <>
              <ChevronDown size={16} />
              Collapse All
            </>
          )}
        </button>
      </div>

      <div className="payroll-mileage-table-container">
        <table className="payroll-mileage-table-element">
          <thead>
            <tr>
              <th className="expand-column"></th>
              <th 
                className={`sortable ${sortConfig.key === 'userName' ? 'sorted' : ''}`}
                onClick={() => handleSort('userName')}
              >
                <div className="header-content">
                  <Users size={16} />
                  Employee
                  {getSortIcon('userName')}
                </div>
              </th>
              <th 
                className={`sortable ${sortConfig.key === 'totalMiles' ? 'sorted' : ''}`}
                onClick={() => handleSort('totalMiles')}
              >
                <div className="header-content">
                  <MapPin size={16} />
                  Miles
                  {getSortIcon('totalMiles')}
                </div>
              </th>
              <th 
                className={`sortable ${sortConfig.key === 'totalJobs' ? 'sorted' : ''}`}
                onClick={() => handleSort('totalJobs')}
              >
                <div className="header-content">
                  <Navigation size={16} />
                  Jobs
                  {getSortIcon('totalJobs')}
                </div>
              </th>
              <th 
                className={`sortable ${sortConfig.key === 'totalCompensation' ? 'sorted' : ''}`}
                onClick={() => handleSort('totalCompensation')}
              >
                <div className="header-content">
                  <DollarSign size={16} />
                  Compensation
                  {getSortIcon('totalCompensation')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEmployees.map((employee) => (
              <React.Fragment key={employee.userId}>
                {/* Employee Summary Row */}
                <tr 
                  className={`employee-summary-row ${expandedEmployees.has(employee.userId) ? 'expanded' : ''}`}
                  onClick={() => toggleEmployee(employee.userId)}
                >
                  <td className="expand-cell">
                    {expandedEmployees.has(employee.userId) ? (
                      <ChevronDown size={16} className="expand-icon" />
                    ) : (
                      <ChevronRight size={16} className="expand-icon" />
                    )}
                  </td>
                  <td className="employee-name">
                    {employee.userName || 'Unknown Employee'}
                  </td>
                  <td className="miles-cell">
                    {employee.totalMiles.toFixed(1)}
                  </td>
                  <td className="jobs-cell">
                    {employee.totalJobs}
                  </td>
                  <td className="compensation-cell">
                    ${employee.totalCompensation.toFixed(2)}
                  </td>
                </tr>

                {/* Employee Details Rows */}
                {expandedEmployees.has(employee.userId) && employee.reports && employee.reports.length > 0 && (
                  <tr className="employee-details-row">
                    <td colSpan="5" className="employee-details-cell">
                      <div className="employee-details">
                        <div className="details-header">
                          <h4>Individual Drives</h4>
                          <span className="details-subtitle">
                            {employee.reports.length} drive{employee.reports.length !== 1 ? 's' : ''} • 
                            Rate: ${employee.mileageRate.toFixed(2)}/mile
                          </span>
                        </div>
                        <div className="details-table-container">
                          <table className="details-table">
                            <thead>
                              <tr>
                                <th><Calendar size={14} /> Date</th>
                                <th><MapPin size={14} /> Location</th>
                                <th><Navigation size={14} /> Miles</th>
                                <th><DollarSign size={14} /> Compensation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employee.reports.map((report, index) => (
                                <tr key={index}>
                                  <td className="date-cell">
                                    {formatDate(report.date)}
                                  </td>
                                  <td className="location-cell">
                                    {report.schoolOrDestination || 'Unknown Location'}
                                  </td>
                                  <td className="miles-cell">
                                    {(report.totalMileage || 0).toFixed(1)}
                                  </td>
                                  <td className="compensation-cell">
                                    ${((report.totalMileage || 0) * employee.mileageRate).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayrollMileageTable;