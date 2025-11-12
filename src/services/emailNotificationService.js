// src/services/emailNotificationService.js
import emailjs from '@emailjs/browser';
import { EMAILJS_CONFIG, isEmailJSConfigured } from '../config/emailjs';
import { secureLogger } from './secureLogger';

/**
 * Email Notification Service
 * Handles sending email notifications for task-related events
 */

class EmailNotificationService {
  constructor() {
    this.initialized = false;
    this.config = EMAILJS_CONFIG;
  }

  /**
   * Initialize EmailJS with public key
   */
  init() {
    if (!isEmailJSConfigured()) {
      console.warn('EmailJS is not configured. Email notifications will not be sent.');
      return false;
    }

    try {
      emailjs.init(this.config.publicKey);
      this.initialized = true;
      secureLogger.info('EmailJS initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize EmailJS:', error);
      secureLogger.error('Failed to initialize EmailJS', { error: error.message });
      return false;
    }
  }

  /**
   * Send email using EmailJS
   */
  async sendEmail(templateId, templateParams) {
    if (!this.initialized) {
      this.init();
    }

    if (!this.initialized) {
      console.warn('EmailJS not initialized, skipping email send');
      return { success: false, error: 'EmailJS not configured' };
    }

    try {
      const response = await emailjs.send(
        this.config.serviceId,
        templateId,
        templateParams
      );

      secureLogger.info('Email sent successfully', {
        templateId,
        status: response.status
      });

      return { success: true, response };
    } catch (error) {
      console.error('Failed to send email:', error.message);

      secureLogger.error('Failed to send email', {
        templateId,
        error: error.message
      });

      return { success: false, error: error.message, details: error };
    }
  }

  /**
   * Send task assignment notification
   */
  async notifyTaskAssignment({ task, assignee, assigner }) {
    const templateParams = {
      to_email: assignee.email,
      to_name: assignee.displayName || assignee.email,
      from_name: assigner.displayName || assigner.email,
      task_title: task.title,
      task_description: task.description || 'No description provided',
      task_priority: task.priority || 'medium',
      task_due_date: task.dueDate ? new Date(task.dueDate.toDate()).toLocaleDateString() : 'Not set',
      task_url: `${window.location.origin}/tasks?taskId=${task.id}`,
      app_name: 'Focal Point'
    };

    return await this.sendEmail(
      this.config.templates.taskAssignment,
      templateParams
    );
  }

  /**
   * Send mention notification
   */
  async notifyMention({ task, mentionedUser, mentioner, comment }) {
    const templateParams = {
      to_email: mentionedUser.email,
      to_name: mentionedUser.displayName || mentionedUser.email,
      from_name: mentioner.displayName || mentioner.email,
      task_title: task.title,
      comment_text: comment.text,
      task_url: `${window.location.origin}/tasks?taskId=${task.id}`,
      app_name: 'Focal Point'
    };

    return await this.sendEmail(
      this.config.templates.taskMention,
      templateParams
    );
  }

  /**
   * Send due date reminder
   */
  async notifyDueDateReminder({ task, user, daysUntilDue }) {
    const templateParams = {
      to_email: user.email,
      to_name: user.displayName || user.email,
      task_title: task.title,
      task_description: task.description || 'No description provided',
      task_priority: task.priority || 'medium',
      due_date: new Date(task.dueDate.toDate()).toLocaleDateString(),
      days_until_due: daysUntilDue,
      urgency: daysUntilDue <= 1 ? 'urgent' : 'normal',
      task_url: `${window.location.origin}/tasks?taskId=${task.id}`,
      app_name: 'Focal Point'
    };

    return await this.sendEmail(
      this.config.templates.dueDateReminder,
      templateParams
    );
  }

  /**
   * Send comment notification
   */
  async notifyComment({ task, commenter, recipients, comment }) {
    const results = [];

    for (const recipient of recipients) {
      const templateParams = {
        to_email: recipient.email,
        to_name: recipient.displayName || recipient.email,
        from_name: commenter.displayName || commenter.email,
        task_title: task.title,
        comment_text: comment.text,
        task_url: `${window.location.origin}/tasks?taskId=${task.id}`,
        app_name: 'Focal Point'
      };

      const result = await this.sendEmail(
        this.config.templates.taskComment,
        templateParams
      );

      results.push({ recipient: recipient.email, ...result });
    }

    return results;
  }

  /**
   * Send task status change notification
   */
  async notifyStatusChange({ task, user, oldStatus, newStatus, changedBy }) {
    const templateParams = {
      to_email: user.email,
      to_name: user.displayName || user.email,
      from_name: changedBy.displayName || changedBy.email,
      task_title: task.title,
      old_status: oldStatus,
      new_status: newStatus,
      task_url: `${window.location.origin}/tasks?taskId=${task.id}`,
      app_name: 'Focal Point'
    };

    return await this.sendEmail(
      this.config.templates.taskStatusChange,
      templateParams
    );
  }

  /**
   * Batch send notifications with rate limiting
   */
  async batchSendNotifications(notifications, delayMs = 100) {
    const results = [];

    for (let i = 0; i < notifications.length; i++) {
      const { type, params } = notifications[i];

      let result;
      switch (type) {
        case 'assignment':
          result = await this.notifyTaskAssignment(params);
          break;
        case 'mention':
          result = await this.notifyMention(params);
          break;
        case 'dueDate':
          result = await this.notifyDueDateReminder(params);
          break;
        case 'comment':
          result = await this.notifyComment(params);
          break;
        case 'statusChange':
          result = await this.notifyStatusChange(params);
          break;
        default:
          result = { success: false, error: 'Unknown notification type' };
      }

      results.push({ ...result, type });

      // Add delay to avoid rate limiting
      if (i < notifications.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }
}

// Export singleton instance
export const emailNotificationService = new EmailNotificationService();

export default emailNotificationService;
