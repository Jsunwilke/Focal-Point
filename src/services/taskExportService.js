// src/services/taskExportService.js

/**
 * Export tasks to CSV format
 */
export const exportToCSV = (tasks, filename = 'tasks.csv') => {
  // Define CSV headers
  const headers = [
    'ID',
    'Title',
    'Description',
    'Status',
    'Priority',
    'Type',
    'Assigned To',
    'Created By',
    'Created At',
    'Due Date',
    'Completed At',
    'Tags',
    'Time Tracked (hours)'
  ];

  // Convert tasks to CSV rows
  const rows = tasks.map(task => [
    task.id,
    `"${(task.title || '').replace(/"/g, '""')}"`,
    `"${(task.description || '').replace(/"/g, '""')}"`,
    task.status || '',
    task.priority || '',
    task.type || '',
    task.assignedToName || '',
    task.createdByName || '',
    task.createdAt ? formatDate(task.createdAt) : '',
    task.dueDate ? formatDate(task.dueDate) : '',
    task.completedAt ? formatDate(task.completedAt) : '',
    `"${(task.tags || []).join(', ')}"`,
    task.timeTracked ? (task.timeTracked / 60).toFixed(2) : '0'
  ]);

  // Combine headers and rows
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Download CSV file
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
};

/**
 * Export tasks to Excel format (using CSV with .xlsx extension for simplicity)
 */
export const exportToExcel = (tasks, filename = 'tasks.xlsx') => {
  // For a basic implementation, we'll use CSV format with Excel-compatible formatting
  // For true Excel format, you'd need a library like xlsx or exceljs

  const headers = [
    'ID',
    'Title',
    'Description',
    'Status',
    'Priority',
    'Type',
    'Assigned To',
    'Created By',
    'Created At',
    'Due Date',
    'Completed At',
    'Tags',
    'Time Tracked (hours)',
    'Subtasks Completed',
    'Total Subtasks'
  ];

  const rows = tasks.map(task => [
    task.id,
    `"${(task.title || '').replace(/"/g, '""')}"`,
    `"${(task.description || '').replace(/"/g, '""')}"`,
    task.status || '',
    task.priority || '',
    task.type || '',
    task.assignedToName || '',
    task.createdByName || '',
    task.createdAt ? formatDate(task.createdAt) : '',
    task.dueDate ? formatDate(task.dueDate) : '',
    task.completedAt ? formatDate(task.completedAt) : '',
    `"${(task.tags || []).join(', ')}"`,
    task.timeTracked ? (task.timeTracked / 60).toFixed(2) : '0',
    task.subtasks ? task.subtasks.filter(st => st.completed).length : '0',
    task.subtasks ? task.subtasks.length : '0'
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  downloadFile(csv, filename, 'application/vnd.ms-excel;charset=utf-8;');
};

/**
 * Export tasks to PDF format (simple text-based PDF)
 */
export const exportToPDF = (tasks, filename = 'tasks.pdf') => {
  // Create a simple HTML representation
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Tasks Export</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        h1 {
          color: #333;
          border-bottom: 3px solid #4f46e5;
          padding-bottom: 10px;
        }
        .task {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
          break-inside: avoid;
        }
        .task-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .task-title {
          font-size: 18px;
          font-weight: bold;
          color: #1f2937;
        }
        .task-status {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status-todo { background: #f3f4f6; color: #6b7280; }
        .status-in_progress { background: #dbeafe; color: #3b82f6; }
        .status-completed { background: #d1fae5; color: #10b981; }
        .task-meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #f3f4f6;
        }
        .meta-item {
          font-size: 14px;
        }
        .meta-label {
          font-weight: 600;
          color: #6b7280;
        }
        .meta-value {
          color: #1f2937;
        }
        .priority-urgent { color: #ef4444; font-weight: bold; }
        .priority-high { color: #f97316; font-weight: bold; }
        .priority-medium { color: #eab308; }
        .priority-low { color: #22c55e; }
        @media print {
          body { padding: 0; }
          .task { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>Tasks Export</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
      <p>Total Tasks: ${tasks.length}</p>
      ${tasks.map(task => `
        <div class="task">
          <div class="task-header">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <span class="task-status status-${task.status}">${task.status.replace('_', ' ')}</span>
          </div>
          ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}
          <div class="task-meta">
            <div class="meta-item">
              <span class="meta-label">Priority:</span>
              <span class="meta-value priority-${task.priority}">${task.priority || 'N/A'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Type:</span>
              <span class="meta-value">${task.type || 'N/A'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Assigned To:</span>
              <span class="meta-value">${task.assignedToName || 'Unassigned'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Created:</span>
              <span class="meta-value">${task.createdAt ? formatDate(task.createdAt) : 'N/A'}</span>
            </div>
            ${task.dueDate ? `
              <div class="meta-item">
                <span class="meta-label">Due Date:</span>
                <span class="meta-value">${formatDate(task.dueDate)}</span>
              </div>
            ` : ''}
            ${task.timeTracked ? `
              <div class="meta-item">
                <span class="meta-label">Time Tracked:</span>
                <span class="meta-value">${(task.timeTracked / 60).toFixed(1)} hours</span>
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </body>
    </html>
  `;

  // Open print dialog with the HTML content
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();

  // Trigger print dialog after a short delay to ensure content is loaded
  setTimeout(() => {
    printWindow.print();
  }, 250);
};

/**
 * Helper function to format dates
 */
const formatDate = (timestamp) => {
  if (!timestamp) return '';

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Helper function to escape HTML
 */
const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Helper function to download a file
 */
const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export tasks with user-enriched data
 */
export const enrichTasksForExport = (tasks, users) => {
  return tasks.map(task => {
    const assignedUser = users?.find(u => u.id === task.assignedTo);
    const createdByUser = users?.find(u => u.id === task.createdBy);

    return {
      ...task,
      assignedToName: assignedUser
        ? `${assignedUser.firstName} ${assignedUser.lastName}`
        : '',
      createdByName: createdByUser
        ? `${createdByUser.firstName} ${createdByUser.lastName}`
        : ''
    };
  });
};
