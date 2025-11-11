#!/usr/bin/env node

const { initializeAdmin } = require('./firebaseAdminConfig');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Initialize Firebase Admin
const { firestore } = initializeAdmin();

// Configuration
const CONFIG = {
  // Date range options - modify these as needed
  DATE_FIELD: 'createdAt', // Options: 'createdAt', 'updatedAt', 'lastActivity'
  DELETE_OLDER_THAN_DAYS: 30, // Delete workflows older than X days
  DELETE_NEWER_THAN_DAYS: null, // Optional: Delete workflows newer than X days (null = no limit)

  // Batch configuration
  BATCH_SIZE: 500, // Firestore batch limit

  // Dry run mode
  DRY_RUN: false, // Set to false to actually delete

  // Filtering options
  ORGANIZATION_ID: null, // Set to specific org ID to filter, or null for all
  STATUS_FILTER: null, // Set to specific status (e.g., 'deleted') or null for all

  // Logging
  CREATE_LOG: true,
  LOG_DIR: './logs'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper function to format dates
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toISOString();
}

// Helper function to create date range
function getDateRange() {
  const now = new Date();
  const dates = {};

  if (CONFIG.DELETE_OLDER_THAN_DAYS !== null) {
    dates.olderThan = new Date();
    dates.olderThan.setDate(now.getDate() - CONFIG.DELETE_OLDER_THAN_DAYS);
  }

  if (CONFIG.DELETE_NEWER_THAN_DAYS !== null) {
    dates.newerThan = new Date();
    dates.newerThan.setDate(now.getDate() - CONFIG.DELETE_NEWER_THAN_DAYS);
  }

  return dates;
}

// Build query based on configuration
function buildQuery() {
  let query = firestore.collection('workflows');

  const dateRange = getDateRange();

  // Add date filters
  if (dateRange.olderThan) {
    query = query.where(CONFIG.DATE_FIELD, '<', dateRange.olderThan);
  }

  if (dateRange.newerThan) {
    query = query.where(CONFIG.DATE_FIELD, '>', dateRange.newerThan);
  }

  // Add organization filter if specified
  if (CONFIG.ORGANIZATION_ID) {
    query = query.where('organizationID', '==', CONFIG.ORGANIZATION_ID);
  }

  // Add status filter if specified
  if (CONFIG.STATUS_FILTER) {
    query = query.where('status', '==', CONFIG.STATUS_FILTER);
  }

  return query;
}

// Fetch all workflows matching criteria
async function fetchWorkflows() {
  console.log(`${colors.cyan}Fetching workflows...${colors.reset}`);

  const query = buildQuery();
  const snapshot = await query.get();

  const workflows = [];
  snapshot.forEach(doc => {
    workflows.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return workflows;
}

// Analyze workflows for dry run
function analyzeWorkflows(workflows) {
  const analysis = {
    total: workflows.length,
    byOrganization: {},
    byStatus: {},
    byTemplate: {},
    dateRange: {
      oldest: null,
      newest: null
    },
    relatedTasks: new Set()
  };

  workflows.forEach(workflow => {
    // Count by organization
    const orgId = workflow.organizationID || 'unknown';
    analysis.byOrganization[orgId] = (analysis.byOrganization[orgId] || 0) + 1;

    // Count by status
    const status = workflow.status || 'no-status';
    analysis.byStatus[status] = (analysis.byStatus[status] || 0) + 1;

    // Count by template
    const templateId = workflow.templateId || 'no-template';
    analysis.byTemplate[templateId] = (analysis.byTemplate[templateId] || 0) + 1;

    // Track date range
    const dateField = workflow[CONFIG.DATE_FIELD];
    if (dateField) {
      const date = dateField.toDate ? dateField.toDate() : new Date(dateField);
      if (!analysis.dateRange.oldest || date < analysis.dateRange.oldest) {
        analysis.dateRange.oldest = date;
      }
      if (!analysis.dateRange.newest || date > analysis.dateRange.newest) {
        analysis.dateRange.newest = date;
      }
    }
  });

  return analysis;
}

// Display dry run preview
function displayDryRunPreview(workflows, analysis) {
  console.log(`\n${colors.bright}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}DRY RUN PREVIEW${colors.reset}`);
  console.log(`${'='.repeat(60)}\n`);

  console.log(`${colors.yellow}⚠️  DRY RUN MODE - No data will be deleted${colors.reset}\n`);

  // Summary statistics
  console.log(`${colors.cyan}Summary:${colors.reset}`);
  console.log(`  Total workflows to delete: ${colors.bright}${analysis.total}${colors.reset}`);
  console.log(`  Date field used: ${CONFIG.DATE_FIELD}`);
  console.log(`  Delete workflows older than: ${CONFIG.DELETE_OLDER_THAN_DAYS} days`);

  if (analysis.total > 0) {
    console.log(`  Date range: ${formatDate(analysis.dateRange.oldest)} to ${formatDate(analysis.dateRange.newest)}`);

    // Organization breakdown
    console.log(`\n${colors.cyan}By Organization:${colors.reset}`);
    Object.entries(analysis.byOrganization)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([orgId, count]) => {
        console.log(`  ${orgId}: ${count} workflows`);
      });

    // Status breakdown
    console.log(`\n${colors.cyan}By Status:${colors.reset}`);
    Object.entries(analysis.byStatus)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`  ${status}: ${count} workflows`);
      });

    // Sample workflows
    console.log(`\n${colors.cyan}Sample Workflows (first 10):${colors.reset}`);
    workflows.slice(0, 10).forEach((workflow, index) => {
      console.log(`\n  ${index + 1}. ID: ${workflow.id}`);
      console.log(`     Organization: ${workflow.organizationID || 'N/A'}`);
      console.log(`     Template: ${workflow.templateId || 'N/A'}`);
      console.log(`     Status: ${workflow.status || 'N/A'}`);
      console.log(`     Created: ${formatDate(workflow.createdAt)}`);
      console.log(`     Updated: ${formatDate(workflow.updatedAt)}`);
      if (workflow.sessionId) {
        console.log(`     Session: ${workflow.sessionId}`);
      }
    });

    if (workflows.length > 10) {
      console.log(`\n  ... and ${workflows.length - 10} more workflows`);
    }
  }

  console.log(`\n${colors.yellow}⚠️  Warning: Related tasks will NOT be deleted${colors.reset}`);
  console.log(`   Tasks with workflowId references will become orphaned`);

  console.log(`\n${'='.repeat(60)}\n`);
}

// Delete workflows in batches
async function deleteWorkflowsBatch(workflows) {
  console.log(`\n${colors.cyan}Starting deletion process...${colors.reset}`);

  const totalBatches = Math.ceil(workflows.length / CONFIG.BATCH_SIZE);
  let deletedCount = 0;
  let failedDeletes = [];

  for (let i = 0; i < totalBatches; i++) {
    const start = i * CONFIG.BATCH_SIZE;
    const end = Math.min(start + CONFIG.BATCH_SIZE, workflows.length);
    const batchWorkflows = workflows.slice(start, end);

    console.log(`\n${colors.blue}Processing batch ${i + 1}/${totalBatches}${colors.reset}`);
    console.log(`  Deleting workflows ${start + 1} to ${end}...`);

    const batch = firestore.batch();

    batchWorkflows.forEach(workflow => {
      const docRef = firestore.collection('workflows').doc(workflow.id);
      batch.delete(docRef);
    });

    try {
      await batch.commit();
      deletedCount += batchWorkflows.length;

      // Show progress
      const progress = Math.round((deletedCount / workflows.length) * 100);
      console.log(`  ${colors.green}✓${colors.reset} Batch completed. Progress: ${progress}% (${deletedCount}/${workflows.length})`);
    } catch (error) {
      console.error(`  ${colors.red}✗ Batch failed: ${error.message}${colors.reset}`);
      failedDeletes.push(...batchWorkflows.map(w => w.id));
    }
  }

  return { deletedCount, failedDeletes };
}

// Create deletion log
async function createDeletionLog(workflows, result) {
  if (!CONFIG.CREATE_LOG) return;

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(CONFIG.LOG_DIR)) {
    fs.mkdirSync(CONFIG.LOG_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(CONFIG.LOG_DIR, `workflow-deletion-${timestamp}.csv`);

  // Create CSV content
  let csvContent = 'ID,OrganizationID,TemplateID,Status,CreatedAt,UpdatedAt,Deleted\n';

  workflows.forEach(workflow => {
    const deleted = !result.failedDeletes.includes(workflow.id);
    csvContent += `"${workflow.id}","${workflow.organizationID || ''}","${workflow.templateId || ''}","${workflow.status || ''}","${formatDate(workflow.createdAt)}","${formatDate(workflow.updatedAt)}","${deleted}"\n`;
  });

  fs.writeFileSync(logFile, csvContent);
  console.log(`\n${colors.green}✓${colors.reset} Deletion log saved to: ${logFile}`);
}

// Prompt for confirmation
async function promptConfirmation(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(`${message} (yes/no): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Main execution
async function main() {
  try {
    console.log(`${colors.bright}\n${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}WORKFLOW BATCH DELETION SCRIPT${colors.reset}`);
    console.log(`${'='.repeat(60)}\n`);

    // Fetch workflows
    const workflows = await fetchWorkflows();

    if (workflows.length === 0) {
      console.log(`${colors.yellow}No workflows found matching the criteria.${colors.reset}`);
      return;
    }

    // Analyze workflows
    const analysis = analyzeWorkflows(workflows);

    // Display preview
    displayDryRunPreview(workflows, analysis);

    if (CONFIG.DRY_RUN) {
      console.log(`${colors.yellow}This was a DRY RUN. To actually delete workflows:${colors.reset}`);
      console.log(`1. Edit this script and set CONFIG.DRY_RUN = false`);
      console.log(`2. Run the script again`);
      console.log(`3. Confirm the deletion when prompted\n`);
      return;
    }

    // Actual deletion - confirm first
    console.log(`${colors.red}${colors.bright}⚠️  WARNING: This action cannot be undone!${colors.reset}`);
    console.log(`You are about to delete ${colors.bright}${workflows.length}${colors.reset} workflows permanently.\n`);

    const confirmed = await promptConfirmation('Are you sure you want to proceed?');

    if (!confirmed) {
      console.log(`${colors.yellow}Deletion cancelled.${colors.reset}`);
      return;
    }

    // Final confirmation for large deletions
    if (workflows.length > 100) {
      console.log(`\n${colors.red}This is a LARGE deletion (${workflows.length} workflows).${colors.reset}`);
      const doubleConfirmed = await promptConfirmation('Type "yes" again to confirm');

      if (!doubleConfirmed) {
        console.log(`${colors.yellow}Deletion cancelled.${colors.reset}`);
        return;
      }
    }

    // Perform deletion
    const result = await deleteWorkflowsBatch(workflows);

    // Create log
    await createDeletionLog(workflows, result);

    // Final summary
    console.log(`\n${colors.bright}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}DELETION COMPLETE${colors.reset}`);
    console.log(`${'='.repeat(60)}\n`);

    console.log(`${colors.green}Successfully deleted: ${result.deletedCount} workflows${colors.reset}`);

    if (result.failedDeletes.length > 0) {
      console.log(`${colors.red}Failed to delete: ${result.failedDeletes.length} workflows${colors.reset}`);
      console.log('Failed IDs:', result.failedDeletes);
    }

    console.log(`\n${colors.cyan}Next Steps:${colors.reset}`);
    console.log('1. Clear workflow caches in your application');
    console.log('2. Consider running a task cleanup script for orphaned references');
    console.log('3. Review the deletion log for records\n');

  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Workflow Batch Deletion Script

Usage: node deleteWorkflowsBatch.js [options]

Options:
  --days <number>     Delete workflows older than X days (default: 30)
  --org <id>          Filter by organization ID
  --status <status>   Filter by workflow status
  --field <field>     Date field to use: createdAt, updatedAt, lastActivity (default: createdAt)
  --dry-run          Run in dry run mode (default: true)
  --execute          Actually perform the deletion (overrides dry run)
  --help, -h         Show this help message

Examples:
  node deleteWorkflowsBatch.js --dry-run
  node deleteWorkflowsBatch.js --days 60 --execute
  node deleteWorkflowsBatch.js --org org123 --status deleted --execute

Configuration:
  Edit the CONFIG object in the script for more options.
  `);
  process.exit(0);
}

// Process command line arguments
if (args.includes('--days')) {
  const daysIndex = args.indexOf('--days');
  CONFIG.DELETE_OLDER_THAN_DAYS = parseInt(args[daysIndex + 1]);
}

if (args.includes('--org')) {
  const orgIndex = args.indexOf('--org');
  CONFIG.ORGANIZATION_ID = args[orgIndex + 1];
}

if (args.includes('--status')) {
  const statusIndex = args.indexOf('--status');
  CONFIG.STATUS_FILTER = args[statusIndex + 1];
}

if (args.includes('--field')) {
  const fieldIndex = args.indexOf('--field');
  CONFIG.DATE_FIELD = args[fieldIndex + 1];
}

if (args.includes('--execute')) {
  CONFIG.DRY_RUN = false;
}

if (args.includes('--dry-run')) {
  CONFIG.DRY_RUN = true;
}

// Run the script
main();