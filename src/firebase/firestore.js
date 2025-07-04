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
export const createDailyJobReport = async (organizationID, reportData) => {
  try {
    const reportRef = await addDoc(collection(firestore, "dailyJobReports"), {
      ...reportData,
      organizationID,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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

// Schools Functions (renamed from Dropdown Data)
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

// Daily Job Report Templates Functions (for web app)
export const getReportTemplates = async (organizationID, shootType = null) => {
  try {
    let q = query(
      collection(firestore, "dailyJobReportTemplates"),
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
    console.error("Error fetching report templates:", error);
    throw error;
  }
};

export const createReportTemplate = async (
  organizationID,
  templateData,
  createdBy
) => {
  try {
    const templateRef = await addDoc(
      collection(firestore, "dailyJobReportTemplates"),
      {
        ...templateData,
        organizationID,
        createdBy,
        isActive: true,
        version: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
    return templateRef.id;
  } catch (error) {
    console.error("Error creating report template:", error);
    throw error;
  }
};
