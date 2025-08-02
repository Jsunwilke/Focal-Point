// src/utils/thumbnailGenerator.js

/**
 * Generate a fast thumbnail for large image files
 * Optimized for 40MB+ banner images
 */

// Check for OffscreenCanvas support
const hasOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';

/**
 * Generate thumbnail using OffscreenCanvas (fastest method)
 * @param {File} file - Image file
 * @param {number} maxSize - Maximum dimension (default 200px)
 * @returns {Promise<string>} Object URL of thumbnail
 */
const generateOffscreenThumbnail = async (file, maxSize = 200) => {
  try {
    // Create bitmap with resize for faster processing
    const bitmap = await createImageBitmap(file, {
      resizeWidth: maxSize,
      resizeHeight: maxSize,
      resizeQuality: 'low' // Use fast bilinear scaling
    });
    
    // Calculate actual dimensions maintaining aspect ratio
    const scale = maxSize / Math.max(bitmap.width, bitmap.height);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    
    // Create offscreen canvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Draw resized image
    ctx.drawImage(bitmap, 0, 0, width, height);
    
    // Clean up bitmap
    bitmap.close();
    
    // Convert to blob with low quality for speed
    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: 0.7
    });
    
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn('OffscreenCanvas thumbnail generation failed:', error);
    throw error;
  }
};

/**
 * Generate thumbnail using regular Canvas (fallback)
 * @param {File} file - Image file
 * @param {number} maxSize - Maximum dimension
 * @returns {Promise<string>} Object URL of thumbnail
 */
const generateCanvasThumbnail = async (file, maxSize = 200) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      try {
        // Calculate dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        
        // Use lower quality settings for speed
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'low';
        
        // Draw image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Clean up
        URL.revokeObjectURL(objectUrl);
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(URL.createObjectURL(blob));
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          },
          'image/jpeg',
          0.7
        );
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    
    img.src = objectUrl;
  });
};

/**
 * Generate thumbnail with automatic method selection
 * @param {File} file - Image file
 * @param {Object} options - Options
 * @returns {Promise<string>} Object URL of thumbnail
 */
export const generateThumbnail = async (file, options = {}) => {
  const { maxSize = 200 } = options;
  
  // Validate input
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Invalid image file');
  }
  
  // Use OffscreenCanvas if available
  if (hasOffscreenCanvas) {
    try {
      return await generateOffscreenThumbnail(file, maxSize);
    } catch (error) {
      console.warn('Falling back to regular canvas:', error);
    }
  }
  
  // Fallback to regular canvas
  return generateCanvasThumbnail(file, maxSize);
};

/**
 * Process multiple files with concurrency limit
 * @param {File[]} files - Array of image files
 * @param {Function} onProgress - Progress callback
 * @param {number} concurrency - Max concurrent processing
 * @returns {Promise<Map>} Map of file to thumbnail URL
 */
export const generateThumbnails = async (files, onProgress, concurrency = 3) => {
  const results = new Map();
  let completed = 0;
  
  const updateProgress = () => {
    if (onProgress) {
      onProgress({
        completed,
        total: files.length,
        percentage: (completed / files.length) * 100
      });
    }
  };
  
  // Process in chunks
  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);
    const promises = chunk.map(async (file) => {
      try {
        const thumbnail = await generateThumbnail(file);
        results.set(file, thumbnail);
      } catch (error) {
        console.error(`Failed to generate thumbnail for ${file.name}:`, error);
        results.set(file, null); // Store null for failed thumbnails
      }
      completed++;
      updateProgress();
    });
    
    await Promise.all(promises);
  }
  
  return results;
};

/**
 * Clean up thumbnail URLs
 * @param {Map|Array|string} thumbnails - Thumbnail URLs to revoke
 */
export const cleanupThumbnails = (thumbnails) => {
  if (thumbnails instanceof Map) {
    thumbnails.forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });
  } else if (Array.isArray(thumbnails)) {
    thumbnails.forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });
  } else if (typeof thumbnails === 'string') {
    URL.revokeObjectURL(thumbnails);
  }
};