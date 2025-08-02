// src/utils/imageCompression.js

/**
 * Compress an image file before upload
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width (default: 2048)
 * @param {number} options.maxHeight - Maximum height (default: 2048)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.85)
 * @returns {Promise<File>} - The compressed image file
 */
export const compressImage = (file, options = {}) => {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 0.85
  } = options;

  return new Promise((resolve, reject) => {
    // Skip compression for non-image files or small files
    if (!file.type.startsWith('image/') || file.size < 100 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Create a new file with the compressed blob
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              
              // Only use compressed version if it's smaller
              if (compressedFile.size < file.size) {
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            } else {
              resolve(file);
            }
          },
          file.type,
          quality
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
 * Compress multiple image files
 * @param {File[]} files - Array of image files
 * @param {Object} options - Compression options
 * @returns {Promise<File[]>} - Array of compressed files
 */
export const compressImages = async (files, options = {}) => {
  const compressionPromises = files.map(file => 
    compressImage(file, options).catch(error => {
      console.warn(`Failed to compress ${file.name}:`, error);
      return file; // Return original file if compression fails
    })
  );
  
  return Promise.all(compressionPromises);
};