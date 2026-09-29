# Deployment: GitHub, Neon, and Render

This is a learning/portfolio deployment for **fictional simulator data only**. Aurum Sim never connects to real banks, cards, payment systems, or money.

## Before you begin

1. Run `npm test` locally. It should say `pass 3` (or more as tests are added).
2. Commit and push the source code to GitHub. Never add `.env` to Git; it contains secrets.
3. In Neon, keep local work on the `dev` branch. Use the empty `production` branch only for the live Render site.

## Create the production database

1. Open Neon, choose the `production` branch, and use **Connect** to copy its pooled connection string.
2. Change its query ending from `sslmode=require` to `sslmode=verify-full`. Keep every other part of the connection string exactly as Neon supplied it.
3. The first time only, copy the fictional SQLite data into the empty production branch:

   ```powershell
   copy .env .env.dev-backup
   notepad .env
   ```

4. In `.env`, temporarily set the production `DATABASE_URL`, `NODE_ENV=production`, `SEED_DEMO_DATA=false`, `ADMIN_NAME`, `ADMIN_EMAIL`, and a fresh `ADMIN_PASSWORD` with 10 or more characters. Do not paste these values into GitHub or chat.
5. Run this once:

   ```powershell
   npm run db:migrate-from-sqlite
   ```

   It verifies counts and fictional money totals before saving. Do **not** use `--replace` on the production branch unless you deliberately intend to erase the target Aurum tables.
6. Restore your local dev `.env` from `.env.dev-backup`, then delete the backup after checking it is correct.

## Create the Render web service

1. Sign in to Render and select **New** → **Web Service**.
2. Connect the GitHub repository `Justixxprime/banking` and choose branch `main`.
3. Choose the Frankfurt region when it is available.
4. Set:

   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/healthz`

5. Add these environment variables in the Render dashboard, one at a time:

   - `DATABASE_URL`: Neon **production** pooled string using `sslmode=verify-full`
   - `SESSION_SECRET`: create a fresh one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `NODE_ENV`: `production`
   - `SEED_DEMO_DATA`: `false`
   - `ADMIN_NAME`: the fictional administrator name
   - `ADMIN_EMAIL`: the administrator email
   - `ADMIN_PASSWORD`: a new 10+ character administrator password

   Keep every value private. Render checks these at startup: production will refuse demo seeding or a missing administrator password.

6. Deploy. Open the Render URL, then test `/healthz`; it should display `{ "ok": true }`.
7. On your phone, open the same HTTPS URL, sign in as a customer, and check the dashboard, Profile page, and a narrow-screen layout. Open `/admin` directly to test administrator sign-in; the public homepage intentionally has no admin link.

## Free-plan behavior checked September 2026

Render Free web services spin down after 15 minutes without incoming traffic, and the first request can take about a minute while the service wakes up. Render also gives each workspace 750 free instance-hours per calendar month; its local filesystem is temporary, so PostgreSQL is required for persistent simulator data. See [Render’s free-service documentation](https://render.com/docs/free).

Neon Free uses scale-to-zero for inactive compute. Current Neon material describes 100 CU-hours per project each month and 0.5 GB storage per project; check the Neon dashboard before relying on a limit because free-plan limits can change. See [Neon’s current Free-plan guidance](https://neon.com/blog/how-to-make-the-most-of-neons-free-plan).

GitHub Pages is optional only for a separate static marketing page. It cannot host Aurum Sim's Express API, server-side sessions, or protected `/admin` route.

GitHub Actions are not required yet. Add one only when a future workflow needs it; for now, run `npm test` before pushing.
