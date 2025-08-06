// src/contexts/WorkflowContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  getWorkflowsForUser,
  getWorkflowsForOrganization,
  getWorkflowTemplate,
  getSession,
  getSessionsBatch,
  deleteWorkflowInstance
} from '../firebase/firestore';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  limit,
  firestore
} from '../services/firestoreWrapper';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';
import { useDataCache } from './DataCacheContext';
import workflowCacheService from '../services/workflowCacheService';
import { readCounter } from '../services/readCounter';

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
  const [sessionData, setSessionData] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  
  const { showToast } = useToast();
  const { userProfile, organization } = useAuth();
  const { teamMembers } = useDataCache();
  
  // Use ref to store listener unsubscribe function
  const listenerUnsubscribeRef = useRef(null);
  // Rate limiting for listener updates
  const lastListenerUpdateRef = useRef(0);
  const LISTENER_UPDATE_COOLDOWN = 5000; // 5 seconds minimum between updates
  // Store templates in ref to avoid dependency issues
  const workflowTemplatesRef = useRef({});
  // Periodic refresh interval
  const refreshIntervalRef = useRef(null);

  // Team members now come from DataCacheContext

  // Load user workflows with caching
  const loadUserWorkflows = useCallback(async () => {
    if (!userProfile?.id || !organization?.id) {
      return;
    }
    
    try {
      // Check cache first
      const cachedWorkflows = workflowCacheService.getCachedWorkflows(userProfile.id, organization.id, 'active');
      if (cachedWorkflows) {
        setUserWorkflows(cachedWorkflows);
        readCounter.recordCacheHit('workflows', 'WorkflowContext-user', cachedWorkflows.length);
        
        // Still need to load templates for cached workflows
        const templatePromises = cachedWorkflows.map(async (workflow) => {
          if (!workflowTemplatesRef.current[workflow.templateId]) {
            const cachedTemplate = workflowCacheService.getCachedTemplate(workflow.templateId);
            if (cachedTemplate) {
              readCounter.recordCacheHit('workflowTemplates', 'WorkflowContext-template', 1);
              return { templateId: workflow.templateId, template: cachedTemplate };
            }
          }
          return null;
        }).filter(p => p !== null);
        
        const templateResults = await Promise.all(templatePromises);
        const newTemplates = {};
        templateResults.forEach(result => {
          if (result) {
            newTemplates[result.templateId] = result.template;
            workflowTemplatesRef.current[result.templateId] = result.template;
          }
        });
        
        if (Object.keys(newTemplates).length > 0) {
          setWorkflowTemplates(prev => ({ ...prev, ...newTemplates }));
        }
        
        checkForNotifications(cachedWorkflows);
        return; // Exit early if cache hit
      }
      
      // Only call API if cache miss
      readCounter.recordCacheMiss('workflows', 'WorkflowContext-user');
      const workflows = await getWorkflowsForUser(userProfile.id, organization.id, 'active');
      
      // Cache the workflows
      workflowCacheService.setCachedWorkflows(userProfile.id, organization.id, 'active', workflows);
      
      // Load templates for each workflow if not already loaded
      const templatePromises = workflows.map(async (workflow) => {
        // Check template cache first
        const cachedTemplate = workflowCacheService.getCachedTemplate(workflow.templateId);
        if (cachedTemplate) {
          readCounter.recordCacheHit('workflowTemplates', 'WorkflowContext-template', 1);
          return { templateId: workflow.templateId, template: cachedTemplate };
        }
        
        if (!workflowTemplatesRef.current[workflow.templateId]) {
          try {
            readCounter.recordCacheMiss('workflowTemplates', 'WorkflowContext-template');
            const template = await getWorkflowTemplate(workflow.templateId);
            workflowCacheService.setCachedTemplate(workflow.templateId, template);
            workflowTemplatesRef.current[workflow.templateId] = template;
            return { templateId: workflow.templateId, template };
          } catch (error) {
            // Log as warning for missing templates
            console.warn(`Template ${workflow.templateId} not found or no permission:`, error.message);
            return { templateId: workflow.templateId, template: null };
          }
        }
        return null;
      });
      
      const templateResults = await Promise.all(templatePromises);
      const newTemplates = {};
      templateResults.forEach(result => {
        if (result && result.template) {
          newTemplates[result.templateId] = result.template;
        }
      });
      
      setWorkflowTemplates(prev => ({ ...prev, ...newTemplates }));
      setUserWorkflows(workflows);
      
      // Load session data for workflows
      if (workflows && workflows.length > 0) {
        try {
          const sessionIds = new Set();
          
          // Collect unique session IDs
          workflows.forEach(workflow => {
            if (workflow.sessionId) {
              sessionIds.add(workflow.sessionId);
            }
          });
          
          if (sessionIds.size > 0) {
            // Batch load all sessions
            const sessionIdsArray = Array.from(sessionIds);
            const sessionsMap = await getSessionsBatch(sessionIdsArray);
            
            // Filter out null sessions (permission denied or not found)
            const validSessions = {};
            Object.entries(sessionsMap).forEach(([id, session]) => {
              if (session) {
                validSessions[id] = session;
              }
            });
            
            setSessionData(prev => ({ ...prev, ...validSessions }));
          }
        } catch (error) {
          // Only log non-permission errors
          if (error.code !== 'permission-denied') {
            console.error('Error loading session data:', error);
          }
        }
      }
      
      // Check for new assignments and overdue items
      checkForNotifications(workflows);
      
    } catch (error) {
      console.error('Error loading user workflows:', error);
      // Set empty arrays on error to prevent repeated failed requests
      setUserWorkflows([]);
    }
  }, [userProfile?.id, organization?.id]);

  // Load organization workflows (for admins) with caching
  const loadOrganizationWorkflows = useCallback(async () => {
    if (!organization?.id || userProfile?.role !== 'admin') return;
    
    try {
      // Check cache first
      const cachedWorkflows = workflowCacheService.getCachedOrgWorkflows(organization.id);
      if (cachedWorkflows) {
        setOrganizationWorkflows(cachedWorkflows);
        readCounter.recordCacheHit('workflows', 'WorkflowContext-org', cachedWorkflows.length);
        return; // Exit early if cache hit - don't make API call
      }
      
      // Only call API if cache miss
      readCounter.recordCacheMiss('workflows', 'WorkflowContext-org');
      const workflows = await getWorkflowsForOrganization(organization.id);
      setOrganizationWorkflows(workflows);
      
      // Cache the workflows
      workflowCacheService.setCachedOrgWorkflows(organization.id, workflows);
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
  }, [userProfile?.id, teamMembers, showToast]);

  // Update a single workflow in local state
  const updateWorkflowInState = useCallback((workflowId, updates) => {
    setUserWorkflows(prev => prev.map(workflow => 
      workflow.id === workflowId 
        ? { ...workflow, ...updates }
        : workflow
    ));
    
    setOrganizationWorkflows(prev => prev.map(workflow => 
      workflow.id === workflowId 
        ? { ...workflow, ...updates }
        : workflow
    ));
  }, []);

  // Refresh a single workflow from server
  const refreshSingleWorkflow = useCallback(async (workflowId) => {
    try {
      // Import the getWorkflow function from firestore
      const { getWorkflow } = await import('../firebase/firestore');
      const updatedWorkflow = await getWorkflow(workflowId);
      
      if (updatedWorkflow) {
        updateWorkflowInState(workflowId, updatedWorkflow);
      }
    } catch (error) {
      console.error('Error refreshing single workflow:', error);
      // Fallback to full refresh if single update fails
      await refreshWorkflows();
    }
  }, [updateWorkflowInState]);

  // Refresh all workflow data
  const refreshWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUserWorkflows(),
        loadOrganizationWorkflows()
      ]);
    } finally {
      setLoading(false);
    }
  }, [loadUserWorkflows, loadOrganizationWorkflows]);

  // Delete workflow
  const deleteWorkflow = useCallback(async (workflowId) => {
    try {
      // Optimistically remove from state
      setUserWorkflows(prev => prev.filter(w => w.id !== workflowId));
      setOrganizationWorkflows(prev => prev.filter(w => w.id !== workflowId));
      
      // Delete from Firebase
      await deleteWorkflowInstance(workflowId);
      
      showToast('Workflow Deleted', 'Workflow has been permanently deleted', 'success');
    } catch (error) {
      console.error('Error deleting workflow:', error);
      showToast('Error', 'Failed to delete workflow', 'error');
      
      // Revert optimistic update by refreshing workflows
      await refreshWorkflows();
      throw error;
    }
  }, [showToast, refreshWorkflows]);

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
      // Initial load from cache
      loadUserWorkflows();
      loadOrganizationWorkflows();
    }
  }, [userProfile?.id, organization?.id]);

  // Removed periodic refresh - real-time listeners handle updates

  // Set up real-time listener for workflows (only for immediate updates)
  useEffect(() => {
    if (!organization?.id || !userProfile?.id) return;

    // Clean up any existing listener
    if (listenerUnsubscribeRef.current) {
      listenerUnsubscribeRef.current();
      listenerUnsubscribeRef.current = null;
    }

    // Query for active workflows in the organization
    // For now, we still need to fetch all org workflows because Firestore doesn't support
    // querying nested fields in stepProgress. This should be refactored to add assignedTo
    // array at the root level of workflow documents.
    const workflowsQuery = query(
      collection(firestore, 'workflows'),
      where('organizationID', '==', organization.id),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(100) // Limit to most recent 100 workflows to prevent excessive reads
    );

    // Check if we have cached data first
    const cachedWorkflows = workflowCacheService.getCachedWorkflows(userProfile.id, organization.id, 'active');
    if (cachedWorkflows && cachedWorkflows.length > 0) {
      setUserWorkflows(cachedWorkflows);
    }

    // Set up the listener for real-time updates only
    const unsubscribe = onSnapshot(
      workflowsQuery,
      { includeMetadataChanges: false }, // Only listen for actual data changes
      async (snapshot) => {
        // Skip if this is from cache
        if (snapshot.metadata.fromCache) {
          return;
        }

        // Rate limit updates
        const now = Date.now();
        if (now - lastListenerUpdateRef.current < LISTENER_UPDATE_COOLDOWN) {
          return;
        }
        lastListenerUpdateRef.current = now;

        // Only process if there are actual changes
        const changes = snapshot.docChanges();
        if (changes.length === 0) {
          return;
        }


        // Process workflow changes
        const workflows = [];
        snapshot.forEach((doc) => {
          workflows.push({ id: doc.id, ...doc.data() });
        });

        // Filter for user's workflows
        const userWorkflows = workflows.filter(workflow => {
          if (!workflow.stepProgress) return false;
          
          const hasAssignedSteps = Object.values(workflow.stepProgress).some(step => 
            step.assignedTo === userProfile.id
          );
          
          const hasUnassignedSteps = Object.values(workflow.stepProgress).some(step => 
            !step.assignedTo || step.assignedTo === null
          );
          
          return hasAssignedSteps || hasUnassignedSteps;
        });

        // Load templates for new workflows
        const templatesToLoad = [];
        
        userWorkflows.forEach(workflow => {
          if (workflow.templateId && !workflowTemplatesRef.current[workflow.templateId]) {
            // First check cache
            const cachedTemplate = workflowCacheService.getCachedTemplate(workflow.templateId);
            if (cachedTemplate) {
              workflowTemplatesRef.current[workflow.templateId] = cachedTemplate;
              setWorkflowTemplates(prev => ({ ...prev, [workflow.templateId]: cachedTemplate }));
            } else {
              templatesToLoad.push(workflow.templateId);
            }
          }
        });
        
        // Only fetch templates if there are new ones to load
        if (templatesToLoad.length > 0) {
          
          // Batch load templates in groups of 10 (Firestore 'in' query limit)
          const templateGroups = [];
          for (let i = 0; i < templatesToLoad.length; i += 10) {
            templateGroups.push(templatesToLoad.slice(i, i + 10));
          }
          
          const allTemplatePromises = templateGroups.map(async (group) => {
            try {
              // This would be more efficient with a batch query, but for now load individually
              const promises = group.map(async (templateId) => {
                try {
                  const template = await getWorkflowTemplate(templateId);
                  return { templateId, template };
                } catch (error) {
                  // Log as warning instead of error for missing templates
                  console.warn(`Template ${templateId} not found or no permission:`, error.message);
                  return { templateId, template: null };
                }
              });
              const results = await Promise.all(promises);
              // Filter out null templates
              return results.filter(result => result.template !== null);
            } catch (error) {
              console.warn('Failed to load template group:', error.message);
              return [];
            }
          });
          
          const allResults = await Promise.all(allTemplatePromises);
          const templateResults = allResults.flat();
          
          const newTemplates = {};
          templateResults.forEach(result => {
            if (result && result.template) {
              newTemplates[result.templateId] = result.template;
              workflowTemplatesRef.current[result.templateId] = result.template;
              // Cache the template
              workflowCacheService.setCachedTemplate(result.templateId, result.template);
            }
          });
          
          // Update templates only if there are new ones
          if (Object.keys(newTemplates).length > 0) {
            setWorkflowTemplates(prev => ({ ...prev, ...newTemplates }));
          }
        }
        
        setUserWorkflows(userWorkflows);
        
        // Update cache with new data
        workflowCacheService.setCachedWorkflows(userProfile.id, organization.id, 'active', userWorkflows);
        
        // Check for notifications on changes (debounced)
        if (changes.length > 0) {
          // Only check notifications if we have actual changes
          const hasRelevantChanges = changes.some(change => {
            const workflow = { id: change.doc.id, ...change.doc.data() };
            if (!workflow.stepProgress) return false;
            
            return Object.values(workflow.stepProgress).some(step => 
              step.assignedTo === userProfile.id
            );
          });
          
          if (hasRelevantChanges) {
            checkForNotifications(userWorkflows);
          }
        }
      },
      (error) => {
        console.error('Error in workflows listener:', error);
        // Fall back to manual load if listener fails
        loadUserWorkflows();
      }
    );

    // Store the unsubscribe function
    listenerUnsubscribeRef.current = unsubscribe;

    // Cleanup listener on unmount or when dependencies change
    return () => {
      if (listenerUnsubscribeRef.current) {
        listenerUnsubscribeRef.current();
        listenerUnsubscribeRef.current = null;
      }
    };
  }, [organization?.id, userProfile?.id]);


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
    refreshSingleWorkflow,
    deleteWorkflow,
    updateWorkflowInState,
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