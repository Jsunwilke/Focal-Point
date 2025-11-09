import React, { useState } from 'react';
import { Download, Trash2, Eye, File, X } from 'lucide-react';
import attachmentsService from '../../firebase/attachments';
import './AttachmentList.css';

/**
 * AttachmentList Component
 * Displays list of task attachments with preview, download, and delete actions
 *
 * @param {Array} attachments - List of attachment objects
 * @param {Function} onDelete - Callback when attachment is deleted (attachmentId, storagePath)
 * @param {boolean} canDelete - Whether user can delete attachments
 * @param {boolean} compact - Use compact layout
 */
const AttachmentList = ({
  attachments = [],
  onDelete,
  canDelete = false,
  compact = false
}) => {
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleDownload = async (attachment) => {
    try {
      // Open download URL in new tab
      window.open(attachment.downloadURL, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file');
    }
  };

  const handlePreview = (attachment) => {
    if (attachment.canPreview) {
      setPreviewAttachment(attachment);
    } else {
      // If can't preview, just download
      handleDownload(attachment);
    }
  };

  const handleDelete = async (attachment) => {
    if (!window.confirm(`Are you sure you want to delete "${attachment.fileName}"?`)) {
      return;
    }

    setDeletingId(attachment.id);

    try {
      await onDelete(attachment.id, attachment.storagePath);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete attachment');
    } finally {
      setDeletingId(null);
    }
  };

  const closePreview = () => {
    setPreviewAttachment(null);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (attachments.length === 0) {
    return (
      <div className="attachment-list-empty">
        <File size={32} />
        <p>No attachments yet</p>
      </div>
    );
  }

  return (
    <>
      <div className={`attachment-list ${compact ? 'compact' : ''}`}>
        {attachments.map((attachment) => (
          <div key={attachment.id} className="attachment-item">
            <div className="attachment-icon">
              {attachmentsService.getFileIcon(attachment.category, attachment.fileType)}
            </div>

            <div className="attachment-info">
              <div className="attachment-name" title={attachment.fileName}>
                {attachment.fileName}
              </div>
              <div className="attachment-meta">
                <span className="attachment-size">
                  {attachmentsService.formatFileSize(attachment.fileSize)}
                </span>
                <span className="attachment-divider">•</span>
                <span className="attachment-date">
                  {formatDate(attachment.uploadedAt)}
                </span>
              </div>
            </div>

            <div className="attachment-actions">
              {attachment.canPreview && (
                <button
                  onClick={() => handlePreview(attachment)}
                  className="attachment-action-btn preview"
                  title="Preview"
                >
                  <Eye size={16} />
                </button>
              )}

              <button
                onClick={() => handleDownload(attachment)}
                className="attachment-action-btn download"
                title="Download"
              >
                <Download size={16} />
              </button>

              {canDelete && (
                <button
                  onClick={() => handleDelete(attachment)}
                  className="attachment-action-btn delete"
                  disabled={deletingId === attachment.id}
                  title="Delete"
                >
                  {deletingId === attachment.id ? (
                    <div className="spinner-small" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewAttachment && (
        <div className="attachment-preview-overlay" onClick={closePreview}>
          <div className="attachment-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="attachment-preview-header">
              <h3>{previewAttachment.fileName}</h3>
              <button onClick={closePreview} className="preview-close-btn">
                <X size={20} />
              </button>
            </div>

            <div className="attachment-preview-content">
              {previewAttachment.category === 'image' ? (
                <img
                  src={previewAttachment.downloadURL}
                  alt={previewAttachment.fileName}
                  className="preview-image"
                />
              ) : previewAttachment.fileType === 'application/pdf' ? (
                <iframe
                  src={previewAttachment.downloadURL}
                  title={previewAttachment.fileName}
                  className="preview-pdf"
                />
              ) : (
                <div className="preview-unsupported">
                  <File size={48} />
                  <p>Preview not available for this file type</p>
                  <button
                    onClick={() => handleDownload(previewAttachment)}
                    className="download-instead-btn"
                  >
                    <Download size={16} />
                    Download instead
                  </button>
                </div>
              )}
            </div>

            <div className="attachment-preview-footer">
              <button
                onClick={() => handleDownload(previewAttachment)}
                className="preview-download-btn"
              >
                <Download size={16} />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AttachmentList;
