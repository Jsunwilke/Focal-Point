// src/services/districtService.js
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
  increment,
  onSnapshot
} from "firebase/firestore";
import { firestore } from "../firebase/config";
import { readCounter } from "./readCounter";
import { districtCacheService } from "./districtCacheService";
import { organizationCacheService } from "./organizationCacheService";

// Get all districts for an organization
export const getDistricts = async (organizationId) => {
  try {
    // Check cache first
    const cachedDistricts = districtCacheService.getCachedDistricts(organizationId);
    if (cachedDistricts) {
      readCounter.recordCacheHit('districts', 'getDistricts', cachedDistricts.length);
      return cachedDistricts;
    }
    
    // Cache miss
    readCounter.recordCacheMiss('districts', 'getDistricts');
    
    // Query Firestore
    const q = query(
      collection(firestore, "districts"),
      where("organizationID", "==", organizationId),
      orderBy("name", "asc")
    );
    
    const querySnapshot = await getDocs(q);
    readCounter.recordRead('query', 'districts', 'getDistricts', querySnapshot.size);
    
    const districts = [];
    querySnapshot.forEach((doc) => {
      districts.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Cache the results
    districtCacheService.setCachedDistricts(organizationId, districts);
    
    return districts;
  } catch (error) {
    console.error("Error fetching districts:", error);
    throw error;
  }
};

// Subscribe to real-time district updates
export const subscribeToDistricts = (organizationId, callback) => {
  const q = query(
    collection(firestore, "districts"),
    where("organizationID", "==", organizationId),
    orderBy("name", "asc")
  );
  
  return onSnapshot(q, (snapshot) => {
    const districts = [];
    snapshot.forEach((doc) => {
      districts.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    readCounter.recordRead('realtime', 'districts', 'subscribeToDistricts', snapshot.size);
    
    // Update cache
    districtCacheService.setCachedDistricts(organizationId, districts);
    
    // Call the callback with updated data
    callback(districts);
  });
};

// Create a new district
export const createDistrict = async (organizationId, districtData, userId) => {
  try {
    const districtRef = await addDoc(collection(firestore, "districts"), {
      ...districtData,
      organizationID: organizationId,
      schoolCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId
    });
    
    readCounter.recordRead('create', 'districts', 'createDistrict', 1);
    
    // Clear cache to force refresh
    districtCacheService.clearOrganizationCache(organizationId);
    
    return districtRef.id;
  } catch (error) {
    console.error("Error creating district:", error);
    throw error;
  }
};

// Update a district
export const updateDistrict = async (districtId, districtData, userId) => {
  try {
    await updateDoc(doc(firestore, "districts", districtId), {
      ...districtData,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });
    
    readCounter.recordRead('update', 'districts', 'updateDistrict', 1);
    
    // Get the district to clear its organization's cache
    const districtDoc = await getDoc(doc(firestore, "districts", districtId));
    if (districtDoc.exists()) {
      districtCacheService.clearOrganizationCache(districtDoc.data().organizationID);
    }
    
  } catch (error) {
    console.error("Error updating district:", error);
    throw error;
  }
};

// Delete a district and unassign all schools
export const deleteDistrict = async (districtId) => {
  try {
    const batch = writeBatch(firestore);
    
    // Get the district data first
    const districtRef = doc(firestore, "districts", districtId);
    const districtDoc = await getDoc(districtRef);
    
    if (!districtDoc.exists()) {
      throw new Error("District not found");
    }
    
    const districtData = districtDoc.data();
    
    // Find all schools in this district
    const schoolsQuery = query(
      collection(firestore, "schools"),
      where("districtId", "==", districtId)
    );
    
    const schoolsSnapshot = await getDocs(schoolsQuery);
    readCounter.recordRead('query', 'schools', 'deleteDistrict', schoolsSnapshot.size);
    
    // Update all schools to remove district assignment
    schoolsSnapshot.forEach((schoolDoc) => {
      batch.update(schoolDoc.ref, {
        districtId: null,
        districtName: null,
        updatedAt: serverTimestamp()
      });
    });
    
    // Delete the district
    batch.delete(districtRef);
    
    // Commit the batch
    await batch.commit();
    
    readCounter.recordRead('delete', 'districts', 'deleteDistrict', 1);
    readCounter.recordRead('update', 'schools', 'deleteDistrict', schoolsSnapshot.size);
    
    // Clear caches
    districtCacheService.clearOrganizationCache(districtData.organizationID);
    organizationCacheService.clearSchoolsCache(districtData.organizationID);
    
  } catch (error) {
    console.error("Error deleting district:", error);
    throw error;
  }
};

// Assign schools to a district
export const assignSchoolsToDistrict = async (districtId, schoolIds) => {
  try {
    if (!schoolIds || schoolIds.length === 0) {
      return;
    }
    
    const batch = writeBatch(firestore);
    
    // Get district data
    const districtRef = doc(firestore, "districts", districtId);
    const districtDoc = await getDoc(districtRef);
    
    if (!districtDoc.exists()) {
      throw new Error("District not found");
    }
    
    const districtData = districtDoc.data();
    const districtName = districtData.name;
    
    // Update each school
    for (const schoolId of schoolIds) {
      const schoolRef = doc(firestore, "schools", schoolId);
      
      // Check if school already has a district
      const schoolDoc = await getDoc(schoolRef);
      if (schoolDoc.exists() && schoolDoc.data().districtId && schoolDoc.data().districtId !== districtId) {
        // Decrement count from old district
        const oldDistrictRef = doc(firestore, "districts", schoolDoc.data().districtId);
        batch.update(oldDistrictRef, {
          schoolCount: increment(-1),
          updatedAt: serverTimestamp()
        });
      }
      
      // Update school with new district
      batch.update(schoolRef, {
        districtId,
        districtName,
        updatedAt: serverTimestamp()
      });
    }
    
    // Update district school count
    batch.update(districtRef, {
      schoolCount: increment(schoolIds.length),
      updatedAt: serverTimestamp()
    });
    
    // Commit the batch
    await batch.commit();
    
    readCounter.recordRead('update', 'schools', 'assignSchoolsToDistrict', schoolIds.length);
    readCounter.recordRead('update', 'districts', 'assignSchoolsToDistrict', 1);
    
    // Clear caches
    districtCacheService.clearOrganizationCache(districtData.organizationID);
    organizationCacheService.clearSchoolsCache(districtData.organizationID);
    
  } catch (error) {
    console.error("Error assigning schools to district:", error);
    throw error;
  }
};

// Remove schools from a district
export const removeSchoolsFromDistrict = async (districtId, schoolIds) => {
  try {
    if (!schoolIds || schoolIds.length === 0) {
      return;
    }
    
    const batch = writeBatch(firestore);
    
    // Get district data
    const districtRef = doc(firestore, "districts", districtId);
    const districtDoc = await getDoc(districtRef);
    
    if (!districtDoc.exists()) {
      throw new Error("District not found");
    }
    
    const districtData = districtDoc.data();
    
    // Update each school
    schoolIds.forEach((schoolId) => {
      const schoolRef = doc(firestore, "schools", schoolId);
      batch.update(schoolRef, {
        districtId: null,
        districtName: null,
        updatedAt: serverTimestamp()
      });
    });
    
    // Update district school count
    batch.update(districtRef, {
      schoolCount: increment(-schoolIds.length),
      updatedAt: serverTimestamp()
    });
    
    // Commit the batch
    await batch.commit();
    
    readCounter.recordRead('update', 'schools', 'removeSchoolsFromDistrict', schoolIds.length);
    readCounter.recordRead('update', 'districts', 'removeSchoolsFromDistrict', 1);
    
    // Clear caches
    districtCacheService.clearOrganizationCache(districtData.organizationID);
    organizationCacheService.clearSchoolsCache(districtData.organizationID);
    
  } catch (error) {
    console.error("Error removing schools from district:", error);
    throw error;
  }
};

// Get schools by district with caching
export const getSchoolsByDistrict = async (districtId) => {
  try {
    // Check cache first
    const cached = districtCacheService.getCachedSchoolsByDistrict(districtId);
    if (cached) {
      readCounter.recordCacheHit('schools', 'getSchoolsByDistrict', cached.length);
      return cached;
    }
    
    // Cache miss
    readCounter.recordCacheMiss('schools', 'getSchoolsByDistrict');
    
    // Query Firestore
    const q = query(
      collection(firestore, 'schools'),
      where('districtId', '==', districtId),
      orderBy('value', 'asc')
    );
    
    const snapshot = await getDocs(q);
    readCounter.recordRead('query', 'schools', 'getSchoolsByDistrict', snapshot.size);
    
    const schools = [];
    snapshot.forEach((doc) => {
      schools.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Cache the results
    districtCacheService.setCachedSchoolsByDistrict(districtId, schools);
    
    return schools;
  } catch (error) {
    console.error("Error fetching schools by district:", error);
    throw error;
  }
};