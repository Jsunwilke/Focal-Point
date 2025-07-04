// src/services/photoUpload.js - Enhanced version with crop metadata
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "../firebase/config";

/**
 * Upload user's original photo and save crop settings
 * @param {string} userId - The user's ID
 * @param {File} originalFile - The original image file
 * @param {Object} cropSettings - Crop position and scale settings
 * @param {string} existingPhotoURL - URL of existing photo to delete (optional)
 * @returns {Promise<Object>} - Object with originalURL, croppedURL, and cropSettings
 */
export const uploadUserPhotoWithCrop = async (
  userId,
  originalFile,
  cropSettings,
  existingPhotoURL = null
) => {
  try {
    // Validate file
    if (!originalFile) {
      throw new Error("No file provided");
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(originalFile.type)) {
      throw new Error(
        "Invalid file type. Please upload a JPEG, PNG, or WebP image."
      );
    }

    const maxSize = 20 * 1024 * 1024; // 20MB (increased from 5MB)
    if (originalFile.size > maxSize) {
      throw new Error(
        "File size too large. Please upload an image smaller than 20MB."
      );
    }

    // Delete existing photos if they exist
    if (existingPhotoURL) {
      try {
        await deleteUserPhoto(existingPhotoURL);
      } catch (deleteError) {
        console.warn("Failed to delete existing photo:", deleteError);
      }
    }

    const timestamp = Date.now();
    const fileExtension = originalFile.name.split(".").pop().toLowerCase();

    // Upload original image
    const originalFileName = `original_${timestamp}.${fileExtension}`;
    const originalRef = ref(
      storage,
      `user-photos/${userId}/${originalFileName}`
    );
    const originalSnapshot = await uploadBytes(originalRef, originalFile);
    const originalURL = await getDownloadURL(originalSnapshot.ref);

    // Create cropped version
    const croppedFile = await applyCropToFile(originalFile, cropSettings);
    const croppedFileName = `avatar_${timestamp}.${fileExtension}`;
    const croppedRef = ref(storage, `user-photos/${userId}/${croppedFileName}`);
    const croppedSnapshot = await uploadBytes(croppedRef, croppedFile);
    const croppedURL = await getDownloadURL(croppedSnapshot.ref);

    console.log("Photos uploaded successfully:", { originalURL, croppedURL });

    return {
      originalURL,
      croppedURL,
      cropSettings: {
        scale: cropSettings.scale,
        position: cropSettings.position,
        containerSize: cropSettings.containerSize,
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    console.error("Error uploading photos:", error);
    throw new Error(`Failed to upload photos: ${error.message}`);
  }
};

/**
 * Apply crop settings to create the final avatar image
 * @param {File} originalFile - The original image file
 * @param {Object} cropSettings - Crop settings (scale, position, containerSize)
 * @returns {Promise<File>} - The cropped image file
 */
export const applyCropToFile = (originalFile, cropSettings) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Create output canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const outputSize = 300;

        canvas.width = outputSize;
        canvas.height = outputSize;

        const { scale, position, containerSize } = cropSettings;

        // Calculate scaled image dimensions
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        // Calculate position
        const centerX = containerSize / 2;
        const centerY = containerSize / 2;
        const imageX = centerX - scaledWidth / 2 + position.x;
        const imageY = centerY - scaledHeight / 2 + position.y;

        // Draw image on canvas
        ctx.drawImage(
          img,
          imageX * (outputSize / containerSize),
          imageY * (outputSize / containerSize),
          scaledWidth * (outputSize / containerSize),
          scaledHeight * (outputSize / containerSize)
        );

        // Apply circular mask
        ctx.globalCompositeOperation = "destination-in";
        ctx.beginPath();
        ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, 2 * Math.PI);
        ctx.fill();

        // Convert to blob and create file
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const croppedFile = new File([blob], originalFile.name, {
                type: originalFile.type,
                lastModified: Date.now(),
              });
              resolve(croppedFile);
            } else {
              reject(new Error("Failed to create cropped image"));
            }
          },
          originalFile.type,
          0.9
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(originalFile);
  });
};

/**
 * Re-crop an existing photo with new settings
 * @param {string} userId - The user's ID
 * @param {string} originalURL - URL of the original image
 * @param {Object} newCropSettings - New crop settings
 * @param {string} oldCroppedURL - URL of old cropped image to delete
 * @returns {Promise<string>} - New cropped image URL
 */
export const recropUserPhoto = async (
  userId,
  originalURL,
  newCropSettings,
  oldCroppedURL
) => {
  try {
    // Download original image
    const response = await fetch(originalURL);
    const blob = await response.blob();
    const originalFile = new File([blob], "original.jpg", { type: blob.type });

    // Delete old cropped image
    if (oldCroppedURL) {
      await deleteUserPhoto(oldCroppedURL);
    }

    // Create new cropped version
    const croppedFile = await applyCropToFile(originalFile, newCropSettings);
    const timestamp = Date.now();
    const croppedFileName = `avatar_${timestamp}.jpg`;
    const croppedRef = ref(storage, `user-photos/${userId}/${croppedFileName}`);
    const croppedSnapshot = await uploadBytes(croppedRef, croppedFile);
    const newCroppedURL = await getDownloadURL(croppedSnapshot.ref);

    console.log("Photo re-cropped successfully:", newCroppedURL);
    return newCroppedURL;
  } catch (error) {
    console.error("Error re-cropping photo:", error);
    throw new Error(`Failed to re-crop photo: ${error.message}`);
  }
};

// Keep existing functions for compatibility
export const uploadUserPhoto = async (
  userId,
  file,
  existingPhotoURL = null
) => {
  // Default crop settings for backward compatibility
  const defaultCropSettings = {
    scale: 1,
    position: { x: 0, y: 0 },
    containerSize: 300,
  };

  const result = await uploadUserPhotoWithCrop(
    userId,
    file,
    defaultCropSettings,
    existingPhotoURL
  );
  return result.croppedURL; // Return only cropped URL for compatibility
};

export const deleteUserPhoto = async (photoURL) => {
  try {
    if (!photoURL) return;

    const url = new URL(photoURL);
    const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);

    if (!pathMatch) {
      throw new Error("Invalid photo URL format");
    }

    const filePath = decodeURIComponent(pathMatch[1]);
    const photoRef = ref(storage, filePath);

    console.log("Deleting photo:", filePath);
    await deleteObject(photoRef);
    console.log("Photo deleted successfully");
  } catch (error) {
    console.error("Error deleting photo:", error);
    throw new Error(`Failed to delete photo: ${error.message}`);
  }
};

export const resizeImage = (
  file,
  maxWidth = 300,
  maxHeight = 300,
  quality = 0.8
) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

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
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to process image"));
            return;
          }

          const processedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });

          resolve(processedFile);
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(file);
  });
};

export const generatePlaceholderAvatar = (initials, size = 300) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = size;
  canvas.height = size;

  const colors = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#06B6D4",
    "#F97316",
    "#84CC16",
  ];

  const colorIndex = initials.charCodeAt(0) % colors.length;
  const backgroundColor = colors[colorIndex];

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "white";
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials, size / 2, size / 2);

  return canvas.toDataURL();
};
