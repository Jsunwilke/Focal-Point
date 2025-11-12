# EmailJS Template Setup Guide

This guide will help you set up email templates in your EmailJS account for task notifications.

## Setup Steps

1. Go to [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Create an account or log in
3. Add an email service (Gmail, Outlook, etc.)
4. Create the following email templates
5. Copy your Public Key and Service ID to your `.env` file

## Environment Variables

Add these to your `.env` file:

```env
REACT_APP_EMAILJS_PUBLIC_KEY=your_public_key_here
REACT_APP_EMAILJS_SERVICE_ID=your_service_id_here
REACT_APP_EMAILJS_TEMPLATE_TASK_ASSIGNMENT=template_task_assignment
REACT_APP_EMAILJS_TEMPLATE_TASK_MENTION=template_task_mention
REACT_APP_EMAILJS_TEMPLATE_DUE_DATE=template_due_date
REACT_APP_EMAILJS_TEMPLATE_TASK_COMMENT=template_task_comment
REACT_APP_EMAILJS_TEMPLATE_STATUS_CHANGE=template_status_change
```

## Email Templates

### 1. Task Assignment Template

**Template ID:** `template_task_assignment`

**Subject:** `New Task Assigned: {{task_title}}`

**HTML Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .task-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .task-info h3 { margin-top: 0; color: #1f2937; }
    .priority { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
    .priority-urgent { background: #fef2f2; color: #dc2626; }
    .priority-high { background: #fef3c7; color: #f59e0b; }
    .priority-medium { background: #dbeafe; color: #3b82f6; }
    .priority-low { background: #f0fdf4; color: #10b981; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">{{app_name}}</h1>
      <p style="margin: 5px 0 0 0;">Task Assignment Notification</p>
    </div>
    <div class="content">
      <p>Hi {{to_name}},</p>
      <p>{{from_name}} has assigned you a new task:</p>

      <div class="task-info">
        <h3>{{task_title}}</h3>
        <p><strong>Description:</strong> {{task_description}}</p>
        <p><strong>Priority:</strong> <span class="priority priority-{{task_priority}}">{{task_priority}}</span></p>
        <p><strong>Due Date:</strong> {{task_due_date}}</p>
      </div>

      <a href="{{task_url}}" class="button">View Task</a>

      <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">You can manage this task and update its status in {{app_name}}.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from {{app_name}}.</p>
    </div>
  </div>
</body>
</html>
```

---

### 2. Mention Notification Template

**Template ID:** `template_task_mention`

**Subject:** `{{from_name}} mentioned you in a task`

**HTML Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #8b5cf6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .comment-box { background: white; padding: 20px; border-left: 4px solid #8b5cf6; margin: 20px 0; border-radius: 4px; }
    .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">{{app_name}}</h1>
      <p style="margin: 5px 0 0 0;">Mention Notification</p>
    </div>
    <div class="content">
      <p>Hi {{to_name}},</p>
      <p><strong>{{from_name}}</strong> mentioned you in a comment on "<strong>{{task_title}}</strong>":</p>

      <div class="comment-box">
        <p style="margin: 0;">{{comment_text}}</p>
      </div>

      <a href="{{task_url}}" class="button">View Task & Reply</a>
    </div>
    <div class="footer">
      <p>This is an automated notification from {{app_name}}.</p>
    </div>
  </div>
</body>
</html>
```

---

### 3. Due Date Reminder Template

**Template ID:** `template_due_date`

**Subject:** `Reminder: "{{task_title}}" is due {{days_until_due == 0 ? 'today' : days_until_due == 1 ? 'tomorrow' : 'soon'}}`

**HTML Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .task-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
    .urgent { background: #fef2f2; border-left-color: #dc2626; }
    .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">{{app_name}}</h1>
      <p style="margin: 5px 0 0 0;">Due Date Reminder</p>
    </div>
    <div class="content">
      <p>Hi {{to_name}},</p>
      <p>This is a reminder that your task is due soon:</p>

      <div class="task-info {{urgency}}">
        <h3 style="margin-top: 0;">{{task_title}}</h3>
        <p><strong>Description:</strong> {{task_description}}</p>
        <p><strong>Priority:</strong> {{task_priority}}</p>
        <p><strong>Due Date:</strong> {{due_date}}</p>
        <p style="margin-bottom: 0;"><strong>Time Remaining:</strong> {{days_until_due}} day{{days_until_due != 1 ? 's' : ''}}</p>
      </div>

      <a href="{{task_url}}" class="button">View Task</a>
    </div>
    <div class="footer">
      <p>This is an automated notification from {{app_name}}.</p>
    </div>
  </div>
</body>
</html>
```

---

### 4. Comment Notification Template

**Template ID:** `template_task_comment`

**Subject:** `New comment on "{{task_title}}"`

**HTML Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .comment-box { background: white; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 4px; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">{{app_name}}</h1>
      <p style="margin: 5px 0 0 0;">New Comment</p>
    </div>
    <div class="content">
      <p>Hi {{to_name}},</p>
      <p><strong>{{from_name}}</strong> commented on "<strong>{{task_title}}</strong>":</p>

      <div class="comment-box">
        <p style="margin: 0;">{{comment_text}}</p>
      </div>

      <a href="{{task_url}}" class="button">View Task & Reply</a>
    </div>
    <div class="footer">
      <p>This is an automated notification from {{app_name}}.</p>
    </div>
  </div>
</body>
</html>
```

---

### 5. Status Change Template

**Template ID:** `template_status_change`

**Subject:** `Task status updated: "{{task_title}}"`

**HTML Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .status-change { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .status { display: inline-block; padding: 8px 16px; border-radius: 6px; font-weight: bold; margin: 0 10px; }
    .arrow { font-size: 24px; color: #6b7280; }
    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">{{app_name}}</h1>
      <p style="margin: 5px 0 0 0;">Task Status Updated</p>
    </div>
    <div class="content">
      <p>Hi {{to_name}},</p>
      <p><strong>{{from_name}}</strong> updated the status of "<strong>{{task_title}}</strong>":</p>

      <div class="status-change">
        <span class="status" style="background: #e5e7eb; color: #374151;">{{old_status}}</span>
        <span class="arrow">→</span>
        <span class="status" style="background: #dbeafe; color: #3b82f6;">{{new_status}}</span>
      </div>

      <a href="{{task_url}}" class="button">View Task</a>
    </div>
    <div class="footer">
      <p>This is an automated notification from {{app_name}}.</p>
    </div>
  </div>
</body>
</html>
```

---

## Template Variables Reference

Each template uses specific variables that are automatically populated by the system:

### Common Variables
- `{{to_email}}` - Recipient's email
- `{{to_name}}` - Recipient's display name
- `{{from_name}}` - Sender's display name
- `{{task_title}}` - Task title
- `{{task_url}}` - Direct link to the task
- `{{app_name}}` - Application name (Focal Point)

### Task Assignment
- `{{task_description}}` - Task description
- `{{task_priority}}` - Task priority (urgent/high/medium/low)
- `{{task_due_date}}` - Formatted due date

### Mentions & Comments
- `{{comment_text}}` - The comment content

### Due Date Reminders
- `{{due_date}}` - Formatted due date
- `{{days_until_due}}` - Number of days until due
- `{{urgency}}` - 'urgent' or 'normal' (for styling)

### Status Changes
- `{{old_status}}` - Previous status
- `{{new_status}}` - New status

## Testing Your Templates

After setting up the templates in EmailJS:

1. Update your `.env` file with the correct IDs
2. Restart your development server
3. Go to Task Settings and enable email notifications
4. Create a test task and assign it to yourself
5. Check your email to verify the template formatting

## Troubleshooting

- **Emails not sending?** Check that your EmailJS Public Key and Service ID are correct
- **Template variables not showing?** Verify the variable names match exactly (case-sensitive)
- **Emails going to spam?** Add your EmailJS sending address to your contacts
- **Rate limiting?** EmailJS free tier allows 200 emails/month

## Need Help?

- [EmailJS Documentation](https://www.emailjs.com/docs/)
- [EmailJS Dashboard](https://dashboard.emailjs.com/)
