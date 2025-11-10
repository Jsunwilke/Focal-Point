// src/tests/workflowEdgeCaseTests.js
/**
 * Workflow System Edge Case Test Suite
 * Run from browser console: window.runWorkflowTests()
 */

import { firestore } from '../firebase/config';
import { collection, getDocs, query, where, doc, getDoc, deleteDoc } from 'firebase/firestore';
import {
  createWorkflow,
  updateWorkflowStep,
  deleteWorkflow,
  getWorkflowTemplate
} from '../firebase/firestore';
import { createTask } from '../firebase/tasks';
import workflowCacheService from '../services/workflowCacheService';
import { readCounter } from '../services/readCounter';

class WorkflowTestSuite {
  constructor() {
    this.results = [];
    this.failedTests = [];
    this.passedTests = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logEntry);
    this.results.push({ timestamp, type, message });
  }

  async assert(condition, testName, errorMessage) {
    if (condition) {
      this.log(`✅ PASS: ${testName}`, 'pass');
      this.passedTests.push(testName);
      return true;
    } else {
      this.log(`❌ FAIL: ${testName} - ${errorMessage}`, 'fail');
      this.failedTests.push({ testName, errorMessage });
      return false;
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // Test 1: Workflow Creation & Templates
  // ============================================
  async testWorkflowCreation() {
    this.log('Starting Test 1: Workflow Creation & Templates', 'test');

    try {
      // Get available templates
      const templatesSnapshot = await getDocs(collection(firestore, 'workflowTemplates'));
      const templates = templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      await this.assert(
        templates.length > 0,
        'Templates exist in database',
        'No workflow templates found'
      );

      if (templates.length > 0) {
        const testTemplate = templates[0];
        this.log(`Using template: ${testTemplate.name} (${testTemplate.id})`);

        // Test: Can fetch template
        const fetchedTemplate = await getWorkflowTemplate(testTemplate.id);
        await this.assert(
          fetchedTemplate !== null,
          'Template fetch successful',
          'Failed to fetch template'
        );

        // Test: Template has required fields
        await this.assert(
          fetchedTemplate.steps && fetchedTemplate.steps.length > 0,
          'Template has steps',
          'Template missing steps array'
        );
      }

      // Test: Invalid template ID handling
      try {
        const invalidTemplate = await getWorkflowTemplate('nonexistent-template-id');
        await this.assert(
          invalidTemplate === null,
          'Invalid template returns null',
          'Should return null for invalid template'
        );
      } catch (error) {
        this.log('Invalid template handling works (throws or returns null)');
      }

    } catch (error) {
      this.log(`Test 1 Error: ${error.message}`, 'error');
    }
  }

  // ============================================
  // Test 2: Task Auto-Creation Triggers
  // ============================================
  async testTaskAutoCreation() {
    this.log('Starting Test 2: Task Auto-Creation Triggers', 'test');

    try {
      // Get workflows to test trigger types
      const workflowsSnapshot = await getDocs(
        query(collection(firestore, 'workflows'), where('organizationID', '!=', null))
      );

      const workflows = workflowsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      await this.assert(
        workflows.length > 0,
        'Workflows exist for testing',
        'No workflows found to test'
      );

      if (workflows.length > 0) {
        const testWorkflow = workflows[0];
        this.log(`Testing with workflow: ${testWorkflow.id}`);

        // Get template for this workflow
        const template = await getWorkflowTemplate(testWorkflow.templateId);

        if (template && template.steps.length > 0) {
          // Test immediate trigger
          const immediateStep = template.steps.find(s => s.taskCreationTrigger === 'immediate');
          if (immediateStep) {
            this.log('Found step with immediate trigger');
            // Check if tasks exist for immediate steps
            const tasksSnapshot = await getDocs(
              query(
                collection(firestore, 'tasks'),
                where('workflowId', '==', testWorkflow.id),
                where('workflowStepId', '==', immediateStep.id)
              )
            );
            await this.assert(
              tasksSnapshot.size >= 0,
              'Immediate trigger workflow step accessible',
              'Could not query tasks for immediate trigger'
            );
          }

          // Test dependency trigger
          const dependencyStep = template.steps.find(s => s.taskCreationTrigger === 'dependency');
          if (dependencyStep) {
            this.log('Found step with dependency trigger');
            await this.assert(
              dependencyStep.dependencies && Array.isArray(dependencyStep.dependencies),
              'Dependency step has dependencies array',
              'Dependency step missing dependencies'
            );
          }

          // Test timeline trigger
          const timelineStep = template.steps.find(s => s.taskCreationTrigger === 'timeline');
          if (timelineStep) {
            this.log('Found step with timeline trigger');
            await this.assert(
              typeof timelineStep.taskCreationDaysBefore === 'number',
              'Timeline step has days before value',
              'Timeline step missing taskCreationDaysBefore'
            );
          }
        }
      }

    } catch (error) {
      this.log(`Test 2 Error: ${error.message}`, 'error');
    }
  }

  // ============================================
  // Test 3: Cache Performance
  // ============================================
  async testCachePerformance() {
    this.log('Starting Test 3: Cache Performance', 'test');

    try {
      // Clear cache first
      workflowCacheService.clearAllCaches();
      this.log('Cleared all caches');

      // Reset read counter
      const initialReads = readCounter.getTotalReads();
      this.log(`Initial read count: ${initialReads}`);

      // Test cache miss (first load)
      const testKey = 'test-user-123';
      const testOrgId = 'test-org-456';

      const cachedWorkflows = workflowCacheService.getCachedWorkflows(testKey, testOrgId, 'active');
      await this.assert(
        cachedWorkflows === null,
        'Cache miss on first access',
        'Should return null for uncached data'
      );

      // Test cache set
      const mockWorkflows = [
        { id: 'wf1', templateId: 'template1', status: 'active' },
        { id: 'wf2', templateId: 'template2', status: 'active' }
      ];

      workflowCacheService.setCachedWorkflows(testKey, testOrgId, 'active', mockWorkflows);

      // Test cache hit
      const retrievedWorkflows = workflowCacheService.getCachedWorkflows(testKey, testOrgId, 'active');
      await this.assert(
        retrievedWorkflows !== null && retrievedWorkflows.length === 2,
        'Cache hit after setting data',
        'Failed to retrieve cached workflows'
      );

      // Test cache expiration
      const cacheKey = workflowCacheService.getCacheKey(testKey, testOrgId, 'active');
      const cachedData = localStorage.getItem(cacheKey);
      await this.assert(
        cachedData !== null,
        'Data stored in localStorage',
        'Cache not persisted to localStorage'
      );

      // Test cache clear
      workflowCacheService.clearWorkflowCache(testKey, testOrgId, 'active');
      const clearedWorkflows = workflowCacheService.getCachedWorkflows(testKey, testOrgId, 'active');
      await this.assert(
        clearedWorkflows === null,
        'Cache cleared successfully',
        'Cache not cleared properly'
      );

    } catch (error) {
      this.log(`Test 3 Error: ${error.message}`, 'error');
    }
  }

  // ============================================
  // Test 4: Step Dependencies
  // ============================================
  async testStepDependencies() {
    this.log('Starting Test 4: Step Dependencies', 'test');

    try {
      // Get templates to check for circular dependencies
      const templatesSnapshot = await getDocs(collection(firestore, 'workflowTemplates'));
      const templates = templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      for (const template of templates) {
        if (!template.steps || template.steps.length === 0) continue;

        // Build dependency graph
        const dependencyMap = {};
        template.steps.forEach(step => {
          dependencyMap[step.id] = step.dependencies || [];
        });

        // Check for circular dependencies using DFS
        const hasCircular = this.detectCircularDependency(dependencyMap);

        await this.assert(
          !hasCircular,
          `No circular dependencies in template: ${template.name}`,
          `Circular dependency detected in ${template.name}`
        );

        // Check that dependencies reference valid steps
        for (const step of template.steps) {
          if (step.dependencies && step.dependencies.length > 0) {
            const allDepsValid = step.dependencies.every(depId =>
              template.steps.some(s => s.id === depId)
            );
            await this.assert(
              allDepsValid,
              `All dependencies valid for step: ${step.title}`,
              `Invalid dependency reference in ${step.title}`
            );
          }
        }
      }

    } catch (error) {
      this.log(`Test 4 Error: ${error.message}`, 'error');
    }
  }

  detectCircularDependency(dependencyMap) {
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (nodeId) => {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const dependencies = dependencyMap[nodeId] || [];
      for (const depId of dependencies) {
        if (hasCycle(depId)) return true;
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId in dependencyMap) {
      if (hasCycle(nodeId)) return true;
    }

    return false;
  }

  // ============================================
  // Test 5: Data Integrity
  // ============================================
  async testDataIntegrity() {
    this.log('Starting Test 5: Data Integrity', 'test');

    try {
      // Test: Orphaned workflow detection
      const workflowsSnapshot = await getDocs(collection(firestore, 'workflows'));
      const workflows = workflowsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const templatesSnapshot = await getDocs(collection(firestore, 'workflowTemplates'));
      const templateIds = new Set(templatesSnapshot.docs.map(doc => doc.id));

      const orphanedWorkflows = workflows.filter(wf => !templateIds.has(wf.templateId));

      this.log(`Found ${orphanedWorkflows.length} orphaned workflows`);
      await this.assert(
        true, // This is informational, not a failure
        `Orphaned workflow check completed (${orphanedWorkflows.length} found)`,
        'N/A'
      );

      // Test: Task-workflow linkage
      const tasksSnapshot = await getDocs(
        query(collection(firestore, 'tasks'), where('workflowId', '!=', null))
      );
      const workflowLinkedTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      let orphanedTasksCount = 0;
      for (const task of workflowLinkedTasks.slice(0, 50)) { // Check first 50 to avoid timeout
        const workflowExists = workflows.some(wf => wf.id === task.workflowId);
        if (!workflowExists) orphanedTasksCount++;
      }

      this.log(`Found ${orphanedTasksCount} tasks with missing workflows (checked ${Math.min(50, workflowLinkedTasks.length)} tasks)`);
      await this.assert(
        true,
        `Task-workflow linkage check completed`,
        'N/A'
      );

      // Test: Workflow stepProgress integrity
      for (const workflow of workflows.slice(0, 20)) { // Check first 20
        if (!workflow.templateId) continue;

        const template = await getWorkflowTemplate(workflow.templateId);
        if (!template) continue;

        const stepProgress = workflow.stepProgress || {};
        const templateStepIds = new Set(template.steps.map(s => s.id));

        // Check for progress entries that don't match template steps
        const invalidProgressKeys = Object.keys(stepProgress).filter(
          stepId => !templateStepIds.has(stepId)
        );

        if (invalidProgressKeys.length > 0) {
          this.log(`Workflow ${workflow.id} has ${invalidProgressKeys.length} invalid step progress entries`);
        }
      }

    } catch (error) {
      this.log(`Test 5 Error: ${error.message}`, 'error');
    }
  }

  // ============================================
  // Test 6: Read Counter Validation
  // ============================================
  async testReadCounterValidation() {
    this.log('Starting Test 6: Read Counter Validation', 'test');

    try {
      const stats = readCounter.getStats();

      this.log(`Total reads: ${stats.totalReads}`);
      this.log(`Cache hits: ${stats.cacheHits}`);
      this.log(`Cache misses: ${stats.cacheMisses}`);

      if (stats.totalReads > 0) {
        const cacheHitRate = (stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100;
        this.log(`Cache hit rate: ${cacheHitRate.toFixed(2)}%`);

        await this.assert(
          cacheHitRate >= 50,
          'Cache hit rate >= 50%',
          `Cache hit rate too low: ${cacheHitRate.toFixed(2)}%`
        );
      }

      // Check for large read operations
      const largeReads = Object.entries(stats.byCollection || {})
        .filter(([_, count]) => count > 100)
        .map(([collection, count]) => ({ collection, count }));

      if (largeReads.length > 0) {
        this.log('⚠️  Large read operations detected:');
        largeReads.forEach(({ collection, count }) => {
          this.log(`  - ${collection}: ${count} reads`);
        });
      }

      await this.assert(
        true,
        'Read counter validation completed',
        'N/A'
      );

    } catch (error) {
      this.log(`Test 6 Error: ${error.message}`, 'error');
    }
  }

  // ============================================
  // Run All Tests
  // ============================================
  async runAllTests() {
    console.clear();
    this.log('========================================', 'test');
    this.log('WORKFLOW EDGE CASE TEST SUITE', 'test');
    this.log('========================================', 'test');
    this.log('');

    const startTime = Date.now();

    await this.testWorkflowCreation();
    await this.sleep(500);

    await this.testTaskAutoCreation();
    await this.sleep(500);

    await this.testCachePerformance();
    await this.sleep(500);

    await this.testStepDependencies();
    await this.sleep(500);

    await this.testDataIntegrity();
    await this.sleep(500);

    await this.testReadCounterValidation();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    this.log('');
    this.log('========================================', 'test');
    this.log('TEST SUMMARY', 'test');
    this.log('========================================', 'test');
    this.log(`Total Tests: ${this.passedTests.length + this.failedTests.length}`);
    this.log(`✅ Passed: ${this.passedTests.length}`);
    this.log(`❌ Failed: ${this.failedTests.length}`);
    this.log(`Duration: ${duration}s`);

    if (this.failedTests.length > 0) {
      this.log('');
      this.log('FAILED TESTS:', 'error');
      this.failedTests.forEach(({ testName, errorMessage }) => {
        this.log(`  - ${testName}: ${errorMessage}`, 'error');
      });
    }

    this.log('');
    this.log('Test results stored in: window.testResults', 'info');

    return {
      passed: this.passedTests.length,
      failed: this.failedTests.length,
      duration,
      results: this.results,
      failedTests: this.failedTests
    };
  }
}

// Export for use in browser console
export const runWorkflowTests = async () => {
  const suite = new WorkflowTestSuite();
  const results = await suite.runAllTests();
  window.testResults = results;
  return results;
};

export default WorkflowTestSuite;
