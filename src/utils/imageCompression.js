// src/utils/imageCompression.js

/**
 * Compress an image file before upload
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width (default: 3000)
 * @param {number} options.maxHeight - Maximum height (default: 3000)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.92)
 * @param {boolean} options.skipCompression - Skip compression entirely
 * @param {function} options.onProgress - Progress callback
 * @returns {Promise<File>} - The compressed image file
 */
export const compressImage = (file, options = {}) => {
  const {
    maxWidth = 3000,
    maxHeight = 3000,
    quality = 0.92,
    skipCompression = false,
    onProgress
  } = options;

  return new Promise((resolve, reject) => {
    // Skip compression if requested or for non-image files
    if (skipCompression || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    // Skip compression for small files (under 1MB) to preserve quality
    if (file.size < 1024 * 1024) {
      resolve(file);
      return;
    }

    if (onProgress) onProgress({ stage: 'reading', progress: 0 });
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      if (onProgress) onProgress({ stage: 'processing', progress: 30 });
      
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        if (onProgress) onProgress({ stage: 'resizing', progress: 50 });
        
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);
        
        if (onProgress) onProgress({ stage: 'compressing', progress: 70 });
        
        // Use appropriate format and quality
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const outputQuality = file.type === 'image/png' ? undefined : quality;
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              if (onProgress) onProgress({ stage: 'finalizing', progress: 90 });
              
              // Create a new file with the compressed blob
              const compressedFile = new File([blob], file.name, {
                type: outputType,
                lastModified: Date.now(),
              });
              
              // Only use compressed version if it's smaller and saved at least 10%
              const savings = (file.size - compressedFile.size) / file.size;
              if (compressedFile.size < file.size && savings > 0.1) {
                if (onProgress) onProgress({ stage: 'complete', progress: 100, savings });
                resolve(compressedFile);
              } else {
                if (onProgress) onProgress({ stage: 'complete', progress: 100, savings: 0 });
                resolve(file);
              }
            } else {
              resolve(file);
            }
          },
          outputType,
          outputQuality
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
  });
};

/**
 * Compress multiple image files with parallel processing
 * @param {File[]} files - Array of image files
 * @param {Object} options - Compression options
 * @param {function} options.onOverallProgress - Overall progress callback
 * @param {number} options.concurrency - Number of parallel compressions (default: 3)
 * @returns {Promise<File[]>} - Array of compressed files
 */
export const compressImages = async (files, options = {}) => {
  const {
    onOverallProgress,
    concurrency = 3,
    ...compressionOptions
  } = options;
  
  const results = [];
  const fileProgress = new Map();
  let completedCount = 0;
  
  // Initialize progress tracking
  files.forEach((file, index) => {
    fileProgress.set(index, 0);
  });
  
  // Helper to update overall progress
  const updateOverallProgress = () => {
    if (onOverallProgress) {
      const totalProgress = Array.from(fileProgress.values()).reduce((sum, p) => sum + p, 0) / files.length;
      onOverallProgress({
        percentage: totalProgress,
        completed: completedCount,
        total: files.length,
        stage: completedCount < files.length ? 'compressing' : 'complete'
      });
    }
  };
  
  // Process files in chunks for better performance
  const processFile = async (file, index) => {
    try {
      const compressedFile = await compressImage(file, {
        ...compressionOptions,
        onProgress: (progress) => {
          fileProgress.set(index, progress.progress);
          updateOverallProgress();
        }
      });
      
      completedCount++;
      updateOverallProgress();
      
      return compressedFile;
    } catch (error) {
      console.warn(`Failed to compress ${file.name}:`, error);
      completedCount++;
      fileProgress.set(index, 100);
      updateOverallProgress();
      return file; // Return original file if compression fails
    }
  };
  
  // Process files with concurrency limit
  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);
    const chunkPromises = chunk.map((file, chunkIndex) => 
      processFile(file, i + chunkIndex)
    );
    
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }
  
  return results;
};