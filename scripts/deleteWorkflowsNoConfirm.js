#!/usr/bin/env node

const { initializeAdmin } = require('./firebaseAdminConfig');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const { firestore } = initializeAdmin();

// Configuration - using command line args
const daysOld = parseInt(process.argv[2] || '10');

console.log(`\n🔥 Starting workflow deletion (older than ${daysOld} days)...\n`);

// Helper function to format dates
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toISOString();
}

// Delete workflows in batches
async function deleteWorkflowsBatch(workflows) {
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(workflows.length / BATCH_SIZE);
  let deletedCount = 0;
  let failedDeletes = [];

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, workflows.length);
    const batchWorkflows = workflows.slice(start, end);

    console.log(`Processing batch ${i + 1}/${totalBatches} (${batchWorkflows.length} workflows)...`);

    const batch = firestore.batch();

    batchWorkflows.forEach(workflow => {
      const docRef = firestore.collection('workflows').doc(workflow.id);
      batch.delete(docRef);
    });

    try {
      await batch.commit();
      deletedCount += batchWorkflows.length;
      const progress = Math.round((deletedCount / workflows.length) * 100);
      console.log(`✓ Batch completed. Progress: ${progress}% (${deletedCount}/${workflows.length})`);
    } catch (error) {
      console.error(`✗ Batch failed: ${error.message}`);
      failedDeletes.push(...batchWorkflows.map(w => w.id));
    }
  }

  return { deletedCount, failedDeletes };
}

// Main execution
async function main() {
  try {
    // Build date filter
    const olderThan = new Date();
    olderThan.setDate(olderThan.getDate() - daysOld);

    // Fetch workflows
    console.log('Fetching workflows...');
    const query = firestore.collection('workflows')
      .where('createdAt', '<', olderThan);

    const snapshot = await query.get();
    const workflows = [];

    snapshot.forEach(doc => {
      workflows.push({
        id: doc.id,
        ...doc.data()
      });
    });

    if (workflows.length === 0) {
      console.log('No workflows found matching the criteria.');
      return;
    }

    console.log(`\nFound ${workflows.length} workflows to delete.`);
    console.log(`Date range: older than ${formatDate(olderThan)}\n`);

    // Perform deletion
    console.log('Starting deletion...\n');
    const result = await deleteWorkflowsBatch(workflows);

    // Create log
    const logsDir = './logs';
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logsDir, `workflow-deletion-${timestamp}.csv`);

    let csvContent = 'ID,OrganizationID,TemplateID,Status,CreatedAt,Deleted\n';
    workflows.forEach(workflow => {
      const deleted = !result.failedDeletes.includes(workflow.id);
      csvContent += `"${workflow.id}","${workflow.organizationID || ''}","${workflow.templateId || ''}","${workflow.status || ''}","${formatDate(workflow.createdAt)}","${deleted}"\n`;
    });

    fs.writeFileSync(logFile, csvContent);

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('DELETION COMPLETE');
    console.log('='.repeat(60) + '\n');

    console.log(`✅ Successfully deleted: ${result.deletedCount} workflows`);

    if (result.failedDeletes.length > 0) {
      console.log(`❌ Failed to delete: ${result.failedDeletes.length} workflows`);
      console.log('Failed IDs:', result.failedDeletes);
    }

    console.log(`\n📄 Deletion log saved to: ${logFile}`);
    console.log('\nNext Steps:');
    console.log('1. Clear workflow caches in your application');
    console.log('2. Consider running a task cleanup script for orphaned references\n');

  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();