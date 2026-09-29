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
