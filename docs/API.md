# API

`POST /api/auth/login` begins a customer or admin session. `POST /api/auth/logout` ends it. `GET /api/customer/dashboard` returns the current user's accounts and activity. `POST /api/customer/transfers` creates a simulated transaction. `GET /api/customer/transactions/:id/receipt` returns a receipt payload. `GET /api/admin/overview` returns simulator data. `PATCH /api/admin/settings` changes global transfer behavior.

Administrators can create local test users with `POST /api/admin/customers`, create their accounts with `POST /api/admin/accounts`, and control account status, balance, and transfer availability with `PATCH /api/admin/accounts/:id`.
