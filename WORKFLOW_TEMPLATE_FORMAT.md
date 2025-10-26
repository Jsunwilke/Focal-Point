# Workflow Template JSON Format

This document describes the JSON format for importing workflow templates. Use this format when asking ChatGPT or other AI to help create workflow templates.

## Basic Structure

```json
{
  "name": "Template Name",
  "description": "Brief description of this workflow",
  "sessionTypes": ["portrait", "wedding"],
  "estimatedDays": 7,
  "steps": [
    { /* step object - see below */ }
  ]
}
```

## Template Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Template name (e.g., "Wedding Photography Workflow") |
| `description` | string | No | Brief description of the workflow |
| `sessionTypes` | array | No | **Organization-specific** session type IDs (e.g., `["portrait"]`). These are custom per organization. Leave empty or use `["other"]` if unsure. |
| `estimatedDays` | number | No | Estimated days to complete workflow (default: 7) |
| `steps` | array | **Yes** | Array of step objects (see below) |

## Step Object Structure

```json
{
  "title": "Step Title",
  "description": "What needs to be done",
  "type": "task",
  "group": "pre_shoot",
  "assigneeRule": "role",
  "assigneeValue": "photographer",
  "estimatedHours": 2,
  "dueOffsetDays": 0,
  "micros": [
    { "label": "Micro-step 1" },
    { "label": "Micro-step 2" }
  ]
}
```

## Step Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | **Yes** | Step name (e.g., "Edit Photos") |
| `description` | string | No | Detailed description of the step |
| `type` | string | **Yes** | Step type - see valid values below |
| `group` | string | **Yes** | Workflow group - see valid values below |
| `assigneeRule` | string | **Yes** | How to assign this step - see valid values below |
| `assigneeValue` | string | Conditional | Required if assigneeRule is "role" or "specific" |
| `estimatedHours` | number | No | Estimated hours to complete (default: 1) |
| `dueOffsetDays` | number | No | Days relative to session: negative = before (e.g., `-2` = 2 days before), positive = after (e.g., `3` = 3 days after), `0` = day of session (default: 0) |
| `dependencies` | array | No | Array of step IDs that must be completed before this step can start (default: []) |
| `micros` | array | No | Array of micro-step objects for checklist items (default: []) |
| `notifications` | object | No | Notification settings - see Advanced Fields below |
| `files` | object | No | File requirements - see Advanced Fields below |

### Valid `type` Values
- `task` - A work item that needs to be completed
- `approval` - A step that requires review and approval
- `notification` - Automatic notification to client or team member

### Valid `group` Values
- `pre_shoot` - Preparation steps before photography session
- `shoot` - Photography session execution
- `editing` - Post-processing and photo enhancement
- `production` - Final delivery and client communication

### Valid `assigneeRule` Values
- `role` - Assign to any user with a specific role (requires `assigneeValue`)
- `specific` - Assign to a specific team member (requires `assigneeValue`)
- `auto` - System automatically handles (for notifications)

### Valid `assigneeValue` for role-based assignment
- `photographer` - Assigned to photographer
- `editor` - Assigned to photo editor
- `admin` - Assigned to admin/office staff
- `manager` - Assigned to manager/lead

## Micro-Steps (Optional Checklist)

Each step can have micro-steps - small checklist items that appear in the matrix view.

```json
"micros": [
  { "label": "Check equipment" },
  { "label": "Charge batteries" },
  { "label": "Format memory cards" }
]
```

**Note:** Step IDs and micro-step keys are auto-generated during import - you don't need to include them!

## Advanced Fields (Optional)

These fields are optional but provide additional control over workflow behavior.

### Dependencies

Control the order steps must be completed in:

```json
"dependencies": ["portrait_step_1", "portrait_step_2"]
```

**Note:** Step IDs are auto-generated during import. Dependencies are rarely needed in the JSON since steps execute in order by default. Only use if you need complex dependencies.

### Notifications

Control when notifications are sent:

```json
"notifications": {
  "onStart": true,
  "onComplete": true,
  "escalationHours": 24
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `onStart` | boolean | `true` | Send notification when step becomes active |
| `onComplete` | boolean | `true` | Send notification when step is completed |
| `escalationHours` | number | `24` | Hours before sending escalation notification if step is incomplete |

**Note:** You can usually omit this field - the defaults work well for most workflows.

### Files

Specify file requirements:

```json
"files": {
  "required": ["roster", "location_details"],
  "outputs": ["edited_photos", "final_gallery"]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `required` | array | `[]` | File identifiers that must exist before starting this step |
| `outputs` | array | `[]` | File identifiers this step will produce |

**Note:** File tracking is optional. Most workflows don't need this field.

### Due Date Offset Examples

The `dueOffsetDays` field determines when a step is due relative to the session date:

```json
"dueOffsetDays": -3  // Due 3 days BEFORE the session
"dueOffsetDays": 0   // Due on the day of the session
"dueOffsetDays": 2   // Due 2 days AFTER the session
"dueOffsetDays": 7   // Due 1 week after the session
```

**Common patterns:**
- Pre-shoot tasks: Use negative numbers (e.g., `-2` for equipment prep)
- Shoot tasks: Use `0` for day-of tasks
- Editing tasks: Use positive numbers (e.g., `1` for next-day editing)
- Delivery tasks: Use larger positive numbers (e.g., `7` for week-later delivery)

## Complete Example: Senior Portrait Workflow

```json
{
  "name": "Senior Portrait Workflow",
  "description": "Complete workflow for senior portrait photography sessions",
  "sessionTypes": ["senior_portrait", "portrait"],
  "estimatedDays": 10,
  "steps": [
    {
      "title": "Book & Confirm Session",
      "description": "Contact client to confirm session details, timing, and location preferences",
      "type": "task",
      "group": "pre_shoot",
      "assigneeRule": "role",
      "assigneeValue": "admin",
      "estimatedHours": 0.5,
      "dueOffsetDays": -3,
      "micros": [
        { "label": "Call client for confirmation" },
        { "label": "Discuss outfit suggestions" },
        { "label": "Confirm location and time" },
        { "label": "Send confirmation email" }
      ]
    },
    {
      "title": "Equipment Preparation",
      "description": "Prepare and check all camera equipment, lenses, and backup gear",
      "type": "task",
      "group": "pre_shoot",
      "assigneeRule": "role",
      "assigneeValue": "photographer",
      "estimatedHours": 1,
      "dueOffsetDays": -1,
      "micros": [
        { "label": "Check camera bodies" },
        { "label": "Clean lenses" },
        { "label": "Charge all batteries" },
        { "label": "Format memory cards" },
        { "label": "Pack backup equipment" }
      ]
    },
    {
      "title": "Photography Session",
      "description": "Conduct the senior portrait session with multiple outfit changes and locations",
      "type": "task",
      "group": "shoot",
      "assigneeRule": "role",
      "assigneeValue": "photographer",
      "estimatedHours": 2,
      "dueOffsetDays": 0,
      "micros": [
        { "label": "Scout and prepare location" },
        { "label": "Test lighting setup" },
        { "label": "Shoot 3-5 outfit changes" },
        { "label": "Capture candid and posed shots" },
        { "label": "Backup photos on-site" }
      ]
    },
    {
      "title": "Photo Culling",
      "description": "Review and select best photos from session for editing",
      "type": "task",
      "group": "editing",
      "assigneeRule": "role",
      "assigneeValue": "photographer",
      "estimatedHours": 1,
      "dueOffsetDays": 1,
      "micros": [
        { "label": "Import photos to editing software" },
        { "label": "Remove duplicates and out-of-focus shots" },
        { "label": "Select 50-75 best images" },
        { "label": "Mark favorites for retouching" }
      ]
    },
    {
      "title": "Photo Editing",
      "description": "Edit selected photos with color correction, retouching, and enhancements",
      "type": "task",
      "group": "editing",
      "assigneeRule": "role",
      "assigneeValue": "editor",
      "estimatedHours": 4,
      "dueOffsetDays": 3,
      "micros": [
        { "label": "Apply color correction" },
        { "label": "Skin retouching" },
        { "label": "Background cleanup" },
        { "label": "Apply consistent editing style" },
        { "label": "Export high-res versions" }
      ]
    },
    {
      "title": "Client Review & Selection",
      "description": "Send proof gallery to client for final selections",
      "type": "task",
      "group": "production",
      "assigneeRule": "role",
      "assigneeValue": "admin",
      "estimatedHours": 0.5,
      "dueOffsetDays": 4,
      "micros": [
        { "label": "Upload to online gallery" },
        { "label": "Send gallery link to client" },
        { "label": "Set selection deadline" }
      ]
    },
    {
      "title": "Final Delivery",
      "description": "Deliver final edited photos to client via download or physical media",
      "type": "task",
      "group": "production",
      "assigneeRule": "role",
      "assigneeValue": "admin",
      "estimatedHours": 1,
      "dueOffsetDays": 7,
      "micros": [
        { "label": "Export final selections" },
        { "label": "Create download gallery" },
        { "label": "Send delivery notification" },
        { "label": "Follow up for satisfaction" }
      ]
    }
  ]
}
```

## Quick Start for ChatGPT

When asking ChatGPT to create a workflow template, use this prompt:

```
Create a workflow template for [TYPE] photography with [NUMBER] steps.
Follow this JSON format exactly:

{
  "name": "Template Name",
  "description": "Description",
  "steps": [
    {
      "title": "Step Title",
      "type": "task|approval|notification",
      "group": "pre_shoot|shoot|editing|production",
      "assigneeRule": "role|specific|auto",
      "assigneeValue": "photographer|editor|admin|manager",
      "estimatedHours": 1,
      "dueOffsetDays": 0,
      "micros": [
        { "label": "Checklist item" }
      ]
    }
  ]
}

REQUIRED fields: name, steps, and for each step: title, type, group, assigneeRule, assigneeValue
OPTIONAL fields: description, estimatedHours, dueOffsetDays, micros, dependencies, notifications, files

Valid types: task, approval, notification
Valid groups: pre_shoot, shoot, editing, production
Valid assigneeValues: photographer, editor, admin, manager

Optional fields will be filled with sensible defaults if omitted.
```

## Import Process

1. Open Workflow Template Builder
2. Click "Import JSON" button
3. Paste the JSON from ChatGPT
4. Click "Import"
5. Steps will be validated and loaded
6. Edit if needed
7. Save template

## Validation Rules

The import will validate:
- ✅ Required fields are present
- ✅ Type, group, and assigneeRule values are valid
- ✅ Micro-steps have labels
- ❌ Will show clear error messages if validation fails

Step IDs and micro-step keys are auto-generated - don't include them in your JSON!
