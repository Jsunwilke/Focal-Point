// src/services/videoUploadService.js
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';
import { secureLogger } from './secureLogger';

/**
 * Video Upload Service for Workflow Tutorial Videos
 *
 * Handles uploading tutorial videos to Firebase Storage
 * Supports progress tracking, persistence, and file validation
 */

// Allowed video formats
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/avi', 'video/webm', 'video/x-msvideo'];
const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.avi', '.webm'];

// Max file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Retry configuration
const MAX_UPLOAD_RETRIES = 3;
const UPLOAD_RETRY_BASE_DELAY = 1000; // 1 second base delay

// Upload persistence configuration
const UPLOAD_PROGRESS_PREFIX = 'focal_video_upload_';
const UPLOAD_PROGRESS_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Upload Progress Persistence Manager
 * Stores upload progress in localStorage for resumability
 */
class UploadProgressManager {
  /**
   * Get storage key for upload
   */
  getKey(uploadId) {
    return `${UPLOAD_PROGRESS_PREFIX}${uploadId}`;
  }

  /**
   * Save upload progress to localStorage
   */
  saveProgress(uploadId, progressData) {
    try {
      const data = {
        ...progressData,
        lastUpdated: Date.now()
      };
      localStorage.setItem(this.getKey(uploadId), JSON.stringify(data));
      secureLogger.debug('Upload progress saved', { uploadId, progress: progressData.progress });
    } catch (error) {
      secureLogger.warn('Failed to save upload progress', { error: error.message, uploadId });
    }
  }

  /**
   * Load upload progress from localStorage
   */
  loadProgress(uploadId) {
    try {
      const data = localStorage.getItem(this.getKey(uploadId));
      if (!data) return null;

      const parsed = JSON.parse(data);

      // Check if progress data is stale (older than TTL)
      if (Date.now() - parsed.lastUpdated > UPLOAD_PROGRESS_TTL) {
        this.clearProgress(uploadId);
        return null;
      }

      return parsed;
    } catch (error) {
      secureLogger.warn('Failed to load upload progress', { error: error.message, uploadId });
      return null;
    }
  }

  /**
   * Clear upload progress from localStorage
   */
  clearProgress(uploadId) {
    try {
      localStorage.removeItem(this.getKey(uploadId));
      secureLogger.debug('Upload progress cleared', { uploadId });
    } catch (error) {
      secureLogger.warn('Failed to clear upload progress', { error: error.message, uploadId });
    }
  }

  /**
   * Clean up old/stale upload progress records
   */
  cleanupStaleProgress() {
    try {
      const keys = Object.keys(localStorage);
      const uploadKeys = keys.filter(key => key.startsWith(UPLOAD_PROGRESS_PREFIX));

      let cleanedCount = 0;
      uploadKeys.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (Date.now() - data.lastUpdated > UPLOAD_PROGRESS_TTL) {
            localStorage.removeItem(key);
            cleanedCount++;
          }
        } catch (error) {
          // Invalid data - remove it
          localStorage.removeItem(key);
          cleanedCount++;
        }
      });

      if (cleanedCount > 0) {
        secureLogger.info('Cleaned up stale upload progress', { count: cleanedCount });
      }
    } catch (error) {
      secureLogger.warn('Failed to cleanup stale progress', { error: error.message });
    }
  }

  /**
   * Get all active uploads
   */
  getActiveUploads() {
    try {
      const keys = Object.keys(localStorage);
      const uploadKeys = keys.filter(key => key.startsWith(UPLOAD_PROGRESS_PREFIX));

      return uploadKeys
        .map(key => {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (Date.now() - data.lastUpdated <= UPLOAD_PROGRESS_TTL) {
              return { uploadId: key.replace(UPLOAD_PROGRESS_PREFIX, ''), ...data };
            }
          } catch (error) {
            return null;
          }
          return null;
        })
        .filter(Boolean);
    } catch (error) {
      secureLogger.warn('Failed to get active uploads', { error: error.message });
      return [];
    }
  }
}

const progressManager = new UploadProgressManager();

/**
 * Perform a single upload attempt with progress persistence
 * @param {string} uploadId - Unique upload identifier
 * @param {string} storagePath - Firebase Storage path
 * @param {File} file - Video file to upload
 * @param {Function} onProgress - Progress callback
 * @param {Object} metadata - Upload metadata for persistence
 * @param {Function} onUploadTaskCreated - Optional callback to receive the upload task for cancellation
 * @returns {Promise<string>} Download URL
 */
const performUploadAttempt = (uploadId, storagePath, file, onProgress, metadata = {}, onUploadTaskCreated = null) => {
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  // Provide the upload task to the caller for potential cancellation
  if (onUploadTaskCreated) {
    onUploadTaskCreated(uploadTask);
  }

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

        // Persist progress to localStorage
        progressManager.saveProgress(uploadId, {
          progress: Math.round(progress),
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          storagePath,
          fileName: file.name,
          fileSize: file.size,
          state: snapshot.state,
          ...metadata
        });

        // Call progress callback
        if (onProgress) {
          onProgress(Math.round(progress), snapshot.bytesTransferred, snapshot.totalBytes);
        }

        secureLogger.debug('Upload progress', {
          uploadId,
          progress: `${progress.toFixed(2)}%`,
          transferred: snapshot.bytesTransferred,
          total: snapshot.totalBytes
        });
      },
      (error) => {
        // Persist error state
        progressManager.saveProgress(uploadId, {
          progress: 0,
          state: 'error',
          error: error.message,
          errorCode: error.code,
          storagePath,
          fileName: file.name,
          ...metadata
        });

        secureLogger.error('Upload attempt failed', {
          uploadId,
          error: error.message,
          code: error.code,
          storagePath
        });
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Clear progress after successful upload
          progressManager.clearProgress(uploadId);

          secureLogger.info('Upload attempt completed', { uploadId, downloadURL, storagePath });
          resolve(downloadURL);
        } catch (error) {
          secureLogger.error('Failed to get download URL', { uploadId, error: error.message });
          reject(error);
        }
      }
    );
  });
};

/**
 * Retry upload with exponential backoff
 * @param {string} uploadId - Unique upload identifier
 * @param {string} storagePath - Firebase Storage path
 * @param {File} file - Video file to upload
 * @param {Function} onProgress - Progress callback
 * @param {Object} metadata - Upload metadata
 * @param {Function} onUploadTaskCreated - Optional callback to receive upload task
 * @returns {Promise<string>} Download URL
 */
const retryVideoUpload = async (uploadId, storagePath, file, onProgress, metadata = {}, onUploadTaskCreated = null) => {
  let lastError;

  for (let attempt = 0; attempt < MAX_UPLOAD_RETRIES; attempt++) {
    try {
      secureLogger.debug(`Upload attempt ${attempt + 1}/${MAX_UPLOAD_RETRIES}`, { uploadId, storagePath });

      // Reset progress to 0 on retry attempts
      if (attempt > 0 && onProgress) {
        onProgress(0, 0, file.size);
      }

      const downloadURL = await performUploadAttempt(uploadId, storagePath, file, onProgress, {
        ...metadata,
        attempt: attempt + 1,
        maxAttempts: MAX_UPLOAD_RETRIES
      }, onUploadTaskCreated);

      // Success - return the download URL
      if (attempt > 0) {
        secureLogger.info(`Upload succeeded on retry attempt ${attempt + 1}`, { uploadId, storagePath });
      }
      return downloadURL;

    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      const nonRetriableErrors = ['storage/unauthorized', 'storage/quota-exceeded', 'storage/invalid-format'];
      if (nonRetriableErrors.includes(error.code)) {
        secureLogger.error('Non-retriable error encountered', { uploadId, code: error.code });
        throw error;
      }

      // If we have more retries, wait before retrying
      if (attempt < MAX_UPLOAD_RETRIES - 1) {
        const delay = UPLOAD_RETRY_BASE_DELAY * Math.pow(2, attempt);
        secureLogger.debug(`Retrying upload in ${delay}ms`, { uploadId, attempt: attempt + 1 });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  secureLogger.error(`Upload failed after ${MAX_UPLOAD_RETRIES} attempts`, {
    uploadId,
    storagePath,
    error: lastError.message
  });
  throw lastError;
};

/**
 * Validate video file before upload
 * @param {File} file - The file to validate
 * @returns {Object} { valid: boolean, error: string }
 */
export const validateVideoFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file type
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!ALLOWED_VIDEO_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  return { valid: true, error: null };
};

/**
 * Upload a tutorial video to Firebase Storage with progress persistence
 * @param {string} organizationID - Organization ID
 * @param {string} templateID - Workflow template ID
 * @param {string} stepID - Workflow step ID
 * @param {File} file - Video file to upload
 * @param {Function} onProgress - Progress callback (receives progress%, bytesTransferred, totalBytes)
 * @param {Function} onUploadTaskCreated - Optional callback to receive upload task for cancellation
 * @returns {Promise<string>} Download URL of uploaded video
 */
export const uploadStepVideo = async (
  organizationID,
  templateID,
  stepID,
  file,
  onProgress = null,
  onUploadTaskCreated = null
) => {
  try {
    // Clean up stale uploads on each new upload
    progressManager.cleanupStaleProgress();

    // Validate file
    const validation = validateVideoFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Generate unique filename with timestamp to avoid conflicts
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedFilename}`;

    // Create storage path
    const storagePath = `workflow-videos/${organizationID}/${templateID}/${stepID}/${filename}`;

    // Generate unique upload ID for progress tracking
    const uploadId = `${organizationID}_${templateID}_${stepID}_${timestamp}`;

    secureLogger.info('Starting video upload', {
      uploadId,
      organizationID,
      templateID,
      stepID,
      filename,
      size: file.size
    });

    // Upload with retry logic and progress persistence
    const downloadURL = await retryVideoUpload(uploadId, storagePath, file, onProgress, {
      organizationID,
      templateID,
      stepID,
      startTime: Date.now()
    }, onUploadTaskCreated);

    secureLogger.info('Video upload completed', {
      uploadId,
      downloadURL,
      storagePath
    });

    return downloadURL;

  } catch (error) {
    secureLogger.error('Error in uploadStepVideo', {
      error: error.message,
      organizationID,
      templateID,
      stepID
    });
    throw error;
  }
};

/**
 * Delete a tutorial video from Firebase Storage
 * @param {string} videoURL - Full download URL of the video
 * @returns {Promise<void>}
 */
export const deleteStepVideo = async (videoURL) => {
  try {
    if (!videoURL || !videoURL.includes('firebasestorage.googleapis.com')) {
      throw new Error('Invalid Firebase Storage URL');
    }

    // Extract storage path from download URL
    const url = new URL(videoURL);
    const pathMatch = url.pathname.match(/\/o\/(.+)\?/);

    if (!pathMatch) {
      throw new Error('Could not extract storage path from URL');
    }

    const storagePath = decodeURIComponent(pathMatch[1]);
    const storageRef = ref(storage, storagePath);

    await deleteObject(storageRef);

    secureLogger.info('Video deleted successfully', { storagePath });
  } catch (error) {
    secureLogger.error('Error deleting video', {
      error: error.message,
      videoURL
    });
    // Don't throw - deletion failure shouldn't block other operations
  }
};

/**
 * Get file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Get all active uploads (for displaying progress)
 * @returns {Array} Array of active upload progress data
 */
export const getActiveUploads = () => {
  return progressManager.getActiveUploads();
};

/**
 * Get progress for a specific upload
 * @param {string} uploadId - Upload identifier
 * @returns {Object|null} Upload progress data or null
 */
export const getUploadProgress = (uploadId) => {
  return progressManager.loadProgress(uploadId);
};

/**
 * Clear progress for a specific upload
 * @param {string} uploadId - Upload identifier
 */
export const clearUploadProgress = (uploadId) => {
  progressManager.clearProgress(uploadId);
};

/**
 * Clean up all stale upload progress records
 */
export const cleanupStaleUploads = () => {
  progressManager.cleanupStaleProgress();
};

export default {
  uploadStepVideo,
  deleteStepVideo,
  validateVideoFile,
  formatFileSize,
  getActiveUploads,
  getUploadProgress,
  clearUploadProgress,
  cleanupStaleUploads
};
