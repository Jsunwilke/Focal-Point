// src/contexts/YearbookContext.js
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import * as yearbookService from '../services/yearbookService';
import yearbookCacheService from '../services/yearbookCacheService';
import { readCounter } from '../services/readCounter';
import secureLogger from '../utils/secureLogger';

const YearbookContext = createContext();

export const useYearbook = () => {
  const context = useContext(YearbookContext);
  if (!context) {
    throw new Error('useYearbook must be used within a YearbookProvider');
  }
  return context;
};

export const YearbookProvider = ({ children }) => {
  const { userProfile, organization } = useAuth();
  const [shootLists, setShootLists] = useState({});
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState({});
  const [listeners, setListeners] = useState({});

  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      Object.values(listeners).forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, []);

  // Get or load shoot list for a school and year
  const getShootList = useCallback(async (schoolId, schoolYear, forceRefresh = false) => {
    const cacheKey = `${schoolId}_${schoolYear}`;
    
    // Return existing if loaded and not forcing refresh
    if (!forceRefresh && shootLists[cacheKey]) {
      return shootLists[cacheKey];
    }

    // Set loading state
    setLoading(prev => ({ ...prev, [cacheKey]: true }));

    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = yearbookCacheService.getCachedShootList(schoolId, schoolYear);
        if (cached) {
          setShootLists(prev => ({ ...prev, [cacheKey]: cached }));
          readCounter.recordCacheHit('yearbookShootLists', 'YearbookContext', 1);
          
          // Set up incremental listener for updates
          setupIncrementalListener(schoolId, schoolYear, cached.updatedAt);
          
          setLoading(prev => ({ ...prev, [cacheKey]: false }));
          return cached;
        }
      }

      // Cache miss - load from Firestore
      readCounter.recordCacheMiss('yearbookShootLists', 'YearbookContext');
      
      const result = await yearbookService.getYearbookShootList(schoolId, schoolYear, organization?.id);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load shoot list');
      }

      if (result.data) {
        // Cache the data
        yearbookCacheService.setCachedShootList(schoolId, schoolYear, result.data);
        setShootLists(prev => ({ ...prev, [cacheKey]: result.data }));
        
        // Set up listener for future updates
        setupIncrementalListener(schoolId, schoolYear, null);
        
        return result.data;
      }

      return null;
    } catch (error) {
      secureLogger.error('Error loading shoot list:', error);
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, [cacheKey]: false }));
    }
  }, [shootLists, organization]);

  // Set up incremental listener for a shoot list
  const setupIncrementalListener = useCallback((schoolId, schoolYear, latestTimestamp) => {
    const listenerKey = `${schoolId}_${schoolYear}`;
    
    // Clean up existing listener
    if (listeners[listenerKey]) {
      listeners[listenerKey]();
    }

    // Set up new listener
    const unsubscribe = yearbookService.subscribeToShootListUpdates(
      schoolId,
      schoolYear,
      latestTimestamp,
      (updatedList, isIncremental) => {
        if (updatedList) {
          const cacheKey = `${schoolId}_${schoolYear}`;
          
          if (isIncremental) {
            // Merge with existing data
            setShootLists(prev => {
              const existing = prev[cacheKey];
              if (existing) {
                return {
                  ...prev,
                  [cacheKey]: { ...existing, ...updatedList }
                };
              }
              return { ...prev, [cacheKey]: updatedList };
            });
          } else {
            // Replace entirely
            setShootLists(prev => ({ ...prev, [cacheKey]: updatedList }));
          }
          
          // Update cache
          yearbookCacheService.setCachedShootList(schoolId, schoolYear, updatedList);
        }
      },
      organization?.id
    );

    setListeners(prev => ({ ...prev, [listenerKey]: unsubscribe }));
  }, [listeners, organization]);

  // Create a new shoot list
  const createShootList = useCallback(async (schoolId, schoolName, schoolYear, items = [], templateId = null) => {
    if (!organization?.id) {
      throw new Error('Organization not found');
    }

    const result = await yearbookService.createYearbookShootList(
      organization.id,
      schoolId,
      schoolName,
      schoolYear,
      items,
      templateId
    );

    if (result.success && result.data) {
      const cacheKey = `${schoolId}_${schoolYear}`;
      setShootLists(prev => ({ ...prev, [cacheKey]: result.data }));
      yearbookCacheService.setCachedShootList(schoolId, schoolYear, result.data);
      
      // Clear years cache to force refresh
      yearbookCacheService.clearCache(schoolId + '_years');
    }

    return result;
  }, [organization]);

  // Update a shoot list item
  const updateShootItem = useCallback(async (schoolId, schoolYear, itemId, updates) => {
    const cacheKey = `${schoolId}_${schoolYear}`;
    const shootList = shootLists[cacheKey];
    
    if (!shootList) {
      throw new Error('Shoot list not found');
    }

    // Optimistic update
    const optimisticList = {
      ...shootList,
      items: shootList.items.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ),
      updatedAt: new Date()
    };

    // Update completed count if needed
    const oldItem = shootList.items.find(i => i.id === itemId);
    if (oldItem && updates.completed !== undefined) {
      const wasCompleted = oldItem.completed;
      const isNowCompleted = updates.completed;
      
      if (!wasCompleted && isNowCompleted) {
        optimisticList.completedCount = (optimisticList.completedCount || 0) + 1;
      } else if (wasCompleted && !isNowCompleted) {
        optimisticList.completedCount = Math.max(0, (optimisticList.completedCount || 0) - 1);
      }
    }

    setShootLists(prev => ({ ...prev, [cacheKey]: optimisticList }));
    yearbookCacheService.updateCachedItems(schoolId, schoolYear, [{ itemId, updates }]);

    try {
      const result = await yearbookService.updateShootListItem(shootList.id, itemId, updates);
      
      if (!result.success) {
        // Rollback on error
        setShootLists(prev => ({ ...prev, [cacheKey]: shootList }));
        throw new Error(result.error || 'Failed to update item');
      }
    } catch (error) {
      // Rollback and reload from cache/server
      await getShootList(schoolId, schoolYear, true);
      throw error;
    }
  }, [shootLists, getShootList]);

  // Batch update multiple items
  const batchUpdateItems = useCallback(async (schoolId, schoolYear, itemUpdates) => {
    const cacheKey = `${schoolId}_${schoolYear}`;
    const shootList = shootLists[cacheKey];
    
    if (!shootList) {
      throw new Error('Shoot list not found');
    }

    // Optimistic update
    let completedCountDelta = 0;
    const optimisticList = {
      ...shootList,
      items: shootList.items.map(item => {
        const update = itemUpdates.find(u => u.itemId === item.id);
        if (update) {
          const wasCompleted = item.completed;
          const isNowCompleted = update.updates.completed !== undefined ? update.updates.completed : item.completed;
          
          if (!wasCompleted && isNowCompleted) {
            completedCountDelta++;
          } else if (wasCompleted && !isNowCompleted) {
            completedCountDelta--;
          }
          
          return { ...item, ...update.updates };
        }
        return item;
      }),
      completedCount: Math.max(0, (shootList.completedCount || 0) + completedCountDelta),
      updatedAt: new Date()
    };

    setShootLists(prev => ({ ...prev, [cacheKey]: optimisticList }));
    yearbookCacheService.updateCachedItems(schoolId, schoolYear, itemUpdates);

    try {
      const result = await yearbookService.batchUpdateShootListItems(shootList.id, itemUpdates);
      
      if (!result.success) {
        // Rollback on error
        setShootLists(prev => ({ ...prev, [cacheKey]: shootList }));
        throw new Error(result.error || 'Failed to update items');
      }
    } catch (error) {
      // Rollback and reload from cache/server
      await getShootList(schoolId, schoolYear, true);
      throw error;
    }
  }, [shootLists, getShootList]);

  // Get available years for a school
  const getAvailableYears = useCallback(async (schoolId) => {
    // Check cache first
    const cached = yearbookCacheService.getCachedYears(schoolId);
    if (cached) {
      readCounter.recordCacheHit('yearbookShootLists', 'YearbookContext-Years', 1);
      return cached;
    }

    readCounter.recordCacheMiss('yearbookShootLists', 'YearbookContext-Years');
    
    const result = await yearbookService.getAvailableYears(schoolId, organization?.id);
    
    if (result.success && result.data) {
      yearbookCacheService.setCachedYears(schoolId, result.data);
      return result.data;
    }

    return [];
  }, [organization]);

  // Copy shoot list to new year
  const copyToNewYear = useCallback(async (sourceListId, targetSchoolId, targetSchoolName, targetYear) => {
    const result = await yearbookService.copyShootListToNewYear(
      sourceListId,
      targetSchoolId,
      targetSchoolName,
      targetYear
    );

    if (result.success && result.data) {
      const cacheKey = `${targetSchoolId}_${targetYear}`;
      setShootLists(prev => ({ ...prev, [cacheKey]: result.data }));
      yearbookCacheService.setCachedShootList(targetSchoolId, targetYear, result.data);
      
      // Clear years cache to force refresh
      yearbookCacheService.clearCache(targetSchoolId + '_years');
    }

    return result;
  }, []);

  // Get current school year
  const getCurrentSchoolYear = useCallback(() => {
    return yearbookService.getCurrentSchoolYear();
  }, []);

  // Check if user can edit shoot lists
  const canEdit = useMemo(() => {
    if (!userProfile) return false;
    return userProfile.role === 'admin' || 
           userProfile.role === 'photographer' ||
           userProfile.permissions?.includes('yearbook.edit');
  }, [userProfile]);

  // Add a new item to the shoot list
  const addShootItem = useCallback(async (schoolId, schoolYear, category, itemData) => {
    const cacheKey = `${schoolId}_${schoolYear}`;
    const shootList = shootLists[cacheKey];
    
    if (!shootList) {
      throw new Error('Shoot list not found');
    }

    try {
      const result = await yearbookService.addShootListItem(shootList.id, category, itemData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to add item');
      }

      // Update local state optimistically
      const updatedList = {
        ...shootList,
        items: [...shootList.items, result.data],
        totalCount: shootList.items.length + 1,
        updatedAt: new Date()
      };

      setShootLists(prev => ({ ...prev, [cacheKey]: updatedList }));
      yearbookCacheService.setCachedShootList(schoolId, schoolYear, updatedList);

      return result;
    } catch (error) {
      secureLogger.error('Error adding shoot item:', error);
      // Reload from server on error
      await getShootList(schoolId, schoolYear, true);
      throw error;
    }
  }, [shootLists, getShootList]);

  // Delete a shoot list
  const deleteShootList = useCallback(async (schoolId, schoolYear, listId) => {
    try {
      const result = await yearbookService.deleteYearbookShootList(listId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete shoot list');
      }

      // Remove from local state
      const cacheKey = `${schoolId}_${schoolYear}`;
      setShootLists(prev => {
        const updated = { ...prev };
        delete updated[cacheKey];
        return updated;
      });

      // Clear cache
      yearbookCacheService.clearCache(schoolId, schoolYear);
      yearbookCacheService.clearCache(schoolId + '_years');

      // Clean up listener
      const listenerKey = `${schoolId}_${schoolYear}`;
      if (listeners[listenerKey]) {
        listeners[listenerKey]();
        setListeners(prev => {
          const updated = { ...prev };
          delete updated[listenerKey];
          return updated;
        });
      }

      return { success: true };
    } catch (error) {
      secureLogger.error('Error deleting shoot list:', error);
      return { success: false, error: error.message };
    }
  }, [listeners]);

  // Clear cache for a specific school/year
  const clearCache = useCallback((schoolId, schoolYear) => {
    const cacheKey = `${schoolId}_${schoolYear}`;
    yearbookCacheService.clearCache(schoolId, schoolYear);
    setShootLists(prev => {
      const updated = { ...prev };
      delete updated[cacheKey];
      return updated;
    });
  }, []);

  const value = {
    shootLists,
    templates,
    loading,
    canEdit,
    getShootList,
    createShootList,
    updateShootItem,
    addShootItem,
    batchUpdateItems,
    getAvailableYears,
    copyToNewYear,
    getCurrentSchoolYear,
    deleteShootList,
    clearCache
  };

  return <YearbookContext.Provider value={value}>{children}</YearbookContext.Provider>;
};