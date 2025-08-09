// src/components/payroll/PayrollTable.js
import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Calendar, 
  User, 
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Award,
  Filter,
  Search,
  X
} from 'lucide-react';
import { formatDuration } from '../../firebase/firestore';

const PayrollTable = ({ payrollData, loading, onEmployeeSelect }) => {
  const [expandedEmployees, setExpandedEmployees] = useState(new Set());
  const [sortField, setSortField] = useState('hours.total');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterText, setFilterText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');

  if (loading) {
    return (
      <div className="payroll-table-loading">
        <Clock size={48} className="loading-icon" />
        <p>Loading payroll data...</p>
      </div>
    );
  }

  if (!payrollData || !payrollData.summary) {
    return (
      <div className="payroll-table-empty">
        <Calendar size={48} className="empty-icon" />
        <h3>No Payroll Data</h3>
        <p>Select a pay period to view timesheet data.</p>
      </div>
    );
  }

  const { employees, totals } = payrollData.summary;

  // Helper function to get nested object values for sorting
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => current?.[key], obj) ?? 0;
  };

  // Filter and sort employees
  const filteredEmployees = employees.filter(emp => {
    // Add null checks for employee properties
    if (!emp || !emp.employee) return false;
    
    const matchesText = !filterText || 
      (emp.employee.name && emp.employee.name.toLowerCase().includes(filterText.toLowerCase())) ||
      (emp.employee.email && emp.employee.email.toLowerCase().includes(filterText.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || emp.employee.role === roleFilter;
    
    return matchesText && matchesRole;
  });

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    let aValue = getNestedValue(a, sortField);
    let bValue = getNestedValue(b, sortField);
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });

  const toggleEmployeeExpansion = (employeeId) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedEmployees(newExpanded);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const getEmployeeStatusIcon = (employee) => {
    if (employee.hours.total === 0) {
      return <AlertCircle size={16} className="status-icon status-icon--warning" title="No hours recorded" />;
    }
    // Perfect attendance takes priority
    if (employee.attendance && employee.attendance.percentage === 100 && employee.attendance.assigned > 0) {
      return <CheckCircle size={16} className="status-icon status-icon--perfect" title="Perfect attendance" />;
    }
    if (employee.hours.total >= totals.avgHoursPerEmployee * 1.2) {
      return <Award size={16} className="status-icon status-icon--high" title="High performer" />;
    }
    if (employee.hours.overtime.total.hours > 0) {
      return <TrendingUp size={16} className="status-icon status-icon--overtime" title="Overtime hours" />;
    }
    if (employee.attendance && employee.attendance.percentage < 80) {
      return <AlertCircle size={16} className="status-icon status-icon--warning" title="Low attendance" />;
    }
    return <CheckCircle size={16} className="status-icon status-icon--normal" title="Normal hours" />;
  };

  const formatTimeEntry = (entry) => {
    const formatTime = (timestamp) => {
      if (!timestamp) return 'N/A';
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    };

    const duration = entry.clockInTime && entry.clockOutTime 
      ? ((new Date(entry.clockOutTime.seconds * 1000) - new Date(entry.clockInTime.seconds * 1000)) / (1000 * 60 * 60)).toFixed(2)
      : 'Active';

    // Parse date string to avoid timezone issues
    const [year, month, day] = entry.date.split('-').map(Number);
    const entryDate = new Date(year, month - 1, day); // month is 0-indexed
    
    return {
      date: entryDate.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric' 
      }),
      timeIn: formatTime(entry.clockInTime),
      timeOut: entry.clockOutTime ? formatTime(entry.clockOutTime) : 'Still clocked in',
      duration: duration + (typeof duration === 'number' ? 'h' : ''),
      status: entry.status,
      notes: entry.notes || '',
      sessionId: entry.sessionId
    };
  };

  const uniqueRoles = [...new Set(employees
    .filter(emp => emp && emp.employee && emp.employee.role)
    .map(emp => emp.employee.role))];

  return (
    <div className="payroll-table">
      {/* Summary Cards */}
      <div className="payroll-summary-cards">
        <div className="summary-card">
          <div className="summary-card-icon">
            <Clock size={24} />
          </div>
          <div className="summary-card-content">
            <div className="summary-card-value">{totals.formatted.totalHours}</div>
            <div className="summary-card-label">Total Hours</div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-card-icon">
            <User size={24} />
          </div>
          <div className="summary-card-content">
            <div className="summary-card-value">{totals.employeesWithHours}</div>
            <div className="summary-card-label">Active Employees</div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-card-icon">
            <TrendingUp size={24} />
          </div>
          <div className="summary-card-content">
            <div className="summary-card-value">{totals.formatted.avgHoursPerEmployee}</div>
            <div className="summary-card-label">Avg Hours/Employee</div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-card-icon">
            <Calendar size={24} />
          </div>
          <div className="summary-card-content">
            <div className="summary-card-value">{totals.totalSessions}</div>
            <div className="summary-card-label">Total Sessions</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="payroll-table-controls">
        <div className="table-controls-left">
          <div className="search-box">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search employees..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="search-input"
              />
              {filterText && (
                <button 
                  className="search-clear"
                  onClick={() => setFilterText('')}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="table-controls-right">
          <button 
            className={`filter-toggle ${showFilters ? 'filter-toggle--active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filters
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-group">
            <label className="filter-label">Role</label>
            <select 
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Roles</option>
              {uniqueRoles.map(role => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Employee Table */}
      <div className="employee-table">
        <div className="table-header">
          <div className="table-row table-header-row">
            <div className="table-cell table-cell--expand"></div>
            <div 
              className="table-cell table-cell--sortable" 
              onClick={() => handleSort('employee.name')}
            >
              Employee {getSortIcon('employee.name')}
            </div>
            <div 
              className="table-cell table-cell--sortable table-cell--center" 
              onClick={() => handleSort('employee.role')}
            >
              Role {getSortIcon('employee.role')}
            </div>
            <div 
              className="table-cell table-cell--sortable table-cell--right" 
              onClick={() => handleSort('hours.total')}
            >
              Total Hours {getSortIcon('hours.total')}
            </div>
            <div 
              className="table-cell table-cell--sortable table-cell--center" 
              onClick={() => handleSort('entries.sessions')}
            >
              Sessions {getSortIcon('entries.sessions')}
            </div>
            <div 
              className="table-cell table-cell--sortable table-cell--center" 
              onClick={() => handleSort('period.workDays.length')}
            >
              Work Days {getSortIcon('period.workDays.length')}
            </div>
            <div className="table-cell table-cell--center">Status</div>
          </div>
        </div>

        <div className="table-body">
          {sortedEmployees.map((employee) => (
            <div key={employee.employee.id} className="employee-row">
              {/* Main employee row */}
              <div className="table-row employee-summary-row">
                <div className="table-cell table-cell--expand">
                  <button
                    className="expand-button"
                    onClick={() => toggleEmployeeExpansion(employee.employee.id)}
                  >
                    {expandedEmployees.has(employee.employee.id) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                </div>
                <div 
                  className="table-cell employee-info"
                  onClick={() => toggleEmployeeExpansion(employee.employee.id)}
                >
                  <div className="employee-name">{employee.employee.name}</div>
                  <div className="employee-email">{employee.employee.email}</div>
                </div>
                <div className="table-cell table-cell--center">
                  <span className={`role-badge role-badge--${employee.employee.role}`}>
                    {employee.employee.role}
                  </span>
                </div>
                <div className="table-cell table-cell--right hours-cell">
                  <div className="hours-main">{employee.hours.formatted}</div>
                  <div className="hours-regular">
                    {formatDuration(employee.hours.total - employee.hours.overtime.total.hours)} reg
                  </div>
                  {employee.hours.overtime.total.hours > 0 && (
                    <div className="hours-overtime">
                      {employee.hours.overtime.total.formatted} OT
                    </div>
                  )}
                </div>
                <div className="table-cell table-cell--center">{employee.entries.sessions}</div>
                <div className="table-cell table-cell--center">{employee.period.workDays.length}</div>
                <div className="table-cell table-cell--center status-cell">
                  {getEmployeeStatusIcon(employee)}
                </div>
              </div>

              {/* Expanded detail rows */}
              {expandedEmployees.has(employee.employee.id) && (
                <div className="employee-details">
                  <div className="detail-section">
                    <h4 className="detail-section-title">
                      <Calendar size={16} />
                      Time Entries ({employee.entries.total})
                    </h4>
                    
                    {employee.entries.details.length > 0 ? (
                      <div className="time-entries-table">
                        <div className="time-entry-header">
                          <div className="time-entry-cell">Date</div>
                          <div className="time-entry-cell">Time In</div>
                          <div className="time-entry-cell">Time Out</div>
                          <div className="time-entry-cell">Duration</div>
                          <div className="time-entry-cell">Status</div>
                          <div className="time-entry-cell">Notes</div>
                        </div>
                        
                        {employee.entries.details.map((entry, index) => {
                          const formattedEntry = formatTimeEntry(entry);
                          return (
                            <div key={index} className="time-entry-row">
                              <div className="time-entry-cell">{formattedEntry.date}</div>
                              <div className="time-entry-cell">{formattedEntry.timeIn}</div>
                              <div className="time-entry-cell">{formattedEntry.timeOut}</div>
                              <div className="time-entry-cell">{formattedEntry.duration}</div>
                              <div className="time-entry-cell">
                                <span className={`status-badge status-badge--${formattedEntry.status}`}>
                                  {formattedEntry.status === 'clocked-in' ? 'ACTIVE' : formattedEntry.status}
                                </span>
                              </div>
                              <div className="time-entry-cell time-entry-notes">
                                {formattedEntry.notes || '-'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="no-entries">
                        <Clock size={24} />
                        <p>No time entries for this period</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Results Summary */}
      <div className="table-footer">
        <div className="results-summary">
          Showing {sortedEmployees.length} of {employees.length} employees
          {filterText && ` matching "${filterText}"`}
        </div>
      </div>
    </div>
  );
};

export default PayrollTable;