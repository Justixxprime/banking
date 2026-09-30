# AI handoff

Project: Aurum Sim. Purpose: a premium-looking local banking experience simulator for learning and portfolio work. It is not connected to real funds or payment networks.

Stack: Node.js, Express, SQLite, bcryptjs, sessions and vanilla HTML/CSS/JS. Structure: `public` contains the interface, `src/server.js` provides API routes, `src/database.js` creates/seeds the database, and `docs` holds continuity documentation.

Completed features: customer login, multiple accounts, account selection, simulated transfer validation/outcomes, local balance adjustment on successful outcomes, printable receipt, global admin controls stored in source for later development, audit logging, and a built-in beginner learning guide.

Known limitations: session data is in memory; editing customer information and account balances from the interface are still unfinished; automated tests are not yet implemented; receipt data is generated from transactions rather than a separate receipts table.

Environment: `PORT` and `SESSION_SECRET`. Start with `npm install` then `npm start`. Test with the credentials in README.

Latest session added a private administrator route at `/admin`. There is intentionally no public admin link. The route has its own sign-in screen and server-side administrator session checks. SQLite remains the free local database at `data/aurum-sim.db`; this application does not use browser localStorage. The active customer and administrator script is `public/app-v2.js`. Do not connect this project to real funds, payment networks, or external banking infrastructure, and do not remove server-side authorization checks without permission.

Exact next task: add administrator editing for a customer's name/email and controlled account balance editing, then write automated API tests.

## Update: PostgreSQL migration (0.2.0, in progress)

The database layer now uses PostgreSQL (Neon; local development uses the Neon `dev` branch, production uses the `production` branch). `src/database.js` exports `query`, `withTransaction`, `audit`, `initializeDatabase`, `seedDatabase`; all routes in `src/server.js` are async. Old SQLite-only statements in the sections above are historical. Deployment target: Render (Node/Express serving the frontend) plus Neon. Keep the database free of real financial data and keep `/healthz` database-free so free-tier compute can sleep.

Exact next tasks: run the migration against the dev branch and test locally on Windows; then admin Customers/Accounts/Audit log pages and forms, admin name editing, customer Profile page, suspended-user session enforcement in `requireCustomer`, remove pre-filled admin credentials online, tests, `docs/DEPLOYMENT.md`.

### Status after 0.2.1
Done and verified: Postgres migration copied into the Neon dev branch (counts and totals matched); migration 2 and the session/audit SQL were tested on Postgres 18 with rolled-back transactions. Server routes for admin customers/accounts/audit/profile and customer profile/security exist but are NOT yet used by the frontend. Not yet tested by a human in a browser. Remaining: frontend pages (public/app-v2.js, public/desktop.css: admin Customers, Accounts, Audit log, admin profile; customer Profile), remove pre-filled admin credentials for production, automated tests, DEPLOYMENT.md, Render + Neon production setup.

### Status after 0.2.2

Completed: customer Profile/security and the private administrator Customers, Accounts, Audit log, and profile views are wired to the secured APIs. Production startup now rejects `SEED_DEMO_DATA=true` and requires `ADMIN_EMAIL` plus a 10+ character `ADMIN_PASSWORD`; the admin form only pre-fills the demo credentials on localhost. `node --test` has smoke coverage for `/healthz`, the absent public admin link, and the production demo-seed guard. `docs/DEPLOYMENT.md` contains beginner Windows deployment steps.

Next: manually exercise every new UI form in the browser, then consider deeper API integration tests against an explicitly configured disposable test database. Do not point tests at Neon production.

### Status after 0.2.3

Added a private Administrators page in `/admin`. An administrator can create additional administrator accounts and edit another administrator's name, email, or reset password through secured server routes. The page also displays the visitor's live local device time. Modal dialogs now scroll within short browser windows. Render deployment requires setting `SEED_DEMO_DATA=false` in the **Render dashboard**; local `.env` can remain `true` for the demo database.

### Status after 0.2.4

Added the private administrator Transaction history page. Administrators can filter, create, and correct fictional transaction records; they may change amount, status, recipient information, and date/time. Each change is server-authorized, stored in Postgres, balance-safe inside a locked transaction, and written to the audit log. Private, printable receipts show the saved record. Dashboard footers now clearly state that Aurum Sim is fictional, is not a bank, has no real money, and is not FDIC insured.

### Status after 0.2.5

Added protected customer Notifications and Statements pages. Notifications are paginated from the existing Postgres table. Customers can generate a private, printable statement for only one of their own fictional accounts and a date range of up to 366 days. The generated statement is a view of existing records, not a new stored financial document. `docs/CLAUDE_CODE_HANDOFF.md` explains how to continue safely with Claude Code on Windows after a session ends.

### Status after 0.2.6

Print and Save-as-PDF output works for receipts and long statements. Migration 4 rewrote retired warning wording that older releases had stored as data, so removing it from the source files alone was not enough. The dashboard time-zone strip is gone; the greeting and date still follow the visitor device. `node --test` guards the print rules, the asset list, and the absence of retired wording in shipped front-end files.

### Status after 0.2.7

Notifications became administrator-authored records. Migration 5 adds `type`, `is_read`, `sent_at`, nullable `admin_id`, and nullable `updated_at` to `notifications`, with an index on `admin_id`; old rows survive with their original date as unread `general` messages and no recorded author. Every writer goes through `sendNotification()`. `created_at` is the customer-visible date an administrator may correct, while `sent_at` is the internal write time and is never editable.

Done and verified: the customer Notifications page paginates, marks itself read on open, and offers per-message dismiss plus a confirm-protected Clear all, all scoped to the signed-in profile. The private `/admin` console lists with type/customer/read/text filters and pagination, creates, edits every visible field including the date, deletes, and audits each write. The customer payload excludes `admin_id`, `sent_at`, and `updated_at`. `GET /api/customer/dashboard` and `GET /api/admin/overview` report unread counts. Retired wording is refused in the composer, and an unknown `type` is refused instead of being rewritten so a saved message cannot disappear from the filters.

Tested: `test/notifications-api.test.js` exercises the routes over a stubbed pool and session store; `test/ui-copy.test.js` renders both new views and the console inside a minimal DOM. `npm test` passes 23 tests with no database connection. `npm run db:verify-notifications` (`scripts/verify-notifications-e2e.js`) then runs the complete flow against the Neon dev branch over real HTTP with signed-in throwaway accounts, which are deleted at the end so row counts for `notifications`, `audit_logs`, `users`, and `admin_users` are identical before and after. That script refuses to run with `NODE_ENV=production`. Do not point automated tests at the Neon production branch.

Next: exercise the notification pages by hand in a browser (layout, the dismiss and Clear all confirmations, the console forms in a short window), then continue with the remaining NEXT_STEPS items. Notification deletion for an administrator account is intentionally still unavailable, and a notification has no "archived" state: dismissing or clearing removes the row, which is what the customer asked for.
