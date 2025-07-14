// src/components/payroll/PayrollExportModal.js
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { 
  X, 
  Download, 
  FileText, 
  Table, 
  CheckCircle, 
  AlertCircle,
  Clock,
  User,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Button from '../shared/Button';

const PayrollExportModal = ({ isOpen, onClose, payrollData, period }) => {
  const [exportFormat, setExportFormat] = useState('excel');
  const [exportOptions, setExportOptions] = useState({
    includeSummary: true,
    includeDetails: true,
    includeOvertime: true,
    includeNotes: false,
    employeesOnly: false // If true, exclude employees with 0 hours
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);

  if (!isOpen) return null;

  const handleExportOptionChange = (option, value) => {
    setExportOptions(prev => ({
      ...prev,
      [option]: value
    }));
  };

  const generateFileName = () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const periodStr = period?.type || 'custom';
    const extension = exportFormat === 'excel' ? 'xlsx' : 'csv';
    
    return `payroll_${periodStr}_${dateStr}.${extension}`;
  };

  const formatTimeEntry = (entry) => {
    const formatTime = (timestamp) => {
      if (!timestamp) return '';
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    };

    const duration = entry.clockInTime && entry.clockOutTime 
      ? ((new Date(entry.clockOutTime.seconds * 1000) - new Date(entry.clockInTime.seconds * 1000)) / (1000 * 60 * 60))
      : 0;

    return {
      date: entry.date,
      timeIn: formatTime(entry.clockInTime),
      timeOut: entry.clockOutTime ? formatTime(entry.clockOutTime) : '',
      duration: duration.toFixed(2),
      status: entry.status,
      notes: entry.notes || '',
      sessionId: entry.sessionId || ''
    };
  };

  const generateExcelWorkbook = () => {
    const workbook = XLSX.utils.book_new();

    // Filter employees based on options
    const employees = exportOptions.employeesOnly 
      ? payrollData.summary.employees.filter(emp => emp.hours.total > 0)
      : payrollData.summary.employees;

    // Summary Sheet
    if (exportOptions.includeSummary) {
      const summaryData = [
        ['Payroll Summary Report'],
        ['Period:', period?.label || 'Custom Period'],
        ['Generated:', new Date().toLocaleString()],
        [''],
        ['Organization Totals'],
        ['Total Hours:', payrollData.summary.totals.formatted.totalHours],
        ['Total Employees:', payrollData.summary.totals.totalEmployees],
        ['Employees with Hours:', payrollData.summary.totals.employeesWithHours],
        ['Average Hours per Employee:', payrollData.summary.totals.formatted.avgHoursPerEmployee],
        ['Total Sessions:', payrollData.summary.totals.totalSessions],
        [''],
        ['Employee Summary'],
        ['Name', 'Email', 'Role', 'Total Hours', 'Regular Hours', 'Overtime Hours', 'Sessions', 'Work Days', 'Status']
      ];

      employees.forEach(emp => {
        const regularHours = emp.hours.total - emp.hours.overtime.total.hours;
        const status = emp.hours.total === 0 ? 'No Hours' : 
                     emp.hours.overtime.total.hours > 0 ? 'Has Overtime' : 'Normal';
        
        summaryData.push([
          emp.employee.name,
          emp.employee.email,
          emp.employee.role,
          emp.hours.total.toFixed(2),
          regularHours.toFixed(2),
          emp.hours.overtime.total.hours.toFixed(2),
          emp.entries.sessions,
          emp.period.workDays.length,
          status
        ]);
      });

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Set column widths
      summarySheet['!cols'] = [
        { wch: 20 }, // Name
        { wch: 25 }, // Email
        { wch: 12 }, // Role
        { wch: 12 }, // Total Hours
        { wch: 12 }, // Regular Hours
        { wch: 12 }, // Overtime Hours
        { wch: 10 }, // Sessions
        { wch: 10 }, // Work Days
        { wch: 12 }  // Status
      ];

      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    }

    // Detailed Time Entries Sheet
    if (exportOptions.includeDetails) {
      const detailHeaders = ['Employee Name', 'Employee Email', 'Date', 'Time In', 'Time Out', 'Duration (Hours)', 'Status'];
      
      if (exportOptions.includeNotes) {
        detailHeaders.push('Notes');
      }
      
      detailHeaders.push('Session ID');

      const detailData = [detailHeaders];

      employees.forEach(emp => {
        emp.entries.details.forEach(entry => {
          const formattedEntry = formatTimeEntry(entry);
          const row = [
            emp.employee.name,
            emp.employee.email,
            formattedEntry.date,
            formattedEntry.timeIn,
            formattedEntry.timeOut,
            formattedEntry.duration,
            formattedEntry.status
          ];

          if (exportOptions.includeNotes) {
            row.push(formattedEntry.notes);
          }
          
          row.push(formattedEntry.sessionId);
          detailData.push(row);
        });
      });

      const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
      
      // Set column widths
      const colWidths = [
        { wch: 20 }, // Employee Name
        { wch: 25 }, // Employee Email
        { wch: 12 }, // Date
        { wch: 10 }, // Time In
        { wch: 10 }, // Time Out
        { wch: 15 }, // Duration
        { wch: 12 }  // Status
      ];

      if (exportOptions.includeNotes) {
        colWidths.push({ wch: 30 }); // Notes
      }
      
      colWidths.push({ wch: 15 }); // Session ID

      detailSheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Time Entries');
    }

    // Overtime Sheet (if overtime data exists and option is selected)
    if (exportOptions.includeOvertime) {
      const employeesWithOvertime = employees.filter(emp => emp.hours.overtime.total.hours > 0);
      
      if (employeesWithOvertime.length > 0) {
        const overtimeData = [
          ['Overtime Report'],
          ['Period:', period?.label || 'Custom Period'],
          [''],
          ['Employee Name', 'Email', 'Total Hours', 'Regular Hours', 'Daily Overtime', 'Weekly Overtime', 'Total Overtime']
        ];

        employeesWithOvertime.forEach(emp => {
          const regularHours = emp.hours.total - emp.hours.overtime.total.hours;
          overtimeData.push([
            emp.employee.name,
            emp.employee.email,
            emp.hours.total.toFixed(2),
            regularHours.toFixed(2),
            emp.hours.overtime.daily.hours.toFixed(2),
            emp.hours.overtime.weekly.hours.toFixed(2),
            emp.hours.overtime.total.hours.toFixed(2)
          ]);
        });

        const overtimeSheet = XLSX.utils.aoa_to_sheet(overtimeData);
        overtimeSheet['!cols'] = [
          { wch: 20 }, // Name
          { wch: 25 }, // Email
          { wch: 12 }, // Total Hours
          { wch: 12 }, // Regular Hours
          { wch: 12 }, // Daily OT
          { wch: 12 }, // Weekly OT
          { wch: 12 }  // Total OT
        ];

        XLSX.utils.book_append_sheet(workbook, overtimeSheet, 'Overtime');
      }
    }

    return workbook;
  };

  const generateCSVData = () => {
    // For CSV, we'll create a simplified single-sheet format
    const employees = exportOptions.employeesOnly 
      ? payrollData.summary.employees.filter(emp => emp.hours.total > 0)
      : payrollData.summary.employees;

    const headers = ['Employee Name', 'Email', 'Role', 'Total Hours', 'Regular Hours', 'Overtime Hours', 'Sessions', 'Work Days'];
    
    if (exportOptions.includeDetails) {
      headers.push('Entry Date', 'Time In', 'Time Out', 'Entry Duration', 'Entry Status');
      
      if (exportOptions.includeNotes) {
        headers.push('Notes');
      }
    }

    const csvData = [headers];

    employees.forEach(emp => {
      const regularHours = emp.hours.total - emp.hours.overtime.total.hours;
      const baseRow = [
        emp.employee.name,
        emp.employee.email,
        emp.employee.role,
        emp.hours.total.toFixed(2),
        regularHours.toFixed(2),
        emp.hours.overtime.total.hours.toFixed(2),
        emp.entries.sessions,
        emp.period.workDays.length
      ];

      if (exportOptions.includeDetails && emp.entries.details.length > 0) {
        emp.entries.details.forEach(entry => {
          const formattedEntry = formatTimeEntry(entry);
          const row = [...baseRow];
          row.push(
            formattedEntry.date,
            formattedEntry.timeIn,
            formattedEntry.timeOut,
            formattedEntry.duration,
            formattedEntry.status
          );

          if (exportOptions.includeNotes) {
            row.push(formattedEntry.notes);
          }

          csvData.push(row);
        });
      } else {
        // Add empty detail columns if no details
        if (exportOptions.includeDetails) {
          const emptyDetails = ['', '', '', '', ''];
          if (exportOptions.includeNotes) emptyDetails.push('');
          baseRow.push(...emptyDetails);
        }
        csvData.push(baseRow);
      }
    });

    return csvData;
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus(null);

    try {
      const fileName = generateFileName();

      if (exportFormat === 'excel') {
        const workbook = generateExcelWorkbook();
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, fileName);
      } else {
        const csvData = generateCSVData();
        const csvContent = csvData.map(row => 
          row.map(cell => 
            typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
          ).join(',')
        ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, fileName);
      }

      setExportStatus({ type: 'success', message: `Payroll data exported successfully as ${fileName}` });
      
      // Auto-close after successful export
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Export error:', error);
      setExportStatus({ type: 'error', message: 'Failed to export payroll data. Please try again.' });
    } finally {
      setIsExporting(false);
    }
  };

  const getExportPreview = () => {
    const employees = exportOptions.employeesOnly 
      ? payrollData.summary.employees.filter(emp => emp.hours.total > 0)
      : payrollData.summary.employees;

    return {
      employeeCount: employees.length,
      totalEntries: employees.reduce((sum, emp) => sum + emp.entries.details.length, 0),
      hasOvertime: employees.some(emp => emp.hours.overtime.total.hours > 0)
    };
  };

  const preview = getExportPreview();

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal modal--medium"
        style={{
          position: 'relative',
          margin: '0',
          transform: 'none',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div className="modal__header-content">
            <h2 className="modal__title">
              <Download size={20} />
              Export Payroll Data
            </h2>
            <p className="modal__subtitle">
              Export timesheet data for {period?.label || 'selected period'}
            </p>
          </div>
          <button className="modal__close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="modal__content">
          {/* Export Format Selection */}
          <div className="export-section">
            <h3 className="export-section-title">Export Format</h3>
            <div className="format-options">
              <label className="format-option">
                <input
                  type="radio"
                  name="exportFormat"
                  value="excel"
                  checked={exportFormat === 'excel'}
                  onChange={(e) => setExportFormat(e.target.value)}
                />
                <div className="format-option-content">
                  <FileSpreadsheet size={24} className="format-icon" />
                  <div>
                    <div className="format-title">Excel (.xlsx)</div>
                    <div className="format-description">Multiple sheets with detailed formatting</div>
                  </div>
                </div>
              </label>
              
              <label className="format-option">
                <input
                  type="radio"
                  name="exportFormat"
                  value="csv"
                  checked={exportFormat === 'csv'}
                  onChange={(e) => setExportFormat(e.target.value)}
                />
                <div className="format-option-content">
                  <FileText size={24} className="format-icon" />
                  <div>
                    <div className="format-title">CSV (.csv)</div>
                    <div className="format-description">Single file, compatible with any spreadsheet app</div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Export Options */}
          <div className="export-section">
            <h3 className="export-section-title">Export Options</h3>
            <div className="export-options">
              <label className="export-option">
                <input
                  type="checkbox"
                  checked={exportOptions.includeSummary}
                  onChange={(e) => handleExportOptionChange('includeSummary', e.target.checked)}
                />
                <div className="export-option-content">
                  <Table size={16} />
                  <span>Include employee summary</span>
                </div>
              </label>

              <label className="export-option">
                <input
                  type="checkbox"
                  checked={exportOptions.includeDetails}
                  onChange={(e) => handleExportOptionChange('includeDetails', e.target.checked)}
                />
                <div className="export-option-content">
                  <Clock size={16} />
                  <span>Include detailed time entries</span>
                </div>
              </label>

              {preview.hasOvertime && (
                <label className="export-option">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeOvertime}
                    onChange={(e) => handleExportOptionChange('includeOvertime', e.target.checked)}
                  />
                  <div className="export-option-content">
                    <AlertCircle size={16} />
                    <span>Include overtime analysis</span>
                  </div>
                </label>
              )}

              <label className="export-option">
                <input
                  type="checkbox"
                  checked={exportOptions.includeNotes}
                  onChange={(e) => handleExportOptionChange('includeNotes', e.target.checked)}
                />
                <div className="export-option-content">
                  <FileText size={16} />
                  <span>Include time entry notes</span>
                </div>
              </label>

              <label className="export-option">
                <input
                  type="checkbox"
                  checked={exportOptions.employeesOnly}
                  onChange={(e) => handleExportOptionChange('employeesOnly', e.target.checked)}
                />
                <div className="export-option-content">
                  <User size={16} />
                  <span>Exclude employees with zero hours</span>
                </div>
              </label>
            </div>
          </div>

          {/* Export Preview */}
          <div className="export-section">
            <h3 className="export-section-title">Export Preview</h3>
            <div className="export-preview">
              <div className="preview-stat">
                <User size={16} />
                <span>{preview.employeeCount} employees</span>
              </div>
              <div className="preview-stat">
                <Clock size={16} />
                <span>{preview.totalEntries} time entries</span>
              </div>
              {exportFormat === 'excel' && (
                <div className="preview-stat">
                  <Table size={16} />
                  <span>
                    {[
                      exportOptions.includeSummary && 'Summary',
                      exportOptions.includeDetails && 'Details',
                      exportOptions.includeOvertime && preview.hasOvertime && 'Overtime'
                    ].filter(Boolean).length} sheets
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Export Status */}
          {exportStatus && (
            <div className={`export-status export-status--${exportStatus.type}`}>
              {exportStatus.type === 'success' ? (
                <CheckCircle size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>{exportStatus.message}</span>
            </div>
          )}
        </div>

        <div className="modal__actions">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={isExporting || (!exportOptions.includeSummary && !exportOptions.includeDetails)}
          >
            {isExporting ? (
              <>
                <Clock size={16} className="spinner" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={16} />
                Export {exportFormat.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default PayrollExportModal;