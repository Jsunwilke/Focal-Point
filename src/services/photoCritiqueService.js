// src/services/photoCritiqueService.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  onSnapshot,
  Timestamp
} from "firebase/firestore";
import { firestore } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase/config";
import { readCounter } from "./readCounter";
import { compressImage } from "../utils/imageCompression";

const COLLECTION_NAME = "photoCritiques";
const FEEDBACK_COLLECTION = "critiqueFeedback";

// Upload critique image to Firebase Storage
export const uploadCritiqueImage = async (file, organizationId, critiqueId) => {
  try {
    // Compress the image
    const compressedFile = await compressImage(file, {
      maxWidth: 2000,
      maxHeight: 2000,
      quality: 0.85
    });

    // Create storage path
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storagePath = `organizations/${organizationId}/critiques/${critiqueId}/${fileName}`;
    
    // Upload to Firebase Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, compressedFile);
    const imageUrl = await getDownloadURL(storageRef);

    // Create thumbnail
    const thumbnailFile = await compressImage(file, {
      maxWidth: 400,
      maxHeight: 400,
      quality: 0.7
    });
    
    const thumbnailPath = `organizations/${organizationId}/critiques/${critiqueId}/thumb_${fileName}`;
    const thumbnailRef = ref(storage, thumbnailPath);
    await uploadBytes(thumbnailRef, thumbnailFile);
    const thumbnailUrl = await getDownloadURL(thumbnailRef);

    return { imageUrl, thumbnailUrl };
  } catch (error) {
    console.error("Error uploading critique image:", error);
    throw error;
  }
};

// Create a new photo critique (manager training photo)
export const createPhotoCritique = async (critiqueData, imageFiles) => {
  try {
    // Generate a temporary ID for storage path
    const tempId = `temp_${Date.now()}`;
    
    // Upload all images
    const imageUrls = [];
    const thumbnailUrls = [];
    
    for (let i = 0; i < imageFiles.length; i++) {
      const { imageUrl, thumbnailUrl } = await uploadCritiqueImage(
        imageFiles[i],
        critiqueData.organizationId,
        `${tempId}_${i}`
      );
      imageUrls.push(imageUrl);
      thumbnailUrls.push(thumbnailUrl);
    }

    // Create critique document with manager's notes and target photographer
    const docData = {
      ...critiqueData,
      imageUrls, // Array of image URLs
      thumbnailUrls, // Array of thumbnail URLs
      imageUrl: imageUrls[0], // Keep first image for backward compatibility
      thumbnailUrl: thumbnailUrls[0], // Keep first thumbnail for backward compatibility
      imageCount: imageFiles.length, // Track number of images
      // Manager's critique is embedded directly in the document
      managerNotes: critiqueData.notes,
      exampleType: critiqueData.type, // 'example' or 'improvement'
      targetPhotographerId: critiqueData.photographerId, // Which photographer this is for
      targetPhotographerName: critiqueData.photographerName, // Name of the photographer
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // Remove peer review fields as this is now a training tool
      status: "published"
    };

    const docRef = await addDoc(collection(firestore, COLLECTION_NAME), docData);
    readCounter.recordRead("create", COLLECTION_NAME, "PhotoCritiqueService", 1);

    // Fetch the complete document to get server-generated fields
    const newDoc = await getDoc(docRef);
    readCounter.recordRead("get", COLLECTION_NAME, "PhotoCritiqueService", 1);
    
    if (newDoc.exists()) {
      return { id: newDoc.id, ...newDoc.data() };
    }
    
    // Fallback if fetch fails
    return { id: docRef.id, ...docData };
  } catch (error) {
    console.error("Error creating photo critique:", error);
    throw error;
  }
};

// Get critiques for an organization with pagination
export const getCritiques = async (organizationId, filters = {}, lastDoc = null, pageSize = 20) => {
  try {
    let q = query(
      collection(firestore, COLLECTION_NAME),
      where("organizationId", "==", organizationId)
    );

    // Apply filters
    if (filters.status) {
      q = query(q, where("status", "==", filters.status));
    }
    if (filters.submitterId) {
      q = query(q, where("submitterId", "==", filters.submitterId));
    }
    if (filters.hasReviews !== undefined) {
      q = query(q, where("feedbackCount", filters.hasReviews ? ">" : "==", 0));
    }

    // Sort and pagination
    q = query(q, orderBy("createdAt", "desc"), limit(pageSize));
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    readCounter.recordRead("query", COLLECTION_NAME, "PhotoCritiqueService", snapshot.size);

    const critiques = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      _doc: doc // Store for pagination
    }));

    return {
      critiques,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore: snapshot.docs.length === pageSize
    };
  } catch (error) {
    console.error("Error getting critiques:", error);
    throw error;
  }
};

// Get a single critique
export const getCritiqueById = async (critiqueId) => {
  try {
    const docRef = doc(firestore, COLLECTION_NAME, critiqueId);
    const docSnap = await getDoc(docRef);
    readCounter.recordRead("get", COLLECTION_NAME, "PhotoCritiqueService", 1);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting critique:", error);
    throw error;
  }
};

// Update critique
export const updateCritique = async (critiqueId, updateData) => {
  try {
    const docRef = doc(firestore, COLLECTION_NAME, critiqueId);
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    readCounter.recordRead("update", COLLECTION_NAME, "PhotoCritiqueService", 1);
    return true;
  } catch (error) {
    console.error("Error updating critique:", error);
    throw error;
  }
};

// Delete critique
export const deleteCritique = async (critiqueId, imageUrls, thumbnailUrls) => {
  try {
    // Handle both array and single URL formats for backward compatibility
    const images = Array.isArray(imageUrls) ? imageUrls : [imageUrls].filter(Boolean);
    const thumbnails = Array.isArray(thumbnailUrls) ? thumbnailUrls : [thumbnailUrls].filter(Boolean);
    
    // Delete all images from storage
    for (const imageUrl of images) {
      if (imageUrl) {
        try {
          const imageRef = ref(storage, imageUrl);
          await deleteObject(imageRef);
        } catch (err) {
          console.warn("Error deleting image:", err);
        }
      }
    }
    
    // Delete all thumbnails from storage
    for (const thumbnailUrl of thumbnails) {
      if (thumbnailUrl) {
        try {
          const thumbnailRef = ref(storage, thumbnailUrl);
          await deleteObject(thumbnailRef);
        } catch (err) {
          console.warn("Error deleting thumbnail:", err);
        }
      }
    }

    // Delete Firestore document
    const docRef = doc(firestore, COLLECTION_NAME, critiqueId);
    await deleteDoc(docRef);
    readCounter.recordRead("delete", COLLECTION_NAME, "PhotoCritiqueService", 1);

    // Delete all feedback for this critique
    const feedbackQuery = query(
      collection(firestore, FEEDBACK_COLLECTION),
      where("critiqueId", "==", critiqueId)
    );
    const feedbackSnapshot = await getDocs(feedbackQuery);
    const deletePromises = feedbackSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    readCounter.recordRead("delete", FEEDBACK_COLLECTION, "PhotoCritiqueService", feedbackSnapshot.size);

    return true;
  } catch (error) {
    console.error("Error deleting critique:", error);
    throw error;
  }
};

// Add feedback to a critique
export const addCritiqueFeedback = async (feedbackData) => {
  try {
    const docData = {
      ...feedbackData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(firestore, FEEDBACK_COLLECTION), docData);
    readCounter.recordRead("create", FEEDBACK_COLLECTION, "PhotoCritiqueService", 1);

    // Update critique stats
    await updateCritiqueStats(feedbackData.critiqueId);

    return { id: docRef.id, ...docData };
  } catch (error) {
    console.error("Error adding feedback:", error);
    throw error;
  }
};

// Get feedback for a critique
export const getCritiqueFeedback = async (critiqueId) => {
  try {
    const q = query(
      collection(firestore, FEEDBACK_COLLECTION),
      where("critiqueId", "==", critiqueId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    readCounter.recordRead("query", FEEDBACK_COLLECTION, "PhotoCritiqueService", snapshot.size);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error getting feedback:", error);
    throw error;
  }
};

// Update feedback
export const updateFeedback = async (feedbackId, updateData) => {
  try {
    const docRef = doc(firestore, FEEDBACK_COLLECTION, feedbackId);
    
    // Get the feedback to know which critique to update
    const feedbackDoc = await getDoc(docRef);
    const critiqueId = feedbackDoc.data().critiqueId;
    
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    readCounter.recordRead("update", FEEDBACK_COLLECTION, "PhotoCritiqueService", 2);

    // Update critique stats
    await updateCritiqueStats(critiqueId);

    return true;
  } catch (error) {
    console.error("Error updating feedback:", error);
    throw error;
  }
};

// Delete feedback
export const deleteFeedback = async (feedbackId) => {
  try {
    const docRef = doc(firestore, FEEDBACK_COLLECTION, feedbackId);
    
    // Get the feedback to know which critique to update
    const feedbackDoc = await getDoc(docRef);
    const critiqueId = feedbackDoc.data().critiqueId;
    
    await deleteDoc(docRef);
    readCounter.recordRead("delete", FEEDBACK_COLLECTION, "PhotoCritiqueService", 2);

    // Update critique stats
    await updateCritiqueStats(critiqueId);

    return true;
  } catch (error) {
    console.error("Error deleting feedback:", error);
    throw error;
  }
};

// Update critique statistics (average rating, feedback count)
const updateCritiqueStats = async (critiqueId) => {
  try {
    const feedbackQuery = query(
      collection(firestore, FEEDBACK_COLLECTION),
      where("critiqueId", "==", critiqueId)
    );
    
    const snapshot = await getDocs(feedbackQuery);
    readCounter.recordRead("query", FEEDBACK_COLLECTION, "PhotoCritiqueService", snapshot.size);
    
    let totalRating = 0;
    let ratingCount = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.rating) {
        totalRating += data.rating;
        ratingCount++;
      }
    });
    
    const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
    
    const critiqueRef = doc(firestore, COLLECTION_NAME, critiqueId);
    await updateDoc(critiqueRef, {
      feedbackCount: snapshot.size,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      updatedAt: serverTimestamp()
    });
    readCounter.recordRead("update", COLLECTION_NAME, "PhotoCritiqueService", 1);
  } catch (error) {
    console.error("Error updating critique stats:", error);
  }
};

// Subscribe to real-time updates for critiques
export const subscribeToCritiques = (organizationId, callback, filters = {}) => {
  let q = query(
    collection(firestore, COLLECTION_NAME),
    where("organizationId", "==", organizationId),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  // Apply filters
  if (filters.status) {
    q = query(q, where("status", "==", filters.status));
  }
  if (filters.submitterId) {
    q = query(q, where("submitterId", "==", filters.submitterId));
  }

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const critiques = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    readCounter.recordRead("realtime", COLLECTION_NAME, "PhotoCritiqueService", snapshot.docChanges().length);
    callback(critiques);
  });

  return unsubscribe;
};

// Subscribe to feedback updates for a critique
export const subscribeToCritiqueFeedback = (critiqueId, callback) => {
  const q = query(
    collection(firestore, FEEDBACK_COLLECTION),
    where("critiqueId", "==", critiqueId),
    orderBy("createdAt", "desc")
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const feedback = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    readCounter.recordRead("realtime", FEEDBACK_COLLECTION, "PhotoCritiqueService", snapshot.docChanges().length);
    callback(feedback);
  });

  return unsubscribe;
};

// Get photographers in organization
export const getPhotographers = async (organizationId) => {
  try {
    const q = query(
      collection(firestore, "users"),
      where("organizationID", "==", organizationId),
      where("isPhotographer", "==", true)
    );

    const snapshot = await getDocs(q);
    readCounter.recordRead("query", "users", "PhotoCritiqueService", snapshot.size);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error getting photographers:", error);
    throw error;
  }
};