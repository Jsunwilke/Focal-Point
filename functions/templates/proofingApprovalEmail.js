// functions/templates/proofingApprovalEmail.js

/**
 * Generate HTML template for proofing approval notification
 */
function getProofingApprovalTemplate(data) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proofing Gallery Approved</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f7f7f7;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .header p {
            margin: 10px 0 0;
            font-size: 16px;
            opacity: 0.95;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #111827;
        }
        .info-box {
            background-color: #f9fafb;
            border-left: 4px solid #10b981;
            padding: 20px;
            margin: 25px 0;
            border-radius: 4px;
        }
        .info-row {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .info-label {
            font-weight: 600;
            color: #4b5563;
            width: 140px;
            flex-shrink: 0;
        }
        .info-value {
            color: #111827;
            flex: 1;
        }
        .cta-section {
            text-align: center;
            margin: 35px 0;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.4);
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px 0 rgba(102, 126, 234, 0.5);
        }
        .footer {
            background-color: #f9fafb;
            padding: 30px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            border-top: 1px solid #e5e7eb;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        .success-icon {
            display: inline-block;
            width: 60px;
            height: 60px;
            background-color: #10b981;
            border-radius: 50%;
            margin-bottom: 20px;
            position: relative;
        }
        .success-icon::after {
            content: "✓";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 32px;
            font-weight: bold;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            .info-row {
                flex-direction: column;
            }
            .info-label {
                width: 100%;
                margin-bottom: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-icon"></div>
            <h1>Gallery Approved!</h1>
            <p>A proofing gallery has been fully approved</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                Hi ${data.recipientName},
            </div>
            
            <p>Great news! The following proofing gallery has been fully approved and is ready for production:</p>
            
            <div class="info-box">
                <div class="info-row">
                    <div class="info-label">Gallery Name:</div>
                    <div class="info-value"><strong>${data.galleryName}</strong></div>
                </div>
                <div class="info-row">
                    <div class="info-label">School:</div>
                    <div class="info-value">${data.schoolName}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Total Images:</div>
                    <div class="info-value">${data.imageCount} photos</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Approved By:</div>
                    <div class="info-value">${data.approvedBy}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Approval Date:</div>
                    <div class="info-value">${data.approvedDate}</div>
                </div>
            </div>
            
            <p>All images in this gallery have been reviewed and approved. You can now proceed with the next steps in your workflow.</p>
            
            <div class="cta-section">
                <a href="${data.galleryLink}" class="cta-button">View Gallery</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                <strong>Note:</strong> This is an automated notification. You're receiving this because you've opted in to receive proofing approval notifications in your account settings.
            </p>
        </div>
        
        <div class="footer">
            <p>
                © ${new Date().getFullYear()} Focal Point Studio. All rights reserved.
            </p>
            <p style="margin-top: 15px;">
                <a href="https://myfocalpoint.io">Visit Dashboard</a> • 
                <a href="https://myfocalpoint.io/settings">Manage Notifications</a>
            </p>
            <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
                Focal Point Studio • Professional Photography Management
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

/**
 * Generate plain text version of the email
 */
function getProofingApprovalTextTemplate(data) {
  return `
Gallery Approved!

Hi ${data.recipientName},

Great news! The following proofing gallery has been fully approved and is ready for production:

Gallery Details:
----------------
Gallery Name: ${data.galleryName}
School: ${data.schoolName}
Total Images: ${data.imageCount} photos
Approved By: ${data.approvedBy}
Approval Date: ${data.approvedDate}

All images in this gallery have been reviewed and approved. You can now proceed with the next steps in your workflow.

View Gallery: ${data.galleryLink}

Note: This is an automated notification. You're receiving this because you've opted in to receive proofing approval notifications in your account settings.

---
© ${new Date().getFullYear()} Focal Point Studio. All rights reserved.
Professional Photography Management
  `;
}

module.exports = {
  getProofingApprovalTemplate,
  getProofingApprovalTextTemplate
};