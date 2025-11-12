# EmailJS Template Setup Guide

These HTML templates are ready to be copied into your EmailJS dashboard.

## Quick Setup Steps:

1. Go to https://dashboard.emailjs.com/admin/templates
2. For each template file in this folder:
   - Click **"Create New Template"**
   - Set the **Template ID** and **Subject** as shown below
   - Copy the entire HTML content
   - Paste into the EmailJS template editor
   - Save the template

## Templates Quick Reference:

| Template ID | Subject Line | File | Purpose |
|------------|--------------|------|---------|
| `template_task_assignment` | `New Task Assigned: {{task_title}}` | template_task_assignment.html | New task assignments |
| `template_task_mention` | `{{from_name}} mentioned you in a task` | template_task_mention.html | @mentions in comments |
| `template_due_date` | `Reminder: "{{task_title}}" is due soon` | template_due_date.html | Due date reminders |
| `template_task_comment` | `New comment on "{{task_title}}"` | template_task_comment.html | Comments on watched tasks |
| `template_status_change` | `Task status updated: "{{task_title}}"` | template_status_change.html | Task status updates |

## Template Variables:

All templates use double curly braces `{{variable_name}}` for EmailJS to replace with actual values.

### Common Variables:
- `{{app_name}}` - Always "Focal Point"
- `{{to_name}}` - Recipient's name
- `{{to_email}}` - Recipient's email
- `{{from_name}}` - Sender's name
- `{{task_title}}` - Task title
- `{{task_url}}` - Link to the task

### Template-Specific Variables:
- **Assignment**: task_description, task_priority, task_due_date
- **Mention/Comment**: comment_text
- **Due Date**: days_until_due, urgency
- **Status Change**: old_status, new_status

## Testing:

After creating all templates:
1. Refresh your Focal Point app
2. Create a task and assign it to yourself
3. Check your email for the notification!

## Troubleshooting:

- Make sure Template IDs match exactly
- Variables are case-sensitive
- Check spam folder for test emails
- Verify Service ID is correct in .env file