# Testing

Run automated checks from PowerShell:

```powershell
npm test
```

Current automated coverage verifies the database-free `/healthz` response, confirms the public homepage does not expose an `/admin` link, and confirms production refuses demo seeding. `test/notifications-api.test.js` drives the notification routes over a stubbed pool and session store, so customer scope, read/dismiss/clear behaviour, console filters, audit rows, and role separation are checked without any database connection. `test/ui-copy.test.js` renders the customer Notifications page and the administrator console inside a minimal DOM and guards the print rules and the shipped asset list.

The notification feature also has a live end-to-end check that starts a real server on port 4315 against the dev database:

```powershell
npm run db:verify-notifications
```

It inserts two throwaway accounts with random passwords, signs both in over HTTP, then walks the whole feature: an administrator creates messages and chooses the date the customer sees, edits one, filters by customer, type, and read state, searches the body, refuses retired wording and malformed input, and deletes a row; the customer lists messages, reads them, dismisses one, marks the rest read, and clears the list. Ownership, role separation, hidden server-side fields, and the audit trail are asserted too. Every row it touches is removed afterwards, and the script fails if the notifications, audit, user, or administrator counts differ from the start or if a temporary session or notification survives. It refuses to run with `NODE_ENV=production`, so only the Neon `dev` branch is ever written to, and its console output never contains a connection string, password, or secret.

Manual browser checks still matter: customer and admin login, account switching, successful and rejected fictional transfers, receipts, every customer Profile form, every administrator form, the customer dismiss and Clear all confirmations, the console create/edit/delete forms, logout, and a narrow mobile layout.

Do not run destructive test operations against the Neon `production` branch. Future API integration tests need their own disposable test database.
