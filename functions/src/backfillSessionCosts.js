// functions/src/backfillSessionCosts.js
// HTTP Callable Function to backfill session costs for existing data

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { calculateTotalSessionCost, getWeekStart, getWeekEnd } = require('./utils/costCalculations');

/**
 * HTTP Callable Function: Backfill session costs
 *
 * Usage from client:
 * const backfill = functions.httpsCallable('backfillSessionCosts');
 * const result = await backfill({ startDate: '2024-01-01', endDate: '2024-12-31', dryRun: false });
 *
 * Parameters:
 * - startDate (optional): YYYY-MM-DD format, defaults to 30 days ago
 * - endDate (optional): YYYY-MM-DD format, defaults to today
 * - dryRun (optional): If true, only counts sessions without updating. Defaults to true.
 * - organizationId (required): Organization ID to backfill
 *
 * Returns:
 * {
 *   success: boolean,
 *   processed: number,
 *   updated: number,
 *   skipped: number,
 *   errors: number,
 *   dryRun: boolean,
 *   details: string[]
 * }
 */
exports.backfillSessionCosts = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Verify admin permissions
  const firestore = admin.firestore();
  const userDoc = await firestore.collection('users').doc(context.auth.uid).get();

  if (!userDoc.exists || !userDoc.data().isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can backfill session costs');
  }

  // Extract parameters
  const {
    startDate,
    endDate,
    dryRun = true,
    organizationId
  } = data;

  if (!organizationId) {
    throw new functions.https.HttpsError('invalid-argument', 'organizationId is required');
  }

  // Parse dates
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const start = startDate
    ? admin.firestore.Timestamp.fromDate(new Date(startDate + 'T00:00:00'))
    : admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

  const end = endDate
    ? admin.firestore.Timestamp.fromDate(new Date(endDate + 'T23:59:59'))
    : admin.firestore.Timestamp.now();

  console.log(`[backfillSessionCosts] Starting backfill for organization ${organizationId}`);
  console.log(`[backfillSessionCosts] Date range: ${start.toDate().toISOString()} to ${end.toDate().toISOString()}`);
  console.log(`[backfillSessionCosts] Dry run: ${dryRun}`);

  const results = {
    success: true,
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    dryRun,
    details: []
  };

  try {
    // Fetch all sessions in date range for this organization
    const sessionsSnapshot = await firestore
      .collection('sessions')
      .where('organizationID', '==', organizationId)
      .where('date', '>=', start)
      .where('date', '<=', end)
      .get();

    console.log(`[backfillSessionCosts] Found ${sessionsSnapshot.size} sessions to process`);
    results.details.push(`Found ${sessionsSnapshot.size} sessions in date range`);

    if (sessionsSnapshot.empty) {
      results.details.push('No sessions to process');
      return results;
    }

    // Process sessions in batches to avoid timeouts
    const BATCH_SIZE = 50;
    const sessions = sessionsSnapshot.docs;

    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
      const batch = sessions.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (sessionDoc) => {
        results.processed++;

        const session = {
          id: sessionDoc.id,
          ...sessionDoc.data()
        };

        // Skip time-off sessions
        if (session.isTimeOff) {
          results.skipped++;
          return { status: 'skipped', reason: 'time-off', sessionId: session.id };
        }

        // Skip if missing required fields
        if (!session.photographerId || !session.schoolId || !session.date || !session.startTime || !session.endTime) {
          results.skipped++;
          return { status: 'skipped', reason: 'missing-fields', sessionId: session.id };
        }

        // Skip if cost already exists (unless forcing recalculation)
        if (session.cost !== undefined && !data.forceRecalculate) {
          results.skipped++;
          return { status: 'skipped', reason: 'has-cost', sessionId: session.id };
        }

        try {
          // Fetch photographer data
          const photographerDoc = await firestore.collection('users').doc(session.photographerId).get();
          if (!photographerDoc.exists) {
            results.errors++;
            return { status: 'error', reason: 'photographer-not-found', sessionId: session.id };
          }
          const photographer = {
            id: photographerDoc.id,
            ...photographerDoc.data()
          };

          // Fetch school data
          const schoolDoc = await firestore.collection('schools').doc(session.schoolId).get();
          if (!schoolDoc.exists) {
            results.errors++;
            return { status: 'error', reason: 'school-not-found', sessionId: session.id };
          }
          const school = {
            id: schoolDoc.id,
            ...schoolDoc.data()
          };

          // Get week boundaries for time entries query
          const weekStart = getWeekStart(session.date);
          const weekEnd = getWeekEnd(session.date);

          // Fetch all time entries for this photographer in this week
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

          // Calculate total session cost
          const costData = calculateTotalSessionCost(session, photographer, school, timeEntries);

          // Prepare cost entry
          const costEntry = {
            photographerId: session.photographerId,
            photographerName: photographer.displayName || `${photographer.firstName} ${photographer.lastName}`,
            totalCost: costData.totalCost,
            laborCost: costData.laborCost,
            mileageCost: costData.mileageCost,
            hours: costData.hours,
            regularPay: costData.regularPay,
            overtimePay: costData.overtimePay,
            isOvertimeShift: costData.isOvertimeShift,
            distance: costData.distance,
            mileageRate: costData.mileageRate,
            compensationType: costData.compensationType,
            hourlyRate: costData.hourlyRate,
            salaryAmount: costData.salaryAmount,
            calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
            calculatedBy: 'server-backfill'
          };

          if (!dryRun) {
            // Update session document
            await sessionDoc.ref.update({
              cost: costData.totalCost,
              costBreakdown: {
                laborCost: costData.laborCost,
                mileageCost: costData.mileageCost,
                distance: costData.distance,
                hours: costData.hours,
                isOvertimeShift: costData.isOvertimeShift
              },
              costs: admin.firestore.FieldValue.arrayUnion(costEntry),
              lastCostCalculation: admin.firestore.FieldValue.serverTimestamp()
            });
          }

          results.updated++;
          return {
            status: 'updated',
            sessionId: session.id,
            cost: costData.totalCost,
            dryRun
          };

        } catch (error) {
          console.error(`[backfillSessionCosts] Error processing session ${session.id}:`, error);
          results.errors++;
          return { status: 'error', reason: error.message, sessionId: session.id };
        }
      });

      await Promise.all(batchPromises);

      console.log(`[backfillSessionCosts] Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sessions.length / BATCH_SIZE)}`);
    }

    results.details.push(`Processed: ${results.processed}`);
    results.details.push(`Updated: ${results.updated}`);
    results.details.push(`Skipped: ${results.skipped}`);
    results.details.push(`Errors: ${results.errors}`);

    console.log(`[backfillSessionCosts] ✅ Completed backfill:`, results);

    return results;

  } catch (error) {
    console.error(`[backfillSessionCosts] ❌ Fatal error:`, error);
    results.success = false;
    results.details.push(`Fatal error: ${error.message}`);
    return results;
  }
});

/**
 * HTTP Callable Function: Recalculate costs for a single session
 *
 * Useful for testing or manual fixes
 *
 * Usage from client:
 * const recalculate = functions.httpsCallable('recalculateSessionCost');
 * const result = await recalculate({ sessionId: 'session123' });
 */
exports.recalculateSessionCost = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { sessionId } = data;

  if (!sessionId) {
    throw new functions.https.HttpsError('invalid-argument', 'sessionId is required');
  }

  console.log(`[recalculateSessionCost] Recalculating cost for session ${sessionId}`);

  const firestore = admin.firestore();

  try {
    // Fetch session
    const sessionDoc = await firestore.collection('sessions').doc(sessionId).get();

    if (!sessionDoc.exists) {
      throw new functions.https.HttpsError('not-found', `Session ${sessionId} not found`);
    }

    const session = {
      id: sessionDoc.id,
      ...sessionDoc.data()
    };

    // Skip time-off sessions
    if (session.isTimeOff) {
      return {
        success: false,
        message: 'Cannot calculate cost for time-off session'
      };
    }

    // Validate required fields
    if (!session.photographerId || !session.schoolId || !session.date || !session.startTime || !session.endTime) {
      throw new functions.https.HttpsError('invalid-argument', 'Session missing required fields');
    }

    // Fetch photographer data
    const photographerDoc = await firestore.collection('users').doc(session.photographerId).get();
    if (!photographerDoc.exists) {
      throw new functions.https.HttpsError('not-found', `Photographer ${session.photographerId} not found`);
    }
    const photographer = {
      id: photographerDoc.id,
      ...photographerDoc.data()
    };

    // Fetch school data
    const schoolDoc = await firestore.collection('schools').doc(session.schoolId).get();
    if (!schoolDoc.exists) {
      throw new functions.https.HttpsError('not-found', `School ${session.schoolId} not found`);
    }
    const school = {
      id: schoolDoc.id,
      ...schoolDoc.data()
    };

    // Get week boundaries for time entries query
    const weekStart = getWeekStart(session.date);
    const weekEnd = getWeekEnd(session.date);

    // Fetch all time entries for this photographer in this week
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

    // Calculate total session cost
    const costData = calculateTotalSessionCost(session, photographer, school, timeEntries);

    // Prepare cost entry
    const costEntry = {
      photographerId: session.photographerId,
      photographerName: photographer.displayName || `${photographer.firstName} ${photographer.lastName}`,
      totalCost: costData.totalCost,
      laborCost: costData.laborCost,
      mileageCost: costData.mileageCost,
      hours: costData.hours,
      regularPay: costData.regularPay,
      overtimePay: costData.overtimePay,
      isOvertimeShift: costData.isOvertimeShift,
      distance: costData.distance,
      mileageRate: costData.mileageRate,
      compensationType: costData.compensationType,
      hourlyRate: costData.hourlyRate,
      salaryAmount: costData.salaryAmount,
      calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
      calculatedBy: 'server-manual-recalculate'
    };

    // Update session document
    await sessionDoc.ref.update({
      cost: costData.totalCost,
      costBreakdown: {
        laborCost: costData.laborCost,
        mileageCost: costData.mileageCost,
        distance: costData.distance,
        hours: costData.hours,
        isOvertimeShift: costData.isOvertimeShift
      },
      costs: admin.firestore.FieldValue.arrayUnion(costEntry),
      lastCostCalculation: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[recalculateSessionCost] ✅ Successfully recalculated session ${sessionId}: $${costData.totalCost}`);

    return {
      success: true,
      sessionId,
      costData: {
        totalCost: costData.totalCost,
        laborCost: costData.laborCost,
        mileageCost: costData.mileageCost,
        hours: costData.hours,
        distance: costData.distance,
        isOvertimeShift: costData.isOvertimeShift
      }
    };

  } catch (error) {
    console.error(`[recalculateSessionCost] ❌ Error:`, error);
    throw error;
  }
});
