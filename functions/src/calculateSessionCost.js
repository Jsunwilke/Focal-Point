// functions/src/calculateSessionCost.js
// Cloud Function to automatically calculate session costs when sessions are created or updated

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { calculateTotalSessionCost, getWeekStart, getWeekEnd } = require('./utils/costCalculations');

/**
 * Main Cloud Function: Calculate session costs on create/update
 *
 * Triggers: onCreate, onUpdate for 'sessions' collection
 *
 * Logic:
 * 1. Extract session data and photographer ID
 * 2. Fetch photographer data from Firestore
 * 3. Fetch school data from Firestore
 * 4. Fetch all time entries for the week (for accurate OT calculation)
 * 5. Calculate total cost (labor + mileage)
 * 6. Store result in session document
 *
 * For multi-photographer sessions:
 * - Creates cost entry in session.costs array with photographerId
 * - Allows multiple photographers to have different costs for same session
 */

/**
 * Helper function to process session cost calculation
 * @param {admin.firestore.DocumentSnapshot} sessionSnap - Session document snapshot
 * @param {admin.firestore.Firestore} firestore - Firestore instance
 * @returns {Promise<boolean>} True if calculation succeeded
 */
async function processSessionCostCalculation(sessionSnap, firestore) {
  const session = sessionSnap.data();
  const sessionId = sessionSnap.id;

  // Early exit: Skip if session is time off
  if (session.isTimeOff) {
    console.log(`[calculateSessionCost] Skipping time-off session: ${sessionId}`);
    return false;
  }

  // Early exit: Skip if missing required fields
  if (!session.photographerId || !session.schoolId || !session.date || !session.startTime || !session.endTime) {
    console.log(`[calculateSessionCost] Skipping session ${sessionId} - missing required fields`, {
      hasPhotographer: !!session.photographerId,
      hasSchool: !!session.schoolId,
      hasDate: !!session.date,
      hasStartTime: !!session.startTime,
      hasEndTime: !!session.endTime
    });
    return false;
  }

  console.log(`[calculateSessionCost] Processing session ${sessionId} for photographer ${session.photographerId}`);

  try {
    // Fetch photographer data
    const photographerDoc = await firestore.collection('users').doc(session.photographerId).get();
    if (!photographerDoc.exists) {
      console.error(`[calculateSessionCost] Photographer not found: ${session.photographerId}`);
      return false;
    }
    const photographer = {
      id: photographerDoc.id,
      ...photographerDoc.data()
    };

    // Fetch school data
    const schoolDoc = await firestore.collection('schools').doc(session.schoolId).get();
    if (!schoolDoc.exists) {
      console.error(`[calculateSessionCost] School not found: ${session.schoolId}`);
      return false;
    }
    const school = {
      id: schoolDoc.id,
      ...schoolDoc.data()
    };

    // Get week boundaries for time entries query
    const weekStart = getWeekStart(session.date);
    const weekEnd = getWeekEnd(session.date);

    console.log(`[calculateSessionCost] Fetching time entries for week ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

    // Fetch all time entries for this photographer in this week
    // This is needed for accurate OT calculation
    const timeEntriesSnapshot = await firestore
      .collection('timeEntries')
      .where('userId', '==', session.photographerId)
      .where('date', '>=', admin.firestore.Timestamp.fromDate(weekStart))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(weekEnd))
      .get();

    const timeEntries = timeEntriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`[calculateSessionCost] Found ${timeEntries.length} time entries for this week`);

    // Calculate total session cost
    const costData = calculateTotalSessionCost(
      {
        ...session,
        id: sessionId
      },
      photographer,
      school,
      timeEntries
    );

    console.log(`[calculateSessionCost] Calculated cost for session ${sessionId}:`, {
      totalCost: costData.totalCost,
      laborCost: costData.laborCost,
      mileageCost: costData.mileageCost,
      isOvertimeShift: costData.isOvertimeShift
    });

    // Prepare cost entry for multi-photographer support
    const costEntry = {
      photographerId: session.photographerId,
      photographerName: photographer.displayName || `${photographer.firstName} ${photographer.lastName}`,

      // Cost breakdown
      totalCost: costData.totalCost,
      laborCost: costData.laborCost,
      mileageCost: costData.mileageCost,

      // Labor details
      hours: costData.hours,
      regularPay: costData.regularPay,
      overtimePay: costData.overtimePay,
      isOvertimeShift: costData.isOvertimeShift,

      // Distance details
      distance: costData.distance,
      mileageRate: costData.mileageRate,

      // Compensation details
      compensationType: costData.compensationType,
      hourlyRate: costData.hourlyRate,
      salaryAmount: costData.salaryAmount,

      // Metadata
      calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
      calculatedBy: 'server'
    };

    // Update session document with cost data
    // Store in both formats for backward compatibility and multi-photographer support
    const updateData = {
      // Legacy format (for single photographer - primary photographer)
      cost: costData.totalCost,
      costBreakdown: {
        laborCost: costData.laborCost,
        mileageCost: costData.mileageCost,
        distance: costData.distance,
        hours: costData.hours,
        isOvertimeShift: costData.isOvertimeShift
      },

      // New multi-photographer format
      // Uses array union to append cost entry without overwriting other photographers' costs
      costs: admin.firestore.FieldValue.arrayUnion(costEntry),

      // Metadata
      lastCostCalculation: admin.firestore.FieldValue.serverTimestamp()
    };

    await sessionSnap.ref.update(updateData);

    console.log(`[calculateSessionCost] ✅ Successfully updated session ${sessionId} with cost data`);
    return true;

  } catch (error) {
    console.error(`[calculateSessionCost] ❌ Error calculating cost for session ${sessionId}:`, error);
    return false;
  }
}

/**
 * Cloud Function: Trigger on session create
 */
exports.calculateSessionCostOnCreate = functions.firestore
  .document('sessions/{sessionId}')
  .onCreate(async (snap, context) => {
    console.log(`[calculateSessionCostOnCreate] Triggered for new session: ${context.params.sessionId}`);

    const firestore = admin.firestore();
    await processSessionCostCalculation(snap, firestore);
  });

/**
 * Cloud Function: Trigger on session update
 *
 * Only recalculates if relevant fields changed:
 * - photographerId
 * - schoolId
 * - date
 * - startTime
 * - endTime
 */
exports.calculateSessionCostOnUpdate = functions.firestore
  .document('sessions/{sessionId}')
  .onUpdate(async (change, context) => {
    console.log(`[calculateSessionCostOnUpdate] Triggered for session: ${context.params.sessionId}`);

    const before = change.before.data();
    const after = change.after.data();

    // Check if relevant fields changed
    const relevantFieldsChanged =
      before.photographerId !== after.photographerId ||
      before.schoolId !== after.schoolId ||
      before.date !== after.date ||
      before.startTime !== after.startTime ||
      before.endTime !== after.endTime ||
      before.isTimeOff !== after.isTimeOff;

    if (!relevantFieldsChanged) {
      console.log(`[calculateSessionCostOnUpdate] Skipping - no relevant fields changed`);
      return;
    }

    console.log(`[calculateSessionCostOnUpdate] Relevant fields changed, recalculating cost`);

    const firestore = admin.firestore();
    await processSessionCostCalculation(change.after, firestore);
  });
