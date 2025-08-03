// src/services/yearbookService.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  addDoc
} from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { readCounter } from './readCounter';
import secureLogger from '../utils/secureLogger';

// Helper function to get current school year
export const getCurrentSchoolYear = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed (0 = January)
  
  // School year starts in August (month 7)
  if (month >= 7) {
    // August-December: return current year - next year
    return `${year}-${year + 1}`;
  } else {
    // January-July: return previous year - current year
    return `${year - 1}-${year}`;
  }
};

// Get school year date range
export const getSchoolYearDateRange = (schoolYear) => {
  const [startYear, endYear] = schoolYear.split('-').map(Number);
  return {
    startDate: new Date(startYear, 7, 1), // August 1st
    endDate: new Date(endYear, 6, 31), // July 31st
  };
};

// Create a new yearbook shoot list
export const createYearbookShootList = async (organizationId, schoolId, schoolName, schoolYear, items = [], templateId = null) => {
  try {
    const dateRange = getSchoolYearDateRange(schoolYear);
    
    const shootListData = {
      organizationId,
      schoolId,
      schoolName,
      schoolYear,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      isActive: schoolYear === getCurrentSchoolYear(),
      copiedFromId: templateId,
      completedCount: 0,
      totalCount: items.length,
      items: items.map((item, index) => ({
        ...item,
        id: `item_${Date.now()}_${index}`,
        completed: false,
        completedDate: null,
        completedBySession: null,
        photographerId: null,
        photographerName: null,
        imageNumbers: [],
        notes: '',
        order: index
      })),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(firestore, 'yearbookShootLists'), shootListData);
    
    // Update school document with current list reference
    if (shootListData.isActive) {
      await updateDoc(doc(firestore, 'schools', schoolId), {
        currentYearbookListId: docRef.id,
        yearbookEnabled: true,
        updatedAt: serverTimestamp()
      });
    }

    return {
      success: true,
      data: { id: docRef.id, ...shootListData }
    };
  } catch (error) {
    secureLogger.error('Error creating yearbook shoot list:', error);
    return { success: false, error: error.message };
  }
};

// Get yearbook shoot list for a specific school and year
export const getYearbookShootList = async (schoolId, schoolYear, organizationId = null) => {
  try {
    // Build query constraints
    const constraints = [
      where('schoolId', '==', schoolId),
      where('schoolYear', '==', schoolYear)
    ];
    
    // Add organizationId filter if provided (helps with security rules)
    if (organizationId) {
      constraints.push(where('organizationId', '==', organizationId));
    }
    
    constraints.push(limit(1));
    
    const q = query(
      collection(firestore, 'yearbookShootLists'),
      ...constraints
    );

    const snapshot = await getDocs(q);
    readCounter.recordRead('getDocs', 'yearbookShootLists', 'YearbookService', snapshot.size);

    if (snapshot.empty) {
      return { success: true, data: null };
    }

    const doc = snapshot.docs[0];
    return {
      success: true,
      data: { id: doc.id, ...doc.data() }
    };
  } catch (error) {
    secureLogger.error('Error getting yearbook shoot list:', error);
    // Provide more context about the error
    if (error.code === 'permission-denied') {
      return { success: false, error: 'You do not have permission to view yearbook lists for this school.' };
    }
    return { success: false, error: error.message };
  }
};

// Get all years available for a school
export const getAvailableYears = async (schoolId, organizationId = null) => {
  try {
    // Build query constraints
    const constraints = [
      where('schoolId', '==', schoolId)
    ];
    
    // Add organizationId filter if provided (helps with security rules)
    if (organizationId) {
      constraints.push(where('organizationId', '==', organizationId));
    }
    
    constraints.push(orderBy('schoolYear', 'desc'));
    
    const q = query(
      collection(firestore, 'yearbookShootLists'),
      ...constraints
    );

    const snapshot = await getDocs(q);
    readCounter.recordRead('getDocs', 'yearbookShootLists', 'YearbookService', snapshot.size);

    const years = snapshot.docs.map(doc => doc.data().schoolYear);
    return { success: true, data: [...new Set(years)] }; // Remove duplicates
  } catch (error) {
    secureLogger.error('Error getting available years:', error);
    // Provide more context about the error
    if (error.code === 'permission-denied') {
      return { success: false, error: 'You do not have permission to view yearbook lists for this school.' };
    }
    return { success: false, error: error.message };
  }
};

// Update a specific item in the shoot list
export const updateShootListItem = async (listId, itemId, updates) => {
  try {
    const listRef = doc(firestore, 'yearbookShootLists', listId);
    const listDoc = await getDoc(listRef);
    
    if (!listDoc.exists()) {
      throw new Error('Shoot list not found');
    }

    readCounter.recordRead('getDoc', 'yearbookShootLists', 'YearbookService', 1);

    const listData = listDoc.data();
    const updatedItems = listData.items.map(item => {
      if (item.id === itemId) {
        const wasCompleted = item.completed;
        const isNowCompleted = updates.completed !== undefined ? updates.completed : item.completed;
        
        // Update completed count if status changed
        if (!wasCompleted && isNowCompleted) {
          listData.completedCount = (listData.completedCount || 0) + 1;
        } else if (wasCompleted && !isNowCompleted) {
          listData.completedCount = Math.max(0, (listData.completedCount || 0) - 1);
        }
        
        // Filter out undefined values from updates
        const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
          if (value !== undefined) {
            acc[key] = value;
          }
          return acc;
        }, {});
        
        return { ...item, ...cleanUpdates };
      }
      return item;
    });

    await updateDoc(listRef, {
      items: updatedItems,
      completedCount: listData.completedCount,
      updatedAt: serverTimestamp()
    });


    return { success: true };
  } catch (error) {
    secureLogger.error('Error updating shoot list item:', error);
    return { success: false, error: error.message };
  }
};

// Copy a shoot list to a new year
export const copyShootListToNewYear = async (sourceListId, targetSchoolId, targetSchoolName, targetYear) => {
  try {
    const sourceDoc = await getDoc(doc(firestore, 'yearbookShootLists', sourceListId));
    
    if (!sourceDoc.exists()) {
      throw new Error('Source shoot list not found');
    }

    readCounter.recordRead('getDoc', 'yearbookShootLists', 'YearbookService', 1);

    const sourceData = sourceDoc.data();
    
    // Reset all items to uncompleted for new year
    const resetItems = sourceData.items.map(item => ({
      ...item,
      completed: false,
      completedDate: null,
      completedBySession: null,
      photographerId: null,
      photographerName: null,
      imageNumbers: [],
      notes: ''
    }));

    return await createYearbookShootList(
      sourceData.organizationId,
      targetSchoolId,
      targetSchoolName,
      targetYear,
      resetItems,
      sourceListId
    );
  } catch (error) {
    secureLogger.error('Error copying shoot list:', error);
    return { success: false, error: error.message };
  }
};

// Subscribe to shoot list updates with cache optimization
export const subscribeToShootListUpdates = (schoolId, schoolYear, latestTimestamp, callback, organizationId = null) => {
  try {
    // Build query constraints
    const constraints = [
      where('schoolId', '==', schoolId),
      where('schoolYear', '==', schoolYear)
    ];
    
    // Add organizationId filter if provided (helps with security rules)
    if (organizationId) {
      constraints.push(where('organizationId', '==', organizationId));
    }
    
    let q = query(
      collection(firestore, 'yearbookShootLists'),
      ...constraints
    );

    // Only get updates after the cached timestamp
    if (latestTimestamp && latestTimestamp instanceof Date && !isNaN(latestTimestamp.getTime())) {
      q = query(q, where('updatedAt', '>', latestTimestamp));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const isIncremental = latestTimestamp !== null;
      readCounter.recordRead('onSnapshot', 'yearbookShootLists', 'YearbookListener', snapshot.size);
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        callback({ id: doc.id, ...doc.data() }, isIncremental);
      }
    }, (error) => {
      secureLogger.error('Error in shoot list listener:', error);
      callback(null, false, error);
    });

    return unsubscribe;
  } catch (error) {
    secureLogger.error('Error setting up shoot list listener:', error);
    return () => {}; // Return empty function for cleanup
  }
};

// Get all active shoot lists for an organization
export const getActiveShootLists = async (organizationId, currentYear = getCurrentSchoolYear()) => {
  try {
    const q = query(
      collection(firestore, 'yearbookShootLists'),
      where('organizationId', '==', organizationId),
      where('schoolYear', '==', currentYear),
      orderBy('schoolName')
    );

    const snapshot = await getDocs(q);
    readCounter.recordRead('getDocs', 'yearbookShootLists', 'YearbookService', snapshot.size);

    const lists = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return { success: true, data: lists };
  } catch (error) {
    secureLogger.error('Error getting active shoot lists:', error);
    return { success: false, error: error.message };
  }
};

// Add a new item to the shoot list
export const addShootListItem = async (listId, category, itemData) => {
  try {
    const listRef = doc(firestore, 'yearbookShootLists', listId);
    const listDoc = await getDoc(listRef);
    
    if (!listDoc.exists()) {
      throw new Error('Shoot list not found');
    }

    readCounter.recordRead('getDoc', 'yearbookShootLists', 'YearbookService', 1);

    const listData = listDoc.data();
    const newItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: itemData.name,
      description: itemData.description || '',
      category: category,
      required: itemData.required || false,
      completed: false,
      completedDate: null,
      completedBySession: null,
      photographerId: null,
      photographerName: null,
      imageNumbers: [],
      notes: '',
      order: listData.items.length
    };

    const updatedItems = [...listData.items, newItem];

    await updateDoc(listRef, {
      items: updatedItems,
      totalCount: updatedItems.length,
      updatedAt: serverTimestamp()
    });

    return { success: true, data: newItem };
  } catch (error) {
    secureLogger.error('Error adding shoot list item:', error);
    return { success: false, error: error.message };
  }
};

// Delete a yearbook shoot list
export const deleteYearbookShootList = async (listId) => {
  try {
    await deleteDoc(doc(firestore, 'yearbookShootLists', listId));
    
    return { success: true };
  } catch (error) {
    secureLogger.error('Error deleting shoot list:', error);
    return { success: false, error: error.message };
  }
};

// Batch update multiple items
export const batchUpdateShootListItems = async (listId, itemUpdates) => {
  try {
    const batch = writeBatch(firestore);
    const listRef = doc(firestore, 'yearbookShootLists', listId);
    const listDoc = await getDoc(listRef);
    
    if (!listDoc.exists()) {
      throw new Error('Shoot list not found');
    }

    readCounter.recordRead('getDoc', 'yearbookShootLists', 'YearbookService', 1);

    const listData = listDoc.data();
    let completedCountDelta = 0;

    const updatedItems = listData.items.map(item => {
      const update = itemUpdates.find(u => u.itemId === item.id);
      if (update) {
        const wasCompleted = item.completed;
        const isNowCompleted = update.updates.completed !== undefined ? update.updates.completed : item.completed;
        
        if (!wasCompleted && isNowCompleted) {
          completedCountDelta++;
        } else if (wasCompleted && !isNowCompleted) {
          completedCountDelta--;
        }
        
        // Filter out undefined values from updates
        const cleanUpdates = Object.entries(update.updates).reduce((acc, [key, value]) => {
          if (value !== undefined) {
            acc[key] = value;
          }
          return acc;
        }, {});
        
        return { ...item, ...cleanUpdates };
      }
      return item;
    });

    batch.update(listRef, {
      items: updatedItems,
      completedCount: Math.max(0, (listData.completedCount || 0) + completedCountDelta),
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    return { success: true };
  } catch (error) {
    secureLogger.error('Error batch updating shoot list items:', error);
    return { success: false, error: error.message };
  }
};