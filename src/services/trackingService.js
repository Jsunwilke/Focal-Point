import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit
} from 'firebase/firestore';
import { firestore } from '../firebase/config';

// User resolution cache
let userCache = null;
let userCacheTimestamp = null;
const USER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// User resolution functions
export const getUsersForOrganization = async (organizationID) => {
  try {
    // Check cache first
    if (userCache && userCacheTimestamp && (Date.now() - userCacheTimestamp) < USER_CACHE_DURATION) {
      return userCache[organizationID] || [];
    }

    const usersQuery = query(
      collection(firestore, 'users'),
      where('organizationID', '==', organizationID)
    );
    
    const querySnapshot = await getDocs(usersQuery);
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });

    // Update cache
    if (!userCache) userCache = {};
    userCache[organizationID] = users;
    userCacheTimestamp = Date.now();

    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
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
    console.error('Error resolving user name:', error);
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
    console.error('Error resolving user names:', error);
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
    console.error('Error adding SD card record:', error);
    return { success: false, error: error.message };
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

    const querySnapshot = await getDocs(q);
    const records = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return { success: true, data: records };
  } catch (error) {
    console.error('Error fetching SD card records:', error);
    return { success: false, error: error.message };
  }
};

export const deleteSDCardRecord = async (recordId) => {
  try {
    await deleteDoc(doc(firestore, 'records', recordId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting SD card record:', error);
    return { success: false, error: error.message };
  }
};

// Job Box Operations
export const addJobBoxRecord = async (recordData) => {
  try {
    const record = createJobBoxRecord(recordData);
    const docRef = await addDoc(collection(firestore, 'jobBoxes'), record);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding job box record:', error);
    return { success: false, error: error.message };
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

    const querySnapshot = await getDocs(q);
    const records = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });

    return { success: true, data: records };
  } catch (error) {
    console.error('Error fetching job box records:', error);
    return { success: false, error: error.message };
  }
};

export const deleteJobBoxRecord = async (recordId) => {
  try {
    await deleteDoc(doc(firestore, 'jobBoxes', recordId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting job box record:', error);
    return { success: false, error: error.message };
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
    console.error('Error getting latest SD card statuses:', error);
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
    console.error('Error getting latest job box statuses:', error);
    return { success: false, error: error.message };
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
    console.error('Error searching SD cards:', error);
    return { success: false, error: error.message };
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
    console.error('Error searching job boxes:', error);
    return { success: false, error: error.message };
  }
};