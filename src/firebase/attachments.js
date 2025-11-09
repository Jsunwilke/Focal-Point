import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { storage, firestore } from './config';
import { readCounter } from '../services/readCounter';

/**
 * Task Attachments Service
 * Handles file uploads, downloads, and deletions for task attachments
 * Follows cache-first architecture for optimal Firebase cost efficiency
 */
class AttachmentsService {
  constructor() {
    // 50MB max file size for task attachments
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.maxAttachmentsPerTask = 20;

    // Support all file types
    // Common file types for better UX (icon selection, preview capability)
    this.commonTypes = {
      images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      documents: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv'
      ],
      archives: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
      videos: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
      audio: ['audio/mpeg', 'audio/wav', 'audio/ogg']
    };
  }

  /**
   * Validate file before upload
   * @param {File} file - File to validate
   * @returns {Object} Validation result with file type info
   */
  validateFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds ${this.maxFileSize / 1024 / 1024}MB limit`);
    }

    // Determine file category
    const fileType = file.type;
    let category = 'other';

    if (this.commonTypes.images.includes(fileType)) {
      category = 'image';
    } else if (this.commonTypes.documents.includes(fileType)) {
      category = 'document';
    } else if (this.commonTypes.archives.includes(fileType)) {
      category = 'archive';
    } else if (this.commonTypes.videos.includes(fileType)) {
      category = 'video';
    } else if (this.commonTypes.audio.includes(fileType)) {
      category = 'audio';
    }

    return {
      isValid: true,
      category,
      canPreview: category === 'image' || fileType === 'application/pdf'
    };
  }

  /**
   * Upload file to Firebase Storage and create Firestore record
   * @param {File} file - File to upload
   * @param {string} taskId - Task ID
   * @param {string} organizationID - Organization ID
   * @param {string} userId - User ID uploading the file
   * @param {Function} onProgress - Progress callback (0-100)
   * @returns {Promise<Object>} Attachment metadata
   */
  async uploadAttachment(file, taskId, organizationID, userId, onProgress) {
    try {
      // Validate file
      const validation = this.validateFile(file);

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${timestamp}_${sanitizedFileName}`;

      // Storage path: task-attachments/{orgID}/{taskID}/{filename}
      const storagePath = `task-attachments/${organizationID}/${taskId}/${fileName}`;

      // Create storage reference
      const storageRef = ref(storage, storagePath);

      // Start upload with resumable upload for progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Track upload in ReadCounter (Storage operations)
      readCounter.recordRead('Storage Write', 'task-attachments', 'AttachmentsService', 1);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Calculate and report progress
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) {
              onProgress(Math.round(progress));
            }
          },
          (error) => {
            console.error('Upload error:', error);
            reject(new Error('Failed to upload file. Please try again.'));
          },
          async () => {
            // Upload completed successfully
            try {
              // Get download URL
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

              // Create Firestore record
              const attachmentData = {
                taskId,
                organizationID,
                uploadedBy: userId,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                category: validation.category,
                canPreview: validation.canPreview,
                storagePath,
                downloadURL,
                uploadedAt: Timestamp.now()
              };

              // Add to Firestore
              const docRef = await addDoc(
                collection(firestore, 'taskAttachments'),
                attachmentData
              );

              // Track Firestore write
              readCounter.recordRead('Firestore Write', 'taskAttachments', 'AttachmentsService', 1);

              resolve({
                id: docRef.id,
                ...attachmentData
              });
            } catch (error) {
              console.error('Error creating Firestore record:', error);
              // Try to clean up uploaded file
              try {
                await deleteObject(storageRef);
              } catch (cleanupError) {
                console.error('Error cleaning up uploaded file:', cleanupError);
              }
              reject(new Error('Failed to save attachment metadata. Please try again.'));
            }
          }
        );
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete attachment from both Storage and Firestore
   * @param {string} attachmentId - Attachment document ID
   * @param {string} storagePath - Storage path to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteAttachment(attachmentId, storagePath) {
    try {
      // Delete from Storage
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
      readCounter.recordRead('Storage Delete', 'task-attachments', 'AttachmentsService', 1);

      // Delete from Firestore
      await deleteDoc(doc(firestore, 'taskAttachments', attachmentId));
      readCounter.recordRead('Firestore Delete', 'taskAttachments', 'AttachmentsService', 1);

      return true;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      // Return true even if file doesn't exist in Storage (might have been manually deleted)
      if (error.code === 'storage/object-not-found') {
        // Still try to delete Firestore record
        try {
          await deleteDoc(doc(firestore, 'taskAttachments', attachmentId));
          readCounter.recordRead('Firestore Delete', 'taskAttachments', 'AttachmentsService', 1);
          return true;
        } catch (firestoreError) {
          console.error('Error deleting Firestore record:', firestoreError);
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Get all attachments for a task
   * NOTE: This should primarily be called through the cache service
   * @param {string} taskId - Task ID
   * @returns {Promise<Array>} Array of attachment objects
   */
  async getTaskAttachments(taskId) {
    try {
      const q = query(
        collection(firestore, 'taskAttachments'),
        where('taskId', '==', taskId),
        orderBy('uploadedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      readCounter.recordRead('Firestore Read', 'taskAttachments', 'AttachmentsService', snapshot.size);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting task attachments:', error);
      throw error;
    }
  }

  /**
   * Get download URL for an attachment
   * @param {string} storagePath - Storage path
   * @returns {Promise<string>} Download URL
   */
  async getAttachmentDownloadURL(storagePath) {
    try {
      const storageRef = ref(storage, storagePath);
      const downloadURL = await getDownloadURL(storageRef);
      readCounter.recordRead('Storage Read', 'task-attachments', 'AttachmentsService', 1);
      return downloadURL;
    } catch (error) {
      console.error('Error getting download URL:', error);
      throw new Error('Failed to get download URL. File may have been deleted.');
    }
  }

  /**
   * Format file size to human-readable string
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get icon emoji for file type
   * @param {string} category - File category
   * @param {string} fileType - MIME type
   * @returns {string} Icon emoji
   */
  getFileIcon(category, fileType) {
    if (category === 'image') return '🖼️';
    if (category === 'video') return '🎥';
    if (category === 'audio') return '🎵';
    if (category === 'archive') return '📦';

    // Document types
    if (fileType === 'application/pdf') return '📄';
    if (fileType.includes('word')) return '📝';
    if (fileType.includes('excel') || fileType.includes('sheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️';
    if (fileType === 'text/plain') return '📃';
    if (fileType === 'text/csv') return '📋';

    return '📎';
  }

  /**
   * Check if attachment count limit is reached for a task
   * @param {Array} attachments - Current attachments array
   * @returns {boolean} Whether limit is reached
   */
  isAttachmentLimitReached(attachments) {
    return attachments.length >= this.maxAttachmentsPerTask;
  }
}

export default new AttachmentsService();
