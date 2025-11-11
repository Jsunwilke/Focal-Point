# Workflow Batch Deletion Script

This script allows you to safely delete workflows from your Firebase Firestore database in bulk, with various filtering options and safety features.

## Setup

### 1. Install Dependencies

First, navigate to the scripts directory and install the required packages:

```bash
cd scripts
npm install
```

### 2. Configure Firebase Authentication

You have two options for authentication:

#### Option A: Service Account (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (focal-point-c452c)
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Save the JSON file as `serviceAccountKey.json` in the `scripts` directory
6. **IMPORTANT**: Add `serviceAccountKey.json` to your `.gitignore` file

#### Option B: Firebase CLI Authentication

If you don't have a service account, you can use Firebase CLI authentication:

```bash
firebase login
```

## Usage

### Basic Commands

**Dry Run (Preview Only - Default)**
```bash
node deleteWorkflowsBatch.js
```

**Execute Deletion**
```bash
node deleteWorkflowsBatch.js --execute
```

**Using npm scripts**
```bash
npm run delete-workflows:dry    # Dry run
npm run delete-workflows:execute # Actually delete
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--days <number>` | Delete workflows older than X days | 30 |
| `--org <id>` | Filter by organization ID | All orgs |
| `--status <status>` | Filter by workflow status | All statuses |
| `--field <field>` | Date field to use: `createdAt`, `updatedAt`, `lastActivity` | `createdAt` |
| `--dry-run` | Run in preview mode only | true |
| `--execute` | Actually perform the deletion | false |
| `--help` | Show help message | - |

### Examples

**Delete workflows older than 60 days (dry run)**
```bash
node deleteWorkflowsBatch.js --days 60
```

**Delete workflows older than 90 days (execute)**
```bash
node deleteWorkflowsBatch.js --days 90 --execute
```

**Delete workflows for specific organization**
```bash
node deleteWorkflowsBatch.js --org "org123" --execute
```

**Delete workflows with "deleted" status**
```bash
node deleteWorkflowsBatch.js --status deleted --execute
```

**Complex filter: Organization + Status + Date**
```bash
node deleteWorkflowsBatch.js --org "org123" --status deleted --days 7 --execute
```

## Configuration

For more advanced configuration, edit the `CONFIG` object in `deleteWorkflowsBatch.js`:

```javascript
const CONFIG = {
  DATE_FIELD: 'createdAt',        // Date field to filter on
  DELETE_OLDER_THAN_DAYS: 30,     // Delete older than X days
  DELETE_NEWER_THAN_DAYS: null,   // Optional upper bound
  BATCH_SIZE: 500,                // Firestore batch limit
  DRY_RUN: true,                   // Preview mode
  ORGANIZATION_ID: null,           // Filter by org
  STATUS_FILTER: null,             // Filter by status
  CREATE_LOG: true,                // Create CSV log
  LOG_DIR: './logs'                // Log directory
};
```

## Safety Features

1. **Dry Run Mode**: By default, the script runs in dry run mode, showing you what would be deleted without actually deleting anything.

2. **Preview Information**: Before deletion, you'll see:
   - Total number of workflows to delete
   - Breakdown by organization
   - Breakdown by status
   - Date range of workflows
   - Sample of first 10 workflows

3. **Confirmation Prompts**: When executing deletion:
   - First confirmation required
   - Second confirmation for large deletions (>100 workflows)

4. **Batch Processing**: Deletes in batches of 500 documents (Firestore limit) with progress tracking

5. **Deletion Log**: Creates a CSV file with all deleted workflow IDs and metadata

## Output

### Console Output

The script provides detailed console output with:
- Color-coded messages
- Progress indicators
- Success/failure counts
- Error messages

### Log Files

Deletion logs are saved to `./logs/workflow-deletion-[timestamp].csv` containing:
- Workflow ID
- Organization ID
- Template ID
- Status
- Created/Updated dates
- Deletion success status

## Important Notes

### Orphaned Tasks

⚠️ **Warning**: This script does NOT delete related tasks. Tasks with `workflowId` references will become orphaned after workflow deletion.

To find orphaned tasks after deletion:
```javascript
// Query tasks with workflowIds that no longer exist
const orphanedTasks = await firestore
  .collection('tasks')
  .where('workflowId', '!=', null)
  .get();
```

### Cache Clearing

After running the deletion script, remember to:
1. Clear workflow caches in your application
2. Refresh any UI components displaying workflows
3. Consider running a task cleanup script if needed

### Firebase Costs

This script will incur Firebase costs:
- **Reads**: 1 read per workflow to fetch
- **Deletes**: 1 write per workflow deleted
- Estimate: ~2 operations per workflow

### Error Handling

If the script encounters errors:
1. Failed deletions are tracked and reported
2. Deletion log shows which workflows succeeded/failed
3. You can re-run the script to retry failed deletions

## Troubleshooting

### "Failed to initialize Firebase Admin SDK"

**Solution**: Ensure you have either:
- A `serviceAccountKey.json` file in the scripts directory, OR
- Are authenticated with Firebase CLI (`firebase login`)

### "Permission denied" errors

**Solution**: Check that your service account or Firebase CLI user has the necessary permissions:
- `firestore.documents.delete` permission
- Access to the workflows collection

### Script hangs or times out

**Solution**:
- Check your internet connection
- Verify Firebase project ID is correct
- Try with smaller batch sizes (edit `BATCH_SIZE` in CONFIG)

## Support

For issues or questions:
1. Check the deletion log for specific errors
2. Review Firebase Console for quota limits
3. Ensure your Firebase project is active and not suspended