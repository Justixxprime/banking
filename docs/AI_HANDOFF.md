# AI handoff

Project: Aurum Sim. Purpose: a premium-looking local banking experience simulator for learning and portfolio work. It is not connected to real funds or payment networks.

Stack: Node.js, Express, SQLite, bcryptjs, sessions and vanilla HTML/CSS/JS. Structure: `public` contains the interface, `src/server.js` provides API routes, `src/database.js` creates/seeds the database, and `docs` holds continuity documentation.

Completed features: customer login, multiple accounts, account selection, simulated transfer validation/outcomes, local balance adjustment on successful outcomes, printable receipt, global admin controls stored in source for later development, audit logging, and a built-in beginner learning guide.

Known limitations: session data is in memory; editing customer information and account balances from the interface are still unfinished; automated tests are not yet implemented; receipt data is generated from transactions rather than a separate receipts table.

Environment: `PORT` and `SESSION_SECRET`. Start with `npm install` then `npm start`. Test with the credentials in README.

Latest session added a private administrator route at `/admin`. There is intentionally no public admin link. The route has its own sign-in screen and server-side administrator session checks. SQLite remains the free local database at `data/aurum-sim.db`; this application does not use browser localStorage. The active customer and administrator script is `public/app-v2.js`. Do not connect this project to real funds, payment networks, or external banking infrastructure, and do not remove server-side authorization checks without permission.

Exact next task: add administrator editing for a customer's name/email and controlled account balance editing, then write automated API tests.
