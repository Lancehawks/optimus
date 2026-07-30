# Optimus

Optimus is a focused workspace for projects, tasks, notes, schedules, resources, whiteboards, and team collaboration.

## Local setup

1. Copy `.env.example` to `.env.local` and replace every placeholder.
2. Install dependencies with `npm install`.
3. Apply the database with `npm run db:migrate`.
4. Start the app with `npm run dev`.

## Release verification

Run `npm run verify` before a release. It runs linting, tests, the production build, and the production dependency audit. CI runs the same checks for every pull request.

The public readiness endpoint is `GET /api/health`. In production it stays unhealthy until the database, token-encryption key, public URL, password-reset email delivery, mobile OAuth return origin, and both native-app association files are configured.

Before the first production deployment:

1. Set every required value from `.env.example` in the hosting provider's secret manager.
2. Run `npm run db:migrate` followed by `npm run db:verify`.
3. Take a verified database backup, run `npm run tokens:verify`, and use `npm run tokens:encrypt` if token migration is required.
4. Deploy the verified commit and run `npm run prod:verify` against its production URL.

## Database operations

- `npm run db:migrate` applies the baseline and ordered, checksum-protected migrations under `migrations/`.
- `npm run db:verify` checks a database for required tables, broken relationships, invalid token hashes, and duplicate default calendars.
- To verify a restored backup, set `VERIFY_DATABASE_URL` to the restored database before running `npm run db:verify`. Never treat an untested backup as recoverable.

## Mobile API authentication

Mobile requests use the same server-side sessions as the web app. Send `X-Optimus-Client: mobile` on authentication requests. Successful mobile login and signup responses include:

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

The endpoint is rate limited, never accepts a target user ID, and returns a non-cacheable `{ "message": "Account deleted successfully" }` only after one database transaction commits. It immediately deletes the user row, credentials, password resets, sessions, push registrations/deliveries, Google OAuth state/connections, background jobs, and all private user-owned records.

Shared work has deliberate retention semantics. An owned project with another active member transfers to its longest-standing active member; the deleting user's project-linked tasks, notes, events, whiteboards, and reading-list items transfer to the project's current owner. An owned project with no other active member is deleted. Shared project activity and author references remain for collaboration integrity, but the deleted actor becomes anonymous (`NULL`). No application profile, email, password hash, or deletion tombstone is retained. Infrastructure logs and database backups remain subject to the hosting provider's separate retention schedule, and URL-backed file objects require the configured storage provider's lifecycle/deletion policy.

On mobile, delete the secure local token and cached user data only after the `200` response. On the web, the endpoint also expires the auth cookie; an explicit mobile response does not emit `Set-Cookie`.

The public account-deletion resource is `GET /account-deletion`. It documents these semantics, offers the same password-confirmed deletion form to a signed-in user, and gives an unauthenticated visitor a sign-in path. The Settings page and public-site footer link to it.

Changing a password through `PUT /api/auth/profile` requires the current password, is rate limited, and transactionally deletes every session except the exact session making the request. The retained session keeps its existing opaque credential, so the web and mobile response contract does not change; revoking the other session rows also removes their session-bound push registrations and pending OAuth flows.

## Mobile push notifications

After obtaining an Expo push token, an authenticated client registers the app installation with `POST /api/notifications/devices`:

```json
{
  "token": "ExponentPushToken[...]",
  "platform": "ios",
  "deviceId": "stable-installation-id",
  "deviceName": "Shivangi's iPhone",
  "appVersion": "1.0.0"
}
```

`platform` must be `ios` or `android`, and `deviceId` must be a stable, non-secret identifier generated once per app installation. Registration is idempotent for the authenticated user's installation and is bound to the exact authenticated session. Refreshing a bearer token retains that same session binding; logout, remote session revocation, password-reset revocation, or account deletion removes its registered devices through a database cascade. Expired sessions are excluded from delivery even before their rows are cleaned up. Push tokens are encrypted at rest and separately hashed for uniqueness; the API response contains device metadata but never echoes the token. Before switching accounts while the session is still valid, unregister with `DELETE /api/notifications/devices` and body `{ "deviceId": "stable-installation-id" }`.

Notification writes remain database-only. The existing durable notification job seeds a deduplicated delivery outbox, and its integration worker sends at most `EXPO_PUSH_BATCH` messages at a time. Expo tickets and receipts are persisted; transient failures use bounded exponential retries, and `DeviceNotRegistered` receipts remove the invalid device. With no registered devices—or when `EXPO_PUSH_ENABLED=false`—the worker completes without contacting Expo.

Push lock-screen text is intentionally generic and contains no task, event, project, or note content. The app fetches the full notification only after its session is authenticated.

`EXPO_PUSH_ACCESS_TOKEN` is optional unless push security is enabled in Expo. Keep it only in the hosting provider's secret manager. Never place it in `NEXT_PUBLIC_*`, the mobile bundle, logs, or API responses.

## Mobile Google Calendar OAuth

The Google redirect URI remains the server callback, `GET /api/google/callback`. To start a mobile connection, call `GET /api/google/auth` with both `X-Optimus-Client: mobile` and `Authorization: Bearer <session-token>`. The response is:

```json
{
  "url": "https://accounts.google.com/...",
  "expiresAt": "2026-08-02T00:00:00.000Z"
}
```

Open `url` in the system authentication browser. The authorization request uses PKCE and an opaque random state whose SHA-256 hash is stored for ten minutes; the verifier is encrypted at rest. State is consumed atomically before the Google code exchange, so expired, cancelled, or replayed flows must start again.

After the server stores the encrypted Google credentials and queues initial synchronization, it redirects to the single configured HTTPS Universal Link/App Link:

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

## Required production services

- PostgreSQL with TLS and automated backups
- Resend credentials for password reset mail
- `CRON_SECRET` plus the included five-minute notification schedule
- Expo Push Service when mobile push delivery is enabled
- Google OAuth credentials and a verified mobile App/Universal Link when Calendar integration is enabled

Keep `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `EXPO_PUSH_ACCESS_TOKEN`, database credentials, OAuth credentials, and mail keys in the hosting provider’s secret manager. Do not commit `.env.local`.
