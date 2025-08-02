// src/contexts/DistrictContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { 
  getDistricts, 
  subscribeToDistricts, 
  createDistrict as createDistrictService,
  updateDistrict as updateDistrictService,
  deleteDistrict as deleteDistrictService,
  assignSchoolsToDistrict as assignSchoolsService,
  removeSchoolsFromDistrict as removeSchoolsService
} from '../services/districtService';
import { districtCacheService } from '../services/districtCacheService';
import { readCounter } from '../services/readCounter';
import { useToast } from './ToastContext';

const DistrictContext = createContext();

export const useDistricts = () => {
  const context = useContext(DistrictContext);
  if (!context) {
    throw new Error('useDistricts must be used within a DistrictProvider');
  }
  return context;
};

export const DistrictProvider = ({ children }) => {
  const { userProfile, organization } = useAuth();
  const { showToast } = useToast();
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load districts with cache-first approach
  useEffect(() => {
    if (!organization?.id) {
      setDistricts([]);
      setLoading(false);
      return;
    }

    let unsubscribe;
    let isSubscribed = true;

    const loadDistricts = async () => {
      try {
        // 1. Load from cache immediately
        const cached = districtCacheService.getCachedDistricts(organization.id);
        if (cached && isSubscribed) {
          setDistricts(cached);
          setLoading(false);
          readCounter.recordCacheHit('districts', 'DistrictContext', cached.length);
        } else {
          readCounter.recordCacheMiss('districts', 'DistrictContext');
        }

        // 2. Set up real-time listener for updates
        unsubscribe = subscribeToDistricts(organization.id, (updatedDistricts) => {
          if (isSubscribed) {
            setDistricts(updatedDistricts);
            setLoading(false);
            districtCacheService.setCachedDistricts(organization.id, updatedDistricts);
          }
        });

      } catch (err) {
        console.error('Error loading districts:', err);
        if (isSubscribed) {
          setError(err.message);
          setLoading(false);
          showToast('Failed to load districts', 'error');
        }
      }
    };

    loadDistricts();

    // Cleanup
    return () => {
      isSubscribed = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [organization?.id, showToast]);

  // Create a new district
  const createDistrict = async (districtData) => {
    try {
      if (!organization?.id || !userProfile?.id) {
        throw new Error('Organization or user not found');
      }

      const districtId = await createDistrictService(
        organization.id, 
        districtData, 
        userProfile.id
      );

      showToast('District created successfully', 'success');
      return districtId;
    } catch (err) {
      console.error('Error creating district:', err);
      showToast('Failed to create district', 'error');
      throw err;
    }
  };

  // Update a district with optimistic updates
  const updateDistrict = async (districtId, districtData) => {
    // Find the current district
    const currentDistrict = districts.find(d => d.id === districtId);
    if (!currentDistrict) {
      throw new Error('District not found');
    }

    // Optimistically update UI
    setDistricts(prev => 
      prev.map(d => d.id === districtId ? { ...d, ...districtData } : d)
    );

    try {
      await updateDistrictService(districtId, districtData, userProfile?.id);
      showToast('District updated successfully', 'success');
    } catch (err) {
      // Revert on error
      setDistricts(prev => 
        prev.map(d => d.id === districtId ? currentDistrict : d)
      );
      console.error('Error updating district:', err);
      showToast('Failed to update district', 'error');
      throw err;
    }
  };

  // Delete a district
  const deleteDistrict = async (districtId) => {
    try {
      await deleteDistrictService(districtId);
      showToast('District deleted successfully', 'success');
    } catch (err) {
      console.error('Error deleting district:', err);
      showToast('Failed to delete district', 'error');
      throw err;
    }
  };

  // Assign schools to a district
  const assignSchoolsToDistrict = async (districtId, schoolIds) => {
    try {
      await assignSchoolsService(districtId, schoolIds);
      showToast(`${schoolIds.length} school(s) assigned to district`, 'success');
    } catch (err) {
      console.error('Error assigning schools to district:', err);
      showToast('Failed to assign schools to district', 'error');
      throw err;
    }
  };

  // Remove schools from a district
  const removeSchoolsFromDistrict = async (districtId, schoolIds) => {
    try {
      await removeSchoolsService(districtId, schoolIds);
      showToast(`${schoolIds.length} school(s) removed from district`, 'success');
    } catch (err) {
      console.error('Error removing schools from district:', err);
      showToast('Failed to remove schools from district', 'error');
      throw err;
    }
  };

  // Get district by ID
  const getDistrictById = (districtId) => {
    return districts.find(d => d.id === districtId);
  };

  // Get districts sorted alphabetically
  const getDistrictsSorted = () => {
    return [...districts].sort((a, b) => a.name.localeCompare(b.name));
  };

  const value = {
    districts,
    loading,
    error,
    createDistrict,
    updateDistrict,
    deleteDistrict,
    assignSchoolsToDistrict,
    removeSchoolsFromDistrict,
    getDistrictById,
    getDistrictsSorted,
    // Stats
    totalDistricts: districts.length,
    totalSchoolsInDistricts: districts.reduce((sum, d) => sum + (d.schoolCount || 0), 0)
  };

  return (
    <DistrictContext.Provider value={value}>
      {children}
    </DistrictContext.Provider>
  );
};