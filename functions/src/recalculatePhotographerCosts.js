// functions/src/recalculatePhotographerCosts.js
// Cloud Functions to recalculate session costs when photographer or school data changes

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { calculateTotalSessionCost, getWeekStart, getWeekEnd } = require('./utils/costCalculations');

/**
 * Cloud Function: Recalculate costs when photographer compensation changes
 *
 * Triggers when photographer profile is updated with compensation-related changes:
 * - hourlyRate
 * - salaryAmount
 * - compensationType
 * - overtimeThreshold
 * - amountPerMile
 * - homeAddress (affects mileage calculation)
 *
 * Recalculates ALL active sessions for this photographer
 */
exports.recalculatePhotographerCosts = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const userId = context.params.userId;

    // Check if compensation-related fields changed
    const compensationFieldsChanged =
      before.hourlyRate !== after.hourlyRate ||
      before.salaryAmount !== after.salaryAmount ||
      before.compensationType !== after.compensationType ||
      before.overtimeThreshold !== after.overtimeThreshold ||
      before.amountPerMile !== after.amountPerMile ||
      before.homeAddress !== after.homeAddress;

    if (!compensationFieldsChanged) {
      console.log(`[recalculatePhotographerCosts] Skipping user ${userId} - no compensation fields changed`);
      return;
    }

    console.log(`[recalculatePhotographerCosts] Photographer ${userId} compensation changed, recalculating session costs`);

    const firestore = admin.firestore();

    try {
      // Find all active sessions for this photographer
      // "Active" = future sessions or recent past sessions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sessionsSnapshot = await firestore
        .collection('sessions')
        .where('photographerId', '==', userId)
        .where('date', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .get();

      console.log(`[recalculatePhotographerCosts] Found ${sessionsSnapshot.size} sessions to recalculate for photographer ${userId}`);

      if (sessionsSnapshot.empty) {
        console.log(`[recalculatePhotographerCosts] No sessions to recalculate`);
        return;
      }

      const photographer = {
        id: userId,
        ...after
      };

      // Process each session
      const recalculationPromises = sessionsSnapshot.docs.map(async (sessionDoc) => {
        const session = {
          id: sessionDoc.id,
          ...sessionDoc.data()
        };

        // Skip time-off sessions
        if (session.isTimeOff) {
          return null;
        }

        // Skip if missing required fields
        if (!session.schoolId || !session.date || !session.startTime || !session.endTime) {
          console.log(`[recalculatePhotographerCosts] Skipping session ${session.id} - missing required fields`);
          return null;
        }

        try {
          // Fetch school data
          const schoolDoc = await firestore.collection('schools').doc(session.schoolId).get();
          if (!schoolDoc.exists) {
            console.error(`[recalculatePhotographerCosts] School not found: ${session.schoolId}`);
            return null;
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
            .where('userId', '==', userId)
            .where('date', '>=', admin.firestore.Timestamp.fromDate(weekStart))
            .where('date', '<=', admin.firestore.Timestamp.fromDate(weekEnd))
            .get();

          const timeEntries = timeEntriesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Calculate total session cost with new photographer data
          const costData = calculateTotalSessionCost(session, photographer, school, timeEntries);

          // Prepare cost entry
          const costEntry = {
            photographerId: userId,
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
            calculatedBy: 'server-photographer-update'
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

          console.log(`[recalculatePhotographerCosts] ✅ Updated session ${session.id} - new cost: $${costData.totalCost}`);
          return session.id;

        } catch (error) {
          console.error(`[recalculatePhotographerCosts] ❌ Error recalculating session ${session.id}:`, error);
          return null;
        }
      });

      const results = await Promise.all(recalculationPromises);
      const successCount = results.filter(r => r !== null).length;

      console.log(`[recalculatePhotographerCosts] ✅ Recalculated ${successCount}/${sessionsSnapshot.size} sessions for photographer ${userId}`);

    } catch (error) {
      console.error(`[recalculatePhotographerCosts] ❌ Error:`, error);
    }
  });

/**
 * Cloud Function: Recalculate costs when school location changes
 *
 * Triggers when school profile is updated with location changes:
 * - coordinates
 * - schoolAddress
 *
 * Recalculates ALL active sessions for this school
 */
exports.recalculateSchoolCosts = functions.firestore
  .document('schools/{schoolId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const schoolId = context.params.schoolId;

    // Check if location-related fields changed
    const locationFieldsChanged =
      before.coordinates !== after.coordinates ||
      before.schoolAddress !== after.schoolAddress;

    if (!locationFieldsChanged) {
      console.log(`[recalculateSchoolCosts] Skipping school ${schoolId} - no location fields changed`);
      return;
    }

    console.log(`[recalculateSchoolCosts] School ${schoolId} location changed, recalculating session costs`);

    const firestore = admin.firestore();

    try {
      // Find all active sessions for this school
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sessionsSnapshot = await firestore
        .collection('sessions')
        .where('schoolId', '==', schoolId)
        .where('date', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .get();

      console.log(`[recalculateSchoolCosts] Found ${sessionsSnapshot.size} sessions to recalculate for school ${schoolId}`);

      if (sessionsSnapshot.empty) {
        console.log(`[recalculateSchoolCosts] No sessions to recalculate`);
        return;
      }

      const school = {
        id: schoolId,
        ...after
      };

      // Process each session
      const recalculationPromises = sessionsSnapshot.docs.map(async (sessionDoc) => {
        const session = {
          id: sessionDoc.id,
          ...sessionDoc.data()
        };

        // Skip time-off sessions
        if (session.isTimeOff) {
          return null;
        }

        // Skip if missing required fields
        if (!session.photographerId || !session.date || !session.startTime || !session.endTime) {
          console.log(`[recalculateSchoolCosts] Skipping session ${session.id} - missing required fields`);
          return null;
        }

        try {
          // Fetch photographer data
          const photographerDoc = await firestore.collection('users').doc(session.photographerId).get();
          if (!photographerDoc.exists) {
            console.error(`[recalculateSchoolCosts] Photographer not found: ${session.photographerId}`);
            return null;
          }
          const photographer = {
            id: photographerDoc.id,
            ...photographerDoc.data()
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

          // Calculate total session cost with new school location
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
            calculatedBy: 'server-school-update'
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

          console.log(`[recalculateSchoolCosts] ✅ Updated session ${session.id} - new cost: $${costData.totalCost}`);
          return session.id;

        } catch (error) {
          console.error(`[recalculateSchoolCosts] ❌ Error recalculating session ${session.id}:`, error);
          return null;
        }
      });

      const results = await Promise.all(recalculationPromises);
      const successCount = results.filter(r => r !== null).length;

      console.log(`[recalculateSchoolCosts] ✅ Recalculated ${successCount}/${sessionsSnapshot.size} sessions for school ${schoolId}`);

    } catch (error) {
      console.error(`[recalculateSchoolCosts] ❌ Error:`, error);
    }
  });
