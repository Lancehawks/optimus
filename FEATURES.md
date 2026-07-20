# Optimus Features

Optimus is a personal command center web app. It combines productivity, planning, knowledge management, study tools, project collaboration, and reminders into one authenticated workspace. This file lists the current product features as implemented in the web project so they can be used as a reference for building a mobile app.

## Core Navigation

- Public landing page with Optimus positioning, feature highlights, sign-in, sign-up, and contact entry points.
- Authenticated dashboard area with a responsive sidebar.
- Main sections: Dashboard, Tasks, Notes, Calendar, Projects, Whiteboards, Saved Links, Study Resources, Routines, and Settings.
- Collapsible desktop sidebar and mobile drawer navigation.
- Sidebar badges for overdue tasks and pending routine items.
- Notification center available from the sidebar.
- Global command palette opened from the sidebar or mobile top bar.
- Keyboard shortcut hint for search: `Ctrl K`.
- Responsive layout across desktop and mobile, with desktop-only gating for Whiteboards because drawing needs a pointer-friendly screen.

## Authentication and Account

- Email/password sign-up.
- Email/password login.
- Logout.
- Current-user session lookup through `/api/auth/me`.
- Forgot-password request flow.
- Password reset flow.
- Profile update flow.
- Password change from Settings.
- Active session listing.
- Individual session revocation.
- Cookie-based web authentication using the app API service.
- Rate limiting on sensitive auth routes such as login, sign-up, forgot password, and reset password.

## User Profile and Settings

- Full name editing.
- Preset avatar picker with bundled SVG avatar assets.
- Timezone selection.
- Theme selection.
- Theme persistence in local storage and user preferences.
- Supported themes: Dark, Light, Amethyst, and System.
- Session/device display with browser/IP/date metadata where available.
- Revoke non-current sessions.

## Dashboard

- Personalized greeting header.
- Today's Tasks widget.
- Upcoming Events widget.
- Active Projects widget.
- Recent Notes widget.
- Weekly Pulse widget with productivity indicators.
- Quick Capture widget for instantly creating a task or note.
- Morning Review modal that appears once per day unless dismissed or snoozed.
- Morning Review shows today's schedule, overdue/due tasks, motivational line, and day plan review.
- Snooze options for Morning Review: 30 minutes, 1 hour, and 2 hours.
- Quick Sketch floating action button.
- Quick Sketch creates a whiteboard from the dashboard and saves it automatically.

## Global Search and Command Palette

- Quick navigation results for key app pages.
- Search across tasks, notes, projects, saved links, and resources.
- Debounced search calls to `/api/search`.
- Keyboard navigation inside the palette with arrow keys.
- Enter opens the selected result.
- Escape closes the palette.
- Results include type-specific labels, descriptions, and destination links.

## Tasks

- Task list view.
- Kanban board view.
- New task modal.
- Quick-add task input.
- Optimistic quick add.
- Search tasks.
- Filter by status.
- Filter by priority.
- Filter by project.
- Sort by manual order, due date, priority, created date, or title.
- Toggle archived tasks.
- Header stats for active, overdue, and completed tasks.
- Task statuses: To Do, In Progress, On Hold, Done.
- Task priorities: Low, Medium, High, Urgent.
- Task title and description.
- Due date.
- Project assignment.
- Recurring tasks: daily, weekly, monthly.
- When a recurring task is completed, the backend can create the next task instance.
- Task tags.
- Create new tags from the task modal.
- Subtasks.
- Add, edit, toggle, and delete subtasks.
- Inline subtask expansion in the task list.
- Subtask completion counts.
- Task dependencies with debounced dependency search.
- "Blocked by" dependency display.
- List drag-and-drop reordering with bulk position update.
- Kanban status changes.
- Toggle task completion inline.
- Defer tasks into a "Parked for later" section.
- Archive and unarchive tasks.
- Collapsible completed section.
- Bulk select tasks.
- Bulk mark done.
- Bulk archive.
- Bulk delete.
- Permission-aware delete/archive behavior for project-owned tasks.
- Task detail loading from URL query parameter `task_id`.
- Project-filtered task list via `project_id`.
- Project-filtered Kanban via `view=kanban`.

## Calendar and Scheduling

- Month view.
- Week view.
- Day view.
- Calendar header with previous/next/today navigation.
- View mode switching.
- Touch swipe navigation for calendar views.
- Keyboard navigation with left/right arrows and `T` for today.
- Create, edit, delete events.
- Click date/time slot to create event.
- Event modal with title, description, location, start/end time, all-day, recurrence, calendar, project, color/status/type, and linked tasks support.
- Mark event as done.
- Event statuses: scheduled, in progress, done, missed, cancelled.
- Event types: event, focus, time block.
- Custom event colors.
- Recurring event support with expansion-on-read behavior.
- Per-occurrence status tracking for recurring events.
- Multiple calendars.
- Create, edit, delete calendars.
- Default calendar support.
- Toggle calendar visibility.
- Calendar manager modal.
- Google Calendar OAuth connection.
- Google Calendar status display.
- Google Calendar manual sync.
- Auto-sync on Calendar page load when connected.
- Google Calendar disconnect.
- Google calendars and events imported into local calendars/events.
- Local event changes can push to Google Calendar.
- Recurring event status can sync to Google occurrence status.
- Time Blocking Panel.
- Create focus blocks from calendar.
- Schedule tasks into the calendar as focus events.
- Linked tasks shown on events.
- Project-linked events visible to project members with shared project colors.

## Notes and Journals

- Three-pane notes layout on desktop: notebooks, note list, editor.
- Mobile note list/editor pane switching.
- Notebooks sidebar.
- Create notebooks.
- Rename notebooks.
- Delete notebooks.
- Note list with search.
- Debounced note search.
- Filter tabs: All, Journals, Pinned.
- Project note filter.
- Create blank note instantly.
- Create note from template.
- Templates: Blank Note, Meeting Notes, Daily Reflection, Standup.
- Daily journal mode.
- Create/open journal entries by date.
- Journal entries use the daily reflection template.
- Rich text editor powered by TipTap.
- Note title editing.
- Auto-save note content.
- Debounced title save.
- Save status indicator: saving/saved.
- Pin and unpin notes.
- Delete notes with confirmation behavior.
- Notes can be personal or linked to projects.
- Moving a note into a project warns that it will be shared with project members.
- Moving a project note back to personal warns that it will be hidden from collaborators.
- Project notes show sharing metadata and project badge.
- Notes support tags at the API/data level.
- Notes expose notebook, project, pinned, journal, template, search, sort, and order filters through API.

## Projects and Collaboration

- Project list.
- Project detail page.
- Create, edit, and delete projects.
- Project statuses: Active, Paused, Completed, Archived.
- Project types: Work, Learning, Personal.
- Project colors.
- Project description.
- Start date and end date.
- Archive status support.
- Filter projects by status.
- Toggle archived projects in the list.
- Project cards with progress and metadata.
- Project overview with health state.
- Project metrics for open work, completion, overdue tasks, urgent tasks, milestones, and dates.
- Project progress based on task completion.
- Kanban health card linking to project Kanban.
- Quick task creation during project creation.
- Optional collaborator invitations during project creation.
- Project members list.
- Invite collaborators by email.
- Remove collaborators.
- Creator/owner permissions for sensitive actions.
- Project invitations delivered through notifications.
- Accept or decline project invitations.
- Project activity feed.
- Activity records for project, task, note, event, milestone, and member changes.
- Milestones.
- Create milestones.
- Toggle milestone completion.
- Delete milestones.
- Drag-and-drop milestone reordering.
- Work tab with linked tasks.
- Knowledge tab with linked notes, reading list items, and whiteboards.
- Team tab with collaborators and recent activity.
- Project detail links into project-scoped tasks and notes.
- Project access helpers enforce member/owner behavior in API routes.

## Whiteboards

- Embedded Excalidraw canvas.
- Whiteboard list.
- Create whiteboards.
- Create whiteboards from templates.
- Templates: Blank Canvas, Flowchart, Wireframe, System Design.
- Open whiteboard in full editor.
- Auto-save Excalidraw data.
- Auto-save thumbnail URL.
- Rename whiteboard from canvas.
- Edit title/category/project metadata.
- Duplicate whiteboard.
- Delete whiteboard.
- Pin/unpin whiteboard.
- Search boards.
- Project-linked whiteboards.
- Desktop/laptop only UI gate for whiteboard usage.

## Saved Links / Bookmarks

- Saved links section labelled "Saved Links" in the UI.
- Bookmark collection sidebar.
- Create collections.
- Rename collections.
- Delete collections.
- Select collection to filter links.
- Mobile collection pane.
- Add link.
- Edit link.
- Delete link.
- Search saved links.
- Bookmark tags.
- Save title, description, URL, favicon URL, preview image URL, and collection.
- Auto-fetch page metadata when saving bookmarks.
- Favicon lookup support.
- Empty states for no links or no search results.

## Study Resources

- Study Resources page with tabs: Resources, Flashcards, Reading List.
- Resource CRUD.
- Resource search.
- Resource type filters: PDF, DOC, Image, Link, Other.
- Resource cards.
- Resource fields: title, type, file URL, notes.
- Flashcard deck CRUD.
- Flashcard card CRUD inside a deck.
- Deck cards show card counts and due counts.
- Study mode for flashcards.
- Spaced repetition review endpoint based on SM-2 style fields.
- Flashcard review grades: Again, Hard, Good, Easy.
- Reading list CRUD.
- Reading list status filters: All, Unread, Reading, Completed.
- Reading item status updates.
- Completed reading items automatically set progress to 100.
- Reading list progress tracking.
- Reading list can link to resources.
- Reading list can link to projects at the API/data level.

## Routines

- Routines page with tabs: Daily Checklist and Day Planner.
- Checklist today view.
- Checklist week history.
- Checklist month history.
- Checklist sections.
- Create, edit, delete checklist sections.
- Checklist section colors.
- Checklist items.
- Create, edit, delete checklist items.
- Toggle checklist item completion for a date.
- Checklist history over date ranges.
- Sidebar indicator for pending routine items.
- Day Plan blocks.
- Create, edit, delete day plan blocks.
- Reorder day plan blocks.
- Time range and color for day plan blocks.
- Day Plan Review in Morning Review.
- Apply day plan blocks to calendar events for a selected date.
- Track day plan status per date: accepted, edited, rejected.

## Notifications and Reminders

- Notification center in the sidebar.
- Notification history drawer/panel.
- Unread notification count.
- Mark individual notification read.
- Mark many notifications read.
- Optional mark-read-on-view behavior.
- Notification filters.
- Notification preference panel.
- Preferences for project activity, task reminders, event reminders, sound, mark-read-on-view, and reminder lead time.
- Live notification sync endpoint.
- Alert stack for fresh unread notifications.
- Optional notification sound.
- Project activity notifications.
- Project invitation notifications with accept/decline actions.
- Time-alert notifications for tasks and events.
- Event completion check notifications with Done/Missed actions.
- Event completion response can update event or recurring occurrence status.
- Notification navigation routes users to relevant project, task, or calendar contexts.

## API and Backend

- Next.js App Router API routes under `/api`.
- PostgreSQL database access through `pg`.
- Shared `fetchAPI` service layer with credentials included.
- REST-style endpoints for auth, sessions, profile, tasks, tags, notes, notebooks, projects, project members, project activity, milestones, notifications, bookmarks, bookmark collections, whiteboards, resources, flashcard decks/cards/reviews, calendars, events, Google Calendar, reading list, dashboard stats/indicators, checklist, day plan, and search.
- Server-side validation helpers for API request bodies.
- API response/error utility helpers.
- Project access helpers for member and owner checks.
- Notebook and tag access helpers.
- Event security and permission helpers.
- Google OAuth and sync helpers.
- Recurrence conversion helpers for app recurrence rules and Google RRULEs.
- Notification generation, preferences, live sync, and de-duplication helpers.
- Permission hardening test script: `npm run test:permissions`.

## Data Model Highlights

- Users, sessions, password resets, preferences, and avatars.
- Tags shared across modules.
- Calendars and events.
- Google connections.
- Event occurrence statuses.
- Event-task links.
- Tasks, subtasks, task tags, and task dependencies.
- Notebooks, notes, and note tags.
- Projects, project members, project invitations, project activity, and milestones.
- Whiteboards with Excalidraw JSON and thumbnails.
- Bookmark collections, bookmarks, and bookmark tags.
- Resources.
- Flashcard decks and flashcards with review scheduling fields.
- Reading list items.
- Checklist sections, items, and logs.
- Day plan blocks and day plan logs.
- Notifications and notification preferences stored in user preferences.

## App-Building Notes

- Mobile app should preserve the same primary modules: Dashboard, Tasks, Calendar, Notes, Projects, Resources, Routines, Bookmarks, Notifications, and Settings.
- Whiteboards may need a tablet/desktop-first experience or a simplified mobile viewer because the web app intentionally gates full editing on small screens.
- The mobile app can reuse the same API module boundaries already present in `src/services/api.js`.
- Auth is cookie-based on web; a native app may need bearer-token support or a secure cookie/session strategy.
- Project-linked objects require careful permission handling because tasks, notes, events, whiteboards, and reading items can become shared through projects.
- Notifications are not only passive alerts; project invitations and event completion checks require action handling.
- Calendar needs special mobile attention because Google sync, recurrence instances, task scheduling, focus blocks, and event status updates are part of the current behavior.
- Notes should preserve TipTap-compatible content if the app uses a native editor.
- Flashcards should preserve current spaced-repetition fields and review grades.
- Day Planner should support applying blocks to the calendar because that is a key cross-module workflow.
