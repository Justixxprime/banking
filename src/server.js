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
app.use(express.static(path.join(__dirname, '../public')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
// Health check for the host. It must NOT touch the database, or it would keep the free database awake all day.
app.get('/healthz', (req, res) => res.json({ ok: true }));

const requireCustomer = (req, res, next) => (!req.session.user || req.session.user.role !== 'customer') ? res.status(401).json({ error: 'Please sign in as a customer.' }) : next();
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

app.get('/api/customer/dashboard', requireCustomer, wrap(async (req, res) => {
  const uid = req.session.user.id;
  const [accounts, transactions, notifications] = await Promise.all([
    query('SELECT * FROM accounts WHERE user_id = $1 ORDER BY id', [uid]),
    query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 6', [uid]),
    query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 3', [uid])
  ]);
  res.json({ accounts: accounts.rows, transactions: transactions.rows, notifications: notifications.rows });
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
    if (settings.transfers_enabled !== 'true' || !source.transfers_enabled) throw new HttpError(403, 'Transfers are currently disabled in this simulation.');
    if (numericAmount > source.available_balance) throw new HttpError(400, 'Your available balance is not enough for this transfer.');
    const outcome = settings.default_transaction_result || 'COMPLETED';
    const reference = `AUR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { rows: [tx] } = await client.query(
      'INSERT INTO transactions (user_id, account_id, reference, recipient_name, recipient_account, recipient_bank, amount, description, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [uid, source.id, reference, text(recipientName), text(recipientAccount), text(recipientBank), numericAmount, text(description) || 'Simulated transfer', outcome]);
    if (outcome === 'COMPLETED') await client.query('UPDATE accounts SET balance = balance - $1, available_balance = available_balance - $1 WHERE id = $2', [numericAmount, source.id]);
    await audit(client, null, 'SIMULATED_TRANSFER', reference);
    return { id: tx.id, reference, status: outcome };
  });
  res.status(201).json({ ...result, message: result.status === 'COMPLETED' ? 'Your simulated transfer was successful.' : `Your simulated transfer is ${result.status.toLowerCase()}.` });
}));

app.get('/api/customer/transactions/:id/receipt', requireCustomer, wrap(async (req, res) => {
  const id = toId(req.params.id);
  const { rows: [transaction] } = id ? await query('SELECT t.*, a.name AS sender_account, a.account_number FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE t.id = $1 AND t.user_id = $2', [id, req.session.user.id]) : { rows: [] };
  if (!transaction) throw new HttpError(404, 'Receipt not found.');
  res.json({ transaction, customer: req.session.user });
}));

app.get('/api/admin/overview', requireAdmin, wrap(async (req, res) => {
  const [customers, accounts, transactions, settings, logs] = await Promise.all([
    query('SELECT id, name, email, status FROM users ORDER BY id'),
    query('SELECT a.*, u.name AS customer_name FROM accounts a JOIN users u ON u.id = a.user_id ORDER BY a.id'),
    query('SELECT * FROM transactions ORDER BY created_at DESC, id DESC'),
    query('SELECT * FROM system_settings ORDER BY setting_key'),
    query('SELECT * FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 12')
  ]);
  res.json({ customers: customers.rows, accounts: accounts.rows, transactions: transactions.rows, settings: settings.rows, logs: logs.rows });
}));

app.patch('/api/admin/settings', requireAdmin, wrap(async (req, res) => {
  const { key, value } = req.body || {};
  const allowed = { transfers_enabled: ['true', 'false'], default_transaction_result: ['COMPLETED', 'FAILED', 'PENDING', 'PROCESSING'] };
  if (!allowed[key]) throw new HttpError(400, 'Unknown simulation setting.');
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
  if (!sets.length) throw new HttpError(400, 'Choose an account setting to update.');
  await withTransaction(async client => {
    values.push(id);
    const result = id ? await client.query(`UPDATE accounts SET ${sets.join(', ')} WHERE id = $${values.length}`, values) : { rowCount: 0 };
    if (!result.rowCount) throw new HttpError(404, 'Account not found.');
    await audit(client, req.session.user.id, 'ACCOUNT_UPDATED', `account_id=${id}; ${changes.join(', ')}`);
  });
  res.json({ ok: true });
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
  return app.listen(port, () => console.log(`Aurum Sim is running on port ${port}${isProduction ? '' : ` - open http://localhost:${port}`}`));
}

if (require.main === module) {
  start().catch(error => {
    console.error(`\nAurum Sim could not start: ${error.message}\nCheck that DATABASE_URL in your .env file is the full Neon connection string.\n`);
    process.exit(1);
  });
}
module.exports = { app, start };
