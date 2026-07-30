# Optimus Mobile App Plan

## Overview

Native mobile app for Optimus — a personal command center. The app connects to the existing Next.js backend API, sharing the same PostgreSQL database and authentication system.

**Sections:** Dashboard, Tasks, Calendar, Notes, Resources, Habits (Routines)

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **React Native + Expo** | Shared JS/React knowledge with web app, single codebase for iOS + Android |
| Navigation | **Expo Router** | File-based routing (mirrors Next.js App Router patterns) |
| Styling | **NativeWind v4** | Tailwind CSS for React Native — reuse design tokens from web |
| State | **Zustand** | Lightweight, no boilerplate, works well with React Native |
| Data Fetching | **TanStack Query (React Query)** | Caching, background refetch, optimistic updates, offline support |
| Rich Text | **10tap-editor** (TipTap-based RN editor) | Compatible with existing TipTap content format |
| Calendar | **react-native-calendars** | Month/week views, customizable theming |
| Drag & Drop | **react-native-draggable-flatlist** | For task reordering, checklist items, day plan blocks |
| Storage | **MMKV** (via react-native-mmkv) | Fast local key-value store for auth tokens, preferences, offline cache |
| Animations | **react-native-reanimated** | Smooth 60fps animations for transitions, gestures |
| Gestures | **react-native-gesture-handler** | Swipe actions on list items, pull-to-refresh |
| Icons | **lucide-react-native** | Same icon set as web app |
| HTTP | **axios** | Same as web app's api.js service layer |

---

## Design System (Ported from Web)

### Color Tokens

The mobile app reuses the exact same color palette from `globals.css`:

```
Brand (Teal):
  brand-50:  #f0fdfa    brand-500: #14b8a6
  brand-100: #ccfbf1    brand-600: #0d9488
  brand-200: #99f6e4    brand-700: #0f766e
  brand-300: #5eead4    brand-800: #115e59
  brand-400: #2dd4bf    brand-900: #134e4a

Neutral (Cool Slate — dark-first):
  neutral-0:   #ffffff    neutral-500: #374151
  neutral-25:  #f7f8fa    neutral-600: #252b37
  neutral-50:  #eef0f4    neutral-700: #1c2130
  neutral-100: #d5d9e2    neutral-800: #151923
  neutral-200: #a1a8b8    neutral-900: #0f1219
  neutral-300: #6b7280    neutral-950: #0a0c10
  neutral-400: #4b5563

Semantic:
  danger:  #f87171 (red-500)     danger-hover:  #ef4444 (red-600)
  success: #34d399 (green-500)   success-hover: #10b981 (green-600)
  warning: #fbbf24 (amber-500)   warning-hover: #f59e0b (amber-600)
  info:    #60a5fa (blue-500)    info-hover:    #3b82f6 (blue-600)

Surface Mapping:
  bg-canvas:          neutral-900 (#0f1219)  — app background
  bg-surface:         neutral-800 (#151923)  — cards, sheets
  bg-surface-raised:  neutral-700 (#1c2130)  — elevated cards, active states
  bg-surface-input:   neutral-800 (#151923)  — text inputs
  border-default:     neutral-600 (#252b37)
  border-light:       neutral-700 (#1c2130)

Text:
  text-heading:     neutral-0   (#ffffff)
  text-body:        neutral-100 (#d5d9e2)
  text-muted:       neutral-300 (#6b7280)
  text-placeholder:  neutral-400 (#4b5563)
  text-disabled:    neutral-500 (#374151)
```

### Typography

```
Font: Inter (via expo-font or @expo-google-fonts/inter)

Display:    32px / 36px / 800 / -0.03em  — page titles
H1:         28px / 34px / 700 / -0.025em — section headers
H2:         22px / 28px / 700 / -0.02em  — card titles
H3:         18px / 24px / 600             — subsection
H4:         16px / 22px / 600             — list group headers
Body:       16px / 26px / 400             — default text
Body-sm:    14px / 22px / 400             — secondary text
Caption:    13px / 18px / 400             — timestamps, metadata
Overline:   12px / 18px / 600 / 0.06em / uppercase — labels
```

### Spacing & Radii

```
Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
Radii:
  sm: 4     md: 6     lg: 10    xl: 14    2xl: 18    full: 9999
```

### Shadows (iOS + Android)

```
Card:     iOS: { shadowOffset: {0,1}, shadowOpacity: 0.2, shadowRadius: 2 }
          Android: elevation: 2
Elevated: iOS: { shadowOffset: {0,4}, shadowOpacity: 0.3, shadowRadius: 8 }
          Android: elevation: 4
Modal:    iOS: { shadowOffset: {0,10}, shadowOpacity: 0.4, shadowRadius: 25 }
          Android: elevation: 8
```

### Component Patterns

```
Button sizes:
  sm: h-32, px-12, text-13
  md: h-40, px-16, text-15 (default)
  lg: h-48, px-20, text-16

Button variants (same as web):
  primary:   bg-brand-500, text-white, active: bg-brand-700
  secondary: bg-neutral-700, border-neutral-600, text-neutral-100
  ghost:     bg-transparent, text-neutral-200, active: bg-neutral-600
  danger:    bg-red-600, text-white

Input: bg-neutral-800, border-neutral-600, focus-border: brand-500, text-white, h-44
Card:  bg-neutral-800, border-neutral-700, radius-xl(14), shadow-card
Badge: radius-full, px-10, py-2, text-12
```

### Animations

```
Timing:
  fast: 120ms   base: 180ms   slow: 300ms
Easing: cubic-bezier(0.22, 1, 0.36, 1) — use Reanimated's Easing.bezier(0.22, 1, 0.36, 1)

Patterns:
  - List items: fade-in + slide-up (8px)
  - Modals: scale-in (0.95 -> 1) + fade
  - Buttons: scale(0.97) on press (tactile)
  - Bottom sheet: slide-up from bottom
  - Screen transitions: horizontal slide (stack), fade (tabs)
```

### Theme Support

The app supports multiple themes (same as web):
- **Default:** Teal accent on cool slate
- **Charcoal Gold:** Amber/gold accent (#f59e0b) on warm charcoal
- **Warm Copper:** Orange accent (#f97316) on earthy warm grays

Theme switching changes the brand color palette. Store selected theme in MMKV and apply via NativeWind CSS variables or a theme context.

---

## Architecture

```
optimus-mobile/
├── app/                          # Expo Router (file-based)
│   ├── _layout.tsx               # Root layout (providers, fonts)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── _layout.tsx
│   ├── (tabs)/                   # Main tab navigator
│   │   ├── _layout.tsx           # Tab bar config
│   │   ├── index.tsx             # Dashboard
│   │   ├── tasks.tsx             # Tasks
│   │   ├── calendar.tsx          # Calendar
│   │   ├── notes.tsx             # Notes
│   │   ├── resources.tsx         # Resources
│   │   └── habits.tsx            # Routines (Checklist + Day Plan)
│   ├── task/[id].tsx             # Task detail (push screen)
│   ├── note/[id].tsx             # Note editor (push screen)
│   ├── resource/[id].tsx         # Resource detail
│   ├── flashcard-study/[id].tsx  # Flashcard study mode
│   └── +not-found.tsx
├── components/
│   ├── ui/                       # Reusable primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx             # Bottom sheet modal
│   │   ├── Toast.tsx
│   │   ├── Spinner.tsx
│   │   ├── Toggle.tsx
│   │   ├── Tabs.tsx
│   │   ├── EmptyState.tsx
│   │   ├── SearchBar.tsx
│   │   └── Avatar.tsx
│   ├── dashboard/
│   │   ├── GreetingHeader.tsx
│   │   ├── TodaysTasksWidget.tsx
│   │   ├── UpcomingEventsWidget.tsx
│   │   ├── WeeklyPulseWidget.tsx
│   │   └── QuickCaptureCard.tsx
│   ├── tasks/
│   │   ├── TaskListItem.tsx      # Swipeable row
│   │   ├── TaskQuickAdd.tsx
│   │   ├── TaskFilters.tsx
│   │   └── SubtaskList.tsx
│   ├── calendar/
│   │   ├── MonthView.tsx
│   │   ├── DayView.tsx
│   │   ├── EventCard.tsx
│   │   └── EventForm.tsx
│   ├── notes/
│   │   ├── NoteListItem.tsx
│   │   ├── NoteEditor.tsx        # 10tap-editor wrapper
│   │   └── NotebookPicker.tsx
│   ├── resources/
│   │   ├── ResourceCard.tsx
│   │   ├── FlashcardDeckCard.tsx
│   │   ├── FlashcardStudy.tsx    # Full-screen flip cards
│   │   └── ReadingListItem.tsx
│   └── habits/
│       ├── ChecklistToday.tsx
│       ├── ChecklistHistory.tsx
│       ├── DayPlanTimeline.tsx
│       └── DayPlanBlockCard.tsx
├── services/
│   └── api.ts                    # Port of web's api.js (same endpoints)
├── stores/
│   ├── authStore.ts              # Zustand — auth state + token
│   └── themeStore.ts             # Zustand — theme preference
├── hooks/                        # TanStack Query hooks (mirror web hooks)
│   ├── useTasks.ts
│   ├── useNotes.ts
│   ├── useEvents.ts
│   ├── useResources.ts
│   ├── useFlashcards.ts
│   ├── useReadingList.ts
│   ├── useChecklist.ts
│   ├── useDayPlan.ts
│   └── useDashboard.ts
├── lib/
│   ├── theme.ts                  # Color tokens, typography, spacing
│   ├── queryClient.ts            # TanStack Query config
│   └── utils.ts                  # Date formatting, helpers
└── assets/
    └── fonts/
```

---

## Navigation Structure

```
Bottom Tab Bar (5 tabs + More):
┌─────────┬─────────┬──────────┬─────────┬──────────┐
│  Home   │  Tasks  │ Calendar │  Notes  │   More   │
└─────────┴─────────┴──────────┴─────────┴──────────┘

"More" tab opens a screen with:
  - Resources (Study Resources / Flashcards / Reading List)
  - Routines (Checklist / Day Plan)
  - Settings

Stack screens (pushed on top of tabs):
  - Task detail
  - Note editor
  - Flashcard study mode
  - Event detail
```

Tab bar styling:
- Background: neutral-900 with top border (neutral-700)
- Active icon: brand-500 (teal)
- Inactive icon: neutral-400
- Labels: 11px, medium weight
- Height: 56px (plus safe area)

---

## Screen Specifications

### 1. Dashboard (Home Tab)

**Layout:** Scrollable vertical list of widget cards

**Widgets:**
1. **Greeting Header** — "Good morning, Siddharth" + date + weather icon (optional)
2. **Today's Tasks** — Top 5 tasks due today, checkbox toggle, "View all" link
3. **Upcoming Events** — Next 3 events with time + calendar color dot
4. **Weekly Pulse** — Tasks completed this week (bar chart or ring), streak count
5. **Quick Capture** — Text input that creates a task or note (single tap)

**Interactions:**
- Pull-to-refresh all widgets
- Tap task → navigate to task detail
- Tap event → navigate to calendar day view
- Quick capture: keyboard opens inline, submit creates task

---

### 2. Tasks

**Default View:** Flat list grouped by status sections

**Sections:**
1. **Quick Add Bar** (pinned top) — text input + priority picker + submit
2. **Active Tasks** — Grouped: In Progress → To Do (sorted by position/priority)
3. **Deferred (Later)** — Collapsed section, expandable
4. **Completed** — Last 10, collapsed by default

**List Item:**
- Checkbox (left) + title + priority dot (colored) + due date badge (right)
- Swipe right: complete
- Swipe left: defer / delete
- Long press: drag to reorder
- Tap: push to Task Detail screen

**Task Detail Screen (push):**
- Title (editable)
- Status picker (segmented control: todo / in_progress / on_hold / done)
- Priority picker (segmented: low / medium / high / urgent)
- Due date (date picker)
- Project (picker from existing projects)
- Description (multiline text)
- Subtasks (inline add + toggle)
- Actions: Archive, Delete (destructive, confirm)

**Filters (horizontal chip row below quick add):**
- All, Today, Upcoming, High Priority, By Project

---

### 3. Calendar

**Default View:** Month view with dot indicators for events

**Month View:**
- Calendar grid (react-native-calendars)
- Dots under dates that have events (colored by calendar)
- Tap date → shows day's events in a bottom list
- Tap event → event detail bottom sheet

**Day View (push or expand):**
- Timeline view (hourly slots)
- Event blocks positioned by time, colored by calendar
- Tap empty slot → create event
- Tap event → edit event bottom sheet

**Event Form (bottom sheet):**
- Title
- Start time / End time (time pickers)
- All day toggle
- Calendar picker (colored circles)
- Location (text)
- Description (text)
- Save / Delete

**Header:** Month/Year title, left/right arrows, "Today" button

---

### 4. Notes

**Default View:** List of notes (sorted by last updated)

**List Screen:**
- Search bar (top)
- Tabs: All | Journals | Pinned
- Note cards: title + first line preview + notebook name + timestamp
- Tap → push to editor
- Swipe left: pin / delete
- FAB: + New Note

**Editor Screen (push):**
- Back button (auto-saves)
- Title input (large, bold)
- Notebook picker (chip/dropdown)
- Rich text editor (10tap-editor):
  - Toolbar: Bold, Italic, Heading, List, Checkbox, Code, Link
  - Full TipTap content compatibility (JSON format)
- Auto-save indicator ("Saved" / "Saving...")
- Overflow menu: Pin, Delete, Move to notebook

**Journal Mode:**
- Calendar date picker at top
- Creates/opens journal entry for selected date
- Uses journal template if new

---

### 5. Resources

**Tabbed Screen:** Study Resources | Flashcards | Reading List

#### Tab: Study Resources
- Grid/list of resource cards
- Filter chips: All, PDF, DOC, Image, Link, Other
- Card: icon (by type) + title + notes preview
- Tap: open URL or view detail
- FAB: + Add Resource

#### Tab: Flashcards
- Grid of deck cards (name + card count + due-for-review count)
- Tap deck → Study screen (push)
- **Study Screen:**
  - Full-screen card with flip animation (Reanimated)
  - Front → tap/swipe to flip → Back
  - Rating buttons: Again / Hard / Good / Easy (spaced repetition)
  - Progress bar (cards remaining)
  - Swipe right: next card
- FAB: + New Deck

#### Tab: Reading List
- List items: title + URL domain + status badge + progress bar
- Tap: open URL in in-app browser
- Swipe: change status (unread → reading → completed)
- Progress slider on detail

---

### 6. Habits (Routines)

**Tabbed Screen:** Checklist | Day Plan

#### Tab: Checklist (Today)
- Sections with collapsible headers
- Checkbox items within each section
- Completion percentage at top (circular progress)
- Toggle: Today | Week | Month view
- **Week view:** 7-column grid showing completion dots per day
- **Month view:** 30-day heatmap style grid
- Tap item: toggle completion
- Long press: edit item
- FAB: + Add Item (with section picker)

#### Tab: Day Plan
- Timeline view (vertical, scrollable)
- Time blocks: colored cards with title + time range
- Tap block: edit (bottom sheet)
- Long press + drag: reorder
- FAB: + Add Block (title, start time, end time, color)
- Daily status/mood at top (optional)

---

## API Integration

The mobile app connects to the **same backend** as the web app. The base URL points to the deployed Next.js API.

```
Base URL: https://<your-domain>/api
Auth: Cookie-based (optimus_token) — for mobile, use Authorization header with JWT token stored in MMKV
```

**Adaptation needed on backend:**
- Add `Authorization: Bearer <token>` header support alongside cookie auth (check both in middleware)
- This is a single-line change in the existing auth middleware

**Services to port (from web `src/services/api.js`):**
- `authService` — login, signup, logout, me, profile
- `taskService` — CRUD, subtasks, bulk reorder, dependencies
- `eventService` — CRUD (with calendar_id)
- `calendarService` — CRUD
- `noteService` — CRUD (with notebook_id)
- `notebookService` — CRUD
- `resourceService` — CRUD
- `flashcardDeckService` — CRUD, cards, review
- `readingListService` — CRUD
- `checklistService` — sections, items, toggle, history
- `dayPlanService` — blocks CRUD, reorder, status
- `dashboardService` — stats, indicators

---

## Offline Strategy

**Phase 1 (MVP):** Online-only with graceful error states
- Show cached data from TanStack Query while refetching
- "No connection" banner when offline
- Queue failed mutations for retry

**Phase 2:** Basic offline support
- Cache task list, today's events, checklist in MMKV
- Offline task completion + checklist toggles
- Sync queue when back online

---

## Push Notifications (Future)

- Task due date reminders
- Morning review prompt
- Habit streak reminders
- Event start notifications

Requires: Expo Notifications + backend push token storage + notification scheduler

---

## Build & Deployment

```
Development:    npx expo start (Expo Go or dev client)
iOS Build:      eas build --platform ios
Android Build:  eas build --platform android
OTA Updates:    eas update (Expo Updates for instant JS patches)
```

---

## Implementation Phases

### Phase 1 — Foundation (Week 1-2)
- [ ] Expo project setup with Expo Router
- [ ] NativeWind v4 + theme tokens from design system
- [ ] Auth flow (login screen, token storage, protected routes)
- [ ] API service layer (port from web)
- [ ] Tab navigation + basic screen shells
- [ ] UI component library (Button, Input, Card, Badge, Modal, Toast)

### Phase 2 — Core Screens (Week 3-4)
- [ ] Dashboard with widgets
- [ ] Tasks list + quick add + task detail
- [ ] Calendar month view + day event list
- [ ] Notes list + rich text editor

### Phase 3 — Extended Screens (Week 5-6)
- [ ] Resources (study resources + flashcards with study mode + reading list)
- [ ] Habits — Checklist today + history views
- [ ] Habits — Day Plan timeline

### Phase 4 — Polish (Week 7-8)
- [ ] Swipe actions on list items
- [ ] Drag-to-reorder (tasks, checklist, day plan)
- [ ] Pull-to-refresh everywhere
- [ ] Smooth animations and transitions
- [ ] Error states, empty states, loading skeletons
- [ ] Haptic feedback on key actions

### Phase 5 — Ship
- [ ] App icon + splash screen (dark, brand teal accent)
- [ ] EAS build setup (iOS + Android)
- [ ] TestFlight / internal testing
- [ ] App Store + Play Store submission

---

## API Reference

**Base URL:** `https://optimus.lancehawks.com/api`

**Authentication:** All endpoints (except account creation and login) require a valid opaque session token.
- Web: `optimus_token` cookie (`HttpOnly`, `Secure` in production, `SameSite=Lax`)
- Mobile: `Authorization: Bearer <token>` header. Mobile authentication requests also send `X-Optimus-Client: mobile`.
- Session tokens expire after seven days and are stored in PostgreSQL only as SHA-256 hashes.

**Conventions:**
- Request bodies use **camelCase** (`notebookId`, `fileUrl`, `dueDate`)
- Response objects use **snake_case** (`notebook_id`, `file_url`, `due_date`)
- All timestamps are ISO 8601 strings
- All IDs are UUID strings (except checklist/day-plan which use integer IDs)
- Errors return `{ "error": "message" }` with appropriate HTTP status

---

### Auth

#### POST /api/auth/signup
Create a new account.
```
Request:
{
  "email": string,          // required
  "password": string,       // required, min 8 chars
  "fullName": string        // required
}

Response 201:
{
  "user": {
    "id": string,
    "email": string,
    "full_name": string,
    "avatar_url": string | null,
    "timezone": string | null,
    "preferences": object | null
  }
}
```
Sets `optimus_token` cookie (7-day session).

With `X-Optimus-Client: mobile`, the response additionally includes:
```
{
  "token": string,
  "expiresAt": timestamp
}
```

#### POST /api/auth/login
```
Request:
{
  "email": string,          // required
  "password": string        // required
}

Response 200:
{
  "user": {
    "id": string,
    "email": string,
    "full_name": string,
    "avatar_url": string | null,
    "timezone": string | null,
    "preferences": object | null
  }
}
```
Sets `optimus_token` cookie (7-day session).

With `X-Optimus-Client: mobile`, the response additionally includes:
```
{
  "token": string,
  "expiresAt": timestamp
}
```

#### POST /api/auth/refresh
Atomically rotate a valid mobile session token before it expires. Requires both `X-Optimus-Client: mobile` and `Authorization: Bearer <current-token>`. The previous token is invalid immediately after a successful response. This endpoint does not modify browser cookies.
```
Response 200:
{
  "token": string,
  "expiresAt": timestamp
}
```
Returns `401` when the token is missing, expired, revoked, or already rotated. Non-mobile requests receive `404`.

#### POST /api/auth/logout
No body required. Clears session and cookie.
```
Response 200:
{ "message": "Logged out successfully" }
```

#### DELETE /api/auth/account
Permanently delete the authenticated account. This endpoint never accepts a
user ID; it requires the current password and exact destructive confirmation.
```
Request:
{
  "currentPassword": string,
  "confirmation": "DELETE MY ACCOUNT"
}

Response 200:
{ "message": "Account deleted successfully" }
```
The transaction revokes all sessions, push registrations, Google credentials,
OAuth flows, and private data. Shared projects transfer to the
longest-standing active remaining member, including project-linked content;
projects without another active member are deleted. Shared activity remains
with an anonymous actor. The response is non-cacheable. Web responses expire
the auth cookie; explicit mobile responses do not emit a cookie.

The same workflow is publicly documented and available at
`GET /account-deletion`; unauthenticated visitors receive a sign-in path.

#### POST /api/notifications/devices
Register or refresh an authenticated mobile app installation for Expo push delivery.
```
Request:
{
  "token": string,          // ExponentPushToken[...] or ExpoPushToken[...]
  "platform": "ios" | "android",
  "deviceId": string,       // stable per-installation identifier
  "deviceName": string,     // optional
  "appVersion": string      // optional
}

Response 200:
{
  "device": {
    "id": string,
    "platform": "ios" | "android",
    "deviceId": string,
    "deviceName": string | null,
    "appVersion": string | null,
    "lastSeenAt": timestamp,
    "createdAt": timestamp
  }
}
```
The response never returns the Expo push token. Each registration is bound to
the exact authenticated session: token refresh preserves the binding, while
logout, remote session revocation, password-reset revocation, or account
deletion removes it automatically. Expired sessions cannot receive delivery.
Lock-screen title and body are generic; full content is loaded only after
authenticated app resume.

#### DELETE /api/notifications/devices
Unregister the authenticated user's app installation before logout, account switching, or disabling push.
```
Request:
{ "deviceId": string }

Response 200:
{ "removed": boolean }
```

#### GET /api/auth/me
Returns the currently authenticated user.
```
Response 200:
{
  "user": { "id", "email", "full_name", "avatar_url", "timezone", "preferences" }
}
```

#### PUT /api/auth/profile
Update profile. To change password, both `currentPassword` and `newPassword` are required.
```
Request:
{
  "fullName": string,           // optional
  "timezone": string,           // optional
  "preferences": object,        // optional
  "currentPassword": string,    // required if changing password
  "newPassword": string         // min 8 chars
}

Response 200:
{
  "user": { "id", "email", "full_name", "avatar_url", "timezone", "preferences" }
}
```

#### GET /api/auth/sessions
List all active sessions for current user.
```
Response 200:
{
  "sessions": [
    {
      "id": string,
      "device_info": string | null,
      "ip_address": string | null,
      "created_at": timestamp,
      "expires_at": timestamp,
      "is_current": boolean
    }
  ]
}
```

#### DELETE /api/auth/sessions/{sessionId}
Revoke a specific session.
```
Response 200:
{ "message": "Session revoked" }
```

#### POST /api/auth/forgot-password
Always returns success (prevents email enumeration).
```
Request:
{ "email": string }

Response 200:
{ "message": "If an account exists with that email, a password reset link has been sent." }
```

#### POST /api/auth/reset-password
```
Request:
{
  "token": string,      // reset token from email
  "password": string     // min 8 chars
}

Response 200:
{ "message": "Password reset successfully. Please sign in." }
```

---

### Tasks

#### GET /api/tasks
List tasks with filtering and sorting.
```
Query Params:
  status        string    Filter by status (todo, in_progress, on_hold, done)
  priority      string    Filter by priority (low, medium, high, urgent)
  search        string    Search title & description (ILIKE)
  project_id    string    Filter by project
  include_archived  "true"|"false"  Include archived tasks (default: false)
  sort          string    "position"|"due_date"|"priority"|"created_at"|"title" (default: "position")
  order         string    "asc"|"desc" (default: "asc")

Response 200:
{
  "tasks": [
    {
      "id": string,
      "user_id": string,
      "title": string,
      "description": string | null,
      "status": "todo" | "in_progress" | "on_hold" | "done",
      "priority": "low" | "medium" | "high" | "urgent",
      "due_date": date | null,
      "project_id": string | null,
      "position": number,
      "recurrence_rule": string | null,
      "deferred": boolean,
      "is_archived": boolean,
      "parent_task_id": null,
      "created_at": timestamp,
      "updated_at": timestamp,
      "project_name": string | null,
      "project_color": string | null,
      "tags": [{ "id": string, "name": string, "color": string }],
      "subtask_count": number,
      "subtask_done_count": number,
      "dependency_count": number,
      "blocking_count": number
    }
  ]
}
```
Only returns top-level tasks (parent_task_id IS NULL).

#### POST /api/tasks
Create a new task.
```
Request:
{
  "title": string,              // required
  "description": string,        // optional
  "status": string,             // default: "todo"
  "priority": string,           // default: "medium"
  "dueDate": date,              // optional
  "projectId": string,          // optional
  "tags": [string],             // optional, array of tag IDs
  "recurrenceRule": string      // optional, "daily"|"weekly"|"monthly"
}

Response 201:
{
  "task": {
    "id", "user_id", "title", "description", "status", "priority",
    "due_date", "project_id", "position", "recurrence_rule",
    "deferred", "is_archived", "parent_task_id", "created_at", "updated_at"
  }
}
```

#### GET /api/tasks/:id
Get task with subtasks and dependencies.
```
Response 200:
{
  "task": {
    ...taskFields,
    "tags": [{ "id", "name", "color" }],
    "subtasks": [{ ...taskFields }],
    "dependencies": [{ "id", "title", "status" }]
  }
}
```

#### PUT /api/tasks/:id
Update a task. All fields optional.
```
Request:
{
  "title": string,
  "description": string,
  "status": string,
  "priority": string,
  "dueDate": date,
  "projectId": string,
  "position": number,
  "recurrenceRule": string,
  "deferred": boolean,
  "isArchived": boolean,
  "tags": [string],             // replaces all tags
  "dependencies": [string]      // replaces all dependencies
}

Response 200:
{ "task": { ...updatedTask, "tags": [...] } }
```
When status changes to "done" and task has a recurrenceRule, a new recurring task is auto-created.

#### DELETE /api/tasks/:id
```
Response 200:
{ "message": "Task deleted" }
```

#### POST /api/tasks/bulk
Bulk operations on multiple tasks.
```
Request:
{
  "action": "complete" | "delete" | "update_status" | "archive" | "reorder",
  "taskIds": [string],          // required for all except "reorder"
  "status": string,             // required if action = "update_status"
  "tasks": [                    // required if action = "reorder"
    { "id": string, "position": number }
  ]
}

Response 200:
{ "message": "5 tasks completed" }
```

#### POST /api/tasks/:id/subtasks
Create a subtask under a parent task.
```
Request:
{ "title": string }

Response 201:
{ "subtask": { ...taskFields, "parent_task_id": string, "status": "todo" } }
```

#### PUT /api/tasks/:id/subtasks
Update a subtask.
```
Request:
{
  "subtaskId": string,      // required
  "title": string,          // optional
  "status": string          // optional
}

Response 200:
{ "subtask": { ...subtaskFields } }
```

#### GET /api/tasks/:id/dependencies
```
Response 200:
{
  "dependencies": [{ "id": string, "title": string, "status": string, "priority": string }]
}
```

#### PUT /api/tasks/:id/dependencies
Replace all dependencies for a task.
```
Request:
{ "dependencies": [string] }   // array of task IDs

Response 200:
{
  "dependencies": [{ "id", "title", "status", "priority" }]
}
```

---

### Calendars

#### GET /api/calendars
List all user calendars.
```
Response 200:
{
  "calendars": [
    {
      "id": string,
      "user_id": string,
      "name": string,
      "color": string,
      "is_default": boolean,
      "is_google": boolean | null,
      "google_calendar_id": string | null,
      "created_at": timestamp,
      "updated_at": timestamp
    }
  ]
}
```

#### POST /api/calendars
```
Request:
{
  "name": string,       // required
  "color": string       // optional, default: "#6366f1"
}

Response 201:
{ "calendar": { ...calendarFields } }
```

#### GET /api/calendars/:id
```
Response 200:
{ "calendar": { ...calendarFields } }
```

#### PUT /api/calendars/:id
```
Request:
{
  "name": string,           // optional
  "color": string,          // optional
  "is_default": boolean     // optional — if true, unsets all others
}

Response 200:
{ "calendar": { ...calendarFields } }
```

#### DELETE /api/calendars/:id
Cannot delete the user's only calendar.
```
Response 200:
{ "message": "Calendar deleted" }

Error 400:
{ "error": "Cannot delete your only calendar" }
```

---

### Events

#### GET /api/events
List events in a date range. Expands recurring events into virtual instances.
```
Query Params:
  start         ISO8601 string    required — range start
  end           ISO8601 string    required — range end
  calendar_id   string            optional — filter by calendar

Response 200:
{
  "events": [
    {
      "id": string,
      "user_id": string,
      "calendar_id": string,
      "title": string,
      "description": string | null,
      "location": string | null,
      "start_time": ISO8601,
      "end_time": ISO8601,
      "all_day": boolean,
      "recurrence_rule": string | null,
      "google_event_id": string | null,
      "calendar_color": string,
      "calendar_name": string,
      "created_at": timestamp,
      "updated_at": timestamp,
      "linked_tasks": [
        { "id": string, "title": string, "status": string, "priority": string }
      ]
    }
  ]
}
```

#### POST /api/events
```
Request:
{
  "title": string,              // required
  "description": string,        // optional
  "location": string,           // optional
  "start_time": ISO8601,        // required
  "end_time": ISO8601,          // required
  "all_day": boolean,           // optional, default: false
  "recurrence_rule": string,    // optional, iCalendar RRULE format
  "calendar_id": string,        // optional, uses default calendar
  "task_ids": [string]          // optional, link tasks to event
}

Response 201:
{ "event": { ...eventFields, "linked_tasks": [...] } }
```

#### GET /api/events/:id
```
Response 200:
{ "event": { ...eventFields, "linked_tasks": [...] } }
```

#### PUT /api/events/:id
All fields optional.
```
Request:
{
  "title": string,
  "description": string | null,
  "location": string | null,
  "start_time": ISO8601,
  "end_time": ISO8601,
  "all_day": boolean,
  "recurrence_rule": string | null,
  "calendar_id": string,
  "task_ids": [string]
}

Response 200:
{ "event": { ...eventFields, "linked_tasks": [...] } }
```

#### DELETE /api/events/:id
```
Response 200:
{ "message": "Event deleted" }
```

---

### Google Calendar Integration

#### GET /api/google/auth
Returns a PKCE-protected Google OAuth URL with opaque, one-time state.
```
Web response 200:
{ "url": string }

Mobile request headers:
X-Optimus-Client: mobile
Authorization: Bearer <session-token>

Mobile response 200:
{
  "url": string,
  "expiresAt": timestamp
}
```
Password changes are rate limited and transactionally revoke every session
except the exact authenticated session making the request. The current opaque
credential remains valid, so the response shape is unchanged.

#### GET /api/google/callback
Google redirects to this server handler. The mobile app does not call it directly.

- Web success redirects to `/calendar?google=connected&sync=queued`.
- Mobile success redirects to the fixed, server-configured HTTPS App/Universal Link:
  `/mobile/oauth/google?status=connected`.
- Mobile failure uses `status=error` and one fixed reason: `access_denied`,
  `connection_failed`, `invalid_state`, or `oauth_error`.

Mobile redirects never contain a session token, Google token, user ID,
authorization code, state, or arbitrary client return URL. On resume, the app
must verify completion through authenticated `GET /api/google/status`.

The HTTPS origin also serves the native association documents:

- `GET /.well-known/apple-app-site-association`, built at runtime from
  `MOBILE_APPLE_TEAM_ID` and `MOBILE_IOS_BUNDLE_ID`
- `GET /.well-known/assetlinks.json`, built at runtime from
  `MOBILE_ANDROID_PACKAGE_NAME` and
  `MOBILE_ANDROID_SHA256_FINGERPRINTS`

Both are limited to `/mobile/oauth/google*`, fail with a non-cacheable `503`
when their exact production identifiers are missing or invalid, and never use
placeholder identities. `MOBILE_GOOGLE_OAUTH_RETURN_URL` must have the same
HTTPS origin as `NEXT_PUBLIC_SITE_URL`.

#### GET /api/google/status
```
Response 200 (connected):
{ "connected": true, "email": string, "connectedAt": ISO8601 }

Response 200 (not connected):
{ "connected": false, "email": null, "connectedAt": null }
```

#### POST /api/google/disconnect
Removes Google connection and deletes all imported Google calendars/events.
```
Response 200:
{ "message": "Google account disconnected" }
```

#### POST /api/google/sync
Manually trigger a full sync with Google Calendar.
```
Response 200:
{
  "message": "Sync complete",
  "calendarsImported": number,
  "eventsSynced": number
}
```

---

### Notes

#### GET /api/notes
```
Query Params:
  notebook_id   string    Filter by notebook
  is_journal    "true"    Filter to journal entries only
  is_pinned     "true"    Filter pinned notes only
  search        string    Search title & content (ILIKE)
  sort          string    "updated_at"|"created_at"|"title" (default: "updated_at")
  order         string    "asc"|"desc" (default: "desc")

Response 200:
{
  "notes": [
    {
      "id": string,
      "user_id": string,
      "notebook_id": string | null,
      "title": string,
      "content": string,
      "is_journal": boolean,
      "journal_date": string | null,
      "template_name": string | null,
      "is_pinned": boolean,
      "created_at": timestamp,
      "updated_at": timestamp,
      "notebook_name": string | null,
      "tags": [{ "id": string, "name": string, "color": string }]
    }
  ]
}
```

#### POST /api/notes
```
Request:
{
  "title": string,              // required
  "content": string,            // optional
  "notebookId": string,         // optional
  "isJournal": boolean,         // optional
  "journalDate": string,        // optional
  "templateName": string,       // optional
  "tags": [string]              // optional, array of tag IDs
}

Response 201:
{ "note": { ...noteFields } }
```

#### GET /api/notes/:id
```
Response 200:
{
  "note": {
    ...noteFields,
    "notebook_name": string | null,
    "tags": [{ "id", "name", "color" }]
  }
}
```

#### PUT /api/notes/:id
```
Request:
{
  "title": string,          // optional
  "content": string,        // optional
  "notebookId": string,     // optional
  "isPinned": boolean,      // optional
  "tags": [string]          // optional, replaces all tags
}

Response 200:
{ "note": { ...noteFields, "notebook_name", "tags": [...] } }
```

#### DELETE /api/notes/:id
```
Response 200:
{ "message": "Note deleted" }
```

---

### Notebooks

#### GET /api/notebooks
```
Response 200:
{
  "notebooks": [
    {
      "id": string,
      "user_id": string,
      "name": string,
      "parent_id": string | null,
      "position": number,
      "created_at": timestamp,
      "updated_at": timestamp,
      "note_count": number
    }
  ]
}
```

#### POST /api/notebooks
```
Request:
{
  "name": string,           // required
  "parentId": string        // optional
}

Response 201:
{ "notebook": { ...notebookFields, "note_count": number } }
```

#### PUT /api/notebooks/:id
```
Request:
{ "name": string }

Response 200:
{ "notebook": { ...notebookFields } }
```

#### DELETE /api/notebooks/:id
Orphans contained notes (sets their notebook_id to NULL).
```
Response 200:
{ "message": "Notebook deleted" }
```

---

### Resources

#### GET /api/resources
```
Query Params:
  type      string    Filter by type: "pdf"|"doc"|"image"|"link"|"other"
  search    string    Search title & notes (ILIKE)

Response 200:
{
  "resources": [
    {
      "id": string,
      "user_id": string,
      "title": string,
      "type": "pdf" | "doc" | "image" | "link" | "other",
      "file_url": string | null,
      "notes": string | null,
      "created_at": timestamp,
      "updated_at": timestamp
    }
  ]
}
```

#### POST /api/resources
```
Request:
{
  "title": string,      // required
  "type": string,       // required: "pdf"|"doc"|"image"|"link"|"other"
  "fileUrl": string,    // optional
  "notes": string       // optional
}

Response 201:
{ "resource": { ...resourceFields } }
```

#### GET /api/resources/:id
```
Response 200:
{ "resource": { ...resourceFields } }
```

#### PUT /api/resources/:id
```
Request:
{
  "title": string,      // optional
  "type": string,       // optional
  "fileUrl": string,    // optional
  "notes": string       // optional
}

Response 200:
{ "resource": { ...resourceFields } }
```

#### DELETE /api/resources/:id
```
Response 200:
{ "message": "Resource deleted" }
```

---

### Flashcard Decks

#### GET /api/flashcard-decks
```
Response 200:
{
  "decks": [
    {
      "id": string,
      "user_id": string,
      "name": string,
      "description": string | null,
      "created_at": timestamp,
      "updated_at": timestamp,
      "card_count": number,
      "due_count": number
    }
  ]
}
```

#### POST /api/flashcard-decks
```
Request:
{
  "name": string,               // required
  "description": string         // optional
}

Response 201:
{ "deck": { ...deckFields } }
```

#### GET /api/flashcard-decks/:id
Returns deck with all its cards.
```
Response 200:
{
  "deck": { "id", "user_id", "name", "description", "created_at", "updated_at" },
  "cards": [
    {
      "id": string,
      "deck_id": string,
      "front": string,
      "back": string,
      "ease_factor": number,        // SM-2 ease factor (default 2.5)
      "interval_days": number,      // days until next review
      "next_review_at": timestamp,
      "review_count": number,
      "last_reviewed_at": timestamp | null,
      "created_at": timestamp,
      "updated_at": timestamp
    }
  ]
}
```

#### PUT /api/flashcard-decks/:id
```
Request:
{
  "name": string,           // optional
  "description": string     // optional
}

Response 200:
{ "deck": { ...deckFields } }
```

#### DELETE /api/flashcard-decks/:id
```
Response 200:
{ "message": "Deck deleted" }
```

---

### Flashcards

#### GET /api/flashcard-decks/:id/cards
```
Response 200:
{ "cards": [{ ...cardFields }] }
```

#### POST /api/flashcard-decks/:id/cards
```
Request:
{
  "front": string,      // required
  "back": string        // required
}

Response 201:
{
  "card": {
    ...cardFields,
    "ease_factor": 2.50,
    "interval_days": 0,
    "review_count": 0,
    "last_reviewed_at": null
  }
}
```

#### PUT /api/flashcard-decks/:id/cards/:cardId
```
Request:
{
  "front": string,      // optional
  "back": string        // optional
}

Response 200:
{ "card": { ...cardFields } }
```

#### DELETE /api/flashcard-decks/:id/cards/:cardId
```
Response 200:
{ "message": "Card deleted" }
```

#### POST /api/flashcard-decks/:id/review
Submit a review using the SM-2 spaced repetition algorithm.
```
Request:
{
  "cardId": string,     // required
  "grade": number       // required: 0 (again), 2 (hard), 3 (good), 5 (easy)
}

Response 200:
{ "card": { ...updatedCardFields } }
```
Grade 0-2: incorrect — resets interval to 1 day, review_count to 0.
Grade 3-5: correct — increases interval and adjusts ease_factor per SM-2.

---

### Reading List

#### GET /api/reading-list
```
Query Params:
  status    string    Filter by: "unread"|"reading"|"completed"

Response 200:
{
  "items": [
    {
      "id": string,
      "user_id": string,
      "title": string,
      "url": string | null,
      "resource_id": string | null,
      "status": "unread" | "reading" | "completed",
      "progress": number,          // 0-100
      "created_at": timestamp,
      "updated_at": timestamp
    }
  ]
}
```

#### POST /api/reading-list
```
Request:
{
  "title": string,          // required
  "url": string,            // optional
  "resourceId": string      // optional, link to a resource
}

Response 201:
{ "item": { ...itemFields, "status": "unread", "progress": 0 } }
```

#### PUT /api/reading-list/:id
```
Request:
{
  "title": string,          // optional
  "url": string,            // optional
  "status": string,         // optional
  "progress": number,       // optional, 0-100
  "resourceId": string      // optional
}

Response 200:
{ "item": { ...itemFields } }
```

#### DELETE /api/reading-list/:id
```
Response 200:
{ "message": "Item deleted" }
```

---

### Checklist (Routines)

#### GET /api/checklist/sections
Returns all sections with their items and today's completion logs.
```
Response 200:
{
  "sections": [
    {
      "id": number,
      "user_id": number,
      "name": string,
      "color": string,
      "position": number,
      "created_at": timestamp,
      "updated_at": timestamp,
      "items": [
        { "id": number, "name": string, "position": number }
      ]
    }
  ],
  "todayLogs": {
    "<item_id>": boolean        // map of item ID to completion status
  }
}
```

#### POST /api/checklist/sections
```
Request:
{
  "name": string,       // required
  "color": string       // optional, default: "#6366f1"
}

Response 201:
{ "section": { ...sectionFields, "items": [] } }
```

#### PUT /api/checklist/sections/:id
```
Request:
{
  "name": string,       // optional
  "color": string,      // optional
  "position": number    // optional
}

Response 200:
{ "section": { ...sectionFields } }
```

#### DELETE /api/checklist/sections/:id
```
Response 200:
{ "success": true }
```

#### POST /api/checklist/sections/:id/items
```
Request:
{ "name": string }

Response 201:
{
  "item": {
    "id": number,
    "section_id": number,
    "name": string,
    "position": number,
    "created_at": timestamp,
    "updated_at": timestamp
  }
}
```

#### PUT /api/checklist/items/:id
```
Request:
{
  "name": string,       // optional
  "position": number    // optional
}

Response 200:
{ "item": { ...itemFields } }
```

#### DELETE /api/checklist/items/:id
```
Response 200:
{ "success": true }
```

#### POST /api/checklist/log
Toggle completion for a checklist item.
```
Request:
{
  "item_id": number,        // required
  "completed": boolean,     // optional, default: true
  "date": date              // optional, default: today
}

Response 200:
{
  "log": {
    "id": number,
    "item_id": number,
    "log_date": date,
    "completed": boolean,
    "created_at": timestamp,
    "updated_at": timestamp
  }
}
```

#### GET /api/checklist/history
```
Query Params:
  start    date    required — range start
  end      date    required — range end

Response 200:
{
  "logs": [
    { "item_id": number, "log_date": date, "completed": boolean }
  ]
}
```

---

### Day Plan

#### GET /api/day-plan/blocks
```
Response 200:
{
  "blocks": [
    {
      "id": number,
      "user_id": number,
      "title": string,
      "start_time": string,     // "HH:MM:SS" format
      "end_time": string,       // "HH:MM:SS" format
      "color": string,
      "position": number,
      "created_at": timestamp,
      "updated_at": timestamp
    }
  ]
}
```

#### POST /api/day-plan/blocks
```
Request:
{
  "title": string,          // required
  "start_time": string,     // required, "HH:MM:SS"
  "end_time": string,       // required, "HH:MM:SS"
  "color": string           // optional, default: "#14b8a6"
}

Response 201:
{ "block": { ...blockFields } }
```

#### PUT /api/day-plan/blocks/:id
```
Request:
{
  "title": string,          // optional
  "start_time": string,     // optional
  "end_time": string,       // optional
  "color": string,          // optional
  "position": number        // optional
}

Response 200:
{ "block": { ...blockFields } }
```

#### DELETE /api/day-plan/blocks/:id
```
Response 200:
{ "success": true }
```

#### POST /api/day-plan/blocks/reorder
```
Request:
{ "orderedIds": [number] }      // block IDs in desired order

Response 200:
{ "success": true }
```

#### GET /api/day-plan/status?date={YYYY-MM-DD}
```
Response 200:
{ "status": "accepted" | "edited" | "rejected" | null }
```

#### POST /api/day-plan/apply
Apply day plan blocks as calendar events for a specific date.
```
Request:
{
  "date": date,                 // required, "YYYY-MM-DD"
  "status": string,             // required: "accepted"|"edited"|"rejected"
  "blocks": [                   // optional, blocks to create as events
    { "title": string, "start_time": string, "end_time": string }
  ]
}

Response 200:
{
  "success": true,
  "events": [{ ...createdEventFields }]
}
```

---

### Dashboard

#### GET /api/dashboard/stats
Weekly statistics for the dashboard.
```
Response 200:
{
  "stats": {
    "tasksCompletedThisWeek": number,
    "tasksCompletedLastWeek": number,
    "habitRateThisWeek": number,        // 0-100 percentage
    "habitRateLastWeek": number,        // 0-100 percentage
    "notesThisWeek": number,
    "notesLastWeek": number
  }
}
```

#### GET /api/dashboard/indicators
Quick indicator counts for the dashboard.
```
Response 200:
{
  "indicators": {
    "overdueTaskCount": number,
    "habitsDoneToday": number,
    "habitsTotal": number
  }
}
```

---

### Tags

#### GET /api/tags
```
Response 200:
{
  "tags": [
    {
      "id": number,
      "user_id": number,
      "name": string,
      "color": string,
      "created_at": timestamp,
      "updated_at": timestamp
    }
  ]
}
```

#### POST /api/tags
Creates a tag or updates the color if a tag with the same name exists (upsert).
```
Request:
{
  "name": string,       // required
  "color": string       // optional, default: "#6366f1"
}

Response 201:
{ "tag": { ...tagFields } }
```
