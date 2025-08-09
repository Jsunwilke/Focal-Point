// src/services/emailService.js
// Email service for sending notifications
// Using EmailJS as a frontend email solution

// EmailJS configuration
// Note: These should ideally be in environment variables
const EMAILJS_SERVICE_ID = 'service_focal_point'; // Replace with your EmailJS service ID
const EMAILJS_TEMPLATE_ID = 'template_proofing_approval'; // Replace with your EmailJS template ID
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY'; // Replace with your EmailJS public key

// Initialize EmailJS (call this once when the app loads)
export const initEmailService = () => {
  // Check if emailjs is available
  if (typeof window !== 'undefined' && window.emailjs) {
    window.emailjs.init(EMAILJS_PUBLIC_KEY);
    return true;
  }
  console.warn('EmailJS not loaded. Email notifications will not work.');
  return false;
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

// Send batch notifications to multiple recipients
export const sendBatchProofingApprovalEmails = async (recipients, galleryDetails) => {
  const results = [];
  
  // Send emails one by one to avoid rate limiting
  for (const recipient of recipients) {
    const result = await sendProofingApprovalEmail(
      recipient.email,
      `${recipient.firstName} ${recipient.lastName}`,
      galleryDetails
    );
    
    results.push({
      recipient: recipient.email,
      ...result
    });
    
    // Add a small delay between emails to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
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