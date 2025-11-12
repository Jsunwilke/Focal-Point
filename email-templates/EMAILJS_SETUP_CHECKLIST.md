# EmailJS Setup Checklist

## ✅ Prerequisites (Already Done)
- [x] EmailJS Public Key: `0LUVuzZpmBm-SG-UM`
- [x] Service ID: `iconik_email`
- [x] Added to `.env` file
- [x] HTML templates created

## 📋 Template Setup in EmailJS Dashboard

Go to: https://dashboard.emailjs.com/admin/templates

Create these 5 templates with EXACT Template IDs and Subjects:

### 1. ☐ Task Assignment Template
- **Template ID:** `template_task_assignment`
- **Subject:** `New Task Assigned: {{task_title}}`
- **HTML File:** `template_task_assignment.html`
- **Color Theme:** Blue (#3b82f6)

### 2. ☐ Mention Notification Template
- **Template ID:** `template_task_mention`
- **Subject:** `{{from_name}} mentioned you in a task`
- **HTML File:** `template_task_mention.html`
- **Color Theme:** Purple (#8b5cf6)

### 3. ☐ Due Date Reminder Template
- **Template ID:** `template_due_date`
- **Subject:** `Reminder: "{{task_title}}" is due soon`
- **HTML File:** `template_due_date.html`
- **Color Theme:** Orange (#f59e0b)

### 4. ☐ Comment Notification Template
- **Template ID:** `template_task_comment`
- **Subject:** `New comment on "{{task_title}}"`
- **HTML File:** `template_task_comment.html`
- **Color Theme:** Green (#10b981)

### 5. ☐ Status Change Template
- **Template ID:** `template_status_change`
- **Subject:** `Task status updated: "{{task_title}}"`
- **HTML File:** `template_status_change.html`
- **Color Theme:** Indigo (#6366f1)

## 🧪 Testing Checklist

### Test Task Assignment:
1. ☐ Restart your app (to load environment variables)
2. ☐ Go to Tasks page
3. ☐ Create a new task
4. ☐ Assign it to yourself
5. ☐ Check email - should receive assignment notification

### Test Mention:
1. ☐ Open an existing task
2. ☐ Add a comment with @mention
3. ☐ Check email - mentioned user should receive notification

### Test Comment:
1. ☐ Comment on a task you're watching
2. ☐ Other watchers should receive email

### Test Status Change:
1. ☐ Change a task status
2. ☐ Assignees should receive notification

## 🔍 Troubleshooting

If emails aren't sending:

1. **Check Browser Console** for errors
2. **Verify in EmailJS Dashboard**:
   - Template IDs match exactly (case-sensitive!)
   - Service is connected properly
   - Monthly quota not exceeded (200 free emails/month)
3. **Check Spam Folder**
4. **Verify `.env` has:**
   ```
   REACT_APP_EMAILJS_PUBLIC_KEY=0LUVuzZpmBm-SG-UM
   REACT_APP_EMAILJS_SERVICE_ID=iconik_email
   ```

## 📊 EmailJS Dashboard Links

- **Templates:** https://dashboard.emailjs.com/admin/templates
- **Email History:** https://dashboard.emailjs.com/admin/history
- **Usage:** https://dashboard.emailjs.com/admin/statistics

## ✨ Success Indicators

- Console shows: "EmailJS initialized successfully"
- No errors in browser console
- Emails arrive within 1-2 seconds
- Correct formatting and data in emails

---

**Note:** Template IDs must match EXACTLY - they are case-sensitive!