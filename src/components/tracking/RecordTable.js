import React, { useState } from 'react';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';

const RecordTable = ({ records, type, onDelete }) => {
  const [sortField, setSortField] = useState('timestamp');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRecords = [...records].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    // Handle timestamp sorting
    if (sortField === 'timestamp') {
      aValue = new Date(aValue.toDate ? aValue.toDate() : aValue);
      bValue = new Date(bValue.toDate ? bValue.toDate() : bValue);
    }

    // Handle string sorting (case insensitive)
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusColor = (status) => {
    if (type === 'sdcard') {
      const colors = {
        'Job Box': '#f59e0b',
        'Camera': '#10b981',
        'Envelope': '#f59e0b',
        'Uploaded': '#3b82f6',
        'Cleared': '#6b7280',
        'Camera Bag': '#8b5cf6',
        'Personal': '#ec4899'
      };
      return colors[status] || '#6b7280';
    } else {
      const colors = {
        'Packed': '#3b82f6',
        'Picked Up': '#10b981',
        'Left Job': '#f59e0b',
        'Turned In': '#6b7280'
      };
      return colors[status] || '#6b7280';
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
  };

  const StatusBadge = ({ status }) => (
    <span 
      className="table-status-badge"
      style={{ backgroundColor: getStatusColor(status) }}
    >
      {status}
    </span>
  );

  if (records.length === 0) {
    return (
      <div className="table-empty-state">
        <p>No {type === 'sdcard' ? 'SD card' : 'job box'} records found</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="records-table">
        <thead>
          <tr>
            <th onClick={() => handleSort(type === 'sdcard' ? 'cardNumber' : 'boxNumber')}>
              <div className="sortable-header">
                <span>{type === 'sdcard' ? 'Card #' : 'Box #'}</span>
                <SortIcon field={type === 'sdcard' ? 'cardNumber' : 'boxNumber'} />
              </div>
            </th>
            <th onClick={() => handleSort('photographerName')}>
              <div className="sortable-header">
                <span>Photographer</span>
                <SortIcon field="photographerName" />
              </div>
            </th>
            <th onClick={() => handleSort('school')}>
              <div className="sortable-header">
                <span>School</span>
                <SortIcon field="school" />
              </div>
            </th>
            <th onClick={() => handleSort('status')}>
              <div className="sortable-header">
                <span>Status</span>
                <SortIcon field="status" />
              </div>
            </th>
            <th onClick={() => handleSort('timestamp')}>
              <div className="sortable-header">
                <span>Timestamp</span>
                <SortIcon field="timestamp" />
              </div>
            </th>
            <th className="actions-header">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedRecords.map((record, index) => (
            <tr key={record.id} className={index % 2 === 0 ? 'row-even' : 'row-odd'}>
              <td className="number-cell">
                #{type === 'sdcard' ? record.cardNumber : record.boxNumber}
              </td>
              <td className="photographer-cell">
                {record.photographerName}
              </td>
              <td className="school-cell">
                {record.school}
              </td>
              <td className="status-cell">
                <StatusBadge status={record.status} />
              </td>
              <td className="timestamp-cell">
                {formatDate(record.timestamp)}
              </td>
              <td className="actions-cell">
                <button
                  className="table-action-btn delete-btn"
                  onClick={() => onDelete(record.id)}
                  title="Delete record"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecordTable;