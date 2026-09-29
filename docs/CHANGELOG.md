# Changelog

## 0.1.0

Created the initial local simulator prototype with customer and administrator flows.

Added Windows-compatible built-in SQLite support and administrator endpoints for local test customer/account management.

Fixed the sign-in form layout, converted seeded and existing local balances to USD, refreshed landing-page copy, and added motion with reduced-motion support.

Simplified entry to customer-only sign-in and added on-page teaching steps for beginners.

Replaced the public interface with a polished desktop-first homepage, login page, and customer dashboard. Removed the teaching panel and visible admin entry.

Added a private `/admin` administrator sign-in route and operations dashboard backed by server-side sessions and SQLite.

## 0.2.0 (in progress)

Migrated persistence from Node's built-in SQLite to PostgreSQL (Neon) using `pg`. Sessions are now stored in Postgres (`connect-pg-simple`) so they survive restarts. Money uses `NUMERIC(14,2)`; transfers are atomic with row locking. Added numbered schema migrations, `scripts/migrate-sqlite-to-postgres.js`, sign-in rate limiting, `helmet`, secure cookies in production, session regeneration on sign-in, suspended-customer sign-in blocking, and random transfer references. Added a database-free `/healthz` route. `.env.example` now lists every variable.
