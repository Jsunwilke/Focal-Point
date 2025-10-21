# Session Cost Calculation - Enterprise Architecture

## Document Purpose
This document explains the **server-side cost calculation architecture** for photography sessions. If the implementation conversation gets summarized, use this as the source of truth.

---

## Problem Statement

### Current Implementation (WRONG)
**Location**: `src/pages/Schedule.js` lines 989-1042

**What it does**:
- Calculates session costs **in the browser** using `useMemo`
- Runs `calculateTotalSessionCost()` for every session in view
- Recalculates on every render when sessions/filters/date change

**Problems**:
1. **Performance**: Super laggy with 50+ sessions (500ms+ calculations)
2. **Multi-photographer bug**: Only first photographer gets cost, others show $0
   - Uses `sessionId` for deduplication
   - Multi-photographer sessions have same `sessionId` but different `photographerId`
   - First entry calculates cost, rest are skipped
3. **Not scalable**: Can't handle 100+ sessions
4. **Expensive operations**: OT calculations, time entries processing, distance calculations

### Why Client-Side is Wrong
- ❌ Blocks UI thread during calculation
- ❌ No audit trail (costs recalculated every time)
- ❌ Can't track cost history
- ❌ Wastes bandwidth (fetching all data for calculations)
- ❌ Inconsistent (different users might see different costs)

---

## Enterprise Solution

### Architecture: Server-Side Calculation

```
┌─────────────────────────────────────────────────────────┐
│                    User Action                           │
│  (Create/Update Session, Change Photographer, etc.)     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Firestore Write Event                       │
│         sessions/{sessionId} updated                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           Cloud Function Triggered                       │
│    calculateSessionCost(change, context)                 │
│                                                          │
│  1. Fetch photographer (compensation data)               │
│  2. Fetch school (GPS coordinates)                       │
│  3. Fetch week's time entries (for OT calc)             │
│  4. Calculate using existing utilities                   │
│  5. Write cost back to session document                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Session Document Updated                         │
│  session.cost = { labor, mileage, total, ... }          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Real-time Listener Updates UI                    │
│    Client just displays session.cost (no calc!)         │
└─────────────────────────────────────────────────────────┘
```

---

## Schema Design

### Session Document Structure

```javascript
// Firestore: sessions/{sessionId}
{
  // === Existing Fields ===
  id: "session123",
  date: "2025-01-15",
  startTime: "09:00",
  endTime: "17:00",
  schoolId: "school456",
  schoolName: "Lincoln High",
  photographers: [
    { id: "ph1", name: "John Doe", email: "john@example.com", notes: "" },
    { id: "ph2", name: "Jane Smith", email: "jane@example.com", notes: "" }
  ],

  // === NEW: Cost Storage ===
  costs: [
    {
      // Cost for photographer 1
      photographerId: "ph1",
      labor: 85.50,
      mileage: 12.60,
      total: 98.10,

      // Breakdown
      regularPay: 0,        // Covered by salary
      overtimePay: 85.50,   // OT hours at hourly rate
      isOvertimeShift: true,
      overtimeHours: 2.5,
      regularHours: 5.5,

      // Distance/mileage
      distance: 42.0,       // Round-trip miles
      mileageRate: 0.30,    // Rate at time of calculation

      // Metadata
      compensationType: "salary_with_overtime",
      hourlyRate: 34.20,
      calculatedAt: Timestamp,
      calculatedBy: "cloud-function-v2"
    },
    {
      // Cost for photographer 2
      photographerId: "ph2",
      labor: 0,            // Salaried, within 40h
      mileage: 8.40,       // Lives closer
      total: 8.40,

      regularPay: 0,
      overtimePay: 0,
      isOvertimeShift: false,

      distance: 28.0,
      mileageRate: 0.30,

      compensationType: "salary",
      calculatedAt: Timestamp,
      calculatedBy: "cloud-function-v2"
    }
  ],

  // Single-photographer sessions (legacy support)
  cost: {
    photographerId: "ph1",
    labor: 85.50,
    mileage: 12.60,
    total: 98.10,
    // ... same fields as above
  }
}
```

### Weekly Aggregates (Optional - Phase 2)

```javascript
// Firestore: weeklyTotals/{organizationId}/weeks/{weekId}
{
  organizationId: "org123",
  weekStart: "2025-01-12",  // Sunday
  weekEnd: "2025-01-18",    // Saturday

  photographers: {
    "ph1": {
      totalCost: 850.50,
      laborCost: 640.00,
      mileageCost: 210.50,
      sessions: 8,
      totalHours: 42.5,
      overtimeHours: 2.5,
      overtimePay: 85.50
    },
    "ph2": {
      totalCost: 620.00,
      laborCost: 600.00,
      mileageCost: 20.00,
      sessions: 6,
      totalHours: 38.0,
      overtimeHours: 0,
      overtimePay: 0
    }
  },

  grandTotal: 1470.50,
  totalSessions: 14,
  totalHours: 80.5,

  updatedAt: Timestamp,
  updatedBy: "cloud-function-aggregator"
}
```

---

## Cloud Functions Implementation

### 1. Calculate Session Cost (Main Function)

**File**: `functions/src/calculateSessionCost.js`

**Trigger**: Firestore `onWrite` for `sessions/{sessionId}`

**Logic**:
```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { calculateTotalSessionCost } = require('./utils/costCalculations');

exports.calculateSessionCost = functions.firestore
  .document('sessions/{sessionId}')
  .onWrite(async (change, context) => {
    // === Early exits ===

    // Deleted document
    if (!change.after.exists) {
      return null;
    }

    const newData = change.after.data();

    // Time-off entry, not a session
    if (newData.isTimeOff) {
      return null;
    }

    // Cost already calculated and up-to-date
    if (newData.cost?.calculatedAt > newData.updatedAt) {
      return null;
    }

    // === Fetch required data ===

    const db = admin.firestore();
    const batch = db.batch();

    // Get all photographers for this session
    const photographers = newData.photographers ||
      (newData.photographerId ? [{ id: newData.photographerId }] : []);

    if (photographers.length === 0) {
      console.log('No photographers assigned, skipping cost calculation');
      return null;
    }

    // Fetch school
    const schoolDoc = await db.collection('schools').doc(newData.schoolId).get();
    if (!schoolDoc.exists) {
      console.error('School not found:', newData.schoolId);
      return null;
    }
    const school = { id: schoolDoc.id, ...schoolDoc.data() };

    // Get week boundaries for OT calculation
    const sessionDate = new Date(newData.date + 'T00:00:00');
    const weekStart = getWeekStart(sessionDate);
    const weekEnd = getWeekEnd(sessionDate);

    // === Calculate cost for each photographer ===

    const costs = [];

    for (const photographerRef of photographers) {
      // Fetch photographer details
      const photographerDoc = await db.collection('users')
        .doc(photographerRef.id)
        .get();

      if (!photographerDoc.exists) {
        console.error('Photographer not found:', photographerRef.id);
        continue;
      }

      const photographer = { id: photographerDoc.id, ...photographerDoc.data() };

      // Fetch time entries for the week (for OT calculation)
      const timeEntriesSnap = await db.collection('timeEntries')
        .where('userId', '==', photographerRef.id)
        .where('date', '>=', weekStart)
        .where('date', '<=', weekEnd)
        .get();

      const timeEntries = timeEntriesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate cost using existing utility
      const costData = calculateTotalSessionCost(
        newData,
        photographer,
        school,
        timeEntries
      );

      costs.push({
        photographerId: photographerRef.id,
        ...costData,
        calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
        calculatedBy: 'cloud-function-v2'
      });
    }

    // === Write back to session document ===

    const updateData = {
      costs: costs,
      cost: costs[0] || null,  // Legacy support for single photographer
      lastCostCalculation: admin.firestore.FieldValue.serverTimestamp()
    };

    await change.after.ref.update(updateData);

    console.log(`Calculated costs for ${costs.length} photographer(s) in session ${context.params.sessionId}`);
    return null;
  });

// Helper functions
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (6 - day));
  d.setHours(23, 59, 59, 999);
  return d;
}
```

### 2. Recalculate on Photographer Update

**File**: `functions/src/recalculatePhotographerCosts.js`

**Trigger**: Photographer compensation changed

**Logic**:
```javascript
exports.recalculatePhotographerCosts = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Check if compensation-related fields changed
    const compensationChanged =
      before.compensationType !== after.compensationType ||
      before.hourlyRate !== after.hourlyRate ||
      before.salaryAmount !== after.salaryAmount ||
      before.overtimeThreshold !== after.overtimeThreshold ||
      before.amountPerMile !== after.amountPerMile ||
      before.homeAddress !== after.homeAddress;

    if (!compensationChanged) {
      return null; // No need to recalculate
    }

    console.log(`Compensation changed for ${context.params.userId}, recalculating costs`);

    const db = admin.firestore();

    // Find all sessions for this photographer (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0];

    const sessionsSnap = await db.collection('sessions')
      .where('date', '>=', cutoffDate)
      .get();

    const batch = db.batch();
    let count = 0;

    sessionsSnap.docs.forEach(doc => {
      const session = doc.data();

      // Check if photographer is assigned to this session
      const isAssigned = session.photographers?.some(p => p.id === context.params.userId) ||
                        session.photographerId === context.params.userId;

      if (isAssigned) {
        // Trigger recalculation by updating a dummy field
        batch.update(doc.ref, {
          recalculateCost: admin.firestore.FieldValue.serverTimestamp()
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Triggered recalculation for ${count} sessions`);
    }

    return null;
  });
```

### 3. Recalculate on School Update

**File**: `functions/src/recalculateSchoolCosts.js`

**Trigger**: School address/coordinates changed

**Logic**: Similar to photographer recalculation, but filters by `schoolId`

### 4. Backfill Existing Sessions

**File**: `functions/src/backfillSessionCosts.js`

**Trigger**: HTTPS callable (admin only)

```javascript
exports.backfillSessionCosts = functions.https.onCall(async (data, context) => {
  // Verify admin
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const db = admin.firestore();
  const batchSize = 100;
  const organizationId = data.organizationId;

  // Get all sessions without costs
  const sessionsSnap = await db.collection('sessions')
    .where('organizationId', '==', organizationId)
    .where('cost', '==', null)
    .limit(500)
    .get();

  console.log(`Backfilling ${sessionsSnap.size} sessions`);

  let processed = 0;
  const batch = db.batch();

  for (const doc of sessionsSnap.docs) {
    // Trigger recalculation
    batch.update(doc.ref, {
      recalculateCost: admin.firestore.FieldValue.serverTimestamp()
    });

    processed++;

    // Commit batch every 100 documents
    if (processed % batchSize === 0) {
      await batch.commit();
      console.log(`Processed ${processed}/${sessionsSnap.size}`);
    }
  }

  if (processed % batchSize !== 0) {
    await batch.commit();
  }

  return {
    success: true,
    processed: processed,
    message: `Triggered recalculation for ${processed} sessions`
  };
});
```

### 5. Cost Calculation Utilities (Shared)

**File**: `functions/src/utils/costCalculations.js`

**Note**: Copy existing utilities from `src/utils/sessionCostCalculations.js` and `src/utils/payrollCalculations.js`

This ensures server and client use **same calculation logic** (critical for consistency).

---

## Client-Side Changes

### Schedule.js - Before vs After

**BEFORE** (lines 989-1042):
```javascript
// Heavy calculation in browser
const sessionCostsData = useMemo(() => {
  if (!isAdmin) return null;

  const costs = new Map();
  const photographerTotals = new Map();
  let grandTotal = 0;

  const sessionsInView = filteredSessions.filter(session => {
    const sessionDateStr = session.date;
    const rangeStartStr = formatLocalDate(dateRange.start);
    const rangeEndStr = formatLocalDate(dateRange.end);
    return sessionDateStr >= rangeStartStr && sessionDateStr <= rangeEndStr && !session.isTimeOff;
  });

  // EXPENSIVE: Calculates cost for every session
  sessionsInView.forEach(session => {
    if (costs.has(session.sessionId)) return;

    const photographer = teamMembers.find(m => m.id === session.photographerId);
    if (!photographer) return;

    const school = schools.find(s => s.id === session.schoolId);
    if (!school) return;

    const costData = calculateTotalSessionCost(
      session,
      photographer,
      school,
      timeEntries || []
    );

    costs.set(session.sessionId, costData);

    const currentPhotographerTotal = photographerTotals.get(session.photographerId) || 0;
    photographerTotals.set(session.photographerId, currentPhotographerTotal + costData.totalCost);

    grandTotal += costData.totalCost;
  });

  return { costs, photographerTotals, grandTotal };
}, [filteredSessions, teamMembers, schools, timeEntries, dateRange, isAdmin]);
```

**AFTER**:
```javascript
// Lightweight aggregation - just reading pre-calculated data
const sessionCostsData = useMemo(() => {
  if (!isAdmin) return null;

  const costs = new Map();
  const photographerTotals = new Map();
  let grandTotal = 0;

  const sessionsInView = filteredSessions.filter(session => {
    const sessionDateStr = session.date;
    const rangeStartStr = formatLocalDate(dateRange.start);
    const rangeEndStr = formatLocalDate(dateRange.end);
    return sessionDateStr >= rangeStartStr && sessionDateStr <= rangeEndStr && !session.isTimeOff;
  });

  // FAST: Just reading session.cost (pre-calculated by server)
  sessionsInView.forEach(session => {
    // Multi-photographer sessions: costs is array
    if (Array.isArray(session.costs)) {
      session.costs.forEach(costData => {
        const key = `${session.sessionId}-${costData.photographerId}`;
        costs.set(key, costData);

        const currentTotal = photographerTotals.get(costData.photographerId) || 0;
        photographerTotals.set(costData.photographerId, currentTotal + costData.total);

        grandTotal += costData.total;
      });
    }
    // Single photographer (legacy): cost is object
    else if (session.cost) {
      const key = `${session.sessionId}-${session.photographerId}`;
      costs.set(key, session.cost);

      const currentTotal = photographerTotals.get(session.photographerId) || 0;
      photographerTotals.set(session.photographerId, currentTotal + session.cost.total);

      grandTotal += session.cost.total;
    }
  });

  return { costs, photographerTotals, grandTotal };
}, [filteredSessions, isAdmin]); // Removed teamMembers, schools, timeEntries!
```

### WeekView.js Cost Badge Lookup

**BEFORE**:
```javascript
const costData = sessionCostsData.costs.get(session.sessionId);
```

**AFTER**:
```javascript
// Use composite key for multi-photographer support
const costKey = `${session.sessionId}-${session.photographerId}`;
const costData = sessionCostsData.costs.get(costKey);
```

### SessionDetailsModal.js

**Show both server cost and live preview**:

```javascript
const SessionDetailsModal = ({ session, ... }) => {
  // Server-calculated cost (what's saved)
  const savedCost = session.costs?.find(c => c.photographerId === session.photographerId) || session.cost;

  // Live preview (for editing/what-if scenarios)
  const [previewCost, setPreviewCost] = useState(null);

  // Calculate preview when user changes times, photographer, etc.
  useEffect(() => {
    if (editMode) {
      const photographer = teamMembers.find(m => m.id === editedPhotographerId);
      const school = schools.find(s => s.id === editedSchoolId);

      const preview = calculateTotalSessionCost(
        { ...session, startTime: editedStartTime, endTime: editedEndTime },
        photographer,
        school,
        timeEntries
      );

      setPreviewCost(preview);
    }
  }, [editMode, editedStartTime, editedEndTime, editedPhotographerId]);

  return (
    <div>
      {/* Display mode: show server cost */}
      {!editMode && savedCost && (
        <div className="cost-display">
          <h3>Session Cost</h3>
          <div>Total: ${savedCost.total.toFixed(2)}</div>
          <small>Calculated: {savedCost.calculatedAt?.toDate().toLocaleString()}</small>
        </div>
      )}

      {/* Edit mode: show live preview */}
      {editMode && previewCost && (
        <div className="cost-preview">
          <h3>Estimated Cost (Preview)</h3>
          <div>Total: ${previewCost.total.toFixed(2)}</div>
          <small>Will be recalculated on save</small>
        </div>
      )}
    </div>
  );
};
```

---

## Migration Strategy

### Phase 1: Deploy Cloud Functions (Week 1)

1. **Setup Functions project** (if not exists):
   ```bash
   cd functions
   npm install firebase-functions firebase-admin
   ```

2. **Create function files**:
   - `functions/src/calculateSessionCost.js`
   - `functions/src/recalculatePhotographerCosts.js`
   - `functions/src/recalculateSchoolCosts.js`
   - `functions/src/backfillSessionCosts.js`
   - `functions/src/utils/costCalculations.js`

3. **Deploy (disabled initially)**:
   ```bash
   # Add to functions/index.js but comment out
   firebase deploy --only functions
   ```

### Phase 2: Backfill Existing Data (Week 1)

1. **Enable backfill function**:
   ```javascript
   // functions/index.js
   exports.backfillSessionCosts = require('./src/backfillSessionCosts').backfillSessionCosts;
   ```

2. **Deploy and run**:
   ```bash
   firebase deploy --only functions:backfillSessionCosts

   # Call from Firebase console or CLI
   firebase functions:shell
   > backfillSessionCosts({ organizationId: 'your-org-id' })
   ```

3. **Monitor progress**:
   - Check function logs
   - Verify session documents updated
   - Spot-check calculations

### Phase 3: Enable Triggers (Week 1)

1. **Uncomment functions**:
   ```javascript
   // functions/index.js
   exports.calculateSessionCost = require('./src/calculateSessionCost').calculateSessionCost;
   exports.recalculatePhotographerCosts = require('./src/recalculatePhotographerCosts').recalculatePhotographerCosts;
   exports.recalculateSchoolCosts = require('./src/recalculateSchoolCosts').recalculateSchoolCosts;
   ```

2. **Deploy**:
   ```bash
   firebase deploy --only functions
   ```

3. **Test**:
   - Create a new session → verify cost calculated
   - Update photographer compensation → verify recalculation
   - Check function logs for errors

### Phase 4: Update Client Code (Week 2)

1. **Feature flag approach**:
   ```javascript
   // .env.local
   REACT_APP_USE_SERVER_COSTS=false  // Initially false

   // Schedule.js
   const USE_SERVER_COSTS = process.env.REACT_APP_USE_SERVER_COSTS === 'true';
   ```

2. **Dual-mode implementation**:
   ```javascript
   const sessionCostsData = useMemo(() => {
     if (USE_SERVER_COSTS) {
       return aggregateServerCosts(sessionsInView);  // New way
     } else {
       return calculateClientCosts(sessionsInView);   // Old way
     }
   }, [sessionsInView, USE_SERVER_COSTS]);
   ```

3. **Validation period**:
   - Run both in parallel
   - Log discrepancies
   - Fix bugs
   - Compare performance

### Phase 5: Full Cutover (Week 2)

1. **Enable feature flag**:
   ```javascript
   REACT_APP_USE_SERVER_COSTS=true
   ```

2. **Deploy client**:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

3. **Remove old code** (after 1 week of validation):
   - Delete client-side `calculateTotalSessionCost` calls
   - Remove unused imports
   - Clean up dead code

---

## Testing Strategy

### Unit Tests (Functions)

```javascript
// functions/test/calculateSessionCost.test.js
const test = require('firebase-functions-test')();

describe('calculateSessionCost', () => {
  it('calculates cost for hourly employee', async () => {
    const session = {
      date: '2025-01-15',
      startTime: '09:00',
      endTime: '17:00',
      schoolId: 'school123'
    };

    const photographer = {
      compensationType: 'hourly',
      hourlyRate: 25.00,
      homeAddress: '40.7128,-74.0060'
    };

    const school = {
      coordinates: '40.7589,-73.9851'
    };

    const result = calculateTotalSessionCost(session, photographer, school, []);

    expect(result.laborCost).toBe(200.00); // 8h * $25
    expect(result.mileageCost).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(200.00);
  });

  it('calculates OT for salary+OT employee', async () => {
    // Test OT calculation logic
  });
});
```

### Integration Tests

1. **Create session** → verify cost field populated
2. **Update photographer** → verify costs recalculated
3. **Multi-photographer session** → verify multiple costs
4. **Delete session** → verify no errors

### Performance Tests

```javascript
// Benchmark: 100 sessions in week view
console.time('Load Schedule');
const sessionsData = await getDocs(sessionsQuery);
console.timeEnd('Load Schedule');
// Target: < 200ms

console.time('Calculate Totals');
const totals = aggregateServerCosts(sessionsData);
console.timeEnd('Calculate Totals');
// Target: < 50ms
```

---

## Monitoring & Alerting

### Cloud Function Metrics

Monitor in Firebase Console:
- **Execution count**: Should match session create/update rate
- **Error rate**: Should be < 1%
- **Execution time**: Should be < 5 seconds per session
- **Memory usage**: Should be < 256MB

### Cost Validation

Add validation function:
```javascript
exports.validateCosts = functions.pubsub
  .schedule('every day 00:00')
  .onRun(async (context) => {
    // Find sessions with missing costs
    // Find sessions with stale costs (calculatedAt < updatedAt)
    // Send alert if issues found
  });
```

### Alerts

Set up alerts for:
- ⚠️ Function errors > 10 in 1 hour
- ⚠️ Cost calculation time > 10 seconds
- ⚠️ Sessions without costs > 100

---

## Rollback Plan

If things go wrong:

1. **Immediate**: Flip feature flag
   ```javascript
   REACT_APP_USE_SERVER_COSTS=false
   ```

2. **Short-term**: Disable cloud functions
   ```bash
   # Comment out exports in functions/index.js
   firebase deploy --only functions
   ```

3. **Data integrity**: Costs are additive
   - Server costs don't break old client
   - Old client still works with cached data

---

## Future Enhancements

### Phase 2: Weekly Aggregates
- Pre-calculate weekly totals
- One document read per week (vs 50+ sessions)
- Enable fast reporting/analytics

### Phase 3: Cost Forecasting
- Predict future costs based on schedule
- Budget alerts when over target
- Historical cost trends

### Phase 4: Advanced Reporting
- Cost by school
- Cost by photographer
- Cost by session type
- Export to CSV/Excel

---

## Key Files Reference

### Cloud Functions
- `functions/src/calculateSessionCost.js` - Main cost calculation
- `functions/src/recalculatePhotographerCosts.js` - Photographer update trigger
- `functions/src/recalculateSchoolCosts.js` - School update trigger
- `functions/src/backfillSessionCosts.js` - Backfill existing sessions
- `functions/src/utils/costCalculations.js` - Shared calculation utilities
- `functions/index.js` - Export all functions

### Client
- `src/pages/Schedule.js` - Aggregate server costs (no calculation)
- `src/components/calendar/WeekView.js` - Display costs
- `src/components/calendar/DayView.js` - Display costs
- `src/components/sessions/SessionDetailsModal.js` - Show server cost + preview
- `src/utils/sessionCostCalculations.js` - Client-side utilities (preview only)

### Documentation
- `SESSION_COST_ARCHITECTURE.md` - This file!

---

## Success Criteria

### Performance
- ✅ Schedule loads in < 500ms (currently: 2-3s)
- ✅ Cost updates in background (no UI blocking)
- ✅ Supports 500+ sessions without lag

### Accuracy
- ✅ Multi-photographer sessions: each gets correct cost
- ✅ OT calculations: accurate week-over-week
- ✅ Mileage: reflects real-time distances

### Reliability
- ✅ Audit trail: all costs logged with timestamp
- ✅ Consistency: same calculation every time
- ✅ Recovery: automatic recalculation on data changes

### Developer Experience
- ✅ Simple client code: just display `session.cost`
- ✅ Testable: unit tests for all calculations
- ✅ Maintainable: logic in one place (server)

---

## Timeline

**Total**: 2-3 days focused work

| Phase | Tasks | Time |
|-------|-------|------|
| 1. Functions Setup | Create files, copy utilities | 4 hours |
| 2. Schema Design | Add cost field, test structure | 1 hour |
| 3. Backfill Script | Write and test backfill | 2 hours |
| 4. Client Updates | Remove calculations, read costs | 4 hours |
| 5. Testing | Unit, integration, performance | 3 hours |
| 6. Deployment | Deploy, monitor, validate | 2 hours |
| **Total** | | **16 hours** |

---

## Contact/Questions

If context gets lost and you're resuming implementation:

1. **Read this file first** - it has everything
2. **Check what's deployed**:
   ```bash
   firebase functions:list
   ```
3. **Check migration phase**: Look at feature flags in `.env`
4. **Test existing sessions**: Do they have `cost` field?

---

*Last Updated: 2025-01-18*
*Author: Enterprise Architecture Design*
*Status: Ready for Implementation*
