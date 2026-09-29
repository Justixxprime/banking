# Project status

Current milestone: PostgreSQL (Neon) migration in progress; the feature work below the prototype line is unchanged.

Completed: local Express server, SQLite persistence, seeded demo accounts, customer authentication, account switching, transfer simulation, receipts, responsive interface, admin settings, audit entries, admin test-customer creation, admin account creation and account simulation controls.

Next: add admin editing for customer details, add automated tests, split routes into modules, and improve session storage for production.

## 0.2.2 update

The administrator and customer profile frontend is implemented. Production configuration now requires an environment-supplied administrator password and disables demo seeding. Automated smoke tests run with `npm test`; deployment instructions are in `docs/DEPLOYMENT.md`. Remaining work is browser form verification, fuller API test coverage, and the actual Render/Neon production setup.
