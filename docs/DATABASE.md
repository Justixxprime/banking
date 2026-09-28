# Database

`users` and `admin_users` keep identity and bcrypt password hashes. `accounts` belongs to a user. `transactions` belongs to both a user and source account. `notifications` belongs to a user. `system_settings` controls global simulator behavior. `audit_logs` records important actions. Receipts are generated from stored transaction data in this prototype; a dedicated `receipts` table is the next schema extension.
