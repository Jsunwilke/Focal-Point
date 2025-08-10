// src/contexts/PhotoCritiqueContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { photoCritiqueCacheService } from '../services/photoCritiqueCacheService';
import {
  createPhotoCritique,
  getCritiques,
  getCritiqueById,
  updateCritique,
  deleteCritique,
  addCritiqueFeedback,
  getCritiqueFeedback,
  updateFeedback,
  deleteFeedback,
  subscribeToCritiques,
  subscribeToCritiqueFeedback,
  getPhotographers
} from '../services/photoCritiqueService';
import { readCounter } from '../services/readCounter';

const PhotoCritiqueContext = createContext({});

export const usePhotoCritique = () => {
  const context = useContext(PhotoCritiqueContext);
  if (!context) {
    throw new Error('usePhotoCritique must be used within PhotoCritiqueProvider');
  }
  return context;
};

export const PhotoCritiqueProvider = ({ children }) => {
  const { user, userProfile, organization } = useAuth();
  
  // State
  const [critiques, setCritiques] = useState([]);
  const [selectedCritique, setSelectedCritique] = useState(null);
  const [critiqueFeedback, setCritiqueFeedback] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: null,
    submitterId: null,
    hasReviews: null
  });
  const [pagination, setPagination] = useState({
    lastDoc: null,
    hasMore: false,
    pageSize: 20
  });
  
  // Unsubscribe functions for real-time listeners
  const [unsubscribeCritiques, setUnsubscribeCritiques] = useState(null);
  const [unsubscribeFeedback, setUnsubscribeFeedback] = useState(null);

  // Load critiques with cache-first approach
  const loadCritiques = useCallback(async (resetPagination = false) => {
    if (!organization?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load from cache first for instant display
      const cachedCritiques = photoCritiqueCacheService.getCachedCritiques(organization.id);
      if (cachedCritiques && cachedCritiques.length > 0) {
        setCritiques(cachedCritiques);
        setLoading(false);
      }
      
      // Fetch fresh data
      const lastDoc = resetPagination ? null : pagination.lastDoc;
      const result = await getCritiques(
        organization.id,
        filters,
        lastDoc,
        pagination.pageSize
      );
      
      if (resetPagination) {
        // Preserve optimistic updates when resetting
        setCritiques(prevCritiques => {
          // Find optimistic updates that are still pending
          const optimisticUpdates = prevCritiques.filter(c => {
            if (!c._isOptimistic) return false;
            // Keep optimistic updates for 30 seconds
            const thirtySecondsAgo = Date.now() - 30000;
            return c._optimisticTimestamp > thirtySecondsAgo;
          });
          
          // Merge optimistic updates with server data
          if (optimisticUpdates.length > 0) {
            return [...optimisticUpdates, ...result.critiques];
          }
          return result.critiques;
        });
        photoCritiqueCacheService.setCachedCritiques(organization.id, result.critiques);
      } else {
        // Append to existing critiques
        const updatedCritiques = [...critiques, ...result.critiques];
        setCritiques(updatedCritiques);
        photoCritiqueCacheService.setCachedCritiques(organization.id, updatedCritiques);
      }
      
      setPagination({
        ...pagination,
        lastDoc: result.lastDoc,
        hasMore: result.hasMore
      });
    } catch (err) {
      console.error('Error loading critiques:', err);
      setError('Failed to load critiques');
      readCounter.recordCacheMiss('photoCritiques', 'PhotoCritiqueContext');
    } finally {
      setLoading(false);
    }
  }, [organization?.id, filters, pagination.lastDoc, pagination.pageSize]);

  // Load feedback for a critique
  const loadCritiqueFeedback = useCallback(async (critiqueId) => {
    setFeedbackLoading(true);
    
    try {
      // Load from cache first
      const cachedFeedback = photoCritiqueCacheService.getCachedFeedback(critiqueId);
      if (cachedFeedback) {
        setCritiqueFeedback(cachedFeedback);
        setFeedbackLoading(false);
      }
      
      // Fetch fresh data
      const feedback = await getCritiqueFeedback(critiqueId);
      setCritiqueFeedback(feedback);
      photoCritiqueCacheService.setCachedFeedback(critiqueId, feedback);
    } catch (err) {
      console.error('Error loading feedback:', err);
      setError('Failed to load feedback');
      readCounter.recordCacheMiss('critiqueFeedback', 'PhotoCritiqueContext');
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  // Submit a new critique
  const submitCritique = useCallback(async (critiqueData, imageFiles) => {
    if (!organization?.id) {
      throw new Error('Organization not loaded. Please refresh and try again.');
    }
    
    if (!user?.uid || !userProfile?.id) {
      throw new Error('User not authenticated. Please refresh and try again.');
    }
    
    const data = {
      ...critiqueData,
      organizationId: organization.id,
      submitterId: user.uid, // Use auth uid to match Firestore rules
      submitterName: `${userProfile.firstName} ${userProfile.lastName}`,
      submitterEmail: userProfile.email
    };
    
    const newCritique = await createPhotoCritique(data, imageFiles);
    
    // Mark as optimistic to prevent real-time listener from removing it
    const optimisticCritique = {
      ...newCritique,
      _isOptimistic: true,
      _optimisticTimestamp: Date.now()
    };
    
    // Add to the beginning of the list
    const updatedCritiques = [optimisticCritique, ...critiques];
    setCritiques(updatedCritiques);
    photoCritiqueCacheService.setCachedCritiques(organization.id, updatedCritiques);
    
    return optimisticCritique;
  }, [organization?.id, user?.uid, userProfile, critiques]);

  // Submit feedback for a critique
  const submitFeedback = useCallback(async (critiqueId, feedbackData) => {
    if (!userProfile?.uid) {
      throw new Error('User must be authenticated to submit feedback');
    }
    
    const data = {
      ...feedbackData,
      critiqueId,
      reviewerId: userProfile.uid,
      reviewerName: `${userProfile.firstName} ${userProfile.lastName}`,
      reviewerEmail: userProfile.email
    };
    
    const newFeedback = await addCritiqueFeedback(data);
    
    // Update local state and cache
    const updatedFeedback = [newFeedback, ...critiqueFeedback];
    setCritiqueFeedback(updatedFeedback);
    photoCritiqueCacheService.setCachedFeedback(critiqueId, updatedFeedback);
    
    // Update critique stats in local state
    const updatedCritiques = critiques.map(c => {
      if (c.id === critiqueId) {
        const totalRating = c.averageRating * c.feedbackCount + feedbackData.rating;
        const newCount = c.feedbackCount + 1;
        return {
          ...c,
          feedbackCount: newCount,
          averageRating: Math.round((totalRating / newCount) * 10) / 10
        };
      }
      return c;
    });
    setCritiques(updatedCritiques);
    photoCritiqueCacheService.setCachedCritiques(organization.id, updatedCritiques);
    
    return newFeedback;
  }, [userProfile, critiqueFeedback, critiques, organization?.id]);

  // Update a critique
  const updateCritiqueData = useCallback(async (critiqueId, updateData) => {
    await updateCritique(critiqueId, updateData);
    
    // Update local state and cache
    const updatedCritiques = critiques.map(c => 
      c.id === critiqueId ? { ...c, ...updateData } : c
    );
    setCritiques(updatedCritiques);
    photoCritiqueCacheService.setCachedCritiques(organization.id, updatedCritiques);
  }, [critiques, organization?.id]);

  // Delete a critique
  const removeCritique = useCallback(async (critiqueId, imageUrl, thumbnailUrl) => {
    try {
      await deleteCritique(critiqueId, imageUrl, thumbnailUrl);
    } catch (error) {
      // If it's a permission error but we're a manager/admin, the delete likely succeeded
      // (due to the manager/admin check in Firestore rules)
      if (error.code === 'permission-denied' && 
          (userProfile?.role === 'manager' || userProfile?.role === 'admin')) {
        console.log('Delete succeeded despite permission warning');
      } else {
        // Re-throw other errors
        throw error;
      }
    }
    
    // Update local state and cache (delete succeeded or was allowed)
    const updatedCritiques = critiques.filter(c => c.id !== critiqueId);
    setCritiques(updatedCritiques);
    photoCritiqueCacheService.setCachedCritiques(organization.id, updatedCritiques);
    
    // Clear feedback cache for this critique
    photoCritiqueCacheService.clearFeedbackCache(critiqueId);
  }, [critiques, organization?.id, userProfile?.role]);

  // Update feedback
  const updateFeedbackData = useCallback(async (feedbackId, updateData) => {
    await updateFeedback(feedbackId, updateData);
    
    // Update local state and cache
    const updatedFeedback = critiqueFeedback.map(f => 
      f.id === feedbackId ? { ...f, ...updateData } : f
    );
    setCritiqueFeedback(updatedFeedback);
    
    if (selectedCritique) {
      photoCritiqueCacheService.setCachedFeedback(selectedCritique.id, updatedFeedback);
    }
  }, [critiqueFeedback, selectedCritique]);

  // Delete feedback
  const removeFeedback = useCallback(async (feedbackId) => {
    await deleteFeedback(feedbackId);
    
    // Update local state and cache
    const updatedFeedback = critiqueFeedback.filter(f => f.id !== feedbackId);
    setCritiqueFeedback(updatedFeedback);
    
    if (selectedCritique) {
      photoCritiqueCacheService.setCachedFeedback(selectedCritique.id, updatedFeedback);
    }
  }, [critiqueFeedback, selectedCritique]);

  // Load photographers
  const loadPhotographers = useCallback(async () => {
    if (!organization?.id) return;
    
    try {
      const photographersList = await getPhotographers(organization.id);
      setPhotographers(photographersList);
    } catch (err) {
      console.error('Error loading photographers:', err);
    }
  }, [organization?.id]);

  // Set up real-time listeners
  useEffect(() => {
    if (!organization?.id) return;
    
    // Clean up previous listeners
    if (unsubscribeCritiques) {
      unsubscribeCritiques();
    }
    
    // Subscribe to real-time updates
    const unsubscribe = subscribeToCritiques(
      organization.id,
      (updatedCritiques) => {
        // Merge with existing critiques to preserve optimistic updates
        setCritiques(prevCritiques => {
          // Find optimistic updates that are still pending
          const optimisticUpdates = prevCritiques.filter(c => {
            if (!c._isOptimistic) return false;
            
            // Keep optimistic updates for 30 seconds
            const thirtySecondsAgo = Date.now() - 30000;
            return c._optimisticTimestamp > thirtySecondsAgo;
          });
          
          // Create a map of server critique IDs for quick lookup
          const serverIds = new Set(updatedCritiques.map(c => c.id));
          
          // Keep only optimistic updates that don't exist on server yet
          const stillPendingOptimistic = optimisticUpdates.filter(c => !serverIds.has(c.id));
          
          // Merge: optimistic updates first, then server data
          if (stillPendingOptimistic.length > 0) {
            console.log('Preserving optimistic updates:', stillPendingOptimistic.length);
            return [...stillPendingOptimistic, ...updatedCritiques];
          }
          
          // No pending optimistic updates, use server data
          return updatedCritiques;
        });
        
        // Update cache with server data
        photoCritiqueCacheService.setCachedCritiques(organization.id, updatedCritiques);
      },
      filters
    );
    
    setUnsubscribeCritiques(() => unsubscribe);
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [organization?.id, filters]);

  // Subscribe to feedback updates when a critique is selected
  useEffect(() => {
    if (!selectedCritique?.id) return;
    
    // Clean up previous listener
    if (unsubscribeFeedback) {
      unsubscribeFeedback();
    }
    
    // Load initial feedback
    loadCritiqueFeedback(selectedCritique.id);
    
    // Subscribe to real-time updates
    const unsubscribe = subscribeToCritiqueFeedback(
      selectedCritique.id,
      (updatedFeedback) => {
        setCritiqueFeedback(updatedFeedback);
        photoCritiqueCacheService.setCachedFeedback(selectedCritique.id, updatedFeedback);
      }
    );
    
    setUnsubscribeFeedback(() => unsubscribe);
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [selectedCritique?.id, loadCritiqueFeedback]);

  // Load initial data
  useEffect(() => {
    if (organization?.id) {
      loadCritiques(true);
      loadPhotographers();
    }
  }, [organization?.id, loadCritiques, loadPhotographers]);

  // Check if user can submit critiques
  const canSubmitCritiques = useCallback(() => {
    return userProfile?.role === 'manager' || userProfile?.isPhotographer === true;
  }, [userProfile]);

  // Check if user can provide feedback
  const canProvideFeedback = useCallback(() => {
    return userProfile?.isPhotographer === true;
  }, [userProfile]);

  const value = {
    // State
    critiques,
    selectedCritique,
    critiqueFeedback,
    photographers,
    loading,
    feedbackLoading,
    error,
    filters,
    pagination,
    
    // Actions
    loadCritiques,
    loadCritiqueFeedback,
    submitCritique,
    submitFeedback,
    updateCritiqueData,
    removeCritique,
    updateFeedbackData,
    removeFeedback,
    setSelectedCritique,
    setFilters,
    
    // Permissions
    canSubmitCritiques,
    canProvideFeedback
  };

  return (
    <PhotoCritiqueContext.Provider value={value}>
      {children}
    </PhotoCritiqueContext.Provider>
  );
};