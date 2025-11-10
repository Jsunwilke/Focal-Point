// src/components/workflow/overview/WorkflowOverview.js
import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkflow } from '../../../contexts/WorkflowContext';
import { useAuth } from '../../../contexts/AuthContext';
import WorkflowFilters from './WorkflowFilters';
import WorkflowStats from './WorkflowStats';
import WorkflowMatrixView from './views/WorkflowMatrixView';
import CreateTaskModal from '../../tasks/CreateTaskModal';
import TaskDetailModal from '../../tasks/TaskDetailModal';
import '../WorkflowOverview.css';

const WorkflowOverview = () => {
  const [filters, setFilters] = useState({
    status: 'all',
    school: 'all',
    sessionType: 'all',
    dateRange: 'all',
    search: ''
  });
  
  const navigate = useNavigate();
  const {
    userWorkflows,
    organizationWorkflows,
    sessionData,
    workflowTemplates,
    getWorkflowWithTemplate,
    loading,
    refreshWorkflows,
    refreshSingleWorkflow,
    clearTemplateCache,
    clearAllCaches,
    // Task modal state
    isCreateTaskModalOpen,
    createTaskPrefill,
    selectedTaskId,
    isTaskDetailModalOpen,
    closeCreateTaskModal,
    closeTaskDetailModal
  } = useWorkflow();

  const { userProfile, organization } = useAuth();

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
      if (workflow.workflowType === 'tracking') {
        // For tracking workflows, check schoolId directly
        if (workflow.schoolId !== filters.school) {
          return false;
        }
      } else {
        // For session-based workflows, check via session data
        const session = sessionData[workflow.sessionId];
        if (!session || session.schoolId !== filters.school) {
          return false;
        }
      }
    }

    // Session type filter
    if (filters.sessionType !== 'all') {
      if (workflow.workflowType === 'tracking') {
        // Skip session type filtering for tracking workflows
        return true;
      } else {
        // For session-based workflows, check session types
        const session = sessionData[workflow.sessionId];
        if (!session || !session.sessionTypes?.includes(filters.sessionType)) {
          return false;
        }
      }
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      let workflowDate;
      
      if (workflow.workflowType === 'tracking') {
        // For tracking workflows, use trackingStartDate or createdAt
        workflowDate = workflow.trackingStartDate ? 
          new Date(workflow.trackingStartDate) : 
          workflow.createdAt ? new Date(workflow.createdAt.toDate()) : new Date();
      } else {
        // For session-based workflows, use session date
        const session = sessionData[workflow.sessionId];
        if (!session) return false;
        workflowDate = new Date(session.date);
      }
      
      const now = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          return workflowDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return workflowDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return workflowDate >= monthAgo;
        default:
          return true;
      }
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      
      if (workflow.workflowType === 'tracking') {
        // For tracking workflows, search in template name and school name
        return (
          workflow.templateName?.toLowerCase().includes(searchLower) ||
          workflow.schoolName?.toLowerCase().includes(searchLower) ||
          workflow.academicYear?.toLowerCase().includes(searchLower)
        );
      } else {
        // For session-based workflows, search in session data
        const session = sessionData[workflow.sessionId];
        return (
          workflow.templateName?.toLowerCase().includes(searchLower) ||
          session?.schoolName?.toLowerCase().includes(searchLower) ||
          session?.clientName?.toLowerCase().includes(searchLower)
        );
      }
    }

    return true;
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

  // Expose debug functions to window for console access
  useEffect(() => {
    window.workflowDebug = {
      clearTemplateCache: (templateId) => {
        clearTemplateCache(templateId);
        refreshWorkflows();
      },
      clearAllCaches: () => {
        clearAllCaches();
        refreshWorkflows();
      },
      getTemplates: () => {
        console.log('Current workflow templates:', workflowTemplates);
        return workflowTemplates;
      },
      getOrphanedWorkflows: () => {
        const orphaned = [...userWorkflows, ...organizationWorkflows].filter(
          wf => !workflowTemplates[wf.templateId]
        );
        console.log('Orphaned workflows:', orphaned);
        return orphaned;
      },
      getRawWorkflows: () => {
        console.log('User workflows:', userWorkflows);
        console.log('Organization workflows:', organizationWorkflows);
        console.log('All workflows:', [...userWorkflows, ...organizationWorkflows]);
        return {
          user: userWorkflows,
          organization: organizationWorkflows,
          all: [...userWorkflows, ...organizationWorkflows]
        };
      },
      getFilteredWorkflows: () => {
        console.log('Filtered workflows:', filteredWorkflows);
        console.log('Current filters:', filters);
        return { workflows: filteredWorkflows, filters };
      },
      fetchTemplate: async (templateId) => {
        console.log(`🔍 Attempting to fetch template: ${templateId}`);
        try {
          const { getWorkflowTemplate } = await import('../../../firebase/firestore');
          const template = await getWorkflowTemplate(templateId);
          console.log('✅ Template fetched successfully:', template);
          return template;
        } catch (error) {
          console.error('❌ Error fetching template:', error);
          return null;
        }
      },
      checkTemplatePermissions: async (templateId) => {
        console.log(`🔒 Checking permissions for template: ${templateId}`);
        console.log('Current organization:', organization);
        console.log('Current user:', userProfile);
        try {
          const { getWorkflowTemplate } = await import('../../../firebase/firestore');
          const template = await getWorkflowTemplate(templateId);
          if (template) {
            console.log('✅ Template accessible:', {
              id: template.id,
              name: template.name,
              organizationID: template.organizationID,
              isActive: template.isActive
            });
          } else {
            console.warn('⚠️ Template returned null - may not exist or permission denied');
          }
          return template;
        } catch (error) {
          console.error('❌ Permission error:', error.code, error.message);
          return null;
        }
      }
    };

    // Debug functions available via window.workflowDebug (see browser console)

    return () => {
      delete window.workflowDebug;
    };
  }, [clearTemplateCache, clearAllCaches, workflowTemplates, userWorkflows, organizationWorkflows, refreshWorkflows, organization, userProfile, filteredWorkflows, filters]);

  // Prepare data for matrix view
  const viewData = {
    workflows: filteredWorkflows,
    sessionData,
    workflowTemplates,
    getWorkflowWithTemplate,
    calculateProgress,
    refreshWorkflows,
    refreshSingleWorkflow
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
      {/* Header - REMOVED FOR SPACE */}
      {/* Title removed to maximize grid visibility */}

      {/* Stats Bar */}
      <WorkflowStats workflows={filteredWorkflows} />

      {/* Controls Bar */}
      <div className="workflow-controls">
        <WorkflowFilters
          filters={filters}
          onFiltersChange={setFilters}
          sessionData={sessionData}
          workflows={workflows}
        />

        <div className="controls-right">
          {userProfile?.role === 'admin' && (
            <button
              onClick={() => navigate('/workflows/settings')}
              className="settings-button"
              title="Workflow Settings"
            >
              <Settings size={18} />
            </button>
          )}

          <button
            onClick={refreshWorkflows}
            className="refresh-button"
            title="Refresh workflows"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* View Content */}
      <div className="workflow-view-container">
        {filteredWorkflows.length === 0 ? (
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
          <WorkflowMatrixView {...viewData} />
        )}
      </div>

      {/* Task Modals */}
      <CreateTaskModal
        isOpen={isCreateTaskModalOpen}
        onClose={closeCreateTaskModal}
        prefilledData={createTaskPrefill}
      />

      <TaskDetailModal
        isOpen={isTaskDetailModalOpen}
        onClose={closeTaskDetailModal}
        taskId={selectedTaskId}
      />
    </div>
  );
};

export default WorkflowOverview;