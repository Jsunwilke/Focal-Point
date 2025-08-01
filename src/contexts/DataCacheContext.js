import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
    data: [],
    loading: true,
    lastUpdated: null,
    error: null
  });

  // Listener cleanup functions
  const [listeners, setListeners] = useState({
    sessions: null,
    users: null,
    timeOff: null
  });

  // Process sessions data for calendar format
  const processSessionsData = useCallback((snapshotOrArray, userRole) => {
    const sessionsData = [];
    
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
          return session.photographers.map((photographer) => ({
            id: `${session.id}-${photographer.id}`,
            sessionId: session.id,
            title: session.title || `${session.sessionType || 'Session'} at ${session.schoolName || 'School'}`,
            date: sessionDate,
            startTime: session.startTime,
            endTime: session.endTime,
            photographerId: photographer.id,
            photographerName: photographer.name,
            sessionType: session.sessionType || "session",
            sessionTypes: session.sessionTypes || [session.sessionType || "session"],
            customSessionType: session.customSessionType,
            status: session.status || "scheduled",
            isPublished: session.isPublished !== false,
            schoolId: session.schoolId,
            schoolName: session.schoolName || session.location || "",
            location: session.location || session.schoolName || "",
            notes: session.notes,
          }));
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
      // Only include approved, pending, and under_review requests
      if (!['pending', 'under_review', 'approved'].includes(request.status)) return;
      
      const startDate = request.startDate?.toDate ? request.startDate.toDate() : new Date(request.startDate);
      const endDate = request.endDate?.toDate ? request.endDate.toDate() : new Date(request.endDate);
      
      // Create entries for each day of time off
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = formatLocalDate(currentDate);
        
        // Use actual times for partial day, default times for full day
        const displayStartTime = request.isPartialDay && request.startTime ? request.startTime : '09:00';
        const displayEndTime = request.isPartialDay && request.endTime ? request.endTime : '17:00';
        
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
          status: request.status,
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

    const unsubscribe = onSnapshot(
      sessionsQuery,
      { includeMetadataChanges: false }, // Only real changes, not metadata
      (snapshot) => {
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
        
        // Track reads (only counts when actual data is transferred)
        if (!snapshot.metadata.fromCache) {
          readCounter.recordRead('onSnapshot', 'sessions', 'DataCacheContext', snapshot.size);
          secureLogger.debug("Sessions real-time update:", snapshot.size, "documents");
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
  const setupUsersListener = useCallback(() => {
    if (!organization?.id) return;

    const usersQuery = query(
      collection(firestore, "users"),
      where("organizationID", "==", organization.id)
      // Removed orderBy - sorting is done client-side in processUsersData
    );

    const unsubscribe = onSnapshot(
      usersQuery,
      { includeMetadataChanges: false },
      (snapshot) => {
        const rawUsers = [];
        snapshot.forEach((doc) => {
          rawUsers.push({ id: doc.id, ...doc.data() });
        });

        const processedData = processUsersData(rawUsers);
        
        setUsersCache({
          data: processedData,
          loading: false,
          lastUpdated: new Date(),
          error: null
        });
        
        // Update cache
        dataCacheService.setCachedUsers(organization.id, rawUsers);
        dataCacheService.setLastSyncTime(organization.id, 'users');
        
        // Track reads
        if (!snapshot.metadata.fromCache) {
          readCounter.recordRead('onSnapshot', 'users', 'DataCacheContext', snapshot.size);
          secureLogger.debug("Users real-time update:", snapshot.size, "documents");
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
  }, [organization?.id, processUsersData]);

  // Set up users real-time listener with cache-first loading
  useEffect(() => {
    if (!organization?.id) return;

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
      
      // Delay real-time sync - users don't change as frequently
      syncTimeout = setTimeout(() => {
        unsubscribe = setupUsersListener();
      }, 10000); // 10 second delay for users
    } else {
      // No cache - need immediate sync
      setUsersCache(prev => ({ ...prev, loading: true, error: null }));
      readCounter.recordCacheMiss('users', 'DataCacheContext');
      unsubscribe = setupUsersListener();
    }

    // Store cleanup function
    setListeners(prev => ({ 
      ...prev, 
      users: () => {
        if (syncTimeout) clearTimeout(syncTimeout);
        if (unsubscribe) unsubscribe();
      }
    }));

    return () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      if (unsubscribe) unsubscribe();
    };
  }, [organization?.id, processUsersData, setupUsersListener]);

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

    const unsubscribe = onSnapshot(
      timeOffQuery,
      { includeMetadataChanges: false },
      (snapshot) => {
        const rawRequests = [];
        snapshot.forEach((doc) => {
          rawRequests.push({ id: doc.id, ...doc.data() });
        });

        const processedData = processTimeOffData(rawRequests);
        
        setTimeOffCache({
          data: processedData,
          loading: false,
          lastUpdated: new Date(),
          error: null
        });
        
        // Update cache
        dataCacheService.setCachedTimeOffRequests(organization.id, rawRequests);
        dataCacheService.setLastSyncTime(organization.id, 'timeoff');
        
        // Track reads
        if (!snapshot.metadata.fromCache) {
          readCounter.recordRead('onSnapshot', 'timeOffRequests', 'DataCacheContext', snapshot.size);
          secureLogger.debug("Time-off real-time update:", snapshot.size, "documents");
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

  // Cleanup all listeners on unmount
  useEffect(() => {
    return () => {
      Object.values(listeners).forEach(unsubscribe => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  }, [listeners]);

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
      case 'all':
        setSessionsCache(prev => ({ ...prev, lastUpdated: null }));
        setUsersCache(prev => ({ ...prev, lastUpdated: null }));
        setTimeOffCache(prev => ({ ...prev, lastUpdated: null }));
        break;
      default:
        break;
    }
  }, []);

  const isLoading = sessionsCache.loading || usersCache.loading || timeOffCache.loading;
  const hasErrors = sessionsCache.error || usersCache.error || timeOffCache.error;

  const value = {
    // Data
    sessions: sessionsCache.data,
    users: usersCache.data,
    teamMembers: usersCache.data, // Alias for backwards compatibility
    timeOffRequests: timeOffCache.data || [],
    
    // Status
    loading: {
      sessions: sessionsCache.loading,
      users: usersCache.loading,
      timeOff: timeOffCache.loading,
      any: isLoading
    },
    
    // Errors
    errors: {
      sessions: sessionsCache.error,
      users: usersCache.error,
      timeOff: timeOffCache.error,
      any: hasErrors
    },
    
    // Metadata
    lastUpdated: {
      sessions: sessionsCache.lastUpdated,
      users: usersCache.lastUpdated,
      timeOff: timeOffCache.lastUpdated
    },
    
    // Cache management
    invalidateCache,
    
    // Refresh functions - invalidate cache to trigger listener updates
    refreshSessions: () => {
      secureLogger.debug("Manual refresh: Sessions");
      dataCacheService.clearCache(organization?.id);
      invalidateCache('sessions');
      // Real-time listener will automatically fetch new data
    },
    refreshUsers: () => {
      secureLogger.debug("Manual refresh: Users");
      dataCacheService.clearCache(organization?.id);
      invalidateCache('users');
      // Real-time listener will automatically fetch new data
    },
    refreshTimeOff: () => {
      secureLogger.debug("Manual refresh: Time-off");
      dataCacheService.clearCache(organization?.id);
      invalidateCache('timeOff');
      // Real-time listener will automatically fetch new data
    },
    refreshAll: () => {
      secureLogger.debug("Manual refresh: All data");
      dataCacheService.clearCache(organization?.id);
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