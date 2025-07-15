// src/components/workflow/overview/views/WorkflowMatrixView.js
import React, { useState } from 'react';
import { 
  Info,
  ZoomIn,
  ZoomOut,
  Download
} from 'lucide-react';

const WorkflowMatrixView = ({ workflows, sessionData, workflowTemplates }) => {
  const [hoveredCell, setHoveredCell] = useState(null);
  const [cellSize, setCellSize] = useState('medium'); // small, medium, large

  // Get all unique steps
  const allSteps = [...new Set(
    workflows.flatMap(workflow => {
      const template = workflowTemplates[workflow.templateId];
      return template ? template.steps.map(step => ({
        id: step.id,
        title: step.title
      })) : [];
    }).map(step => JSON.stringify(step))
  )].map(str => JSON.parse(str));

  // Get status for a specific workflow and step
  const getCellStatus = (workflow, stepTitle) => {
    const template = workflowTemplates[workflow.templateId];
    if (!template) return null;
    
    const step = template.steps.find(s => s.title === stepTitle);
    if (!step) return null;
    
    return workflow.stepProgress[step.id];
  };

  // Get cell color based on status
  const getCellColor = (status) => {
    if (!status) return '#f3f4f6'; // Not applicable
    
    switch (status.status) {
      case 'completed':
        return '#10b981';
      case 'in_progress':
        return '#f59e0b';
      case 'overdue':
        return '#ef4444';
      case 'pending':
        return '#93c5fd';
      default:
        return '#e5e7eb';
    }
  };

  // Get cell intensity based on time
  const getCellIntensity = (status) => {
    if (!status) return 1;
    
    if (status.status === 'completed') {
      // Fade based on how long ago it was completed
      const completedAt = status.completedAt?.toDate() || new Date();
      const daysSince = Math.floor((new Date() - completedAt) / (1000 * 60 * 60 * 24));
      return Math.max(0.3, 1 - (daysSince * 0.1));
    }
    
    if (status.status === 'in_progress') {
      // Pulse effect
      return 0.8;
    }
    
    return 0.6;
  };

  // Get cell size styles
  const getCellStyles = () => {
    switch (cellSize) {
      case 'small':
        return { width: '20px', height: '20px' };
      case 'large':
        return { width: '40px', height: '40px' };
      default:
        return { width: '30px', height: '30px' };
    }
  };

  // Export matrix as CSV
  const exportMatrix = () => {
    const headers = ['School/Session', ...allSteps.map(s => s.title)];
    const rows = workflows.map(workflow => {
      const session = sessionData[workflow.sessionId];
      const row = [
        `${session?.schoolName || 'Unknown'} - ${session?.date ? new Date(session.date).toLocaleDateString() : 'N/A'}`
      ];
      
      allSteps.forEach(step => {
        const status = getCellStatus(workflow, step.title);
        row.push(status ? status.status : 'n/a');
      });
      
      return row;
    });
    
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow_matrix_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate summary statistics
  const calculateStats = () => {
    let totalSteps = 0;
    let completedSteps = 0;
    let overdueSteps = 0;
    let inProgressSteps = 0;
    
    workflows.forEach(workflow => {
      const template = workflowTemplates[workflow.templateId];
      if (!template) return;
      
      template.steps.forEach(step => {
        totalSteps++;
        const status = workflow.stepProgress[step.id];
        if (status?.status === 'completed') completedSteps++;
        else if (status?.status === 'overdue') overdueSteps++;
        else if (status?.status === 'in_progress') inProgressSteps++;
      });
    });
    
    return {
      total: totalSteps,
      completed: completedSteps,
      overdue: overdueSteps,
      inProgress: inProgressSteps,
      completionRate: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
    };
  };

  const stats = calculateStats();
  const cellStyles = getCellStyles();

  return (
    <div className="workflow-matrix-view">
      {/* Controls */}
      <div className="matrix-controls">
        <div className="matrix-stats">
          <div className="stat">
            <span className="stat-label">Completion Rate:</span>
            <span className="stat-value">{stats.completionRate}%</span>
          </div>
          <div className="stat">
            <span className="stat-label">Total Steps:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Overdue:</span>
            <span className="stat-value" style={{ color: '#ef4444' }}>{stats.overdue}</span>
          </div>
        </div>
        
        <div className="matrix-actions">
          <div className="size-controls">
            <button 
              onClick={() => setCellSize('small')} 
              className={cellSize === 'small' ? 'active' : ''}
            >
              <ZoomOut size={16} />
            </button>
            <button 
              onClick={() => setCellSize('medium')} 
              className={cellSize === 'medium' ? 'active' : ''}
            >
              Medium
            </button>
            <button 
              onClick={() => setCellSize('large')} 
              className={cellSize === 'large' ? 'active' : ''}
            >
              <ZoomIn size={16} />
            </button>
          </div>
          
          <button onClick={exportMatrix} className="export-button">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Matrix Legend */}
      <div className="matrix-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#10b981' }} />
          <span>Completed</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#f59e0b' }} />
          <span>In Progress</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ef4444' }} />
          <span>Overdue</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#93c5fd' }} />
          <span>Pending</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#f3f4f6' }} />
          <span>N/A</span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="matrix-container">
        <table className="workflow-matrix">
          <thead>
            <tr>
              <th className="matrix-corner"></th>
              {allSteps.map((step, index) => (
                <th key={index} className="matrix-step-header">
                  <div className="step-header-vertical">
                    <span>{step.title}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workflows.map((workflow, rowIndex) => {
              const session = sessionData[workflow.sessionId];
              
              return (
                <tr key={workflow.id}>
                  <td className="matrix-row-header">
                    <div className="row-header-content">
                      <div className="school-name">{session?.schoolName || 'Unknown'}</div>
                      <div className="session-date">
                        {session?.date ? new Date(session.date).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </td>
                  
                  {allSteps.map((step, colIndex) => {
                    const status = getCellStatus(workflow, step.title);
                    const color = getCellColor(status);
                    const intensity = getCellIntensity(status);
                    const cellKey = `${rowIndex}-${colIndex}`;
                    
                    return (
                      <td 
                        key={colIndex}
                        className="matrix-cell"
                        onMouseEnter={() => setHoveredCell(cellKey)}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <div 
                          className={`cell-content ${status?.status === 'in_progress' ? 'pulse' : ''}`}
                          style={{
                            ...cellStyles,
                            backgroundColor: color,
                            opacity: intensity
                          }}
                        />
                        
                        {hoveredCell === cellKey && status && (
                          <div className="cell-tooltip">
                            <div className="tooltip-header">{step.title}</div>
                            <div className="tooltip-status">Status: {status.status}</div>
                            {status.assignedTo && (
                              <div className="tooltip-assigned">Assigned to: {status.assignedTo}</div>
                            )}
                            {status.completedAt && (
                              <div className="tooltip-date">
                                Completed: {status.completedAt.toDate().toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WorkflowMatrixView;