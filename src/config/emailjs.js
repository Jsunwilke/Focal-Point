// src/config/emailjs.js

/**
 * EmailJS Configuration
 *
 * Setup Instructions:
 * 1. Go to https://dashboard.emailjs.com/
 * 2. Create a new service (Gmail, Outlook, etc.)
 * 3. Create email templates for each notification type
 * 4. Get your Public Key from Account > API Keys
 * 5. Add these values to your .env file or update them here
 */

export const EMAILJS_CONFIG = {
  // Your EmailJS Public Key
  publicKey: process.env.REACT_APP_EMAILJS_PUBLIC_KEY || 'YOUR_PUBLIC_KEY',

  // Your EmailJS Service ID
  serviceId: process.env.REACT_APP_EMAILJS_SERVICE_ID || 'YOUR_SERVICE_ID',

  // Template IDs for different notification types
  templates: {
    taskAssignment: process.env.REACT_APP_EMAILJS_TEMPLATE_TASK_ASSIGNMENT || 'template_task_assignment',
    taskMention: process.env.REACT_APP_EMAILJS_TEMPLATE_TASK_MENTION || 'template_task_mention',
    dueDateReminder: process.env.REACT_APP_EMAILJS_TEMPLATE_DUE_DATE || 'template_due_date',
    taskComment: process.env.REACT_APP_EMAILJS_TEMPLATE_TASK_COMMENT || 'template_task_comment',
    taskStatusChange: process.env.REACT_APP_EMAILJS_TEMPLATE_STATUS_CHANGE || 'template_status_change',
  }
};

// Check if EmailJS is configured
export const isEmailJSConfigured = () => {
  return EMAILJS_CONFIG.publicKey !== 'YOUR_PUBLIC_KEY' &&
         EMAILJS_CONFIG.serviceId !== 'YOUR_SERVICE_ID';
};

export default EMAILJS_CONFIG;
