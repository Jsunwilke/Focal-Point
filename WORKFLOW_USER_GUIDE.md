# Workflow System - User Guide
**Version:** 1.0
**Last Updated:** 2025-11-09
**For:** Focal Point Photography Studio Management

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Workflow Overview](#workflow-overview)
4. [Managing Tasks](#managing-tasks)
5. [Workflow Templates (Admin)](#workflow-templates-admin)
6. [Video Tutorials](#video-tutorials)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Introduction

The Workflow System helps photography studios manage complex, multi-step processes for photo shoots, editing, and delivery. Each workflow follows a template with predefined steps, automatic task creation, and progress tracking.

### Key Features

- **Template-Based Workflows**: Reusable workflow templates for common processes
- **Automatic Task Creation**: Tasks created automatically based on triggers
- **Progress Tracking**: Visual matrix showing workflow progress
- **Video Tutorials**: Embedded tutorial videos for each workflow step
- **Dependencies**: Steps that must be completed before others can begin
- **Task Management**: Integrated task system with comments and attachments

### User Roles

- **Employee**: Can view workflows, create and complete tasks
- **Manager**: All employee permissions + upload tutorial videos
- **Admin**: All permissions + create/edit workflow templates

---

## Getting Started

### Accessing Workflows

1. Log in to Focal Point
2. Click **"Workflows"** in the left sidebar
3. You'll see the Workflow Overview page with all active workflows

### Understanding the Interface

**Top Bar:**
- **Stats**: Shows total workflows, active, in-progress, and completed
- **Filters**: Filter by status, school, session type, date range, or search
- **Refresh Button**: Reload latest workflow data
- **Settings** (Admin only): Access template management

**Main View:**
- **Template Tabs**: Switch between different workflow types
- **Matrix Grid**: Shows all workflows (rows) and steps (columns)
- **Progress Indicators**: Color-coded status for each step
- **Task Counts**: Number shows tasks associated with each step

---

## Workflow Overview

### Workflow Matrix View

The matrix view is the main interface for viewing and managing workflows.

**Understanding the Grid:**

**Columns (Workflow Steps):**
- Each column represents a step in the workflow process
- Steps are ordered from left to right
- Column headers show step names

**Rows (Workflows):**
- Each row represents a single workflow instance
- Usually one workflow per photo shoot/session
- Row headers show school name or client name

**Cells (Step Status):**
- **Gray**: Not started
- **Yellow**: In progress
- **Green**: Completed
- **Blue badge**: Number of tasks for this step

**Interacting with Cells:**
- **Click a cell**: View step details, tasks, and tutorial videos
- **+ Button**: Create a new task for this step
- **Hover**: See tooltip with quick info

### Filters

**Status Filter:**
- **All**: Show all workflows
- **Active**: Only active workflows
- **Completed**: Finished workflows
- **Archived**: Archived workflows

**School Filter:**
- Select a specific school to view only their workflows

**Session Type Filter:**
- Filter by session type (e.g., "Spring Pictures", "Sports")

**Date Range:**
- **Today**: Workflows for today
- **This Week**: Last 7 days
- **This Month**: Last 30 days

**Search:**
- Search by school name, client name, or template name

**Clear Filters:**
- Click filter dropdown and select "All" or use Clear Filters button

---

## Managing Tasks

### Creating a Task

**Method 1: From Workflow Cell**
1. Navigate to Workflows page
2. Find the workflow and step
3. Click the **+ button** in the cell
4. Task creation modal opens with pre-filled data
5. Add optional description and due date
6. Click **Create Task**

**Method 2: From Tasks Page**
1. Go to **Tasks** page in sidebar
2. Click **+ Create Task** button
3. Fill in all fields including workflow and step
4. Click **Create Task**

### Viewing Task Details

1. Click on a cell with tasks (shows number badge)
2. Modal opens showing:
   - Step information
   - Tutorial video (if available)
   - List of associated tasks
3. Click on a task to open **Task Detail Modal**

**Task Detail Modal:**
- **Task Information**: Title, description, status, priority, due date
- **Assignment**: See who the task is assigned to
- **Comments**: Add comments and collaborate
- **Attachments**: Upload and view file attachments
- **History**: View task activity timeline

### Completing a Task

1. Open task detail modal
2. Change status to **"Completed"**
3. Task automatically updates
4. Workflow step progress updates

### Deleting Tasks

1. Open task detail modal
2. Click **Delete Task** button (trash icon)
3. **Warning**: If task is linked to a workflow, you'll see a warning message
4. Confirm deletion

---

## Workflow Templates (Admin)

### Accessing Template Management

1. Click **Workflows** in sidebar
2. Click **Settings** button (gear icon, top right)
3. Opens **Workflow Template Gallery**

### Template Gallery

**Tabs:**
- **Default Templates**: System-provided templates (cannot edit)
- **Custom Templates**: Your organization's templates

**Actions:**
- **+ Create Template**: Build a new workflow template
- **Edit** (pencil icon): Modify existing custom template
- **Clone** (copy icon): Copy default template to customize
- **Delete** (trash icon): Remove custom template

### Creating a Workflow Template

1. Click **+ Create Template**
2. Opens **Template Builder**

**Basic Information:**
- **Template Name**: Descriptive name (e.g., "Spring Photo Shoot Workflow")
- **Description**: What this workflow is for
- **Category**: Organize templates by category

**Adding Steps:**
1. Click **+ Add Step** button
2. Fill in step details

**Step Configuration:**

**Required Fields:**
- **Step Title**: Short name (e.g., "Schedule Shoot")
- **Step Type**:
  - **Action**: Requires an action (most common)
  - **Decision**: Decision point
  - **Review**: Review/approval step

**Task Creation Trigger:**
Choose when tasks should be automatically created:

- **Immediate**: Tasks created when workflow starts
- **Timeline**: Tasks created X days before a date
  - Shows "Days Before" field
  - Example: 7 days before shoot date
- **Dependency**: Tasks created when prerequisite steps complete
  - Select which steps must finish first
- **Manual**: Tasks created manually by users

**Optional Fields:**
- **Description**: Detailed step instructions
- **Tutorial Video URL**: YouTube, Vimeo, or uploaded video
- **Prerequisite Steps**: Dependencies (which steps must complete first)

**Step Dependencies:**
- Select steps that must be completed before this step
- System prevents circular dependencies
- Shows warning if circular dependency detected

### Tutorial Videos

**Uploading a Video:**
1. In step editor, scroll to "Tutorial Video"
2. Click **Upload Video** button
3. Select video file (MP4, MOV, AVI, WebM)
4. Preview video before upload
5. Click **Confirm Upload**
6. Progress bar shows upload status
7. **Cancel Upload**: Red button if you need to abort

**Requirements:**
- Maximum file size: 100MB
- Supported formats: MP4, MOV, AVI, WebM
- Managers and Admins only

**Or Paste URL:**
- YouTube: Paste any youtube.com URL
- Vimeo: Paste any vimeo.com URL
- System automatically converts to embed format

**Replacing a Video:**
- Click **Replace Video** button
- Upload new video or enter new URL
- Old video is removed

### Saving Templates

1. Review all steps in preview pane
2. Click **Save Template**
3. Validation checks:
   - Template name required
   - At least one step required
   - No circular dependencies
4. Success message appears
5. Returns to Template Gallery

### Editing Templates

1. Find template in gallery
2. Click **Edit** button (pencil icon)
3. Template Builder opens with existing data
4. Make changes
5. Click **Save Template**

### Deleting Templates

1. Find custom template in gallery
2. Click **Delete** button (trash icon)
3. **Confirmation dialog** appears with warning
4. Confirm deletion
5. Template permanently removed
6. **Note**: Existing workflows using this template are NOT deleted

---

## Video Tutorials

### Watching Tutorial Videos

1. Click on a workflow cell
2. Step detail modal opens
3. If video exists, video player appears at top
4. Click **Play** to watch

**Supported Formats:**
- YouTube videos (embedded)
- Vimeo videos (embedded)
- Direct video files (MP4, MOV, WebM, AVI)

**Video Player Controls:**
- **Play/Pause**: Click video or spacebar
- **Volume**: Adjust volume
- **Fullscreen**: Click fullscreen button
- **Close**: ESC key or X button

**If Video Fails to Load:**
- **Retry** button appears
- Shows error message explaining the issue
- Common issues:
  - Invalid URL
  - Video removed from YouTube/Vimeo
  - Network connection problem
  - Unsupported format

---

## Troubleshooting

### Workflows Not Loading

**Symptoms:**
- Blank screen
- Spinner never stops
- "No workflows found" when you know there should be

**Solutions:**
1. **Hard Refresh**: Press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Clear Cache**:
   - Open browser console (F12)
   - Type: `window.workflowDebug.clearAllCaches()`
   - Press Enter
   - Refresh page
3. **Check Internet Connection**: Ensure you're online
4. **Try Different Browser**: Test in Chrome/Firefox/Edge
5. **Contact Admin**: If issue persists

### Orphaned Workflows Warning

**Symptoms:**
- Red alert banner appears
- Says "X Orphaned Workflows Found"

**Cause:**
- Workflow's template was deleted
- Workflow cannot function without its template

**Solutions:**
1. **Delete Orphaned Workflows**:
   - Click **Delete All Orphaned Workflows** button
   - Confirm deletion
   - Warning disappears
2. **Keep Data**: Orphaned workflows are read-only; you can view but not edit

### Tasks Not Creating

**Symptoms:**
- Click + button but nothing happens
- Task creation fails with error

**Solutions:**
1. **Check Permissions**: Ensure you have permission to create tasks
2. **Check Network**: Verify internet connection
3. **Refresh Page**: Try hard refresh (Ctrl+Shift+R)
4. **Try Again**: Click + button again
5. **Check Console**: Open browser console (F12) for error messages

### Video Upload Failing

**Symptoms:**
- Upload starts but fails
- Progress bar stuck
- Error message appears

**Solutions:**
1. **Check File Size**: Must be under 100MB
2. **Check File Type**: Must be MP4, MOV, AVI, or WebM
3. **Check Internet Speed**: Large files need good connection
4. **Retry Upload**: Click Retry button
5. **Cancel and Try Again**: Click Cancel Upload, then try again
6. **Compress Video**: Use video compression tool to reduce file size

### Slow Performance

**Symptoms:**
- Page loads slowly
- Interactions lag
- UI feels sluggish

**Solutions:**
1. **Clear Cache**: See "Workflows Not Loading" above
2. **Close Other Tabs**: Free up browser memory
3. **Hard Refresh**: Ctrl+Shift+R
4. **Update Browser**: Use latest Chrome/Firefox/Edge
5. **Check Internet Speed**: Run speed test
6. **Reduce Filters**: Remove unnecessary filters

---

## FAQ

### General Questions

**Q: What is a workflow?**
A: A workflow is a series of steps that must be completed for a photo shoot or project. Each workflow follows a template and tracks progress through predefined steps.

**Q: How many workflows can I have?**
A: Unlimited. The system supports as many workflows as needed.

**Q: Can I customize the workflow steps?**
A: Admins can create custom templates with custom steps. Employees and Managers use existing templates.

**Q: What happens when I complete all steps?**
A: The workflow status changes to "Completed" and can be archived or kept for reference.

### Task Questions

**Q: Who can create tasks?**
A: All users (employees, managers, admins) can create tasks.

**Q: Can I assign tasks to others?**
A: Yes, in the task detail modal, you can assign tasks to any team member.

**Q: What happens to tasks when a workflow is deleted?**
A: Tasks remain in the system but are no longer linked to the workflow.

**Q: Can I have multiple tasks for one step?**
A: Yes! Each workflow step can have as many tasks as needed.

### Template Questions

**Q: Who can create workflow templates?**
A: Only Admins can create and edit workflow templates.

**Q: Can I edit default templates?**
A: No, but you can clone them to create a custom version.

**Q: What happens to existing workflows if I edit a template?**
A: Existing workflows are NOT affected. Template changes only apply to NEW workflows.

**Q: Can I delete a template that's in use?**
A: Yes, but it creates "orphaned workflows" which cannot function properly. You'll get a warning before deleting.

### Video Questions

**Q: Who can upload tutorial videos?**
A: Managers and Admins can upload videos.

**Q: What video formats are supported?**
A: MP4, MOV, AVI, WebM for uploads. YouTube and Vimeo URLs also supported.

**Q: What's the maximum video file size?**
A: 100MB per video file.

**Q: Can I use YouTube/Vimeo instead of uploading?**
A: Yes! Just paste the YouTube or Vimeo URL in the Video URL field.

**Q: What if my video is too large?**
A: Compress the video using a tool like HandBrake or upload to YouTube/Vimeo and paste the URL instead.

### Keyboard Shortcuts

**Q: Are there keyboard shortcuts?**
A: Yes:
- **ESC**: Close any modal
- **Tab**: Navigate through form fields
- **Enter**: Submit forms
- **Arrow Keys**: Navigate some lists

**Q: Can I navigate without a mouse?**
A: Yes! The entire system is keyboard-accessible. Use Tab to move between elements and Enter to activate.

---

## Keyboard Accessibility

The workflow system is fully accessible via keyboard:

### Modal Navigation

- **Open Modal**: Click or Tab+Enter
- **Close Modal**: ESC key or Tab to close button
- **Navigate Within**: Tab through elements
- **Submit Forms**: Enter key

### Focus Indicators

- All interactive elements show focus outline when tabbed to
- Blue outline indicates current focus
- Never lose track of where you are

### Screen Reader Support

- All images have alt text
- All buttons have descriptive labels
- Form fields properly labeled
- ARIA attributes for complex widgets

---

## Getting Help

### Documentation

- **User Guide**: This document
- **Accessibility Audit**: ACCESSIBILITY_AUDIT.md (technical)
- **Performance Guide**: PERFORMANCE_AUDIT.md (technical)
- **Testing Checklist**: PRODUCTION_SMOKE_TEST.md (QA)

### Support

**Technical Issues:**
1. Check this user guide
2. Try troubleshooting steps
3. Contact your organization admin
4. Report bug to development team

**Feature Requests:**
- Submit requests to your organization admin
- Include detailed description of desired feature
- Explain use case and benefits

### Browser Console Tools

For advanced troubleshooting, open browser console (F12) and try:

```javascript
// Clear all workflow caches
window.workflowDebug.clearAllCaches()

// View current workflows
window.workflowDebug.getRawWorkflows()

// View orphaned workflows
window.workflowDebug.getOrphanedWorkflows()

// Run automated tests
window.runWorkflowTests()
```

---

## Best Practices

### For All Users

1. **Keep workflows updated**: Mark steps complete as you finish them
2. **Use task comments**: Communicate with team members
3. **Watch tutorial videos**: Learn the proper process for each step
4. **Report issues promptly**: Don't wait if something isn't working

### For Managers

1. **Upload quality tutorial videos**: Clear, concise, well-lit videos
2. **Keep videos under 100MB**: Compress if needed or use YouTube
3. **Review team progress regularly**: Check workflow matrix weekly
4. **Assign tasks appropriately**: Balance workload across team

### For Admins

1. **Design clear templates**: Logical step order, clear names
2. **Set up dependencies**: Prevent steps from starting too early
3. **Test templates before deploying**: Create test workflow first
4. **Don't delete templates in use**: Avoid orphaned workflows
5. **Document your templates**: Add descriptions to each step

---

## Version History

### Version 1.0 (2025-11-09)
- Initial release
- Complete workflow system
- Template management
- Task integration
- Video tutorials
- Accessibility features
- Production-ready deployment

---

## Appendix

### Glossary

- **Workflow**: A series of steps for completing a process
- **Template**: A reusable workflow structure
- **Step**: Individual stage in a workflow
- **Task**: Actionable item associated with a step
- **Trigger**: Condition that creates a task automatically
- **Dependency**: Step that must complete before another can start
- **Orphaned Workflow**: Workflow whose template was deleted

### Technical Specifications

- **Browser Support**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Support**: Responsive design, works on tablets and phones
- **File Upload Limits**:
  - Videos: 100MB
  - Documents: 50MB
  - Images: 20MB
- **Cache Duration**: 7 days
- **Session Timeout**: 24 hours

---

**Document Maintained By:** Development Team
**For Technical Support:** Contact your system administrator
**Last Reviewed:** 2025-11-09

**🎯 Thank you for using the Focal Point Workflow System!**
