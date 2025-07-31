// src/firebase/timeOffRequests.js
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  firestore
} from '../services/firestoreWrapper';
import timeOffCacheService from '../services/timeOffCacheService';
import { readCounter } from '../services/readCounter';

// Create a new time off request
export const createTimeOffRequest = async (requestData) => {
  try {
    const timeOffRef = collection(firestore, 'timeOffRequests');
    const newRequest = {
      ...requestData,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(timeOffRef, newRequest);
    return { id: docRef.id, ...newRequest };
  } catch (error) {
    console.error('Error creating time off request:', error);
    throw error;
  }
};

// Get all time off requests for an organization
export const getTimeOffRequests = async (organizationId, filters = {}) => {
  try {
    // Check cache first if no filters applied
    if (!filters.status && !filters.photographerId && !filters.startDate && !filters.endDate) {
      const cachedRequests = timeOffCacheService.getCachedTimeOffRequests(organizationId);
      if (cachedRequests) {
        readCounter.recordCacheHit('timeOffRequests', 'getTimeOffRequests', cachedRequests.length);
        return cachedRequests;
      }
      readCounter.recordCacheMiss('timeOffRequests', 'getTimeOffRequests');
    }

    const timeOffRef = collection(firestore, 'timeOffRequests');
    let q = query(
      timeOffRef,
      where('organizationID', '==', organizationId),
      orderBy('createdAt', 'desc')
    );

    // Apply filters
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.photographerId) {
      q = query(q, where('photographerId', '==', filters.photographerId));
    }
    if (filters.startDate) {
      q = query(q, where('startDate', '>=', Timestamp.fromDate(filters.startDate)));
    }
    if (filters.endDate) {
      q = query(q, where('endDate', '<=', Timestamp.fromDate(filters.endDate)));
    }

    const snapshot = await getDocs(q, 'getTimeOffRequests');
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Cache results if no filters
    if (!filters.status && !filters.photographerId && !filters.startDate && !filters.endDate) {
      timeOffCacheService.setCachedTimeOffRequests(organizationId, requests);
    }
    
    return requests;
  } catch (error) {
    console.error('Error getting time off requests:', error);
    throw error;
  }
};

// Get time off requests for a specific photographer
export const getPhotographerTimeOffRequests = async (organizationId, photographerId) => {
  try {
    // Check user-specific cache first
    const cachedUserRequests = timeOffCacheService.getCachedUserTimeOffRequests(photographerId);
    if (cachedUserRequests) {
      // Filter by organization
      const orgRequests = cachedUserRequests.filter(r => r.organizationID === organizationId);
      if (orgRequests.length > 0) {
        readCounter.recordCacheHit('timeOffRequests', 'getPhotographerTimeOffRequests', orgRequests.length);
        return orgRequests;
      }
    }
    readCounter.recordCacheMiss('timeOffRequests', 'getPhotographerTimeOffRequests');

    const timeOffRef = collection(firestore, 'timeOffRequests');
    const q = query(
      timeOffRef,
      where('organizationID', '==', organizationId),
      where('photographerId', '==', photographerId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q, 'getPhotographerTimeOffRequests');
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Cache user requests
    timeOffCacheService.setCachedUserTimeOffRequests(photographerId, requests);
    
    return requests;
  } catch (error) {
    console.error('Error getting photographer time off requests:', error);
    throw error;
  }
};

// Get a single time off request
export const getTimeOffRequest = async (requestId) => {
  try {
    const docRef = doc(firestore, 'timeOffRequests', requestId);
    const docSnap = await getDoc(docRef, 'getTimeOffRequest');
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting time off request:', error);
    throw error;
  }
};

// Update time off request (for edits before approval)
export const updateTimeOffRequest = async (requestId, updates) => {
  try {
    const docRef = doc(firestore, 'timeOffRequests', requestId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    // Clear relevant caches
    if (updates.organizationID) {
      timeOffCacheService.clearTimeOffRequestsCache(updates.organizationID);
    }
    if (updates.photographerId || updates.userId) {
      timeOffCacheService.clearUserTimeOffRequestsCache(updates.photographerId || updates.userId);
    }
    
    return { id: requestId, ...updates };
  } catch (error) {
    console.error('Error updating time off request:', error);
    throw error;
  }
};

// Approve time off request
export const approveTimeOffRequest = async (requestId, approverId, approverName) => {
  try {
    const docRef = doc(firestore, 'timeOffRequests', requestId);
    const updates = {
      status: 'approved',
      approvedBy: approverId,
      approverName: approverName,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(docRef, updates);
    
    // Get the request to clear relevant caches
    const requestDoc = await getDoc(docRef);
    if (requestDoc.exists()) {
      const requestData = requestDoc.data();
      timeOffCacheService.clearTimeOffRequestsCache(requestData.organizationID);
      if (requestData.photographerId) {
        timeOffCacheService.clearUserTimeOffRequestsCache(requestData.photographerId);
      }
    }
    
    return { id: requestId, ...updates };
  } catch (error) {
    console.error('Error approving time off request:', error);
    throw error;
  }
};

// Deny time off request
export const denyTimeOffRequest = async (requestId, denierId, denierName, denialReason) => {
  try {
    const docRef = doc(firestore, 'timeOffRequests', requestId);
    const updates = {
      status: 'denied',
      deniedBy: denierId,
      denierName: denierName,
      deniedAt: serverTimestamp(),
      denialReason: denialReason,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(docRef, updates);
    
    // Get the request to clear relevant caches
    const requestDoc = await getDoc(docRef);
    if (requestDoc.exists()) {
      const requestData = requestDoc.data();
      timeOffCacheService.clearTimeOffRequestsCache(requestData.organizationID);
      if (requestData.photographerId) {
        timeOffCacheService.clearUserTimeOffRequestsCache(requestData.photographerId);
      }
    }
    
    return { id: requestId, ...updates };
  } catch (error) {
    console.error('Error denying time off request:', error);
    throw error;
  }
};

// Mark time off request as under review
export const markTimeOffRequestUnderReview = async (requestId, reviewerId, reviewerName) => {
  try {
    const docRef = doc(firestore, 'timeOffRequests', requestId);
    const updates = {
      status: 'under_review',
      reviewedBy: reviewerId,
      reviewerName: reviewerName,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(docRef, updates);
    
    // Get the request to clear relevant caches
    const requestDoc = await getDoc(docRef);
    if (requestDoc.exists()) {
      const requestData = requestDoc.data();
      timeOffCacheService.clearTimeOffRequestsCache(requestData.organizationID);
      if (requestData.photographerId) {
        timeOffCacheService.clearUserTimeOffRequestsCache(requestData.photographerId);
      }
    }
    
    return { id: requestId, ...updates };
  } catch (error) {
    console.error('Error marking time off request as under review:', error);
    throw error;
  }
};

// Cancel time off request (by photographer)
export const cancelTimeOffRequest = async (requestId) => {
  try {
    const docRef = doc(firestore, 'timeOffRequests', requestId);
    const updates = {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(docRef, updates);
    
    // Get the request to clear relevant caches
    const requestDoc = await getDoc(docRef);
    if (requestDoc.exists()) {
      const requestData = requestDoc.data();
      timeOffCacheService.clearTimeOffRequestsCache(requestData.organizationID);
      if (requestData.photographerId) {
        timeOffCacheService.clearUserTimeOffRequestsCache(requestData.photographerId);
      }
    }
    
    return { id: requestId, ...updates };
  } catch (error) {
    console.error('Error cancelling time off request:', error);
    throw error;
  }
};

// Revert time off request status (undo approve/deny)
export const revertTimeOffRequestStatus = async (requestId, reverterId, reverterName) => {
  try {
    const docRef = doc(firestore, 'timeOffRequests', requestId);
    
    // First get the current request to store history
    const requestDoc = await getDoc(docRef, 'revertTimeOffRequestStatus');
    if (!requestDoc.exists()) {
      throw new Error('Time off request not found');
    }
    
    const currentData = requestDoc.data();
    
    // Only allow reverting approved or denied requests
    if (currentData.status !== 'approved' && currentData.status !== 'denied') {
      throw new Error('Can only revert approved or denied requests');
    }
    
    // Prepare updates - set back to under_review and store previous status info
    const updates = {
      status: 'under_review',
      reviewedBy: reverterId,
      reviewerName: reverterName,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      
      // Store previous status information
      previousStatus: currentData.status,
      previousStatusData: {
        status: currentData.status,
        ...(currentData.status === 'approved' && {
          approvedBy: currentData.approvedBy,
          approverName: currentData.approverName,
          approvedAt: currentData.approvedAt
        }),
        ...(currentData.status === 'denied' && {
          deniedBy: currentData.deniedBy,
          denierName: currentData.denierName,
          deniedAt: currentData.deniedAt,
          denialReason: currentData.denialReason
        })
      },
      revertedAt: serverTimestamp(),
      revertedBy: reverterId,
      reverterName: reverterName
    };
    
    // Clear approval/denial fields
    if (currentData.status === 'approved') {
      updates.approvedBy = null;
      updates.approverName = null;
      updates.approvedAt = null;
    } else if (currentData.status === 'denied') {
      updates.deniedBy = null;
      updates.denierName = null;
      updates.deniedAt = null;
      updates.denialReason = null;
    }
    
    await updateDoc(docRef, updates);
    
    // Clear relevant caches
    timeOffCacheService.clearTimeOffRequestsCache(currentData.organizationID);
    if (currentData.photographerId) {
      timeOffCacheService.clearUserTimeOffRequestsCache(currentData.photographerId);
    }
    
    return { id: requestId, ...updates };
  } catch (error) {
    console.error('Error reverting time off request status:', error);
    throw error;
  }
};

// Get approved time off for a date range (for calendar display)
export const getApprovedTimeOffForDateRange = async (organizationId, startDate, endDate) => {
  try {
    const timeOffRef = collection(firestore, 'timeOffRequests');
    const q = query(
      timeOffRef,
      where('organizationID', '==', organizationId),
      where('status', '==', 'approved'),
      where('startDate', '<=', Timestamp.fromDate(endDate)),
      where('endDate', '>=', Timestamp.fromDate(startDate))
    );

    const snapshot = await getDocs(q, 'getApprovedTimeOffForDateRange');
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting approved time off for date range:', error);
    throw error;
  }
};

// Check for conflicts with existing sessions
export const checkTimeOffConflicts = async (organizationId, photographerId, startDate, endDate) => {
  try {
    // Get sessions for the photographer in the date range
    const sessionsRef = collection(firestore, 'sessions');
    const q = query(
      sessionsRef,
      where('organizationID', '==', organizationId),
      where('photographers', 'array-contains', { id: photographerId })
    );

    const snapshot = await getDocs(q, 'checkTimeOffConflicts');
    const conflicts = [];

    snapshot.docs.forEach(doc => {
      const session = doc.data();
      const sessionDate = session.date.toDate ? session.date.toDate() : new Date(session.date);
      
      if (sessionDate >= startDate && sessionDate <= endDate) {
        conflicts.push({
          id: doc.id,
          ...session
        });
      }
    });

    return conflicts;
  } catch (error) {
    console.error('Error checking time off conflicts:', error);
    throw error;
  }
};