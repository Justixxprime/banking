# Architecture

The browser is a small vanilla JavaScript single page interface in `public/`. It calls REST endpoints in `src/server.js`. Express protects customer and private `/admin` routes with server-side session checks. PostgreSQL on Neon stores all fictional data; `src/database.js` applies numbered migrations and `connect-pg-simple` stores sessions in PostgreSQL.

No API reaches a real financial service. “Transfers” only insert fictional transaction rows and optionally adjust fictional balances inside the Aurum Sim database.
