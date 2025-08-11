// src/firebase/firestore.js - Complete file with updated functions

import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  startAfter,
  limit,
  Timestamp,
  writeBatch,
  documentId,
  increment,
  arrayUnion,
  arrayRemove,
  firestore
} from "../services/firestoreWrapper";
import secureLogger from '../utils/secureLogger';
import organizationCacheService from '../services/organizationCacheService';
import { readCounter } from '../services/readCounter';
import sessionCacheService from '../services/sessionCacheService';
import timeEntryCacheService from '../services/timeEntryCacheService';
import sessionsCacheService from '../services/sessionsCacheService';
import dailyJobReportsCacheService from '../services/dailyJobReportsCacheService';

// Shared function to recalculate session colors for a specific date
const recalculateSessionColorsForDate = async (organizationID, date, orgData = null) => {
  try {
    // Get organization data if not provided
    if (!orgData) {
      const orgDoc = await getDoc(doc(firestore, "organizations", organizationID));
      orgData = orgDoc.data();
    }

    // Get all sessions for this date
    const sessionsQuery = query(
      collection(firestore, "sessions"),
      where("organizationID", "==", organizationID),
      where("date", "==", date)
    );
    
    const sessionsSnapshot = await getDocs(sessionsQuery);
    const allSessions = sessionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Separate time off from regular sessions
    const regularSessions = allSessions.filter(session => !session.isTimeOff);
    const timeOffSessions = allSessions.filter(session => session.isTimeOff);

    // Sort regular sessions by start time for consistent ordering
    const sortedRegularSessions = regularSessions.sort((a, b) => {
      if (a.startTime && b.startTime) {
        const timeComparison = a.startTime.localeCompare(b.startTime);
        if (timeComparison !== 0) {
          return timeComparison;
        }
        // Use school ID for consistency when times are identical
        return (a.schoolId || '').localeCompare(b.schoolId || '');
      }
      return 0;
    });

    // Calculate color function
    const getSessionColorByOrder = (orderIndex) => {
      const customColors = orgData?.sessionOrderColors;
      const defaultColors = [
        "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", 
        "#ef4444", "#06b6d4", "#8b5a3c", "#6b7280"
      ];
      const colors = customColors && customColors.length >= 8 ? customColors : defaultColors;
      return colors[orderIndex] || colors[colors.length - 1];
    };

    // Batch update session colors
    const batch = writeBatch(firestore);
    let hasUpdates = false;

    // Update regular sessions with ordered colors
    for (let i = 0; i < sortedRegularSessions.length; i++) {
      const session = sortedRegularSessions[i];
      const expectedColor = getSessionColorByOrder(i);
      if (session.sessionColor !== expectedColor) {
        batch.update(doc(firestore, "sessions", session.id), { sessionColor: expectedColor });
        hasUpdates = true;
      }
    }

    // Update time off sessions with fixed color
    for (const session of timeOffSessions) {
      const expectedColor = "#666";
      if (session.sessionColor !== expectedColor) {
        batch.update(doc(firestore, "sessions", session.id), { sessionColor: expectedColor });
        hasUpdates = true;
      }
    }

    // Commit batch updates if there are any
    if (hasUpdates) {
      await batch.commit();
    }

  } catch (error) {
  }
};

// Get user profile
export const getUserProfile = async (uid) => {
  try {
    secureLogger.debug("getUserProfile: Fetching user document", { uid });
    const userRef = doc(firestore, "users", uid);
    const userDoc = await getDoc(userRef, 'getUserProfile');
    
    secureLogger.debug("getUserProfile: Document fetched", { 
      exists: userDoc.exists(),
      uid,
      docId: userDoc.id
    });
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      secureLogger.debug("getUserProfile: User data retrieved", {
        hasData: !!userData,
        hasOrganizationID: !!userData?.organizationID,
        isActive: userData?.isActive
      });
      return { id: userDoc.id, ...userData };
    }
    
    secureLogger.warn("getUserProfile: User document does not exist", { uid });
    return null;
  } catch (error) {
    secureLogger.error("Error fetching user profile", { 
      error: error.message,
      code: error.code,
      uid 
    });
    throw error;
  }
};

// Get organization
export const getOrganization = async (organizationID) => {
  try {
    const orgDoc = await getDoc(
      doc(firestore, "organizations", organizationID),
      'getOrganization'
    );
    if (orgDoc.exists()) {
      return { id: orgDoc.id, ...orgDoc.data() };
    }
    return null;
  } catch (error) {
    secureLogger.error("Error fetching organization", error);
    throw error;
  }
};

// Create user profile following your schema
export const createUserProfile = async (uid, data) => {
  try {
    await setDoc(doc(firestore, "users", uid), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
    });
  } catch (error) {
    secureLogger.error("Error creating user profile", error);
    throw error;
  }
};

// Update user profile
export const updateUserProfile = async (uid, data) => {
  try {
    await updateDoc(doc(firestore, "users", uid), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    secureLogger.debug("User profile updated successfully");
  } catch (error) {
    secureLogger.error("Error updating user profile", error);
    throw error;
  }
};

// Update user photo with crop metadata
export const updateUserPhotoWithCrop = async (uid, photoData) => {
  try {
    await updateDoc(doc(firestore, "users", uid), {
      photoURL: photoData.croppedURL,
      originalPhotoURL: photoData.originalURL,
      photoCropSettings: photoData.cropSettings,
      updatedAt: serverTimestamp(),
    });
    secureLogger.debug("User photo and crop settings updated successfully");
  } catch (error) {
    secureLogger.error("Error updating user photo with crop settings", error);
    throw error;
  }
};

// Update user photo URL specifically
export const updateUserPhotoURL = async (uid, photoURL) => {
  try {
    await updateDoc(doc(firestore, "users", uid), {
      photoURL,
      updatedAt: serverTimestamp(),
    });
    secureLogger.debug("User photo URL updated successfully");
  } catch (error) {
    secureLogger.error("Error updating user photo URL", error);
    throw error;
  }
};

// Create organization following your schema
export const createOrganization = async (organizationData) => {
  try {
    const orgRef = await addDoc(collection(firestore, "organizations"), {
      ...organizationData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
    });
    return orgRef.id;
  } catch (error) {
    secureLogger.error("Error creating organization", error);
    throw error;
  }
};

// Update organization
export const updateOrganization = async (organizationID, data) => {
  try {
    await updateDoc(doc(firestore, "organizations", organizationID), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// Get team members for an organization (including pending invitations)
// This function should primarily be used by DataCacheContext
// Other components should use useDataCache() hook to get cached users
export const getTeamMembers = async (organizationID) => {
  try {
    const q = query(
      collection(firestore, "users"),
      where("organizationID", "==", organizationID)
      // Removed isActive filter to show both active and pending users
    );

    const querySnapshot = await getDocs(q, 'getTeamMembers');
    const members = [];

    querySnapshot.forEach((doc) => {
      members.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Sort by active status first, then by name
    const sortedMembers = members.sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return b.isActive ? 1 : -1; // Active users first
      }
      const nameA = a.displayName || `${a.firstName} ${a.lastName}` || a.email;
      const nameB = b.displayName || `${b.firstName} ${b.lastName}` || b.email;
      return nameA.localeCompare(nameB);
    });
    
    return sortedMembers;
  } catch (error) {
    throw error;
  }
};

// Invite user to organization (creates user record but they need to complete signup)
export const inviteUser = async (organizationID, inviteData) => {
  try {
    // Create a temporary UID placeholder for the invited user
    // We'll use a predictable format: "invite_" + email hash + timestamp
    const emailHash = btoa(inviteData.email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '');
    const timestamp = Date.now();
    const tempUID = `invite_${emailHash}_${timestamp}`;

    // Create a pending user record with temporary UID
    await setDoc(doc(firestore, "users", tempUID), {
      email: inviteData.email,
      firstName: inviteData.firstName,
      lastName: inviteData.lastName,
      displayName: `${inviteData.firstName} ${inviteData.lastName}`,
      role: inviteData.role,
      position: inviteData.position || "",
      organizationID,
      isActive: false, // Will be activated when they complete signup
      isTemporaryInvite: true, // Flag to identify temp invite records
      invitedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // TODO: Send invitation email here
    // For now, we just create the user record

    return tempUID;
  } catch (error) {
    throw error;
  }
};

// Get invitation by email
export const getInvitationByEmail = async (email) => {
  try {
    const q = query(
      collection(firestore, "users"),
      where("email", "==", email),
      where("isActive", "==", false)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    // Get the first matching invitation
    const doc = querySnapshot.docs[0];
    const userData = doc.data();

    // Get organization name
    const org = await getOrganization(userData.organizationID);

    return {
      id: doc.id,
      ...userData,
      organizationName: org?.name || "Unknown Organization",
    };
  } catch (error) {
    throw error;
  }
};

// Accept invitation (activate user account)
export const acceptInvitation = async (tempUserId, firebaseUid) => {
  try {
    // Get the temporary invitation user data
    const tempUserDoc = await getDoc(doc(firestore, "users", tempUserId));
    
    if (!tempUserDoc.exists()) {
      throw new Error("Invitation not found");
    }
    
    const tempUserData = tempUserDoc.data();
    
    // Verify this is a temporary invite record
    if (!tempUserData.isTemporaryInvite) {
      throw new Error("Invalid invitation record");
    }
    
    // Create the proper user document with Firebase UID as the document ID
    const finalUserData = {
      ...tempUserData,
      isActive: true,
      isTemporaryInvite: false, // Remove the temp flag
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      firebaseUid: firebaseUid, // Store Firebase UID for reference
    };
    
    // Remove fields that shouldn't be copied
    delete finalUserData.createdAt; // Will be set by setDoc
    
    // Create the new user document with Firebase UID as document ID
    await setDoc(doc(firestore, "users", firebaseUid), {
      ...finalUserData,
      createdAt: serverTimestamp(), // Reset creation time to when account was activated
    });
    
    // Clean up the temporary invitation document
    await deleteDoc(doc(firestore, "users", tempUserId));
    
  } catch (error) {
    throw error;
  }
};

// Update user role
export const updateUserRole = async (userId, newRole) => {
  try {
    await updateDoc(doc(firestore, "users", userId), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// Delete a user from the organization (admin only)
export const deleteUser = async (userId, organizationID) => {
  try {
    // Delete the user document
    await deleteDoc(doc(firestore, "users", userId));
    
    // Clear the team members cache to refresh the UI
    organizationCacheService.clearTeamMembersCache(organizationID);
    
    return { success: true };
  } catch (error) {
    throw error;
  }
};

// Utility function to clean up old temporary invite records (admin function)
export const cleanupTemporaryInvites = async (organizationID, olderThanDays = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const q = query(
      collection(firestore, "users"),
      where("organizationID", "==", organizationID),
      where("isTemporaryInvite", "==", true)
    );
    
    const querySnapshot = await getDocs(q);
    const expiredInvites = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const inviteDate = data.invitedAt?.toDate() || new Date(0);
      
      if (inviteDate < cutoffDate) {
        expiredInvites.push({
          id: doc.id,
          email: data.email,
          invitedAt: inviteDate
        });
      }
    });
    
    
    // Delete expired invites
    for (const invite of expiredInvites) {
      await deleteDoc(doc(firestore, "users", invite.id));
    }
    
    return {
      cleaned: expiredInvites.length,
      expiredInvites
    };
  } catch (error) {
    throw error;
  }
};

// Helper function to normalize date to YYYY-MM-DD format
const normalizeDateToISO = (dateInput) => {
  if (!dateInput) return null;
  
  let date;
  
  // Handle different date formats
  if (typeof dateInput === 'string') {
    // MM/DD/YYYY format
    if (dateInput.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const [month, day, year] = dateInput.split('/');
      date = new Date(year, parseInt(month) - 1, day);
    }
    // MM.DD.YYYY format
    else if (dateInput.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
      const [month, day, year] = dateInput.split('.');
      date = new Date(year, parseInt(month) - 1, day);
    }
    // YYYY-MM-DD format (already correct)
    else if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateInput;
    }
    // Try parsing as is
    else {
      date = new Date(dateInput);
    }
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    return dateInput; // Return as-is if we can't parse it
  }
  
  // Convert to YYYY-MM-DD format
  if (date && !isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return dateInput; // Return original if parsing failed
};

// Daily Job Reports Functions
export const createDailyJobReport = async (reportData) => {
  try {
    // Prepare the report data structure
    const finalReportData = {
      organizationID: reportData.organizationID,
      userId: reportData.userId,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Check if this is a template-based report
    if (reportData.templateId) {
      // Template-based report structure
      finalReportData.templateId = reportData.templateId;
      finalReportData.templateName = reportData.templateName;
      finalReportData.templateVersion = reportData.templateVersion || 1;
      
      // Core fields that all reports have
      // Normalize date to YYYY-MM-DD format for consistent storage
      finalReportData.date = normalizeDateToISO(reportData.date);
      finalReportData.yourName = reportData.photographer;
      
      // Store template-specific fields in customFields
      finalReportData.customFields = {};
      Object.keys(reportData).forEach(key => {
        if (!['organizationID', 'userId', 'templateId', 'templateName', 'templateVersion', 'date', 'photographer'].includes(key)) {
          finalReportData.customFields[key] = reportData[key];
        }
      });
    } else {
      // Legacy report structure - pass through all data but normalize date
      Object.assign(finalReportData, reportData);
      // Ensure date is normalized for legacy reports too
      if (finalReportData.date) {
        finalReportData.date = normalizeDateToISO(finalReportData.date);
      }
    }

    const reportRef = await addDoc(collection(firestore, "dailyJobReports"), finalReportData);
    return reportRef.id;
  } catch (error) {
    throw error;
  }
};

export const getDailyJobReports = async (
  organizationID,
  startDate = null,
  endDate = null,
  pageSize = 50,
  lastDocSnapshot = null
) => {
  try {
    // Check cache first if this is the first page (no lastDocSnapshot)
    if (!lastDocSnapshot) {
      const pageNum = 1;
      const cachedData = dailyJobReportsCacheService.getCachedReportsPage(organizationID, startDate, endDate, pageNum);
      if (cachedData) {
        readCounter.recordCacheHit('dailyJobReports', 'getDailyJobReports', cachedData.reports.length);
        return cachedData;
      }
      readCounter.recordCacheMiss('dailyJobReports', 'getDailyJobReports');
    }
    
    let q;
    
    // Build base query - get ALL reports for organization
    const queryConstraints = [
      where("organizationID", "==", organizationID)
    ];
    
    // Note: Date filtering will be done client-side to handle various date formats
    
    // Add ordering by timestamp (which is always consistent)
    queryConstraints.push(orderBy("timestamp", "desc"));
    queryConstraints.push(limit(pageSize));
    
    // Build the query
    let baseQuery = query(
      collection(firestore, "dailyJobReports"),
      ...queryConstraints
    );
    
    q = baseQuery;
    
    // If we have a last document, start after it
    if (lastDocSnapshot) {
      q = query(q, startAfter(lastDocSnapshot));
    }

    const querySnapshot = await getDocs(q);
    const reports = [];
    let lastDoc = null;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      reports.push({
        id: doc.id,
        ...data,
      });
      lastDoc = doc;
    });


    // Apply date filtering on client side since dates can be in different formats
    let filteredReports = reports;
    
    if (startDate || endDate) {
      // Convert filter dates to Date objects for comparison
      const startDateObj = startDate ? new Date(startDate + 'T00:00:00.000Z') : null;
      const endDateObj = endDate ? new Date(endDate + 'T23:59:59.999Z') : null;
      
      // Only filter client-side for reports that might have been missed by database query
      // (e.g., those using Timestamp format instead of string)
      const needsClientFilter = reports.some(report => {
        return report.date && typeof report.date !== 'string';
      });
      
      if (needsClientFilter) {
        
        filteredReports = reports.filter(report => {
          // If date is already a string and was caught by the query, include it
          if (typeof report.date === 'string') {
            return true;
          }
          
          // Otherwise, parse and check the date
          const reportDate = parseReportDate(report.date);
          
          if (!reportDate) {
            return false;
          }
          
          // Apply date range filters
          if (startDateObj && reportDate < startDateObj) {
            return false;
          }
          if (endDateObj && reportDate > endDateObj) {
            return false;
          }
          
          return true;
        });
        
      }
    }

    // Log sample of found reports with their parsed dates
    if (filteredReports.length <= 10) {
      filteredReports.forEach(report => {
        const parsedDate = parseReportDate(report.date);
      });
    }

    const reportsWithMileage = filteredReports.filter(r => r.totalMileage && r.totalMileage > 0);

    // Return paginated results with metadata
    const result = {
      reports: filteredReports,
      lastDoc: lastDoc,
      hasMore: reports.length === pageSize
    };
    
    // Cache the results if this is the first page
    if (!lastDocSnapshot) {
      const pageNum = 1;
      dailyJobReportsCacheService.setCachedReportsPage(organizationID, startDate, endDate, pageNum, result);
    }
    
    return result;
  } catch (error) {
    throw error;
  }
};

// Backward compatibility wrapper for getDailyJobReports
export const getDailyJobReportsSimple = async (organizationID, startDate = null, endDate = null) => {
  const result = await getDailyJobReports(organizationID, startDate, endDate, 50, null);
  return result.reports;
};

/**
 * Convert string date to Firestore Timestamp
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {boolean} endOfDay - If true, set to end of day (23:59:59)
 * @returns {Timestamp} Firestore Timestamp
 */
/**
 * Parse a report date from various formats into a JavaScript Date object
 * Handles: ISO strings, Firebase Timestamps, human-readable strings
 * @param {*} dateValue - Date value from the database
 * @returns {Date|null} Parsed Date object or null if invalid
 */
const parseReportDate = (dateValue) => {
  try {
    if (!dateValue) {
      return null;
    }
    
    // If it's already a Date object, return it
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // If it's a Firebase Timestamp, convert to Date
    if (dateValue && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // If it's a string, try to parse it
    if (typeof dateValue === 'string') {
      // Try ISO format first (2024-02-25T00:00:00.000Z)
      if (dateValue.includes('T') && (dateValue.includes('Z') || dateValue.includes('+'))) {
        const isoDate = new Date(dateValue);
        if (!isNaN(isoDate.getTime())) {
          return isoDate;
        }
      }
      
      // Try human-readable format (July 16, 2025 at 2:28:21 PM UTC-5)
      const humanDate = new Date(dateValue);
      if (!isNaN(humanDate.getTime())) {
        return humanDate;
      }
    }
    
    // Fallback: try direct Date constructor
    const fallbackDate = new Date(dateValue);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

const convertToFirestoreTimestamp = (dateString, endOfDay = false) => {
  try {
    // Handle different input types for backwards compatibility
    if (!dateString) {
      return Timestamp.now();
    }
    
    // If it's already a Timestamp, return it
    if (dateString instanceof Timestamp) {
      return dateString;
    }
    
    // If it's a Date object, convert it
    if (dateString instanceof Date) {
      return Timestamp.fromDate(dateString);
    }
    
    // Parse the date string (YYYY-MM-DD)
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return Timestamp.now();
    }
    
    if (endOfDay) {
      // Set to end of day for end date filtering
      date.setHours(23, 59, 59, 999);
    } else {
      // Set to start of day for start date filtering
      date.setHours(0, 0, 0, 0);
    }
    
    return Timestamp.fromDate(date);
  } catch (error) {
    // Fallback: return current timestamp
    return Timestamp.now();
  }
};

export const updateDailyJobReport = async (reportId, reportData) => {
  try {
    await updateDoc(doc(firestore, "dailyJobReports", reportId), {
      ...reportData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

// Delete a daily job report
export const deleteDailyJobReport = async (reportId) => {
  try {
    await deleteDoc(doc(firestore, "dailyJobReports", reportId));
    readCounter.recordRead('deleteDoc', 'dailyJobReports', 'DailyReports', 1);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Delete multiple daily job reports (batch operation)
export const deleteDailyJobReportsBatch = async (reportIds) => {
  try {
    const batch = writeBatch(firestore);
    
    reportIds.forEach(reportId => {
      const reportRef = doc(firestore, "dailyJobReports", reportId);
      batch.delete(reportRef);
    });
    
    await batch.commit();
    readCounter.recordRead('writeBatch', 'dailyJobReports', 'DailyReports', reportIds.length);
    return { success: true, deletedCount: reportIds.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Subscribe to real-time daily job reports updates (ALL reports)
export const subscribeToDailyJobReports = (organizationID, callback, errorCallback, startDate = null) => {
  // Load ALL reports for the organization to handle various date formats
  // Client-side filtering will handle date ranges

  // Simple query without date filter to get all reports
  const q = query(
    collection(firestore, "dailyJobReports"),
    where("organizationID", "==", organizationID),
    orderBy("timestamp", "desc")
  );

  const listenerTag = `full-${Date.now()}`;

  return onSnapshot(
    q,
    { component: `DailyReports-${listenerTag}`, includeMetadataChanges: false }, // Only real changes
    (snapshot) => {
      const reports = [];
      snapshot.forEach((doc) => {
        reports.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      
      if (!snapshot.metadata.fromCache) {
        // Note: Read count automatically tracked by firestoreWrapper
      }
      
      // Pass both reports and metadata
      callback(reports, { 
        totalLoaded: snapshot.size
      });
    },
    (error) => {
      if (errorCallback) errorCallback(error);
    }
  );
};

// Subscribe to new daily job reports only (optimized for cache-first approach)
export const subscribeToNewDailyJobReports = (organizationID, callback, errorCallback, latestCachedTimestamp = null) => {
  // Validate latestCachedTimestamp before using it
  let effectiveTimestamp;
  
  if (latestCachedTimestamp && latestCachedTimestamp instanceof Date && !isNaN(latestCachedTimestamp.getTime())) {
    effectiveTimestamp = latestCachedTimestamp;
  } else {
    effectiveTimestamp = new Date('2020-01-01');
    if (latestCachedTimestamp) {
    } else {
    }
  }

  // Listen only for reports newer than the effective timestamp
  // Convert JavaScript Date to Firebase Timestamp for proper comparison
  const timestampQuery = Timestamp.fromDate(effectiveTimestamp);
  
  const q = query(
    collection(firestore, "dailyJobReports"),
    where("organizationID", "==", organizationID),
    where("timestamp", ">", timestampQuery),
    orderBy("timestamp", "desc")
  );

  const listenerTag = `optimized-${Date.now()}`;
  
  try {
  } catch (err) {
  }

  return onSnapshot(
    q,
    { component: `DailyReports-${listenerTag}`, includeMetadataChanges: false },
    (snapshot) => {
      
      const newReports = [];
      snapshot.forEach((doc) => {
        newReports.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      
      
      if (!snapshot.metadata.fromCache) {
        // Note: Read count automatically tracked by firestoreWrapper
        
        // Log details about the new reports
        if (newReports.length > 0) {
        }
      }
      
      // Only call callback if there are actually new reports
      if (newReports.length > 0) {
        callback(newReports, { 
          totalLoaded: snapshot.size,
          isIncremental: true
        });
      } else {
      }
    },
    (error) => {
      if (errorCallback) errorCallback(error);
    }
  );
};

// Load older daily job reports (for "Load More" functionality)
export const getDailyJobReportsOlder = async (organizationID, beforeDate, limit = 50) => {
  try {
    const q = query(
      collection(firestore, "dailyJobReports"),
      where("organizationID", "==", organizationID),
      where("timestamp", "<", Timestamp.fromDate(beforeDate)),
      orderBy("timestamp", "desc"),
      limit(limit)
    );

    const querySnapshot = await getDocs(q);
    readCounter.recordRead('getDocs', 'dailyJobReports', 'DailyReports', querySnapshot.size);
    
    const reports = [];
    querySnapshot.forEach((doc) => {
      reports.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return reports;
  } catch (error) {
    throw error;
  }
};

// Get schools from schools collection
export const getSchools = async (organizationID) => {
  try {
    // Check cache first
    const cachedSchools = organizationCacheService.getCachedSchools(organizationID);
    if (cachedSchools) {
      // Track cache hit
      readCounter.recordCacheHit('schools', 'getSchools', cachedSchools.length);
      return cachedSchools;
    }
    
    // Track cache miss
    readCounter.recordCacheMiss('schools', 'getSchools');
    
    const q = query(
      collection(firestore, "schools"),
      where("organizationID", "==", organizationID)
    );

    const querySnapshot = await getDocs(q, 'getSchools');
    const schools = [];

    querySnapshot.forEach((doc) => {
      schools.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Cache the results
    organizationCacheService.setCachedSchools(organizationID, schools);

    return schools;
  } catch (error) {
    throw error;
  }
};

export const createSchool = async (organizationID, schoolData) => {
  try {
    const schoolRef = await addDoc(collection(firestore, "schools"), {
      ...schoolData,
      organizationID,
      districtId: schoolData.districtId || null,
      districtName: schoolData.districtName || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return schoolRef.id;
  } catch (error) {
    throw error;
  }
};

export const updateSchool = async (schoolId, schoolData) => {
  try {
    const updateData = {
      ...schoolData,
      updatedAt: serverTimestamp(),
    };
    
    // Ensure districtId and districtName are handled
    if ('districtId' in schoolData) {
      updateData.districtId = schoolData.districtId || null;
    }
    if ('districtName' in schoolData) {
      updateData.districtName = schoolData.districtName || null;
    }
    
    await updateDoc(doc(firestore, "schools", schoolId), updateData);
  } catch (error) {
    throw error;
  }
};

// Sessions Functions - NEW COLLECTION
export const getSessions = async (organizationID, startDate = null, endDate = null) => {
  try {
    // Check cache first
    const cachedSessions = sessionsCacheService.getCachedSessions(organizationID, startDate, endDate);
    if (cachedSessions) {
      readCounter.recordCacheHit('sessions', 'getSessions', cachedSessions.length);
      return cachedSessions;
    }
    readCounter.recordCacheMiss('sessions', 'getSessions');
    
    // If no date range specified, default to -30 to +30 days
    if (!startDate && !endDate) {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const thirtyDaysAhead = new Date(today);
      thirtyDaysAhead.setDate(today.getDate() + 30);
      
      startDate = thirtyDaysAgo.toISOString().split('T')[0];
      endDate = thirtyDaysAhead.toISOString().split('T')[0];
      
    }
    
    // Build query with date filtering
    let q = query(
      collection(firestore, "sessions"),
      where("organizationID", "==", organizationID)
    );
    
    if (startDate && endDate) {
      q = query(
        q,
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );
    }

    const querySnapshot = await getDocs(q);
    const sessions = [];

    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    
    
    // Cache the results
    sessionsCacheService.setCachedSessions(organizationID, sessions, startDate, endDate);

    return sessions;
  } catch (error) {
    throw error;
  }
};

// Backward compatibility wrapper for getSessions without date filtering
export const getSessionsAll = async (organizationID) => {
  // This will use the default -30 to +30 days range
  return getSessions(organizationID);
};

// Get today's sessions only - optimized query
export const getTodaySessions = async (organizationID) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(firestore, "sessions"),
      where("organizationID", "==", organizationID),
      where("date", "==", today)
    );
    const querySnapshot = await getDocs(q);
    const sessions = [];
    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    return sessions;
  } catch (error) {
    throw error;
  }
};

// Get sessions for a specific school
export const getSessionsForSchool = async (schoolId, organizationID) => {
  try {
    const q = query(
      collection(firestore, "sessions"),
      where("schoolId", "==", schoolId),
      where("organizationID", "==", organizationID),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(q);
    const sessions = [];

    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return sessions;
  } catch (error) {
    throw error;
  }
};

export const createSession = async (organizationID, sessionData) => {
  try {
    // Get organization settings to check if publishing is enabled
    const orgDoc = await getDoc(doc(firestore, "organizations", organizationID));
    const orgData = orgDoc.data();
    const enableSessionPublishing = orgData?.enableSessionPublishing || false;
    
    // Calculate session color - different logic for time off vs regular sessions
    let sessionColor = null;
    
    if (sessionData.isTimeOff) {
      // Time off sessions get a fixed color
      sessionColor = "#666";
    } else if (sessionData.date && sessionData.startTime) {
      try {
        // Get existing non-time-off sessions for the same date
        const existingSessionsQuery = query(
          collection(firestore, "sessions"),
          where("organizationID", "==", organizationID),
          where("date", "==", sessionData.date)
        );
        
        const existingSessionsSnapshot = await getDocs(existingSessionsQuery);
        const existingSessions = existingSessionsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(session => !session.isTimeOff); // Filter out time off sessions
        
        // Add the new session to the list for color calculation
        const allSessionsForDay = [...existingSessions, { ...sessionData, id: 'temp' }];
        
        // Sort by start time for consistent ordering
        const sortedSessions = allSessionsForDay.sort((a, b) => {
          if (a.startTime && b.startTime) {
            const timeComparison = a.startTime.localeCompare(b.startTime);
            if (timeComparison !== 0) {
              return timeComparison;
            }
            // Use school ID for consistency when times are identical
            return (a.schoolId || '').localeCompare(b.schoolId || '');
          }
          return 0;
        });
        
        // Find the index of our new session
        const newSessionIndex = sortedSessions.findIndex(s => s.id === 'temp');
        
        // Calculate color based on order
        const getSessionColorByOrder = (orderIndex) => {
          const customColors = orgData?.sessionOrderColors;
          const defaultColors = [
            "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", 
            "#ef4444", "#06b6d4", "#8b5a3c", "#6b7280"
          ];
          const colors = customColors && customColors.length >= 8 ? customColors : defaultColors;
          return colors[orderIndex] || colors[colors.length - 1];
        };
        
        sessionColor = getSessionColorByOrder(newSessionIndex);
        
        // Update existing sessions if their colors changed due to this insertion
        const batch = writeBatch(firestore);
        let hasUpdates = false;
        
        for (let i = 0; i < sortedSessions.length; i++) {
          const session = sortedSessions[i];
          if (session.id !== 'temp') { // Skip our new session
            const expectedColor = getSessionColorByOrder(i);
            if (session.sessionColor !== expectedColor) {
              batch.update(doc(firestore, "sessions", session.id), { sessionColor: expectedColor });
              hasUpdates = true;
            }
          }
        }
        
        if (hasUpdates) {
          await batch.commit();
        }
        
      } catch (colorError) {
        // Set a default color for regular sessions if calculation fails
        sessionColor = "#3b82f6";
      }
    } else {
      // Regular session without required fields - set default color
      sessionColor = "#3b82f6";
    }
    
    const sessionRef = await addDoc(collection(firestore, "sessions"), {
      ...sessionData,
      organizationID,
      status: sessionData.status || "scheduled",
      isPublished: !enableSessionPublishing, // Auto-publish if feature is disabled
      hasJobBoxAssigned: false,
      jobBoxRecordId: null,
      sessionColor: sessionColor, // Always include sessionColor field
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    const sessionId = sessionRef.id;
    
    // Auto-create workflows for all session types
    try {
      // Get all session types for this session
      const sessionTypes = sessionData.sessionTypes || 
                          (sessionData.sessionType ? [sessionData.sessionType] : ['other']);
      
      
      // Store session creation info for debugging
      localStorage.setItem('lastSessionCreated', JSON.stringify({
        sessionId,
        organizationID,
        sessionTypes,
        timestamp: new Date().toISOString()
      }));
      
      const workflowResults = [];
      
      // Create a separate workflow for each session type
      for (let i = 0; i < sessionTypes.length; i++) {
        const sessionType = sessionTypes[i];
        
        try {
          const workflowId = await autoCreateWorkflowForSession(
            sessionId, 
            organizationID, 
            sessionType
          );
          
          if (workflowId) {
            
            // Verify workflow was created
            const workflowDoc = await getDoc(doc(firestore, "workflows", workflowId));
            if (workflowDoc.exists()) {
              workflowResults.push({
                success: true,
                workflowId,
                sessionType,
                templateName: workflowDoc.data().templateName
              });
            } else {
              workflowResults.push({
                success: false,
                error: 'Workflow ID returned but document does not exist',
                sessionType
              });
            }
          } else {
            workflowResults.push({
              success: false,
              error: 'No workflow ID returned',
              sessionType
            });
          }
        } catch (workflowError) {
          workflowResults.push({
            success: false,
            error: workflowError.message,
            sessionType
          });
        }
      }
      
      // Store comprehensive results
      const successfulWorkflows = workflowResults.filter(r => r.success);
      const failedWorkflows = workflowResults.filter(r => !r.success);
      
      if (successfulWorkflows.length > 0) {
      }
      if (failedWorkflows.length > 0) {
      }
      
      localStorage.setItem('lastWorkflowResult', JSON.stringify({
        success: successfulWorkflows.length > 0,
        totalAttempted: sessionTypes.length,
        successCount: successfulWorkflows.length,
        failureCount: failedWorkflows.length,
        results: workflowResults,
        sessionId,
        timestamp: new Date().toISOString()
      }));
      
      // Continue with success if at least one workflow was created
      if (successfulWorkflows.length === 0) {
        localStorage.setItem('lastWorkflowResult', JSON.stringify({
          success: false,
          error: 'No workflows were created for any session type',
          sessionId,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (workflowError) {
      localStorage.setItem('lastWorkflowResult', JSON.stringify({
        success: false,
        error: workflowError.message,
        sessionId,
        timestamp: new Date().toISOString()
      }));
      // Don't fail the session creation if workflow creation fails
    }
    
    return sessionId;
  } catch (error) {
    throw error;
  }
};

export const updateSession = async (sessionId, updateData) => {
  try {
    const sessionRef = doc(firestore, "sessions", sessionId);

    // Get current session data to check for status changes
    const currentSessionDoc = await getDoc(sessionRef);
    const currentSession = currentSessionDoc.exists() ? currentSessionDoc.data() : null;

    // Check if update affects session ordering (date or startTime changes)
    const affectsOrdering = updateData.date || updateData.startTime;
    const oldDate = currentSession?.date;
    const newDate = updateData.date || oldDate;

    // Add timestamp to track when the update occurred
    const dataWithTimestamp = {
      ...updateData,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(sessionRef, dataWithTimestamp);

    // Clear the session from cache to ensure fresh data on next read
    sessionCacheService.clearCachedSession(sessionId);

    // Recalculate colors if session ordering might have changed
    if (affectsOrdering && currentSession?.organizationID) {
      try {
        // Recalculate colors for old date if date changed
        if (updateData.date && oldDate && oldDate !== newDate) {
          await recalculateSessionColorsForDate(currentSession.organizationID, oldDate);
        }
        
        // Recalculate colors for new/current date
        await recalculateSessionColorsForDate(currentSession.organizationID, newDate);
      } catch (colorError) {
      }
    }

    // Note: Workflow creation now happens when session is created, not when completed

    return true;
  } catch (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }
};

// Publish a single session
export const publishSession = async (sessionId) => {
  try {
    const sessionRef = doc(firestore, "sessions", sessionId);
    await updateDoc(sessionRef, {
      isPublished: true,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    throw new Error(`Failed to publish session: ${error.message}`);
  }
};

// Publish multiple sessions
export const publishMultipleSessions = async (sessionIds) => {
  try {
    const batch = writeBatch(firestore);
    const publishData = {
      isPublished: true,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    sessionIds.forEach(sessionId => {
      const sessionRef = doc(firestore, "sessions", sessionId);
      batch.update(sessionRef, publishData);
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    throw new Error(`Failed to publish sessions: ${error.message}`);
  }
};

export const deleteSession = async (sessionId, organizationID = null) => {
  try {
    
    // Get session data before deletion for color recalculation
    let sessionData = null;
    try {
      const sessionDoc = await getDoc(doc(firestore, "sessions", sessionId));
      if (sessionDoc.exists()) {
        sessionData = sessionDoc.data();
      }
    } catch (error) {
    }
    
    // First, find and delete all workflows associated with this session
    const associatedWorkflows = await getWorkflowsForSession(sessionId, organizationID);
    
    if (associatedWorkflows.length > 0) {
      
      // Delete each workflow
      const deletionResults = [];
      for (const workflow of associatedWorkflows) {
        try {
          await deleteWorkflowInstance(workflow.id);
          deletionResults.push({ workflowId: workflow.id, success: true });
        } catch (workflowError) {
          deletionResults.push({ 
            workflowId: workflow.id, 
            success: false, 
            error: workflowError.message 
          });
        }
      }
      
      const successfulDeletions = deletionResults.filter(r => r.success).length;
      const failedDeletions = deletionResults.filter(r => !r.success).length;
      
      
      if (failedDeletions > 0) {
      }
    } else {
    }
    
    // Delete the session
    await deleteDoc(doc(firestore, "sessions", sessionId));
    
    // Recalculate session colors for the date if we have session data
    if (sessionData?.date && sessionData?.organizationID) {
      try {
        await recalculateSessionColorsForDate(sessionData.organizationID, sessionData.date);
      } catch (colorError) {
      }
    }
    
  } catch (error) {
    throw error;
  }
};

export const getSession = async (sessionId) => {
  try {
    // Check cache first
    const cached = sessionCacheService.getCachedSession(sessionId);
    if (cached) {
      readCounter.recordCacheHit('sessions', 'getSession', 1);
      return cached;
    }
    
    readCounter.recordCacheMiss('sessions', 'getSession');
    const sessionDoc = await getDoc(doc(firestore, "sessions", sessionId));
    if (sessionDoc.exists()) {
      const session = { id: sessionDoc.id, ...sessionDoc.data() };
      // Cache the session
      sessionCacheService.setCachedSession(sessionId, session);
      return session;
    }
    return null;
  } catch (error) {
    // Don't log permission errors - these are expected when accessing sessions from other orgs
    if (error.code !== 'permission-denied') {
    }
    throw error;
  }
};


// Batch get multiple sessions efficiently
export const getSessionsBatch = async (sessionIds) => {
  try {
    if (!sessionIds || sessionIds.length === 0) {
      return {};
    }

    // Check cache first
    const { cachedSessions, missingIds } = sessionCacheService.getCachedSessions(sessionIds);
    
    if (cachedSessions && Object.keys(cachedSessions).length > 0) {
      readCounter.recordCacheHit('sessions', 'getSessionsBatch', Object.keys(cachedSessions).length);
    }
    
    if (missingIds.length === 0) {
      return cachedSessions;
    }
    
    readCounter.recordCacheMiss('sessions', 'getSessionsBatch-partial');
    
    // Batch fetch missing sessions (Firestore 'in' query limit is 10)
    const sessions = { ...cachedSessions };
    const chunks = [];
    
    for (let i = 0; i < missingIds.length; i += 10) {
      chunks.push(missingIds.slice(i, i + 10));
    }
    
    await Promise.all(chunks.map(async (chunk) => {
      const q = query(
        collection(firestore, "sessions"),
        where(documentId(), "in", chunk)
      );
      
      const snapshot = await getDocs(q, 'getSessionsBatch');
      snapshot.forEach(doc => {
        const session = { id: doc.id, ...doc.data() };
        sessions[doc.id] = session;
        // Cache each session
        sessionCacheService.setCachedSession(doc.id, session);
      });
    }));
    
    // Handle sessions that don't exist or we don't have permission for
    missingIds.forEach(id => {
      if (!sessions[id]) {
        sessions[id] = null;
      }
    });
    
    return sessions;
  } catch (error) {
    throw error;
  }
};

// Legacy Sports Jobs Functions (for compatibility if needed)
export const getSportsJobs = async (organizationID, isArchived = false) => {
  try {
    const q = query(
      collection(firestore, "sportsJobs"),
      where("organizationID", "==", organizationID),
      where("isArchived", "==", isArchived)
    );

    const querySnapshot = await getDocs(q);
    const jobs = [];

    querySnapshot.forEach((doc) => {
      jobs.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return jobs;
  } catch (error) {
    throw error;
  }
};

export const createSportsJob = async (organizationID, jobData) => {
  try {
    const jobRef = await addDoc(collection(firestore, "sportsJobs"), {
      ...jobData,
      organizationID,
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return jobRef.id;
  } catch (error) {
    throw error;
  }
};

export const updateSportsJob = async (jobId, updateData) => {
  try {
    const jobRef = doc(firestore, "sportsJobs", jobId);

    // Add timestamp to track when the update occurred
    const dataWithTimestamp = {
      ...updateData,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(jobRef, dataWithTimestamp);

    return true;
  } catch (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }
};

// Equipment Tracking Functions
export const getJobBoxes = async (organizationID) => {
  try {
    const q = query(
      collection(firestore, "jobBoxes"),
      where("organizationID", "==", organizationID)
    );

    const querySnapshot = await getDocs(q);
    const boxes = [];

    querySnapshot.forEach((doc) => {
      boxes.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return boxes;
  } catch (error) {
    throw error;
  }
};

export const updateJobBoxStatus = async (
  boxId,
  status,
  photographer = null,
  school = null
) => {
  try {
    const updateData = {
      status,
      timestamp: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (photographer) updateData.photographer = photographer;
    if (school) updateData.school = school;

    await updateDoc(doc(firestore, "jobBoxes", boxId), updateData);
  } catch (error) {
    throw error;
  }
};

export const getSDCards = async (organizationID) => {
  try {
    const q = query(
      collection(firestore, "sdCards"),
      where("organizationID", "==", organizationID)
    );

    const querySnapshot = await getDocs(q);
    const cards = [];

    querySnapshot.forEach((doc) => {
      cards.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return cards;
  } catch (error) {
    throw error;
  }
};

export const updateSDCardStatus = async (
  cardId,
  status,
  photographer = null,
  school = null
) => {
  try {
    const updateData = {
      status,
      timestamp: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (photographer) updateData.photographer = photographer;
    if (school) updateData.school = school;

    await updateDoc(doc(firestore, "sdCards", cardId), updateData);
  } catch (error) {
    throw error;
  }
};

// Report Templates Functions
export const getReportTemplates = async (organizationID, shootType = null) => {
  try {
    
    if (!organizationID) {
      throw new Error("Organization ID is required");
    }
    
    let q = query(
      collection(firestore, "reportTemplates"),
      where("organizationID", "==", organizationID),
      where("isActive", "==", true)
    );

    if (shootType) {
      q = query(q, where("shootType", "==", shootType));
    }

    const querySnapshot = await getDocs(q);
    const templates = [];

    querySnapshot.forEach((doc) => {
      templates.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return templates;
  } catch (error) {
    throw error;
  }
};

export const createReportTemplate = async (templateData) => {
  try {
    
    // Validate required fields
    if (!templateData.name) {
      throw new Error("Template name is required");
    }
    if (!templateData.organizationID) {
      throw new Error("Organization ID is required");
    }
    if (!templateData.fields || !Array.isArray(templateData.fields)) {
      throw new Error("Template fields must be an array");
    }
    
    const templateRef = await addDoc(
      collection(firestore, "reportTemplates"),
      {
        ...templateData,
        isActive: true,
        version: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
    
    return templateRef.id;
  } catch (error) {
    throw error;
  }
};

// Update report template
export const updateReportTemplate = async (templateId, templateData) => {
  try {
    
    if (!templateId) {
      throw new Error("Template ID is required");
    }
    
    await updateDoc(doc(firestore, "reportTemplates", templateId), {
      ...templateData,
      updatedAt: serverTimestamp(),
    });
    
  } catch (error) {
    throw error;
  }
};

// Delete report template
export const deleteReportTemplate = async (templateId) => {
  try {
    
    if (!templateId) {
      throw new Error("Template ID is required");
    }
    
    await deleteDoc(doc(firestore, "reportTemplates", templateId));
  } catch (error) {
    throw error;
  }
};

// Get single report template
export const getReportTemplate = async (templateId) => {
  try {
    const templateDoc = await getDoc(doc(firestore, "reportTemplates", templateId));
    if (templateDoc.exists()) {
      return { id: templateDoc.id, ...templateDoc.data() };
    }
    return null;
  } catch (error) {
    throw error;
  }
};

// Set default template for a shoot type
export const setDefaultTemplate = async (organizationID, shootType, templateId) => {
  try {
    // First, remove default flag from all templates of this shoot type
    const q = query(
      collection(firestore, "reportTemplates"),
      where("organizationID", "==", organizationID),
      where("shootType", "==", shootType),
      where("isDefault", "==", true)
    );
    
    const snapshot = await getDocs(q);
    const batch = [];
    
    snapshot.forEach((doc) => {
      batch.push(updateDoc(doc.ref, { isDefault: false }));
    });
    
    // Wait for all updates to complete
    await Promise.all(batch);
    
    // Set the new default template
    await updateDoc(doc(firestore, "reportTemplates", templateId), {
      isDefault: true,
      updatedAt: serverTimestamp(),
    });
    
  } catch (error) {
    throw error;
  }
};

// Time Tracking Functions

// Clock in - creates a new time entry
export const clockIn = async (userId, organizationID, sessionId = null, notes = null) => {
  try {
    const now = new Date();
    // Use local timezone to get today's date consistently
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Check if user is already clocked in
    const existingEntry = await getCurrentTimeEntry(userId, organizationID);
    if (existingEntry) {
      throw new Error("User is already clocked in. Please clock out first.");
    }

    const timeEntryData = {
      userId,
      organizationID,
      clockInTime: serverTimestamp(),
      date: today,
      status: "clocked-in",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (sessionId) {
      timeEntryData.sessionId = sessionId;
    }

    if (notes) {
      timeEntryData.notes = notes;
    }

    const docRef = await addDoc(collection(firestore, "timeEntries"), timeEntryData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Clock out - updates existing time entry
export const clockOut = async (userId, organizationID, notes = null) => {
  try {
    const currentEntry = await getCurrentTimeEntry(userId, organizationID);
    
    if (!currentEntry) {
      throw new Error("No active time entry found. Please clock in first.");
    }

    const updateData = {
      clockOutTime: serverTimestamp(),
      status: "clocked-out",
      updatedAt: serverTimestamp(),
    };

    if (notes) {
      updateData.notes = notes;
    }

    await updateDoc(doc(firestore, "timeEntries", currentEntry.id), updateData);
    return currentEntry.id;
  } catch (error) {
    throw error;
  }
};

// Clock out with manual date/time (for fixing forgotten clock outs)
export const clockOutManual = async (userId, organizationID, clockOutDateTime, notes = null) => {
  try {
    const currentEntry = await getCurrentTimeEntry(userId, organizationID);
    
    if (!currentEntry) {
      throw new Error("No active time entry found. Please clock in first.");
    }

    // Get the clock in time to validate
    const clockInTime = currentEntry.clockInTime?.toDate ? 
      currentEntry.clockInTime.toDate() : 
      new Date(currentEntry.clockInTime);
    
    // Validate clock out time is after clock in
    if (clockOutDateTime <= clockInTime) {
      throw new Error("Clock out time must be after clock in time.");
    }
    
    // Validate clock out is not in the future
    if (clockOutDateTime > new Date()) {
      throw new Error("Cannot clock out in the future.");
    }
    
    // Validate shift is not longer than 24 hours
    const diffHours = (clockOutDateTime - clockInTime) / (1000 * 60 * 60);
    if (diffHours > 24) {
      throw new Error("Shift cannot exceed 24 hours.");
    }

    const updateData = {
      clockOutTime: Timestamp.fromDate(clockOutDateTime),
      status: "clocked-out",
      updatedAt: serverTimestamp(),
    };

    if (notes) {
      updateData.notes = notes;
    }

    await updateDoc(doc(firestore, "timeEntries", currentEntry.id), updateData);
    return currentEntry.id;
  } catch (error) {
    throw error;
  }
};

// Get current active time entry for a user
export const getCurrentTimeEntry = async (userId, organizationID) => {
  try {
    const q = query(
      collection(firestore, "timeEntries"),
      where("userId", "==", userId),
      where("organizationID", "==", organizationID),
      where("status", "==", "clocked-in")
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    // Return the first (and should be only) active entry
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    throw error;
  }
};

// Get time entries for a user within a date range
export const getTimeEntries = async (userId, organizationID, startDate = null, endDate = null) => {
  try {
    let q = query(
      collection(firestore, "timeEntries"),
      where("userId", "==", userId),
      where("organizationID", "==", organizationID),
      orderBy("clockInTime", "desc")
    );

    if (startDate && endDate) {
      q = query(q, where("date", ">=", startDate), where("date", "<=", endDate));
    }

    const querySnapshot = await getDocs(q);
    const entries = [];

    querySnapshot.forEach((doc) => {
      entries.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return entries;
  } catch (error) {
    throw error;
  }
};

// Get time entries for all users in organization (admin function)
export const getAllTimeEntries = async (organizationID, startDate = null, endDate = null) => {
  try {
    let q = query(
      collection(firestore, "timeEntries"),
      where("organizationID", "==", organizationID),
      orderBy("clockInTime", "desc")
    );

    if (startDate && endDate) {
      q = query(q, where("date", ">=", startDate), where("date", "<=", endDate));
    }

    const querySnapshot = await getDocs(q);
    const entries = [];

    querySnapshot.forEach((doc) => {
      entries.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return entries;
  } catch (error) {
    throw error;
  }
};

// Get today's time entries for a user
export const getTodayTimeEntries = async (userId, organizationID) => {
  try {
    // Use local timezone to get today's date consistently
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return await getTimeEntries(userId, organizationID, todayString, todayString);
  } catch (error) {
    throw error;
  }
};

// Get week's time entries for a user
export const getWeekTimeEntries = async (userId, organizationID, startDate, endDate) => {
  try {
    const formatDate = (date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    
    const startString = formatDate(startDate);
    const endString = formatDate(endDate);
    
    return await getTimeEntries(userId, organizationID, startString, endString);
  } catch (error) {
    throw error;
  }
};

// Get upcoming sessions for a user
export const getUserUpcomingSessions = async (userId, organizationID, daysAhead = 7) => {
  try {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysAhead);
    
    const formatDate = (date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    
    const todayString = formatDate(today);
    const endString = formatDate(endDate);
    
    const sessionsRef = collection(firestore, 'sessions');
    const q = query(
      sessionsRef,
      where('organizationID', '==', organizationID),
      where('date', '>=', todayString),
      where('date', '<=', endString),
      orderBy('date', 'asc'),
      orderBy('startTime', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const sessions = [];
    
    querySnapshot.forEach((doc) => {
      const sessionData = doc.data();
      // Check if user is assigned to this session
      const isAssigned = sessionData.photographers && 
        sessionData.photographers.some(photographer => photographer.id === userId);
      
      if (isAssigned) {
        sessions.push({
          id: doc.id,
          ...sessionData
        });
      }
    });
    
    return sessions;
  } catch (error) {
    throw error;
  }
};

// Calculate total hours for time entries
export const calculateTotalHours = (timeEntries) => {
  let totalMilliseconds = 0;

  timeEntries.forEach(entry => {
    if (entry.clockInTime && entry.clockOutTime) {
      const clockIn = entry.clockInTime.toDate ? entry.clockInTime.toDate() : new Date(entry.clockInTime);
      const clockOut = entry.clockOutTime.toDate ? entry.clockOutTime.toDate() : new Date(entry.clockOutTime);
      totalMilliseconds += clockOut.getTime() - clockIn.getTime();
    }
  });

  // Convert to hours
  return totalMilliseconds / (1000 * 60 * 60);
};

// Format duration in decimal hours
export const formatDuration = (hours) => {
  // Round to 2 decimal places
  return hours.toFixed(2);
};

// Check for time overlap with existing entries (sanitized to prevent data exposure)
export const checkTimeOverlap = async (userId, organizationID, startTime, endTime, excludeEntryId = null) => {
  try {
    // Extract date from startTime using local timezone to avoid UTC conversion issues
    const date = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')}`;
    
    // Query for time entries on the same date
    const q = query(
      collection(firestore, "timeEntries"),
      where("userId", "==", userId),
      where("organizationID", "==", organizationID),
      where("date", "==", date),
      where("status", "==", "clocked-out")
    );
    
    const snapshot = await getDocs(q);
    let overlapCount = 0;
    
    snapshot.forEach((doc) => {
      const entry = { id: doc.id, ...doc.data() };
      
      // Skip the entry we're excluding (for updates)
      if (excludeEntryId && entry.id === excludeEntryId) {
        return;
      }
      
      // Convert timestamps to Date objects
      const entryStart = entry.clockInTime.toDate ? entry.clockInTime.toDate() : new Date(entry.clockInTime);
      const entryEnd = entry.clockOutTime.toDate ? entry.clockOutTime.toDate() : new Date(entry.clockOutTime);
      
      // Check for overlap: (start1 < end2) && (start2 < end1)
      if (startTime < entryEnd && entryStart < endTime) {
        overlapCount++;
      }
    });
    
    // Return sanitized response without exposing specific time data
    return {
      hasOverlap: overlapCount > 0,
      conflictCount: overlapCount
    };
  } catch (error) {
    throw error;
  }
};

// Manual time entry creation (admin function)
export const createManualTimeEntry = async (timeEntryData) => {
  try {
    // Check for time overlaps before creating
    if (timeEntryData.clockInTime && timeEntryData.clockOutTime) {
      const overlapResult = await checkTimeOverlap(
        timeEntryData.userId,
        timeEntryData.organizationID,
        timeEntryData.clockInTime,
        timeEntryData.clockOutTime
      );
      
      if (overlapResult.hasOverlap) {
        throw new Error(`Time overlap detected with ${overlapResult.conflictCount} existing time ${overlapResult.conflictCount === 1 ? 'entry' : 'entries'}. Please adjust your times.`);
      }
    }

    const docRef = await addDoc(collection(firestore, "timeEntries"), {
      ...timeEntryData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// Update time entry (admin function)
export const updateTimeEntry = async (entryId, updateData) => {
  try {
    await updateDoc(doc(firestore, "timeEntries", entryId), {
      ...updateData,
      updatedAt: serverTimestamp(),
    });
    
  } catch (error) {
    throw error;
  }
};

// Delete time entry (admin function)
export const deleteTimeEntry = async (entryId) => {
  try {
    await deleteDoc(doc(firestore, "timeEntries", entryId));
  } catch (error) {
    throw error;
  }
};

// Session and School Hour Tracking Statistics

// Get total hours worked for a specific session
export const getSessionHours = async (sessionId, organizationID) => {
  try {
    const q = query(
      collection(firestore, "timeEntries"),
      where("sessionId", "==", sessionId),
      where("organizationID", "==", organizationID),
      where("status", "==", "clocked-out")
    );

    const querySnapshot = await getDocs(q);
    const entries = [];

    querySnapshot.forEach((doc) => {
      entries.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    const totalHours = calculateTotalHours(entries);
    
    return {
      sessionId,
      totalHours,
      totalEntries: entries.length,
      entries
    };
  } catch (error) {
    throw error;
  }
};

// Get total hours worked at a specific school
export const getSchoolHours = async (schoolId, organizationID, startDate = null, endDate = null) => {
  try {
    // First, get all sessions for this school
    const sessionsQuery = query(
      collection(firestore, "sessions"),
      where("schoolId", "==", schoolId),
      where("organizationID", "==", organizationID)
    );
    
    const sessionsSnapshot = await getDocs(sessionsQuery);
    const sessionIds = [];
    const sessions = {};
    
    sessionsSnapshot.forEach((doc) => {
      const sessionData = { id: doc.id, ...doc.data() };
      sessionIds.push(doc.id);
      sessions[doc.id] = sessionData;
    });

    if (sessionIds.length === 0) {
      return {
        schoolId,
        totalHours: 0,
        totalEntries: 0,
        sessionBreakdown: [],
        entries: []
      };
    }

    // Get all time entries for these sessions
    let timeEntriesQuery = query(
      collection(firestore, "timeEntries"),
      where("organizationID", "==", organizationID),
      where("status", "==", "clocked-out")
    );

    if (startDate && endDate) {
      timeEntriesQuery = query(
        timeEntriesQuery,
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );
    }

    const timeEntriesSnapshot = await getDocs(timeEntriesQuery);
    const schoolEntries = [];

    timeEntriesSnapshot.forEach((doc) => {
      const entry = { id: doc.id, ...doc.data() };
      if (entry.sessionId && sessionIds.includes(entry.sessionId)) {
        schoolEntries.push(entry);
      }
    });

    // Calculate session breakdown
    const sessionBreakdown = {};
    schoolEntries.forEach(entry => {
      const session = sessions[entry.sessionId];
      if (session) {
        const sessionType = session.sessionType || 'Unknown';
        if (!sessionBreakdown[sessionType]) {
          sessionBreakdown[sessionType] = {
            sessionType,
            hours: 0,
            count: 0,
            entries: []
          };
        }
        sessionBreakdown[sessionType].hours += calculateTotalHours([entry]);
        sessionBreakdown[sessionType].count += 1;
        sessionBreakdown[sessionType].entries.push(entry);
      }
    });

    const totalHours = calculateTotalHours(schoolEntries);
    
    return {
      schoolId,
      totalHours,
      totalEntries: schoolEntries.length,
      sessionBreakdown: Object.values(sessionBreakdown),
      entries: schoolEntries
    };
  } catch (error) {
    throw error;
  }
};

// Get session-level statistics for a user
export const getUserSessionStats = async (userId, organizationID, startDate = null, endDate = null) => {
  try {
    let q = query(
      collection(firestore, "timeEntries"),
      where("userId", "==", userId),
      where("organizationID", "==", organizationID),
      where("status", "==", "clocked-out")
    );

    if (startDate && endDate) {
      q = query(q, where("date", ">=", startDate), where("date", "<=", endDate));
    }

    const querySnapshot = await getDocs(q);
    const entries = [];

    querySnapshot.forEach((doc) => {
      entries.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Group entries by session
    const sessionStats = {};
    
    for (const entry of entries) {
      if (entry.sessionId) {
        if (!sessionStats[entry.sessionId]) {
          sessionStats[entry.sessionId] = {
            sessionId: entry.sessionId,
            hours: 0,
            entries: [],
            sessionData: null
          };
        }
        sessionStats[entry.sessionId].hours += calculateTotalHours([entry]);
        sessionStats[entry.sessionId].entries.push(entry);
      }
    }

    // Get session details for each session
    const sessionStatsWithDetails = [];
    for (const sessionId of Object.keys(sessionStats)) {
      try {
        const sessionDoc = await getDoc(doc(firestore, "sessions", sessionId));
        if (sessionDoc.exists()) {
          const sessionData = sessionDoc.data();
          sessionStatsWithDetails.push({
            ...sessionStats[sessionId],
            sessionData: {
              schoolName: sessionData.schoolName,
              sessionType: sessionData.sessionType,
              date: sessionData.date,
              startTime: sessionData.startTime,
              endTime: sessionData.endTime
            }
          });
        }
      } catch (error) {
      }
    }

    // Sort by total hours (highest first)
    sessionStatsWithDetails.sort((a, b) => b.hours - a.hours);

    return {
      userId,
      totalSessions: sessionStatsWithDetails.length,
      totalHours: calculateTotalHours(entries),
      sessionStats: sessionStatsWithDetails
    };
  } catch (error) {
    throw error;
  }
};

// Get school-level statistics for a user
export const getUserSchoolStats = async (userId, organizationID, startDate = null, endDate = null) => {
  try {
    let q = query(
      collection(firestore, "timeEntries"),
      where("userId", "==", userId),
      where("organizationID", "==", organizationID),
      where("status", "==", "clocked-out")
    );

    if (startDate && endDate) {
      q = query(q, where("date", ">=", startDate), where("date", "<=", endDate));
    }

    const querySnapshot = await getDocs(q);
    const entries = [];

    querySnapshot.forEach((doc) => {
      entries.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Group entries by school (via session)
    const schoolStats = {};
    
    for (const entry of entries) {
      if (entry.sessionId) {
        try {
          const sessionDoc = await getDoc(doc(firestore, "sessions", entry.sessionId));
          if (sessionDoc.exists()) {
            const sessionData = sessionDoc.data();
            const schoolId = sessionData.schoolId;
            const schoolName = sessionData.schoolName;
            
            if (!schoolStats[schoolId]) {
              schoolStats[schoolId] = {
                schoolId,
                schoolName,
                hours: 0,
                entries: [],
                sessionCount: new Set()
              };
            }
            
            schoolStats[schoolId].hours += calculateTotalHours([entry]);
            schoolStats[schoolId].entries.push(entry);
            schoolStats[schoolId].sessionCount.add(entry.sessionId);
          }
        } catch (error) {
        }
      }
    }

    // Convert Set to count and sort by hours
    const schoolStatsArray = Object.values(schoolStats).map(school => ({
      ...school,
      sessionCount: school.sessionCount.size
    })).sort((a, b) => b.hours - a.hours);

    return {
      userId,
      totalSchools: schoolStatsArray.length,
      totalHours: calculateTotalHours(entries),
      schoolStats: schoolStatsArray
    };
  } catch (error) {
    throw error;
  }
};

// ===========================
// WORKFLOW MANAGEMENT FUNCTIONS
// ===========================

// Workflow Templates Functions
export const getWorkflowTemplates = async (organizationID, sessionType = null) => {
  try {
    let q = query(
      collection(firestore, "workflowTemplates"),
      where("organizationID", "==", organizationID),
      where("isActive", "==", true)
    );

    if (sessionType) {
      q = query(q, where("sessionTypes", "array-contains", sessionType));
    }

    const querySnapshot = await getDocs(q);
    const templates = [];

    querySnapshot.forEach((doc) => {
      templates.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return templates;
  } catch (error) {
    throw error;
  }
};

export const createWorkflowTemplate = async (templateData) => {
  try {
    const templateRef = await addDoc(collection(firestore, "workflowTemplates"), {
      ...templateData,
      isActive: true,
      version: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return templateRef.id;
  } catch (error) {
    throw error;
  }
};

export const updateWorkflowTemplate = async (templateId, templateData) => {
  try {
    await updateDoc(doc(firestore, "workflowTemplates", templateId), {
      ...templateData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw error;
  }
};

export const deleteWorkflowTemplate = async (templateId) => {
  try {
    
    const templateRef = doc(firestore, "workflowTemplates", templateId);
    
    // First check if template exists
    const templateDoc = await getDoc(templateRef);
    if (!templateDoc.exists()) {
      throw new Error(`Template with ID ${templateId} does not exist`);
    }
    
    
    // Permanently delete the document from Firestore
    await deleteDoc(templateRef);
    
  } catch (error) {
    throw error;
  }
};

export const getWorkflowTemplate = async (templateId) => {
  try {
    const templateDoc = await getDoc(doc(firestore, "workflowTemplates", templateId));
    if (templateDoc.exists()) {
      return { id: templateDoc.id, ...templateDoc.data() };
    }
    return null;
  } catch (error) {
    // Only log permission errors as warnings
    if (error.code === 'permission-denied') {
      return null;
    }
    throw error;
  }
};

// Get all workflow templates for organization (including inactive ones)
export const getWorkflowTemplatesForOrganization = async (organizationID) => {
  try {
    const q = query(
      collection(firestore, "workflowTemplates"),
      where("organizationID", "==", organizationID),
      orderBy("name", "asc")
    );

    const querySnapshot = await getDocs(q);
    const templates = [];
    querySnapshot.forEach((doc) => {
      templates.push({ id: doc.id, ...doc.data() });
    });

    return templates;
  } catch (error) {
    throw error;
  }
};

// Workflow Instances Functions
export const createWorkflowInstance = async (workflowData) => {
  try {
    const workflowRef = await addDoc(collection(firestore, "workflows"), {
      ...workflowData,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return workflowRef.id;
  } catch (error) {
    throw error;
  }
};

// Delete a workflow instance
export const deleteWorkflowInstance = async (workflowId) => {
  try {
    await deleteDoc(doc(firestore, "workflows", workflowId));
  } catch (error) {
    throw error;
  }
};

// Get a single workflow by ID
export const getWorkflow = async (workflowId) => {
  try {
    const workflowDoc = await getDoc(doc(firestore, "workflows", workflowId));
    if (workflowDoc.exists()) {
      return { id: workflowDoc.id, ...workflowDoc.data() };
    }
    return null;
  } catch (error) {
    throw error;
  }
};

export const getWorkflowsForSession = async (sessionId, organizationID = null) => {
  try {
    // Query workflows for a specific session
    // Include organizationID filter for security compliance
    let q;
    if (organizationID) {
      q = query(
        collection(firestore, "workflows"),
        where("sessionId", "==", sessionId),
        where("organizationID", "==", organizationID)
      );
    } else {
      // Fallback to sessionId only query (may fail with permissions)
      q = query(
        collection(firestore, "workflows"),
        where("sessionId", "==", sessionId)
      );
    }

    const querySnapshot = await getDocs(q);
    const workflows = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Filter out deleted workflows on client side
      if (data.status !== "deleted") {
        workflows.push({
          id: doc.id,
          ...data,
        });
      }
    });

    return workflows;
  } catch (error) {
    throw error;
  }
};

export const getWorkflowsForOrganization = async (organizationID, status = null) => {
  try {
    // Simplified query to avoid needing composite indexes initially
    let q = query(
      collection(firestore, "workflows"),
      where("organizationID", "==", organizationID)
    );

    const querySnapshot = await getDocs(q, 'getWorkflowsForOrganization');
    const workflows = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Filter out deleted workflows and apply status filter in client
      if (data.status !== "deleted" && (!status || data.status === status)) {
        workflows.push({
          id: doc.id,
          ...data,
        });
      }
    });

    // Sort by status and updatedAt on client side
    workflows.sort((a, b) => {
      if (a.status !== b.status) {
        const statusOrder = { 'active': 0, 'on_hold': 1, 'completed': 2, 'cancelled': 3 };
        return (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999);
      }
      
      const aTime = a.updatedAt?.toDate?.() || new Date(a.updatedAt || 0);
      const bTime = b.updatedAt?.toDate?.() || new Date(b.updatedAt || 0);
      return bTime.getTime() - aTime.getTime();
    });

    return workflows;
  } catch (error) {
    throw error;
  }
};

// Enhanced workflow retrieval with type filtering
export const getWorkflowsWithFilters = async (organizationID, filters = {}) => {
  try {
    const {
      workflowType = null, // 'session' or 'tracking'
      status = null,
      schoolId = null,
      trackingType = null,
      academicYear = null,
      sessionId = null
    } = filters;

    // Get all workflows for organization
    const allWorkflows = await getWorkflowsForOrganization(organizationID, status);
    
    // Apply client-side filtering
    let filteredWorkflows = allWorkflows;
    
    if (workflowType) {
      if (workflowType === 'tracking') {
        filteredWorkflows = filteredWorkflows.filter(w => w.workflowType === 'tracking');
      } else if (workflowType === 'session') {
        filteredWorkflows = filteredWorkflows.filter(w => w.sessionId && w.workflowType !== 'tracking');
      }
    }
    
    if (schoolId) {
      filteredWorkflows = filteredWorkflows.filter(w => w.schoolId === schoolId);
    }
    
    if (trackingType) {
      filteredWorkflows = filteredWorkflows.filter(w => w.trackingType === trackingType);
    }
    
    if (academicYear) {
      filteredWorkflows = filteredWorkflows.filter(w => w.academicYear === academicYear);
    }
    
    if (sessionId) {
      filteredWorkflows = filteredWorkflows.filter(w => w.sessionId === sessionId);
    }
    
    return filteredWorkflows;
  } catch (error) {
    throw error;
  }
};

// Get only tracking workflows for organization
export const getTrackingWorkflowsForOrganization = async (organizationID, filters = {}) => {
  return getWorkflowsWithFilters(organizationID, { 
    ...filters, 
    workflowType: 'tracking' 
  });
};

// Get only session-based workflows for organization  
export const getSessionWorkflowsForOrganization = async (organizationID, filters = {}) => {
  return getWorkflowsWithFilters(organizationID, { 
    ...filters, 
    workflowType: 'session' 
  });
};

// Get workflows with enhanced metadata (includes school/session names)
export const getWorkflowsWithMetadata = async (organizationID, filters = {}) => {
  try {
    const workflows = await getWorkflowsWithFilters(organizationID, filters);
    
    // Enhance workflows with additional metadata
    const enhancedWorkflows = await Promise.all(
      workflows.map(async (workflow) => {
        const enhanced = { ...workflow };
        
        // Add school metadata for tracking workflows
        if (workflow.workflowType === 'tracking' && workflow.schoolId) {
          try {
            const schoolDoc = await getDoc(doc(firestore, "schools", workflow.schoolId));
            if (schoolDoc.exists()) {
              enhanced.schoolData = schoolDoc.data();
            }
          } catch (error) {
          }
        }
        
        // Add session metadata for session workflows
        if (workflow.sessionId) {
          try {
            const sessionDoc = await getDoc(doc(firestore, "sessions", workflow.sessionId));
            if (sessionDoc.exists()) {
              enhanced.sessionData = sessionDoc.data();
            }
          } catch (error) {
          }
        }
        
        return enhanced;
      })
    );
    
    return enhancedWorkflows;
  } catch (error) {
    throw error;
  }
};

// Get workflow summary statistics
export const getWorkflowStatistics = async (organizationID) => {
  try {
    const allWorkflows = await getWorkflowsForOrganization(organizationID);
    
    const stats = {
      total: allWorkflows.length,
      byType: {
        session: 0,
        tracking: 0
      },
      byStatus: {
        active: 0,
        completed: 0,
        on_hold: 0,
        cancelled: 0
      },
      trackingByType: {},
      sessionsByType: {}
    };
    
    allWorkflows.forEach(workflow => {
      // Count by workflow type
      if (workflow.workflowType === 'tracking') {
        stats.byType.tracking++;
        
        // Count tracking workflows by tracking type
        const trackingType = workflow.trackingType || 'unknown';
        stats.trackingByType[trackingType] = (stats.trackingByType[trackingType] || 0) + 1;
      } else {
        stats.byType.session++;
        
        // Count session workflows by session type
        const sessionType = workflow.sessionType || 'unknown';
        stats.sessionsByType[sessionType] = (stats.sessionsByType[sessionType] || 0) + 1;
      }
      
      // Count by status
      const status = workflow.status || 'unknown';
      if (stats.byStatus.hasOwnProperty(status)) {
        stats.byStatus[status]++;
      }
    });
    
    return stats;
  } catch (error) {
    throw error;
  }
};

export const updateWorkflowStep = async (workflowId, stepId, stepData) => {
  try {
    const workflowRef = doc(firestore, "workflows", workflowId);
    const workflowDoc = await getDoc(workflowRef);
    
    if (!workflowDoc.exists()) {
      throw new Error("Workflow not found");
    }

    const workflow = workflowDoc.data();
    const updatedStepProgress = {
      ...workflow.stepProgress,
      [stepId]: {
        ...workflow.stepProgress[stepId],
        ...stepData,
        updatedAt: serverTimestamp(),
      }
    };

    await updateDoc(workflowRef, {
      stepProgress: updatedStepProgress,
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    throw error;
  }
};

export const completeWorkflowStep = async (workflowId, stepId, completionData = {}) => {
  try {
    const workflowRef = doc(firestore, "workflows", workflowId);
    const workflowDoc = await getDoc(workflowRef);
    
    if (!workflowDoc.exists()) {
      throw new Error("Workflow not found");
    }

    const workflow = workflowDoc.data();
    const updatedStepProgress = {
      ...workflow.stepProgress,
      [stepId]: {
        ...workflow.stepProgress[stepId],
        status: "completed",
        completedAt: serverTimestamp(),
        completedBy: completionData.userId,
        notes: completionData.notes || workflow.stepProgress[stepId]?.notes || "",
        files: completionData.files || workflow.stepProgress[stepId]?.files || [],
        updatedAt: serverTimestamp(),
      }
    };

    // Check if this is the last step and mark workflow as completed if so
    const template = await getWorkflowTemplate(workflow.templateId);
    const allStepsCompleted = template && template.steps ? 
      template.steps.every(step => 
        updatedStepProgress[step.id]?.status === "completed"
      ) : false;

    const updateData = {
      stepProgress: updatedStepProgress,
      updatedAt: serverTimestamp(),
    };

    if (allStepsCompleted) {
      updateData.status = "completed";
      updateData.completedAt = serverTimestamp();
    }

    await updateDoc(workflowRef, updateData);

    return true;
  } catch (error) {
    throw error;
  }
};

export const assignWorkflowStep = async (workflowId, stepId, assigneeId) => {
  try {
    const workflowRef = doc(firestore, "workflows", workflowId);
    const workflowDoc = await getDoc(workflowRef);
    
    if (!workflowDoc.exists()) {
      throw new Error("Workflow not found");
    }

    const workflow = workflowDoc.data();
    const updatedStepProgress = {
      ...workflow.stepProgress,
      [stepId]: {
        ...workflow.stepProgress[stepId],
        assignedTo: assigneeId,
        assignedAt: serverTimestamp(),
        status: workflow.stepProgress[stepId]?.status || "pending",
        updatedAt: serverTimestamp(),
      }
    };

    await updateDoc(workflowRef, {
      stepProgress: updatedStepProgress,
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    throw error;
  }
};

export const getWorkflowsForUser = async (userId, organizationID, status = null) => {
  try {
    // Get all workflows for the organization first
    const allWorkflows = await getWorkflowsForOrganization(organizationID, status);
    
    
    // For now, return all workflows for the organization
    // Later we can add more sophisticated filtering based on user roles/permissions
    // But users should be able to see workflow progress even if not assigned to specific steps
    const userWorkflows = allWorkflows.filter(workflow => {
      if (!workflow.stepProgress) return false;
      
      // Include workflows where:
      // 1. User has steps assigned to them, OR
      // 2. Workflow has no assigned steps yet (newly created), OR  
      // 3. User has permission to view all workflows (admin/manager)
      const hasAssignedSteps = Object.values(workflow.stepProgress).some(step => 
        step.assignedTo === userId
      );
      
      const hasUnassignedSteps = Object.values(workflow.stepProgress).some(step => 
        !step.assignedTo || step.assignedTo === null
      );
      
      return hasAssignedSteps || hasUnassignedSteps;
    });

    
    return userWorkflows;
  } catch (error) {
    throw error;
  }
};

// Initialize default workflow templates for an organization
export const initializeDefaultWorkflowTemplates = async (organizationID) => {
  try {
    // Check if templates already exist
    const existingTemplates = await getWorkflowTemplates(organizationID);
    if (existingTemplates.length > 0) {
      return existingTemplates;
    }

    
    // Import default templates
    const { getAllDefaultTemplates, createTemplateForOrganization } = await import('../utils/workflowTemplates');
    const defaultTemplates = getAllDefaultTemplates();
    
    const createdTemplates = [];
    
    for (const template of defaultTemplates) {
      try {
        const templateData = createTemplateForOrganization(
          organizationID,
          template.name.toLowerCase().replace(/\s+/g, '_'),
          {
            ...template,
            isDefault: true // Make the first template for each type default
          }
        );
        
        const templateId = await createWorkflowTemplate(templateData);
        createdTemplates.push({ id: templateId, ...templateData });
        
      } catch (error) {
      }
    }
    
    return createdTemplates;
  } catch (error) {
    return [];
  }
};

// Create tracking workflow for school (not tied to a session)
export const createTrackingWorkflowForSchool = async (schoolId, organizationID, templateId, academicYear, options = {}) => {
  try {
    
    // Check if workflow already exists for this school and template combination
    const existingWorkflows = await getTrackingWorkflowsForSchool(schoolId, organizationID, templateId, academicYear);
    
    if (existingWorkflows.length > 0) {
      return existingWorkflows[0].id;
    }

    // Get school data for context
    const schoolDoc = await getDoc(doc(firestore, "schools", schoolId));
    if (!schoolDoc.exists()) {
      throw new Error("School not found");
    }
    const schoolData = schoolDoc.data();

    // Get the specific tracking template by ID
    let trackingTemplate = null;
    
    // Check if it's a default template
    if (templateId.startsWith('default_')) {
      const templateKey = templateId.replace('default_', '');
      const { getTrackingTemplateById } = await import('../utils/workflowTemplates.js');
      trackingTemplate = await getTrackingTemplateById(templateId, organizationID, getWorkflowTemplates);
    } else {
      // It's a custom template - fetch from organization templates
      const allTemplates = await getWorkflowTemplates(organizationID);
      trackingTemplate = allTemplates.find(template => template.id === templateId);
    }
    
    if (!trackingTemplate) {
      throw new Error(`Tracking template not found: ${templateId}`);
    }
    
    if (!trackingTemplate.isTrackingTemplate && (!trackingTemplate.trackingTypes || trackingTemplate.trackingTypes.length === 0)) {
      throw new Error(`Template "${trackingTemplate.name}" is not a tracking template`);
    }


    // Calculate dates for due date calculation
    const trackingStartDate = options.trackingStartDate || new Date();
    const trackingEndDate = options.trackingEndDate || new Date(trackingStartDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days default
    
    // Initialize step progress for all steps in template with calculated due dates
    const stepProgress = {};
    trackingTemplate.steps.forEach((step, index) => {
      // Calculate due date based on tracking start date and step's dueOffsetDays
      let dueDate = null;
      if (step.dueOffsetDays !== undefined) {
        dueDate = new Date(trackingStartDate);
        dueDate.setDate(dueDate.getDate() + step.dueOffsetDays);
      }
      
      stepProgress[step.id] = {
        status: "pending",
        assignedTo: null,
        startTime: null,
        completedAt: null,
        dueDate: dueDate,
        notes: "",
        files: [],
        createdAt: serverTimestamp(),
      };
      
    });

    // Create tracking workflow instance
    const workflowData = {
      // Tracking workflow fields (no sessionId)
      schoolId,
      organizationID,
      templateId: trackingTemplate.id || templateId, // Use either template.id or the templateId passed in
      trackingTemplateId: templateId, // Store the original template ID for reference
      academicYear,
      trackingStartDate: trackingStartDate.toISOString().split('T')[0], // Store as date string
      trackingEndDate: trackingEndDate.toISOString().split('T')[0],
      
      // Template and workflow fields
      templateName: trackingTemplate.name,
      templateVersion: trackingTemplate.version || 1,
      currentStep: trackingTemplate.steps[0]?.id || null,
      stepProgress,
      status: "active",
      
      // Context fields
      schoolName: schoolData.value || schoolData.name || "Unknown School",
      workflowType: "tracking", // Flag to distinguish from session workflows
      
      // Optional fields
      ...options.additionalData
    };

    // Clean the workflow data to remove any undefined values
    const cleanWorkflowData = Object.fromEntries(
      Object.entries(workflowData).filter(([key, value]) => value !== undefined)
    );

    const workflowId = await createWorkflowInstance(cleanWorkflowData);
    
    if (workflowId) {
    } else {
    }
    
    return workflowId;
  } catch (error) {
    throw error;
  }
};

// Get tracking workflows for a school
export const getTrackingWorkflowsForSchool = async (schoolId, organizationID, templateId = null, academicYear = null) => {
  try {
    let q = query(
      collection(firestore, "workflows"),
      where("schoolId", "==", schoolId),
      where("organizationID", "==", organizationID),
      where("workflowType", "==", "tracking")
    );

    if (templateId) {
      q = query(q, where("trackingTemplateId", "==", templateId));
    }
    
    if (academicYear) {
      q = query(q, where("academicYear", "==", academicYear));
    }

    const querySnapshot = await getDocs(q);
    const workflows = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.status !== "deleted") {
        workflows.push({
          id: doc.id,
          ...data,
        });
      }
    });

    return workflows;
  } catch (error) {
    throw error;
  }
};

// Auto-create workflow for a specific session type
export const autoCreateWorkflowForSession = async (sessionId, organizationID, sessionType) => {
  try {
    // Check if workflow already exists for this session and session type combination
    const existingWorkflows = await getWorkflowsForSession(sessionId, organizationID);
    const existingWorkflowForType = existingWorkflows.find(workflow => 
      workflow.sessionType === sessionType
    );
    
    if (existingWorkflowForType) {
      return existingWorkflowForType.id;
    }

    // Get session data to calculate step due dates
    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      return null;
    }

    // Use fuzzy matching to determine the best workflow template
    const { getRecommendedWorkflowTemplate, getWorkflowMappingExplanation } = await import('../utils/workflowTemplates');
    
    const recommendedTemplateKey = getRecommendedWorkflowTemplate(sessionType);
    const mappingInfo = getWorkflowMappingExplanation(sessionType);
    
    
    // Get all templates for the organization first
    let allTemplates = await getWorkflowTemplates(organizationID);
    
    if (allTemplates.length > 0) {
      allTemplates.forEach((template, index) => {
      });
    }
    
    // If no templates exist, initialize default ones
    if (allTemplates.length === 0) {
      await initializeDefaultWorkflowTemplates(organizationID);
      allTemplates = await getWorkflowTemplates(organizationID);
    }
    
    // Find the best matching template based on fuzzy mapping
    let defaultTemplate = null;
    
    // First try to find a template that supports the recommended template type
    defaultTemplate = allTemplates.find(template => 
      template.sessionTypes && template.sessionTypes.includes(recommendedTemplateKey)
    );
    
    if (defaultTemplate) {
    } else {
      
      // Fallback: try to find templates that match the original sessionType exactly
      defaultTemplate = allTemplates.find(template => 
        template.sessionTypes && template.sessionTypes.includes(sessionType)
      );
      
      if (defaultTemplate) {
      } else {
        
        // Last resort: use any available template, preferring default ones
        defaultTemplate = allTemplates.find(t => t.isDefault);
        if (defaultTemplate) {
        } else {
          defaultTemplate = allTemplates[0];
          if (defaultTemplate) {
          }
        }
      }
    }
    
    if (!defaultTemplate) {
      return null;
    }


    // Parse session date to calculate step due dates
    const sessionDate = new Date(sessionData.date);
    
    // Initialize step progress for all steps in template with calculated due dates
    const stepProgress = {};
    defaultTemplate.steps.forEach((step, index) => {
      // Calculate due date based on session date and step's dueOffsetDays
      let dueDate = null;
      if (step.dueOffsetDays !== undefined) {
        dueDate = new Date(sessionDate);
        dueDate.setDate(dueDate.getDate() + step.dueOffsetDays);
      }
      
      stepProgress[step.id] = {
        status: "pending",
        assignedTo: null,
        startTime: null,
        completedAt: null,
        dueDate: dueDate,
        notes: "",
        files: [],
        createdAt: serverTimestamp(),
      };
      
    });

    // Create workflow instance
    const workflowData = {
      sessionId,
      organizationID,
      sessionType,  // Store the specific session type for this workflow
      templateId: defaultTemplate.id,
      templateName: defaultTemplate.name,
      templateVersion: defaultTemplate.version,
      currentStep: defaultTemplate.steps[0]?.id || null,
      stepProgress,
      status: "active",
      sessionDate: sessionData.date,
    };

    const workflowId = await createWorkflowInstance(workflowData);
    
    if (workflowId) {
    } else {
    }
    
    return workflowId;
  } catch (error) {
    throw error;
  }
};

