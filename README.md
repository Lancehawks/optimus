# Optimus

Optimus is a focused workspace for projects, tasks, notes, schedules, resources, whiteboards, and team collaboration.

## Local setup

1. Copy `.env.example` to `.env.local` and replace every placeholder.
2. Install dependencies with `npm install`.
3. Apply the database with `npm run db:migrate`.
4. Start the app with `npm run dev`.

## Release verification

Run `npm run verify` before a release. It runs linting, tests, the production build, and the production dependency audit. CI runs the same checks for every pull request.

The public readiness endpoint is `GET /api/health`. In production it stays unhealthy until the database, token-encryption key, public URL, and password-reset email delivery are configured.

Before the first production deployment:

1. Set every required value from `.env.example` in the hosting provider's secret manager.
2. Run `npm run db:migrate` followed by `npm run db:verify`.
3. Take a verified database backup, run `npm run tokens:verify`, and use `npm run tokens:encrypt` if token migration is required.
4. Deploy the verified commit and run `npm run prod:verify` against its production URL.

## Database operations

- `npm run db:migrate` applies the baseline and ordered, checksum-protected migrations under `migrations/`.
- `npm run db:verify` checks a database for required tables, broken relationships, invalid token hashes, and duplicate default calendars.
- To verify a restored backup, set `VERIFY_DATABASE_URL` to the restored database before running `npm run db:verify`. Never treat an untested backup as recoverable.

## Required production services

- PostgreSQL with TLS and automated backups
- Resend credentials for password reset mail
- `CRON_SECRET` plus the included five-minute notification schedule
- Google OAuth credentials when Calendar integration is enabled

Keep `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, database credentials, OAuth credentials, and mail keys in the hosting provider’s secret manager. Do not commit `.env.local`.
