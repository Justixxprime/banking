require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { pool, query, withTransaction, audit, initializeDatabase, seedDatabase } = require('./database');

const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && (!sessionSecret || sessionSecret.length < 32 || sessionSecret.startsWith('replace-this'))) {
  console.error('SESSION_SECRET must be set to a random value of at least 32 characters when NODE_ENV=production.');
  process.exit(1);
}
if (isProduction && process.env.SEED_DEMO_DATA !== 'false') {
  console.error('SEED_DEMO_DATA must be false when NODE_ENV=production.');
  process.exit(1);
}
if (isProduction && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 10)) {
  console.error('ADMIN_EMAIL and a 10+ character ADMIN_PASSWORD must be set when NODE_ENV=production.');
  process.exit(1);
}

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const toId = value => { const n = Number(value); return Number.isInteger(n) && n > 0 && n < 2147483647 ? n : null; };
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const roundMoney = value => Math.round(Number(value) * 100) / 100;
const MAX_MONEY = 1000000000;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // keeps sign-in timing similar for unknown emails

const app = express();
app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1); // Render sits in front of the app and terminates HTTPS
// The interface uses inline click handlers, so a strict Content-Security-Policy is switched off for now.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50kb' }));
app.use(session({
  store: new PgStore({ pool, tableName: 'session', pruneSessionInterval: false }),
  name: 'aurum.sid',
  secret: sessionSecret || 'development-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
// The page and the bundle must revalidate on every load, so a browser can never keep stale markup
// or stale front-end code after a deploy. Long-lived caching stays available for fingerprinted assets.
app.use(express.static(path.join(__dirname, '../public'), { setHeaders: response => response.setHeader('Cache-Control', 'no-cache') }));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html'), { headers: { 'Cache-Control': 'no-cache' } }));
// Health check for the host. It must NOT touch the database, or it would keep the free database awake all day.
app.get('/healthz', (req, res) => res.json({ ok: true }));

const requireCustomer = wrap(async (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'customer') return res.status(401).json({ error: 'Please sign in as a customer.' });
  const { rows: [row] } = await query('SELECT status FROM users WHERE id = $1', [req.session.user.id]);
  if (!row || row.status !== 'ACTIVE') { await new Promise(resolve => req.session.destroy(resolve)); return res.status(401).json({ error: 'Your session has ended. Please sign in again.' }); }
  next();
});
const requireAdmin = (req, res, next) => (!req.session.user || req.session.user.role !== 'admin') ? res.status(401).json({ error: 'Administrator access is required.' }) : next();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' } });

app.post('/api/auth/login', loginLimiter, wrap(async (req, res) => {
  const { password, role = 'customer' } = req.body || {};
  const email = normalizeEmail(req.body?.email);
  if (!['customer', 'admin'].includes(role)) throw new HttpError(400, 'Unsupported sign-in type.');
  if (!email || typeof password !== 'string') throw new HttpError(400, 'Enter your email address and password.');
  const table = role === 'admin' ? 'admin_users' : 'users';
  const { rows: [user] } = await query(`SELECT * FROM ${table} WHERE email = $1`, [email]);
  const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !passwordMatches) throw new HttpError(401, 'Incorrect email or password.');
  if (role === 'customer' && user.status !== 'ACTIVE') throw new HttpError(403, 'This profile is suspended. Please contact support.');
  await new Promise((resolve, reject) => req.session.regenerate(error => (error ? reject(error) : resolve())));
  req.session.user = { id: user.id, name: user.name, role };
  res.json({ user: req.session.user });
}));
app.post('/api/auth/logout', (req, res) => req.session.destroy(() => { res.clearCookie('aurum.sid'); res.status(204).end(); }));
app.get('/api/auth/me', (req, res) => res.json({ user: req.session.user || null }));

const endSessions = (role, id, keepSid = '') => query(`DELETE FROM "session" WHERE sess->'user'->>'role' = $1 AND sess->'user'->>'id' = $2 AND sid <> $3`, [role, String(id), keepSid]);
async function changePassword(table, id, current, next, minLength) {
  if (typeof next !== 'string' || next.length < minLength || next.length > 100) throw new HttpError(400, `The new password must be ${minLength}-100 characters.`);
  const { rows: [row] } = await query(`SELECT password_hash FROM ${table} WHERE id = $1`, [id]);
  if (!row || typeof current !== 'string' || !(await bcrypt.compare(current, row.password_hash))) throw new HttpError(403, 'Your current password is incorrect.');
  await query(`UPDATE ${table} SET password_hash = $1, updated_at = now() WHERE id = $2`, [await bcrypt.hash(next, 12), id]);
}
// Optional short text: returns null when the value is too long or not text.
const textField = (value, max) => (typeof value === 'string' && value.trim().length <= max ? value.trim() : null);
const PROFILE_FIELDS = { phone: 30, address: 120, city: 60, country: 60 };

app.get('/api/customer/profile', requireCustomer, wrap(async (req, res) => {
  const { rows: [profile] } = await query('SELECT id, name, email, phone, address, city, country FROM users WHERE id = $1', [req.session.user.id]);
  res.json({ profile });
}));
app.patch('/api/customer/profile', requireCustomer, wrap(async (req, res) => {
  const body = req.body || {};
  const name = textField(body.name, 80);
  if (!name) throw new HttpError(400, 'Enter your name (up to 80 characters).');
  const values = [name]; const sets = ['name = $1'];
  for (const [field, max] of Object.entries(PROFILE_FIELDS)) {
    const value = body[field] === undefined ? undefined : textField(body[field], max);
    if (value === null) throw new HttpError(400, `${field} is too long.`);
    if (value !== undefined) { values.push(value || null); sets.push(`${field} = $${values.length}`); }
  }
  values.push(req.session.user.id);
  await query(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
  await audit(pool, null, 'CUSTOMER_PROFILE_UPDATED', `customer_id=${req.session.user.id}`);
  req.session.user.name = name;
  res.json({ ok: true, name });
}));
app.post('/api/customer/security/password', requireCustomer, wrap(async (req, res) => {
  await changePassword('users', req.session.user.id, req.body?.currentPassword, req.body?.newPassword, 8);
  await endSessions('customer', req.session.user.id, req.sessionID);
  await query('INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)', [req.session.user.id, 'Password changed', 'Your password was changed and other devices were signed out.']);
  await audit(pool, null, 'CUSTOMER_PASSWORD_CHANGED', `customer_id=${req.session.user.id}`);
  res.json({ ok: true });
}));
app.post('/api/customer/security/sign-out-others', requireCustomer, wrap(async (req, res) => {
  await endSessions('customer', req.session.user.id, req.sessionID);
  res.json({ ok: true });
}));

app.get('/api/customer/dashboard', requireCustomer, wrap(async (req, res) => {
  const uid = req.session.user.id;
  const [accounts, transactions, notifications] = await Promise.all([
    query('SELECT * FROM accounts WHERE user_id = $1 ORDER BY id', [uid]),
    query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 6', [uid]),
    query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 3', [uid])
  ]);
  res.json({ accounts: accounts.rows, transactions: transactions.rows, notifications: notifications.rows });
}));

app.get('/api/customer/notifications', requireCustomer, wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const [rows, total] = await Promise.all([
    query('SELECT id, title, body, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3', [req.session.user.id, limit, offset]),
    query('SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1', [req.session.user.id])
  ]);
  res.json({ notifications: rows.rows, total: total.rows[0].count, limit, offset });
}));

app.get('/api/customer/statements', requireCustomer, wrap(async (req, res) => {
  const accountId = toId(req.query.accountId);
  if (!accountId) throw new HttpError(400, 'Choose one of your accounts.');
  const parseDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const to = req.query.to ? parseDate(req.query.to) : new Date();
  const from = req.query.from ? parseDate(req.query.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (!from || !to || from > to || to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) throw new HttpError(400, 'Choose a valid statement range of up to 366 days.');
  const { rows: [account] } = await query('SELECT id, name, account_type, account_number, balance, available_balance FROM accounts WHERE id = $1 AND user_id = $2', [accountId, req.session.user.id]);
  if (!account) throw new HttpError(404, 'Account not found.');
  const transactions = await query('SELECT id, reference, recipient_name, recipient_account, recipient_bank, amount, description, status, created_at FROM transactions WHERE account_id = $1 AND user_id = $2 AND created_at >= $3 AND created_at < $4 ORDER BY created_at DESC, id DESC', [accountId, req.session.user.id, from.toISOString(), new Date(to.getTime() + 24 * 60 * 60 * 1000).toISOString()]);
  res.json({ account, transactions: transactions.rows, period: { from: from.toISOString(), to: to.toISOString() }, generatedAt: new Date().toISOString() });
}));

app.post('/api/customer/transfers', requireCustomer, wrap(async (req, res) => {
  const { accountId, recipientName, recipientAccount, recipientBank, amount, description } = req.body || {};
  const text = value => (typeof value === 'string' ? value.trim() : '');
  const numericAmount = roundMoney(amount);
  const sourceId = toId(accountId);
  if (!sourceId || !text(recipientName) || !text(recipientAccount) || !text(recipientBank) || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > MAX_MONEY || text(recipientName).length > 80 || text(recipientAccount).length > 40 || text(recipientBank).length > 80 || text(description).length > 140) {
    throw new HttpError(400, 'Please provide complete valid transfer information.');
  }
  const uid = req.session.user.id;
  const result = await withTransaction(async client => {
    // FOR UPDATE locks this account row so two simultaneous transfers cannot overspend it.
    const { rows: [source] } = await client.query('SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE', [sourceId, uid]);
    if (!source) throw new HttpError(400, 'Please provide complete valid transfer information.');
    const settings = Object.fromEntries((await client.query('SELECT setting_key, setting_value FROM system_settings')).rows.map(row => [row.setting_key, row.setting_value]));
    if (source.status !== 'ACTIVE') throw new HttpError(403, 'This account is suspended.');
    if (settings.transfers_enabled !== 'true' || !source.transfers_enabled) throw new HttpError(403, 'Transfers are temporarily unavailable.');
    if (numericAmount > source.available_balance) throw new HttpError(400, 'Your available balance is not enough for this transfer.');
    const outcome = settings.default_transaction_result || 'COMPLETED';
    const reference = `AUR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { rows: [tx] } = await client.query(
      'INSERT INTO transactions (user_id, account_id, reference, recipient_name, recipient_account, recipient_bank, amount, description, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [uid, source.id, reference, text(recipientName), text(recipientAccount), text(recipientBank), numericAmount, text(description) || 'Outgoing transfer', outcome]);
    if (outcome === 'COMPLETED') await client.query('UPDATE accounts SET balance = balance - $1, available_balance = available_balance - $1 WHERE id = $2', [numericAmount, source.id]);
    await audit(client, null, 'TRANSFER_CREATED', reference);
    return { id: tx.id, reference, status: outcome };
  });
  res.status(201).json({ ...result, message: result.status === 'COMPLETED' ? 'Your transfer was successful.' : `Your transfer is ${result.status.toLowerCase()}.` });
}));

app.get('/api/customer/transactions/:id/receipt', requireCustomer, wrap(async (req, res) => {
  const id = toId(req.params.id);
  const { rows: [transaction] } = id ? await query('SELECT t.*, a.name AS sender_account, a.account_number FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE t.id = $1 AND t.user_id = $2', [id, req.session.user.id]) : { rows: [] };
  if (!transaction) throw new HttpError(404, 'Receipt not found.');
  res.json({ transaction, customer: req.session.user });
}));

const TRANSACTION_STATUSES = ['COMPLETED', 'FAILED', 'PENDING', 'PROCESSING'];
const transactionText = (value, max) => (typeof value === 'string' && value.trim().length <= max ? value.trim() : '');
const transactionTimestamp = value => {
  if (typeof value !== 'string' || !value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
};
function adminTransactionInput(body, { requireAccount = true, requireCreatedAt = true } = {}) {
  const accountId = toId(body?.accountId);
  const amount = roundMoney(body?.amount);
  const recipientName = transactionText(body?.recipientName, 80);
  const recipientAccount = transactionText(body?.recipientAccount, 40);
  const recipientBank = transactionText(body?.recipientBank, 80);
  const description = transactionText(body?.description, 140);
  const status = body?.status;
  const createdAt = transactionTimestamp(body?.createdAt);
  if ((requireAccount && !accountId) || !Number.isFinite(amount) || amount <= 0 || amount > MAX_MONEY || !recipientName || !recipientAccount || !recipientBank || !description || !TRANSACTION_STATUSES.includes(status) || (requireCreatedAt && !createdAt)) {
    throw new HttpError(400, 'Enter an account, recipient details, amount, status, description, and a valid date and time.');
  }
  return { accountId, amount, recipientName, recipientAccount, recipientBank, description, status, createdAt };
}

async function applyTransactionRecord(client, previous, next) {
  const affectedIds = [...new Set([previous?.account_id, next.accountId].filter(Boolean))].sort((a, b) => a - b);
  const { rows: accounts } = await client.query(
    'SELECT id, user_id, balance, available_balance FROM accounts WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
    [affectedIds]
  );
  const byId = new Map(accounts.map(account => [account.id, account]));
  const source = byId.get(next.accountId);
  if (!source) throw new HttpError(404, 'Account not found.');
  const changes = new Map();
  if (previous?.status === 'COMPLETED') changes.set(previous.account_id, (changes.get(previous.account_id) || 0) + Number(previous.amount));
  if (next.status === 'COMPLETED') changes.set(next.accountId, (changes.get(next.accountId) || 0) - next.amount);
  for (const [accountId, adjustment] of changes) {
    const account = byId.get(accountId);
    if (!account || Number(account.balance) + adjustment < 0 || Number(account.available_balance) + adjustment < 0) {
      throw new HttpError(400, 'This completed record would make the account balance negative.');
    }
  }
  for (const [accountId, adjustment] of changes) {
    if (adjustment) await client.query('UPDATE accounts SET balance = balance + $1, available_balance = available_balance + $1 WHERE id = $2', [adjustment, accountId]);
  }
  return source;
}

app.get('/api/admin/transactions', requireAdmin, wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : null;
  if (status && !TRANSACTION_STATUSES.includes(status)) throw new HttpError(400, 'Unsupported transaction status filter.');
  const customerId = req.query.customerId ? toId(req.query.customerId) : null;
  if (req.query.customerId && !customerId) throw new HttpError(400, 'Customer filter is invalid.');
  const where = 'WHERE ($1::text IS NULL OR t.status = $1) AND ($2::int IS NULL OR t.user_id = $2)';
  const [rows, total] = await Promise.all([
    query(`SELECT t.*, u.name AS customer_name, u.email AS customer_email, a.name AS sender_account, a.account_number FROM transactions t JOIN users u ON u.id = t.user_id JOIN accounts a ON a.id = t.account_id ${where} ORDER BY t.created_at DESC, t.id DESC LIMIT $3 OFFSET $4`, [status, customerId, limit, offset]),
    query(`SELECT COUNT(*) AS count FROM transactions t ${where}`, [status, customerId])
  ]);
  res.json({ transactions: rows.rows, total: total.rows[0].count, limit, offset });
}));

app.post('/api/admin/transactions', requireAdmin, wrap(async (req, res) => {
  const next = adminTransactionInput(req.body);
  const created = await withTransaction(async client => {
    const source = await applyTransactionRecord(client, null, next);
    const reference = `AUR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { rows: [record] } = await client.query(
      'INSERT INTO transactions (user_id, account_id, reference, recipient_name, recipient_account, recipient_bank, amount, description, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()) RETURNING id, reference',
      [source.user_id, next.accountId, reference, next.recipientName, next.recipientAccount, next.recipientBank, next.amount, next.description, next.status, next.createdAt]
    );
    await client.query('INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)', [source.user_id, 'Transaction record added', `A ${next.status.toLowerCase()} transaction was added to your activity.`]);
    await audit(client, req.session.user.id, 'ADMIN_TRANSACTION_CREATED', `transaction_id=${record.id}; account_id=${next.accountId}; amount=${next.amount.toFixed(2)}; status=${next.status}`);
    return record;
  });
  res.status(201).json(created);
}));

app.patch('/api/admin/transactions/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw new HttpError(404, 'Transaction not found.');
  const next = adminTransactionInput(req.body);
  await withTransaction(async client => {
    const { rows: [previous] } = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]);
    if (!previous) throw new HttpError(404, 'Transaction not found.');
    const source = await applyTransactionRecord(client, previous, next);
    await client.query('UPDATE transactions SET user_id = $1, account_id = $2, recipient_name = $3, recipient_account = $4, recipient_bank = $5, amount = $6, description = $7, status = $8, created_at = $9, updated_at = now() WHERE id = $10', [source.user_id, next.accountId, next.recipientName, next.recipientAccount, next.recipientBank, next.amount, next.description, next.status, next.createdAt, id]);
    await client.query('INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)', [source.user_id, 'Transaction record updated', `Transaction record (${previous.reference}) was updated by an administrator.`]);
    await audit(client, req.session.user.id, 'ADMIN_TRANSACTION_UPDATED', `transaction_id=${id}; account_id=${next.accountId}; amount=${next.amount.toFixed(2)}; status=${next.status}; date_time_changed`);
  });
  res.json({ ok: true });
}));

app.get('/api/admin/transactions/:id/receipt', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  const { rows: [transaction] } = id ? await query('SELECT t.*, a.name AS sender_account, a.account_number, u.name AS customer_name, u.email AS customer_email FROM transactions t JOIN accounts a ON a.id = t.account_id JOIN users u ON u.id = t.user_id WHERE t.id = $1', [id]) : { rows: [] };
  if (!transaction) throw new HttpError(404, 'Receipt not found.');
  res.json({ transaction, customer: { id: transaction.user_id, name: transaction.customer_name, email: transaction.customer_email } });
}));

app.get('/api/admin/overview', requireAdmin, wrap(async (req, res) => {
  const [customers, accounts, transactions, settings, logs, administrators] = await Promise.all([
    query('SELECT id, name, email, status FROM users ORDER BY id'),
    query('SELECT a.*, u.name AS customer_name FROM accounts a JOIN users u ON u.id = a.user_id ORDER BY a.id'),
    query('SELECT * FROM transactions ORDER BY created_at DESC, id DESC'),
    query('SELECT * FROM system_settings ORDER BY setting_key'),
    query('SELECT * FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 12'),
    query('SELECT id, name, email, created_at, updated_at FROM admin_users ORDER BY id')
  ]);
  res.json({ customers: customers.rows, accounts: accounts.rows, transactions: transactions.rows, settings: settings.rows, logs: logs.rows, administrators: administrators.rows });
}));

app.patch('/api/admin/settings', requireAdmin, wrap(async (req, res) => {
  const { key, value } = req.body || {};
  const allowed = { transfers_enabled: ['true', 'false'], default_transaction_result: ['COMPLETED', 'FAILED', 'PENDING', 'PROCESSING'] };
  if (!allowed[key]) throw new HttpError(400, 'Unknown system setting.');
  if (!allowed[key].includes(String(value))) throw new HttpError(400, 'Unsupported value for this setting.');
  await withTransaction(async client => {
    await client.query('UPDATE system_settings SET setting_value = $1 WHERE setting_key = $2', [String(value), key]);
    await audit(client, req.session.user.id, 'SETTINGS_UPDATED', `${key}=${value}`);
  });
  res.json({ ok: true });
}));

app.post('/api/admin/customers', requireAdmin, wrap(async (req, res) => {
  const { name, password } = req.body || {};
  const email = normalizeEmail(req.body?.email);
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'Enter a name, valid email, and a password with at least 8 characters.');
  try {
    const hash = await bcrypt.hash(password, 12);
    const customer = await withTransaction(async client => {
      const { rows: [row] } = await client.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id', [name.trim(), email, hash]);
      await audit(client, req.session.user.id, 'CUSTOMER_CREATED', `customer_id=${row.id}`);
      return row;
    });
    res.status(201).json({ id: customer.id, name: name.trim(), email });
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'A customer already uses that email address.');
    throw error;
  }
}));

app.post('/api/admin/accounts', requireAdmin, wrap(async (req, res) => {
  const { userId, name, accountType, openingBalance = 0 } = req.body || {};
  const balance = roundMoney(openingBalance);
  const ownerId = toId(userId);
  if (!ownerId || typeof name !== 'string' || !name.trim() || name.trim().length > 80 || !['CURRENT', 'SAVINGS', 'BUSINESS'].includes(accountType) || !Number.isFinite(balance) || balance < 0 || balance > MAX_MONEY) throw new HttpError(400, 'Enter a customer, account name, supported type, and non-negative opening balance.');
  if (!(await query('SELECT id FROM users WHERE id = $1', [ownerId])).rows.length) throw new HttpError(404, 'Customer not found.');
  for (let attempt = 0; attempt < 5; attempt++) {
    const accountNumber = `20${String(crypto.randomInt(0, 100000000)).padStart(8, '0')}`;
    try {
      const account = await withTransaction(async client => {
        const { rows: [row] } = await client.query('INSERT INTO accounts (user_id, name, account_type, account_number, balance, available_balance) VALUES ($1, $2, $3, $4, $5, $5) RETURNING id', [ownerId, name.trim(), accountType, accountNumber, balance]);
        await audit(client, req.session.user.id, 'ACCOUNT_CREATED', `account_id=${row.id}`);
        return row;
      });
      return res.status(201).json({ id: account.id, accountNumber });
    } catch (error) {
      if (error.code !== '23505') throw error; // account number clash: try another number
    }
  }
  throw new HttpError(500, 'Could not generate a unique account number. Please try again.');
}));

app.patch('/api/admin/accounts/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  const { status, transfersEnabled, balance } = req.body || {};
  const sets = []; const values = []; const changes = [];
  const add = (column, value) => { values.push(value); sets.push(`${column} = $${values.length}`); };
  if (status !== undefined) { if (!['ACTIVE', 'SUSPENDED'].includes(status)) throw new HttpError(400, 'Unsupported account status.'); add('status', status); changes.push(`status=${status}`); }
  if (transfersEnabled !== undefined) { add('transfers_enabled', Boolean(transfersEnabled)); changes.push(`transfers_enabled=${Boolean(transfersEnabled)}`); }
  if (balance !== undefined) { const amount = roundMoney(balance); if (!Number.isFinite(amount) || amount < 0 || amount > MAX_MONEY) throw new HttpError(400, 'Balance must be zero or greater.'); add('balance', amount); add('available_balance', amount); changes.push(`balance=${amount.toFixed(2)}`); }
  if (req.body?.name !== undefined) { const accountName = textField(req.body.name, 80); if (!accountName) throw new HttpError(400, 'Enter a valid account name.'); add('name', accountName); changes.push('name'); }
  if (req.body?.accountType !== undefined) { if (!['CURRENT', 'SAVINGS', 'BUSINESS'].includes(req.body.accountType)) throw new HttpError(400, 'Unsupported account type.'); add('account_type', req.body.accountType); changes.push(`account_type=${req.body.accountType}`); }
  if (!sets.length) throw new HttpError(400, 'Choose an account setting to update.');
  await withTransaction(async client => {
    values.push(id);
    const result = id ? await client.query(`UPDATE accounts SET ${sets.join(', ')} WHERE id = $${values.length}`, values) : { rowCount: 0 };
    if (!result.rowCount) throw new HttpError(404, 'Account not found.');
    await audit(client, req.session.user.id, 'ACCOUNT_UPDATED', `account_id=${id}; ${changes.join(', ')}`);
  });
  res.json({ ok: true });
}));

app.get('/api/admin/profile', requireAdmin, wrap(async (req, res) => {
  const { rows: [profile] } = await query('SELECT id, name, email FROM admin_users WHERE id = $1', [req.session.user.id]);
  res.json({ profile });
}));
app.patch('/api/admin/profile', requireAdmin, wrap(async (req, res) => {
  const name = textField(req.body?.name, 80); const email = normalizeEmail(req.body?.email);
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a name and a valid email address.');
  try {
    await withTransaction(async client => {
      await client.query('UPDATE admin_users SET name = $1, email = $2, updated_at = now() WHERE id = $3', [name, email, req.session.user.id]);
      await audit(client, req.session.user.id, 'ADMIN_PROFILE_UPDATED', `admin_id=${req.session.user.id}`);
    });
  } catch (error) { if (error.code === '23505') throw new HttpError(409, 'That email address is already used.'); throw error; }
  req.session.user.name = name;
  res.json({ ok: true, name });
}));
app.post('/api/admin/security/password', requireAdmin, wrap(async (req, res) => {
  await changePassword('admin_users', req.session.user.id, req.body?.currentPassword, req.body?.newPassword, 10);
  await endSessions('admin', req.session.user.id, req.sessionID);
  await audit(pool, req.session.user.id, 'ADMIN_PASSWORD_CHANGED', `admin_id=${req.session.user.id}`);
  res.json({ ok: true });
}));

app.post('/api/admin/administrators', requireAdmin, wrap(async (req, res) => {
  const name = textField(req.body?.name, 80); const email = normalizeEmail(req.body?.email); const password = req.body?.password;
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 10 || password.length > 100) {
    throw new HttpError(400, 'Enter a name, valid email, and a 10-100 character password.');
  }
  try {
    const administrator = await withTransaction(async client => {
      const { rows: [row] } = await client.query('INSERT INTO admin_users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email', [name, email, await bcrypt.hash(password, 12)]);
      await audit(client, req.session.user.id, 'ADMINISTRATOR_CREATED', `administrator_id=${row.id}`);
      return row;
    });
    res.status(201).json({ administrator });
  } catch (error) { if (error.code === '23505') throw new HttpError(409, 'That email address is already used.'); throw error; }
}));

app.patch('/api/admin/administrators/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id); const body = req.body || {}; const sets = []; const values = []; const changed = [];
  const add = (column, value) => { values.push(value); sets.push(`${column} = $${values.length}`); changed.push(column); };
  if (body.name !== undefined) { const name = textField(body.name, 80); if (!name) throw new HttpError(400, 'Enter a valid name.'); add('name', name); }
  if (body.email !== undefined) { const email = normalizeEmail(body.email); if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.'); add('email', email); }
  if (body.password !== undefined) { if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 100) throw new HttpError(400, 'A reset password needs 10-100 characters.'); add('password_hash', await bcrypt.hash(body.password, 12)); changed[changed.length - 1] = 'password_reset'; }
  if (!sets.length) throw new HttpError(400, 'Choose something to update.');
  try {
    await withTransaction(async client => {
      values.push(id);
      const result = id ? await client.query(`UPDATE admin_users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values) : { rowCount: 0 };
      if (!result.rowCount) throw new HttpError(404, 'Administrator not found.');
      await audit(client, req.session.user.id, 'ADMINISTRATOR_UPDATED', `administrator_id=${id}; ${changed.join(', ')}`);
    });
  } catch (error) { if (error.code === '23505') throw new HttpError(409, 'That email address is already used.'); throw error; }
  if (body.password !== undefined) await endSessions('admin', id, id === req.session.user.id ? req.sessionID : '');
  if (id === req.session.user.id && body.name !== undefined) req.session.user.name = textField(body.name, 80);
  res.json({ ok: true, name: req.session.user.name });
}));

app.get('/api/admin/customers/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  const { rows: [customer] } = id ? await query('SELECT id, name, email, status, phone, address, city, country, created_at FROM users WHERE id = $1', [id]) : { rows: [] };
  if (!customer) throw new HttpError(404, 'Customer not found.');
  const accounts = await query('SELECT * FROM accounts WHERE user_id = $1 ORDER BY id', [id]);
  res.json({ customer, accounts: accounts.rows });
}));
app.patch('/api/admin/customers/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id); const body = req.body || {};
  const sets = []; const values = []; const changed = [];
  const add = (column, value) => { values.push(value); sets.push(`${column} = $${values.length}`); changed.push(column); };
  if (body.name !== undefined) { const name = textField(body.name, 80); if (!name) throw new HttpError(400, 'Enter a valid name.'); add('name', name); }
  if (body.email !== undefined) { const email = normalizeEmail(body.email); if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.'); add('email', email); }
  if (body.status !== undefined) { if (!['ACTIVE', 'SUSPENDED'].includes(body.status)) throw new HttpError(400, 'Unsupported customer status.'); add('status', body.status); }
  for (const [field, max] of Object.entries(PROFILE_FIELDS)) if (body[field] !== undefined) { const value = textField(body[field], max); if (value === null) throw new HttpError(400, `${field} is too long.`); add(field, value || null); }
  if (body.password !== undefined) { if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 100) throw new HttpError(400, 'A reset password needs 8-100 characters.'); add('password_hash', await bcrypt.hash(body.password, 12)); changed[changed.length - 1] = 'password_reset'; }
  if (!sets.length) throw new HttpError(400, 'Choose something to update.');
  try {
    await withTransaction(async client => {
      values.push(id);
      const result = id ? await client.query(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values) : { rowCount: 0 };
      if (!result.rowCount) throw new HttpError(404, 'Customer not found.');
      await audit(client, req.session.user.id, 'CUSTOMER_UPDATED', `customer_id=${id}; ${changed.join(', ')}${body.status ? `; status=${body.status}` : ''}`);
    });
  } catch (error) { if (error.code === '23505') throw new HttpError(409, 'That email address is already used.'); throw error; }
  if (body.status === 'SUSPENDED' || body.password !== undefined) await endSessions('customer', id);
  res.json({ ok: true });
}));
app.get('/api/admin/audit', requireAdmin, wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const action = typeof req.query.action === 'string' && req.query.action ? req.query.action.slice(0, 60) : null;
  const [rows, total] = await Promise.all([
    query('SELECT l.*, a.name AS admin_name FROM audit_logs l LEFT JOIN admin_users a ON a.id = l.admin_id WHERE ($1::text IS NULL OR l.action = $1) ORDER BY l.created_at DESC, l.id DESC LIMIT $2 OFFSET $3', [action, limit, offset]),
    query('SELECT COUNT(*) AS count FROM audit_logs WHERE ($1::text IS NULL OR action = $1)', [action])
  ]);
  res.json({ logs: rows.rows, total: total.rows[0].count, limit, offset });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') return res.status(error.status || 400).json({ error: 'That request could not be read.' });
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

async function start() {
  await initializeDatabase();
  await seedDatabase();
  const removeExpiredSessions = () => pool.query('DELETE FROM "session" WHERE expire < now()').catch(error => console.error('Session cleanup failed:', error.message));
  await removeExpiredSessions();
  setInterval(removeExpiredSessions, 6 * 60 * 60 * 1000).unref();
  const port = process.env.PORT || 3000;
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Aurum is running on port ${port}${isProduction ? '' : ` - open http://localhost:${port}`}`);
      resolve(server);
    });
    server.once('error', error => {
      if (error.code === 'EADDRINUSE') return reject(new Error(`Port ${port} is already in use. Stop the existing Node server first, then run npm start again.`));
      reject(error);
    });
  });
}

if (require.main === module) {
  start().catch(error => {
    console.error(`\nAurum could not start: ${error.message}\nCheck that DATABASE_URL in your .env file is the full Neon connection string.\n`);
    process.exit(1);
  });
}
module.exports = { app, start };
