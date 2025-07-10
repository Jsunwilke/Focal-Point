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
