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
} from "firebase/firestore";
import { firestore } from "./config";

// Get user profile
export const getUserProfile = async (uid) => {
  try {
    const userDoc = await getDoc(doc(firestore, "users", uid));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw error;
  }
};

// Get organization
export const getOrganization = async (organizationID) => {
  try {
    const orgDoc = await getDoc(
      doc(firestore, "organizations", organizationID)
    );
    if (orgDoc.exists()) {
      return { id: orgDoc.id, ...orgDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching organization:", error);
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
    console.error("Error creating user profile:", error);
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
    console.log("User profile updated successfully");
  } catch (error) {
    console.error("Error updating user profile:", error);
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
    console.log("User photo and crop settings updated successfully");
  } catch (error) {
    console.error("Error updating user photo with crop settings:", error);
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
    console.log("User photo URL updated successfully");
  } catch (error) {
    console.error("Error updating user photo URL:", error);
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
    console.error("Error creating organization:", error);
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
    console.log("Organization updated successfully");
  } catch (error) {
    console.error("Error updating organization:", error);
    throw error;
  }
};

// Get team members for an organization (including pending invitations)
export const getTeamMembers = async (organizationID) => {
  try {
    const q = query(
      collection(firestore, "users"),
      where("organizationID", "==", organizationID)
      // Removed isActive filter to show both active and pending users
    );

    const querySnapshot = await getDocs(q);
    const members = [];

    querySnapshot.forEach((doc) => {
      members.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Sort by active status first, then by name
    return members.sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return b.isActive ? 1 : -1; // Active users first
      }
      const nameA = a.displayName || `${a.firstName} ${a.lastName}` || a.email;
      const nameB = b.displayName || `${b.firstName} ${b.lastName}` || b.email;
      return nameA.localeCompare(nameB);
    });
  } catch (error) {
    console.error("Error fetching team members:", error);
    throw error;
  }
};

// Invite user to organization (creates user record but they need to complete signup)
export const inviteUser = async (organizationID, inviteData) => {
  try {
    // Create a pending user record
    const userRef = await addDoc(collection(firestore, "users"), {
      email: inviteData.email,
      firstName: inviteData.firstName,
      lastName: inviteData.lastName,
      displayName: `${inviteData.firstName} ${inviteData.lastName}`,
      role: inviteData.role,
      position: inviteData.position || "",
      organizationID,
      isActive: false, // Will be activated when they complete signup
      invitedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // TODO: Send invitation email here
    // For now, we just create the user record

    return userRef.id;
  } catch (error) {
    console.error("Error inviting user:", error);
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
    console.error("Error fetching invitation:", error);
    throw error;
  }
};

// Accept invitation (activate user account)
export const acceptInvitation = async (userId, firebaseUid) => {
  try {
    await updateDoc(doc(firestore, "users", userId), {
      isActive: true,
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // Note: The firebaseUid is already set when the auth account is created
      // We could store it separately if needed, but Firebase Auth handles the link
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
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
    console.error("Error updating user role:", error);
    throw error;
  }
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
      finalReportData.date = reportData.date;
      finalReportData.yourName = reportData.photographer;
      
      // Store template-specific fields in customFields
      finalReportData.customFields = {};
      Object.keys(reportData).forEach(key => {
        if (!['organizationID', 'userId', 'templateId', 'templateName', 'templateVersion', 'date', 'photographer'].includes(key)) {
          finalReportData.customFields[key] = reportData[key];
        }
      });
    } else {
      // Legacy report structure - pass through all data
      Object.assign(finalReportData, reportData);
    }

    const reportRef = await addDoc(collection(firestore, "dailyJobReports"), finalReportData);
    return reportRef.id;
  } catch (error) {
    console.error("Error creating daily job report:", error);
    throw error;
  }
};

export const getDailyJobReports = async (
  organizationID,
  startDate = null,
  endDate = null
) => {
  try {
    let q = query(
      collection(firestore, "dailyJobReports"),
      where("organizationID", "==", organizationID)
    );

    // Add date filters if provided
    if (startDate) {
      q = query(q, where("date", ">=", startDate));
    }
    if (endDate) {
      q = query(q, where("date", "<=", endDate));
    }

    const querySnapshot = await getDocs(q);
    const reports = [];

    querySnapshot.forEach((doc) => {
      reports.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return reports;
  } catch (error) {
    console.error("Error fetching daily job reports:", error);
    throw error;
  }
};

export const updateDailyJobReport = async (reportId, reportData) => {
  try {
    await updateDoc(doc(firestore, "dailyJobReports", reportId), {
      ...reportData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating daily job report:", error);
    throw error;
  }
};

// Subscribe to real-time daily job reports updates
export const subscribeToDailyJobReports = (organizationID, callback, errorCallback) => {
  const q = query(
    collection(firestore, "dailyJobReports"),
    where("organizationID", "==", organizationID),
    orderBy("timestamp", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const reports = [];
      snapshot.forEach((doc) => {
        reports.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      callback(reports);
    },
    (error) => {
      console.error("Error in daily job reports listener:", error);
      if (errorCallback) errorCallback(error);
    }
  );
};

// Get schools from schools collection
export const getSchools = async (organizationID) => {
  try {
    const q = query(
      collection(firestore, "schools"),
      where("organizationID", "==", organizationID)
    );

    const querySnapshot = await getDocs(q);
    const schools = [];

    querySnapshot.forEach((doc) => {
      schools.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return schools;
  } catch (error) {
    console.error("Error fetching schools:", error);
    throw error;
  }
};

export const createSchool = async (organizationID, schoolData) => {
  try {
    const schoolRef = await addDoc(collection(firestore, "schools"), {
      ...schoolData,
      organizationID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return schoolRef.id;
  } catch (error) {
    console.error("Error creating school:", error);
    throw error;
  }
};

export const updateSchool = async (schoolId, schoolData) => {
  try {
    await updateDoc(doc(firestore, "schools", schoolId), {
      ...schoolData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating school:", error);
    throw error;
  }
};

// Sessions Functions - NEW COLLECTION
export const getSessions = async (organizationID) => {
  try {
    const q = query(
      collection(firestore, "sessions"),
      where("organizationID", "==", organizationID)
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
    console.error("Error fetching sessions:", error);
    throw error;
  }
};

export const createSession = async (organizationID, sessionData) => {
  try {
    const sessionRef = await addDoc(collection(firestore, "sessions"), {
      ...sessionData,
      organizationID,
      status: sessionData.status || "scheduled",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return sessionRef.id;
  } catch (error) {
    console.error("Error creating session:", error);
    throw error;
  }
};

export const updateSession = async (sessionId, updateData) => {
  try {
    const sessionRef = doc(firestore, "sessions", sessionId);

    // Add timestamp to track when the update occurred
    const dataWithTimestamp = {
      ...updateData,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(sessionRef, dataWithTimestamp);

    console.log("Session updated successfully:", sessionId);
    return true;
  } catch (error) {
    console.error("Error updating session:", error);
    throw new Error(`Failed to update session: ${error.message}`);
  }
};

export const deleteSession = async (sessionId) => {
  try {
    await deleteDoc(doc(firestore, "sessions", sessionId));
  } catch (error) {
    console.error("Error deleting session:", error);
    throw error;
  }
};

export const getSession = async (sessionId) => {
  try {
    const sessionDoc = await getDoc(doc(firestore, "sessions", sessionId));
    if (sessionDoc.exists()) {
      return { id: sessionDoc.id, ...sessionDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching session:", error);
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
    console.error("Error fetching sports jobs:", error);
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
    console.error("Error creating sports job:", error);
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

    console.log("Sports job updated successfully:", jobId);
    return true;
  } catch (error) {
    console.error("Error updating sports job:", error);
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
    console.error("Error fetching job boxes:", error);
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
    console.error("Error updating job box status:", error);
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
    console.error("Error fetching SD cards:", error);
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
    console.error("Error updating SD card status:", error);
    throw error;
  }
};

// Report Templates Functions
export const getReportTemplates = async (organizationID, shootType = null) => {
  try {
    console.log("Fetching report templates for organization:", organizationID);
    
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

    console.log("Found templates:", templates.length);
    return templates;
  } catch (error) {
    console.error("Error fetching report templates:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    throw error;
  }
};

export const createReportTemplate = async (templateData) => {
  try {
    console.log("Creating report template:", templateData);
    
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
    
    console.log("Template created with ID:", templateRef.id);
    return templateRef.id;
  } catch (error) {
    console.error("Error creating report template:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    throw error;
  }
};

// Update report template
export const updateReportTemplate = async (templateId, templateData) => {
  try {
    console.log("Updating report template:", templateId, templateData);
    
    if (!templateId) {
      throw new Error("Template ID is required");
    }
    
    await updateDoc(doc(firestore, "reportTemplates", templateId), {
      ...templateData,
      updatedAt: serverTimestamp(),
    });
    
    console.log("Report template updated successfully");
  } catch (error) {
    console.error("Error updating report template:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    throw error;
  }
};

// Delete report template
export const deleteReportTemplate = async (templateId) => {
  try {
    console.log("Deleting report template:", templateId);
    
    if (!templateId) {
      throw new Error("Template ID is required");
    }
    
    await deleteDoc(doc(firestore, "reportTemplates", templateId));
    console.log("Report template deleted successfully");
  } catch (error) {
    console.error("Error deleting report template:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
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
    console.error("Error fetching report template:", error);
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
    
    console.log("Default template updated successfully");
  } catch (error) {
    console.error("Error setting default template:", error);
    throw error;
  }
};

// Time Tracking Functions

// Clock in - creates a new time entry
export const clockIn = async (userId, organizationID, sessionId = null, notes = null) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
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
    console.log("Clock in successful:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error clocking in:", error);
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
    console.log("Clock out successful:", currentEntry.id);
    return currentEntry.id;
  } catch (error) {
    console.error("Error clocking out:", error);
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
    console.error("Error getting current time entry:", error);
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
    console.error("Error fetching time entries:", error);
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
    console.error("Error fetching all time entries:", error);
    throw error;
  }
};

// Get today's time entries for a user
export const getTodayTimeEntries = async (userId, organizationID) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    return await getTimeEntries(userId, organizationID, today, today);
  } catch (error) {
    console.error("Error fetching today's time entries:", error);
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

// Format duration in hours and minutes
export const formatDuration = (hours) => {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (wholeHours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${wholeHours}h`;
  } else {
    return `${wholeHours}h ${minutes}m`;
  }
};

// Check for time overlap with existing entries
export const checkTimeOverlap = async (userId, organizationID, startTime, endTime, excludeEntryId = null) => {
  try {
    const date = startTime.toISOString().split('T')[0];
    
    // Query for time entries on the same date
    const q = query(
      collection(firestore, "timeEntries"),
      where("userId", "==", userId),
      where("organizationID", "==", organizationID),
      where("date", "==", date),
      where("status", "==", "clocked-out")
    );
    
    const snapshot = await getDocs(q);
    const overlappingEntries = [];
    
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
        overlappingEntries.push({
          ...entry,
          clockInTime: entryStart,
          clockOutTime: entryEnd
        });
      }
    });
    
    return overlappingEntries;
  } catch (error) {
    console.error("Error checking time overlap:", error);
    throw error;
  }
};

// Manual time entry creation (admin function)
export const createManualTimeEntry = async (timeEntryData) => {
  try {
    // Check for time overlaps before creating
    if (timeEntryData.clockInTime && timeEntryData.clockOutTime) {
      const overlaps = await checkTimeOverlap(
        timeEntryData.userId,
        timeEntryData.organizationID,
        timeEntryData.clockInTime,
        timeEntryData.clockOutTime
      );
      
      if (overlaps.length > 0) {
        const overlapDetails = overlaps.map(entry => 
          `${entry.clockInTime.toLocaleTimeString()} - ${entry.clockOutTime.toLocaleTimeString()}`
        ).join(', ');
        throw new Error(`Time overlap detected with existing entries: ${overlapDetails}`);
      }
    }

    const docRef = await addDoc(collection(firestore, "timeEntries"), {
      ...timeEntryData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    console.log("Manual time entry created:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error creating manual time entry:", error);
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
    
    console.log("Time entry updated:", entryId);
  } catch (error) {
    console.error("Error updating time entry:", error);
    throw error;
  }
};

// Delete time entry (admin function)
export const deleteTimeEntry = async (entryId) => {
  try {
    await deleteDoc(doc(firestore, "timeEntries", entryId));
    console.log("Time entry deleted:", entryId);
  } catch (error) {
    console.error("Error deleting time entry:", error);
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
    console.error("Error getting session hours:", error);
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
    console.error("Error getting school hours:", error);
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
        console.warn(`Could not fetch session ${sessionId}:`, error);
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
    console.error("Error getting user session stats:", error);
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
          console.warn(`Could not fetch session ${entry.sessionId}:`, error);
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
    console.error("Error getting user school stats:", error);
    throw error;
  }
};
