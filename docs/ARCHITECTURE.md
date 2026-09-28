# Architecture

The browser is a small vanilla JavaScript single page interface in `public/`. It calls REST endpoints in `src/server.js`. Express protects customer and admin routes with session checks. SQLite stores all fictional data locally in `data/aurum-sim.db`, created and seeded by `src/database.js`.

No API reaches a real financial service. “Transfers” only insert local transaction rows and optionally adjust local fictional balances.
