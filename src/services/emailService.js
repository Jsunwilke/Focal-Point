// src/services/emailService.js
// Email service for sending notifications
// Using Firebase Cloud Functions for backend email delivery

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config";
import emailjs from '@emailjs/browser';

// Initialize EmailJS (call this once when the app loads)
export const initEmailService = () => {
  // EmailJS is no longer used - we use Firebase Functions for email
  // This function is kept for backward compatibility
  return true;
};

// Send proofing approval notification
export const sendProofingApprovalEmail = async (recipientEmail, recipientName, galleryDetails) => {
  try {
    // Check if EmailJS is available
    if (typeof window === 'undefined' || !window.emailjs) {
      console.error('EmailJS not available');
      return { success: false, error: 'Email service not configured' };
    }

    // Prepare template parameters
    const templateParams = {
      to_email: recipientEmail,
      to_name: recipientName,
      gallery_name: galleryDetails.name,
      school_name: galleryDetails.schoolName,
      image_count: galleryDetails.totalImages,
      gallery_link: `${window.location.origin}/proof/${galleryDetails.id}`,
      approved_date: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      approved_by: galleryDetails.approvedBy || 'Client'
    };

    // Send email using EmailJS
    const response = await window.emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams
    );

    console.log('Email sent successfully:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
};

// Send batch notifications to multiple recipients via Firebase Function
export const sendBatchProofingApprovalEmails = async (recipients, galleryDetails) => {
  try {
    console.log('Calling Firebase Function to send approval emails', {
      recipients: recipients.length,
      galleryId: galleryDetails.id
    });
    
    // Get organizationId from first recipient or gallery details
    const organizationId = recipients[0]?.organizationId || galleryDetails.organizationId;
    
    if (!organizationId) {
      console.error('No organizationId found for email notifications');
      return { success: false, error: 'Missing organization ID' };
    }
    
    // Call the working Firebase Function
    const sendEmailFunction = httpsCallable(functions, 'sendProofingApprovalEmailManual');
    const result = await sendEmailFunction({
      galleryId: galleryDetails.id,
      organizationId: organizationId
    });
    
    console.log('Email function result:', result.data);
    return result.data;
  } catch (error) {
    console.error('Failed to send approval emails:', error);
    return { success: false, error: error.message };
  }
};

// Alternative backend integration (for future Firebase Functions implementation)
export const triggerBackendEmailNotification = async (galleryId, organizationId) => {
  try {
    // This would call a Firebase Function or backend API
    // For now, we'll use the frontend EmailJS solution
    console.log('Backend email notification would be triggered for gallery:', galleryId);
    
    // Example of what the backend call would look like:
    /*
    const response = await fetch('YOUR_CLOUD_FUNCTION_URL/sendProofingApprovalEmail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        galleryId,
        organizationId
      })
    });
    
    return await response.json();
    */
    
    return { success: false, message: 'Backend email service not configured' };
  } catch (error) {
    console.error('Failed to trigger backend email:', error);
    return { success: false, error: error.message };
  }
};

// Add EmailJS script to the document
export const loadEmailJS = () => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.emailjs) {
      resolve();
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    script.async = true;

    script.onload = () => {
      initEmailService();
      resolve();
    };

    script.onerror = () => {
      reject(new Error('Failed to load EmailJS'));
    };

    document.head.appendChild(script);
  });
};

//=============================================================================
// TASK NOTIFICATION EMAILS
//=============================================================================

// EmailJS Configuration for Task Notifications
const EMAIL_JS_SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID || 'YOUR_SERVICE_ID';
const EMAIL_JS_PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY || 'YOUR_PUBLIC_KEY';

// Template IDs
const TASK_TEMPLATES = {
  ASSIGNMENT: process.env.REACT_APP_EMAILJS_TEMPLATE_ASSIGNMENT || 'template_task_assignment',
  DUE_DATE_REMINDER: process.env.REACT_APP_EMAILJS_TEMPLATE_DUE_DATE || 'template_due_reminder',
  DUE_DATE_OVERDUE: process.env.REACT_APP_EMAILJS_TEMPLATE_OVERDUE || 'template_overdue'
};

/**
 * Initialize EmailJS for task notifications
 */
export const initializeTaskEmailJS = () => {
  try {
    emailjs.init(EMAIL_JS_PUBLIC_KEY);
    console.log('EmailJS initialized for task notifications');
  } catch (error) {
    console.error('Failed to initialize EmailJS:', error);
  }
};

/**
 * Send task assignment email
 */
export const sendTaskAssignmentEmail = async ({
  toEmail,
  toName,
  fromName,
  taskTitle,
  taskPriority,
  taskDueDate,
  taskUrl
}) => {
  try {
    const templateParams = {
      to_email: toEmail,
      to_name: toName,
      from_name: fromName,
      task_title: taskTitle,
      task_priority: taskPriority,
      task_due_date: taskDueDate || 'Not set',
      task_url: taskUrl,
      year: new Date().getFullYear()
    };

    const response = await emailjs.send(
      EMAIL_JS_SERVICE_ID,
      TASK_TEMPLATES.ASSIGNMENT,
      templateParams
    );

    console.log('Task assignment email sent:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Failed to send task assignment email:', error);
    return { success: false, error };
  }
};

/**
 * Send due date reminder email
 */
export const sendDueDateReminderEmail = async ({
  toEmail,
  toName,
  taskTitle,
  taskDueDate,
  taskUrl,
  hoursUntilDue
}) => {
  try {
    const templateParams = {
      to_email: toEmail,
      to_name: toName,
      task_title: taskTitle,
      task_due_date: taskDueDate,
      task_url: taskUrl,
      hours_until_due: hoursUntilDue,
      year: new Date().getFullYear()
    };

    const response = await emailjs.send(
      EMAIL_JS_SERVICE_ID,
      TASK_TEMPLATES.DUE_DATE_REMINDER,
      templateParams
    );

    console.log('Due date reminder email sent:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Failed to send due date reminder email:', error);
    return { success: false, error };
  }
};

/**
 * Send overdue task email
 */
export const sendOverdueTaskEmail = async ({
  toEmail,
  toName,
  taskTitle,
  taskDueDate,
  taskUrl,
  hoursPastDue
}) => {
  try {
    const templateParams = {
      to_email: toEmail,
      to_name: toName,
      task_title: taskTitle,
      task_due_date: taskDueDate,
      task_url: taskUrl,
      hours_past_due: hoursPastDue,
      year: new Date().getFullYear()
    };

    const response = await emailjs.send(
      EMAIL_JS_SERVICE_ID,
      TASK_TEMPLATES.DUE_DATE_OVERDUE,
      templateParams
    );

    console.log('Overdue task email sent:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Failed to send overdue task email:', error);
    return { success: false, error };
  }
};

/**
 * Check if user has email notifications enabled
 */
export const shouldSendEmail = (userProfile, notificationType) => {
  // Check if email notifications are enabled globally
  if (!userProfile.emailNotifications?.enabled) {
    return false;
  }

  // Check specific notification type preferences
  switch (notificationType) {
    case 'assignment':
      return userProfile.emailNotifications?.assignments !== false; // Default true
    case 'due_date':
      return userProfile.emailNotifications?.dueDateReminders !== false; // Default true
    default:
      return false;
  }
};

/**
 * Generate task URL for email links
 */
export const getTaskUrl = (taskId) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/tasks?taskId=${taskId}`;
};

/**
 * Format date for email display
 */
export const formatEmailDate = (date) => {
  if (!date) return 'Not set';

  const dateObj = date.toDate ? date.toDate() : new Date(date);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Calculate hours until/past due date
 */
export const calculateHoursDifference = (dueDate) => {
  if (!dueDate) return 0;

  const dueDateObj = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
  const now = new Date();
  const diffMs = dueDateObj - now;
  const diffHours = Math.abs(Math.round(diffMs / (1000 * 60 * 60)));

  return diffHours;
};