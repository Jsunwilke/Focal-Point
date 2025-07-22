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
  Timestamp,
} from "firebase/firestore";
import { firestore } from "./config";
import secureLogger from '../utils/secureLogger';

// Get user profile
export const getUserProfile = async (uid) => {
  try {
    const userDoc = await getDoc(doc(firestore, "users", uid));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    secureLogger.error("Error fetching user profile", error);
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
    
    console.log(`User migration successful: ${tempUserId} → ${firebaseUid}`);
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
    
    console.log(`Found ${expiredInvites.length} expired temporary invites to clean up`);
    
    // Delete expired invites
    for (const invite of expiredInvites) {
      await deleteDoc(doc(firestore, "users", invite.id));
      console.log(`Cleaned up expired invite for ${invite.email} (invited ${invite.invitedAt.toDateString()})`);
    }
    
    return {
      cleaned: expiredInvites.length,
      expiredInvites
    };
  } catch (error) {
    console.error("Error cleaning up temporary invites:", error);
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
    // Fetch all reports for the organization (no date filtering at database level)
    const q = query(
      collection(firestore, "dailyJobReports"),
      where("organizationID", "==", organizationID)
    );

    console.log(`🔍 Querying all dailyJobReports for organization: ${organizationID}`);
    const querySnapshot = await getDocs(q);
    const allReports = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      allReports.push({
        id: doc.id,
        ...data,
      });
    });

    console.log(`📊 Total reports found: ${allReports.length}`);

    // Client-side date filtering to handle both old and new date formats
    let filteredReports = allReports;
    
    if (startDate || endDate) {
      // Convert filter dates to Date objects for comparison
      const startDateObj = startDate ? new Date(startDate + 'T00:00:00.000Z') : null;
      const endDateObj = endDate ? new Date(endDate + 'T23:59:59.999Z') : null;
      
      console.log(`🔍 Client-side filtering from ${startDate} to ${endDate}`);
      
      filteredReports = allReports.filter(report => {
        const reportDate = parseReportDate(report.date);
        
        if (!reportDate) {
          console.warn(`⚠️ Could not parse date for report ${report.id}:`, report.date);
          return false; // Exclude reports with unparseable dates
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
      
      console.log(`📊 Reports after date filtering: ${filteredReports.length}`);
    }

    // Log sample of found reports with their parsed dates
    filteredReports.slice(0, 5).forEach(report => {
      const parsedDate = parseReportDate(report.date);
      console.log(`📄 Report ${report.id}: original date=${report.date}, parsed=${parsedDate}, mileage=${report.totalMileage || 'N/A'}`);
    });

    const reportsWithMileage = filteredReports.filter(r => r.totalMileage && r.totalMileage > 0);
    console.log(`🚗 Reports with mileage: ${reportsWithMileage.length}`);

    return filteredReports;
  } catch (error) {
    console.error("Error fetching daily job reports:", error);
    throw error;
  }
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
    
    console.warn('Could not parse date value:', dateValue);
    return null;
  } catch (error) {
    console.error('Error parsing report date:', error, 'Value:', dateValue);
    return null;
  }
};

const convertToFirestoreTimestamp = (dateString, endOfDay = false) => {
  try {
    // Handle different input types for backwards compatibility
    if (!dateString) {
      console.warn('No date string provided to convertToFirestoreTimestamp');
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
      console.error('Invalid date string:', dateString);
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
    console.error('Error converting date string to Firestore Timestamp:', error);
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
    console.error("Error fetching sessions for school:", error);
    throw error;
  }
};

export const createSession = async (organizationID, sessionData) => {
  try {
    const sessionRef = await addDoc(collection(firestore, "sessions"), {
      ...sessionData,
      organizationID,
      status: sessionData.status || "scheduled",
      hasJobBoxAssigned: false,
      jobBoxRecordId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    const sessionId = sessionRef.id;
    
    // Auto-create workflows for all session types
    try {
      // Get all session types for this session
      const sessionTypes = sessionData.sessionTypes || 
                          (sessionData.sessionType ? [sessionData.sessionType] : ['other']);
      
      console.log("🔄 SESSION CREATED - Starting multiple workflow creation process");
      console.log("📋 Session ID:", sessionId);
      console.log("🏢 Organization ID:", organizationID);
      console.log("🎯 Session Types:", sessionTypes);
      console.log("📝 Full Session Data:", sessionData);
      
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
        console.log(`🎯 Creating workflow ${i + 1}/${sessionTypes.length} for session type: "${sessionType}"`);
        
        try {
          const workflowId = await autoCreateWorkflowForSession(
            sessionId, 
            organizationID, 
            sessionType
          );
          
          if (workflowId) {
            console.log(`✅ SUCCESS: Workflow ${i + 1} created with ID: ${workflowId} for session type: "${sessionType}"`);
            
            // Verify workflow was created
            const workflowDoc = await getDoc(doc(firestore, "workflows", workflowId));
            if (workflowDoc.exists()) {
              console.log(`✅ VERIFIED: Workflow ${i + 1} exists in Firestore`);
              workflowResults.push({
                success: true,
                workflowId,
                sessionType,
                templateName: workflowDoc.data().templateName
              });
            } else {
              console.error(`❌ ERROR: Workflow ${i + 1} ID returned but document doesn't exist!`);
              workflowResults.push({
                success: false,
                error: 'Workflow ID returned but document does not exist',
                sessionType
              });
            }
          } else {
            console.log(`❌ FAILED: No workflow created for session type: "${sessionType}"`);
            workflowResults.push({
              success: false,
              error: 'No workflow ID returned',
              sessionType
            });
          }
        } catch (workflowError) {
          console.error(`❌ ERROR: Failed to create workflow for session type "${sessionType}":`, workflowError);
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
      
      console.log(`🎉 WORKFLOW CREATION COMPLETE: ${successfulWorkflows.length}/${sessionTypes.length} workflows created successfully`);
      if (successfulWorkflows.length > 0) {
        console.log("✅ Successful workflows:", successfulWorkflows);
      }
      if (failedWorkflows.length > 0) {
        console.log("❌ Failed workflows:", failedWorkflows);
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
        console.log("❌ CRITICAL: No workflows were created at all");
        localStorage.setItem('lastWorkflowResult', JSON.stringify({
          success: false,
          error: 'No workflows were created for any session type',
          sessionId,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (workflowError) {
      console.error("💥 ERROR: Failed to create workflows for new session:", sessionId);
      console.error("Error details:", workflowError);
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
    console.error("Error creating session:", error);
    throw error;
  }
};

export const updateSession = async (sessionId, updateData) => {
  try {
    const sessionRef = doc(firestore, "sessions", sessionId);

    // Get current session data to check for status changes
    const currentSessionDoc = await getDoc(sessionRef);
    const currentSession = currentSessionDoc.exists() ? currentSessionDoc.data() : null;

    // Add timestamp to track when the update occurred
    const dataWithTimestamp = {
      ...updateData,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(sessionRef, dataWithTimestamp);

    // Note: Workflow creation now happens when session is created, not when completed

    console.log("Session updated successfully:", sessionId);
    return true;
  } catch (error) {
    console.error("Error updating session:", error);
    throw new Error(`Failed to update session: ${error.message}`);
  }
};

export const deleteSession = async (sessionId, organizationID = null) => {
  try {
    console.log("🗑️ Starting session deletion process for:", sessionId);
    
    // First, find and delete all workflows associated with this session
    console.log("🔍 Finding workflows for session:", sessionId);
    const associatedWorkflows = await getWorkflowsForSession(sessionId, organizationID);
    
    if (associatedWorkflows.length > 0) {
      console.log(`📋 Found ${associatedWorkflows.length} workflows to delete:`, 
        associatedWorkflows.map(w => ({ id: w.id, sessionType: w.sessionType, templateName: w.templateName }))
      );
      
      // Delete each workflow
      const deletionResults = [];
      for (const workflow of associatedWorkflows) {
        try {
          await deleteWorkflowInstance(workflow.id);
          console.log(`✅ Deleted workflow: ${workflow.id} (${workflow.sessionType || 'unknown type'})`);
          deletionResults.push({ workflowId: workflow.id, success: true });
        } catch (workflowError) {
          console.error(`❌ Failed to delete workflow: ${workflow.id}`, workflowError);
          deletionResults.push({ 
            workflowId: workflow.id, 
            success: false, 
            error: workflowError.message 
          });
        }
      }
      
      const successfulDeletions = deletionResults.filter(r => r.success).length;
      const failedDeletions = deletionResults.filter(r => !r.success).length;
      
      console.log(`🎯 Workflow deletion summary: ${successfulDeletions} successful, ${failedDeletions} failed`);
      
      if (failedDeletions > 0) {
        console.warn("⚠️ Some workflows failed to delete, but continuing with session deletion");
      }
    } else {
      console.log("📭 No workflows found for this session");
    }
    
    // Delete the session
    console.log("🗑️ Deleting session document:", sessionId);
    await deleteDoc(doc(firestore, "sessions", sessionId));
    
    console.log("✅ Session deletion completed successfully:", sessionId);
  } catch (error) {
    console.error("💥 Error deleting session:", sessionId, error);
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
    // Don't log permission errors - these are expected when accessing sessions from other orgs
    if (error.code !== 'permission-denied') {
      console.error("Error fetching session:", error);
    }
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
    // Use local timezone to get today's date consistently
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return await getTimeEntries(userId, organizationID, todayString, todayString);
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
    console.error("Error checking time overlap:", error);
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
    console.error("Error fetching workflow templates:", error);
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
    console.error("Error creating workflow template:", error);
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
    console.error("Error updating workflow template:", error);
    throw error;
  }
};

export const deleteWorkflowTemplate = async (templateId) => {
  try {
    console.log(`🗑️ Firestore: Permanently deleting template ${templateId}`);
    
    const templateRef = doc(firestore, "workflowTemplates", templateId);
    
    // First check if template exists
    const templateDoc = await getDoc(templateRef);
    if (!templateDoc.exists()) {
      throw new Error(`Template with ID ${templateId} does not exist`);
    }
    
    console.log(`📄 Template found:`, templateDoc.data());
    
    // Permanently delete the document from Firestore
    await deleteDoc(templateRef);
    
    console.log(`✅ Template ${templateId} successfully deleted from Firestore`);
  } catch (error) {
    console.error(`💥 Error deleting workflow template ${templateId}:`, error);
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
    console.error("Error fetching workflow template:", error);
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
    console.error("Error fetching workflow templates for organization:", error);
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
    console.error("Error creating workflow instance:", error);
    throw error;
  }
};

// Delete a workflow instance
export const deleteWorkflowInstance = async (workflowId) => {
  try {
    await deleteDoc(doc(firestore, "workflows", workflowId));
    console.log("Workflow instance deleted successfully:", workflowId);
  } catch (error) {
    console.error("Error deleting workflow instance:", workflowId, error);
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
    console.error("Error fetching workflow:", workflowId, error);
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
    console.error("Error fetching workflows for session:", error);
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

    const querySnapshot = await getDocs(q);
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
    console.error("Error fetching workflows for organization:", error);
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
    console.error("Error fetching workflows with filters:", error);
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
            console.warn(`Could not fetch school data for ${workflow.schoolId}:`, error);
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
            console.warn(`Could not fetch session data for ${workflow.sessionId}:`, error);
          }
        }
        
        return enhanced;
      })
    );
    
    return enhancedWorkflows;
  } catch (error) {
    console.error("Error fetching workflows with metadata:", error);
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
    console.error("Error fetching workflow statistics:", error);
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
    console.error("Error updating workflow step:", error);
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
    const allStepsCompleted = template?.steps?.every(step => 
      updatedStepProgress[step.id]?.status === "completed"
    );

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
    console.error("Error completing workflow step:", error);
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
    console.error("Error assigning workflow step:", error);
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
    console.error("Error fetching workflows for user:", error);
    throw error;
  }
};

// Initialize default workflow templates for an organization
export const initializeDefaultWorkflowTemplates = async (organizationID) => {
  try {
    // Check if templates already exist
    const existingTemplates = await getWorkflowTemplates(organizationID);
    if (existingTemplates.length > 0) {
      console.log("Workflow templates already exist for organization:", organizationID);
      return existingTemplates;
    }

    console.log("Creating default workflow templates for organization:", organizationID);
    
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
        
        console.log("Created default template:", template.name);
      } catch (error) {
        console.warn("Failed to create template:", template.name, error);
      }
    }
    
    return createdTemplates;
  } catch (error) {
    console.error("Error initializing default workflow templates:", error);
    return [];
  }
};

// Create tracking workflow for school (not tied to a session)
export const createTrackingWorkflowForSchool = async (schoolId, organizationID, templateId, academicYear, options = {}) => {
  try {
    console.log(`🏗️ Creating tracking workflow for school: ${schoolId}, template: ${templateId}, year: ${academicYear}`);
    
    // Check if workflow already exists for this school and template combination
    const existingWorkflows = await getTrackingWorkflowsForSchool(schoolId, organizationID, templateId, academicYear);
    
    if (existingWorkflows.length > 0) {
      console.log(`Tracking workflow already exists for school: ${schoolId} with template: ${templateId}`);
      return existingWorkflows[0].id;
    }

    // Get school data for context
    const schoolDoc = await getDoc(doc(firestore, "schools", schoolId));
    if (!schoolDoc.exists()) {
      throw new Error("School not found");
    }
    const schoolData = schoolDoc.data();

    // Get the specific tracking template by ID
    console.log(`📊 Fetching tracking template: ${templateId}`);
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

    console.log(`🏗️ Creating tracking workflow using template: "${trackingTemplate.name}"`);

    // Calculate dates for due date calculation
    const trackingStartDate = options.trackingStartDate || new Date();
    const trackingEndDate = options.trackingEndDate || new Date(trackingStartDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days default
    
    // Initialize step progress for all steps in template with calculated due dates
    console.log(`📋 Initializing ${trackingTemplate.steps.length} workflow steps...`);
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
      
      console.log(`  ${index + 1}. "${step.title}" - Due: ${dueDate ? dueDate.toLocaleDateString() : 'Not set'}`);
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

    console.log("🚀 Creating tracking workflow instance in Firestore...");
    const workflowId = await createWorkflowInstance(cleanWorkflowData);
    
    if (workflowId) {
      console.log(`🎉 SUCCESS: Tracking workflow created!`);
      console.log(`📋 Workflow ID: ${workflowId}`);
      console.log(`📄 Template: "${trackingTemplate.name}"`);
      console.log(`🏫 School: "${schoolData.name}"`);
      console.log(`🆔 Template ID: "${templateId}"`);
    } else {
      console.error("💥 FAILED: createWorkflowInstance returned null/undefined");
    }
    
    return workflowId;
  } catch (error) {
    console.error("Error creating tracking workflow for school:", error);
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
    console.error("Error fetching tracking workflows for school:", error);
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
      console.log(`Workflow already exists for session: ${sessionId} and session type: ${sessionType}`);
      return existingWorkflowForType.id;
    }

    // Get session data to calculate step due dates
    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      console.log("Session not found:", sessionId);
      return null;
    }

    // Use fuzzy matching to determine the best workflow template
    console.log("🧠 Starting intelligent template matching...");
    const { getRecommendedWorkflowTemplate, getWorkflowMappingExplanation } = await import('../utils/workflowTemplates');
    
    const recommendedTemplateKey = getRecommendedWorkflowTemplate(sessionType);
    const mappingInfo = getWorkflowMappingExplanation(sessionType);
    
    console.log(`🎯 MAPPING RESULT: "${sessionType}" → "${mappingInfo.templateName}" (${mappingInfo.reason})`);
    console.log("🔑 Recommended template key:", recommendedTemplateKey);
    
    // Get all templates for the organization first
    console.log("📊 Fetching workflow templates for organization...");
    let allTemplates = await getWorkflowTemplates(organizationID);
    console.log(`📋 Found ${allTemplates.length} total templates in organization`);
    
    if (allTemplates.length > 0) {
      console.log("📄 Available templates:");
      allTemplates.forEach((template, index) => {
        console.log(`  ${index + 1}. "${template.name}" - Session Types: [${template.sessionTypes?.join(', ') || 'none'}]`);
      });
    }
    
    // If no templates exist, initialize default ones
    if (allTemplates.length === 0) {
      console.log("🏗️ No workflow templates found, initializing defaults...");
      await initializeDefaultWorkflowTemplates(organizationID);
      allTemplates = await getWorkflowTemplates(organizationID);
      console.log(`✨ After initialization: Found ${allTemplates.length} templates`);
    }
    
    // Find the best matching template based on fuzzy mapping
    console.log("🔍 Starting template selection process...");
    let defaultTemplate = null;
    
    // First try to find a template that supports the recommended template type
    console.log(`🎯 Step 1: Looking for templates with session type "${recommendedTemplateKey}"`);
    defaultTemplate = allTemplates.find(template => 
      template.sessionTypes && template.sessionTypes.includes(recommendedTemplateKey)
    );
    
    if (defaultTemplate) {
      console.log(`✅ FOUND: Template "${defaultTemplate.name}" matches recommended type "${recommendedTemplateKey}"`);
    } else {
      console.log(`❌ No template found for recommended type "${recommendedTemplateKey}"`);
      
      // Fallback: try to find templates that match the original sessionType exactly
      console.log(`🎯 Step 2: Looking for exact match with session type "${sessionType}"`);
      defaultTemplate = allTemplates.find(template => 
        template.sessionTypes && template.sessionTypes.includes(sessionType)
      );
      
      if (defaultTemplate) {
        console.log(`✅ FOUND: Template "${defaultTemplate.name}" has exact match for session type "${sessionType}"`);
      } else {
        console.log(`❌ No exact match found for session type "${sessionType}"`);
        
        // Last resort: use any available template, preferring default ones
        console.log("🎯 Step 3: Using fallback template selection");
        defaultTemplate = allTemplates.find(t => t.isDefault);
        if (defaultTemplate) {
          console.log(`✅ FOUND: Using default template "${defaultTemplate.name}"`);
        } else {
          defaultTemplate = allTemplates[0];
          if (defaultTemplate) {
            console.log(`✅ FOUND: Using first available template "${defaultTemplate.name}"`);
          }
        }
      }
    }
    
    if (!defaultTemplate) {
      console.error("💥 CRITICAL ERROR: No workflow template found at all!");
      console.error("This shouldn't happen if default templates were initialized properly");
      return null;
    }

    console.log(`🏗️ Creating workflow instance using template: "${defaultTemplate.name}"`);
    console.log(`📅 Session date: ${sessionData.date}`);

    // Parse session date to calculate step due dates
    const sessionDate = new Date(sessionData.date);
    
    // Initialize step progress for all steps in template with calculated due dates
    console.log(`📋 Initializing ${defaultTemplate.steps.length} workflow steps...`);
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
      
      console.log(`  ${index + 1}. "${step.title}" - Due: ${dueDate ? dueDate.toLocaleDateString() : 'Not set'}`);
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

    console.log("🚀 Creating workflow instance in Firestore...");
    const workflowId = await createWorkflowInstance(workflowData);
    
    if (workflowId) {
      console.log(`🎉 SUCCESS: Workflow created!`);
      console.log(`📋 Workflow ID: ${workflowId}`);
      console.log(`📄 Template Used: "${defaultTemplate.name}"`);
      console.log(`🎯 Session Type: "${sessionType}"`);
    } else {
      console.error("💥 FAILED: createWorkflowInstance returned null/undefined");
    }
    
    return workflowId;
  } catch (error) {
    console.error("Error auto-creating workflow for session:", error);
    throw error;
  }
};
