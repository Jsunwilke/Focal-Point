// src/components/tasks/TaskExportButton.js
import React, { useState } from 'react';
import { Download, FileText, File, FileSpreadsheet } from 'lucide-react';
import { exportToCSV, exportToExcel, exportToPDF, enrichTasksForExport } from '../../services/taskExportService';
import { useDataCache } from '../../contexts/DataCacheContext';
import './TaskExportButton.css';

const TaskExportButton = ({ tasks, filename = 'tasks' }) => {
  const { users } = useDataCache();
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = (format) => {
    const enrichedTasks = enrichTasksForExport(tasks, users);

    switch (format) {
      case 'csv':
        exportToCSV(enrichedTasks, `${filename}.csv`);
        break;
      case 'excel':
        exportToExcel(enrichedTasks, `${filename}.xlsx`);
        break;
      case 'pdf':
        exportToPDF(enrichedTasks, `${filename}.pdf`);
        break;
      default:
        break;
    }

    setShowMenu(false);
  };

  return (
    <div className="task-export-button">
      <button
        className="task-export-button__trigger"
        onClick={() => setShowMenu(!showMenu)}
      >
        <Download size={16} />
        Export
      </button>

      {showMenu && (
        <>
          <div
            className="task-export-button__overlay"
            onClick={() => setShowMenu(false)}
          />
          <div className="task-export-button__menu">
            <button
              className="task-export-button__option"
              onClick={() => handleExport('csv')}
            >
              <FileText size={16} />
              <div>
                <div className="task-export-button__option-title">Export as CSV</div>
                <div className="task-export-button__option-desc">
                  Comma-separated values file
                </div>
              </div>
            </button>

            <button
              className="task-export-button__option"
              onClick={() => handleExport('excel')}
            >
              <FileSpreadsheet size={16} />
              <div>
                <div className="task-export-button__option-title">Export as Excel</div>
                <div className="task-export-button__option-desc">
                  Microsoft Excel spreadsheet
                </div>
              </div>
            </button>

            <button
              className="task-export-button__option"
              onClick={() => handleExport('pdf')}
            >
              <File size={16} />
              <div>
                <div className="task-export-button__option-title">Export as PDF</div>
                <div className="task-export-button__option-desc">
                  Printable document format
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TaskExportButton;
