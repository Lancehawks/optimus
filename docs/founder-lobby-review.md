# Founder Lobby review — 17 October 2026

## Implemented

- Commercial overview, lead values, target editor and CSV headings use INR. Amounts use Indian grouping and preserve paise, for example ₹1,23,456.50. Existing numerical amounts are unchanged; no exchange-rate conversion is performed.
- Burgundy, Forest, Ocean and Midnight themes are selected from the lobby header. Preferences persist in this browser and synchronize across its tabs. Blocked browser storage does not prevent theme changes. Theme tokens cover surfaces, borders, controls, overlays and shadows.

## Confirmed bugs fixed

| Issue | Correction |
| --- | --- |
| Lead changes left commercial totals stale | Sales reload after successful lead mutations and on window focus; outdated fetch responses are ignored. |
| Failed reads appeared as empty collections or zero sales | Error states suppress those misleading views. Collection errors offer Retry. |
| Concurrent founders silently overwrote shared records | Leads, targets, milestones and notes return PostgreSQL row versions. Updates and deletes reject stale versions with HTTP 409. Drafts remain available after failed saves. |
| Note saves could replace the draft selected while the request ran | Save responses only select their originating draft; note switching warns about unsaved changes. Inputs are disabled during a save. |
| Long notes were silently truncated | The editor enforces 12,000 characters and the API rejects longer content. |
| CSV cells could execute spreadsheet formulas | Formula-leading cells are prefixed with an apostrophe and quoted correctly. |
| Null JSON bodies crashed routes; boolean/array numeric values were accepted | Founder routes normalize invalid body shapes and validate numeric types. Target values are bounded to the database range. |
| Editor panels were clipped by animated station ancestors | Editors render at the lobby root, retaining the theme while escaping clipping. Dialog labels, Escape handling and keyboard focus cycling are provided. |

## Remaining findings

This is a bounded review, not a claim that the lobby is free of production defects.

- **Medium:** Countdown date input/display and the building-day calculation use the browser timezone rather than the user's saved preference. A founder traveling or using a differently configured device can enter a different intended instant. Standardize these on an explicit displayed timezone.
- **Medium:** Shared countdown and settings writes still use last-write-wins semantics. Record-level version protection currently covers the four collections, not these singleton settings.
- **Medium:** List endpoints return entire collections. Add pagination and server-side sales aggregation before large lead/note datasets are expected.
- **Low:** Lock failures currently leave the room open without a visible failure message. The server-side PIN/session checks still protect every request.

## Validation and rollout

- 70 unit/regression tests pass, including execution of Founder migrations and route SQL against embedded PostgreSQL. Tests cover malformed bodies, INR, CSV escaping, stale edits/deletes and long-note rejection.
- Lint and production build pass.
- Chromium flow on an isolated local PostgreSQL schema covers PIN entry, all four themes, saved theme restoration, lead creation, refreshed rupee totals, and a 390px mobile header. Production records were not modified by these tests.
- Apply `20261017_founder_inr.sql` with the matching deployment to align the stored currency label/default. It preserves all numeric values. This migration has been tested locally and has **not** been applied to the configured live database.
- Deploy the updated UI and API together. Older open pages without row versions must reload before editing or deleting shared collection records.
