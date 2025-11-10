// src/services/videoUploadService.js
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';

/**
 * Video Upload Service for Workflow Tutorial Videos
 *
 * Handles uploading tutorial videos to Firebase Storage
 * Supports progress tracking and file validation
 */

// Allowed video formats
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/avi', 'video/webm', 'video/x-msvideo'];
const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.avi', '.webm'];

// Max file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

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
 * Upload a tutorial video to Firebase Storage
 * @param {string} organizationID - Organization ID
 * @param {string} templateID - Workflow template ID
 * @param {string} stepID - Workflow step ID
 * @param {File} file - Video file to upload
 * @param {Function} onProgress - Progress callback (receives 0-100)
 * @returns {Promise<string>} Download URL of uploaded video
 */
export const uploadStepVideo = async (
  organizationID,
  templateID,
  stepID,
  file,
  onProgress = null
) => {
  try {
    // Validate file
    const validation = validateVideoFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Generate unique filename with timestamp to avoid conflicts
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedFilename}`;

    // Create storage reference
    const storagePath = `workflow-videos/${organizationID}/${templateID}/${stepID}/${filename}`;
    const storageRef = ref(storage, storagePath);

    console.log('Starting video upload:', {
      organizationID,
      templateID,
      stepID,
      filename,
      size: file.size
    });

    // Upload with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Calculate progress percentage
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

          if (onProgress) {
            onProgress(Math.round(progress));
          }

          console.log('Upload progress:', {
            progress: `${progress.toFixed(2)}%`,
            transferred: snapshot.bytesTransferred,
            total: snapshot.totalBytes
          });
        },
        (error) => {
          console.error('Video upload failed:', {
            error: error.message,
            code: error.code,
            storagePath
          });
          reject(error);
        },
        async () => {
          // Upload completed successfully, get download URL
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            console.log('Video upload completed:', {
              downloadURL,
              storagePath
            });

            resolve(downloadURL);
          } catch (error) {
            console.error('Failed to get download URL:', {
              error: error.message
            });
            reject(error);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error in uploadStepVideo:', {
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

    console.log('Video deleted successfully:', { storagePath });
  } catch (error) {
    console.error('Error deleting video:', {
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

export default {
  uploadStepVideo,
  deleteStepVideo,
  validateVideoFile,
  formatFileSize
};
