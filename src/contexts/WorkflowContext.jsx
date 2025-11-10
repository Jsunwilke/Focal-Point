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
import { secureLogger } from '../services/secureLogger';

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

  // Task modal state
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [createTaskPrefill, setCreateTaskPrefill] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);

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
            // Only use cached template if it's not null (valid template)
            if (cachedTemplate && cachedTemplate !== null) {
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
        // Check template cache first - only use if it's a valid template (not null)
        const cachedTemplate = workflowCacheService.getCachedTemplate(workflow.templateId);
        if (cachedTemplate && cachedTemplate !== null) {
          readCounter.recordCacheHit('workflowTemplates', 'WorkflowContext-template', 1);
          return { templateId: workflow.templateId, template: cachedTemplate };
        }

        if (!workflowTemplatesRef.current[workflow.templateId]) {
          try {
            readCounter.recordCacheMiss('workflowTemplates', 'WorkflowContext-template');
            const template = await getWorkflowTemplate(workflow.templateId);
            // Only cache if template is valid (not null)
            if (template && template !== null) {
              workflowCacheService.setCachedTemplate(workflow.templateId, template);
              workflowTemplatesRef.current[workflow.templateId] = template;
            }
            return { templateId: workflow.templateId, template };
          } catch (error) {
            // Log as warning for missing templates
            secureLogger.warn('Template not found or no permission', {
              templateId: workflow.templateId,
              error: error.message
            });
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
            secureLogger.error('Error loading session data', { error: error.message });
          }
        }
      }
      
      // Check for new assignments and overdue items
      checkForNotifications(workflows);
      
    } catch (error) {
      secureLogger.error('Error loading user workflows', { error: error.message });
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

        // Still need to load templates for cached workflows
        const templatePromises = cachedWorkflows.map(async (workflow) => {
          if (!workflowTemplatesRef.current[workflow.templateId]) {
            const cachedTemplate = workflowCacheService.getCachedTemplate(workflow.templateId);
            // Only use cached template if it's not null (valid template)
            if (cachedTemplate && cachedTemplate !== null) {
              readCounter.recordCacheHit('workflowTemplates', 'WorkflowContext-org-template', 1);
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

        return; // Exit early if cache hit - workflows already set
      }

      // Only call API if cache miss
      readCounter.recordCacheMiss('workflows', 'WorkflowContext-org');
      const workflows = await getWorkflowsForOrganization(organization.id);

      // Cache the workflows
      workflowCacheService.setCachedOrgWorkflows(organization.id, workflows);

      // Load templates for each workflow if not already loaded
      const templatePromises = workflows.map(async (workflow) => {
        // Check template cache first - only use if it's a valid template (not null)
        const cachedTemplate = workflowCacheService.getCachedTemplate(workflow.templateId);
        if (cachedTemplate && cachedTemplate !== null) {
          readCounter.recordCacheHit('workflowTemplates', 'WorkflowContext-org-template', 1);
          return { templateId: workflow.templateId, template: cachedTemplate };
        }

        if (!workflowTemplatesRef.current[workflow.templateId]) {
          try {
            readCounter.recordCacheMiss('workflowTemplates', 'WorkflowContext-org-template');
            const template = await getWorkflowTemplate(workflow.templateId);
            // Only cache if template is valid (not null)
            if (template && template !== null) {
              workflowCacheService.setCachedTemplate(workflow.templateId, template);
              workflowTemplatesRef.current[workflow.templateId] = template;
            }
            return { templateId: workflow.templateId, template };
          } catch (error) {
            // Log as warning for missing templates
            secureLogger.warn('Template not found or no permission', {
              templateId: workflow.templateId,
              error: error.message
            });
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
      setOrganizationWorkflows(workflows);

    } catch (error) {
      secureLogger.error('Error loading organization workflows', { error: error.message });
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
      secureLogger.error('Error refreshing single workflow', { error: error.message });
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
      // Delete from Firebase first
      await deleteWorkflowInstance(workflowId);

      // Clear workflow caches to ensure fresh data
      if (organization?.id) {
        workflowCacheService.clearWorkflowCaches(organization.id);
        secureLogger.info('Cleared workflow caches after deletion');
      }

      // Refresh workflows from Firestore to update UI immediately
      await refreshWorkflows();

      showToast('Workflow Deleted', 'Workflow has been permanently deleted', 'success');
    } catch (error) {
      secureLogger.error('Error deleting workflow', { error: error.message });
      showToast('Unable to Delete Workflow', 'The workflow could not be deleted. Please try again or contact support if the problem persists.', 'error');

      // Refresh workflows to ensure state is correct
      await refreshWorkflows();
      throw error;
    }
  }, [organization, showToast, refreshWorkflows]);

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

  // Track previous organization ID to clear old caches
  const prevOrgIdRef = useRef(null);

  // Load data on mount and when dependencies change
  useEffect(() => {
    if (userProfile?.id && organization?.id) {
      // Clear previous organization's cache when switching organizations
      if (prevOrgIdRef.current && prevOrgIdRef.current !== organization.id) {
        secureLogger.info('Organization changed - clearing old caches', {
          oldOrg: prevOrgIdRef.current,
          newOrg: organization.id
        });
        workflowCacheService.clearWorkflowCaches(prevOrgIdRef.current);
      }

      // Update tracked organization ID
      prevOrgIdRef.current = organization.id;

      // Initial load from cache
      loadUserWorkflows();
      loadOrganizationWorkflows();
    }
  }, [userProfile?.id, organization?.id]);

  // Removed periodic refresh - real-time listeners handle updates

  // DISABLED: Broad real-time listener replaced with tab-scoped listener in WorkflowMatrixView
  // This broad listener was causing 100+ reads on every workflow change
  // The tab-scoped listener only listens to 10-20 workflows at a time (95% reduction)
  useEffect(() => {
    if (!organization?.id || !userProfile?.id) return;

    secureLogger.info('Broad listener DISABLED - using cache-first loading only');
    secureLogger.info('Real-time updates handled by tab-scoped listener in MatrixView');

    // Load cached workflows for initial display
    const cachedWorkflows = workflowCacheService.getCachedWorkflows(userProfile.id, organization.id, 'active');
    if (cachedWorkflows && cachedWorkflows.length > 0) {
      secureLogger.info('Loaded workflows from cache', { count: cachedWorkflows.length });
      setUserWorkflows(cachedWorkflows);
    }

    // No listener setup - relying on tab-scoped listener in MatrixView for real-time updates
    return; // Early return - no listener to clean up

    /* COMMENTED OUT - Original broad listener code
    // Clean up any existing listener
    if (listenerUnsubscribeRef.current) {
      listenerUnsubscribeRef.current();
      listenerUnsubscribeRef.current = null;
    }

    // Query for active workflows in the organization
    const workflowsQuery = query(
      collection(firestore, 'workflows'),
      where('organizationID', '==', organization.id),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(100) // Limit to most recent 100 workflows to prevent excessive reads
    );

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

        // Process only the changed documents, not the entire snapshot
        // This prevents re-reading all 100 documents on every single update
        setUserWorkflows(prev => {
          let updated = [...prev];

          changes.forEach(change => {
            const workflow = { id: change.doc.id, ...change.doc.data() };

            if (change.type === 'added') {
              // Only add if it's relevant to the user
              if (workflow.stepProgress) {
                const hasAssignedSteps = Object.values(workflow.stepProgress).some(step =>
                  step.assignedTo === userProfile.id
                );
                const hasUnassignedSteps = Object.values(workflow.stepProgress).some(step =>
                  !step.assignedTo || step.assignedTo === null
                );

                if (hasAssignedSteps || hasUnassignedSteps) {
                  updated.push(workflow);
                }
              }
            } else if (change.type === 'modified') {
              // Update existing workflow
              const index = updated.findIndex(w => w.id === workflow.id);
              if (index !== -1) {
                updated[index] = workflow;
              }
            } else if (change.type === 'removed') {
              // Remove workflow
              updated = updated.filter(w => w.id !== workflow.id);
            }
          });

          return updated;
        });

        // Get unique template IDs from the changes only
        const changedTemplateIds = new Set();
        changes.forEach(change => {
          const workflow = change.doc.data();
          if (workflow.templateId && !workflowTemplatesRef.current[workflow.templateId]) {
            changedTemplateIds.add(workflow.templateId);
          }
        });

        // Load templates for new workflows (only if needed)
        const templatesToLoad = [];

        changedTemplateIds.forEach(templateId => {
          // First check cache
          const cachedTemplate = workflowCacheService.getCachedTemplate(templateId);
          if (cachedTemplate) {
            workflowTemplatesRef.current[templateId] = cachedTemplate;
            setWorkflowTemplates(prev => ({ ...prev, [templateId]: cachedTemplate }));
          } else {
            templatesToLoad.push(templateId);
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
              secureLogger.warn('Failed to load template group', { error: error.message });
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

        // Note: userWorkflows is now updated incrementally via setState callback above
        // No need to call setUserWorkflows again or update cache on every change
        // Cache is only updated on initial load to reduce Firebase costs

        // Note: Notification checking disabled in incremental update mode
        // TODO: Re-implement notifications to work with incremental updates
        // instead of requiring the full workflows array
      },
      (error) => {
        secureLogger.error('Error in workflows listener', { error: error.message });
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
    */
  }, [organization?.id, userProfile?.id]);

  // Daily timeline task check
  // Runs checkTimelineTasks once per day to create tasks for timeline-triggered workflow steps
  useEffect(() => {
    if (!organization?.id) return;

    // Function to run the timeline check
    const runTimelineCheck = async () => {
      try {
        const { checkTimelineTasks } = await import('../services/workflowTaskService');
        const stats = await checkTimelineTasks();

        if (stats.tasksCreated > 0) {
          secureLogger.info('Timeline check completed', { tasksCreated: stats.tasksCreated });
          // Refresh workflows to show newly created tasks
          await refreshWorkflows();
        }
      } catch (error) {
        secureLogger.error('Error in timeline check', { error: error.message });
      }
    };

    // Run immediately on mount (but only if it's been >12 hours since last check)
    const lastCheckTime = localStorage.getItem('workflow_timeline_last_check');
    const now = Date.now();
    const twelveHours = 12 * 60 * 60 * 1000;

    if (!lastCheckTime || (now - parseInt(lastCheckTime)) > twelveHours) {
      secureLogger.info('Running initial timeline check');
      runTimelineCheck();
      localStorage.setItem('workflow_timeline_last_check', now.toString());
    }

    // Set up daily interval (24 hours)
    const dailyInterval = setInterval(() => {
      secureLogger.info('Running scheduled timeline check');
      runTimelineCheck();
      localStorage.setItem('workflow_timeline_last_check', Date.now().toString());
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Cleanup interval on unmount
    return () => {
      clearInterval(dailyInterval);
    };
  }, [organization?.id, refreshWorkflows]);

  // Clear template from cache (for debugging)
  const clearTemplateCache = useCallback((templateId) => {
    workflowCacheService.clearTemplate(templateId);
    secureLogger.info('Cleared cache for template', { templateId });
  }, []);

  // Clear all workflow caches (for debugging)
  const clearAllCaches = useCallback(() => {
    workflowCacheService.clearAllWorkflowCaches();
    secureLogger.info('Cleared all workflow caches');
  }, []);

  // Force reload templates by clearing in-memory state
  const reloadTemplates = useCallback(() => {
    // Clear in-memory template state
    setWorkflowTemplates({});
    workflowTemplatesRef.current = {};
    secureLogger.info('Cleared in-memory template state, will reload on next workflow load');
  }, []);

  // Task modal management functions
  const openCreateTaskModal = useCallback((prefillData = null) => {
    setCreateTaskPrefill(prefillData);
    setIsCreateTaskModalOpen(true);
  }, []);

  const closeCreateTaskModal = useCallback(() => {
    setIsCreateTaskModalOpen(false);
    setCreateTaskPrefill(null);
  }, []);

  const openTaskDetailModal = useCallback((taskId) => {
    setSelectedTaskId(taskId);
    setIsTaskDetailModalOpen(true);
  }, []);

  const closeTaskDetailModal = useCallback(() => {
    setIsTaskDetailModalOpen(false);
    setSelectedTaskId(null);
  }, []);

  // Helper to create task for workflow step
  const createTaskForWorkflowStep = useCallback((workflowId, stepId, sessionID = null) => {
    const workflow = userWorkflows.find(w => w.id === workflowId);
    const template = workflow ? workflowTemplates[workflow.templateId] : null;
    const step = template?.steps.find(s => s.id === stepId);

    if (!workflow || !template || !step) {
      secureLogger.error('Invalid workflow, template, or step', {
        workflowId,
        templateId,
        stepId
      });
      return;
    }

    // Prepare prefill data for task creation
    const prefillData = {
      type: 'workflow',
      workflowId: workflowId,
      workflowStepId: stepId,
      sessionId: sessionID || workflow.sessionID,
      title: `${step.name} - ${workflow.sessionName || 'Workflow Task'}`,
      description: step.description || '',
      assignedTo: workflow.stepProgress[stepId]?.assignedTo ? [workflow.stepProgress[stepId].assignedTo] : [],
      dueDate: workflow.stepProgress[stepId]?.dueDate || null,
      priority: step.priority || 'medium'
    };

    openCreateTaskModal(prefillData);
  }, [userWorkflows, workflowTemplates, openCreateTaskModal]);

  const value = {
    // Data
    userWorkflows,
    organizationWorkflows,
    workflowTemplates,
    teamMembers,
    sessionData,
    loading,

    // Task modal state
    isCreateTaskModalOpen,
    createTaskPrefill,
    selectedTaskId,
    isTaskDetailModalOpen,

    // Functions
    refreshWorkflows,
    refreshSingleWorkflow,
    deleteWorkflow,
    updateWorkflowInState,
    getWorkflowWithTemplate,
    getUserPendingTasks,
    getWorkflowStats,

    // Task modal functions
    openCreateTaskModal,
    closeCreateTaskModal,
    openTaskDetailModal,
    closeTaskDetailModal,
    createTaskForWorkflowStep,

    // Helper functions
    loadUserWorkflows,
    loadOrganizationWorkflows,

    // Debug functions
    clearTemplateCache,
    clearAllCaches,
    reloadTemplates
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
};

export default WorkflowContext;