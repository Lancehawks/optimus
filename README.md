# Optimus

Optimus is the private, invite-only workspace for the Lancehawks team: projects, tasks, notes, schedules, resources, whiteboards, and collaboration in one place.

## Local setup

1. Copy `.env.example` to `.env.local` and replace every placeholder.
2. Install dependencies with `npm install`.
3. Apply the database with `npm run db:migrate`.
4. Start the app with `npm run dev` and open `/` to sign in.
5. Create your first account with an invitation: `npm run invite -- you@example.com` prints a single-use link.

## Access is invite-only

There is no public sign-up page. `/` is the sign-in screen, and `/login`, `/signup` and `/contact` redirect to it.

- Signed-in members invite people from **Settings → Invitations**. When Resend is configured the link is emailed; it is always shown to the inviter so it can be shared directly.
- `npm run invite -- person@example.com` issues an invitation from the command line (useful for the first member or when nobody is signed in). It needs `DATABASE_URL` and uses `NEXT_PUBLIC_SITE_URL` to build the link.
- An invitation is bound to one email, works once, and expires after seven days. Only a SHA-256 hash of the token is stored. Issuing a new invitation for the same email revokes the previous link.
- `POST /api/auth/signup` requires `{ token, fullName, password }`. The account email always comes from the invitation, never from the request. Requests without a valid pending invitation receive `403`.
- `GET /api/auth/invitation?token=…` lets the `/invite` page confirm a link before showing the form. Unknown, used, revoked and expired links return the same `404`.
- Project collaborators must already have an account; invite them to the workspace first.

## Design system

The interface follows one system described in [docs/design-system.md](docs/design-system.md): warm neutrals, a single ultramarine accent, Geist and Geist Mono for the interface, Instrument Serif for titles, and light/dark modes that follow the device by default. The signed-out screens carry the Lancehawks crest and are always light.

## Release verification

Run `npm run verify` before a release. It runs linting, tests, the production build, and the production dependency audit. CI runs the same checks for every pull request.

The public readiness endpoint is `GET /api/health`. In production it stays unhealthy until the database, token-encryption key, public URL, password-reset email delivery, mobile OAuth return origin, and both native-app association files are configured.

Before the first production deployment:

1. Set every required value from `.env.example` in the hosting provider's secret manager.
   The application uses `DATABASE_URL` and also accepts Vercel's standard `POSTGRES_URL` as a fallback; never point either production variable at `localhost`.
   `DB_CONNECTION_TIMEOUT_MS` defaults to 15 seconds so an idle serverless database has time to wake before the first request fails.
2. Run `npm run db:migrate` followed by `npm run db:verify`.
3. Take a verified database backup, run `npm run tokens:verify`, and use `npm run tokens:encrypt` if token migration is required.
4. Deploy the verified commit and run `npm run prod:verify` against its production URL.

## Database operations

- `npm run db:migrate` applies the baseline and ordered, checksum-protected migrations under `migrations/`.
- `npm run db:verify` checks a database for required tables, broken relationships, invalid token hashes, and duplicate default calendars.
- To verify a restored backup, set `VERIFY_DATABASE_URL` to the restored database before running `npm run db:verify`. Never treat an untested backup as recoverable.

## Mobile API authentication

Mobile requests use the same server-side sessions as the web app. Send `X-Optimus-Client: mobile` on authentication requests. Mobile signup also requires an invitation `token` (see "Access is invite-only"). Successful mobile login and signup responses include:

```json
{
  "user": {},
  "token": "opaque-session-token",
  "expiresAt": "2026-08-02T00:00:00.000Z"
}
```

Store the token in the platform's secure credential store and send it as `Authorization: Bearer <token>`. Plaintext tokens are never stored in PostgreSQL; sessions contain only a SHA-256 token hash.

Before `expiresAt`, rotate the credential with `POST /api/auth/refresh`, including both `X-Optimus-Client: mobile` and the current bearer token. The response contains a replacement `token` and `expiresAt`. Rotation is atomic and immediately invalidates the previous token, so clients must persist the replacement before making further API requests. A missing, expired, revoked, or already-rotated token returns `401`.

Browser login and signup keep their existing response body and seven-day `HttpOnly` cookie behavior. The refresh endpoint is mobile-only and does not create or update browser cookies.

## Account deletion

An authenticated user permanently deletes their account with `DELETE /api/auth/account` and this exact body:

```json
{
  "currentPassword": "the-current-account-password",
  "confirmation": "DELETE MY ACCOUNT"
}
```

The endpoint is rate limited, never accepts a target user ID, and returns a non-cacheable `{ "message": "Account deleted successfully" }` only after one database transaction commits. It immediately deletes the user row, credentials, password resets, sessions, Google OAuth state/connections, and all private user-owned records.

Shared work has deliberate retention semantics. An owned project with another active member transfers to its longest-standing active member; the deleting user's project-linked tasks, notes, events, whiteboards, and reading-list items transfer to the project's current owner. An owned project with no other active member is deleted. Shared project activity and author references remain for collaboration integrity, but the deleted actor becomes anonymous (`NULL`). No application profile, email, password hash, or deletion tombstone is retained. Infrastructure logs and database backups remain subject to the hosting provider's separate retention schedule, and URL-backed file objects require the configured storage provider's lifecycle/deletion policy.

On mobile, delete the secure local token and cached user data only after the `200` response. On the web, the endpoint also expires the auth cookie; an explicit mobile response does not emit `Set-Cookie`.

The public account-deletion resource is `GET /account-deletion`. It documents these semantics, offers the same password-confirmed deletion form to a signed-in user, and gives an unauthenticated visitor a sign-in path. The Settings page and the sign-in screen footer link to it.

Changing a password through `PUT /api/auth/profile` requires the current password, is rate limited, and transactionally deletes every session except the exact session making the request. The retained session keeps its existing opaque credential, so the web and mobile response contract does not change; revoking the other session rows also removes pending OAuth flows.

## In-app notifications

Notifications are deliberately limited to project invitations and accepted project invitations. Invited users receive an actionable notification, and inviters receive a notification only when an invitation is accepted. Ordinary project activity remains in the project history but does not enter the notification center. No notification scheduler, device registration, remote push provider, or third-party notification delivery service is required.

The development client does not poll for notifications. It refreshes on initial load, when the browser tab becomes visible, and when the notification panel opens. Deployed clients additionally refresh every ten minutes while visible.

Task reminders, event reminders, completion prompts, mobile notification sounds, and lock-screen push messages are not part of this deployment. The web client may play its own sound while open. Migration `20260731_in_app_notifications_only.sql` removes queued notification jobs, legacy scheduled alerts, stored push tokens, and push-delivery tables.

## Mobile Google Calendar OAuth

The Google redirect URI remains the server callback, `GET /api/google/callback`. To start a mobile connection, call `GET /api/google/auth` with both `X-Optimus-Client: mobile` and `Authorization: Bearer <session-token>`. The response is:

```json
{
  "url": "https://accounts.google.com/...",
  "expiresAt": "2026-08-02T00:00:00.000Z"
}
```

Open `url` in the system authentication browser. The authorization request uses PKCE and an opaque random state whose SHA-256 hash is stored for ten minutes; the verifier is encrypted at rest. State is consumed atomically before the Google code exchange, so expired, cancelled, or replayed flows must start again.

After the server stores the encrypted Google credentials and attempts the initial synchronization immediately, it redirects to the single configured HTTPS Universal Link/App Link:

```text
https://your-verified-app-domain.example/mobile/oauth/google?status=connected
https://your-verified-app-domain.example/mobile/oauth/google?status=error&reason=invalid_state
```

Allowed error reasons are `access_denied`, `connection_failed`, `invalid_state`, and `oauth_error`. Redirects never contain an Optimus token, Google token, user ID, authorization code, state, or client-provided return URL. Treat the query status only as a UI hint; after the app resumes, verify the outcome with authenticated `GET /api/google/status`.

Set `MOBILE_GOOGLE_OAUTH_RETURN_URL` to the exact verified HTTPS URL ending in `/mobile/oauth/google`. Its origin must exactly match the HTTPS `NEXT_PUBLIC_SITE_URL`. The backend rejects non-HTTPS URLs, credentials, fragments, query strings, other paths, mismatched origins, and all request-supplied return targets.

The same origin serves the native trust records directly, without redirects:

- `GET /.well-known/apple-app-site-association` is generated from `MOBILE_APPLE_TEAM_ID` and `MOBILE_IOS_BUNDLE_ID`.
- `GET /.well-known/assetlinks.json` is generated from `MOBILE_ANDROID_PACKAGE_NAME` and the comma-separated `MOBILE_ANDROID_SHA256_FINGERPRINTS`.

Both records authorize only `/mobile/oauth/google*`. Invalid or missing values produce `503` with `Cache-Control: no-store`; there are no baked-in app IDs or certificate fingerprints. Set the iOS Associated Domains entitlement to `applinks:<production-host>`. Set the Android verified HTTPS intent filter to the same host with `pathPrefix` `/mobile/oauth/google`; this static path restriction is required for Android 14 and earlier, while the served relation extension applies the same restriction on Android 15 and later. Use the Play App Signing certificate fingerprint for store builds; a release supporting more than one signing certificate may list each fingerprint separated by a comma.

Before submitting either store build, fetch both public endpoints over HTTPS, confirm they return `200` with `application/json` and no redirect, and confirm `GET /api/health` returns `200`.

The existing web flow remains `GET /api/google/auth` with cookie authentication and still returns `{ "url": "..." }`; it now receives the same opaque one-time state and PKCE protection.

Connecting Google, opening the Calendar page, or pressing Sync reconciles calendars and events immediately. Optimus first pushes pending local changes to Google and then imports Google changes. The Google primary calendar becomes the default, so new events are pushed immediately after the local transaction commits. There is no cron worker or deferred integration queue. Deliberately selected local-only calendars never push events to Google.

## Required production services

- PostgreSQL with TLS and automated backups
- Resend credentials for password reset mail
- Google OAuth credentials and a verified mobile App/Universal Link when Calendar integration is enabled

Keep `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, database credentials, OAuth credentials, and mail keys in the hosting provider’s secret manager. Do not commit `.env.local`.
