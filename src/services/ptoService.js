// src/services/ptoService.js
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  firestore
} from '../services/firestoreWrapper';
import { getAllTimeEntries } from '../firebase/firestore';
import secureLogger from '../utils/secureLogger';
import ptoCacheService from './ptoCacheService';
import { readCounter } from './readCounter';

/**
 * Get or create PTO balance record for a user
 */
export const getPTOBalance = async (userId, organizationID) => {
  try {
    // Check cache first
    const cachedBalances = ptoCacheService.getCachedPTOBalances(organizationID);
    if (cachedBalances) {
      const userBalance = cachedBalances.find(b => b.userId === userId);
      if (userBalance) {
        readCounter.recordCacheHit('ptoBalances', 'getPTOBalance', 1);
        return userBalance;
      }
    }
    readCounter.recordCacheMiss('ptoBalances', 'getPTOBalance');

    // Use predictable document ID to avoid query permission issues
    const balanceId = `${organizationID}_${userId}`;
    const docRef = doc(firestore, 'ptoBalances', balanceId);
    const docSnap = await getDoc(docRef, 'getPTOBalance');
    
    if (!docSnap.exists()) {
      // Create initial balance record with predictable ID
      const initialBalance = {
        userId,
        organizationID,
        totalBalance: 0,
        pendingBalance: 0,
        usedThisYear: 0,
        bankingBalance: 0,
        processedPeriods: [],
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      };
      
      await setDoc(docRef, initialBalance);
      return { id: balanceId, ...initialBalance };
    }
    
    const balance = { id: docSnap.id, ...docSnap.data() };
    
    // Update cache
    if (cachedBalances) {
      ptoCacheService.setCachedPTOBalances(organizationID, [...cachedBalances, balance]);
    } else {
      ptoCacheService.setCachedPTOBalances(organizationID, [balance]);
    }
    
    return balance;
  } catch (error) {
    secureLogger.error('Error getting PTO balance:', error);
    throw error;
  }
};

/**
 * Simple function to add PTO hours to user's balance (for manual adjustments)
 */
export const addPTOHours = async (userId, organizationID, hours, reason = 'Manual adjustment') => {
  try {
    const balance = await getPTOBalance(userId, organizationID);
    
    const updates = {
      totalBalance: Math.max(0, balance.totalBalance + hours),
      lastUpdated: serverTimestamp()
    };
    
    const balanceId = `${organizationID}_${userId}`;
    await updateDoc(doc(firestore, 'ptoBalances', balanceId), updates);
    
    // Clear cache after update
    ptoCacheService.clearPTOBalancesCache(organizationID);
    
    return {
      ...balance,
      ...updates
    };
  } catch (error) {
    secureLogger.error('Error adding PTO hours:', error);
    throw error;
  }
};

/**
 * Process year-end rollover/reset for all users
 */
export const processYearEndPTO = async (organizationID, ptoSettings) => {
  try {
    if (!ptoSettings.enabled) return;
    
    const balancesQuery = query(
      collection(firestore, 'ptoBalances'),
      where('organizationID', '==', organizationID)
    );
    
    const querySnapshot = await getDocs(balancesQuery, 'processYearEndPTO');
    const batch = writeBatch(firestore);
    
    querySnapshot.docs.forEach(balanceDoc => {
      const balance = balanceDoc.data();
      let newBalance = balance.currentBalance;
      
      // Apply rollover policy
      switch (ptoSettings.rolloverPolicy) {
        case 'none':
          newBalance = 0;
          break;
        case 'limited':
          newBalance = Math.min(balance.currentBalance, ptoSettings.rolloverLimit);
          break;
        case 'unlimited':
          // Keep current balance
          break;
      }
      
      // If using yearly allotment, add the yearly amount
      if (ptoSettings.yearlyAllotment > 0) {
        newBalance = Math.min(newBalance + ptoSettings.yearlyAllotment, ptoSettings.maxAccrual);
      }
      
      const updates = {
        currentBalance: newBalance,
        usedThisYear: 0,
        earnedThisYear: ptoSettings.yearlyAllotment > 0 ? ptoSettings.yearlyAllotment : 0,
        lastResetDate: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      batch.update(doc(firestore, 'ptoBalances', balanceDoc.id), updates);
    });
    
    await batch.commit();
    
    secureLogger.info('Year-end PTO processing completed', { organizationID });
  } catch (error) {
    secureLogger.error('Error processing year-end PTO:', error);
    throw error;
  }
};

/**
 * Reserve PTO hours for a pending time off request
 */
export const reservePTOHours = async (userId, organizationID, hours) => {
  try {
    const balance = await getPTOBalance(userId, organizationID);
    
    if (balance.totalBalance < hours) {
      throw new Error('Insufficient PTO balance');
    }
    
    const updates = {
      totalBalance: balance.totalBalance - hours,
      pendingBalance: balance.pendingBalance + hours,
      lastUpdated: serverTimestamp()
    };
    
    const balanceId = `${organizationID}_${userId}`;
    await updateDoc(doc(firestore, 'ptoBalances', balanceId), updates);
    
    // Clear cache after update
    ptoCacheService.clearPTOBalancesCache(organizationID);
    
    return {
      ...balance,
      ...updates
    };
  } catch (error) {
    secureLogger.error('Error reserving PTO hours:', error);
    throw error;
  }
};

/**
 * Use PTO hours when a time off request is approved
 */
export const usePTOHours = async (userId, organizationID, hours) => {
  try {
    const balance = await getPTOBalance(userId, organizationID);
    
    const updates = {
      pendingBalance: Math.max(0, balance.pendingBalance - hours),
      usedThisYear: balance.usedThisYear + hours,
      lastUpdated: serverTimestamp()
    };
    
    const balanceId = `${organizationID}_${userId}`;
    await updateDoc(doc(firestore, 'ptoBalances', balanceId), updates);
    
    // Clear cache after update
    ptoCacheService.clearPTOBalancesCache(organizationID);
    
    return {
      ...balance,
      ...updates
    };
  } catch (error) {
    secureLogger.error('Error using PTO hours:', error);
    throw error;
  }
};

/**
 * Release reserved PTO hours when a time off request is denied or cancelled
 */
export const releasePTOHours = async (userId, organizationID, hours) => {
  try {
    const balance = await getPTOBalance(userId, organizationID);
    
    const updates = {
      totalBalance: balance.totalBalance + hours,
      pendingBalance: Math.max(0, balance.pendingBalance - hours),
      lastUpdated: serverTimestamp()
    };
    
    const balanceId = `${organizationID}_${userId}`;
    await updateDoc(doc(firestore, 'ptoBalances', balanceId), updates);
    
    // Clear cache after update
    ptoCacheService.clearPTOBalancesCache(organizationID);
    
    return {
      ...balance,
      ...updates
    };
  } catch (error) {
    secureLogger.error('Error releasing PTO hours:', error);
    throw error;
  }
};

/**
 * Get PTO balances for all users in an organization
 */
export const getAllPTOBalances = async (organizationID) => {
  try {
    // Check cache first
    const cachedBalances = ptoCacheService.getCachedPTOBalances(organizationID);
    if (cachedBalances) {
      readCounter.recordCacheHit('ptoBalances', 'getAllPTOBalances', cachedBalances.length);
      return cachedBalances;
    }
    readCounter.recordCacheMiss('ptoBalances', 'getAllPTOBalances');

    const balancesQuery = query(
      collection(firestore, 'ptoBalances'),
      where('organizationID', '==', organizationID),
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(balancesQuery, 'getAllPTOBalances');
    const balances = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Cache the results
    ptoCacheService.setCachedPTOBalances(organizationID, balances);
    
    return balances;
  } catch (error) {
    secureLogger.error('Error getting all PTO balances:', error);
    throw error;
  }
};

/**
 * Calculate projected PTO balance based on expected hours
 */
export const calculateProjectedPTO = (currentBalance, ptoSettings, expectedHoursPerPeriod, periods) => {
  if (!ptoSettings.enabled || ptoSettings.yearlyAllotment > 0) {
    return currentBalance;
  }
  
  const { accrualRate, accrualPeriod, maxAccrual } = ptoSettings;
  const ptoEarnedPerPeriod = (expectedHoursPerPeriod / accrualPeriod) * accrualRate;
  const totalProjectedEarning = ptoEarnedPerPeriod * periods;
  
  return Math.min(currentBalance + totalProjectedEarning, maxAccrual);
};

/**
 * Manual PTO adjustment (admin only)
 */
export const adjustPTOBalance = async (userId, organizationID, adjustment, reason, adminId) => {
  try {
    const balance = await getPTOBalance(userId, organizationID);
    
    const newBalance = Math.max(0, balance.currentBalance + adjustment);
    
    const updates = {
      currentBalance: newBalance,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(doc(firestore, 'ptoBalances', balance.id), updates);
    
    // Log the adjustment
    await addDoc(collection(firestore, 'ptoAdjustments'), {
      userId,
      organizationID,
      adjustment,
      reason,
      adminId,
      previousBalance: balance.currentBalance,
      newBalance,
      createdAt: serverTimestamp()
    });
    
    return {
      ...balance,
      ...updates
    };
  } catch (error) {
    secureLogger.error('Error adjusting PTO balance:', error);
    throw error;
  }
};

export default {
  getPTOBalance,
  addPTOHours,
  processYearEndPTO,
  reservePTOHours,
  usePTOHours,
  releasePTOHours,
  getAllPTOBalances,
  calculateProjectedPTO,
  adjustPTOBalance
};