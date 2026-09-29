# Database

PostgreSQL 18 on Neon. Schema changes are numbered entries in `src/database.js` (`migrations`), applied automatically at startup inside a transaction with an advisory lock, and recorded in `schema_migrations`. Never edit an applied entry; add a new one.

Tables: `users` (bcrypt hash, `status` ACTIVE/SUSPENDED), `admin_users`, `accounts` (belongs to a user; `NUMERIC(14,2)` balances with non-negative CHECKs; status; `transfers_enabled` boolean), `transactions` (belongs to a user and source account; unique `reference`; `amount > 0`), `notifications`, `system_settings`, `audit_logs` (nullable `admin_id`), `session` (express sessions via connect-pg-simple), `schema_migrations`.

Money is exact `NUMERIC(14,2)`; the driver converts it to JavaScript numbers so API output is unchanged. Timestamps are `TIMESTAMPTZ` (returned as ISO strings). Transfers run in one transaction with `SELECT ... FOR UPDATE` on the source account. Receipts are still generated from `transactions`.

Old data: `scripts/migrate-sqlite-to-postgres.js` copies `data/aurum-sim.db` (opened read-only) into an empty Postgres database, keeps ids, resets id counters, and verifies row counts and money totals before committing.

Migration 2 (profile fields): `users` gains `phone`, `address`, `city`, `country`, `updated_at`; `admin_users` gains `updated_at`. Applied automatically on the next start. Sessions of a user can be ended with `DELETE FROM "session" WHERE sess->'user'->>'role' = $1 AND sess->'user'->>'id' = $2`.

Production seed rule: set `SEED_DEMO_DATA=false`, `ADMIN_EMAIL`, and a 10+ character `ADMIN_PASSWORD`. When an empty database has no administrator, `seedDatabase` hashes that password with bcrypt and creates the administrator. The one-time SQLite migration also replaces the copied administrator password when `ADMIN_PASSWORD` is set. Use a Neon production connection string with `sslmode=verify-full`.
