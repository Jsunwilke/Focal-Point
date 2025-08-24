// functions/proofingEmailService.js
const nodemailer = require('nodemailer');
const { getProofingApprovalTemplate } = require('./templates/proofingApprovalEmail');
const { getProofingReplacementTemplate } = require('./templates/proofingReplacementEmail');

// Email configuration - try to get from functions config, fallback to env vars
let emailConfig;
try {
  const functions = require('firebase-functions');
  emailConfig = functions.config().email || {};
} catch (error) {
  emailConfig = {};
}

// Merge with environment variables and defaults
emailConfig = {
  smtp_host: emailConfig.smtp_host || process.env.SMTP_HOST || 'smtp.office365.com',
  smtp_port: emailConfig.smtp_port || process.env.SMTP_PORT || 587,
  smtp_user: emailConfig.smtp_user || process.env.SMTP_USER || 'notifications@myfocalpoint.io',
  smtp_pass: emailConfig.smtp_pass || process.env.SMTP_PASS || 'Brockzada822603',
  from_email: emailConfig.from_email || process.env.FROM_EMAIL || 'notifications@myfocalpoint.io',
  from_name: emailConfig.from_name || process.env.FROM_NAME || 'Focal Point Studio'
};

// Create reusable transporter
let transporter = null;

/**
 * Initialize the email transporter
 */
function initializeTransporter() {
  if (!transporter) {
    console.log('Creating email transporter with config:', {
      host: emailConfig.smtp_host,
      port: emailConfig.smtp_port,
      user: emailConfig.smtp_user,
      // Don't log password
      hasPassword: !!emailConfig.smtp_pass
    });
    
    try {
      transporter = nodemailer.createTransport({
        host: emailConfig.smtp_host,
        port: parseInt(emailConfig.smtp_port),
        secure: emailConfig.smtp_port === '465', // true for 465, false for other ports
        auth: {
          user: emailConfig.smtp_user,
          pass: emailConfig.smtp_pass
        },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        }
      });
      console.log('Transporter created successfully');
    } catch (error) {
      console.error('Error creating transporter:', error);
      console.error('Nodemailer object:', typeof nodemailer, Object.keys(nodemailer || {}));
      throw error;
    }
  }
  return transporter;
}

/**
 * Send a single proofing approval email
 */
async function sendProofingApprovalEmail(recipient, galleryDetails) {
  try {
    const transporter = initializeTransporter();
    
    // Generate email content
    const htmlContent = getProofingApprovalTemplate({
      recipientName: recipient.displayName || `${recipient.firstName} ${recipient.lastName}`,
      galleryName: galleryDetails.name,
      schoolName: galleryDetails.schoolName,
      imageCount: galleryDetails.totalImages,
      approvedBy: galleryDetails.approvedBy,
      approvedDate: new Date(galleryDetails.approvedDate).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      galleryLink: `https://focalpoint.studio/proof/${galleryDetails.id}`
    });

    // Email options with better deliverability
    const mailOptions = {
      from: `"${emailConfig.from_name}" <${emailConfig.from_email}>`,
      to: recipient.email,
      subject: `Proofing Gallery Approved: ${galleryDetails.name}`,
      html: htmlContent,
      text: `Proofing Gallery Approved\n\n` +
            `Gallery: ${galleryDetails.name}\n` +
            `School: ${galleryDetails.schoolName}\n` +
            `Total Images: ${galleryDetails.totalImages}\n` +
            `Approved by: ${galleryDetails.approvedBy}\n\n` +
            `View the gallery: https://myfocalpoint.io/proof/${galleryDetails.id}`,
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'Focal Point Studio',
        'List-Unsubscribe': `<https://myfocalpoint.io/settings>`,
        'Precedence': 'bulk'
      },
      replyTo: emailConfig.from_email
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`Email sent to ${recipient.email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Failed to send email to ${recipient.email}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send batch proofing approval emails
 */
async function sendBatchProofingApprovalEmails(recipients, galleryDetails) {
  const results = {
    successful: 0,
    failed: 0,
    details: []
  };

  // Process emails in sequence to avoid overwhelming the SMTP server
  for (const recipient of recipients) {
    try {
      const result = await sendProofingApprovalEmail(recipient, galleryDetails);
      
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
      }
      
      results.details.push({
        email: recipient.email,
        ...result
      });

      // Add a small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error sending email to ${recipient.email}:`, error);
      results.failed++;
      results.details.push({
        email: recipient.email,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Send a single proofing replacement email
 */
async function sendProofingReplacementEmail(recipient, galleryDetails) {
  try {
    const transporter = initializeTransporter();
    
    // Generate email content
    const htmlContent = getProofingReplacementTemplate({
      recipientName: recipient.displayName || `${recipient.firstName} ${recipient.lastName}`,
      galleryName: galleryDetails.name,
      schoolName: galleryDetails.schoolName,
      replacedCount: galleryDetails.replacedCount,
      uploadedBy: galleryDetails.uploadedBy,
      uploadDate: new Date(galleryDetails.uploadDate).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      replacedImages: galleryDetails.replacedImages || [],
      galleryLink: `https://focalpoint.studio/proof/${galleryDetails.id}`
    });

    // Email options
    const mailOptions = {
      from: `"${emailConfig.from_name}" <${emailConfig.from_email}>`,
      to: recipient.email,
      subject: `New Image Versions Uploaded: ${galleryDetails.name}`,
      html: htmlContent,
      text: `New Image Versions Uploaded\n\n` +
            `Gallery: ${galleryDetails.name}\n` +
            `School: ${galleryDetails.schoolName}\n` +
            `Replaced Images: ${galleryDetails.replacedCount} photo(s)\n` +
            `Uploaded by: ${galleryDetails.uploadedBy}\n\n` +
            `New versions of images you previously denied have been uploaded for review.\n\n` +
            `Review the gallery: https://focalpoint.studio/proof/${galleryDetails.id}`,
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'Focal Point Studio',
        'List-Unsubscribe': `<https://focalpoint.studio/settings>`,
        'Precedence': 'bulk'
      },
      replyTo: emailConfig.from_email
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`Replacement email sent to ${recipient.email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Failed to send replacement email to ${recipient.email}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send batch proofing replacement emails
 */
async function sendBatchProofingReplacementEmails(recipients, galleryDetails) {
  const results = {
    successful: 0,
    failed: 0,
    details: []
  };

  // Process emails in sequence to avoid overwhelming the SMTP server
  for (const recipient of recipients) {
    try {
      const result = await sendProofingReplacementEmail(recipient, galleryDetails);
      
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
      }
      
      results.details.push({
        email: recipient.email,
        ...result
      });

      // Add a small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error sending replacement email to ${recipient.email}:`, error);
      results.failed++;
      results.details.push({
        email: recipient.email,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Test email configuration
 */
async function testEmailConfiguration() {
  try {
    const transporter = initializeTransporter();
    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    return false;
  }
}

module.exports = {
  sendProofingApprovalEmail,
  sendBatchProofingApprovalEmails,
  sendProofingReplacementEmail,
  sendBatchProofingReplacementEmails,
  testEmailConfiguration
};