# API

`POST /api/auth/login` begins a customer or admin session. `POST /api/auth/logout` ends it. `GET /api/customer/dashboard` returns the current user's accounts and activity. `POST /api/customer/transfers` creates a simulated transaction. `GET /api/customer/transactions/:id/receipt` returns a receipt payload. `GET /api/admin/overview` returns simulator data. `PATCH /api/admin/settings` changes global transfer behavior.

Administrators can create local test users with `POST /api/admin/customers`, create their accounts with `POST /api/admin/accounts`, and control account status, balance, and transfer availability with `PATCH /api/admin/accounts/:id`.

The browser UI now uses these protected routes for customer Profile/security and the private `/admin` Customers, Accounts, Audit log, and administrator Profile pages. None of these endpoints accept or store session, account, balance, transfer, or administrator data in browser localStorage.

## Added in 0.2.x (all JSON, session cookie required, authorization enforced server-side)

Customer: `GET/PATCH /api/customer/profile` (name, phone, address, city, country), `POST /api/customer/security/password` (currentPassword, newPassword; signs out other devices), `POST /api/customer/security/sign-out-others`. Suspended customers are signed out on their next request.

Admin: `GET/PATCH /api/admin/profile` (name, email), `POST /api/admin/security/password` (10+ chars), `GET/PATCH /api/admin/customers/:id` (name, email, phone, address, city, country, status ACTIVE|SUSPENDED, password reset; suspending or resetting ends that customer's sessions), `PATCH /api/admin/accounts/:id` (now also name, accountType), `GET /api/admin/audit?limit=&offset=&action=` (paginated, filterable). Errors are `{ "error": "message" }` with 400/401/403/404/409.
