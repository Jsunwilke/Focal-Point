// src/contexts/JobsContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  firestore,
  createTrackedOnSnapshot,
  createTrackedGetDoc
} from "../services/firestoreWrapper";
import { useAuth } from "./AuthContext"; // Use existing auth context
import { useToast } from "./ToastContext";
import jobsCacheService from "../services/jobsCacheService";
import { readCounter } from "../services/readCounter";

const JobsContext = createContext();

// Define the collection name
const SPORTS_JOBS_COLLECTION = "sportsJobs";

export const useJobs = () => {
  const context = useContext(JobsContext);
  if (!context) {
    throw new Error("useJobs must be used within a JobsProvider");
  }
  return context;
};

export const JobsProvider = ({ children }) => {
  const { organization } = useAuth(); // Use organization from existing auth
  const { showToast } = useToast();

  // State
  const [allJobs, setAllJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentJobID, setCurrentJobID] = useState("");
  const [rosterData, setRosterData] = useState([]);
  const [groupsData, setGroupsData] = useState([]);

  // Search and filter state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [currentSearchType, setCurrentSearchType] = useState("jobs");
  const [currentFolderView, setCurrentFolderView] = useState({
    level: "root",
    school: null,
    year: null,
  });

  // Real-time jobs listener with cache-first loading
  useEffect(() => {
    if (!organization?.id) return;

    // Load from cache first for instant display
    const cachedJobs = jobsCacheService.getCachedJobs(organization.id);
    if (cachedJobs && cachedJobs.length > 0) {
      setAllJobs(cachedJobs);
      setLoading(false);
      
      // Track cache hit
      readCounter.recordCacheHit('sportsJobs', 'JobsContext', cachedJobs.length);
    } else {
      setLoading(true);
      // Track cache miss
      readCounter.recordCacheMiss('sportsJobs', 'JobsContext');
    }

    const jobsQuery = query(
      collection(firestore, SPORTS_JOBS_COLLECTION),
      where("organizationID", "==", organization.id),
      orderBy("shootDate", "desc")
    );

    const trackedOnSnapshot = createTrackedOnSnapshot('JobsContext');
    const unsubscribe = trackedOnSnapshot(
      jobsQuery,
      (snapshot) => {
        const jobs = [];
        snapshot.forEach((doc) => {
          const jobData = doc.data();
          jobData.id = doc.id;
          jobs.push(jobData);
        });

        setAllJobs(jobs);
        setLoading(false);
        
        // Cache the updated jobs
        jobsCacheService.setCachedJobs(organization.id, jobs);
      },
      (error) => {
        console.error("Error listening to jobs:", error);
        showToast("Error", "Failed to load jobs: " + error.message, "error");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [organization?.id, showToast]);

  // Create job
  const createJob = async (jobData) => {
    try {
      const job = {
        ...jobData,
        organizationID: organization.id,
        isArchived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(firestore, SPORTS_JOBS_COLLECTION),
        job
      );
      
      // Update cache with new job
      const newJob = { ...job, id: docRef.id };
      const cachedJobs = jobsCacheService.getCachedJobs(organization.id) || [];
      jobsCacheService.setCachedJobs(organization.id, [newJob, ...cachedJobs]);
      
      showToast("Success", "Sports job created successfully");
      return docRef.id;
    } catch (error) {
      console.error("Error creating job:", error);
      showToast("Error", "Failed to create job: " + error.message, "error");
      throw error;
    }
  };

  // Update job
  const updateJob = async (jobId, updates) => {
    try {
      const jobRef = doc(firestore, SPORTS_JOBS_COLLECTION, jobId);
      await updateDoc(jobRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      
      // Update cache
      const currentJob = allJobs.find(job => job.id === jobId);
      if (currentJob) {
        const updatedJob = { ...currentJob, ...updates, updatedAt: new Date() };
        jobsCacheService.updateCachedJob(organization.id, updatedJob);
      }
      
      showToast("Success", "Job updated successfully");
    } catch (error) {
      console.error("Error updating job:", error);
      showToast("Error", "Failed to update job: " + error.message, "error");
      throw error;
    }
  };

  // Delete job
  const deleteJob = async (jobId) => {
    try {
      await deleteDoc(doc(firestore, SPORTS_JOBS_COLLECTION, jobId));
      
      // Remove from cache
      jobsCacheService.removeCachedJob(organization.id, jobId);
      
      showToast("Success", "Job deleted successfully");
    } catch (error) {
      console.error("Error deleting job:", error);
      showToast("Error", "Failed to delete job: " + error.message, "error");
      throw error;
    }
  };

  // Get job by ID
  const getJob = async (jobId) => {
    try {
      const jobDoc = await getDoc(
        doc(firestore, SPORTS_JOBS_COLLECTION, jobId)
      );
      if (jobDoc.exists()) {
        const jobData = jobDoc.data();
        jobData.id = jobDoc.id;
        return jobData;
      }
      return null;
    } catch (error) {
      console.error("Error getting job:", error);
      throw error;
    }
  };

  // Update job roster
  const updateJobRoster = async (jobId, roster) => {
    try {
      const jobRef = doc(firestore, SPORTS_JOBS_COLLECTION, jobId);
      await updateDoc(jobRef, {
        roster: roster,
        updatedAt: serverTimestamp(),
      });

      // Update local state if this is the current job
      if (jobId === currentJobID) {
        setRosterData(roster);
      }

      showToast("Success", "Roster updated successfully");
    } catch (error) {
      console.error("Error updating roster:", error);
      showToast("Error", "Failed to update roster: " + error.message, "error");
      throw error;
    }
  };

  // Update job groups
  const updateJobGroups = async (jobId, groups) => {
    try {
      const jobRef = doc(firestore, SPORTS_JOBS_COLLECTION, jobId);
      await updateDoc(jobRef, {
        groupImages: groups,
        updatedAt: serverTimestamp(),
      });

      // Update local state if this is the current job
      if (jobId === currentJobID) {
        setGroupsData(groups);
      }

      showToast("Success", "Groups updated successfully");
    } catch (error) {
      console.error("Error updating groups:", error);
      showToast("Error", "Failed to update groups: " + error.message, "error");
      throw error;
    }
  };

  // Toggle job archive status
  const toggleJobArchiveStatus = async (jobId, shouldArchive) => {
    try {
      const jobRef = doc(firestore, SPORTS_JOBS_COLLECTION, jobId);
      await updateDoc(jobRef, {
        isArchived: shouldArchive,
        updatedAt: serverTimestamp(),
      });

      const actionText = shouldArchive ? "completed" : "activated";
      showToast("Success", `Job marked as ${actionText}`);
    } catch (error) {
      console.error(
        `Error ${shouldArchive ? "archiving" : "activating"} job:`,
        error
      );
      showToast(
        "Error",
        `Failed to ${shouldArchive ? "archive" : "activate"} job: ${
          error.message
        }`,
        "error"
      );
      throw error;
    }
  };

  // Filter jobs by archived status
  const getJobsByStatus = useCallback(
    (isArchived) => {
      return allJobs.filter((job) => job.isArchived === isArchived);
    },
    [allJobs]
  );

  // Sort jobs
  const sortJobs = useCallback((jobs, sortType) => {
    const sortedJobs = [...jobs];

    switch (sortType) {
      case "date-desc":
        sortedJobs.sort((a, b) => {
          const dateA = a.shootDate?.toDate
            ? a.shootDate.toDate()
            : new Date(a.shootDate);
          const dateB = b.shootDate?.toDate
            ? b.shootDate.toDate()
            : new Date(b.shootDate);
          return dateB - dateA;
        });
        break;
      case "date-asc":
        sortedJobs.sort((a, b) => {
          const dateA = a.shootDate?.toDate
            ? a.shootDate.toDate()
            : new Date(a.shootDate);
          const dateB = b.shootDate?.toDate
            ? b.shootDate.toDate()
            : new Date(b.shootDate);
          return dateA - dateB;
        });
        break;
      case "name-asc":
        sortedJobs.sort((a, b) =>
          (a.schoolName || "").localeCompare(b.schoolName || "")
        );
        break;
      case "name-desc":
        sortedJobs.sort((a, b) =>
          (b.schoolName || "").localeCompare(a.schoolName || "")
        );
        break;
      case "seasonType-asc":
        sortedJobs.sort((a, b) =>
          (a.seasonType || a.sportName || "").localeCompare(
            b.seasonType || b.sportName || ""
          )
        );
        break;
      case "seasonType-desc":
        sortedJobs.sort((a, b) =>
          (b.seasonType || b.sportName || "").localeCompare(
            a.seasonType || a.sportName || ""
          )
        );
        break;
      default:
        // Default to newest first
        sortedJobs.sort((a, b) => {
          const dateA = a.shootDate?.toDate
            ? a.shootDate.toDate()
            : new Date(a.shootDate);
          const dateB = b.shootDate?.toDate
            ? b.shootDate.toDate()
            : new Date(b.shootDate);
          return dateB - dateA;
        });
    }

    return sortedJobs;
  }, []);

  const value = {
    // State
    allJobs,
    loading,
    currentJobID,
    setCurrentJobID,
    rosterData,
    setRosterData,
    groupsData,
    setGroupsData,

    // Search state
    isSearchActive,
    setIsSearchActive,
    currentSearchType,
    setCurrentSearchType,
    currentFolderView,
    setCurrentFolderView,

    // Actions
    createJob,
    updateJob,
    deleteJob,
    getJob,
    updateJobRoster,
    updateJobGroups,
    toggleJobArchiveStatus,

    // Utilities
    getJobsByStatus,
    sortJobs,
  };

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
};
