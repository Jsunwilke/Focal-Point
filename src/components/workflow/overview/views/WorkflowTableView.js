// src/components/workflow/overview/views/WorkflowTableView.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Download, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Circle,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { updateWorkflowStep } from '../../../../firebase/firestore';
import { useToast } from '../../../../contexts/ToastContext';

const WorkflowTableView = ({ workflows, sessionData, workflowTemplates, calculateProgress, refreshWorkflows, refreshSingleWorkflow }) => {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [selectedWorkflowType, setSelectedWorkflowType] = useState('All Types');
  const [columnWidths, setColumnWidths] = useState({ stepWidth: 70, abbreviationType: 'short' });
  const [optimisticUpdates, setOptimisticUpdates] = useState({}); // Store temporary UI updates
  const [updatingSteps, setUpdatingSteps] = useState(new Set()); // Track which steps are being updated
  const tableRef = useRef(null);
  const { showToast } = useToast();


  // Get unique workflow types for filter dropdown
  const workflowTypes = ['All Types', ...new Set(workflows.map(workflow => 
    workflow.sessionType || workflow.templateName || 'Unknown Type'
  ))].sort();

  // Group workflows by session type (for "All Types" view)
  const groupedWorkflows = workflows.reduce((groups, workflow) => {
    const groupKey = workflow.sessionType || workflow.templateName || 'Unknown Type';
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(workflow);
    return groups;
  }, {});

  // Sort groups
  const sortedGroups = Object.keys(groupedWorkflows).sort((a, b) => {
    if (a === 'Unknown Type') return 1;
    if (b === 'Unknown Type') return -1;
    return a.localeCompare(b);
  });

  // Filter workflows by selected type (for specific type view)
  const filteredWorkflows = selectedWorkflowType === 'All Types' 
    ? workflows 
    : workflows.filter(workflow => {
        const workflowType = workflow.sessionType || workflow.templateName || 'Unknown Type';
        return workflowType === selectedWorkflowType;
      });

  // Get steps for filtered workflows
  const getStepsForWorkflows = (workflows) => {
    return [...new Set(
      workflows.flatMap(workflow => {
        const template = workflowTemplates[workflow.templateId];
        return template ? template.steps.map(step => step.title) : [];
      })
    )];
  };

  // Calculate dynamic column widths based on available space and step count
  const calculateColumnWidths = (stepCount, containerWidth) => {
    // Fixed column widths
    const expandColumn = 50;
    const schoolColumn = 180;
    const typeColumn = 120;
    const dateColumn = 100;
    const progressColumn = 110;
    const fixedWidth = expandColumn + schoolColumn + typeColumn + dateColumn + progressColumn;
    
    // Available width for step columns
    const availableWidth = containerWidth - fixedWidth - 40; // 40px for padding/scrollbar
    
    // Calculate optimal step column width
    let stepWidth = Math.max(50, Math.floor(availableWidth / stepCount));
    let abbreviationType = 'icon'; // default to most compact
    
    if (stepWidth >= 90) {
      abbreviationType = 'full';
    } else if (stepWidth >= 70) {
      abbreviationType = 'short';
    } else if (stepWidth >= 50) {
      abbreviationType = 'ultra';
    }
    
    // Ensure minimum table width for horizontal scroll if needed
    const minTableWidth = fixedWidth + (stepCount * 50);
    const calculatedTableWidth = fixedWidth + (stepCount * stepWidth);
    
    return {
      stepWidth: Math.min(stepWidth, 120), // Cap at 120px max
      abbreviationType,
      tableWidth: Math.max(minTableWidth, calculatedTableWidth),
      needsScroll: calculatedTableWidth > containerWidth
    };
  };

  // Update column widths when container size or step count changes
  useEffect(() => {
    const updateWidths = () => {
      // Get actual available width from the table container's parent
      let availableWidth = 800; // fallback
      
      if (tableRef.current) {
        const tableViewContainer = tableRef.current.closest('.workflow-table-view');
        if (tableViewContainer) {
          // Get the actual width available for the table container
          const containerStyle = window.getComputedStyle(tableViewContainer);
          const containerWidth = tableViewContainer.clientWidth;
          const paddingLeft = parseFloat(containerStyle.paddingLeft);
          const paddingRight = parseFloat(containerStyle.paddingRight);
          availableWidth = containerWidth - paddingLeft - paddingRight - 40; // 40px buffer for borders/scrollbar
        }
      }
      
      const currentSteps = selectedWorkflowType === 'All Types' 
        ? Math.max(...Object.keys(groupedWorkflows).map(key => getStepsForWorkflows(groupedWorkflows[key]).length))
        : getStepsForWorkflows(filteredWorkflows).length;
      
      const newWidths = calculateColumnWidths(currentSteps, availableWidth);
      setColumnWidths(newWidths);
    };

    // Initial calculation
    updateWidths();
    
    // Use ResizeObserver to watch the actual table view container
    const resizeObserver = new ResizeObserver((entries) => {
      updateWidths();
    });
    
    if (tableRef.current) {
      const tableViewContainer = tableRef.current.closest('.workflow-table-view');
      if (tableViewContainer) {
        resizeObserver.observe(tableViewContainer);
      }
    }
    
    // Also listen to window resize for sidebar changes
    const handleWindowResize = () => {
      setTimeout(updateWidths, 100); // Small delay to let layout settle
    };
    
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [selectedWorkflowType, workflows]);

  // Apply calculated widths as CSS custom properties
  useEffect(() => {
    if (tableRef.current) {
      const table = tableRef.current;
      table.style.setProperty('--step-width', `${columnWidths.stepWidth}px`);
      table.style.setProperty('--table-min-width', `${columnWidths.tableWidth}px`);
      
      // Set font size based on column width
      let fontSize = '0.6rem';
      if (columnWidths.stepWidth >= 90) {
        fontSize = '0.7rem';
      } else if (columnWidths.stepWidth <= 50) {
        fontSize = '0.55rem';
      }
      table.style.setProperty('--step-font-size', fontSize);
    }
  }, [columnWidths]);

  // Update group scrollbar widths dynamically
  useEffect(() => {
    // Update scroll content widths for all visible groups
    const updateGroupScrollWidths = () => {
      // Handle grouped view scrollbars
      document.querySelectorAll('[data-group]:not([data-group="single"]) .group-top-scrollbar').forEach((scrollbar) => {
        const scrollContent = scrollbar.querySelector('.group-scroll-content');
        const table = scrollbar.closest('[data-group]')?.querySelector('.workflow-table');
        if (scrollContent && table) {
          const tableWidth = table.scrollWidth;
          scrollContent.style.width = `${tableWidth}px`;
        }
      });
      
      // Handle single table view scrollbar
      const singleScrollbar = document.querySelector('.single-table-container .group-top-scrollbar');
      if (singleScrollbar) {
        const scrollContent = singleScrollbar.querySelector('.group-scroll-content');
        const table = document.querySelector('.single-table-container .workflow-table');
        if (scrollContent && table) {
          const tableWidth = table.scrollWidth;
          scrollContent.style.width = `${tableWidth}px`;
        }
      }
    };
    
    // Small delay to ensure DOM is updated
    setTimeout(updateGroupScrollWidths, 100);
  }, [selectedWorkflowType, workflows.length, columnWidths, expandedGroups]);

  // Clear optimistic updates when fresh workflow data comes in
  useEffect(() => {
    // Clear any optimistic updates that now have real data
    setOptimisticUpdates(prev => {
      const updated = { ...prev };
      let hasChanges = false;
      
      Object.keys(updated).forEach(optimisticKey => {
        const [workflowId, stepId] = optimisticKey.split('-');
        const workflow = workflows.find(w => w.id === workflowId);
        if (workflow && workflow.stepProgress && workflow.stepProgress[stepId]) {
          delete updated[optimisticKey];
          hasChanges = true;
        }
      });
      
      return hasChanges ? updated : prev;
    });
  }, [workflows]);


  // Get abbreviated step names with multiple tiers based on available width
  const getAbbreviatedStepName = (stepTitle, abbreviationType = 'short') => {
    const abbreviations = {
      full: {
        'Pre-Wedding Consultation': 'Pre-Wedding',
        'Equipment Preparation': 'Equipment',
        'Wedding Day Coverage': 'Wedding Day',
        'Photo Import & Backup': 'Import',
        'Initial Culling': 'Initial Cull',
        'Sneak Peek Selection': 'Sneak Peek',
        'Sneak Peek Editing': 'Sneak Edit',
        'Sneak Peek Delivery': 'Sneak Send',
        'Final Photo Selection': 'Final Select',
        'Professional Editing': 'Pro Edit',
        'Final Review': 'Review',
        'Gallery Creation': 'Gallery',
        'Final Delivery': 'Delivery',
        'Roster Collection': 'Roster',
        'Equipment Check': 'Equipment',
        'Venue Setup': 'Venue',
        'Game Coverage': 'Game',
        'Photo Download & Backup': 'Download',
        'Batch Processing': 'Batch',
        'Team Sorting': 'Sort',
        'Launch Sales': 'Sales',
        'Session Confirmation': 'Confirm',
        'Location Setup': 'Location',
        'Conduct Portrait Session': 'Portrait',
        'Download & Backup Photos': 'Download',
        'Photo Culling': 'Culling',
        'Basic Editing': 'Editing',
        'Quality Review': 'Review',
        'Create Client Gallery': 'Gallery',
        'Client Notification': 'Notify'
      },
      short: {
        'Pre-Wedding Consultation': 'PreWed',
        'Equipment Preparation': 'Equip',
        'Wedding Day Coverage': 'Wedding',
        'Photo Import & Backup': 'Import',
        'Initial Culling': 'Cull',
        'Sneak Peek Selection': 'SPeek',
        'Sneak Peek Editing': 'SEdit',
        'Sneak Peek Delivery': 'SSend',
        'Final Photo Selection': 'FSelect',
        'Professional Editing': 'ProEdit',
        'Final Review': 'Review',
        'Gallery Creation': 'Gallery',
        'Final Delivery': 'Deliver',
        'Roster Collection': 'Roster',
        'Equipment Check': 'Equip',
        'Venue Setup': 'Venue',
        'Game Coverage': 'Game',
        'Photo Download & Backup': 'Download',
        'Batch Processing': 'Batch',
        'Team Sorting': 'Sort',
        'Launch Sales': 'Sales',
        'Session Confirmation': 'Confirm',
        'Location Setup': 'Location',
        'Conduct Portrait Session': 'Portrait',
        'Download & Backup Photos': 'Download',
        'Photo Culling': 'Cull',
        'Basic Editing': 'Edit',
        'Quality Review': 'Review',
        'Create Client Gallery': 'Gallery',
        'Client Notification': 'Notify'
      },
      ultra: {
        'Pre-Wedding Consultation': 'PreW',
        'Equipment Preparation': 'Eq',
        'Wedding Day Coverage': 'Wed',
        'Photo Import & Backup': 'Imp',
        'Initial Culling': 'Cull',
        'Sneak Peek Selection': 'SP',
        'Sneak Peek Editing': 'SE',
        'Sneak Peek Delivery': 'SS',
        'Final Photo Selection': 'FS',
        'Professional Editing': 'PE',
        'Final Review': 'Rev',
        'Gallery Creation': 'Gal',
        'Final Delivery': 'Del',
        'Roster Collection': 'Ros',
        'Equipment Check': 'Eq',
        'Venue Setup': 'Ven',
        'Game Coverage': 'Game',
        'Photo Download & Backup': 'DL',
        'Batch Processing': 'Bat',
        'Team Sorting': 'Sort',
        'Launch Sales': 'Sale',
        'Session Confirmation': 'Conf',
        'Location Setup': 'Loc',
        'Conduct Portrait Session': 'Port',
        'Download & Backup Photos': 'DL',
        'Photo Culling': 'Cull',
        'Basic Editing': 'Edit',
        'Quality Review': 'Rev',
        'Create Client Gallery': 'Gal',
        'Client Notification': 'Not'
      }
    };

    const currentAbbrevs = abbreviations[abbreviationType] || abbreviations.short;
    let result = currentAbbrevs[stepTitle];
    
    if (!result) {
      // Fallback abbreviation based on type
      switch (abbreviationType) {
        case 'full':
          result = stepTitle.length > 12 ? stepTitle.substring(0, 12) + '...' : stepTitle;
          break;
        case 'short':
          result = stepTitle.length > 8 ? stepTitle.substring(0, 8) + '...' : stepTitle;
          break;
        case 'ultra':
          result = stepTitle.length > 4 ? stepTitle.substring(0, 4) : stepTitle;
          break;
        case 'icon':
          result = '●'; // Use a simple icon for very narrow columns
          break;
        default:
          result = stepTitle.substring(0, 6);
      }
    }
    
    return result;
  };

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

  // Get step status with optimistic updates
  const getStepStatus = (workflow, stepTitle) => {
    const template = workflowTemplates[workflow.templateId];
    if (!template) return null;
    
    const step = template.steps.find(s => s.title === stepTitle);
    if (!step) return null;
    
    // Check for optimistic update first
    const optimisticKey = `${workflow.id}-${step.id}`;
    if (optimisticUpdates[optimisticKey]) {
      return optimisticUpdates[optimisticKey];
    }
    
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

  // Handle step click with optimistic updates
  const handleStepClick = async (workflow, stepTitle) => {
    const template = workflowTemplates[workflow.templateId];
    if (!template) return;
    
    const step = template.steps.find(s => s.title === stepTitle);
    if (!step) return;
    
    const optimisticKey = `${workflow.id}-${step.id}`;
    const stepKey = `${workflow.id}-${step.id}`;
    
    // Prevent multiple clicks on the same step
    if (updatingSteps.has(stepKey)) return;
    
    const currentStatus = getStepStatus(workflow, stepTitle); // This will check optimistic updates too
    
    // Cycle through statuses
    let newStatus = 'pending';
    if (!currentStatus || currentStatus.status === 'pending') {
      newStatus = 'in_progress';
    } else if (currentStatus.status === 'in_progress') {
      newStatus = 'completed';
    } else if (currentStatus.status === 'completed') {
      newStatus = 'pending';
    }
    
    // Optimistic update - immediately show the change in UI
    const optimisticStepData = {
      ...currentStatus,
      status: newStatus,
      ...(newStatus === 'in_progress' && { startTime: new Date() }),
      ...(newStatus === 'completed' && { completedAt: new Date() }),
      updatedAt: new Date()
    };
    
    setOptimisticUpdates(prev => ({
      ...prev,
      [optimisticKey]: optimisticStepData
    }));
    
    setUpdatingSteps(prev => new Set(prev).add(stepKey));
    
    try {
      await updateWorkflowStep(
        workflow.id,
        step.id,
        {
          status: newStatus,
          ...(newStatus === 'in_progress' && { startTime: new Date() }),
          ...(newStatus === 'completed' && { completedAt: new Date() })
        }
      );
      
      showToast('Step Updated', `${step.title} marked as ${newStatus}`, 'success');
      
      // Let optimistic update persist - it will be replaced by fresh data from parent component
      
    } catch (error) {
      showToast('Error', 'Failed to update step status', 'error');
      
      // Revert optimistic update on error
      setOptimisticUpdates(prev => {
        const updated = { ...prev };
        delete updated[optimisticKey];
        return updated;
      });
    } finally {
      // Remove from updating set
      setUpdatingSteps(prev => {
        const updated = new Set(prev);
        updated.delete(stepKey);
        return updated;
      });
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const allStepsForExport = getStepsForWorkflows(filteredWorkflows);
    const headers = ['School', 'Session Type', 'Template', 'Date', 'Status', 'Progress', ...allStepsForExport];
    const rows = filteredWorkflows.map(workflow => {
      const session = sessionData[workflow.sessionId];
      const progress = calculateProgress(workflow);
      
      // Handle tracking vs session workflows
      let schoolName, sessionType, workflowDate;
      if (workflow.workflowType === 'tracking') {
        schoolName = workflow.schoolName || 'Unknown';
        sessionType = 'Tracking';
        workflowDate = workflow.trackingStartDate ? new Date(workflow.trackingStartDate).toLocaleDateString() : 'N/A';
      } else {
        schoolName = session?.schoolName || 'Unknown';
        sessionType = workflow.sessionType || session?.sessionTypes?.join(', ') || 'N/A';
        workflowDate = session?.date ? new Date(session.date).toLocaleDateString() : 'N/A';
      }
      
      const row = [
        schoolName,
        sessionType,
        workflow.templateName || 'Unknown Template',
        workflowDate,
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

  // Per-group scroll synchronization
  const syncGroupScroll = (groupKey, source, target) => {
    if (target && source) {
      target.scrollLeft = source.scrollLeft;
    }
  };

  const handleGroupTopScroll = (groupKey, e) => {
    let tableContainer;
    if (groupKey === 'single') {
      tableContainer = document.querySelector(`[data-group="${groupKey}"]`);
    } else {
      tableContainer = document.querySelector(`[data-group="${groupKey}"] .group-table-container`);
    }
    syncGroupScroll(groupKey, e.target, tableContainer);
  };

  const handleGroupTableScroll = (groupKey, e) => {
    let topScrollbar;
    if (groupKey === 'single') {
      topScrollbar = document.querySelector(`.single-table-container .group-top-scrollbar`);
    } else {
      topScrollbar = document.querySelector(`[data-group="${groupKey}"] .group-top-scrollbar`);
    }
    syncGroupScroll(groupKey, e.target, topScrollbar);
  };

  return (
    <div className="workflow-table-view">
      <div className="table-header">
        <h3>Workflow Progress Table</h3>
        <div className="table-controls">
          <div className="workflow-type-filter">
            <label htmlFor="workflowTypeSelect">Workflow Type:</label>
            <select
              id="workflowTypeSelect"
              value={selectedWorkflowType}
              onChange={(e) => setSelectedWorkflowType(e.target.value)}
              className="workflow-type-select"
            >
              {workflowTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <button onClick={exportToCSV} className="export-button">
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>
      
      <div className="table-container">
        {selectedWorkflowType === 'All Types' ? (
          // Grouped view for "All Types"
          sortedGroups.map(groupKey => {
            const groupWorkflows = groupedWorkflows[groupKey];
            const groupSteps = getStepsForWorkflows(groupWorkflows);
            const isGroupExpanded = expandedGroups.has(groupKey);
            
            return (
              <div key={groupKey} className="workflow-group-table" data-group={groupKey} style={{ marginBottom: '2rem' }}>
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
                  <div className="group-container">
                    {/* Per-group horizontal scrollbar */}
                    <div className="group-scroll-container">
                      <div 
                        className="group-top-scrollbar"
                        onScroll={(e) => handleGroupTopScroll(groupKey, e)}
                      >
                        <div className="group-scroll-content" style={{ width: `${230 + (groupSteps.length * 140)}px` }}></div>
                      </div>
                    </div>
                    
                    <div className="group-table-container" onScroll={(e) => handleGroupTableScroll(groupKey, e)}>
                      <table ref={tableRef} className="workflow-table">
                        <thead>
                          <tr>
                            <th className="sticky-column group-sticky-header"></th>
                            <th className="sticky-column group-sticky-header">School</th>
                            <th className="group-sticky-header">Type</th>
                            <th className="group-sticky-header">Date</th>
                            <th className="group-sticky-header">Progress</th>
                            {groupSteps.map((step, index) => (
                              <th key={index} className="step-header group-sticky-header" title={step}>
                                {step}
                              </th>
                            ))}
                          </tr>
                        </thead>
                    <tbody>
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
                                {workflow.workflowType === 'tracking' ? workflow.schoolName || 'Unknown' : session?.schoolName || 'Unknown'}
                              </td>
                              <td>
                                {workflow.workflowType === 'tracking' ? 
                                  'Tracking' : 
                                  workflow.sessionType || session?.sessionTypes?.join(', ') || 'N/A'
                                }
                                {workflow.templateName && (
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                    {workflow.templateName}
                                  </div>
                                )}
                              </td>
                              <td>
                                {workflow.workflowType === 'tracking' ? 
                                  workflow.trackingStartDate ? new Date(workflow.trackingStartDate).toLocaleDateString() : 'N/A' :
                                  session?.date ? new Date(session.date).toLocaleDateString() : 'N/A'
                                }
                              </td>
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
                                const template = workflowTemplates[workflow.templateId];
                                const step = template?.steps.find(s => s.title === stepTitle);
                                const stepKey = step ? `${workflow.id}-${step.id}` : null;
                                const isUpdating = stepKey && updatingSteps.has(stepKey);
                                
                                const status = getStepStatus(workflow, stepTitle);
                                const display = getStatusDisplay(status);
                                const Icon = display.icon;
                                
                                return (
                                  <td 
                                    key={index}
                                    className="step-cell"
                                    style={{ 
                                      backgroundColor: display.color,
                                      opacity: isUpdating ? 0.6 : 1,
                                      cursor: isUpdating ? 'wait' : 'pointer'
                                    }}
                                    onClick={() => !isUpdating && handleStepClick(workflow, stepTitle)}
                                    title={`${stepTitle}: ${display.label}\n${isUpdating ? 'Updating...' : 'Click to change status'}`}
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
                                      <p><strong>Client:</strong> {workflow.workflowType === 'tracking' ? workflow.schoolName || 'N/A' : session?.clientName || 'N/A'}</p>
                                      <p><strong>Status:</strong> {workflow.status}</p>
                                      {workflow.workflowType === 'tracking' && (
                                        <p><strong>Academic Year:</strong> {workflow.academicYear || 'N/A'}</p>
                                      )}
                                    </div>
                                    
                                    <div className="step-details">
                                      <h4>Step Details:</h4>
                                      <div className="step-grid">
                                        {groupSteps.map((stepTitle, index) => {
                                          const status = getStepStatus(workflow, stepTitle);
                                          const display = getStatusDisplay(status);
                                          
                                          const template = workflowTemplates[workflow.templateId];
                                          const step = template?.steps.find(s => s.title === stepTitle);
                                          const stepKey = step ? `${workflow.id}-${step.id}` : null;
                                          const isUpdating = stepKey && updatingSteps.has(stepKey);
                                          
                                          return (
                                            <div 
                                              key={index} 
                                              className="step-detail-card" 
                                              data-workflow-id={workflow.id}
                                              onClick={() => !isUpdating && handleStepClick(workflow, stepTitle)}
                                              style={{ 
                                                opacity: isUpdating ? 0.6 : 1,
                                                cursor: isUpdating ? 'wait' : 'pointer'
                                              }}
                                              title={`${stepTitle}: ${display.label}\n${isUpdating ? 'Updating...' : 'Click to change status'}`}
                                            >
                                              <div className="step-detail-header">
                                                {display.icon && <display.icon size={14} />}
                                                <span>
                                                  {stepTitle}
                                                </span>
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
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // Single table for specific workflow type
          <div className="single-table-container">
            {/* Single table horizontal scrollbar */}
            <div className="group-scroll-container">
              <div 
                className="group-top-scrollbar"
                onScroll={(e) => handleGroupTopScroll('single', e)}
              >
                <div className="group-scroll-content" style={{ width: `${230 + (getStepsForWorkflows(filteredWorkflows).length * 140)}px` }}></div>
              </div>
            </div>
            
            <div className="group-table-container" data-group="single" onScroll={(e) => handleGroupTableScroll('single', e)}>
              <table ref={tableRef} className="workflow-table">
                <thead>
                  <tr>
                    <th className="sticky-column group-sticky-header"></th>
                    <th className="sticky-column group-sticky-header">School</th>
                    <th className="group-sticky-header">Type</th>
                    <th className="group-sticky-header">Date</th>
                    <th className="group-sticky-header">Progress</th>
                    {getStepsForWorkflows(filteredWorkflows).map((step, index) => (
                      <th key={index} className="step-header group-sticky-header" title={step}>
                        {step}
                      </th>
                    ))}
                  </tr>
                </thead>
            <tbody>
              {filteredWorkflows.map(workflow => {
                const session = sessionData[workflow.sessionId];
                const progress = calculateProgress(workflow);
                const isExpanded = expandedRows.has(workflow.id);
                const allSteps = getStepsForWorkflows(filteredWorkflows);
                
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
                        {workflow.workflowType === 'tracking' ? workflow.schoolName || 'Unknown' : session?.schoolName || 'Unknown'}
                      </td>
                      <td>
                        {workflow.workflowType === 'tracking' ? 
                          'Tracking' : 
                          workflow.sessionType || session?.sessionTypes?.join(', ') || 'N/A'
                        }
                        {workflow.templateName && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            {workflow.templateName}
                          </div>
                        )}
                      </td>
                      <td>
                        {workflow.workflowType === 'tracking' ? 
                          workflow.trackingStartDate ? new Date(workflow.trackingStartDate).toLocaleDateString() : 'N/A' :
                          session?.date ? new Date(session.date).toLocaleDateString() : 'N/A'
                        }
                      </td>
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
                      {allSteps.map((stepTitle, index) => {
                        const template = workflowTemplates[workflow.templateId];
                        const step = template?.steps.find(s => s.title === stepTitle);
                        const stepKey = step ? `${workflow.id}-${step.id}` : null;
                        const isUpdating = stepKey && updatingSteps.has(stepKey);
                        
                        const status = getStepStatus(workflow, stepTitle);
                        const display = getStatusDisplay(status);
                        const Icon = display.icon;
                        
                        return (
                          <td 
                            key={index}
                            className="step-cell"
                            style={{ 
                              backgroundColor: display.color,
                              opacity: isUpdating ? 0.6 : 1,
                              cursor: isUpdating ? 'wait' : 'pointer'
                            }}
                            onClick={() => !isUpdating && handleStepClick(workflow, stepTitle)}
                            title={`${stepTitle}: ${display.label}\n${isUpdating ? 'Updating...' : 'Click to change status'}`}
                          >
                            <Icon size={16} />
                          </td>
                        );
                      })}
                    </tr>
                    
                    {isExpanded && (
                      <tr className="expanded-row">
                        <td colSpan={5 + allSteps.length}>
                          <div className="expanded-content">
                            <div className="workflow-details">
                              <p><strong>Workflow:</strong> {workflow.templateName}</p>
                              <p><strong>Client:</strong> {workflow.workflowType === 'tracking' ? workflow.schoolName || 'N/A' : session?.clientName || 'N/A'}</p>
                              <p><strong>Status:</strong> {workflow.status}</p>
                              {workflow.workflowType === 'tracking' && (
                                <p><strong>Academic Year:</strong> {workflow.academicYear || 'N/A'}</p>
                              )}
                            </div>
                            
                            <div className="step-details">
                              <h4>Step Details:</h4>
                              <div className="step-grid">
                                {allSteps.map((stepTitle, index) => {
                                  const status = getStepStatus(workflow, stepTitle);
                                  const display = getStatusDisplay(status);
                                  
                                  const template = workflowTemplates[workflow.templateId];
                                  const step = template?.steps.find(s => s.title === stepTitle);
                                  const stepKey = step ? `${workflow.id}-${step.id}` : null;
                                  const isUpdating = stepKey && updatingSteps.has(stepKey);
                                  
                                  return (
                                    <div 
                                      key={index} 
                                      className="step-detail-card" 
                                      data-workflow-id={workflow.id}
                                      onClick={() => !isUpdating && handleStepClick(workflow, stepTitle)}
                                      style={{ 
                                        opacity: isUpdating ? 0.6 : 1,
                                        cursor: isUpdating ? 'wait' : 'pointer'
                                      }}
                                      title={`${stepTitle}: ${display.label}\n${isUpdating ? 'Updating...' : 'Click to change status'}`}
                                    >
                                      <div className="step-detail-header">
                                        {display.icon && <display.icon size={14} />}
                                        <span>
                                          {stepTitle}
                                        </span>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowTableView;