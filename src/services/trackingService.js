import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit,
  firestore
} from '../services/firestoreWrapper';
import { updateSession, getTeamMembers } from '../firebase/firestore';
import secureLogger from '../utils/secureLogger';
import { readCounter } from './readCounter';
import dataCacheService from './dataCacheService';

// User resolution functions
export const getUsersForOrganization = async (organizationID) => {
  try {
    // First check if we have cached users
    const cachedUsers = dataCacheService.getCachedUsers(organizationID);
    if (cachedUsers && cachedUsers.length > 0) {
      readCounter.recordCacheHit('users', 'TrackingService', cachedUsers.length);
      return cachedUsers;
    }
    
    // Fall back to direct query if no cache
    readCounter.recordCacheMiss('users', 'TrackingService');
    const users = await getTeamMembers(organizationID);
    return users;
  } catch (error) {
    secureLogger.error('Error fetching users', error);
    return [];
  }
};

export const resolveUserName = async (userId, organizationID) => {
  try {
    const users = await getUsersForOrganization(organizationID);
    const user = users.find(u => u.id === userId);
    if (user) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User';
    }
    return 'Unknown User';
  } catch (error) {
    secureLogger.error('Error resolving user name', error);
    return 'Unknown User';
  }
};

export const resolveUserNames = async (records, organizationID) => {
  try {
    const users = await getUsersForOrganization(organizationID);
    const userLookup = users.reduce((acc, user) => {
      acc[user.id] = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User';
      return acc;
    }, {});

    return records.map(record => ({
      ...record,
      photographerName: userLookup[record.userId] || 'Unknown User'
    }));
  } catch (error) {
    secureLogger.error('Error resolving user names', error);
    return records.map(record => ({
      ...record,
      photographerName: 'Unknown User'
    }));
  }
};

// SD Card Record structure
export const createSDCardRecord = (data) => ({
  cardNumber: data.cardNumber,
  userId: data.userId,
  school: data.school,
  status: data.status,
  organizationID: data.organizationID,
  timestamp: data.timestamp || new Date(),
  uploadedFromJasonsHouse: data.uploadedFromJasonsHouse || null,
  uploadedFromAndysHouse: data.uploadedFromAndysHouse || null,
});

// Job Box Record structure
export const createJobBoxRecord = (data) => ({
  boxNumber: data.boxNumber,
  userId: data.userId,
  school: data.school,
  status: data.status,
  organizationID: data.organizationID,
  timestamp: data.timestamp || new Date(),
  shiftUid: data.shiftUid || null,
});

// SD Card Operations
export const addSDCardRecord = async (recordData) => {
  try {
    const record = createSDCardRecord(recordData);
    const docRef = await addDoc(collection(firestore, 'records'), record);
    return { success: true, id: docRef.id };
  } catch (error) {
    // Log technical details for debugging but return user-friendly message
    secureLogger.error('Error adding SD card record', error);
    return { 
      success: false, 
      error: 'Unable to save SD card record. Please check your connection and try again.' 
    };
  }
};

export const getSDCardRecords = async (organizationID, filters = {}) => {
  try {
    let q = query(
      collection(firestore, 'records'),
      where('organizationID', '==', organizationID),
      orderBy('timestamp', 'desc')
    );

    // Apply filters
    if (filters.cardNumber) {
      q = query(q, where('cardNumber', '==', filters.cardNumber));
    }
    if (filters.userId) {
      q = query(q, where('userId', '==', filters.userId));
    }
    if (filters.school) {
      q = query(q, where('school', '==', filters.school));
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.limit) {
      q = query(q, limit(filters.limit));
    }

    const querySnapshot = await getDocs(q, 'getSDCardRecords');
    const records = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return { success: true, data: records };
  } catch (error) {
    secureLogger.error('Error fetching SD card records', error);
    return { 
      success: false, 
      error: 'Unable to load SD card records. Please check your connection and try again.' 
    };
  }
};

export const deleteSDCardRecord = async (recordId) => {
  try {
    await deleteDoc(doc(firestore, 'records', recordId));
    return { success: true };
  } catch (error) {
    secureLogger.error('Error deleting SD card record', error);
    return { 
      success: false, 
      error: 'Unable to delete SD card record. Please check your connection and try again.' 
    };
  }
};

// Job Box Operations
export const addJobBoxRecord = async (recordData) => {
  try {
    const record = createJobBoxRecord(recordData);
    const docRef = await addDoc(collection(firestore, 'jobBoxes'), record);
    
    // Update session with job box assignment if shiftUid exists
    if (recordData.shiftUid && docRef.id) {
      try {
        const { updateSession } = await import('../firebase/firestore');
        await updateSession(recordData.shiftUid, {
          hasJobBoxAssigned: true,
          jobBoxRecordId: docRef.id
        });
      } catch (sessionUpdateError) {
        secureLogger.error('Error updating session with job box assignment', {
          sessionId: recordData.shiftUid,
          jobBoxId: docRef.id,
          error: sessionUpdateError.message
        });
        // Continue - don't fail the whole operation if session update fails
      }
    }
    
    return { success: true, id: docRef.id };
  } catch (error) {
    secureLogger.error('Error adding job box record', error);
    return { 
      success: false, 
      error: 'Unable to save job box record. Please check your connection and try again.' 
    };
  }
};

export const getJobBoxRecords = async (organizationID, filters = {}) => {
  try {
    let q = query(
      collection(firestore, 'jobBoxes'),
      where('organizationID', '==', organizationID),
      orderBy('timestamp', 'desc')
    );

    // Apply filters
    if (filters.boxNumber) {
      q = query(q, where('boxNumber', '==', filters.boxNumber));
    }
    if (filters.userId) {
      q = query(q, where('userId', '==', filters.userId));
    }
    if (filters.school) {
      q = query(q, where('school', '==', filters.school));
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.limit) {
      q = query(q, limit(filters.limit));
    }

    const querySnapshot = await getDocs(q, 'getJobBoxRecords');
    const records = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return { success: true, data: records };
  } catch (error) {
    secureLogger.error('Error fetching job box records', error);
    return { 
      success: false, 
      error: 'Unable to load job box records. Please check your connection and try again.' 
    };
  }
};

export const deleteJobBoxRecord = async (recordId) => {
  try {
    // Get the job box record before deletion to extract shiftUid
    const jobBoxRef = doc(firestore, 'jobBoxes', recordId);
    const jobBoxDoc = await getDoc(jobBoxRef, 'deleteJobBoxRecord');
    
    let shiftUid = null;
    if (jobBoxDoc.exists()) {
      const jobBoxData = jobBoxDoc.data();
      shiftUid = jobBoxData.shiftUid;
    }
    
    // Delete the job box record
    await deleteDoc(jobBoxRef);
    
    // Clear session job box assignment if shiftUid exists
    if (shiftUid) {
      try {
        const { updateSession } = await import('../firebase/firestore');
        await updateSession(shiftUid, {
          hasJobBoxAssigned: false,
          jobBoxRecordId: null
        });
      } catch (sessionUpdateError) {
        secureLogger.error('Error clearing session job box assignment', {
          sessionId: shiftUid,
          deletedJobBoxId: recordId,
          error: sessionUpdateError.message
        });
        // Continue - don't fail the whole operation if session update fails
      }
    }
    
    return { success: true };
  } catch (error) {
    secureLogger.error('Error deleting job box record', error);
    return { 
      success: false, 
      error: 'Unable to delete job box record. Please check your connection and try again.' 
    };
  }
};

// Common utilities
export const SD_CARD_STATUSES = [
  'Job Box',
  'Camera',
  'Envelope',
  'Uploaded',
  'Cleared',
  'Camera Bag',
  'Personal'
];

export const JOB_BOX_STATUSES = [
  'Packed',
  'Picked Up',
  'Left Job',
  'Turned In'
];

// Get latest status for each card/box
export const getLatestSDCardStatuses = async (organizationID) => {
  try {
    const result = await getSDCardRecords(organizationID);
    if (!result.success) return result;

    // Group by card number and get latest status
    const cardGroups = result.data.reduce((acc, record) => {
      if (!acc[record.cardNumber] || new Date(record.timestamp) > new Date(acc[record.cardNumber].timestamp)) {
        acc[record.cardNumber] = record;
      }
      return acc;
    }, {});

    return { success: true, data: Object.values(cardGroups) };
  } catch (error) {
    secureLogger.error('Error getting latest SD card statuses', error);
    return { success: false, error: error.message };
  }
};

export const getLatestJobBoxStatuses = async (organizationID) => {
  try {
    const result = await getJobBoxRecords(organizationID);
    if (!result.success) return result;

    // Group by box number and get latest status
    const boxGroups = result.data.reduce((acc, record) => {
      if (!acc[record.boxNumber] || new Date(record.timestamp) > new Date(acc[record.boxNumber].timestamp)) {
        acc[record.boxNumber] = record;
      }
      return acc;
    }, {});

    return { success: true, data: Object.values(boxGroups) };
  } catch (error) {
    secureLogger.error('Error getting latest job box statuses', error);
    return { success: false, error: error.message };
  }
};

// Get job box by shift UID
export const getJobBoxByShiftUid = async (shiftUid, organizationID) => {
  try {
    const q = query(
      collection(firestore, 'jobBoxes'),
      where('shiftUid', '==', shiftUid),
      where('organizationID', '==', organizationID),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q, 'getJobBoxByShiftUid');
    if (querySnapshot.empty) {
      return { success: true, data: null };
    }

    const doc = querySnapshot.docs[0];
    const jobBoxData = { id: doc.id, ...doc.data() };
    
    // Resolve user name
    const userName = await resolveUserName(jobBoxData.userId, organizationID);
    jobBoxData.userName = userName;

    return { success: true, data: jobBoxData };
  } catch (error) {
    secureLogger.error('Error fetching job box by shift UID', error);
    return { 
      success: false, 
      error: 'Unable to load job box data. Please check your connection and try again.' 
    };
  }
};

// Search functionality
export const searchSDCards = async (organizationID, searchTerm, searchField = 'all') => {
  try {
    let filters = {};
    
    if (searchField !== 'all') {
      if (searchField === 'photographer') {
        // Search by photographer name - need to resolve to userId
        const users = await getUsersForOrganization(organizationID);
        const matchingUsers = users.filter(user => 
          (user.firstName + ' ' + user.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        if (matchingUsers.length === 0) {
          return { success: true, data: [] };
        }
        
        // Get records for all matching users
        const allResults = [];
        for (const user of matchingUsers) {
          const userResult = await getSDCardRecords(organizationID, { userId: user.id });
          if (userResult.success) {
            allResults.push(...userResult.data);
          }
        }
        
        return { success: true, data: allResults };
      } else {
        filters[searchField] = searchTerm;
      }
    }

    const result = await getSDCardRecords(organizationID, filters);
    
    if (searchField === 'all' && searchTerm) {
      // Filter results client-side for 'all' search
      const users = await getUsersForOrganization(organizationID);
      const userLookup = users.reduce((acc, user) => {
        acc[user.id] = user.firstName + ' ' + user.lastName;
        return acc;
      }, {});
      
      const filteredData = result.data.filter(record => 
        record.cardNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.school?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userLookup[record.userId]?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      return { success: true, data: filteredData };
    }

    return result;
  } catch (error) {
    secureLogger.error('Error searching SD cards', error);
    return { 
      success: false, 
      error: 'Unable to search SD cards. Please check your connection and try again.' 
    };
  }
};

export const searchJobBoxes = async (organizationID, searchTerm, searchField = 'all') => {
  try {
    let filters = {};
    
    if (searchField !== 'all') {
      if (searchField === 'photographer') {
        // Search by photographer name - need to resolve to userId
        const users = await getUsersForOrganization(organizationID);
        const matchingUsers = users.filter(user => 
          (user.firstName + ' ' + user.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        if (matchingUsers.length === 0) {
          return { success: true, data: [] };
        }
        
        // Get records for all matching users
        const allResults = [];
        for (const user of matchingUsers) {
          const userResult = await getJobBoxRecords(organizationID, { userId: user.id });
          if (userResult.success) {
            allResults.push(...userResult.data);
          }
        }
        
        return { success: true, data: allResults };
      } else {
        filters[searchField] = searchTerm;
      }
    }

    const result = await getJobBoxRecords(organizationID, filters);
    
    if (searchField === 'all' && searchTerm) {
      // Filter results client-side for 'all' search
      const users = await getUsersForOrganization(organizationID);
      const userLookup = users.reduce((acc, user) => {
        acc[user.id] = user.firstName + ' ' + user.lastName;
        return acc;
      }, {});
      
      const filteredData = result.data.filter(record => 
        record.boxNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.school?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userLookup[record.userId]?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      return { success: true, data: filteredData };
    }

    return result;
  } catch (error) {
    secureLogger.error('Error searching job boxes', error);
    return { 
      success: false, 
      error: 'Unable to search job boxes. Please check your connection and try again.' 
    };
  }
};

// Batch record creation
export const addBatchRecords = async (organizationID, batchData) => {
  try {

    const { jobBoxNumber, cardNumbers, userId, school, shiftData, includeJobBox = true } = batchData;
    const timestamp = new Date();
    const results = {
      jobBox: null,
      sdCards: [],
      errors: []
    };


    // Validate required fields
    if (!cardNumbers || !Array.isArray(cardNumbers) || cardNumbers.length === 0) {
      return {
        success: false,
        message: 'Card numbers are required'
      };
    }

    // Only require job box number if includeJobBox is true
    if (includeJobBox && !jobBoxNumber) {
      return {
        success: false,
        message: 'Job box number is required when including job box'
      };
    }

    if (!userId || !organizationID) {
      return {
        success: false,
        message: 'User and organization information are required'
      };
    }

    if (!school) {
      return {
        success: false,
        message: 'School selection is required'
      };
    }

    // Create job box record only if includeJobBox is true
    if (includeJobBox) {
      try {
        const jobBoxRecord = createJobBoxRecord({
          boxNumber: jobBoxNumber,
          userId: userId,
          school: school || 'Unknown School',
          status: 'Packed', // Default status for batch created job boxes
          organizationID: organizationID,
          timestamp: timestamp,
          shiftUid: shiftData?.sessionId || null
        });

        const jobBoxDocRef = await addDoc(collection(firestore, 'jobBoxes'), jobBoxRecord);
        results.jobBox = { success: true, id: jobBoxDocRef.id };
        
        // Update session with job box assignment if shiftData exists
        if (shiftData?.sessionId && jobBoxDocRef.id) {
          try {
            await updateSession(shiftData.sessionId, {
              hasJobBoxAssigned: true,
              jobBoxRecordId: jobBoxDocRef.id
            });
          } catch (sessionUpdateError) {
            secureLogger.error('Error updating session with job box assignment', {
              sessionId: shiftData.sessionId,
              error: sessionUpdateError.message
            });
            // Don't fail the whole operation if session update fails
            results.errors.push(`Job box created but failed to update session: ${sessionUpdateError.message}`);
          }
        }
      } catch (error) {
        secureLogger.error('Error creating job box record', error);
        results.jobBox = { success: false, error: 'Failed to create job box record' };
        results.errors.push(`Job box ${jobBoxNumber}: ${error.message}`);
      }
    }

    // Create SD card records
    for (const cardNumber of cardNumbers) {
      if (!cardNumber || typeof cardNumber !== 'string' || cardNumber.trim() === '') {
        results.errors.push(`Invalid card number: ${cardNumber}`);
        continue;
      }

      try {
        const sdCardRecord = createSDCardRecord({
          cardNumber: cardNumber.trim(),
          userId: userId,
          school: school || 'Unknown School',
          status: 'Job Box', // Default status for batch created SD cards
          organizationID: organizationID,
          timestamp: timestamp,
          uploadedFromJasonsHouse: null,
          uploadedFromAndysHouse: null
        });

        const cardDocRef = await addDoc(collection(firestore, 'records'), sdCardRecord);
        results.sdCards.push({ 
          cardNumber: cardNumber.trim(), 
          success: true, 
          id: cardDocRef.id 
        });
      } catch (error) {
        secureLogger.error('Error creating SD card record', error);
        results.sdCards.push({ 
          cardNumber: cardNumber.trim(), 
          success: false, 
          error: error.message 
        });
        results.errors.push(`SD card ${cardNumber.trim()}: ${error.message}`);
      }
    }

    // Calculate success rate
    const successfulCards = results.sdCards.filter(card => card.success).length;
    const totalCards = cardNumbers.length;
    const jobBoxSuccess = includeJobBox ? (results.jobBox?.success || false) : true;

    // Different success messages based on whether job box was included
    if (includeJobBox) {
      if (jobBoxSuccess && successfulCards === totalCards) {
        return {
          success: true,
          message: `Successfully created 1 job box and ${successfulCards} SD card records`,
          results: results
        };
      } else if (successfulCards > 0 || jobBoxSuccess) {
        secureLogger.warn('Batch creation partially successful', { 
          jobBoxSuccess, 
          successfulCards, 
          totalCards,
          errorCount: results.errors.length 
        });
        return {
          success: true,
          message: `Partially successful: ${jobBoxSuccess ? '1 job box' : '0 job boxes'} and ${successfulCards}/${totalCards} SD cards created`,
          results: results,
          warnings: results.errors
        };
      }
    } else {
      // No job box mode - only check SD card success
      if (successfulCards === totalCards) {
        return {
          success: true,
          message: `Successfully created ${successfulCards} SD card records`,
          results: results
        };
      } else if (successfulCards > 0) {
        secureLogger.warn('SD card creation partially successful', { 
          successfulCards, 
          totalCards,
          errorCount: results.errors.length 
        });
        return {
          success: true,
          message: `Partially successful: ${successfulCards}/${totalCards} SD cards created`,
          results: results,
          warnings: results.errors
        };
      }
    }

    // Complete failure
    secureLogger.error('Batch creation failed completely', { 
      errorCount: results.errors.length 
    });
    return {
      success: false,
      message: 'Failed to create any records',
      results: results,
      errors: results.errors
    };
  } catch (error) {
    secureLogger.error('Error in batch record creation', error);
    return {
      success: false,
      message: 'Unable to create batch records. Please check your connection and try again.',
      error: error.message
    };
  }
};