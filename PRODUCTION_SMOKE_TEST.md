# Production Smoke Test Checklist - Workflow System
**Date:** 2025-11-09
**Environment:** Production
**Project:** Focal Point - Workflow Management System

---

## Pre-Deployment Checklist

### ✅ Build & Deploy
- [ ] Run `npm run build` successfully
- [ ] No build errors or warnings
- [ ] Bundle size acceptable (<5MB for main chunk)
- [ ] Source maps generated (if enabled)
- [ ] Environment variables configured
- [ ] Firebase hosting deployed: `firebase deploy --only hosting`
- [ ] Storage rules deployed: `firebase deploy --only storage`
- [ ] Firestore rules deployed: `firebase deploy --only firestore`

### ✅ Configuration
- [ ] Firebase config valid (project ID, API keys)
- [ ] Organization ID configured
- [ ] User roles properly set up
- [ ] Test data available (templates, workflows, tasks)

---

## Critical Path Testing (Must Pass)

### 1. Authentication & Access Control
**Priority:** CRITICAL

- [ ] **Login**: User can log in successfully
- [ ] **Session**: Session persists after refresh
- [ ] **Logout**: User can log out successfully
- [ ] **Role Check**: User role displayed correctly (admin/manager/employee)
- [ ] **Organization**: Organization name displayed correctly

**Pass Criteria:** All authentication flows work without errors

---

### 2. Workflow Overview Page
**Priority:** CRITICAL
**Location:** `/workflows`

- [ ] **Page Load**: Workflows page loads without errors
- [ ] **Loading State**: Spinner shows during initial load
- [ ] **Cache Hit**: Cached workflows display instantly on return visit
- [ ] **Data Display**: Workflows render in matrix view
- [ ] **Empty State**: Shows appropriate message if no workflows
- [ ] **Stats Bar**: Workflow statistics display correctly

**Pass Criteria:** Page loads <2s with cached data, <5s without cache

---

### 3. Workflow Matrix View
**Priority:** CRITICAL

**Template Tabs:**
- [ ] **Tabs Render**: All workflow template tabs display
- [ ] **Tab Switching**: Can switch between templates smoothly
- [ ] **Active Indicator**: Current tab highlighted
- [ ] **Orphaned Workflows**: Alert shows if orphaned workflows exist
- [ ] **Delete Orphaned**: Can delete orphaned workflows with confirmation

**Grid Display:**
- [ ] **Headers**: Column headers (steps) and row headers (workflows) visible
- [ ] **Cells**: All workflow cells render correctly
- [ ] **Progress Indicators**: Step statuses show correct colors
- [ ] **Task Counts**: Task count badges display accurately
- [ ] **Scroll**: Grid scrolls horizontally and vertically smoothly

**Interactions:**
- [ ] **Cell Click**: Clicking cell opens step detail modal
- [ ] **Task Button**: Task creation button visible on cells
- [ ] **Loading States**: Buttons disable during operations
- [ ] **Empty Cells**: Show appropriate empty state

**Pass Criteria:** Matrix displays all workflows correctly, smooth interactions

---

### 4. Workflow Filters
**Priority:** HIGH

- [ ] **Status Filter**: Can filter by active/completed/archived
- [ ] **School Filter**: Can filter by school
- [ ] **Session Type Filter**: Can filter by session type
- [ ] **Date Range Filter**: Can filter by today/week/month
- [ ] **Search**: Can search workflows by name/school
- [ ] **Clear Filters**: Can reset all filters
- [ ] **Filter Combination**: Multiple filters work together

**Pass Criteria:** Filters work correctly, results update immediately

---

### 5. Workflow Step Modal
**Priority:** CRITICAL

**Opening:**
- [ ] **Modal Opens**: Click on cell opens step modal
- [ ] **Focus Management**: Modal receives focus automatically
- [ ] **Escape Key**: ESC key closes modal
- [ ] **Click Outside**: Clicking overlay closes modal

**Content Display:**
- [ ] **Step Title**: Displays correct step name
- [ ] **Description**: Shows step description
- [ ] **Status Badge**: Status displayed with correct color
- [ ] **Tutorial Video**: Video URL displays if set
- [ ] **Dependencies**: Shows prerequisite steps
- [ ] **Tasks**: Lists associated tasks

**Video Player:**
- [ ] **YouTube**: YouTube videos load and play
- [ ] **Vimeo**: Vimeo videos load and play
- [ ] **Direct Video**: MP4/MOV videos load and play
- [ ] **Error Handling**: Invalid URLs show error message
- [ ] **Retry**: Can retry failed video loads
- [ ] **Escape Close**: ESC closes video modal

**Pass Criteria:** Modal opens/closes smoothly, all content displays, videos play

---

### 6. Task Management
**Priority:** CRITICAL

**Task Creation:**
- [ ] **Open Modal**: Create task button opens modal
- [ ] **Pre-filled Data**: Workflow/step data pre-filled
- [ ] **Form Validation**: Required fields validated
- [ ] **Create Task**: Task created successfully
- [ ] **Loading State**: Button shows loading during creation
- [ ] **Success Feedback**: Toast notification on success
- [ ] **Cache Update**: New task appears immediately
- [ ] **Modal Close**: Modal closes after creation

**Task Detail Modal:**
- [ ] **Open**: Clicking task opens detail modal
- [ ] **Display**: All task fields display correctly
- [ ] **Edit**: Can edit task fields
- [ ] **Comments**: Can add comments
- [ ] **Status Change**: Can change task status
- [ ] **Delete**: Can delete task with confirmation
- [ ] **Workflow Link Warning**: Shows warning if task linked to workflow

**Pass Criteria:** Task CRUD operations work correctly, UI updates reflect changes

---

### 7. Workflow Template Gallery
**Priority:** HIGH

**Location:** `/workflows/settings` (admin only)

- [ ] **Page Load**: Template gallery loads
- [ ] **Tabs**: Default/Custom tabs work
- [ ] **Template Cards**: All templates display
- [ ] **Empty State**: Shows if no custom templates
- [ ] **Create Button**: Opens template builder
- [ ] **Edit Template**: Can edit existing template
- [ ] **Delete Template**: Can delete with confirmation
- [ ] **Clone Template**: Can clone default templates

**Pass Criteria:** Template management works, admin can create/edit/delete templates

---

### 8. Workflow Template Builder
**Priority:** HIGH

**Basic Functionality:**
- [ ] **Open**: Template builder opens from gallery
- [ ] **Form Load**: All form fields render
- [ ] **Template Name**: Can enter template name
- [ ] **Description**: Can enter description
- [ ] **Category**: Can select category
- [ ] **Add Step**: Can add new steps
- [ ] **Delete Step**: Can delete steps with confirmation
- [ ] **Reorder Steps**: Can drag to reorder (if implemented)

**Step Editor:**
- [ ] **Step Title**: Can enter step title
- [ ] **Step Type**: Can select step type (action/decision/review)
- [ ] **Description**: Can enter step description
- [ ] **Task Creation Trigger**: Can select trigger type
- [ ] **Timeline Trigger**: Shows days before field if timeline selected
- [ ] **Dependencies**: Can select prerequisite steps
- [ ] **Circular Validation**: Warns about circular dependencies
- [ ] **Tooltip Help**: Tooltips explain triggers and dependencies

**Video Upload:**
- [ ] **Upload Button**: Shows upload video button
- [ ] **File Select**: File picker opens
- [ ] **Preview**: Shows video preview before upload
- [ ] **Upload Progress**: Progress bar shows during upload
- [ ] **Cancel Upload**: Can cancel upload in progress
- [ ] **Loading Overlay**: Form disabled during upload
- [ ] **Success**: Video URL saved to step
- [ ] **Error Handling**: Shows clear error messages
- [ ] **Replace Video**: Can replace existing video
- [ ] **Retry**: Can retry failed uploads

**Save & Exit:**
- [ ] **Validation**: Shows errors if required fields missing
- [ ] **Save**: Can save template successfully
- [ ] **Cancel**: Can cancel with confirmation if changes made
- [ ] **Loading State**: Save button shows loading
- [ ] **Success Feedback**: Toast notification on success
- [ ] **Return**: Returns to gallery after save

**Pass Criteria:** Template builder fully functional, video uploads work, validation works

---

### 9. Accessibility
**Priority:** CRITICAL (WCAG Compliance)

**Keyboard Navigation:**
- [ ] **Tab Order**: Logical tab order through UI
- [ ] **Focus Indicators**: Visible focus indicators on all interactive elements
- [ ] **Escape Key**: ESC closes all modals
- [ ] **Enter/Space**: Activates buttons correctly
- [ ] **Arrow Keys**: Navigate tabs/lists (if applicable)

**Screen Reader:**
- [ ] **Modal Roles**: All modals have role="dialog" or role="alertdialog"
- [ ] **ARIA Labels**: Icon-only buttons have aria-label
- [ ] **Headings**: Proper heading hierarchy (h1→h2→h3)
- [ ] **Alt Text**: All images have alt text
- [ ] **Form Labels**: All form inputs have labels

**Pass Criteria:** Can navigate entire workflow system with keyboard only

---

### 10. Performance
**Priority:** HIGH

**Page Load:**
- [ ] **Initial Load**: <5s for first load
- [ ] **Cached Load**: <2s for return visit
- [ ] **Time to Interactive**: <3s
- [ ] **No Jank**: Smooth scrolling, no UI freezing

**Data Operations:**
- [ ] **Filter Update**: <500ms to apply filters
- [ ] **Task Creation**: <1s to create task
- [ ] **Modal Open**: <100ms to open modals
- [ ] **Tab Switch**: <200ms to switch template tabs

**Memory:**
- [ ] **No Memory Leaks**: Memory stable after 5 minutes of use
- [ ] **Cache Size**: LocalStorage cache <10MB
- [ ] **Network Requests**: Minimal redundant requests

**Pass Criteria:** All interactions feel snappy, no noticeable lag

---

### 11. Error Handling
**Priority:** HIGH

**Network Errors:**
- [ ] **Offline**: Shows appropriate message when offline
- [ ] **Timeout**: Handles slow network gracefully
- [ ] **Failed Request**: Retry option for failed requests
- [ ] **Partial Load**: Handles partial data loads

**Validation Errors:**
- [ ] **Required Fields**: Shows clear error for missing fields
- [ ] **Invalid Data**: Shows error for invalid inputs
- [ ] **File Size**: Warns when file too large
- [ ] **File Type**: Warns when file type invalid

**User Errors:**
- [ ] **Circular Dependencies**: Detects and warns
- [ ] **Orphaned Workflows**: Detects and offers fix
- [ ] **Duplicate Names**: Warns about duplicates
- [ ] **Permission Denied**: Shows clear access denied message

**Pass Criteria:** All errors handled gracefully with clear user messaging

---

### 12. Cache & State Management
**Priority:** HIGH

**Cache Hits:**
- [ ] **Workflows Cache**: Cached workflows load instantly
- [ ] **Templates Cache**: Cached templates load instantly
- [ ] **Tasks Cache**: Cached tasks load instantly
- [ ] **Session Data**: Session data cached properly

**Cache Invalidation:**
- [ ] **After Create**: Cache updates after creating workflow/task
- [ ] **After Update**: Cache updates after editing
- [ ] **After Delete**: Cache clears deleted items
- [ ] **Org Switch**: Cache clears when switching organizations
- [ ] **Manual Clear**: Can clear cache manually (debug function)

**ReadCounter:**
- [ ] **Tracking**: ReadCounter tracks all Firebase reads
- [ ] **Stats Display**: Can view read stats in console
- [ ] **Cache Hit Rate**: >80% cache hit rate for returning users
- [ ] **Cost Monitoring**: Projected costs reasonable

**Pass Criteria:** Cache working correctly, >80% hit rate, low Firebase read counts

---

### 13. Security & Permissions
**Priority:** CRITICAL

**Authentication:**
- [ ] **Unauthenticated**: Redirects to login if not authenticated
- [ ] **Expired Session**: Handles expired sessions gracefully
- [ ] **Token Refresh**: Refreshes auth token automatically

**Authorization:**
- [ ] **Admin Features**: Only admins see template management
- [ ] **Manager Features**: Managers can upload videos
- [ ] **Employee Features**: Employees can create tasks
- [ ] **Organization Isolation**: Users only see their org's data

**Storage Security:**
- [ ] **Video Upload**: Only managers can upload videos
- [ ] **Task Attachments**: Users can upload attachments
- [ ] **File Size Limits**: Enforced by storage rules
- [ ] **File Type Validation**: Enforced by storage rules
- [ ] **Access Control**: Can only access org's files

**Pass Criteria:** All security rules enforced, no unauthorized access

---

### 14. Mobile Responsiveness
**Priority:** MEDIUM

**Layout:**
- [ ] **Small Screen**: UI adapts to mobile screens
- [ ] **Touch Targets**: Buttons large enough for touch
- [ ] **Scroll**: Smooth scrolling on mobile
- [ ] **Modals**: Modals fit on small screens

**Functionality:**
- [ ] **Filters**: Filters work on mobile
- [ ] **Matrix View**: Grid scrolls on mobile
- [ ] **Task Creation**: Can create tasks on mobile
- [ ] **Video Upload**: Can upload videos on mobile

**Pass Criteria:** Core functionality works on mobile devices

---

### 15. Browser Compatibility
**Priority:** MEDIUM

**Browsers to Test:**
- [ ] **Chrome**: Latest version works
- [ ] **Firefox**: Latest version works
- [ ] **Safari**: Latest version works
- [ ] **Edge**: Latest version works

**Features:**
- [ ] **localStorage**: Cache working in all browsers
- [ ] **ES6**: Modern JavaScript features work
- [ ] **CSS**: Styling consistent across browsers
- [ ] **Video Playback**: Videos play in all browsers

**Pass Criteria:** Works in latest Chrome, Firefox, Safari, Edge

---

## Critical Bugs (Blockers)

### Report Any Issues That:
- ❌ **Prevent Login**: Cannot access the application
- ❌ **Data Loss**: User data deleted or corrupted
- ❌ **Complete Failure**: Feature completely non-functional
- ❌ **Security Breach**: Unauthorized access possible
- ❌ **Data Exposure**: User can see other org's data
- ❌ **Cannot Create**: Cannot create workflows/tasks/templates
- ❌ **Cannot Save**: Cannot save changes
- ❌ **UI Broken**: Critical UI elements not rendering

---

## Testing Checklist Summary

### Phase 1: Core Functionality (30 minutes)
1. ✅ Login and authentication
2. ✅ Workflow overview loads
3. ✅ Matrix view displays correctly
4. ✅ Can create tasks
5. ✅ Modals open/close correctly

### Phase 2: Feature Testing (30 minutes)
6. ✅ Filters work
7. ✅ Video player works
8. ✅ Template builder functional
9. ✅ Video upload works
10. ✅ Task management complete

### Phase 3: Quality Testing (20 minutes)
11. ✅ Accessibility (keyboard navigation)
12. ✅ Performance acceptable
13. ✅ Error handling graceful
14. ✅ Cache working correctly

### Phase 4: Security & Polish (20 minutes)
15. ✅ Security rules enforced
16. ✅ Mobile responsive
17. ✅ Browser compatibility
18. ✅ No console errors

**Total Estimated Time:** 100 minutes (1 hour 40 minutes)

---

## Post-Test Actions

### If All Tests Pass:
1. ✅ Mark production deployment as complete
2. ✅ Document test results
3. ✅ Notify stakeholders
4. ✅ Monitor error logs for 24 hours
5. ✅ Create user documentation

### If Tests Fail:
1. ❌ Document failed tests
2. ❌ Create bug tickets
3. ❌ Fix critical blockers
4. ❌ Re-run smoke test
5. ❌ Delay production launch if necessary

---

## Test Results Template

### Date: _____________
### Tester: _____________
### Build Version: _____________

**Overall Result:** ⬜ PASS / ⬜ FAIL

**Tests Passed:** ____ / ____
**Tests Failed:** ____ / ____
**Blockers Found:** ____

**Critical Issues:**
1. _______________________________
2. _______________________________
3. _______________________________

**Minor Issues:**
1. _______________________________
2. _______________________________
3. _______________________________

**Notes:**
_______________________________________
_______________________________________
_______________________________________

**Recommendation:**
⬜ **APPROVED FOR PRODUCTION**
⬜ **NEEDS FIXES BEFORE DEPLOYMENT**
⬜ **MAJOR ISSUES - DO NOT DEPLOY**

---

## Quick Smoke Test (10 minutes)

For rapid validation after hotfixes:

1. ⚡ Login → workflows page loads
2. ⚡ Matrix view displays
3. ⚡ Can create task
4. ⚡ Modal opens/closes
5. ⚡ Video player works
6. ⚡ Template builder loads
7. ⚡ Video upload works
8. ⚡ No console errors
9. ⚡ Cache working
10. ⚡ Can logout

**Pass:** All 10 items work → DEPLOY
**Fail:** Any item fails → INVESTIGATE

---

## Automated Test Commands

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run E2E tests (if configured)
npm run test:e2e

# Build for production
npm run build

# Deploy to Firebase
firebase deploy

# Check bundle size
npm run build -- --analyze
```

---

## Monitoring After Deployment

### First 24 Hours:
- ✅ Monitor Firebase error logs
- ✅ Check ReadCounter stats
- ✅ Monitor user feedback
- ✅ Watch performance metrics
- ✅ Check crash reports

### First Week:
- ✅ Review analytics
- ✅ Check cache hit rates
- ✅ Monitor Firebase costs
- ✅ Gather user feedback
- ✅ Plan optimizations

---

## Emergency Rollback Plan

### If Critical Issue Found:
1. **Immediate:** `firebase hosting:disable`
2. **Rollback:** `firebase deploy --only hosting --version=PREVIOUS`
3. **Notify:** Alert all users of temporary outage
4. **Fix:** Address critical issue in development
5. **Re-test:** Run full smoke test before re-deployment
6. **Deploy:** `firebase deploy` after fixes confirmed

---

## Success Criteria

**Production-Ready When:**
- ✅ All critical tests pass
- ✅ No blockers found
- ✅ Performance acceptable
- ✅ Security rules enforced
- ✅ Accessibility compliant
- ✅ Mobile functional
- ✅ Cross-browser compatible
- ✅ Cache hit rate >80%
- ✅ No console errors
- ✅ Team approval

**Estimated Confidence Level:** _____%

---

## Contact Info

**Developer:** Claude Code Assistant
**Project:** Focal Point
**Repository:** [GitHub URL]
**Firebase Console:** https://console.firebase.google.com/project/focal-point-c452c/overview
**Production URL:** [Production URL]

---

**Last Updated:** 2025-11-09
**Version:** 1.0
**Status:** READY FOR TESTING
