import { Timestamp } from 'firebase/firestore';

class WorkflowCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_workflow_';
    this.CACHE_VERSION = '1.0';
    this.WORKFLOW_CACHE_AGE = 2 * 60 * 60 * 1000; // 2 hours for workflows
    this.TEMPLATE_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours for templates (rarely change)
  }

  // Workflows cache key
  getWorkflowsKey(userId, organizationId, status = 'all') {
    return `${this.CACHE_PREFIX}workflows_${organizationId}_${userId}_${status}`;
  }

  // Organization workflows cache key
  getOrgWorkflowsKey(organizationId) {
    return `${this.CACHE_PREFIX}org_workflows_${organizationId}`;
  }

  // Templates cache key
  getTemplatesKey(organizationId) {
    return `${this.CACHE_PREFIX}templates_${organizationId}`;
  }

  // Single template cache key
  getTemplateKey(templateId) {
    return `${this.CACHE_PREFIX}template_${templateId}`;
  }

  // Cache user workflows
  setCachedWorkflows(userId, organizationId, status, workflows) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: workflows.map(wf => this.serializeWorkflow(wf))
      };
      const key = this.getWorkflowsKey(userId, organizationId, status);
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache workflows:', error);
    }
  }

  // Get cached user workflows
  getCachedWorkflows(userId, organizationId, status) {
    try {
      const key = this.getWorkflowsKey(userId, organizationId, status);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.WORKFLOW_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      // Deserialize workflows
      return cacheData.data.map(wf => this.deserializeWorkflow(wf));
    } catch (error) {
      console.warn('Failed to retrieve cached workflows:', error);
      return null;
    }
  }

  // Cache organization workflows
  setCachedOrgWorkflows(organizationId, workflows) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: workflows.map(wf => this.serializeWorkflow(wf))
      };
      const key = this.getOrgWorkflowsKey(organizationId);
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache org workflows:', error);
    }
  }

  // Get cached organization workflows
  getCachedOrgWorkflows(organizationId) {
    try {
      const key = this.getOrgWorkflowsKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.WORKFLOW_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      // Deserialize workflows
      return cacheData.data.map(wf => this.deserializeWorkflow(wf));
    } catch (error) {
      console.warn('Failed to retrieve cached org workflows:', error);
      return null;
    }
  }

  // Cache workflow templates
  setCachedTemplates(organizationId, templates) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: templates
      };
      const key = this.getTemplatesKey(organizationId);
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache templates:', error);
    }
  }

  // Get cached workflow templates
  getCachedTemplates(organizationId) {
    try {
      const key = this.getTemplatesKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age (longer for templates)
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.TEMPLATE_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached templates:', error);
      return null;
    }
  }

  // Cache single template
  setCachedTemplate(templateId, template) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: template
      };
      const key = this.getTemplateKey(templateId);
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`Failed to cache template ${templateId}:`, error);
    }
  }

  // Get cached single template
  getCachedTemplate(templateId) {
    try {
      const key = this.getTemplateKey(templateId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.TEMPLATE_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn(`Failed to retrieve cached template ${templateId}:`, error);
      return null;
    }
  }

  // Update single workflow in cache
  updateCachedWorkflow(userId, organizationId, status, updatedWorkflow) {
    try {
      const workflows = this.getCachedWorkflows(userId, organizationId, status);
      if (!workflows) return;

      const index = workflows.findIndex(wf => wf.id === updatedWorkflow.id);
      if (index !== -1) {
        workflows[index] = updatedWorkflow;
        this.setCachedWorkflows(userId, organizationId, status, workflows);
      }
    } catch (error) {
      console.warn('Failed to update cached workflow:', error);
    }
  }

  // Clear workflow caches
  clearWorkflowCaches(organizationId) {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX) && key.includes(organizationId)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear workflow caches:', error);
    }
  }

  // Serialize workflow for storage
  serializeWorkflow(workflow) {
    try {
      const serialized = { ...workflow };
      
      // Convert Timestamp fields
      const timestampFields = ['createdAt', 'updatedAt', 'lastActivity'];
      timestampFields.forEach(field => {
        if (serialized[field] && serialized[field].toMillis) {
          serialized[field] = {
            _isTimestamp: true,
            seconds: serialized[field].seconds,
            nanoseconds: serialized[field].nanoseconds
          };
        }
      });

      // Handle stepProgress timestamps
      if (serialized.stepProgress) {
        Object.keys(serialized.stepProgress).forEach(stepId => {
          const step = serialized.stepProgress[stepId];
          if (step.completedAt && step.completedAt.toMillis) {
            step.completedAt = {
              _isTimestamp: true,
              seconds: step.completedAt.seconds,
              nanoseconds: step.completedAt.nanoseconds
            };
          }
          if (step.startedAt && step.startedAt.toMillis) {
            step.startedAt = {
              _isTimestamp: true,
              seconds: step.startedAt.seconds,
              nanoseconds: step.startedAt.nanoseconds
            };
          }
        });
      }

      return serialized;
    } catch (error) {
      console.warn('Failed to serialize workflow:', error);
      return workflow;
    }
  }

  // Deserialize workflow from storage
  deserializeWorkflow(workflow) {
    try {
      const deserialized = { ...workflow };
      
      // Restore Timestamp fields
      const timestampFields = ['createdAt', 'updatedAt', 'lastActivity'];
      timestampFields.forEach(field => {
        if (deserialized[field]?._isTimestamp) {
          deserialized[field] = new Timestamp(
            deserialized[field].seconds,
            deserialized[field].nanoseconds
          );
        }
      });

      // Handle stepProgress timestamps
      if (deserialized.stepProgress) {
        Object.keys(deserialized.stepProgress).forEach(stepId => {
          const step = deserialized.stepProgress[stepId];
          if (step.completedAt?._isTimestamp) {
            step.completedAt = new Timestamp(
              step.completedAt.seconds,
              step.completedAt.nanoseconds
            );
          }
          if (step.startedAt?._isTimestamp) {
            step.startedAt = new Timestamp(
              step.startedAt.seconds,
              step.startedAt.nanoseconds
            );
          }
        });
      }

      return deserialized;
    } catch (error) {
      console.warn('Failed to deserialize workflow:', error);
      return workflow;
    }
  }

  // Get cache statistics
  getCacheStats(organizationId) {
    try {
      let workflowCount = 0;
      let templateCount = 0;
      let totalSize = 0;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += value.length;
            if (key.includes('workflow')) workflowCount++;
            if (key.includes('template')) templateCount++;
          }
        }
      }
      
      return {
        workflowCount,
        templateCount,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        workflowCount: 0,
        templateCount: 0,
        totalSize: 0,
        totalSizeMB: 0
      };
    }
  }

  // Clear all workflow caches
  clearAllWorkflowCaches() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} workflow cache items`);
    } catch (error) {
      console.warn('Failed to clear all workflow caches:', error);
    }
  }
}

// Create singleton instance
export const workflowCacheService = new WorkflowCacheService();
export default workflowCacheService;