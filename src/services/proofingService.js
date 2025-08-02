// src/services/proofingService.js
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  increment
} from "firebase/firestore";
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { firestore, storage } from "../firebase/config";
import { readCounter } from "./readCounter";
import { proofingCacheService } from "./proofingCacheService";
import bcrypt from "bcryptjs";

// Helper to hash passwords
const hashPassword = async (password) => {
  if (!password) return null;
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Helper to verify passwords
export const verifyPassword = async (password, hashedPassword) => {
  if (!hashedPassword || !password) return false;
  return bcrypt.compare(password, hashedPassword);
};

// Create a new gallery
export const createGallery = async (galleryData) => {
  try {
    const { password, ...data } = galleryData;
    
    // Hash password if provided
    const hashedPassword = await hashPassword(password);
    
    const galleryRef = await addDoc(collection(firestore, "proofGalleries"), {
      ...data,
      password: hashedPassword,
      status: "pending",
      totalImages: 0,
      approvedCount: 0,
      deniedCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    readCounter.recordRead("create", "proofGalleries", "createGallery", 1);
    
    return galleryRef.id;
  } catch (error) {
    console.error("Error creating gallery:", error);
    throw error;
  }
};

// Get gallery by ID (public access)
export const getGalleryById = async (galleryId) => {
  try {
    const galleryDoc = await getDoc(doc(firestore, "proofGalleries", galleryId));
    readCounter.recordRead("get", "proofGalleries", "getGalleryById", 1);
    
    if (!galleryDoc.exists()) {
      return null;
    }
    
    return { id: galleryDoc.id, ...galleryDoc.data() };
  } catch (error) {
    console.error("Error getting gallery:", error);
    throw error;
  }
};

// Subscribe to galleries for an organization
export const subscribeToGalleries = (organizationId, callback, errorCallback) => {
  const q = query(
    collection(firestore, "proofGalleries"),
    where("organizationId", "==", organizationId),
    orderBy("createdAt", "desc")
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const galleries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      readCounter.recordRead("snapshot", "proofGalleries", "subscribeToGalleries", snapshot.docs.length);
      callback(galleries);
    },
    errorCallback
  );
};

// Upload proof images with parallel uploads and cancellation support
export const uploadProofImages = async (galleryId, files, onProgress, abortSignal) => {
  try {
    const CHUNK_SIZE = 5; // Upload 5 files concurrently
    const uploadedProofs = [];
    const failedUploads = [];
    let completedCount = 0;
    
    // Track individual file progress
    const fileProgress = new Map();
    files.forEach((file, index) => {
      fileProgress.set(index, 0);
    });
    
    // Helper to report aggregate progress
    const reportProgress = () => {
      if (onProgress) {
        const totalProgress = Array.from(fileProgress.values()).reduce((a, b) => a + b, 0) / files.length;
        onProgress({
          percentage: totalProgress,
          completed: completedCount,
          total: files.length,
          status: 'uploading'
        });
      }
    };
    
    // Upload a single file with progress tracking
    const uploadFile = async (file, index) => {
      const timestamp = Date.now();
      const filename = file.name;
      const storageRef = ref(storage, `proof-images/${galleryId}/${timestamp}_${filename}`);
      
      // Use uploadBytesResumable for progress tracking and cancellation
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      // Track upload progress
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          fileProgress.set(index, progress);
          reportProgress();
        },
        (error) => {
          console.error(`Error uploading ${filename}:`, error);
          throw error;
        }
      );
      
      // Handle abort signal
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          uploadTask.cancel();
        });
      }
      
      // Wait for upload to complete
      const snapshot = await uploadTask;
      const imageUrl = await getDownloadURL(snapshot.ref);
      
      completedCount++;
      
      return {
        index,
        filename,
        imageUrl,
        thumbnailUrl: imageUrl, // For now, use same URL
        storageRef: snapshot.ref
      };
    };
    
    // Process files in chunks
    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      // Check if cancelled
      if (abortSignal?.aborted) {
        throw new Error('Upload cancelled');
      }
      
      const chunk = files.slice(i, i + CHUNK_SIZE);
      const chunkPromises = chunk.map((file, chunkIndex) => {
        const fileIndex = i + chunkIndex;
        return uploadFile(file, fileIndex).catch(error => {
          failedUploads.push({ file, index: fileIndex, error });
          return null;
        });
      });
      
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      chunkResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          uploadedProofs.push(result.value);
        }
      });
    }
    
    // Check if cancelled before creating Firestore documents
    if (abortSignal?.aborted) {
      // Clean up uploaded files
      await cleanupUploadedFiles(uploadedProofs);
      throw new Error('Upload cancelled');
    }
    
    // Create Firestore documents for successfully uploaded files
    const batch = writeBatch(firestore);
    const proofDocuments = [];
    
    // Sort by original index to maintain order
    uploadedProofs.sort((a, b) => a.index - b.index);
    
    uploadedProofs.forEach((upload, orderIndex) => {
      const proofRef = doc(collection(firestore, "proofs"));
      batch.set(proofRef, {
        galleryId,
        filename: upload.filename,
        imageUrl: upload.imageUrl,
        thumbnailUrl: upload.thumbnailUrl,
        order: orderIndex,
        status: "pending",
        denialNotes: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      proofDocuments.push({
        id: proofRef.id,
        filename: upload.filename,
        imageUrl: upload.imageUrl,
        thumbnailUrl: upload.thumbnailUrl
      });
    });
    
    // Update gallery image count
    const galleryRef = doc(firestore, "proofGalleries", galleryId);
    batch.update(galleryRef, {
      totalImages: increment(uploadedProofs.length),
      updatedAt: serverTimestamp()
    });
    
    await batch.commit();
    readCounter.recordRead("write", "proofs", "uploadProofImages", uploadedProofs.length + 1);
    
    // Report completion
    if (onProgress) {
      onProgress({
        percentage: 100,
        completed: uploadedProofs.length,
        total: files.length,
        status: 'completed',
        failed: failedUploads
      });
    }
    
    return {
      uploaded: proofDocuments,
      failed: failedUploads
    };
  } catch (error) {
    console.error("Error uploading proof images:", error);
    throw error;
  }
};

// Helper function to clean up uploaded files on cancellation
const cleanupUploadedFiles = async (uploadedFiles) => {
  const deletePromises = uploadedFiles.map(async (file) => {
    try {
      if (file.storageRef) {
        await deleteObject(file.storageRef);
      }
    } catch (error) {
      console.error("Error deleting file during cleanup:", error);
    }
  });
  
  await Promise.allSettled(deletePromises);
};

// Get proofs by gallery ID
export const getProofsByGalleryId = async (galleryId) => {
  try {
    const q = query(
      collection(firestore, "proofs"),
      where("galleryId", "==", galleryId),
      orderBy("order", "asc")
    );
    
    const snapshot = await getDocs(q);
    readCounter.recordRead("query", "proofs", "getProofsByGalleryId", snapshot.docs.length);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error getting proofs:", error);
    throw error;
  }
};

// Subscribe to proofs for real-time updates
export const subscribeToProofs = (galleryId, callback, errorCallback) => {
  const q = query(
    collection(firestore, "proofs"),
    where("galleryId", "==", galleryId),
    orderBy("order", "asc")
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const proofs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      readCounter.recordRead("snapshot", "proofs", "subscribeToProofs", snapshot.docs.length);
      callback(proofs);
    },
    errorCallback
  );
};

// Update proof status
export const updateProofStatus = async (galleryId, proofId, status, denialNotes, reviewerEmail) => {
  try {
    const batch = writeBatch(firestore);
    
    // Update proof
    const proofRef = doc(firestore, "proofs", proofId);
    batch.update(proofRef, {
      status,
      denialNotes: status === "denied" ? denialNotes : null,
      reviewedAt: serverTimestamp(),
      reviewedBy: reviewerEmail || "Anonymous",
      updatedAt: serverTimestamp()
    });
    
    // Update gallery counts
    const galleryRef = doc(firestore, "proofGalleries", galleryId);
    const updates = {
      updatedAt: serverTimestamp()
    };
    
    // Get current proof status to update counts correctly
    const proofDoc = await getDoc(proofRef);
    const currentStatus = proofDoc.data()?.status;
    
    if (currentStatus !== status) {
      if (currentStatus === "approved") updates.approvedCount = increment(-1);
      if (currentStatus === "denied") updates.deniedCount = increment(-1);
      
      if (status === "approved") updates.approvedCount = increment(1);
      if (status === "denied") updates.deniedCount = increment(1);
    }
    
    batch.update(galleryRef, updates);
    
    await batch.commit();
    readCounter.recordRead("update", "proofs", "updateProofStatus", 2);
    
    // Clear cache for this gallery to ensure fresh data
    proofingCacheService.clearGalleryCache(galleryId);
    
    // Update gallery status
    await updateGalleryStatus(galleryId);
  } catch (error) {
    console.error("Error updating proof status:", error);
    throw error;
  }
};

// Update gallery status based on proof statuses
const updateGalleryStatus = async (galleryId) => {
  try {
    const galleryDoc = await getDoc(doc(firestore, "proofGalleries", galleryId));
    const gallery = galleryDoc.data();
    
    let newStatus = "pending";
    
    if (gallery.totalImages > 0) {
      if (gallery.approvedCount === gallery.totalImages) {
        newStatus = "approved";
      } else if (gallery.deniedCount > 0) {
        newStatus = "has_denials";
      } else if (gallery.approvedCount > 0 || gallery.deniedCount > 0) {
        newStatus = "partial";
      }
    }
    
    if (gallery.status !== newStatus) {
      await updateDoc(doc(firestore, "proofGalleries", galleryId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      readCounter.recordRead("update", "proofGalleries", "updateGalleryStatus", 1);
    }
  } catch (error) {
    console.error("Error updating gallery status:", error);
  }
};

// Log activity
export const logActivity = async (galleryId, action, proofId, userEmail) => {
  try {
    await addDoc(collection(firestore, "proofActivity"), {
      galleryId,
      action,
      proofId: proofId || null,
      userEmail: userEmail || "Anonymous",
      timestamp: serverTimestamp()
    });
    
    readCounter.recordRead("create", "proofActivity", "logActivity", 1);
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw - logging shouldn't break the app
  }
};

// Get gallery activity
export const getGalleryActivity = async (galleryId) => {
  try {
    const q = query(
      collection(firestore, "proofActivity"),
      where("galleryId", "==", galleryId),
      orderBy("timestamp", "desc")
    );
    
    const snapshot = await getDocs(q);
    readCounter.recordRead("query", "proofActivity", "getGalleryActivity", snapshot.docs.length);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error getting activity:", error);
    throw error;
  }
};

// Upload new versions of proof images (versioning, not replacing)
export const batchReplaceProofImages = async (galleryId, replacements, userEmail, onProgress) => {
  try {
    const batch = writeBatch(firestore);
    const uploadedVersions = [];
    let completedCount = 0;

    // Helper to report progress
    const reportProgress = () => {
      if (onProgress) {
        onProgress({
          percentage: (completedCount / replacements.length) * 100,
          completed: completedCount,
          total: replacements.length,
          status: 'uploading'
        });
      }
    };

    // Process each replacement as a new version
    for (const replacement of replacements) {
      const { proofId, oldProof, newFile, studioNotes } = replacement;
      
      try {
        // Calculate new version number
        const currentVersion = oldProof.currentVersion || 1;
        const newVersion = currentVersion + 1;
        
        // Upload new image to versioned path
        const timestamp = Date.now();
        const filename = newFile.name;
        const versionedPath = `proof-images/${galleryId}/versions/${proofId}/v${newVersion}_${timestamp}_${filename}`;
        const storageRef = ref(storage, versionedPath);
        
        // Use uploadBytesResumable for progress tracking
        const uploadTask = uploadBytesResumable(storageRef, newFile);
        
        // Track upload progress
        const uploadPromise = new Promise((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              const fileProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              
              // Calculate overall progress
              const baseProgress = (completedCount / replacements.length) * 100;
              const fileWeight = 100 / replacements.length;
              const overallProgress = baseProgress + (fileProgress * fileWeight / 100);
              
              reportProgress({
                percentage: overallProgress,
                completed: completedCount,
                total: replacements.length,
                status: 'uploading',
                currentFile: completedCount + 1,
                fileProgress
              });
            },
            (error) => {
              console.error(`Error uploading version for ${proofId}:`, error);
              reject(error);
            },
            async () => {
              const newImageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(newImageUrl);
            }
          );
        });
        
        const newImageUrl = await uploadPromise;
        
        // Create revision record for audit trail
        const revisionRef = doc(collection(firestore, "proofRevisions"));
        batch.set(revisionRef, {
          proofId,
          galleryId,
          originalImageUrl: oldProof.imageUrl,
          newImageUrl,
          versionNumber: newVersion,
          denialNotes: oldProof.denialNotes,
          studioNotes: studioNotes || null,
          replacedBy: userEmail || "studio@focal.com",
          replacedAt: serverTimestamp(),
          // Store version metadata
          previousVersion: currentVersion,
          isLatest: true
        });
        
        // If there was a previous revision, mark it as not latest
        if (oldProof.lastRevisionId) {
          const prevRevisionRef = doc(firestore, "proofRevisions", oldProof.lastRevisionId);
          batch.update(prevRevisionRef, {
            isLatest: false
          });
        }
        
        // Update proof document with new version
        const proofRef = doc(firestore, "proofs", proofId);
        batch.update(proofRef, {
          imageUrl: newImageUrl,
          thumbnailUrl: newImageUrl, // For now, use same URL
          status: "pending", // Reset to pending for re-review
          denialNotes: null,
          currentVersion: newVersion,
          versionCount: increment(1),
          lastRevisionId: revisionRef.id,
          hasVersions: true,
          updatedAt: serverTimestamp()
        });
        
        uploadedVersions.push({
          proofId,
          newImageUrl,
          revisionId: revisionRef.id,
          version: newVersion
        });
        
        completedCount++;
        reportProgress();
        
      } catch (error) {
        console.error(`Error uploading new version for proof ${proofId}:`, error);
        throw error;
      }
    }
    
    // Update gallery to reflect pending status if any images were versioned
    if (uploadedVersions.length > 0) {
      const galleryRef = doc(firestore, "proofGalleries", galleryId);
      batch.update(galleryRef, {
        status: "partial", // Gallery has mixed statuses
        updatedAt: serverTimestamp()
      });
    }
    
    // Log activity
    const activityRef = doc(collection(firestore, "proofActivity"));
    batch.set(activityRef, {
      galleryId,
      action: "batch_replaced",
      count: uploadedVersions.length,
      userEmail: userEmail || "studio@focal.com",
      timestamp: serverTimestamp()
    });
    
    await batch.commit();
    
    readCounter.recordRead("write", "multiple", "batchReplaceProofImages", 
      uploadedVersions.length * 2 + 2); // proofs + revisions + gallery + activity
    
    // Clear cache for this gallery
    proofingCacheService.clearGalleryCache(galleryId);
    
    if (onProgress) {
      onProgress({
        percentage: 100,
        completed: uploadedVersions.length,
        total: replacements.length,
        status: 'completed'
      });
    }
    
    return uploadedVersions;
  } catch (error) {
    console.error("Error in batch versioning:", error);
    throw error;
  }
};

// Get version history for a proof
export const getProofVersionHistory = async (proofId) => {
  try {
    const q = query(
      collection(firestore, "proofRevisions"),
      where("proofId", "==", proofId),
      orderBy("versionNumber", "desc")
    );
    
    const snapshot = await getDocs(q);
    readCounter.recordRead("query", "proofRevisions", "getProofVersionHistory", snapshot.docs.length);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      replacedAt: doc.data().replacedAt?.toDate() || null
    }));
  } catch (error) {
    console.error("Error getting proof version history:", error);
    throw error;
  }
};

// Delete gallery and all associated data
export const deleteGallery = async (galleryId) => {
  try {
    const batch = writeBatch(firestore);
    
    // Get all proofs to delete images from storage
    const proofs = await getProofsByGalleryId(galleryId);
    
    // Delete proof documents
    for (const proof of proofs) {
      batch.delete(doc(firestore, "proofs", proof.id));
      
      // Delete image from storage
      try {
        const imageRef = ref(storage, proof.imageUrl);
        await deleteObject(imageRef);
      } catch (err) {
        console.warn("Failed to delete image:", err);
      }
    }
    
    // Delete activity logs
    const activityQuery = query(
      collection(firestore, "proofActivity"),
      where("galleryId", "==", galleryId)
    );
    const activityDocs = await getDocs(activityQuery);
    activityDocs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete gallery
    batch.delete(doc(firestore, "proofGalleries", galleryId));
    
    await batch.commit();
    readCounter.recordRead("delete", "multiple", "deleteGallery", proofs.length + activityDocs.size + 1);
  } catch (error) {
    console.error("Error deleting gallery:", error);
    throw error;
  }
};

// Get version history for a proof
export const getProofRevisions = async (proofId) => {
  try {
    const q = query(
      collection(firestore, "proofRevisions"),
      where("proofId", "==", proofId),
      orderBy("versionNumber", "desc")
    );
    
    const snapshot = await getDocs(q);
    const revisions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    readCounter.recordRead("get", "proofRevisions", "getProofRevisions", snapshot.docs.length);
    
    return revisions;
  } catch (error) {
    console.error("Error getting proof revisions:", error);
    throw error;
  }
};