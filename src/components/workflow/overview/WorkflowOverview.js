// src/components/workflow/overview/WorkflowOverview.js
import React, { useState, useEffect } from 'react';
import { 
  Table2, 
  LayoutGrid, 
  Calendar, 
  LayoutList,
  Grid3x3,
  Layers,
  Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkflow } from '../../../contexts/WorkflowContext';
import { useAuth } from '../../../contexts/AuthContext';
import WorkflowViewSwitcher from './WorkflowViewSwitcher';
import WorkflowFilters from './WorkflowFilters';
import WorkflowStats from './WorkflowStats';
import WorkflowTableView from './views/WorkflowTableView';
import WorkflowKanbanView from './views/WorkflowKanbanView';
import WorkflowTimelineView from './views/WorkflowTimelineView';
import WorkflowCardView from './views/WorkflowCardView';
import WorkflowMatrixView from './views/WorkflowMatrixView';
import WorkflowListView from './views/WorkflowListView';
import '../WorkflowOverview.css';

const WorkflowOverview = () => {
  const [currentView, setCurrentView] = useState(() => 
    localStorage.getItem('workflowViewPreference') || 'table'
  );
  const [filters, setFilters] = useState({
    status: 'all',
    school: 'all',
    sessionType: 'all',
    dateRange: 'all',
    search: ''
  });
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const navigate = useNavigate();
  const {
    userWorkflows,
    organizationWorkflows,
    sessionData,
    workflowTemplates,
    getWorkflowWithTemplate,
    loading,
    refreshWorkflows,
    refreshSingleWorkflow
  } = useWorkflow();
  
  const { userProfile, organization } = useAuth();

  // Define available views
  const views = [
    { id: 'table', name: 'Table View', icon: Table2, description: 'Spreadsheet-style view like Google Sheets' },
    { id: 'kanban', name: 'Kanban Board', icon: LayoutGrid, description: 'Drag and drop workflow steps' },
    { id: 'timeline', name: 'Timeline', icon: Calendar, description: 'Gantt chart view of workflows' },
    { id: 'cards', name: 'Card Grid', icon: Grid3x3, description: 'Compact card layout' },
    { id: 'matrix', name: 'Matrix View', icon: Layers, description: 'Heat map visualization' },
    { id: 'list', name: 'List View', icon: LayoutList, description: 'Detailed list with grouping' }
  ];

  // Save view preference
  useEffect(() => {
    localStorage.setItem('workflowViewPreference', currentView);
  }, [currentView]);

  // Get workflows based on user role
  const workflows = userProfile?.role === 'admin' 
    ? organizationWorkflows 
    : userWorkflows;

  // Apply filters to workflows
  const filteredWorkflows = workflows.filter(workflow => {
    // Status filter
    if (filters.status !== 'all' && workflow.status !== filters.status) {
      return false;
    }

    // School filter
    if (filters.school !== 'all') {
      const session = sessionData[workflow.sessionId];
      if (!session || session.schoolId !== filters.school) {
        return false;
      }
    }

    // Session type filter
    if (filters.sessionType !== 'all') {
      const session = sessionData[workflow.sessionId];
      if (!session || !session.sessionTypes?.includes(filters.sessionType)) {
        return false;
      }
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const session = sessionData[workflow.sessionId];
      if (!session) return false;
      
      const sessionDate = new Date(session.date);
      const now = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          return sessionDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return sessionDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return sessionDate >= monthAgo;
        default:
          return true;
      }
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const session = sessionData[workflow.sessionId];
      
      return (
        workflow.templateName?.toLowerCase().includes(searchLower) ||
        session?.schoolName?.toLowerCase().includes(searchLower) ||
        session?.clientName?.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Sort workflows
  const sortedWorkflows = [...filteredWorkflows].sort((a, b) => {
    let compareValue = 0;
    
    switch (sortBy) {
      case 'date':
        const dateA = sessionData[a.sessionId]?.date || '';
        const dateB = sessionData[b.sessionId]?.date || '';
        compareValue = dateA.localeCompare(dateB);
        break;
      case 'school':
        const schoolA = sessionData[a.sessionId]?.schoolName || '';
        const schoolB = sessionData[b.sessionId]?.schoolName || '';
        compareValue = schoolA.localeCompare(schoolB);
        break;
      case 'progress':
        const progressA = calculateProgress(a);
        const progressB = calculateProgress(b);
        compareValue = progressA - progressB;
        break;
      case 'status':
        compareValue = a.status.localeCompare(b.status);
        break;
      default:
        compareValue = 0;
    }
    
    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  // Calculate workflow progress
  function calculateProgress(workflow) {
    const template = workflowTemplates[workflow.templateId];
    if (!template) return 0;
    
    const completedSteps = template.steps.filter(step => 
      workflow.stepProgress[step.id]?.status === 'completed'
    ).length;
    
    return (completedSteps / template.steps.length) * 100;
  }

  // Prepare data for views
  const viewData = {
    workflows: sortedWorkflows,
    sessionData,
    workflowTemplates,
    getWorkflowWithTemplate,
    calculateProgress,
    refreshWorkflows,
    refreshSingleWorkflow
  };

  // Render current view
  const renderView = () => {
    switch (currentView) {
      case 'table':
        return <WorkflowTableView {...viewData} />;
      case 'kanban':
        return <WorkflowKanbanView {...viewData} />;
      case 'timeline':
        return <WorkflowTimelineView {...viewData} />;
      case 'cards':
        return <WorkflowCardView {...viewData} />;
      case 'matrix':
        return <WorkflowMatrixView {...viewData} />;
      case 'list':
        return <WorkflowListView {...viewData} />;
      default:
        return <WorkflowTableView {...viewData} />;
    }
  };

  if (loading) {
    return (
      <div className="workflow-overview-loading">
        <div className="spinner" />
        <p>Loading workflows...</p>
      </div>
    );
  }

  return (
    <div className="workflow-overview">
      {/* Header */}
      <div className="workflow-overview-header">
        <div className="header-content">
          <h1>Workflow Overview</h1>
          <p>Manage and track all your photography workflows</p>
        </div>
        
        <button 
          onClick={refreshWorkflows}
          className="refresh-button"
          title="Refresh workflows"
        >
          Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <WorkflowStats workflows={sortedWorkflows} />

      {/* Controls Bar */}
      <div className="workflow-controls">
        <WorkflowFilters 
          filters={filters}
          onFiltersChange={setFilters}
          sessionData={sessionData}
        />
        
        <div className="controls-right">
          <div className="sort-controls">
            <label>Sort by:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="date">Date</option>
              <option value="school">School</option>
              <option value="progress">Progress</option>
              <option value="status">Status</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="sort-order-button"
              title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          
          <WorkflowViewSwitcher
            views={views}
            currentView={currentView}
            onViewChange={setCurrentView}
          />
          
          {userProfile?.role === 'admin' && (
            <button
              onClick={() => navigate('/workflows/settings')}
              className="settings-button"
              title="Workflow Settings"
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      {/* View Content */}
      <div className="workflow-view-container">
        {sortedWorkflows.length === 0 ? (
          <div className="no-workflows">
            <p>No workflows found matching your filters.</p>
            <button onClick={() => setFilters({
              status: 'all',
              school: 'all',
              sessionType: 'all',
              dateRange: 'all',
              search: ''
            })}>
              Clear Filters
            </button>
          </div>
        ) : (
          renderView()
        )}
      </div>
    </div>
  );
};

export default WorkflowOverview;