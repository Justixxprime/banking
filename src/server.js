require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { initializeDatabase, seedDatabase, migrateToUsd, db } = require('./database');
const bcrypt = require('bcryptjs');

initializeDatabase();
seedDatabase();
migrateToUsd();
const app = express();
app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET || 'development-only-secret-change-me', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax' } }));
app.use(express.static(path.join(__dirname, '../public')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

function requireCustomer(req, res, next) { if (!req.session.user || req.session.user.role !== 'customer') return res.status(401).json({ error: 'Please sign in as a customer.' }); next(); }
function requireAdmin(req, res, next) { if (!req.session.user || req.session.user.role !== 'admin') return res.status(401).json({ error: 'Administrator access is required.' }); next(); }

app.post('/api/auth/login', (req, res) => {
  const { email, password, role = 'customer' } = req.body;
  if (!['customer', 'admin'].includes(role)) return res.status(400).json({ error: 'Unsupported sign-in type.' });
  const table = role === 'admin' ? 'admin_users' : 'users';
  const user = db.prepare(`SELECT * FROM ${table} WHERE email = ?`).get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Incorrect email or password.' });
  req.session.user = { id: user.id, name: user.name, role };
  res.json({ user: req.session.user });
});
app.post('/api/auth/logout', (req, res) => req.session.destroy(() => res.status(204).end()));
app.get('/api/auth/me', (req, res) => res.json({ user: req.session.user || null }));

app.get('/api/customer/dashboard', requireCustomer, (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY id').all(req.session.user.id);
  const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 6').all(req.session.user.id);
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 3').all(req.session.user.id);
  res.json({ accounts, transactions, notifications });
});
app.post('/api/customer/transfers', requireCustomer, (req, res) => {
  const { accountId, recipientName, recipientAccount, recipientBank, amount, description } = req.body;
  const source = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(accountId, req.session.user.id);
  const settings = Object.fromEntries(db.prepare('SELECT setting_key, setting_value FROM system_settings').all().map(x => [x.setting_key, x.setting_value]));
  const numericAmount = Number(amount);
  if (!source || !recipientName || !recipientAccount || !recipientBank || !Number.isFinite(numericAmount) || numericAmount <= 0) return res.status(400).json({ error: 'Please provide complete valid transfer information.' });
  if (source.status !== 'ACTIVE') return res.status(403).json({ error: 'This account is suspended.' });
  if (settings.transfers_enabled !== 'true' || !source.transfers_enabled) return res.status(403).json({ error: 'Transfers are currently disabled in this simulation.' });
  if (numericAmount > source.available_balance) return res.status(400).json({ error: 'Your available balance is not enough for this transfer.' });
  const outcome = settings.default_transaction_result || 'COMPLETED';
  const reference = `AUR-${Date.now().toString().slice(-8)}`;
  const tx = db.prepare('INSERT INTO transactions (user_id, account_id, reference, recipient_name, recipient_account, recipient_bank, amount, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(req.session.user.id, source.id, reference, recipientName, recipientAccount, recipientBank, numericAmount, description || 'Simulated transfer', outcome);
  if (outcome === 'COMPLETED') db.prepare('UPDATE accounts SET balance = balance - ?, available_balance = available_balance - ? WHERE id = ?').run(numericAmount, numericAmount, source.id);
  db.prepare('INSERT INTO audit_logs (admin_id, action, detail) VALUES (NULL, ?, ?)').run('SIMULATED_TRANSFER', reference);
  res.status(201).json({ id: tx.lastInsertRowid, reference, status: outcome, message: outcome === 'COMPLETED' ? 'Your simulated transfer was successful.' : `Your simulated transfer is ${outcome.toLowerCase()}.` });
});
app.get('/api/customer/transactions/:id/receipt', requireCustomer, (req, res) => {
  const transaction = db.prepare('SELECT t.*, a.name AS sender_account, a.account_number FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE t.id = ? AND t.user_id = ?').get(req.params.id, req.session.user.id);
  if (!transaction) return res.status(404).json({ error: 'Receipt not found.' });
  res.json({ transaction, customer: req.session.user });
});

app.get('/api/admin/overview', requireAdmin, (req, res) => res.json({ customers: db.prepare('SELECT id, name, email FROM users').all(), accounts: db.prepare('SELECT a.*, u.name AS customer_name FROM accounts a JOIN users u ON u.id=a.user_id').all(), transactions: db.prepare('SELECT * FROM transactions ORDER BY created_at DESC').all(), settings: db.prepare('SELECT * FROM system_settings').all(), logs: db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 12').all() }));
app.patch('/api/admin/settings', requireAdmin, (req, res) => { const { key, value } = req.body; if (!['transfers_enabled', 'default_transaction_result'].includes(key)) return res.status(400).json({ error: 'Unknown simulation setting.' }); db.prepare('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?').run(String(value), key); db.prepare('INSERT INTO audit_logs (admin_id, action, detail) VALUES (?, ?, ?)').run(req.session.user.id, 'SETTINGS_UPDATED', `${key}=${value}`); res.json({ ok: true }); });
app.post('/api/admin/customers', requireAdmin, (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Enter a name, valid email, and a password with at least 8 characters.' });
  try { const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 12)); db.prepare('INSERT INTO audit_logs (admin_id, action, detail) VALUES (?, ?, ?)').run(req.session.user.id, 'CUSTOMER_CREATED', `customer_id=${result.lastInsertRowid}`); res.status(201).json({ id: Number(result.lastInsertRowid), name: name.trim(), email: email.trim().toLowerCase() }); } catch { res.status(409).json({ error: 'A customer already uses that email address.' }); }
});
app.post('/api/admin/accounts', requireAdmin, (req, res) => {
  const { userId, name, accountType, openingBalance = 0 } = req.body; const balance = Number(openingBalance);
  if (!Number.isInteger(Number(userId)) || !name?.trim() || !['CURRENT', 'SAVINGS', 'BUSINESS'].includes(accountType) || !Number.isFinite(balance) || balance < 0) return res.status(400).json({ error: 'Enter a customer, account name, supported type, and non-negative opening balance.' });
  if (!db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) return res.status(404).json({ error: 'Customer not found.' });
  const accountNumber = `20${String(Date.now()).slice(-8)}`;
  const result = db.prepare('INSERT INTO accounts (user_id, name, account_type, account_number, balance, available_balance) VALUES (?, ?, ?, ?, ?, ?)').run(userId, name.trim(), accountType, accountNumber, balance, balance);
  db.prepare('INSERT INTO audit_logs (admin_id, action, detail) VALUES (?, ?, ?)').run(req.session.user.id, 'ACCOUNT_CREATED', `account_id=${result.lastInsertRowid}`); res.status(201).json({ id: Number(result.lastInsertRowid), accountNumber });
});
app.patch('/api/admin/accounts/:id', requireAdmin, (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id); if (!account) return res.status(404).json({ error: 'Account not found.' });
  const { status, transfersEnabled, balance } = req.body; const updates = []; const parameters = [];
  if (status !== undefined) { if (!['ACTIVE', 'SUSPENDED'].includes(status)) return res.status(400).json({ error: 'Unsupported account status.' }); updates.push('status = ?'); parameters.push(status); }
  if (transfersEnabled !== undefined) { updates.push('transfers_enabled = ?'); parameters.push(transfersEnabled ? 1 : 0); }
  if (balance !== undefined) { const amount = Number(balance); if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'Balance must be zero or greater.' }); updates.push('balance = ?, available_balance = ?'); parameters.push(amount, amount); }
  if (!updates.length) return res.status(400).json({ error: 'Choose an account setting to update.' });
  parameters.push(account.id); db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`).run(...parameters); db.prepare('INSERT INTO audit_logs (admin_id, action, detail) VALUES (?, ?, ?)').run(req.session.user.id, 'ACCOUNT_UPDATED', `account_id=${account.id}`); res.json({ ok: true });
});
app.listen(process.env.PORT || 3000, () => console.log(`Aurum Sim is running at http://localhost:${process.env.PORT || 3000}`));
