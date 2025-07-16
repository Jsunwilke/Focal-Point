// src/components/workflow/overview/WorkflowFilters.js
import React from 'react';
import { Search, X } from 'lucide-react';

const WorkflowFilters = ({ filters, onFiltersChange, sessionData, workflows = [] }) => {
  const updateFilter = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  // Get unique schools from both sessions and tracking workflows
  const sessionSchools = Object.values(sessionData)
    .filter(session => session.schoolName)
    .map(session => ({ id: session.schoolId, name: session.schoolName }));
  
  const trackingSchools = workflows
    .filter(workflow => workflow.workflowType === 'tracking' && workflow.schoolName)
    .map(workflow => ({ id: workflow.schoolId, name: workflow.schoolName }));
  
  const schools = [...new Set(
    [...sessionSchools, ...trackingSchools]
      .map(school => JSON.stringify(school))
  )].map(str => JSON.parse(str));

  // Get unique session types
  const sessionTypes = [...new Set(
    Object.values(sessionData)
      .flatMap(session => session.sessionTypes || [])
  )].filter(Boolean);

  const hasActiveFilters = filters.status !== 'all' || 
    filters.school !== 'all' || 
    filters.sessionType !== 'all' || 
    filters.dateRange !== 'all' || 
    filters.search !== '';

  const clearFilters = () => {
    onFiltersChange({
      status: 'all',
      school: 'all',
      sessionType: 'all',
      dateRange: 'all',
      search: ''
    });
  };

  return (
    <div className="workflow-filters">
      {/* Search */}
      <div className="filter-search">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Search workflows..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="search-input"
        />
      </div>

      {/* Status Filter */}
      <select 
        value={filters.status} 
        onChange={(e) => updateFilter('status', e.target.value)}
        className="filter-select"
      >
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
        <option value="on_hold">On Hold</option>
        <option value="cancelled">Cancelled</option>
      </select>

      {/* School Filter */}
      <select 
        value={filters.school} 
        onChange={(e) => updateFilter('school', e.target.value)}
        className="filter-select"
      >
        <option value="all">All Schools</option>
        {schools.map(school => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>

      {/* Session Type Filter */}
      <select 
        value={filters.sessionType} 
        onChange={(e) => updateFilter('sessionType', e.target.value)}
        className="filter-select"
      >
        <option value="all">All Types</option>
        {sessionTypes.map(type => (
          <option key={type} value={type}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </option>
        ))}
      </select>

      {/* Date Range Filter */}
      <select 
        value={filters.dateRange} 
        onChange={(e) => updateFilter('dateRange', e.target.value)}
        className="filter-select"
      >
        <option value="all">All Time</option>
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
      </select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button 
          onClick={clearFilters}
          className="clear-filters-button"
          title="Clear all filters"
        >
          <X size={16} />
          Clear
        </button>
      )}
    </div>
  );
};

export default WorkflowFilters;