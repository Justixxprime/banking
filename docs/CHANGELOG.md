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

### 0.2.1 (server side of admin/profile features)
Migration 2 (profile fields). New secured routes: customer profile and security (password change, sign out other devices), admin profile and password, admin customer read/edit/suspend/reset password, extended account edit, paginated and filterable audit log. `requireCustomer` now checks the customer is still ACTIVE on every request. Frontend pages for these routes are the next step.

### 0.2.2 (frontend, production guard, and test baseline)
Added the customer Profile/security page and private administrator Customers, Accounts, Audit log, and profile pages. Administrator demo credentials only pre-fill on localhost. Production rejects demo seeding and a missing/short administrator password. Added `node --test` smoke coverage for `/healthz`, no public admin link, and the production demo-seed guard. Added beginner deployment documentation for Neon production and Render.

### 0.2.4 (fictional transaction administration)
Added a secured administrator transaction-history interface with filters, record creation, safe correction, date/time editing, and printable receipts. Added migration 3 for transaction update timestamps. Completed fictional transaction records update their account balance transactionally and all administrator changes are audited. Added explicit fictional/not-a-bank/not-FDIC-insured dashboard footers.

### 0.2.5 (customer notifications and statements)
Added protected customer Notifications and Statements views. Customers can browse their own paginated notifications and preview/print a fictional account statement for a selected account and date range. Added a Windows Claude Code handoff guide for continuing work safely.

### 0.2.6 (print output, stored copy, and dashboard header)
Fixed the print and Save-as-PDF view. The old rule hid every child of `body` that was not an open modal, so the receipt page (which renders inside `#app`) printed as a blank sheet, and a long statement could be clipped by the scrolling table wrapper. The print stylesheet is now scoped with `:has()`, resets modal height and overflow, un-clips wide tables, repeats table headers, keeps rows and summary blocks off page breaks, and preserves tinted chips with `print-color-adjust`. Added `@page { margin: 14mm }`. Repaired the malformed `}surface select` selector that had lost its leading dot and silently dropped the statement account dropdown styling.

Added migration 4, which rewrites the retired warning phrase stored in `notifications.body` and the seeded `Aurum Demo Bank` value in `transactions.recipient_bank`. Editing the seed text alone was not enough: those strings already lived in rows, so the Notifications page kept showing them.

Removed the dashboard `clock-row` strip (the live clock and the device time-zone name, which read "West Africa Time" on this machine) along with `localTimeZone()`, `liveClockFormat()`, and their CSS. The greeting and date line still refresh from the visitor's device every second.

### 0.2.7 (notification management for customers and administrators)
Notifications are now messages an administrator authors, not only system events nobody can correct. Migration 5 adds `type`, `is_read`, `sent_at`, a nullable `admin_id`, and `updated_at` to `notifications`, plus an index on `admin_id`; existing rows keep their date and become unread `general` messages with no recorded author. `created_at` is the date the customer sees and can be corrected; `sent_at` is the internal write time and is never editable.

Customer side: the Notifications page paginates, shows the type, marks the page read when it opens, and offers both a per-message dismiss and a confirm-protected Clear all. `GET /api/customer/notifications`, `POST /api/customer/notifications/read`, `DELETE /api/customer/notifications/:id`, and `POST /api/customer/notifications/clear` are scoped to the signed-in profile, and a message belonging to somebody else answers 404 without deleting anything. The customer payload lists only `id`, `title`, `body`, `type`, `is_read`, `created_at`, so the authoring administrator never reaches the browser. The dashboard shows an unread count.

Administrator side: a Notifications console mirrors the transaction console, with type/customer/read/text filters, pagination, a create form, an edit form for recipient, title, message, type, visible date and time, and read state, and a delete action. Every write is audited as `ADMIN_NOTIFICATION_CREATED`, `ADMIN_NOTIFICATION_UPDATED`, or `ADMIN_NOTIFICATION_DELETED`, and the operations summary reports messages sent and unread. Retired warning wording is refused on both title and body, so text removed in migration 4 cannot be typed back in, and an unknown `type` is refused rather than quietly rewritten.

Tests: added `test/notifications-api.test.js` (nine route tests over a stubbed pool and session store) and extended `test/ui-copy.test.js` for both new views, the console, and the print rules. `npm test` covers 23 tests. Added `scripts/verify-notifications-e2e.js` and the `npm run db:verify-notifications` command, which exercise the full flow against the Neon dev branch through real HTTP sign-in with throwaway accounts that are removed afterwards, confirming the database is left exactly as it was found.

Fixed the notification card layout so the dismiss button rule is applied after the base `.notification-card` rule; the earlier order meant the three-column grid and the "new" chip were overridden by the plainer two-column definition.
