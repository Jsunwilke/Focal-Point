// src/firebase/blockedDates.js
import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  firestore
} from '../services/firestoreWrapper';
import ptoCacheService from '../services/ptoCacheService';
import { readCounter } from '../services/readCounter';

// Create a new blocked date range
export const createBlockedDateRange = async (blockedDateData) => {
  try {
    const blockedDatesRef = collection(firestore, 'blockedDates');
    const newBlockedDate = {
      ...blockedDateData,
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(blockedDatesRef, newBlockedDate);
    
    // Clear cache
    if (blockedDateData.organizationID) {
      ptoCacheService.clearBlockedDatesCache(blockedDateData.organizationID);
    }
    
    return { id: docRef.id, ...newBlockedDate };
  } catch (error) {
    console.error('Error creating blocked date range:', error);
    throw error;
  }
};

// Get all blocked dates for an organization
export const getBlockedDates = async (organizationId) => {
  try {
    // Check cache first
    const cachedBlockedDates = ptoCacheService.getCachedBlockedDates(organizationId);
    if (cachedBlockedDates) {
      readCounter.recordCacheHit('blockedDates', 'getBlockedDates', cachedBlockedDates.length);
      return cachedBlockedDates;
    }
    readCounter.recordCacheMiss('blockedDates', 'getBlockedDates');

    const blockedDatesRef = collection(firestore, 'blockedDates');
    const q = query(
      blockedDatesRef,
      where('organizationID', '==', organizationId),
      orderBy('startDate', 'asc')
    );

    const snapshot = await getDocs(q, 'getBlockedDates');
    const blockedDates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Cache the results
    ptoCacheService.setCachedBlockedDates(organizationId, blockedDates);
    
    return blockedDates;
  } catch (error) {
    console.error('Error getting blocked dates:', error);
    throw error;
  }
};

// Check if a specific date range overlaps with blocked dates
export const checkDateIsBlocked = async (organizationId, startDate, endDate) => {
  try {
    const blockedDatesRef = collection(firestore, 'blockedDates');
    
    // Query for blocked dates that overlap with the requested range
    const q = query(
      blockedDatesRef,
      where('organizationID', '==', organizationId),
      where('startDate', '<=', Timestamp.fromDate(endDate))
    );

    const snapshot = await getDocs(q, 'checkDateIsBlocked');
    const blockedDates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter for actual overlaps (since Firestore doesn't support compound inequalities)
    const overlappingDates = blockedDates.filter(blocked => {
      const blockedStart = blocked.startDate.toDate();
      const blockedEnd = blocked.endDate.toDate();
      
      // Check if date ranges overlap
      return startDate <= blockedEnd && endDate >= blockedStart;
    });

    return {
      isBlocked: overlappingDates.length > 0,
      blockedRanges: overlappingDates,
      canOverride: overlappingDates.some(range => range.allowHighPriority)
    };
  } catch (error) {
    console.error('Error checking blocked dates:', error);
    throw error;
  }
};

// Delete a blocked date range
export const deleteBlockedDateRange = async (blockedDateId, organizationId) => {
  try {
    const docRef = doc(firestore, 'blockedDates', blockedDateId);
    await deleteDoc(docRef);
    
    // Clear cache
    if (organizationId) {
      ptoCacheService.clearBlockedDatesCache(organizationId);
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting blocked date range:', error);
    throw error;
  }
};

// Get blocked dates within a specific date range (for calendar display)
export const getBlockedDatesForDateRange = async (organizationId, startDate, endDate) => {
  try {
    const blockedDatesRef = collection(firestore, 'blockedDates');
    
    // Query for blocked dates that might overlap with the view range
    const q = query(
      blockedDatesRef,
      where('organizationID', '==', organizationId),
      where('startDate', '<=', Timestamp.fromDate(endDate))
    );

    const snapshot = await getDocs(q, 'getBlockedDatesForDateRange');
    const blockedDates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter for actual overlaps
    return blockedDates.filter(blocked => {
      const blockedEnd = blocked.endDate.toDate();
      return blockedEnd >= startDate;
    });
  } catch (error) {
    console.error('Error getting blocked dates for range:', error);
    throw error;
  }
};

// Get blocked dates for a specific date (for calendar cell display)
export const getBlockedDatesForDate = async (organizationId, date) => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const blockedDatesRef = collection(firestore, 'blockedDates');
    const q = query(
      blockedDatesRef,
      where('organizationID', '==', organizationId),
      where('startDate', '<=', Timestamp.fromDate(endOfDay))
    );

    const snapshot = await getDocs(q, 'getBlockedDatesForDate');
    const blockedDates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter for dates that actually include this specific date
    return blockedDates.filter(blocked => {
      const blockedStart = blocked.startDate.toDate();
      const blockedEnd = blocked.endDate.toDate();
      
      return startOfDay <= blockedEnd && endOfDay >= blockedStart;
    });
  } catch (error) {
    console.error('Error getting blocked dates for specific date:', error);
    throw error;
  }
};