// functions/templates/proofingReplacementEmail.js

/**
 * Generate HTML template for proofing replacement notification
 */
function getProofingReplacementTemplate(data) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Image Versions Uploaded</title>
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
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
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
        .image-list {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
        }
        .image-list h4 {
            margin: 0 0 10px;
            color: #374151;
            font-size: 14px;
            font-weight: 600;
        }
        .image-item {
            padding: 8px 0;
            color: #6b7280;
            font-size: 14px;
            border-bottom: 1px solid #e5e7eb;
        }
        .image-item:last-child {
            border-bottom: none;
        }
        .cta-section {
            text-align: center;
            margin: 35px 0;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: #ffffff;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 4px 14px 0 rgba(245, 158, 11, 0.4);
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px 0 rgba(245, 158, 11, 0.5);
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
            color: #f59e0b;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        .upload-icon {
            display: inline-block;
            width: 60px;
            height: 60px;
            background-color: #f59e0b;
            border-radius: 50%;
            margin-bottom: 20px;
            position: relative;
        }
        .upload-icon::after {
            content: "↑";
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
            <div class="upload-icon"></div>
            <h1>New Versions Uploaded</h1>
            <p>Replacement images are ready for your review</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                Hi ${data.recipientName},
            </div>
            
            <p>New versions of images you previously denied have been uploaded and are ready for your review:</p>
            
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
                    <div class="info-label">Replaced Images:</div>
                    <div class="info-value">${data.replacedCount} photo(s)</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Uploaded By:</div>
                    <div class="info-value">${data.uploadedBy}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Upload Date:</div>
                    <div class="info-value">${data.uploadDate}</div>
                </div>
            </div>
            
            ${data.replacedImages && data.replacedImages.length > 0 ? `
            <div class="image-list">
                <h4>Replaced Images:</h4>
                ${data.replacedImages.map(image => `
                <div class="image-item">${image.filename} (now v${image.newVersion})</div>
                `).join('')}
            </div>
            ` : ''}
            
            <p>The photographer has addressed your feedback and uploaded new versions. Please review the updated images at your earliest convenience.</p>
            
            <div class="cta-section">
                <a href="${data.galleryLink}" class="cta-button">Review New Versions</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                <strong>Note:</strong> This is an automated notification. You're receiving this because you denied images in this gallery and new versions have been uploaded.
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
 * Generate plain text version of the replacement email
 */
function getProofingReplacementTextTemplate(data) {
  return `
New Image Versions Uploaded

Hi ${data.recipientName},

New versions of images you previously denied have been uploaded and are ready for your review:

Gallery Details:
----------------
Gallery Name: ${data.galleryName}
School: ${data.schoolName}
Replaced Images: ${data.replacedCount} photo(s)
Uploaded By: ${data.uploadedBy}
Upload Date: ${data.uploadDate}

${data.replacedImages && data.replacedImages.length > 0 ? `
Replaced Images:
${data.replacedImages.map(image => `- ${image.filename} (now v${image.newVersion})`).join('\n')}
` : ''}

The photographer has addressed your feedback and uploaded new versions. Please review the updated images at your earliest convenience.

Review New Versions: ${data.galleryLink}

Note: This is an automated notification. You're receiving this because you denied images in this gallery and new versions have been uploaded.

---
© ${new Date().getFullYear()} Focal Point Studio. All rights reserved.
Professional Photography Management
  `;
}

module.exports = {
  getProofingReplacementTemplate,
  getProofingReplacementTextTemplate
};