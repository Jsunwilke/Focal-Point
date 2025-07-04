# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Standard Workflow
1. First think through the problem, read the codebase for relevant files, and write a plan to todo.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the todo.md file with a summary of the changes you made and any other relevant information.

## Development Commands

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Run linting
npm run lint
npm run lint:fix
```

## Architecture Overview

### Core Technology Stack
- **React 18** with functional components and hooks
- **Firebase** for authentication, Firestore database, and file storage
- **React Router** for client-side routing
- **Lucide React** for icons
- **Bootstrap** for base styling with custom CSS variables

### Application Structure

**Authentication Flow:**
- `AuthProvider` manages global auth state via `AuthContext`
- Firebase Authentication with organization-based multi-tenancy
- Role-based access control (admin, photographer, etc.)
- Protected routes require authentication

**Layout Architecture:**
- `Layout` component contains fixed `Sidebar` and `Header`
- Main content area dynamically loads page components
- Sidebar navigation items defined in `/src/components/layout/Sidebar.js`

**Context Providers:**
- `AuthContext` - user authentication, profile, and organization data
- `JobsContext` - sports job management and data operations
- `ToastContext` - global notification system

**Modal Rendering:**
- Modals use `ReactDOM.createPortal` to render at document.body level
- Critical: Use inline styles for overlay positioning to avoid CSS conflicts
- Modal overlay must have `position: fixed`, `zIndex: 10001`, and flexbox centering
- Inner modal container needs `position: relative`, `margin: 0`, `transform: none`

### Key Modules

**Sports Module (`/src/components/sports/`):**
- Comprehensive sports photography job management
- File upload and roster management with Excel/CSV support
- Real-time job tracking and statistics
- Player search across jobs and rosters

**Firebase Integration:**
- Configuration in `/src/firebase/config.js` with environment variable fallbacks
- Firestore collections: users, organizations, schools, sportsJobs
- File storage for user photos and roster uploads
- Real-time listeners for live data updates

**Styling System:**
- CSS custom properties defined in `/src/styles/variables.css`
- Component-specific CSS files follow naming convention: `ComponentName.css`
- Global styles in `/src/styles/globals.css`
- Sports module has dedicated styling in `/src/styles/sports/`

### Data Flow Patterns

**User Profile Management:**
- User profile linked to organization via `organizationID`
- Profile photos with crop functionality and multiple image formats
- Settings modals for both user profile and studio/organization settings

**Job Management (Sports):**
- Jobs associated with schools and organizations
- Roster data uploaded via Excel/CSV with real-time preview
- Job status tracking (active, completed, archived)
- Search functionality across jobs and player rosters

**File Upload Patterns:**
- User profile photos: original + cropped versions stored
- Roster files: Excel/CSV processing with validation and preview
- All uploads use Firebase Storage with organized folder structure

### CSS Architecture Notes

**Modal Positioning:**
- Always import both `../shared/Modal.css` and component-specific CSS
- Use React portals with `ReactDOM.createPortal(content, document.body)`
- Inline styles required for overlay to override layout constraints

**Layout Constraints:**
- Sidebar has fixed positioning with `--sidebar-width` CSS variable
- Main content area has left margin equal to sidebar width
- Header is fixed height using `--header-height` variable

### Environment Configuration

Firebase configuration supports environment variables:
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_FIREBASE_MEASUREMENT_ID`

Fallback values are provided for development use.