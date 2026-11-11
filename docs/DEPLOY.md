# Deploying to Railway

The app runs on Railway as a single always-on Node service. The database stays on
Supabase. No Railway config file is needed: Railway detects Next.js and uses the
`build` and `start` scripts in `package.json`.

What those scripts do on every deploy:

| Step | Command | What it does |
|---|---|---|
| Install | `npm ci` then `postinstall` | Installs packages and generates the Prisma client |
| Build | `npm run build` | `next build` |
| Start | `npm run start` | Applies pending database migrations, then starts the server on `$PORT` |

## One-time setup

1. In Railway: **New Project → Deploy from GitHub repo** and pick this repository.
   Deploys then happen automatically on every push to `main`.
2. Open the service → **Variables** and add the variables listed below.
3. Open **Settings → Networking → Generate Domain** to get a public URL.
4. Set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to that URL (no trailing slash) and redeploy.
5. Recommended: **Settings → Deploy → Healthcheck Path** = `/api/health`.
   A deploy with a broken database connection then fails instead of going live.
6. Keep the service at **one replica** and leave **Serverless / App Sleeping off**
   (see "Nightly billing" below).

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | The Supabase **session pooler** connection string (the same value used locally). The direct `db.<ref>.supabase.co` address is IPv6-only and may not be reachable. |
| `NEXTAUTH_SECRET` | Yes | A long random string. Generate one with `openssl rand -base64 32`. Use a different value from local development. |
| `NEXTAUTH_URL` | Yes | The public URL, e.g. `https://your-app.up.railway.app` |
| `NEXT_PUBLIC_APP_URL` | Yes | Same public URL. Used for links in emails. |
| `CRON_SECRET` | Recommended | Lets an external scheduler call `/api/cron/billing`. Not needed for the built-in scheduler. |
| `RESEND_API_KEY` | For email | Without it, emails are skipped (the app still works). |
| `EMAIL_FROM` | For email | e.g. `Studio Name <noreply@yourdomain.com>`. The domain must be verified in Resend. |
| `STRIPE_SECRET_KEY` | For payments | Without it, online payment and auto-pay are disabled. |
| `STRIPE_PUBLISHABLE_KEY` | For payments | Read at **build** time, so redeploy after changing it. |
| `STRIPE_WEBHOOK_SECRET` | For payments | From the Stripe webhook endpoint you create for `<public URL>/api/webhooks/stripe`. |
| `BILLING_JOB_HOUR_UTC` | No | Hour (0–23, UTC) after which the nightly billing job runs. Default `9`. |
| `DISABLE_BILLING_SCHEDULER` | No | Set to `1` to turn the built-in scheduler off. |

`PORT` is provided by Railway; do not set it.

## Nightly billing

Once a day the server marks past-due invoices as overdue and charges invoices on
auto-pay. This runs **inside the web server** (`instrumentation.ts` →
`lib/billing-scheduler.ts`), so there is no separate cron service to set up.

- It runs once per UTC day, at or after `BILLING_JOB_HOUR_UTC`. Each run is recorded
  as a `BILLING_JOB_RUN` row in the audit log, which is also what stops it running
  twice if the server restarts or there is more than one instance.
- It needs the server to be awake. If you enable Railway's Serverless / App Sleeping
  option, the job only runs when traffic wakes the app. In that case either leave
  sleeping off, or create a Railway cron service that requests
  `GET <public URL>/api/cron/billing` with the header
  `Authorization: Bearer <CRON_SECRET>` and set `DISABLE_BILLING_SCHEDULER=1`.
- An admin can also trigger it by opening `/api/cron/billing` while signed in.

## Database migrations

`npm run start` runs `prisma migrate deploy` before the server starts, so merged
migrations are applied on the next deploy. If a migration fails, the server does not
start and Railway keeps the previous deployment running.

Every migration that creates a table must also enable row-level security on it
(see `CLAUDE.md`, Security).

## After the first deploy

- Sign in with an admin account and open **Settings** to fill in the studio profile.
- Check `<public URL>/api/health` returns `{"data":{"status":"ok"}}`.
- When Stripe is set up, add the webhook endpoint and send a test event.
