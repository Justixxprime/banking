# Testing

Run automated checks from PowerShell:

```powershell
npm test
```

Current automated coverage verifies the database-free `/healthz` response, confirms the public homepage does not expose an `/admin` link, and confirms production refuses demo seeding. Manual browser checks still matter: customer and admin login, account switching, successful and rejected fictional transfers, receipts, every customer Profile form, every administrator form, logout, and a narrow mobile layout.

Do not run destructive test operations against the Neon `production` branch. Future API integration tests need their own disposable test database.
