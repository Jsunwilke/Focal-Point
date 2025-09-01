// src/contexts/ClassGroupsContext.jsx
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
  createTrackedGetDoc,
  getDocs
} from "../services/firestoreWrapper";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import classGroupsCacheService from "../services/classGroupsCacheService";
import { readCounter } from "../services/readCounter";

const ClassGroupsContext = createContext();

// Define the collection name
const CLASS_GROUPS_COLLECTION = "classGroupJobs";

export const useClassGroups = () => {
  const context = useContext(ClassGroupsContext);
  if (!context) {
    throw new Error("useClassGroups must be used within a ClassGroupsProvider");
  }
  return context;
};

export const ClassGroupsProvider = ({ children }) => {
  const { organization, user } = useAuth();
  const { showToast } = useToast();

  // State
  const [classGroupJobs, setClassGroupJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [sortField, setSortField] = useState("sessionDate");
  const [sortDirection, setSortDirection] = useState("desc");

  // Real-time class groups listener with cache-first loading
  useEffect(() => {
    if (!organization?.id) return;

    // Load from cache first for instant display
    const cachedJobs = classGroupsCacheService.getCachedClassGroups(organization.id);
    if (cachedJobs && cachedJobs.length > 0) {
      setClassGroupJobs(cachedJobs);
      setLoading(false);
      
      // Track cache hit
      readCounter.recordCacheHit('classGroupJobs', 'ClassGroupsContext', cachedJobs.length);
    } else {
      setLoading(true);
      // Track cache miss
      readCounter.recordCacheMiss('classGroupJobs', 'ClassGroupsContext');
    }

    const classGroupsQuery = query(
      collection(firestore, CLASS_GROUPS_COLLECTION),
      where("organizationId", "==", organization.id),
      orderBy("sessionDate", "desc")
    );

    const trackedOnSnapshot = createTrackedOnSnapshot('ClassGroupsContext');
    const unsubscribe = trackedOnSnapshot(
      classGroupsQuery,
      (snapshot) => {
        const jobs = [];
        snapshot.forEach((doc) => {
          const jobData = doc.data();
          jobData.id = doc.id;
          jobs.push(jobData);
        });

        setClassGroupJobs(jobs);
        setLoading(false);
        
        // Update cache
        classGroupsCacheService.setCachedClassGroups(organization.id, jobs);

        // Track reads
        if (!snapshot.metadata.fromCache) {
          readCounter.recordRead('onSnapshot', 'classGroupJobs', 'ClassGroupsContext', snapshot.size);
        }
      },
      (error) => {
        console.error("Error fetching class group jobs:", error);
        showToast("Failed to load class groups", "error");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [organization, showToast]);

  // Create a new class group job
  const createClassGroupJob = useCallback(async (jobData) => {
    if (!organization?.id || !user?.uid) {
      showToast("Missing organization or user information", "error");
      return null;
    }

    try {
      const newJob = {
        ...jobData,
        organizationId: organization.id,
        createdBy: user.uid,
        lastModifiedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        jobType: "classGroups"
      };

      const docRef = await addDoc(collection(firestore, CLASS_GROUPS_COLLECTION), newJob);
      
      // Track the write
      readCounter.recordRead('addDoc', 'classGroupJobs', 'ClassGroupsContext', 1);
      
      showToast("Class group job created successfully", "success");
      return docRef.id;
    } catch (error) {
      console.error("Error creating class group job:", error);
      showToast("Failed to create class group job", "error");
      return null;
    }
  }, [organization, user, showToast]);

  // Update an existing class group job
  const updateClassGroupJob = useCallback(async (jobId, updates) => {
    if (!user?.uid) {
      showToast("Missing user information", "error");
      return false;
    }

    try {
      const jobRef = doc(firestore, CLASS_GROUPS_COLLECTION, jobId);
      await updateDoc(jobRef, {
        ...updates,
        lastModifiedBy: user.uid,
        updatedAt: serverTimestamp()
      });

      // Update cache
      const updatedJob = classGroupJobs.find(j => j.id === jobId);
      if (updatedJob && organization?.id) {
        const mergedJob = { ...updatedJob, ...updates };
        classGroupsCacheService.updateCachedClassGroupJob(organization.id, mergedJob);
      }

      // Track the write
      readCounter.recordRead('updateDoc', 'classGroupJobs', 'ClassGroupsContext', 1);
      
      showToast("Class group job updated successfully", "success");
      return true;
    } catch (error) {
      console.error("Error updating class group job:", error);
      showToast("Failed to update class group job", "error");
      return false;
    }
  }, [user, classGroupJobs, organization, showToast]);

  // Delete a class group job
  const deleteClassGroupJob = useCallback(async (jobId) => {
    try {
      await deleteDoc(doc(firestore, CLASS_GROUPS_COLLECTION, jobId));

      // Remove from cache
      if (organization?.id) {
        classGroupsCacheService.removeCachedClassGroupJob(organization.id, jobId);
      }

      // Track the write
      readCounter.recordRead('deleteDoc', 'classGroupJobs', 'ClassGroupsContext', 1);
      
      showToast("Class group job deleted successfully", "success");
      return true;
    } catch (error) {
      console.error("Error deleting class group job:", error);
      showToast("Failed to delete class group job", "error");
      return false;
    }
  }, [organization, showToast]);

  // Get a single class group job
  const getClassGroupJob = useCallback(async (jobId) => {
    try {
      // Check cache first
      const cachedJob = classGroupsCacheService.getCachedClassGroupJob(jobId);
      if (cachedJob) {
        readCounter.recordCacheHit('classGroupJobs', 'ClassGroupsContext', 1);
        return cachedJob;
      }

      // If not in cache, fetch from Firestore
      readCounter.recordCacheMiss('classGroupJobs', 'ClassGroupsContext');
      
      const trackedGetDoc = createTrackedGetDoc('ClassGroupsContext');
      const docSnap = await trackedGetDoc(doc(firestore, CLASS_GROUPS_COLLECTION, jobId));
      
      if (docSnap.exists()) {
        const jobData = { id: docSnap.id, ...docSnap.data() };
        
        // Cache the single job
        classGroupsCacheService.setCachedClassGroupJob(jobId, jobData);
        
        // Track the read
        readCounter.recordRead('getDoc', 'classGroupJobs', 'ClassGroupsContext', 1);
        
        return jobData;
      }
      
      return null;
    } catch (error) {
      console.error("Error fetching class group job:", error);
      showToast("Failed to load class group job", "error");
      return null;
    }
  }, [showToast]);

  // Add a class group to an existing job
  const addClassGroup = useCallback(async (jobId, classGroup) => {
    const job = classGroupJobs.find(j => j.id === jobId);
    if (!job) {
      showToast("Job not found", "error");
      return false;
    }

    const updatedGroups = [...(job.classGroups || []), {
      ...classGroup,
      id: classGroup.id || crypto.randomUUID()
    }];

    return await updateClassGroupJob(jobId, { classGroups: updatedGroups });
  }, [classGroupJobs, updateClassGroupJob, showToast]);

  // Update a specific class group within a job
  const updateClassGroup = useCallback(async (jobId, groupId, updates) => {
    const job = classGroupJobs.find(j => j.id === jobId);
    if (!job) {
      showToast("Job not found", "error");
      return false;
    }

    const updatedGroups = (job.classGroups || []).map(group =>
      group.id === groupId ? { ...group, ...updates } : group
    );

    return await updateClassGroupJob(jobId, { classGroups: updatedGroups });
  }, [classGroupJobs, updateClassGroupJob, showToast]);

  // Delete a specific class group from a job
  const deleteClassGroup = useCallback(async (jobId, groupId) => {
    const job = classGroupJobs.find(j => j.id === jobId);
    if (!job) {
      showToast("Job not found", "error");
      return false;
    }

    const updatedGroups = (job.classGroups || []).filter(group => group.id !== groupId);

    return await updateClassGroupJob(jobId, { classGroups: updatedGroups });
  }, [classGroupJobs, updateClassGroupJob, showToast]);

  // Filter and sort class group jobs
  const getFilteredAndSortedJobs = useCallback(() => {
    let filtered = [...classGroupJobs];

    // Apply school filter
    if (filterSchool) {
      filtered = filtered.filter(job => job.schoolId === filterSchool);
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(job => {
        // Search in school name
        if (job.schoolName?.toLowerCase().includes(query)) return true;
        
        // Search in class groups
        if (job.classGroups?.some(group => 
          group.grade?.toLowerCase().includes(query) ||
          group.teacher?.toLowerCase().includes(query) ||
          group.notes?.toLowerCase().includes(query)
        )) return true;
        
        return false;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle special cases
      if (sortField === 'sessionDate' || sortField === 'createdAt' || sortField === 'updatedAt') {
        aVal = aVal?.seconds || 0;
        bVal = bVal?.seconds || 0;
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal?.toLowerCase() || '';
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return filtered;
  }, [classGroupJobs, filterSchool, searchQuery, sortField, sortDirection]);

  // Clear all caches
  const clearCache = useCallback(() => {
    if (organization?.id) {
      classGroupsCacheService.clearClassGroupsCache(organization.id);
      showToast("Cache cleared", "info");
    }
  }, [organization, showToast]);

  const value = {
    // State
    classGroupJobs,
    loading,
    selectedJobId,
    searchQuery,
    filterSchool,
    sortField,
    sortDirection,
    
    // Setters
    setSelectedJobId,
    setSearchQuery,
    setFilterSchool,
    setSortField,
    setSortDirection,
    
    // CRUD operations
    createClassGroupJob,
    updateClassGroupJob,
    deleteClassGroupJob,
    getClassGroupJob,
    
    // Class group operations
    addClassGroup,
    updateClassGroup,
    deleteClassGroup,
    
    // Utility functions
    getFilteredAndSortedJobs,
    clearCache
  };

  return (
    <ClassGroupsContext.Provider value={value}>
      {children}
    </ClassGroupsContext.Provider>
  );
};