# Optimus Product Description

## One-Line Description

Optimus is a personal command center for makers, students, builders, and small teams to manage tasks, calendars, notes, projects, whiteboards, study resources, routines, saved links, and reminders from one workspace.

## Product Summary

Optimus is a full-stack productivity web application built with Next.js, React, and PostgreSQL. The product is designed as a central operating system for a user's daily work and learning life. Instead of splitting planning, task execution, notes, study material, links, habits, and project collaboration across many disconnected tools, Optimus brings them together in one authenticated dashboard.

The web app is a private, invite-only workspace; its only public screen is sign-in. After signing in, users land on Today inside a calm workspace with a responsive sidebar, global search, notifications, settings, and dedicated modules for the major workflows. The experience is built around fast capture, structured planning, cross-linking, and project-aware collaboration.

## Target Users

- Individual builders and founders who need one place to plan, ship, study, and organize ideas.
- Students and self-learners who want notes, resources, flashcards, reading progress, habits, and schedules together.
- Freelancers or solo operators who need lightweight project management without a heavy enterprise tool.
- Small teams or early companies that need shared projects, tasks, notes, event visibility, collaborator invitations, and activity notifications.
- Productivity-focused users who want an integrated dashboard rather than a collection of separate apps.

## Core Value Proposition

Optimus gives the user a single place to answer: "What should I do, what is scheduled, what am I building, what do I know, what am I studying, and what needs my attention?"

The product combines:

- Planning: tasks, calendar, day planner, projects, milestones, and focus blocks.
- Execution: Kanban boards, task lists, bulk actions, subtasks, dependencies, and project progress.
- Knowledge: rich notes, journals, notebooks, saved links, resources, and whiteboards.
- Learning: flashcards, spaced repetition, reading list, resource tracking, and study material organization.
- Routines: daily checklist, habit-style history views, day-plan review, and calendar application.
- Collaboration: shared projects, members, invitations, shared notes/tasks/events, and project activity.
- Awareness: the Today agenda, morning review, notification center, live reminders, and global search.

## Product Personality

Optimus feels like a precise, calm workspace for people who want control without clutter. It uses warm neutrals with a single ultramarine accent, Instrument Serif for titles, Geist for the interface and Geist Mono for figures, and follows the device's light or dark mode. Screens answer one question each, and colour carries meaning (status, priority, project) rather than decoration.

## Current Web App Structure

### Public Area

- Sign-in at `/` and invitation acceptance at `/invite`; access is invite-only.
- Password reset and the public account-deletion policy.
- Every page is marked `noindex`; the sitemap and robots route expose only sign-in and the account-deletion policy. Vercel Analytics remains enabled.

### Authenticated App Area

- Responsive app shell: the sidebar sits on the canvas and each page renders on a single sheet.
- Mobile top bar and drawer navigation.
- Global command palette.
- Assistant panel (turned on per member by an admin).
- Admin page (admins only).
- Notification center.
- User menu/sign-out flow.
- Main workspace sections:
  - Today (with Routines)
  - Tasks
  - Calendar
  - Projects
  - Notes (with Whiteboards)
  - Library: Links, Resources, Reading list, Flashcards
  - Founder Lobby
  - Settings

## Module Descriptions

### Today

Today (`/dashboard`) is the user's daily home base and answers one question: what does today look like? It shows a single agenda that merges today's events, day-plan blocks and due tasks around a "now" marker, a short list of overdue and blocked work that needs attention, today's routine checklist, active project progress, and the week ahead.

Planning the day is offered, not imposed: a quiet prompt opens the Morning Review, which summarizes today's schedule, due/overdue tasks, and available day-plan blocks. Users can apply the plan or dismiss the prompt for the day.

### Tasks

Tasks are the core execution layer of Optimus. Users can create tasks quickly or open a detailed modal for full task metadata. Tasks support status, priority, due dates, projects, recurrence, subtasks, tags, dependencies, deferral, archiving, and drag-and-drop ordering.

The task module supports both list and Kanban views. List view is optimized for scanning, filtering, quick completion, bulk actions, and manual ordering. Kanban view is optimized for moving work through To Do, In Progress, On Hold, and Done.

Tasks can be personal or attached to a shared project. Project-attached tasks inherit collaboration rules and can be visible to project members.

### Calendar

The Calendar manages schedules, events, focus blocks, project-linked events, and Google Calendar integration. Users can switch between month, week, and day views, create events from time slots, manage calendars, toggle calendar visibility, and sync with Google.

The calendar also connects tasks to time. Tasks can be scheduled as focus events, and day-plan blocks can be applied to the calendar. Events can be recurring, all-day, color-coded, status-tracked, and linked to tasks.

### Notes and Journals

Notes are the knowledge layer of the product. Users can create rich-text notes, organize them in notebooks, search across them, pin important notes, and create notes from templates. Journal mode creates date-based entries with a daily reflection template.

Notes can be personal or linked to projects. Project-linked notes are shared with project members, while personal notes remain private. This makes Optimus useful for both private thinking and collaborative project documentation.

### Projects

Projects organize work into larger outcomes. Each project has metadata such as name, description, type, status, color, start date, end date, progress, tasks, milestones, knowledge links, team members, and activity.

Project detail pages include overview metrics, Kanban health, task progress, milestone progress, next work, linked notes, linked reading items, linked whiteboards, collaborators, and recent activity. Projects can be solo or shared. Shared projects support invitations, collaborator removal, activity logs, and notification-driven updates.

### Whiteboards

Whiteboards provide a visual thinking space powered by Excalidraw. Users can create boards from blank canvas, flowchart, wireframe, and system design templates. Boards auto-save drawing data and thumbnails, can be pinned, duplicated, renamed, searched, categorized, and linked to projects.

The current web UI intentionally asks users to open Whiteboards on a laptop or desktop for full editing, because the canvas is better suited to pointer-based interaction.

### Library

The Library (`/library`) gathers everything the user keeps for later in four tabs: Links, Resources, Reading list and Flashcards.

#### Links

Links is the bookmark manager. Users can save URLs, organize them into collections, search them, edit metadata, and use tags. The backend can fetch page metadata and favicons for saved links.

This module is useful for saving references, inspiration, documentation, research pages, and articles that do not belong directly inside a note yet.

#### Resources, Reading list and Flashcards

The other Library tabs are three learning tools:

- Resources: files or links such as PDFs, docs, images, links, and other study material.
- Flashcards: decks and cards with spaced repetition review.
- Reading List: reading items with status and progress tracking.

The module supports search, filters, CRUD flows, flashcard study mode, due-card counts, and reading status transitions.

### Routines

Routines (`/routines`, nested under Today) contains the Daily Checklist and Day Planner. Today also shows the checklist inline.

The Daily Checklist lets users create sections and items, then mark items complete for each date. It supports today, week, and month views for habit-style tracking.

The Day Planner lets users define reusable time blocks with start/end times, colors, and order. During Morning Review, the user can apply the day plan to the calendar, edit it, or reject it for the day.

### Notifications

Notifications keep the user aware of project activity and invitations while the app is open. The notification center supports unread counts, preferences, history, mark-read behavior, invitation actions, an alert stack, and an optional web sound. It does not use scheduled reminders or remote push delivery.

Some notifications are actionable:

- Project invitations can be accepted or declined.

### Assistant

The assistant answers questions about the member's own workspace in plain language: what's on their plate today, what's overdue, what the week looks like, how a project is going, or what they wrote about something. It looks up the agenda, tasks, projects, notes and journals, and the workspace search, and replies with links to the items it mentions.

Members can use it in two ways: an admin lets them use the workspace AI key, or they add their own API key from Anthropic or OpenRouter and pick from the models the workspace offers, including some free ones. They choose the model in the chat and can switch mid-conversation. Settings explains that questions and the items looked up to answer them go to the chosen model's provider. It only sees what the member can already open, and it can't change anything yet.

Members can add short notes about themselves under Settings → Memory, such as their role, focus or how they like answers. The assistant reads them at the start of each new conversation.

### Admin

Admins manage the workspace from the Admin page: add members with a password, edit their details, change roles, suspend or restore access, set new passwords, decide who can use the workspace AI key, and check and choose which models members can pick. A usage view shows the month's assistant spend against the budget, a 30-day daily chart, and spend by member and model. Admins see account details and counts, not the contents of anyone's workspace.

### Settings

Settings handles user profile and preferences. Users can choose an appearance (System, Light or Dark), edit their name, avatar, timezone, password, and active sessions, invite people to the workspace, see whether they have the assistant, and manage their assistant memory.

## Cross-Module Workflows

Optimus is strongest when modules connect:

- A project can contain tasks, milestones, notes, reading items, whiteboards, events, collaborators, and activity.
- A task can be scheduled onto the calendar as a focus block.
- A day plan can become calendar events.
- A note can move from personal to project-shared.
- A project invitation appears as a notification and can be accepted from the notification center.
- A recurring event can generate per-occurrence completion checks.
- Global search can jump directly to tasks, notes, projects, saved links, resources, and pages.
- Quick Capture can convert an idea into either a task or a note immediately.
- Quick Sketch can start a whiteboard directly from the dashboard.

## Backend and API Description

Optimus uses Next.js API routes as the backend for the web app. The API is organized by module and backed by PostgreSQL.

Major API groups:

- Auth: invitation preview, invite-only sign-up, login, logout, current user, profile, sessions, forgot password, reset password.
- Invitations: issue, list and revoke workspace invitations.
- Tasks: list, create, get, update, delete, bulk actions, subtasks, dependencies.
- Calendar: calendars, events, Google OAuth/status/sync/disconnect.
- Notes: notes and notebooks.
- Projects: projects, milestones, members, activity, invitations.
- Notifications: list, mark read, preferences, sync, invitation response, event completion response.
- Knowledge: bookmarks, bookmark collections, whiteboards, resources, reading list.
- Study: flashcard decks, cards, and reviews.
- Routines: checklist sections/items/logs/history and day-plan blocks/status/apply.
- Dashboard: stats and indicators.
- Search: global search.
- Tags: shared tag creation/listing.

The current web client centralizes API calls in `src/services/api.js`, which is a useful reference for a mobile app service layer.

## Data and Persistence

The database stores users, sessions, reset tokens, tags, calendars, events, Google connections, tasks, notebooks, notes, reminders, whiteboards, bookmarks, resources, flashcards, reading list items, projects, milestones, checklist data, day-plan data, and notification-related project collaboration data.

Important relationships:

- Users own personal objects.
- Projects add shared access through project members.
- Tasks, notes, events, whiteboards, and reading items can link to projects.
- Tags can categorize tasks, notes, and bookmarks.
- Events can link to tasks.
- Flashcards belong to decks.
- Checklist logs track item completion by date.
- Day-plan logs track whether a day plan was accepted, edited, or rejected.

## Mobile App Implications

A mobile app can be built around the same modules and API routes, but it should adapt the interaction model:

- Use tab navigation for the highest-frequency sections: Dashboard, Tasks, Calendar, Notes, and More.
- Put Projects, Resources, Routines, Bookmarks, Notifications, and Settings under More or secondary navigation.
- Keep Quick Capture accessible from Dashboard or a floating action.
- Preserve project-sharing rules before allowing mobile edits to tasks, notes, events, and whiteboards.
- Use secure token or cookie handling for auth; the web app currently uses credentialed API requests.
- Keep notes compatible with existing TipTap content.
- Consider a mobile-friendly whiteboard viewer first, then add tablet/full editing later.
- Calendar must support recurrence, Google sync state, task scheduling, focus blocks, and event completion status.
- Notifications require action handling, not just display.
- Offline support would be useful for tasks, checklist, notes, and today's schedule, but the current web project is primarily online-first.

## Suggested Mobile MVP

For the first mobile app version, prioritize:

1. Auth and profile.
2. Dashboard with today's tasks, events, active projects, quick capture, and notifications.
3. Tasks list with create/edit, complete, filters, project assignment, and subtasks.
4. Calendar day/week/month views with event create/edit and Google sync status.
5. Notes list/editor with notebooks, pinned notes, search, templates, and journals.
6. Projects list/detail with tasks, milestones, members, and shared notes.
7. Routines with checklist today/history and day-plan apply.
8. Resources with flashcard study and reading list.
9. Saved links search and collection browsing.
10. Settings and theme.

## Current Technology Stack

- Framework: Next.js App Router.
- UI: React.
- Styling: Tailwind CSS v4 with custom global tokens.
- Database: PostgreSQL.
- Auth/security: JWT/cookie-style sessions, bcrypt password hashing, rate-limited auth routes.
- Integrations: Google Calendar API.
- Canvas: Excalidraw.
- Rich text: TipTap.
- Drag and drop: dnd-kit.
- Analytics: Vercel Analytics.
- Testing: Node test script for permission hardening.

## Product Positioning

Optimus can be described as:

"A focused personal command center that unifies tasks, notes, calendar, projects, routines, whiteboards, bookmarks, study tools, and reminders so makers can plan the day, capture ideas, track progress, and ship work from one place."
