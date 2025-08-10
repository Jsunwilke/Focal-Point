import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot, 
  orderBy, 
  limit, 
  Timestamp,
  firestore 
} from '../services/firestoreWrapper';
import { readCounter } from '../services/readCounter';
import secureLogger from '../utils/secureLogger';
import dataCacheService from '../services/dataCacheService';
import { dailyJobReportsCacheService } from '../services/dailyJobReportsCacheService';
import { subscribeToDailyJobReports, subscribeToNewDailyJobReports } from '../firebase/firestore';

const DataCacheContext = createContext();

export const useDataCache = () => {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
};

// Helper function to format dates consistently
const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const DataCacheProvider = ({ children }) => {
  const { userProfile, organization } = useAuth();
  const { showToast } = useToast();
  
  // Store organization ID in state to use as stable dependency
  const [currentOrgId, setCurrentOrgId] = useState(organization?.id);
  
  // Update org ID only when it actually changes
  useEffect(() => {
    if (organization?.id !== currentOrgId) {
      setCurrentOrgId(organization?.id);
    }
  }, [organization?.id, currentOrgId]);

  // Cache state
  const [sessionsCache, setSessionsCache] = useState({
    data: [],
    loading: true,
    lastUpdated: null,
    error: null
  });

  const [usersCache, setUsersCache] = useState({
    data: [],
    loading: true,
    lastUpdated: null,
    error: null
  });

  const [timeOffCache, setTimeOffCache] = useState({
    data: [],           // Processed calendar entries for display
    requests: [],       // Raw time off requests for approval modal
    loading: true,
    lastUpdated: null,
    error: null
  });

  const [dailyJobReportsCache, setDailyJobReportsCache] = useState({
    data: [],
    loading: true,
    lastUpdated: null,
    error: null
  });

  // Ref to access current state without causing re-renders
  const usersCacheRef = useRef(usersCache);
  usersCacheRef.current = usersCache;

  // Refs to track if listeners are active (persist across renders)
  const listenersActiveRef = useRef({
    sessions: false,
    users: false,
    timeOff: false,
    dailyJobReports: false
  });

  // Listener cleanup functions
  const [listeners, setListeners] = useState({
    sessions: null,
    users: null,
    timeOff: null,
    dailyJobReports: null
  });

  // Process sessions data for calendar format
  const processSessionsData = useCallback((snapshotOrArray, userRole) => {
    const sessionsData = [];
    
    // Use ref to access current users state
    const users = usersCacheRef.current.data || [];
    
    // Handle both snapshot and array formats
    if (Array.isArray(snapshotOrArray)) {
      // Handle cached array data
      snapshotOrArray.forEach((sessionData) => {
        // Check if user can see unpublished sessions
        const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
        
        // Include session if:
        // 1. It's published (or isPublished is not set for backward compatibility)
        // 2. User is admin/manager (can see all sessions)
        if (sessionData.isPublished !== false || isAdminOrManager) {
          sessionsData.push(sessionData);
        }
      });
    } else {
      // Handle Firestore snapshot
      snapshotOrArray.forEach((doc) => {
        const sessionData = {
          id: doc.id,
          ...doc.data(),
        };
        
        // Check if user can see unpublished sessions
        const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
        
        // Include session if:
        // 1. It's published (or isPublished is not set for backward compatibility)
        // 2. User is admin/manager (can see all sessions)
        if (sessionData.isPublished !== false || isAdminOrManager) {
          sessionsData.push(sessionData);
        }
      });
    }

    // Convert sessions to calendar format
    const sessionData = sessionsData
      .map((session) => {
        // Handle date properly to avoid timezone issues
        let sessionDate = session.date;
        if (typeof session.date === "string") {
          sessionDate = session.date;
        } else if (session.date && session.date.toDate) {
          const date = session.date.toDate();
          sessionDate = formatLocalDate(date);
        } else if (session.date instanceof Date) {
          sessionDate = formatLocalDate(session.date);
        }

        // For sessions with multiple photographers, create separate entries for each
        if (session.photographers && Array.isArray(session.photographers) && session.photographers.length > 0) {
          return session.photographers.map((photographer) => {
            // Dynamically resolve photographer name from current users
            const currentUser = users.find(u => u.id === photographer.id);
            const resolvedName = currentUser?.displayName || 
                                `${currentUser?.firstName} ${currentUser?.lastName}` || 
                                photographer.name;
            
            return {
              id: `${session.id}-${photographer.id}`,
              sessionId: session.id,
              title: session.title || `${session.sessionType || 'Session'} at ${session.schoolName || 'School'}`,
              date: sessionDate,
              startTime: session.startTime,
              endTime: session.endTime,
              photographerId: photographer.id,
              photographerName: resolvedName,
              sessionType: session.sessionType || "session",
              sessionTypes: session.sessionTypes || [session.sessionType || "session"],
              customSessionType: session.customSessionType,
              status: session.status || "scheduled",
              isPublished: session.isPublished !== false,
              schoolId: session.schoolId,
              schoolName: session.schoolName || session.location || "",
              location: session.location || session.schoolName || "",
              notes: session.notes,
              photographerNotes: photographer.notes || '',
            };
          });
        } else {
          // Session without photographers - create a single entry
          return [{
            id: session.id,
            sessionId: session.id,
            title: session.title || `${session.sessionType || 'Session'} at ${session.schoolName || 'School'}`,
            date: sessionDate,
            startTime: session.startTime,
            endTime: session.endTime,
            photographerId: null,
            photographerName: null,
            sessionType: session.sessionType || "session",
            sessionTypes: session.sessionTypes || [session.sessionType || "session"],
            customSessionType: session.customSessionType,
            status: session.status || "scheduled",
            isPublished: session.isPublished !== false,
            schoolId: session.schoolId,
            schoolName: session.schoolName || session.location || "",
            location: session.location || session.schoolName || "",
            notes: session.notes,
          }];
        }
      })
      .flat();

    return sessionData;
  }, []);

  // Process users data
  const processUsersData = useCallback((snapshotOrArray) => {
    const members = [];
    
    // Handle both snapshot and array formats
    if (Array.isArray(snapshotOrArray)) {
      // Handle cached array data
      members.push(...snapshotOrArray);
    } else {
      // Handle Firestore snapshot
      snapshotOrArray.forEach((doc) => {
        members.push({
          id: doc.id,
          ...doc.data(),
        });
      });
    }

    // Sort by active status first, then by name
    return members.sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return b.isActive ? 1 : -1; // Active users first
      }
      const nameA = a.displayName || `${a.firstName} ${a.lastName}` || a.email;
      const nameB = b.displayName || `${b.firstName} ${b.lastName}` || b.email;
      return nameA.localeCompare(nameB);
    });
  }, []);

  // Process time-off data into calendar format
  const processTimeOffData = useCallback((snapshotOrArray) => {
    const requests = [];
    
    // Handle both snapshot and array formats
    if (Array.isArray(snapshotOrArray)) {
      // Handle cached array data
      requests.push(...snapshotOrArray);
    } else {
      // Handle Firestore snapshot
      snapshotOrArray.forEach((doc) => {
        requests.push({
          id: doc.id,
          ...doc.data(),
        });
      });
    }
    
    // Convert to calendar entries immediately (like sessions)
    const calendarEntries = [];
    requests.forEach(request => {
      // Only include approved, pending, under_review, and partially_approved requests
      if (!['pending', 'under_review', 'approved', 'partially_approved'].includes(request.status)) return;
      
      const startDate = request.startDate?.toDate ? request.startDate.toDate() : new Date(request.startDate);
      const endDate = request.endDate?.toDate ? request.endDate.toDate() : new Date(request.endDate);
      
      // Create entries for each day of time off
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = formatLocalDate(currentDate);
        
        // For partially approved requests, only show approved days
        if (request.status === 'partially_approved' && request.dayStatuses) {
          // Check if this specific day is approved
          const dayStatus = request.dayStatuses[dateStr];
          if (!dayStatus || dayStatus.status !== 'approved') {
            // Skip this day if it's not approved
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
        }
        
        // Use actual times for partial day, default times for full day
        const displayStartTime = request.isPartialDay && request.startTime ? request.startTime : '09:00';
        const displayEndTime = request.isPartialDay && request.endTime ? request.endTime : '17:00';
        
        // For partially approved requests, show as approved on calendar
        const displayStatus = request.status === 'partially_approved' ? 'approved' : request.status;
        
        calendarEntries.push({
          id: `timeoff-${request.id}-${dateStr}`,
          sessionId: request.id,
          title: request.isPartialDay 
            ? `Time Off: ${request.reason} (${displayStartTime} - ${displayEndTime})`
            : `Time Off: ${request.reason}`,
          date: dateStr,
          startTime: displayStartTime,
          endTime: displayEndTime,
          photographerId: request.photographerId,
          photographerName: request.photographerName,
          sessionType: 'timeoff',
          sessionTypes: ['timeoff'],
          status: displayStatus,
          isTimeOff: true,
          isPartialDay: request.isPartialDay || false,
          reason: request.reason,
          notes: request.notes,
          // Keep original request data for filtering
          originalRequest: request
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    return calendarEntries;
  }, []);

  // Process daily job reports data
  const processDailyJobReportsData = useCallback((snapshotOrArray) => {
    const reports = [];
    
    // Handle both snapshot and array formats
    if (Array.isArray(snapshotOrArray)) {
      // Handle cached array data
      reports.push(...snapshotOrArray);
    } else {
      // Handle Firestore snapshot
      snapshotOrArray.forEach((doc) => {
        reports.push({
          id: doc.id,
          ...doc.data(),
        });
      });
    }
    
    // Return reports as-is, no processing needed
    return reports;
  }, []);

  // Set up real-time listener for sessions
  const setupSessionsListener = useCallback(() => {
    if (!organization?.id || !userProfile) return;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsForward = new Date();
    sixMonthsForward.setMonth(sixMonthsForward.getMonth() + 6);

    const sessionsQuery = query(
      collection(firestore, "sessions"),
      where("organizationID", "==", organization.id),
      where("date", ">=", formatLocalDate(threeMonthsAgo)),
      where("date", "<=", formatLocalDate(sixMonthsForward)),
      orderBy("date", "desc"),
      limit(500) // Reduced from 1000 for better performance
    );

    let isInitialLoad = true;

    const unsubscribe = onSnapshot(
      sessionsQuery,
      { includeMetadataChanges: false }, // Only real changes, not metadata
      (snapshot) => {
        if (isInitialLoad) {
          // Initial load - process all documents
          const rawSessions = [];
          snapshot.forEach((doc) => {
            rawSessions.push({ id: doc.id, ...doc.data() });
          });

          const processedData = processSessionsData(rawSessions, userProfile.role);
          
          setSessionsCache({
            data: processedData,
            loading: false,
            lastUpdated: new Date(),
            error: null
          });
          
          // Update cache
          dataCacheService.setCachedSessions(organization.id, rawSessions);
          dataCacheService.setLastSyncTime(organization.id, 'sessions');
          
          // Track initial load reads
          if (!snapshot.metadata.fromCache) {
            readCounter.recordRead('onSnapshot-initial', 'sessions', 'DataCacheContext', snapshot.size);
            secureLogger.debug("Sessions initial load:", snapshot.size, "documents");
          }
          
          isInitialLoad = false;
        } else {
          // Incremental updates - only process changed documents
          const changes = snapshot.docChanges();
          
          if (changes.length > 0) {
            // Get current cached sessions
            const cachedSessions = dataCacheService.getCachedSessions(organization.id) || [];
            let updatedSessions = [...cachedSessions];
            
            changes.forEach((change) => {
              const docData = { id: change.doc.id, ...change.doc.data() };
              
              if (change.type === 'added') {
                // Add new session
                updatedSessions.push(docData);
              } else if (change.type === 'modified') {
                // Update existing session
                const index = updatedSessions.findIndex(s => s.id === docData.id);
                if (index !== -1) {
                  updatedSessions[index] = docData;
                }
              } else if (change.type === 'removed') {
                // Remove session
                updatedSessions = updatedSessions.filter(s => s.id !== docData.id);
              }
            });
            
            // Process updated data
            const processedData = processSessionsData(updatedSessions, userProfile.role);
            
            setSessionsCache({
              data: processedData,
              loading: false,
              lastUpdated: new Date(),
              error: null
            });
            
            // Update cache
            dataCacheService.setCachedSessions(organization.id, updatedSessions);
            dataCacheService.setLastSyncTime(organization.id, 'sessions');
            
            // Track only changed documents
            readCounter.recordRead('onSnapshot-changes', 'sessions', 'DataCacheContext', changes.length);
            secureLogger.debug("Sessions incremental update:", changes.length, "documents changed");
          }
        }
      },
      (error) => {
        secureLogger.error("Sessions listener error:", error);
        setSessionsCache(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      }
    );

    return unsubscribe;
  }, [organization?.id, userProfile, processSessionsData]);

  // Set up sessions real-time listener with cache-first loading
  useEffect(() => {
    if (!organization?.id || !userProfile) return;

    let unsubscribe = null;
    let syncTimeout = null;

    // Load from cache first for instant display
    const cachedSessions = dataCacheService.getCachedSessions(organization.id);
    if (cachedSessions) {
      const processedData = processSessionsData(cachedSessions, userProfile.role);
      setSessionsCache({
        data: processedData,
        loading: false,
        lastUpdated: new Date(),
        error: null
      });
      readCounter.recordCacheHit('sessions', 'DataCacheContext', cachedSessions.length);
      
      // Delay real-time sync to avoid immediate reads when user is just passing through
      syncTimeout = setTimeout(() => {
        unsubscribe = setupSessionsListener();
      }, 5000); // 5 second delay
    } else {
      // No cache - need immediate sync
      setSessionsCache(prev => ({ ...prev, loading: true, error: null }));
      readCounter.recordCacheMiss('sessions', 'DataCacheContext');
      unsubscribe = setupSessionsListener();
    }

    // Store cleanup function
    setListeners(prev => ({ 
      ...prev, 
      sessions: () => {
        if (syncTimeout) clearTimeout(syncTimeout);
        if (unsubscribe) unsubscribe();
      }
    }));

    return () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      if (unsubscribe) unsubscribe();
    };
  }, [organization?.id, userProfile, processSessionsData, setupSessionsListener]);

  // Set up real-time listener for users
  const setupUsersListener = useCallback((orgId, existingCachedUsers = null) => {
    if (!orgId) return;

    const usersQuery = query(
      collection(firestore, "users"),
      where("organizationID", "==", orgId)
      // Removed orderBy - sorting is done client-side in processUsersData
    );

    let isInitialLoad = true;

    const unsubscribe = onSnapshot(
      usersQuery,
      { includeMetadataChanges: false },
      (snapshot) => {
        if (isInitialLoad) {
          // Initial load - process all documents
          const rawUsers = [];
          snapshot.forEach((doc) => {
            rawUsers.push({ id: doc.id, ...doc.data() });
          });

          // Check for differences between cached and live data
          let changesDetected = [];
          if (existingCachedUsers && existingCachedUsers.length > 0) {
            // Compare cached data with live data to detect changes
            
            rawUsers.forEach((liveUser) => {
              const cachedUser = existingCachedUsers.find(u => u.id === liveUser.id);
              if (cachedUser) {
                // Check if user data has changed
                const hasChanged = JSON.stringify(cachedUser) !== JSON.stringify(liveUser);
                if (hasChanged) {
                  changesDetected.push({
                    type: 'modified',
                    id: liveUser.id,
                    data: liveUser
                  });
                  secureLogger.debug("Detected user change during initial sync:", liveUser.id, {
                    cached: cachedUser.displayName || cachedUser.firstName,
                    live: liveUser.displayName || liveUser.firstName
                  });
                }
              } else {
                // New user not in cache
                changesDetected.push({
                  type: 'added',
                  id: liveUser.id,
                  data: liveUser
                });
              }
            });
            
            // Check for removed users
            existingCachedUsers.forEach((cachedUser) => {
              if (!rawUsers.find(u => u.id === cachedUser.id)) {
                changesDetected.push({
                  type: 'removed',
                  id: cachedUser.id
                });
              }
            });
            
            if (changesDetected.length > 0) {
              secureLogger.debug("Changes detected between cache and live data:", changesDetected.length, "changes");
            }
          }

          const processedData = processUsersData(rawUsers);
          
          setUsersCache({
            data: processedData,
            loading: false,
            lastUpdated: new Date(),
            error: null
          });
          
          // Update cache with fresh data
          dataCacheService.setCachedUsers(orgId, rawUsers);
          dataCacheService.setLastSyncTime(orgId, 'users');
          
          // Track initial load reads
          if (!snapshot.metadata.fromCache) {
            // If we had cached data and are comparing, only count actual changes
            if (existingCachedUsers && existingCachedUsers.length > 0) {
              if (changesDetected.length > 0) {
                console.log('📊 USERS LISTENER: Initial sync detected', changesDetected.length, 'changes from cached data');
                readCounter.recordRead('onSnapshot-sync', 'users', 'DataCacheContext', changesDetected.length);
                secureLogger.debug("Users sync with cache:", changesDetected.length, "changes detected");
              } else {
                console.log('📊 USERS LISTENER: Initial sync - no changes from cached data (0 reads)');
                // No changes detected, data came from Firestore's cache
              }
            } else {
              // No cached data, this is a full fresh load
              console.log('📊 USERS LISTENER: Initial load fetched', snapshot.size, 'users from Firebase (no cache)');
              readCounter.recordRead('onSnapshot-initial', 'users', 'DataCacheContext', snapshot.size);
              secureLogger.debug("Users initial load:", snapshot.size, "documents");
            }
          } else {
            console.log('📊 USERS LISTENER: Initial load from Firestore cache (no Firebase reads)');
          }
          
          isInitialLoad = false;
        } else {
          // Incremental updates - only process changed documents
          const changes = snapshot.docChanges();
          
          if (changes.length > 0) {
            // Get current cached users (raw data, not processed)
            const cachedUsers = dataCacheService.getCachedUsers(orgId) || [];
            let updatedUsers = [...cachedUsers];
            
            changes.forEach((change) => {
              const docData = { id: change.doc.id, ...change.doc.data() };
              
              if (change.type === 'added') {
                // Add new user
                updatedUsers.push(docData);
              } else if (change.type === 'modified') {
                // Update existing user
                const index = updatedUsers.findIndex(u => u.id === docData.id);
                if (index !== -1) {
                  updatedUsers[index] = docData;
                }
              } else if (change.type === 'removed') {
                // Remove user
                updatedUsers = updatedUsers.filter(u => u.id !== docData.id);
              }
            });
            
            // Process updated data
            const processedData = processUsersData(updatedUsers);
            
            setUsersCache({
              data: processedData,
              loading: false,
              lastUpdated: new Date(),
              error: null
            });
            
            // Update cache
            dataCacheService.setCachedUsers(orgId, updatedUsers);
            dataCacheService.setLastSyncTime(orgId, 'users');
            
            // Track only changed documents
            readCounter.recordRead('onSnapshot-changes', 'users', 'DataCacheContext', changes.length);
            secureLogger.debug("Users incremental update:", changes.length, "documents changed");
          }
        }
      },
      (error) => {
        secureLogger.error("Users listener error:", error);
        setUsersCache(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      }
    );

    return unsubscribe;
  }, [processUsersData]);

  // Store stable organization ID to prevent listener recreation
  const [stableOrgId, setStableOrgId] = useState(null);
  
  // Update stable org ID only when it actually changes
  useEffect(() => {
    if (organization?.id && organization.id !== stableOrgId) {
      console.log('🔄 ORG ID: Updating stable org ID from', stableOrgId, 'to', organization.id);
      setStableOrgId(organization.id);
    }
  }, [organization?.id, stableOrgId]);

  // Set up users real-time listener with cache-first loading
  useEffect(() => {
    if (!organization?.id) return;

    // Skip if listener is already active
    if (listenersActiveRef.current.users) {
      console.log('🔵 USERS LISTENER: Already active, skipping setup');
      secureLogger.debug('Users listener already active, skipping setup');
      return;
    }
    
    console.log('🟡 USERS LISTENER: Creating new listener for organization:', organization.id);

    let unsubscribe = null;
    let syncTimeout = null;

    // Load from cache first for instant display
    const cachedUsers = dataCacheService.getCachedUsers(organization.id);
    if (cachedUsers) {
      const processedData = processUsersData(cachedUsers);
      setUsersCache({
        data: processedData,
        loading: false,
        lastUpdated: new Date(),
        error: null
      });
      readCounter.recordCacheHit('users', 'DataCacheContext', cachedUsers.length);
      
      // Delay real-time sync slightly to avoid immediate reads
      // Pass the cached users so the listener can detect changes
      syncTimeout = setTimeout(() => {
        if (!listenersActiveRef.current.users) {
          console.log('🟢 USERS LISTENER: Setting up after 5s delay');
          unsubscribe = setupUsersListener(organization.id, cachedUsers);
          listenersActiveRef.current.users = true;
        } else {
          console.log('🔵 USERS LISTENER: Already active during timeout, skipping');
        }
      }, 5000); // 5 second delay to match sessions
    } else {
      // No cache - need immediate sync
      console.log('🔴 USERS LISTENER: No cache, setting up immediately');
      setUsersCache(prev => ({ ...prev, loading: true, error: null }));
      readCounter.recordCacheMiss('users', 'DataCacheContext');
      unsubscribe = setupUsersListener(organization.id);
      listenersActiveRef.current.users = true;
    }

    // Store cleanup function
    setListeners(prev => ({ 
      ...prev, 
      users: () => {
        if (syncTimeout) clearTimeout(syncTimeout);
        if (unsubscribe) unsubscribe();
        listenersActiveRef.current.users = false;
      }
    }));

    // Don't cleanup on navigation, only on organization change or unmount
    return () => {
      // Only cleanup if organization is changing or component is unmounting
      if (syncTimeout) clearTimeout(syncTimeout);
    };
  }, [organization?.id, processUsersData, setupUsersListener]); // Depend on organization.id directly

  // Set up real-time listener for time-off requests
  const setupTimeOffListener = useCallback(() => {
    if (!organization?.id) return;

    // Get recent and upcoming time off requests
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const timeOffQuery = query(
      collection(firestore, "timeOffRequests"),
      where("organizationID", "==", organization.id),
      where("endDate", ">=", Timestamp.fromDate(threeMonthsAgo)),
      orderBy("endDate", "asc"),
      limit(200)
    );

    let isInitialLoad = true;

    const unsubscribe = onSnapshot(
      timeOffQuery,
      { includeMetadataChanges: false },
      (snapshot) => {
        if (isInitialLoad) {
          // Initial load - process all documents
          const rawRequests = [];
          snapshot.forEach((doc) => {
            rawRequests.push({ id: doc.id, ...doc.data() });
          });

          const processedData = processTimeOffData(rawRequests);
          
          setTimeOffCache({
            data: processedData,
            requests: rawRequests,  // Store raw requests for approval modal
            loading: false,
            lastUpdated: new Date(),
            error: null
          });
          
          // Update cache
          dataCacheService.setCachedTimeOffRequests(organization.id, rawRequests);
          dataCacheService.setLastSyncTime(organization.id, 'timeoff');
          
          // Track initial load reads
          if (!snapshot.metadata.fromCache) {
            readCounter.recordRead('onSnapshot-initial', 'timeOffRequests', 'DataCacheContext', snapshot.size);
            secureLogger.debug("Time-off initial load:", snapshot.size, "documents");
          }
          
          isInitialLoad = false;
        } else {
          // Incremental updates - only process changed documents
          const changes = snapshot.docChanges();
          
          if (changes.length > 0) {
            // Get current cached time-off requests
            const cachedRequests = dataCacheService.getCachedTimeOffRequests(organization.id) || [];
            let updatedRequests = [...cachedRequests];
            
            changes.forEach((change) => {
              const docData = { id: change.doc.id, ...change.doc.data() };
              
              if (change.type === 'added') {
                // Add new request
                updatedRequests.push(docData);
              } else if (change.type === 'modified') {
                // Update existing request
                const index = updatedRequests.findIndex(r => r.id === docData.id);
                if (index !== -1) {
                  updatedRequests[index] = docData;
                }
              } else if (change.type === 'removed') {
                // Remove request
                updatedRequests = updatedRequests.filter(r => r.id !== docData.id);
              }
            });
            
            // Process updated data
            const processedData = processTimeOffData(updatedRequests);
            
            setTimeOffCache({
              data: processedData,
              requests: updatedRequests,  // Store raw requests for approval modal
              loading: false,
              lastUpdated: new Date(),
              error: null
            });
            
            // Update cache
            dataCacheService.setCachedTimeOffRequests(organization.id, updatedRequests);
            dataCacheService.setLastSyncTime(organization.id, 'timeoff');
            
            // Track only changed documents
            readCounter.recordRead('onSnapshot-changes', 'timeOffRequests', 'DataCacheContext', changes.length);
            secureLogger.debug("Time-off incremental update:", changes.length, "documents changed");
          }
        }
      },
      (error) => {
        secureLogger.error("Time-off listener error:", error);
        setTimeOffCache(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      }
    );

    return unsubscribe;
  }, [organization?.id, processTimeOffData]);

  // Set up time-off real-time listener with cache-first loading
  useEffect(() => {
    if (!organization?.id) return;

    let unsubscribe = null;

    // Load from cache first for instant display
    const cachedTimeOff = dataCacheService.getCachedTimeOffRequests(organization.id);
    if (cachedTimeOff) {
      const processedData = processTimeOffData(cachedTimeOff);
      setTimeOffCache({
        data: processedData,
        requests: cachedTimeOff,  // Store raw requests for approval modal
        loading: false,
        lastUpdated: new Date(),
        error: null
      });
      readCounter.recordCacheHit('timeOffRequests', 'DataCacheContext', cachedTimeOff.length);
      
      // Start real-time sync immediately for better UX
      // The cache already reduces Firebase reads significantly
      unsubscribe = setupTimeOffListener();
    } else {
      // No cache - need immediate sync
      setTimeOffCache(prev => ({ ...prev, loading: true, error: null }));
      readCounter.recordCacheMiss('timeOffRequests', 'DataCacheContext');
      unsubscribe = setupTimeOffListener();
    }

    // Store cleanup function
    setListeners(prev => ({ 
      ...prev, 
      timeOff: () => {
        if (unsubscribe) unsubscribe();
      }
    }));

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [organization?.id, processTimeOffData, setupTimeOffListener]);

  // Set up real-time listener for daily job reports
  const setupDailyJobReportsListener = useCallback((useOptimized = false, latestTimestamp = null) => {
    if (!organization?.id) return;

    let unsubscribe;

    // Enhanced validation: only use optimized listener if we truly have a valid timestamp
    const canUseOptimized = useOptimized && 
                           latestTimestamp && 
                           latestTimestamp instanceof Date && 
                           !isNaN(latestTimestamp.getTime());

    if (canUseOptimized) {
      console.log('[DataCacheContext] Using optimized listener for new reports only after:', latestTimestamp.toISOString());
      // Use optimized listener that only fetches new reports
      unsubscribe = subscribeToNewDailyJobReports(
        organization.id,
        (newReports, metadata) => {
          if (metadata.isIncremental && newReports.length > 0) {
            // Merge new reports into existing cache
            const success = dailyJobReportsCacheService.mergeNewReportsIntoCache(organization.id, newReports);
            
            if (success) {
              // Get updated cached data and update state
              const updatedCachedData = dailyJobReportsCacheService.getCachedFullDataset(organization.id);
              if (updatedCachedData) {
                const processedData = processDailyJobReportsData(updatedCachedData.reports);
                setDailyJobReportsCache({
                  data: processedData,
                  loading: false,
                  lastUpdated: new Date(),
                  error: null
                });
              }
            }
            
            secureLogger.debug("Daily job reports incremental update:", newReports.length, "new documents");
          }
        },
        (error) => {
          secureLogger.error("Daily job reports optimized listener error:", error);
          setDailyJobReportsCache(prev => ({
            ...prev,
            loading: false,
            error: error.message
          }));
        },
        latestTimestamp
      );
    } else {
      // Use full listener only when cache is missing or expired
      console.warn('[DataCacheContext] Using FULL listener - this will fetch ALL reports!', {
        useOptimized,
        hasTimestamp: !!latestTimestamp,
        timestampValid: latestTimestamp instanceof Date && !isNaN(latestTimestamp?.getTime())
      });
      unsubscribe = subscribeToDailyJobReports(
        organization.id,
        (reports) => {
          const processedData = processDailyJobReportsData(reports);
          
          setDailyJobReportsCache({
            data: processedData,
            loading: false,
            lastUpdated: new Date(),
            error: null
          });
          
          // Update cache using the existing dailyJobReportsCacheService
          dailyJobReportsCacheService.setCachedFullDataset(organization.id, reports);
          
          // Track reads (subscribeToDailyJobReports already tracks reads internally)
          secureLogger.debug("Daily job reports initial load:", reports.length, "documents");
        },
        (error) => {
          secureLogger.error("Daily job reports listener error:", error);
          setDailyJobReportsCache(prev => ({
            ...prev,
            loading: false,
            error: error.message
          }));
        }
        // startDate parameter will default to 3 months ago in the function
      );
    }

    return unsubscribe;
  }, [organization?.id, processDailyJobReportsData]);

  // Set up daily job reports real-time listener with cache-first loading
  useEffect(() => {
    if (!organization?.id) return;

    let unsubscribe = null;
    let syncTimeout = null;

    // Load from cache first for instant display
    const cachedReports = dailyJobReportsCacheService.getCachedFullDataset(organization.id);
    if (cachedReports && cachedReports.reports) {
      const processedData = processDailyJobReportsData(cachedReports.reports);
      setDailyJobReportsCache({
        data: processedData,
        loading: false,
        lastUpdated: new Date(),
        error: null
      });
      readCounter.recordCacheHit('dailyJobReports', 'DataCacheContext', cachedReports.reports.length);
      
      // Get latest timestamp from cache for optimized listener
      let latestTimestamp = null;
      if (cachedReports.reports.length > 0) {
        // Find the most recent report timestamp
        const sortedReports = [...cachedReports.reports].sort((a, b) => {
          // Handle various timestamp formats
          let timeA = 0;
          let timeB = 0;
          
          if (a.timestamp) {
            if (a.timestamp.seconds) timeA = a.timestamp.seconds;
            else if (a.timestamp instanceof Date) timeA = a.timestamp.getTime() / 1000;
            else if (typeof a.timestamp.toDate === 'function') timeA = a.timestamp.toDate().getTime() / 1000;
          }
          
          if (b.timestamp) {
            if (b.timestamp.seconds) timeB = b.timestamp.seconds;
            else if (b.timestamp instanceof Date) timeB = b.timestamp.getTime() / 1000;
            else if (typeof b.timestamp.toDate === 'function') timeB = b.timestamp.toDate().getTime() / 1000;
          }
          
          return timeB - timeA;
        });
        
        if (sortedReports[0] && sortedReports[0].timestamp) {
          // Try to extract a valid date from the timestamp
          let tempDate = null;
          try {
            const ts = sortedReports[0].timestamp;
            
            // Handle different timestamp formats
            if (ts instanceof Date) {
              tempDate = ts;
            } else if (typeof ts.toDate === 'function') {
              tempDate = ts.toDate();
            } else if (ts.seconds) {
              tempDate = new Date(ts.seconds * 1000);
            } else if (typeof ts === 'object' && ts._seconds) {
              // Handle Firestore Timestamp serialized format
              tempDate = new Date(ts._seconds * 1000);
            }
            
            // Validate the date
            if (tempDate instanceof Date && !isNaN(tempDate.getTime())) {
              latestTimestamp = tempDate;
              console.log('[DataCacheContext] Successfully extracted latest timestamp:', tempDate.toISOString());
            } else {
              console.warn('[DataCacheContext] Could not extract valid timestamp from cached reports');
            }
          } catch (err) {
            console.error('[DataCacheContext] Error parsing timestamp:', err);
          }
        } else {
          console.log('[DataCacheContext] No reports with timestamps found in cache');
        }
      }
      
      // Delay real-time sync to avoid immediate reads when user is just passing through
      syncTimeout = setTimeout(() => {
        // Only use optimized listener if we have a valid timestamp
        // If no valid timestamp, skip the listener entirely since we have valid cache
        if (latestTimestamp) {
          console.log('[DataCacheContext] Setting up optimized listener with timestamp:', latestTimestamp.toISOString());
          unsubscribe = setupDailyJobReportsListener(true, latestTimestamp);
        } else {
          console.log('[DataCacheContext] Valid cache exists but no timestamp found - skipping real-time sync to avoid unnecessary reads');
          // Cache is valid for 30 days, no need to set up a listener if we can't optimize it
        }
      }, 5000); // 5 second delay like sessions
    } else {
      // No cache - need immediate sync with date-limited query
      setDailyJobReportsCache(prev => ({ ...prev, loading: true, error: null }));
      readCounter.recordCacheMiss('dailyJobReports', 'DataCacheContext');
      unsubscribe = setupDailyJobReportsListener(false, null);
    }

    // Store cleanup function
    setListeners(prev => ({ 
      ...prev, 
      dailyJobReports: () => {
        if (syncTimeout) clearTimeout(syncTimeout);
        if (unsubscribe) unsubscribe();
      }
    }));

    return () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      if (unsubscribe) unsubscribe();
    };
  }, [organization?.id, processDailyJobReportsData, setupDailyJobReportsListener]);

  // Cleanup all listeners on unmount ONLY
  useEffect(() => {
    return () => {
      console.log('🔴 DATACACHE UNMOUNTING: Cleaning up all listeners');
      // Reset the active flags
      listenersActiveRef.current = {
        sessions: false,
        users: false,
        timeOff: false,
        dailyJobReports: false
      };
      // Call cleanup functions
      Object.values(listeners).forEach(unsubscribe => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
    // Empty dependency array - only run on unmount
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cache manipulation functions
  const invalidateCache = useCallback((cacheType) => {
    switch (cacheType) {
      case 'sessions':
        setSessionsCache(prev => ({ ...prev, lastUpdated: null }));
        break;
      case 'users':
        setUsersCache(prev => ({ ...prev, lastUpdated: null }));
        break;
      case 'timeOff':
        setTimeOffCache(prev => ({ ...prev, lastUpdated: null }));
        break;
      case 'dailyJobReports':
        setDailyJobReportsCache(prev => ({ ...prev, lastUpdated: null }));
        break;
      case 'all':
        setSessionsCache(prev => ({ ...prev, lastUpdated: null }));
        setUsersCache(prev => ({ ...prev, lastUpdated: null }));
        setTimeOffCache(prev => ({ ...prev, lastUpdated: null }));
        setDailyJobReportsCache(prev => ({ ...prev, lastUpdated: null }));
        break;
      default:
        break;
    }
  }, []);

  const isLoading = sessionsCache.loading || usersCache.loading || timeOffCache.loading || dailyJobReportsCache.loading;
  const hasErrors = sessionsCache.error || usersCache.error || timeOffCache.error || dailyJobReportsCache.error;

  // Optimistic update for sessions
  const updateSessionOptimistically = useCallback((sessionId, updateData) => {
    // Get current cached sessions
    const cachedSessions = dataCacheService.getCachedSessions(organization?.id) || [];
    
    // Update the session in the cached data
    const updatedSessions = cachedSessions.map(session => {
      if (session.id === sessionId) {
        return {
          ...session,
          ...updateData,
          // Preserve id and other critical fields
          id: session.id,
          organizationID: session.organizationID,
          // Update timestamp
          updatedAt: new Date()
        };
      }
      return session;
    });
    
    // Update cache storage
    dataCacheService.setCachedSessions(organization.id, updatedSessions);
    
    // Process and update UI immediately
    const processedData = processSessionsData(updatedSessions, userProfile.role);
    setSessionsCache({
      data: processedData,
      loading: false,
      lastUpdated: new Date(),
      error: null
    });
    
    // Return the updated session for the caller
    return updatedSessions.find(s => s.id === sessionId);
  }, [organization?.id, userProfile?.role, processSessionsData]);

  // Optimistic update for users
  const updateUserOptimistically = useCallback((userId, updateData) => {
    console.log('updateUserOptimistically called:', {
      userId,
      updateData,
      organizationId: organization?.id,
      hasOrganization: !!organization
    });
    
    // Use ref to get current state
    const currentUsers = usersCacheRef.current.data || [];
    console.log('Current users count from React state:', currentUsers.length);
    
    // Update the user in the cached data
    const updatedUsers = currentUsers.map(user => {
      if (user.id === userId) {
        console.log('Found user to update:', {
          oldDisplayName: user.displayName,
          newDisplayName: updateData.displayName,
          oldFirstName: user.firstName,
          newFirstName: updateData.firstName
        });
        return {
          ...user,
          ...updateData,
          // Preserve id and other critical fields
          id: user.id,
          organizationID: user.organizationID,
          // Update timestamp
          updatedAt: new Date()
        };
      }
      return user;
    });
    
    // Update cache storage - clear old cache first to ensure fresh data
    if (organization?.id) {
      dataCacheService.setCachedUsers(organization.id, updatedUsers);
      console.log('localStorage cache updated for organization:', organization.id);
    } else {
      console.warn('No organization ID - cannot update localStorage cache');
    }
    
    // Process and update UI immediately
    const processedData = processUsersData(updatedUsers);
    console.log('Processed users data:', {
      count: processedData.length,
      updatedUser: processedData.find(u => u.id === userId)
    });
    
    // Force new array reference to ensure React detects the change
    setUsersCache(prevCache => {
      console.log('Previous cache had', prevCache.data?.length, 'users');
      return {
        data: [...processedData],  // Create new array reference
        loading: false,
        lastUpdated: new Date(),
        error: null,
        version: Date.now() // Add version to force re-render
      };
    });
    
    console.log('Users cache updated', {
      newDataReference: processedData,
      firstUser: processedData[0]
    });
    
    // Also reprocess sessions to update photographer names
    // Use current sessions from React state
    if (sessionsCache.data && sessionsCache.data.length > 0) {
      // Get the raw sessions data (before calendar processing)
      const cachedSessions = dataCacheService.getCachedSessions(organization?.id);
      if (cachedSessions) {
        const reprocessedSessions = processSessionsData(cachedSessions, userProfile?.role);
        setSessionsCache(prev => ({
          ...prev,
          data: reprocessedSessions
        }));
      }
    }
    
    secureLogger.debug("User cache updated optimistically", { userId, displayName: updateData.displayName });
    
    // Return the updated user for the caller
    return updatedUsers.find(u => u.id === userId);
  }, [organization?.id, processUsersData, processSessionsData, userProfile?.role, sessionsCache.data]);

  const value = {
    // Data
    sessions: sessionsCache.data,
    users: usersCache.data,
    teamMembers: usersCache.data, // Alias for backwards compatibility
    timeOffRequests: timeOffCache.data || [],  // Calendar entries for display
    timeOff: timeOffCache.data || [],           // Alias for calendar entries
    timeOffRawRequests: timeOffCache.requests || [],  // Raw requests for approval modal
    dailyJobReports: dailyJobReportsCache.data || [],
    
    // Status
    loading: {
      sessions: sessionsCache.loading,
      users: usersCache.loading,
      timeOff: timeOffCache.loading,
      dailyJobReports: dailyJobReportsCache.loading,
      any: isLoading
    },
    
    // Errors
    errors: {
      sessions: sessionsCache.error,
      users: usersCache.error,
      timeOff: timeOffCache.error,
      dailyJobReports: dailyJobReportsCache.error,
      any: hasErrors
    },
    
    // Metadata
    lastUpdated: {
      sessions: sessionsCache.lastUpdated,
      users: usersCache.lastUpdated,
      timeOff: timeOffCache.lastUpdated,
      dailyJobReports: dailyJobReportsCache.lastUpdated
    },
    
    // Cache management
    invalidateCache,
    
    // Optimistic updates
    updateSessionOptimistically,
    updateUserOptimistically,
    
    // Refresh functions - invalidate cache to trigger listener updates
    refreshSessions: () => {
      secureLogger.debug("Manual refresh: Sessions");
      dataCacheService.clearSessionsCache(organization?.id);
      invalidateCache('sessions');
      // Real-time listener will automatically fetch new data
    },
    refreshUsers: () => {
      secureLogger.debug("Manual refresh: Users");
      dataCacheService.clearUsersCache(organization?.id);
      invalidateCache('users');
      // Real-time listener will automatically fetch new data
    },
    refreshTimeOff: () => {
      secureLogger.debug("Manual refresh: Time-off");
      dataCacheService.clearTimeOffCache(organization?.id);
      invalidateCache('timeOff');
      // Real-time listener will automatically fetch new data
    },
    refreshDailyJobReports: () => {
      secureLogger.debug("Manual refresh: Daily job reports");
      dailyJobReportsCacheService.clearAllReportsCache(organization?.id);
      invalidateCache('dailyJobReports');
      // Real-time listener will automatically fetch new data
    },
    refreshAll: () => {
      secureLogger.debug("Manual refresh: All data");
      dataCacheService.clearCache(organization?.id);
      dailyJobReportsCacheService.clearAllReportsCache(organization?.id);
      invalidateCache('all');
      // Real-time listeners will automatically fetch new data
    },
    
    // Computed data
    pendingTimeOffCount: (() => {
      // Get unique request IDs since we have multiple entries per request
      const uniqueRequestIds = new Set();
      timeOffCache.data.forEach(entry => {
        if (entry.status === 'pending' || entry.status === 'under_review') {
          uniqueRequestIds.add(entry.sessionId); // sessionId is the original request ID
        }
      });
      return uniqueRequestIds.size;
    })(),
  };

  return (
    <DataCacheContext.Provider value={value}>
      {children}
    </DataCacheContext.Provider>
  );
};