// src/components/workflow/overview/views/WorkflowTableView.js
import React, { useState } from 'react';
import { 
  Download, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Circle,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { updateWorkflowStepProgress } from '../../../../firebase/firestore';
import { useToast } from '../../../../contexts/ToastContext';

const WorkflowTableView = ({ workflows, sessionData, workflowTemplates, calculateProgress }) => {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [groupBySessionType, setGroupBySessionType] = useState(true);
  const { showToast } = useToast();

  // Group workflows by session type
  const groupedWorkflows = groupBySessionType 
    ? workflows.reduce((groups, workflow) => {
        const groupKey = workflow.sessionType || workflow.templateName || 'Unknown Type';
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(workflow);
        return groups;
      }, {})
    : { 'All Workflows': workflows };

  // Sort groups
  const sortedGroups = Object.keys(groupedWorkflows).sort((a, b) => {
    if (a === 'Unknown Type') return 1;
    if (b === 'Unknown Type') return -1;
    if (a === 'All Workflows') return -1;
    if (b === 'All Workflows') return 1;
    return a.localeCompare(b);
  });

  // Toggle group expansion
  const toggleGroup = (groupKey) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  // Get steps for each group separately (instead of all steps combined)
  const getStepsForGroup = (groupWorkflows) => {
    return [...new Set(
      groupWorkflows.flatMap(workflow => {
        const template = workflowTemplates[workflow.templateId];
        return template ? template.steps.map(step => step.title) : [];
      })
    )];
  };

  // Toggle row expansion
  const toggleRow = (workflowId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(workflowId)) {
      newExpanded.delete(workflowId);
    } else {
      newExpanded.add(workflowId);
    }
    setExpandedRows(newExpanded);
  };

  // Get step status
  const getStepStatus = (workflow, stepTitle) => {
    const template = workflowTemplates[workflow.templateId];
    if (!template) return null;
    
    const step = template.steps.find(s => s.title === stepTitle);
    if (!step) return null;
    
    return workflow.stepProgress[step.id];
  };

  // Get status color and icon
  const getStatusDisplay = (status) => {
    if (!status) return { color: '#e5e7eb', icon: Circle, label: 'Not Started' };
    
    switch (status.status) {
      case 'completed':
        return { color: '#dcfce7', icon: CheckCircle, label: 'Completed' };
      case 'in_progress':
        return { color: '#fef3c7', icon: Clock, label: 'In Progress' };
      case 'overdue':
        return { color: '#fee2e2', icon: AlertCircle, label: 'Overdue' };
      default:
        return { color: '#f3f4f6', icon: Circle, label: 'Pending' };
    }
  };

  // Handle step click
  const handleStepClick = async (workflow, stepTitle) => {
    const template = workflowTemplates[workflow.templateId];
    if (!template) return;
    
    const step = template.steps.find(s => s.title === stepTitle);
    if (!step) return;
    
    const currentStatus = workflow.stepProgress[step.id];
    
    // Cycle through statuses
    let newStatus = 'pending';
    if (!currentStatus || currentStatus.status === 'pending') {
      newStatus = 'in_progress';
    } else if (currentStatus.status === 'in_progress') {
      newStatus = 'completed';
    } else if (currentStatus.status === 'completed') {
      newStatus = 'pending';
    }
    
    try {
      await updateWorkflowStepProgress(
        workflow.id,
        step.id,
        {
          status: newStatus,
          ...(newStatus === 'in_progress' && { startTime: new Date() }),
          ...(newStatus === 'completed' && { completedAt: new Date() })
        }
      );
      
      showToast('Step Updated', `${step.title} marked as ${newStatus}`, 'success');
    } catch (error) {
      showToast('Error', 'Failed to update step status', 'error');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const allStepsForExport = getStepsForGroup(workflows);
    const headers = ['School', 'Session Type', 'Template', 'Date', 'Status', 'Progress', ...allStepsForExport];
    const rows = workflows.map(workflow => {
      const session = sessionData[workflow.sessionId];
      const progress = calculateProgress(workflow);
      
      const row = [
        session?.schoolName || 'Unknown',
        workflow.sessionType || session?.sessionTypes?.join(', ') || 'N/A',
        workflow.templateName || 'Unknown Template',
        session?.date ? new Date(session.date).toLocaleDateString() : 'N/A',
        workflow.status,
        `${Math.round(progress)}%`,
        ...allStepsForExport.map(stepTitle => {
          const status = getStepStatus(workflow, stepTitle);
          return status ? status.status : 'not_started';
        })
      ];
      
      return row;
    });
    
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflows_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="workflow-table-view">
      <div className="table-header">
        <h3>Workflow Progress Table</h3>
        <div className="table-controls">
          <label style={{ marginRight: '1rem' }}>
            <input
              type="checkbox"
              checked={groupBySessionType}
              onChange={(e) => setGroupBySessionType(e.target.checked)}
              style={{ marginRight: '0.5rem' }}
            />
            Group by Session Type
          </label>
          <button onClick={exportToCSV} className="export-button">
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>
      
      <div className="table-container">
        {groupBySessionType ? (
          // Render separate tables for each workflow type
          sortedGroups.map(groupKey => {
            const groupWorkflows = groupedWorkflows[groupKey];
            const groupSteps = getStepsForGroup(groupWorkflows);
            const isGroupExpanded = expandedGroups.has(groupKey);
            
            return (
              <div key={groupKey} className="workflow-group-table" style={{ marginBottom: '2rem' }}>
                {/* Group Header */}
                <div className="workflow-type-section-header" style={{
                  backgroundColor: '#f1f5f9',
                  borderTop: '3px solid #3b82f6',
                  borderBottom: '2px solid #cbd5e1',
                  padding: '0',
                  position: 'relative',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.5rem',
                    background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button 
                        onClick={() => toggleGroup(groupKey)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {isGroupExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      <div>
                        <h3 style={{ 
                          margin: '0 0 0.25rem 0',
                          fontSize: '1.25rem',
                          fontWeight: '700',
                          color: '#1e293b',
                          textTransform: 'capitalize'
                        }}>
                          {groupKey} Workflows
                        </h3>
                        <p style={{
                          margin: 0,
                          fontSize: '0.875rem',
                          color: '#64748b'
                        }}>
                          {groupWorkflows.length} workflow{groupWorkflows.length !== 1 ? 's' : ''} • {groupSteps.length} step{groupSteps.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div style={{
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      fontWeight: '600',
                      minWidth: '40px',
                      textAlign: 'center'
                    }}>
                      {groupWorkflows.length}
                    </div>
                  </div>
                </div>
                
                {/* Group Table */}
                {isGroupExpanded && (
                  <table className="workflow-table">
                    <thead>
                      <tr>
                        <th className="sticky-column"></th>
                        <th className="sticky-column">School</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Progress</th>
                        {groupSteps.map((step, index) => (
                          <th key={index} className="step-header">
                            <div className="step-header-content">
                              {step}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Workflows in this group */}
                      {groupWorkflows.map(workflow => {
                        const session = sessionData[workflow.sessionId];
                        const progress = calculateProgress(workflow);
                        const isExpanded = expandedRows.has(workflow.id);
                        
                        return (
                          <React.Fragment key={workflow.id}>
                            <tr className="workflow-row">
                              <td className="sticky-column expand-cell">
                                <button 
                                  onClick={() => toggleRow(workflow.id)}
                                  className="expand-button"
                                >
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                              </td>
                              <td className="sticky-column school-cell">
                                {session?.schoolName || 'Unknown'}
                              </td>
                              <td>
                                {workflow.sessionType || session?.sessionTypes?.join(', ') || 'N/A'}
                                {workflow.templateName && (
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                    {workflow.templateName}
                                  </div>
                                )}
                              </td>
                              <td>{session?.date ? new Date(session.date).toLocaleDateString() : 'N/A'}</td>
                              <td>
                                <div className="progress-cell">
                                  <div className="progress-bar-mini">
                                    <div 
                                      className="progress-fill-mini" 
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                  <span className="progress-text">{Math.round(progress)}%</span>
                                </div>
                              </td>
                              {groupSteps.map((stepTitle, index) => {
                                const status = getStepStatus(workflow, stepTitle);
                                const display = getStatusDisplay(status);
                                const Icon = display.icon;
                                
                                return (
                                  <td 
                                    key={index}
                                    className="step-cell"
                                    style={{ backgroundColor: display.color }}
                                    onClick={() => handleStepClick(workflow, stepTitle)}
                                    title={`${stepTitle}: ${display.label}\nClick to change status`}
                                  >
                                    <Icon size={16} />
                                  </td>
                                );
                              })}
                            </tr>
                            
                            {isExpanded && (
                              <tr className="expanded-row">
                                <td colSpan={5 + groupSteps.length}>
                                  <div className="expanded-content">
                                    <div className="workflow-details">
                                      <p><strong>Workflow:</strong> {workflow.templateName}</p>
                                      <p><strong>Client:</strong> {session?.clientName || 'N/A'}</p>
                                      <p><strong>Status:</strong> {workflow.status}</p>
                                    </div>
                                    
                                    <div className="step-details">
                                      <h4>Step Details:</h4>
                                      <div className="step-grid">
                                        {groupSteps.map((stepTitle, index) => {
                                          const status = getStepStatus(workflow, stepTitle);
                                          const display = getStatusDisplay(status);
                                          
                                          return (
                                            <div key={index} className="step-detail-card">
                                              <div className="step-detail-header">
                                                {display.icon && <display.icon size={14} />}
                                                <span>{stepTitle}</span>
                                              </div>
                                              <div className="step-detail-status">
                                                {display.label}
                                              </div>
                                              {status?.assignedTo && (
                                                <div className="step-detail-assigned">
                                                  Assigned to: {status.assignedTo}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })
        ) : (
          // Single table when not grouped
          <table className="workflow-table">
            <thead>
              <tr>
                <th className="sticky-column"></th>
                <th className="sticky-column">School</th>
                <th>Type</th>
                <th>Date</th>
                <th>Progress</th>
                {getStepsForGroup(workflows).map((step, index) => (
                  <th key={index} className="step-header">
                    <div className="step-header-content">
                      {step}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workflows.map(workflow => {
                const session = sessionData[workflow.sessionId];
                const progress = calculateProgress(workflow);
                const isExpanded = expandedRows.has(workflow.id);
                const allStepsUngrouped = getStepsForGroup(workflows);
                
                return (
                  <React.Fragment key={workflow.id}>
                    <tr className="workflow-row">
                      <td className="sticky-column expand-cell">
                        <button 
                          onClick={() => toggleRow(workflow.id)}
                          className="expand-button"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="sticky-column school-cell">
                        {session?.schoolName || 'Unknown'}
                      </td>
                      <td>
                        {workflow.sessionType || session?.sessionTypes?.join(', ') || 'N/A'}
                        {workflow.templateName && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            {workflow.templateName}
                          </div>
                        )}
                      </td>
                      <td>{session?.date ? new Date(session.date).toLocaleDateString() : 'N/A'}</td>
                      <td>
                        <div className="progress-cell">
                          <div className="progress-bar-mini">
                            <div 
                              className="progress-fill-mini" 
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="progress-text">{Math.round(progress)}%</span>
                        </div>
                      </td>
                      {allStepsUngrouped.map((stepTitle, index) => {
                        const status = getStepStatus(workflow, stepTitle);
                        const display = getStatusDisplay(status);
                        const Icon = display.icon;
                        
                        return (
                          <td 
                            key={index}
                            className="step-cell"
                            style={{ backgroundColor: display.color }}
                            onClick={() => handleStepClick(workflow, stepTitle)}
                            title={`${stepTitle}: ${display.label}\nClick to change status`}
                          >
                            <Icon size={16} />
                          </td>
                        );
                      })}
                    </tr>
                    
                    {isExpanded && (
                      <tr className="expanded-row">
                        <td colSpan={5 + allStepsUngrouped.length}>
                          <div className="expanded-content">
                            <div className="workflow-details">
                              <p><strong>Workflow:</strong> {workflow.templateName}</p>
                              <p><strong>Client:</strong> {session?.clientName || 'N/A'}</p>
                              <p><strong>Status:</strong> {workflow.status}</p>
                            </div>
                            
                            <div className="step-details">
                              <h4>Step Details:</h4>
                              <div className="step-grid">
                                {allStepsUngrouped.map((stepTitle, index) => {
                                  const status = getStepStatus(workflow, stepTitle);
                                  const display = getStatusDisplay(status);
                                  
                                  return (
                                    <div key={index} className="step-detail-card">
                                      <div className="step-detail-header">
                                        {display.icon && <display.icon size={14} />}
                                        <span>{stepTitle}</span>
                                      </div>
                                      <div className="step-detail-status">
                                        {display.label}
                                      </div>
                                      {status?.assignedTo && (
                                        <div className="step-detail-assigned">
                                          Assigned to: {status.assignedTo}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default WorkflowTableView;