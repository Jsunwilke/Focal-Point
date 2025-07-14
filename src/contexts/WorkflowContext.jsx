// src/contexts/WorkflowContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getWorkflowsForUser,
  getWorkflowsForOrganization,
  getWorkflowTemplate,
  getTeamMembers,
  getSession
} from '../firebase/firestore';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';

const WorkflowContext = createContext();

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
};

export const WorkflowProvider = ({ children }) => {
  const [userWorkflows, setUserWorkflows] = useState([]);
  const [organizationWorkflows, setOrganizationWorkflows] = useState([]);
  const [workflowTemplates, setWorkflowTemplates] = useState({});
  const [teamMembers, setTeamMembers] = useState([]);
  const [sessionData, setSessionData] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  
  const { showToast } = useToast();
  const { userProfile, organization } = useAuth();

  // Load team members
  const loadTeamMembers = useCallback(async () => {
    if (!organization?.id) return;
    
    try {
      const members = await getTeamMembers(organization.id);
      setTeamMembers(members.filter(m => m.isActive));
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }, [organization?.id]);

  // Load user workflows
  const loadUserWorkflows = useCallback(async () => {
    if (!userProfile?.id || !organization?.id) {
      console.log("🔄 WORKFLOW CONTEXT: Missing userProfile.id or organization.id", {
        userProfileId: userProfile?.id,
        organizationId: organization?.id
      });
      return;
    }
    
    console.log("🔄 WORKFLOW CONTEXT: Loading workflows for user:", userProfile.id, "in organization:", organization.id);
    
    try {
      const workflows = await getWorkflowsForUser(userProfile.id, organization.id, 'active');
      console.log("📋 WORKFLOW CONTEXT: Found", workflows.length, "workflows for user");
      
      if (workflows.length > 0) {
        console.log("📄 WORKFLOW CONTEXT: Workflow details:");
        workflows.forEach((workflow, index) => {
          console.log(`  ${index + 1}. ${workflow.templateName} (ID: ${workflow.id}) - Session: ${workflow.sessionId} - Status: ${workflow.status}`);
        });
      }
      
      // Load templates for each workflow if not already loaded
      const templatePromises = workflows.map(async (workflow) => {
        if (!workflowTemplates[workflow.templateId]) {
          const template = await getWorkflowTemplate(workflow.templateId);
          return { templateId: workflow.templateId, template };
        }
        return null;
      });
      
      const templateResults = await Promise.all(templatePromises);
      const newTemplates = {};
      templateResults.forEach(result => {
        if (result) {
          newTemplates[result.templateId] = result.template;
        }
      });
      
      setWorkflowTemplates(prev => ({ ...prev, ...newTemplates }));
      setUserWorkflows(workflows);
      
      // Load session data for workflows
      if (workflows && workflows.length > 0) {
        try {
          const sessionPromises = [];
          const sessionIds = new Set();
          
          // Collect unique session IDs
          workflows.forEach(workflow => {
            if (workflow.sessionId && !sessionIds.has(workflow.sessionId)) {
              sessionIds.add(workflow.sessionId);
              sessionPromises.push(getSession(workflow.sessionId));
            }
          });
          
          if (sessionPromises.length > 0) {
            // Load all sessions in parallel
            const sessions = await Promise.all(sessionPromises);
            
            // Create session data map
            const newSessionData = {};
            sessions.forEach((session, index) => {
              if (session) {
                const sessionId = Array.from(sessionIds)[index];
                newSessionData[sessionId] = session;
              }
            });
            
            setSessionData(prev => ({ ...prev, ...newSessionData }));
          }
        } catch (error) {
          console.error('Error loading session data:', error);
        }
      }
      
      // Check for new assignments and overdue items
      checkForNotifications(workflows);
      
    } catch (error) {
      console.error('Error loading user workflows:', error);
      // Set empty arrays on error to prevent repeated failed requests
      setUserWorkflows([]);
    }
  }, [userProfile?.id, organization?.id, workflowTemplates]);

  // Load organization workflows (for admins)
  const loadOrganizationWorkflows = useCallback(async () => {
    if (!organization?.id || userProfile?.role !== 'admin') return;
    
    try {
      const workflows = await getWorkflowsForOrganization(organization.id);
      setOrganizationWorkflows(workflows);
    } catch (error) {
      console.error('Error loading organization workflows:', error);
      // Set empty arrays on error to prevent repeated failed requests
      setOrganizationWorkflows([]);
    }
  }, [organization?.id, userProfile?.role]);

  // Check for notifications (new assignments, overdue items, etc.)
  const checkForNotifications = useCallback((workflows) => {
    if (!workflows || !userProfile?.id) return;
    
    const now = new Date();
    const currentCheck = now.getTime();
    
    workflows.forEach(workflow => {
      if (!workflowTemplates[workflow.templateId]) return;
      
      const template = workflowTemplates[workflow.templateId];
      
      // Check each step for notifications
      template.steps.forEach(step => {
        const stepProgress = workflow.stepProgress[step.id];
        if (!stepProgress) return;
        
        // New assignment notification
        if (stepProgress.assignedTo === userProfile.id && 
            stepProgress.status === 'pending' &&
            stepProgress.assignedAt &&
            (!lastCheck || stepProgress.assignedAt.toDate().getTime() > lastCheck)) {
          
          const assignedMember = teamMembers.find(m => m.id === stepProgress.assignedTo);
          showToast(
            'New Task Assigned',
            `You have been assigned: ${step.title}`,
            'info'
          );
        }
        
        // Overdue notification
        if (stepProgress.assignedTo === userProfile.id &&
            stepProgress.status === 'in_progress' &&
            step.notifications?.escalationHours &&
            stepProgress.startTime) {
          
          const startTime = stepProgress.startTime.toDate();
          const escalationTime = new Date(startTime.getTime() + (step.notifications.escalationHours * 60 * 60 * 1000));
          
          if (now > escalationTime && stepProgress.status !== 'completed') {
            showToast(
              'Task Overdue',
              `${step.title} is overdue`,
              'error'
            );
          }
        }
      });
    });
    
    setLastCheck(currentCheck);
  }, [userProfile?.id, workflowTemplates, teamMembers, lastCheck, showToast]);

  // Refresh all workflow data
  const refreshWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTeamMembers(),
        loadUserWorkflows(),
        loadOrganizationWorkflows()
      ]);
    } finally {
      setLoading(false);
    }
  }, [loadTeamMembers, loadUserWorkflows, loadOrganizationWorkflows]);

  // Get workflow with template
  const getWorkflowWithTemplate = useCallback((workflowId) => {
    const workflow = [...userWorkflows, ...organizationWorkflows].find(w => w.id === workflowId);
    if (!workflow) return null;
    
    const template = workflowTemplates[workflow.templateId];
    return { workflow, template };
  }, [userWorkflows, organizationWorkflows, workflowTemplates]);

  // Get user's pending tasks
  const getUserPendingTasks = useCallback(() => {
    if (!userProfile?.id) return [];
    
    const tasks = [];
    
    userWorkflows.forEach(workflow => {
      const template = workflowTemplates[workflow.templateId];
      if (!template) return;
      
      template.steps.forEach(step => {
        const stepProgress = workflow.stepProgress[step.id];
        if (stepProgress?.assignedTo === userProfile.id && 
            ['pending', 'in_progress'].includes(stepProgress.status)) {
          tasks.push({
            workflowId: workflow.id,
            stepId: step.id,
            step,
            stepProgress,
            workflow,
            template
          });
        }
      });
    });
    
    // Sort by priority: overdue, in_progress, pending
    return tasks.sort((a, b) => {
      const aStatus = a.stepProgress.status;
      const bStatus = b.stepProgress.status;
      
      if (aStatus === 'overdue' && bStatus !== 'overdue') return -1;
      if (bStatus === 'overdue' && aStatus !== 'overdue') return 1;
      if (aStatus === 'in_progress' && bStatus === 'pending') return -1;
      if (bStatus === 'in_progress' && aStatus === 'pending') return 1;
      
      return 0;
    });
  }, [userProfile?.id, userWorkflows, workflowTemplates]);

  // Get workflow statistics
  const getWorkflowStats = useCallback(() => {
    const stats = {
      totalActiveWorkflows: userWorkflows.length,
      pendingTasks: 0,
      overdueTasks: 0,
      completedThisWeek: 0
    };
    
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    userWorkflows.forEach(workflow => {
      const template = workflowTemplates[workflow.templateId];
      if (!template) return;
      
      template.steps.forEach(step => {
        const stepProgress = workflow.stepProgress[step.id];
        if (!stepProgress || stepProgress.assignedTo !== userProfile?.id) return;
        
        if (stepProgress.status === 'pending') {
          stats.pendingTasks++;
        } else if (stepProgress.status === 'overdue') {
          stats.overdueTasks++;
        } else if (stepProgress.status === 'completed' && 
                   stepProgress.completedAt &&
                   stepProgress.completedAt.toDate() > oneWeekAgo) {
          stats.completedThisWeek++;
        }
      });
    });
    
    return stats;
  }, [userWorkflows, workflowTemplates, userProfile?.id]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    if (userProfile?.id && organization?.id) {
      refreshWorkflows();
    }
  }, [userProfile?.id, organization?.id]);

  // Set up periodic refresh for notifications
  useEffect(() => {
    if (!userProfile?.id || !organization?.id) return;
    
    const interval = setInterval(() => {
      loadUserWorkflows();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [userProfile?.id, organization?.id, loadUserWorkflows]);

  const value = {
    // Data
    userWorkflows,
    organizationWorkflows,
    workflowTemplates,
    teamMembers,
    sessionData,
    loading,
    
    // Functions
    refreshWorkflows,
    getWorkflowWithTemplate,
    getUserPendingTasks,
    getWorkflowStats,
    
    // Helper functions
    loadUserWorkflows,
    loadOrganizationWorkflows
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
};

export default WorkflowContext;