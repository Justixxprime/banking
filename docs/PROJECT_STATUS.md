# Project status

Current milestone: 0.2.7. Notifications are administrator-authored records that customers can read and clear.

Completed: local Express server, Postgres/Neon persistence with numbered migrations, seeded demo accounts, customer authentication, account switching, transfers, receipts, responsive interface, admin settings, audit entries, admin test-customer creation, admin account and simulation controls, admin editing of customer details, customer notifications, and an administrator notification console.

Next: browser verification of the newer forms, fuller API test coverage, route modules, and the actual Render/Neon production setup. See `docs/NEXT_STEPS.md`.

## 0.2.2 update

The administrator and customer profile frontend is implemented. Production configuration now requires an environment-supplied administrator password and disables demo seeding. Automated smoke tests run with `npm test`; deployment instructions are in `docs/DEPLOYMENT.md`. Remaining work is browser form verification, fuller API test coverage, and the actual Render/Neon production setup.

## 0.2.7 update

Customer Notifications and the private `/admin` Notifications console are both live and wired to secured routes. Migration 5 gives `notifications` a type, a read flag, an internal send time, and the authoring administrator. Customers can dismiss one message or clear their list; administrators can list with filters, write, correct, and delete messages, and every change is audited. Automated coverage is `npm test` (23 tests, no database connection required) plus `npm run db:verify-notifications`, which drives the full flow over real HTTP on the Neon dev branch with throwaway accounts that are removed again.

Remaining: browser form verification of the new notification pages, and the outstanding items in `docs/NEXT_STEPS.md`.
