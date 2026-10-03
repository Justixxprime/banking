require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const WORLD = require('../public/world.js');
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
// Compress pages, scripts and styles so the app loads much faster on phones.
// Optional: if the package is not installed yet the app still works. Install it with: npm install
try { app.use(require('compression')()); } catch { /* run npm install to enable faster loading */ }
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
// ---- public market data (crypto + stocks), cached for 60 seconds ----
const MARKET = { at: 0, data: null };
const STOCKS = [['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['NVDA', 'NVIDIA'], ['TSLA', 'Tesla'], ['AMZN', 'Amazon'], ['GOOGL', 'Alphabet'], ['JPM', 'JPMorgan Chase']];
const INDICES = [['^GSPC', 'S&P 500'], ['^IXIC', 'Nasdaq'], ['^DJI', 'Dow Jones']];
const sampleSeries = (base, vol, n = 48) => Array.from({ length: n }, (_, i) => +(base * (1 + Math.sin(i / 5) * vol + Math.cos(i / 11) * vol / 2)).toFixed(2));
const fetchJson = async url => { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(7000) }); if (!r.ok) throw new Error('bad status'); return r.json(); };
const CRYPTO = [['bitcoin', 'BTC', 'Bitcoin'], ['ethereum', 'ETH', 'Ethereum'], ['solana', 'SOL', 'Solana'], ['ripple', 'XRP', 'XRP'], ['dogecoin', 'DOGE', 'Dogecoin'], ['cardano', 'ADA', 'Cardano']];
const cryptoGecko = async () => ({ source: 'CoinGecko', stepMs: 2 * 3600e3, list: (await fetchJson('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + CRYPTO.map(c => c[0]).join(',') + '&sparkline=true&price_change_percentage=24h')).map(c => ({ id: c.id, symbol: c.symbol.toUpperCase(), name: c.name, price: c.current_price, change: c.price_change_percentage_24h, series: (c.sparkline_in_7d?.price || []).filter((_, i) => i % 2 === 0) })) });
const cryptoCompare = async () => {
  const [p, ...h] = await Promise.all([fetchJson('https://min-api.cryptocompare.com/data/pricemultifull?fsyms=' + CRYPTO.map(c => c[1]).join(',') + '&tsyms=USD'), ...CRYPTO.map(c => fetchJson(`https://min-api.cryptocompare.com/data/v2/histohour?fsym=${c[1]}&tsym=USD&limit=168`))]);
  return { source: 'CryptoCompare', stepMs: 3600e3, list: CRYPTO.map((c, i) => ({ id: c[0], symbol: c[1], name: c[2], price: p.RAW[c[1]].USD.PRICE, change: p.RAW[c[1]].USD.CHANGEPCT24HOUR, series: (h[i].Data?.Data || []).map(x => x.close) })) };
};
const cryptoCoinbase = async () => {
  const rows = await Promise.all(CRYPTO.map(async c => { const [spot, can] = await Promise.all([fetchJson(`https://api.coinbase.com/v2/prices/${c[1]}-USD/spot`), fetchJson(`https://api.exchange.coinbase.com/products/${c[1]}-USD/candles?granularity=3600`)]); const series = can.slice().reverse().map(x => x[4]).slice(-168); const price = Number(spot.data.amount); return { id: c[0], symbol: c[1], name: c[2], price, change: series.length > 24 ? (price / series[series.length - 25] - 1) * 100 : 0, series }; }));
  return { source: 'Coinbase', stepMs: 3600e3, list: rows };
};
const stooqSeries = async sym => { const r = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(7000) }); const t = await r.text(); const closes = t.trim().split('\n').slice(1).map(l => Number(l.split(',')[4])).filter(Number.isFinite).slice(-40); if (closes.length < 2) throw new Error('empty'); return closes; };
const loadMarket = async () => {
  const errors = []; let cr = null;
  for (const fn of [cryptoGecko, cryptoCompare, cryptoCoinbase]) { try { const r = await fn(); if (r.list.length && r.list.some(c => c.series.length > 5)) { cr = r; break; } } catch (e) { errors.push(`${fn.name}: ${e.message}`); } }
  const all = [...INDICES, ...STOCKS], stooqMap = { '^GSPC': '^spx', '^IXIC': '^ndq', '^DJI': '^dji' };
  const rows = (await Promise.all(all.map(async ([sym, name]) => {
    try { const d = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1h`); const res = d?.chart?.result?.[0]; const m = res.meta, closes = (res.indicators?.quote?.[0]?.close || []).filter(v => v != null); const prev = m.chartPreviousClose || m.previousClose || closes[0]; return { symbol: sym.replace('^', ''), name, index: sym.startsWith('^'), price: m.regularMarketPrice, change: prev ? (m.regularMarketPrice - prev) / prev * 100 : 0, series: closes.filter((_, k) => k % 2 === 0) }; }
    catch (e1) { try { const c = await stooqSeries(stooqMap[sym] || `${sym.toLowerCase()}.us`); return { symbol: sym.replace('^', ''), name, index: sym.startsWith('^'), price: c[c.length - 1], change: (c[c.length - 1] / c[c.length - 2] - 1) * 100, series: c }; } catch (e2) { errors.push(`${sym}: ${e1.message}/${e2.message}`); return null; } }
  }))).filter(Boolean);
  if (errors.length) console.warn('market feed warnings:', errors.slice(0, 4).join(' | '));
  if (!cr && !rows.length) return null;
  const sm = sampleMarket();
  return { source: 'live', updated: new Date().toISOString(), stepMs: cr?.stepMs || 3600e3,
    sources: { crypto: cr ? cr.source : 'sample', stocks: rows.length ? 'live' : 'sample' },
    crypto: cr ? cr.list : sm.crypto, indices: rows.filter(r => r.index).length ? rows.filter(r => r.index) : sm.indices, stocks: rows.filter(r => !r.index).length ? rows.filter(r => !r.index) : sm.stocks, errors: errors.slice(0, 6) };
};
const sampleMarket = () => ({ source: 'sample', updated: new Date().toISOString(), stepMs: 3600e3, sources: { crypto: 'sample', stocks: 'sample' },
  crypto: [['bitcoin', 'BTC', 'Bitcoin', 67000], ['ethereum', 'ETH', 'Ethereum', 3400], ['solana', 'SOL', 'Solana', 160], ['ripple', 'XRP', 'XRP', 0.55], ['dogecoin', 'DOGE', 'Dogecoin', 0.14], ['cardano', 'ADA', 'Cardano', 0.45]].map(([id, symbol, name, p], i) => { const series = sampleSeries(p, .02 + i * .004, 84); return { id, symbol, name, price: series[series.length - 1], change: (series[series.length - 1] / series[series.length - 25] - 1) * 100, series }; }),
  indices: INDICES.map(([sym, name], i) => { const series = sampleSeries([5200, 16400, 39000][i], .01, 40); return { symbol: sym.replace('^', ''), name, price: series[series.length - 1], change: (series[series.length - 1] / series[0] - 1) * 100, series }; }),
  stocks: STOCKS.map(([sym, name], i) => { const series = sampleSeries([190, 420, 900, 180, 180, 170, 195][i], .015, 40); return { symbol: sym, name, price: series[series.length - 1], change: (series[series.length - 1] / series[0] - 1) * 100, series }; }) });
app.get('/api/market', wrap(async (req, res) => {
  if (!MARKET.data || Date.now() - MARKET.at > 60000) { try { const d = await loadMarket(); if (d) { MARKET.data = d; MARKET.at = d.sources.crypto === 'sample' || d.sources.stocks === 'sample' ? Date.now() - 30000 : Date.now(); } else if (!MARKET.data) { MARKET.data = sampleMarket(); MARKET.at = Date.now() - 45000; } } catch (e) { if (!MARKET.data) { MARKET.data = sampleMarket(); MARKET.at = Date.now() - 45000; } } }
  res.set('Cache-Control', 'public, max-age=30').json(MARKET.data);
}));

app.get('/healthz', (req, res) => res.json({ ok: true }));

const requireCustomer = wrap(async (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'customer') return res.status(401).json({ error: 'Please sign in as a customer.' });
  const { rows: [row] } = await query('SELECT status FROM users WHERE id = $1', [req.session.user.id]);
  if (!row || row.status !== 'ACTIVE') { await new Promise(resolve => req.session.destroy(resolve)); return res.status(401).json({ error: 'Your session has ended. Please sign in again.' }); }
  req.customerId = req.session.user.id;
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
  await sendNotification(pool, { userId: req.customerId, title: 'Password changed', body: 'Your password was changed and other devices were signed out.', type: 'security' });
  await audit(pool, null, 'CUSTOMER_PASSWORD_CHANGED', `customer_id=${req.session.user.id}`);
  res.json({ ok: true });
}));
app.post('/api/customer/security/sign-out-others', requireCustomer, wrap(async (req, res) => {
  await endSessions('customer', req.session.user.id, req.sessionID);
  res.json({ ok: true });
}));

const RESTRICTIONS = { DEBIT_BLOCK: 'Outgoing payments are restricted on this account. Please contact support.', FULL_FREEZE: 'This account is frozen. Please contact support.', UNDER_REVIEW: 'This account is under review. Please contact support.', DORMANT: 'This account is dormant. Please contact support to reactivate it.', COMPLIANCE_HOLD: 'A compliance hold is in place on this account. Please contact support.', FRAUD_HOLD: 'We placed a security hold on this account to protect you. Please contact support.', CLOSED_PENDING: 'This account is being closed. Please contact support.' };
const METHOD_LABELS = { instant: 'Instant', same: 'Same-day ACH', ach: 'Standard ACH', wire: 'Wire transfer' };
const DEFAULT_FEES = { instant: 0, same: 0, ach: 0, wire: 25 };
const readSettings = async runner => Object.fromEntries((await runner.query('SELECT setting_key, setting_value FROM system_settings')).rows.map(r => [r.setting_key, r.setting_value]));
// ---- delivery methods: Instant completes now; Same-day ACH and Standard ACH settle over time ----
const SETTLE_MIN = { intl: Number(process.env.SETTLE_INTL_MINUTES || 6), same: Number(process.env.SETTLE_SAME_DAY_MINUTES || 2), ach: Number(process.env.SETTLE_STANDARD_MINUTES || 4), wire: Number(process.env.SETTLE_WIRE_MINUTES || 3) };
const lastSettle = new Map();
const settleDue = async uid => {
  if (!uid || Date.now() - (lastSettle.get(uid) || 0) < 4000) return;
  lastSettle.set(uid, Date.now());
  await query("UPDATE transactions SET status = 'PROCESSING', progress_at = NULL WHERE user_id = $1 AND status = 'PENDING' AND progress_at IS NOT NULL AND progress_at <= now()", [uid]);
  const { rows } = await query("SELECT id FROM transactions WHERE user_id = $1 AND status IN ('PENDING','PROCESSING') AND settles_at IS NOT NULL AND settles_at <= now()", [uid]);
  for (const r of rows) {
    await withTransaction(async client => {
      const { rows: [t] } = await client.query("SELECT * FROM transactions WHERE id = $1 AND status IN ('PENDING','PROCESSING') FOR UPDATE", [r.id]);
      if (!t) return;
      const { rows: [a] } = await client.query('SELECT * FROM accounts WHERE id = $1 FOR UPDATE', [t.account_id]);
      if (a && a.restriction && a.restriction !== 'NONE') return;
      if (a && Number(a.available_balance) >= Number(t.amount) + Number(t.fee || 0) && a.status === 'ACTIVE') {
        await client.query('UPDATE accounts SET balance = balance - $1, available_balance = available_balance - $1 WHERE id = $2', [Number(t.amount) + Number(t.fee || 0), a.id]);
        await client.query("UPDATE transactions SET status = 'COMPLETED', settles_at = NULL WHERE id = $1", [t.id]);
        await sendNotification(client, { userId: t.user_id, title: 'Transfer completed', body: `Your transfer ${t.reference} of $${Number(t.amount).toFixed(2)} to ${t.recipient_name} has completed.`, type: 'transaction' });
      } else {
        await client.query("UPDATE transactions SET status = 'FAILED', settles_at = NULL, failure_reason = 'Not enough available funds at settlement. Please contact support.' WHERE id = $1", [t.id]);
        await sendNotification(client, { userId: t.user_id, title: 'Transfer could not be completed', body: `Your transfer ${t.reference} could not be completed because the account no longer had enough available funds.`, type: 'transaction' });
      }
    });
  }
};
app.use('/api/customer', (req, res, next) => { settleDue(req.session?.user?.id).catch(() => { }).finally(next); });
const heldFor = async (runner, accountId) => Number((await runner.query("SELECT (SELECT manual_hold FROM accounts WHERE id = $1) + COALESCE((SELECT SUM(amount + fee) FROM transactions WHERE account_id = $1 AND status IN ('PENDING','PROCESSING')),0) AS h", [accountId])).rows[0].h);

// ---- international wires: FX, config, validation ----
const jparse = (v, d) => { try { const x = JSON.parse(v); return x ?? d; } catch { return d; } };
const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
let fxCache = { at: 0, rates: null, source: 'sample' };
const liveRates = async () => {
  if (fxCache.rates && Date.now() - fxCache.at < 3600e3) return fxCache;
  try { const j = await fetchJson('https://open.er-api.com/v6/latest/USD'); if (j?.rates?.EUR) { fxCache = { at: Date.now(), rates: j.rates, source: 'live', updated: new Date().toISOString() }; return fxCache; } } catch { /* fall back below */ }
  fxCache = fxCache.rates ? { ...fxCache, at: Date.now() - 3000e3 } : { at: Date.now() - 3000e3, rates: WORLD.RATES, source: 'sample', updated: new Date().toISOString() };
  return fxCache;
};
const intlConfig = async st => {
  const fx = await liveRates(), over = jparse(st.intl_overrides, {}), markup = Math.min(Math.max(num(st.intl_markup, 1.2), 0), 20);
  const rates = {};
  for (const c of WORLD.countries) { const cur = c.currency; if (rates[cur]) continue; const o = Number(over[cur]) > 0 ? Number(over[cur]) : 0, mid = o || Number(fx.rates[cur]) || WORLD.RATES[cur]; if (mid > 0) rates[cur] = { mid, rate: mid * (1 - markup / 100), overridden: !!o }; }
  return { enabled: st.allow_intl !== 'false', fee: num(st.fee_intl, 45), our: num(st.intl_our_fee, 25), markup, min: num(st.intl_min, 100), max: num(st.intl_max, 0), mins: num(st.settle_intl_minutes, SETTLE_MIN.intl), disabled: String(st.intl_disabled || '').split(',').filter(Boolean), overrides: over, customBanks: jparse(st.intl_custom_banks, []), rates, source: fx.source, updated: fx.updated };
};
const destRound = (v, cur) => WORLD.ZERO_DEC.includes(cur) ? Math.round(v) : Math.round(v * 100) / 100;
app.get('/api/customer/intl-options', requireCustomer, wrap(async (req, res) => {
  const st = await readSettings({ query }), cfg = await intlConfig(st); const { rows } = await query('SELECT id, blocked_methods FROM accounts WHERE user_id = $1', [req.session.user.id]);
  const { overrides, ...pub } = cfg; res.json({ ...pub, blocked: rows.filter(r => String(r.blocked_methods || '').split(',').includes('intl')).map(r => r.id) });
}));
app.get('/api/admin/intl-settings', requireAdmin, wrap(async (req, res) => {
  const cfg = await intlConfig(await readSettings({ query })); const fx = await liveRates(); res.json({ ...cfg, mids: Object.fromEntries(Object.keys(cfg.rates).map(k => [k, Number(fx.rates[k]) || WORLD.RATES[k]])) });
}));
app.put('/api/admin/intl-settings', requireAdmin, wrap(async (req, res) => {
  const b = req.body || {}, n = (v, lo, hi, label) => { const x = Number(v); if (!Number.isFinite(x) || x < lo || x > hi) throw new HttpError(400, `${label} must be between ${lo} and ${hi}.`); return x; };
  const fee = n(b.fee, 0, 10000, 'Wire fee'), our = n(b.our ?? 25, 0, 10000, 'OUR charge'), markup = n(b.markup, 0, 20, 'Exchange-rate margin'), min = n(b.min ?? 0, 0, MAX_MONEY, 'Minimum'), max = n(b.max ?? 0, 0, MAX_MONEY, 'Maximum'), mins = n(b.mins, 0, 525600, 'Settlement time');
  const valid = new Set(WORLD.countries.map(c => c.code));
  const disabled = (Array.isArray(b.disabled) ? b.disabled : []).filter(c => valid.has(c));
  const overrides = {}; for (const [k, v] of Object.entries(b.overrides || {})) if (/^[A-Z]{3}$/.test(k) && Number(v) > 0) overrides[k] = Number(v);
  const custom = (Array.isArray(b.customBanks) ? b.customBanks : []).slice(0, 200).map(x => ({ country: String(x.country || '').toUpperCase(), name: String(x.name || '').trim().slice(0, 60), type: String(x.type || 'Commercial bank').slice(0, 30), bic: String(x.bic || '').toUpperCase().replace(/\s/g, '').slice(0, 11) })).filter(x => valid.has(x.country) && x.name && (!x.bic || WORLD.bicOk(x.bic)));
  await withTransaction(async c => {
    for (const [k, v] of [['allow_intl', b.enabled === false ? 'false' : 'true'], ['fee_intl', fee], ['intl_our_fee', our], ['intl_markup', markup], ['intl_min', min], ['intl_max', max], ['settle_intl_minutes', mins], ['intl_disabled', disabled.join(',')], ['intl_overrides', JSON.stringify(overrides)], ['intl_custom_banks', JSON.stringify(custom)]]) await upsertSetting(c, k, v);
    await audit(c, req.session.user.id, 'ADMIN_INTL_SETTINGS', `enabled=${b.enabled !== false}; fee=${fee}; margin=${markup}%; disabled=${disabled.length}; overrides=${Object.keys(overrides).length}; customBanks=${custom.length}`);
  });
  res.json({ ok: true });
}));
app.get('/api/customer/transfer-options', requireCustomer, wrap(async (req, res) => {
  const st = await readSettings({ query }); const { rows } = await query('SELECT id, blocked_methods FROM accounts WHERE user_id = $1', [req.session.user.id]);
  res.json({ fees: Object.fromEntries(Object.keys(METHOD_LABELS).map(k => [k, Number(st['fee_' + k] ?? DEFAULT_FEES[k])])), methods: { instant: st.allow_instant !== 'false', same: st.allow_same !== 'false', ach: st.allow_ach !== 'false', wire: st.allow_wire !== 'false' }, blocked: Object.fromEntries(rows.map(r => [r.id, String(r.blocked_methods || '').split(',').filter(Boolean)])), max: Number(st.max_transfer) || 0, intl: st.allow_intl !== 'false' });
}));
app.get('/api/customer/analytics', requireCustomer, wrap(async (req, res) => {
  const uid = req.session.user.id, days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 180);
  const [d, top] = await Promise.all([
    query("SELECT date_trunc('day', created_at)::date AS d, COALESCE(SUM(amount + fee),0)::float AS out, COUNT(*)::int AS n FROM transactions WHERE user_id = $1 AND status = 'COMPLETED' AND created_at >= now() - make_interval(days => $2) GROUP BY 1 ORDER BY 1", [uid, days]),
    query("SELECT recipient_name, SUM(amount)::float AS total, COUNT(*)::int AS n FROM transactions WHERE user_id = $1 AND status = 'COMPLETED' AND created_at >= now() - make_interval(days => $2) GROUP BY 1 ORDER BY total DESC LIMIT 5", [uid, days])
  ]);
  res.json({ days, daily: d.rows, top: top.rows });
}));
app.get('/api/customer/activity', requireCustomer, wrap(async (req, res) => {
  const uid = req.session.user.id, q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60).replace(/[%_]/g, '') : '';
  const st = ['COMPLETED', 'PENDING', 'PROCESSING', 'FAILED'].includes(req.query.status) ? req.query.status : null;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100), offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const where = "t.user_id = $1 AND ($2::text IS NULL OR t.status = $2) AND ($3::text = '' OR t.recipient_name ILIKE '%' || $3 || '%' OR t.reference ILIKE '%' || $3 || '%' OR COALESCE(t.description,'') ILIKE '%' || $3 || '%')";
  const [rows, total] = await Promise.all([
    query(`SELECT t.*, a.name AS account_name FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE ${where} ORDER BY t.created_at DESC, t.id DESC LIMIT $4 OFFSET $5`, [uid, st, q, limit, offset]),
    query(`SELECT COUNT(*)::int AS n FROM transactions t WHERE ${where}`, [uid, st, q])
  ]);
  res.json({ transactions: rows.rows, total: total.rows[0].n });
}));
app.get('/api/customer/dashboard', requireCustomer, wrap(async (req, res) => {
  const uid = req.customerId;
  const [accounts, transactions, notifications, unread] = await Promise.all([
    query("SELECT a.*, a.manual_hold + COALESCE((SELECT SUM(t.amount + t.fee) FROM transactions t WHERE t.account_id = a.id AND t.status IN ('PENDING','PROCESSING')),0) AS held FROM accounts a WHERE a.user_id = $1 ORDER BY a.id", [uid]),
    query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 12', [uid]),
    query('SELECT id, title, body, type, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 3', [uid]),
    query('SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE', [uid])
  ]);
  const mem = await query('SELECT created_at FROM users WHERE id = $1', [uid]);
  res.json({ accounts: accounts.rows, transactions: transactions.rows, notifications: notifications.rows, unreadNotifications: unread.rows[0].count, memberSince: mem.rows[0]?.created_at });
}));

// Notifications are messages an administrator authors. They share the validation rules
// used by transaction records so a date, a wording change, or a fresh message all behave alike.
const NOTIFICATION_TYPES = ['general', 'security', 'transaction', 'maintenance', 'offer'];
// Wording retired in migration 4 must not be able to come back through the admin composer.
// The patterns are written with character ranges so this file never spells them out either.
const RETIRED_PHRASE = /simul[ae]t|educati[a-z]nal|fiction|not a b[a-z]nk|no real m[o0]ney|\bdemo\b/i;
const notificationText = (value, max) => (typeof value === 'string' && value.trim().length <= max ? value.trim() : '');
function notificationTimestamp(value) {
  if (typeof value !== 'string' || !value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}
function notificationInput(body, { partial = false, requireRecipient = true } = {}) {
  const changes = {};
  const take = (key, value) => { if (value !== undefined || !partial) changes[key] = value; };
  if (!partial || body?.userId !== undefined) {
    const userId = toId(body?.userId);
    if (!userId) throw new HttpError(400, requireRecipient ? 'Choose a customer for this notification.' : 'Choose a valid customer for this notification.');
    take('userId', userId);
  }
  if (!partial || body?.title !== undefined) take('title', notificationText(body?.title, 80));
  if (!partial || body?.body !== undefined) take('body', notificationText(body?.body, 500));
  if (!partial || body?.type !== undefined) {
    // Leaving the type out keeps the general default; an unknown type is refused so a
    // stored message can never become invisible to the console filters.
    const type = body?.type === undefined ? 'general' : body.type;
    if (!NOTIFICATION_TYPES.includes(type)) throw new HttpError(400, 'Choose one of the available notification types.');
    take('type', type);
  }
  if (body?.createdAt !== undefined) take('createdAt', notificationTimestamp(body.createdAt));
  if (body?.isRead !== undefined) take('isRead', Boolean(body.isRead));
  for (const field of ['title', 'body']) {
    if (changes[field] === undefined) continue;
    if (!changes[field]) throw new HttpError(400, 'Write a title and a message before saving.');
    if (RETIRED_PHRASE.test(changes[field])) throw new HttpError(400, 'That wording is not available. Write the message in your own words.');
  }
  if (body?.createdAt !== undefined && !changes.createdAt) throw new HttpError(400, 'Enter a valid date and time.');
  if (!Object.keys(changes).length) throw new HttpError(400, 'Choose something to update.');
  return changes;
}
// Every writer (system events and administrators) goes through here.
async function sendNotification(runner, { userId, title, body, type = 'general', createdAt = null, adminId = null }) {
  const { rows: [row] } = await runner.query(
    'INSERT INTO notifications (user_id, title, body, type, created_at, sent_at, admin_id) VALUES ($1, $2, $3, $4, COALESCE($5, now()), now(), $6) RETURNING id',
    [userId, title, body, type, createdAt, adminId]
  );
  return row;
}
const ownedNotification = async (runner, id, userId) => {
  const parsed = toId(id);
  if (!parsed) throw new HttpError(404, 'Notification not found.');
  const { rows: [notification] } = await runner.query('SELECT id FROM notifications WHERE id = $1 AND user_id = $2', [parsed, userId]);
  if (!notification) throw new HttpError(404, 'Notification not found.');
  return parsed;
};

// ---- card controls, bill payees, savings goals (all stored per customer) ----
const DEFAULT_PAYEES = [['Con Edison', 'Electric', '#2f7d4f', 142.6, 3], ['Verizon Wireless', 'Mobile', '#cd2026', 89.99, 5], ['Comcast Xfinity', 'Internet', '#6b3fa0', 79.99, 9], ['State Farm', 'Insurance', '#d62b2b', 214.35, 12], ['NYC Water Board', 'Water', '#2b7bd6', 56.4, 14]];
const CARD_KEYS = { frozen: 'frozen', online: 'online', intl: 'international', contactless: 'contactless' };
const cardRow = async uid => {
  await query('INSERT INTO card_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [uid]);
  const { rows: [r] } = await query('SELECT frozen, online, international AS intl, contactless, admin_frozen FROM card_settings WHERE user_id = $1', [uid]);
  return r;
};
app.get('/api/customer/card', requireCustomer, wrap(async (req, res) => res.json(await cardRow(req.session.user.id))));
app.patch('/api/customer/card', requireCustomer, wrap(async (req, res) => {
  const key = CARD_KEYS[req.body?.key];
  if (!key || typeof req.body.value !== 'boolean') throw new HttpError(400, 'Unknown card setting.');
  const cur = await cardRow(req.session.user.id);
  if (cur.admin_frozen && key === 'frozen' && req.body.value === false) throw new HttpError(403, 'Your card was frozen by Mountain Hills. Please contact support to unfreeze it.');
  await query(`UPDATE card_settings SET ${key} = $1, updated_at = now() WHERE user_id = $2`, [req.body.value, req.session.user.id]);
  res.json(await cardRow(req.session.user.id));
}));

app.get('/api/customer/payees', requireCustomer, wrap(async (req, res) => {
  const uid = req.session.user.id;
  const { rows: [c] } = await query('SELECT COUNT(*)::int AS n FROM payees WHERE user_id = $1', [uid]);
  if (!c.n) for (const p of DEFAULT_PAYEES) await query('INSERT INTO payees (user_id, name, category, color, reference, typical_amount, due_day) VALUES ($1,$2,$3,$4,$5,$6,$7)', [uid, p[0], p[1], p[2], String(40000000 + Math.floor(Math.random() * 9999999)), p[3], p[4]]);
  const { rows } = await query('SELECT * FROM payees WHERE user_id = $1 ORDER BY id', [uid]);
  res.json({ payees: rows });
}));
app.post('/api/customer/payees', requireCustomer, wrap(async (req, res) => {
  const t = v => (typeof v === 'string' ? v.trim() : '');
  const { name, category, reference } = req.body || {}; const amount = roundMoney(req.body?.typicalAmount || 0);
  if (!t(name) || t(name).length > 60 || !t(reference) || t(reference).length > 40 || !Number.isFinite(amount) || amount < 0 || amount > MAX_MONEY) throw new HttpError(400, 'Please provide valid payee details.');
  const colors = ['#2f7d4f', '#cd2026', '#6b3fa0', '#d62b2b', '#2b7bd6', '#15555a', '#b26a00'];
  const { rows: [p] } = await query('INSERT INTO payees (user_id, name, category, color, reference, typical_amount) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [req.session.user.id, t(name), t(category).slice(0, 30) || 'Bill', colors[Math.floor(Math.random() * colors.length)], t(reference), amount]);
  res.status(201).json(p);
}));
app.delete('/api/customer/payees/:id', requireCustomer, wrap(async (req, res) => {
  const id = toId(req.params.id); if (!id) throw new HttpError(404, 'Payee not found.');
  const r = await query('DELETE FROM payees WHERE id = $1 AND user_id = $2', [id, req.session.user.id]);
  if (!r.rowCount) throw new HttpError(404, 'Payee not found.');
  res.json({ ok: true });
}));
app.post('/api/customer/payees/:id/paid', requireCustomer, wrap(async (req, res) => {
  const id = toId(req.params.id); if (!id) throw new HttpError(404, 'Payee not found.');
  await query('UPDATE payees SET last_paid_at = now() WHERE id = $1 AND user_id = $2', [id, req.session.user.id]);
  res.json({ ok: true });
}));

app.get('/api/customer/goals', requireCustomer, wrap(async (req, res) => res.json({ goals: (await query('SELECT * FROM goals WHERE user_id = $1 ORDER BY id', [req.session.user.id])).rows })));
app.post('/api/customer/goals', requireCustomer, wrap(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''; const target = roundMoney(req.body?.target); const saved = roundMoney(req.body?.saved || 0);
  if (!name || name.length > 60 || !Number.isFinite(target) || target <= 0 || target > MAX_MONEY || !Number.isFinite(saved) || saved < 0 || saved > target) throw new HttpError(400, 'Please provide a goal name and a target amount.');
  const { rows: [g] } = await query('INSERT INTO goals (user_id, name, target, saved) VALUES ($1,$2,$3,$4) RETURNING *', [req.session.user.id, name, target, saved]);
  res.status(201).json(g);
}));
app.patch('/api/customer/goals/:id', requireCustomer, wrap(async (req, res) => {
  const id = toId(req.params.id); const add = roundMoney(req.body?.add);
  if (!id || !Number.isFinite(add) || add === 0 || Math.abs(add) > MAX_MONEY) throw new HttpError(400, 'Please enter an amount.');
  const { rows: [g] } = await query('UPDATE goals SET saved = LEAST(target, GREATEST(0, saved + $1)) WHERE id = $2 AND user_id = $3 RETURNING *', [add, id, req.session.user.id]);
  if (!g) throw new HttpError(404, 'Goal not found.');
  res.json(g);
}));
app.delete('/api/customer/goals/:id', requireCustomer, wrap(async (req, res) => {
  const id = toId(req.params.id); if (!id) throw new HttpError(404, 'Goal not found.');
  const r = await query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [id, req.session.user.id]);
  if (!r.rowCount) throw new HttpError(404, 'Goal not found.');
  res.json({ ok: true });
}));

app.get('/api/customer/notifications', requireCustomer, wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const uid = req.customerId;
  const [rows, total] = await Promise.all([
    query('SELECT id, title, body, type, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3', [uid, limit, offset]),
    query('SELECT COUNT(*) AS count, COUNT(*) FILTER (WHERE is_read = FALSE) AS unread FROM notifications WHERE user_id = $1', [uid])
  ]);
  res.json({ notifications: rows.rows, total: Number(total.rows[0].count), unread: Number(total.rows[0].unread), limit, offset });
}));
// Marking one as read happens the moment the customer opens their Notifications page.
app.post('/api/customer/notifications/read', requireCustomer, wrap(async (req, res) => {
  const { rowCount } = await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [req.customerId]);
  res.json({ ok: true, updated: rowCount });
}));
app.delete('/api/customer/notifications/:id', requireCustomer, wrap(async (req, res) => {
  const id = await ownedNotification(pool, req.params.id, req.customerId);
  await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, req.customerId]);
  res.json({ ok: true });
}));
app.post('/api/customer/notifications/clear', requireCustomer, wrap(async (req, res) => {
  const { rowCount } = await query('DELETE FROM notifications WHERE user_id = $1', [req.customerId]);
  res.json({ ok: true, removed: rowCount });
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

const DEFAULT_PIN = '123456'; // used until an administrator sets a customer's own transfer PIN
const DEFAULT_PIN_HASH = bcrypt.hashSync(DEFAULT_PIN, 10);
const checkTransferPin = async (uid, pin) => {
  const { rows: [u] } = await query('SELECT transfer_pin_hash, pin_failed_attempts, pin_locked_until FROM users WHERE id = $1', [uid]);
  if (!u) throw new HttpError(401, 'Please sign in again.');
  if (u.pin_locked_until && new Date(u.pin_locked_until) > new Date()) throw new HttpError(429, 'Too many incorrect PIN attempts. Try again in 15 minutes, or ask support to reset your transfer PIN.');
  const ok = /^\d{6}$/.test(pin || '') && await bcrypt.compare(pin, u.transfer_pin_hash || DEFAULT_PIN_HASH);
  if (!ok) {
    const n = (u.pin_failed_attempts || 0) + 1;
    await query('UPDATE users SET pin_failed_attempts = $1, pin_locked_until = $2 WHERE id = $3', [n >= 5 ? 0 : n, n >= 5 ? new Date(Date.now() + 15 * 60000) : null, uid]);
    throw new HttpError(403, n >= 5 ? 'Incorrect transfer PIN. Transfers are locked for 15 minutes.' : `Incorrect transfer PIN. ${5 - n} attempt${5 - n === 1 ? '' : 's'} left.`);
  }
  if (u.pin_failed_attempts) await query('UPDATE users SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $1', [uid]);
};
const randomPin = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
app.post('/api/customer/transfers', requireCustomer, wrap(async (req, res) => {
  let { accountId, recipientName, recipientAccount, recipientBank, amount, description } = req.body || {};
  const isIntl = req.body?.method === 'intl';
  const method = isIntl ? 'intl' : ['instant', 'same', 'ach', 'wire'].includes(req.body?.method) ? req.body.method : 'instant';
  let intl = null;
  if (isIntl) {
    const b = req.body, cc = String(b.country || '').toUpperCase(), ctry = WORLD.byCode(cc), st0 = await readSettings({ query }), cfg = await intlConfig(st0);
    if (!cfg.enabled) throw new HttpError(403, 'International wires are not available right now. Please contact support.');
    if (!ctry || cfg.disabled.includes(cc)) throw new HttpError(403, 'We can\u2019t send wires to that country right now. Please contact support.');
    const bic = String(b.swiftBic || '').toUpperCase().replace(/\s/g, ''), acct = String(b.iban || b.account || '').toUpperCase().replace(/\s/g, '');
    if (!WORLD.bicOk(bic)) throw new HttpError(400, 'Enter a valid SWIFT/BIC code (8 or 11 characters).');
    if (!WORLD.ibanOk(acct, cc)) throw new HttpError(400, ctry.iban ? `Enter a valid ${ctry.name} IBAN (${ctry.iban} characters).` : 'Enter a valid beneficiary account number.');
    const addr = String(b.beneficiaryAddress || '').trim().slice(0, 120); if (addr.length < 5) throw new HttpError(400, 'Enter the beneficiary\u2019s address.');
    const r = cfg.rates[ctry.currency]; if (!r) throw new HttpError(400, 'That currency isn\u2019t available right now.');
    const amt0 = roundMoney(amount); if (Number.isFinite(amt0) && amt0 < cfg.min) throw new HttpError(400, `International wires start at $${cfg.min.toLocaleString('en-US')}.`);
    if (Number.isFinite(amt0) && cfg.max > 0 && amt0 > cfg.max) throw new HttpError(400, `International wires are limited to $${cfg.max.toLocaleString('en-US')} each.`);
    const charges = b.charges === 'OUR' ? 'OUR' : 'SHA';
    intl = { cc, cur: ctry.currency, bic, acct, addr, charges, rate: r.rate, bank: String(b.bankName || '').trim().slice(0, 50), type: String(b.bankType || 'Commercial bank').slice(0, 30), fee: cfg.fee + (charges === 'OUR' ? cfg.our : 0), mins: cfg.mins, max: cfg.max, dest: destRound(amt0 * r.rate, ctry.currency) };
    if (!intl.bank) throw new HttpError(400, 'Choose the beneficiary bank.');
    recipientAccount = acct; recipientBank = `${intl.bank} \u00b7 SWIFT ${bic}`.slice(0, 80);
  }
  const text = value => (typeof value === 'string' ? value.trim() : '');
  const numericAmount = roundMoney(amount);
  const sourceId = toId(accountId);
  if (!sourceId || !text(recipientName) || !text(recipientAccount) || !text(recipientBank) || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > MAX_MONEY || text(recipientName).length > 80 || text(recipientAccount).length > 40 || text(recipientBank).length > 80 || text(description).length > 140) {
    throw new HttpError(400, 'Please provide complete valid transfer information.');
  }
  const uid = req.session.user.id;
  await checkTransferPin(uid, text(req.body.pin));
  const result = await withTransaction(async client => {
    // FOR UPDATE locks this account row so two simultaneous transfers cannot overspend it.
    const { rows: [source] } = await client.query('SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE', [sourceId, uid]);
    if (!source) throw new HttpError(400, 'Please provide complete valid transfer information.');
    const settings = Object.fromEntries((await client.query('SELECT setting_key, setting_value FROM system_settings')).rows.map(row => [row.setting_key, row.setting_value]));
    if (source.status !== 'ACTIVE') throw new HttpError(403, 'This account is suspended. Please contact support.');
    if (source.restriction && source.restriction !== 'NONE') throw new HttpError(403, source.restriction_message || RESTRICTIONS[source.restriction] || 'This account is restricted. Please contact support.');
    if (settings['allow_' + method] === 'false' || String(source.blocked_methods || '').split(',').includes(method)) throw new HttpError(403, `${METHOD_LABELS[method] || 'International wire'} transfers are not available on this account right now. Please choose another delivery speed or contact support.`);
    if (Number(settings.max_transfer) > 0 && numericAmount > Number(settings.max_transfer)) throw new HttpError(400, `Transfers are limited to $${Number(settings.max_transfer).toLocaleString('en-US')} each.`);
    if (settings.transfers_enabled !== 'true' || !source.transfers_enabled) throw new HttpError(403, 'Transfers are temporarily unavailable.');
    const fee = intl ? intl.fee : Math.max(0, roundMoney(settings['fee_' + method] !== undefined && settings['fee_' + method] !== '' ? settings['fee_' + method] : DEFAULT_FEES[method])), total = roundMoney(numericAmount + fee);
    const held = await heldFor(client, source.id);
    if (total > Number(source.available_balance) - held) throw new HttpError(400, 'Your available balance is not enough for this transfer.');
    const override = settings.default_transaction_result, mode = settings.transfer_mode || 'auto';
    const outcome = mode === 'fail' ? 'FAILED' : mode === 'hold' ? 'PENDING' : (override && override !== 'COMPLETED' ? override : (method === 'instant' ? 'COMPLETED' : method === 'same' || method === 'wire' || method === 'intl' ? 'PROCESSING' : 'PENDING'));
    const d0 = new Date(), reference = `MH-${d0.getFullYear()}${String(d0.getMonth() + 1).padStart(2, '0')}${String(d0.getDate()).padStart(2, '0')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { rows: [tx] } = await client.query(
      'INSERT INTO transactions (user_id, account_id, reference, recipient_name, recipient_account, recipient_bank, amount, description, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [uid, source.id, reference, text(recipientName), text(recipientAccount), text(recipientBank), numericAmount, text(description) || 'Outgoing transfer', outcome]);
    if (outcome === 'COMPLETED') await client.query('UPDATE accounts SET balance = balance - $1, available_balance = available_balance - $1 WHERE id = $2', [total, source.id]);
    const rawMins = method === 'same' ? settings.settle_same_minutes : method === 'wire' ? settings.settle_wire_minutes : method === 'intl' ? settings.settle_intl_minutes : settings.settle_ach_minutes;
    const mins = rawMins !== undefined && rawMins !== '' && Number.isFinite(Number(rawMins)) ? Number(rawMins) : SETTLE_MIN[method];
    const auto = mode === 'auto' && method !== 'instant' && (outcome === 'PENDING' || outcome === 'PROCESSING');
    await client.query('UPDATE transactions SET delivery_method = $1, settles_at = $2, progress_at = $3, failure_reason = $4, fee = $6 WHERE id = $5', [method, auto ? new Date(Date.now() + mins * 60000) : null, auto && outcome === 'PENDING' && method === 'ach' ? new Date(Date.now() + Math.min(60000, mins * 30000)) : null, outcome === 'FAILED' ? 'Declined by Mountain Hills. Please contact support.' : null, tx.id, fee]);
    if (intl) await client.query('UPDATE transactions SET intl_country=$1, intl_currency=$2, fx_rate=$3, dest_amount=$4, swift_bic=$5, bank_type=$6, beneficiary_address=$7, charges=$8 WHERE id=$9', [intl.cc, intl.cur, intl.rate, intl.dest, intl.bic, intl.type, intl.addr, intl.charges, tx.id]);
    await audit(client, null, 'TRANSFER_CREATED', reference);
    return { id: tx.id, reference, status: outcome, method, fee, total, destAmount: intl?.dest, destCurrency: intl?.cur, fxRate: intl?.rate, reason: outcome === 'FAILED' ? 'Declined by Mountain Hills. Please contact support.' : null };
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
  if (previous?.status === 'COMPLETED') changes.set(previous.account_id, (changes.get(previous.account_id) || 0) + Number(previous.amount) + Number(previous.fee || 0));
  if (next.status === 'COMPLETED') changes.set(next.accountId, (changes.get(next.accountId) || 0) - (next.amount + Number(previous?.fee || 0)));
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
    await sendNotification(client, { userId: source.user_id, title: 'Transaction record added', body: `A ${next.status.toLowerCase()} transaction was added to your activity.`, type: 'transaction', adminId: req.session.user.id });
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
    await client.query('UPDATE transactions SET settles_at = NULL, progress_at = NULL WHERE id = $1', [id]);
    await client.query('UPDATE transactions SET user_id = $1, account_id = $2, recipient_name = $3, recipient_account = $4, recipient_bank = $5, amount = $6, description = $7, status = $8, created_at = $9, updated_at = now() WHERE id = $10', [source.user_id, next.accountId, next.recipientName, next.recipientAccount, next.recipientBank, next.amount, next.description, next.status, next.createdAt, id]);
    await sendNotification(client, { userId: source.user_id, title: 'Transaction record updated', body: `Transaction record (${previous.reference}) was updated by an administrator.`, type: 'transaction', adminId: req.session.user.id });
    await audit(client, req.session.user.id, 'ADMIN_TRANSACTION_UPDATED', `transaction_id=${id}; account_id=${next.accountId}; amount=${next.amount.toFixed(2)}; status=${next.status}; date_time_changed`);
  });
  res.json({ ok: true });
}));

app.delete('/api/admin/transactions/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw new HttpError(404, 'Transaction not found.');
  const restoreBalance = req.query.restoreBalance === 'true';
  await withTransaction(async client => {
    const { rows: [existing] } = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]);
    if (!existing) throw new HttpError(404, 'Transaction not found.');
    if (restoreBalance && existing.status === 'COMPLETED') {
      await client.query('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', [existing.account_id]);
      await client.query('UPDATE accounts SET balance = balance + $1, available_balance = available_balance + $1 WHERE id = $2', [existing.amount, existing.account_id]);
    }
    await client.query('DELETE FROM transactions WHERE id = $1', [id]);
    await audit(client, req.session.user.id, 'ADMIN_TRANSACTION_DELETED', `transaction_id=${id}; reference=${existing.reference}; amount=${Number(existing.amount).toFixed(2)}; balance_restored=${restoreBalance && existing.status === 'COMPLETED'}`);
  });
  res.json({ ok: true });
}));

app.get('/api/admin/transactions/:id/receipt', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  const { rows: [transaction] } = id ? await query('SELECT t.*, a.name AS sender_account, a.account_number, u.name AS customer_name, u.email AS customer_email FROM transactions t JOIN accounts a ON a.id = t.account_id JOIN users u ON u.id = t.user_id WHERE t.id = $1', [id]) : { rows: [] };
  if (!transaction) throw new HttpError(404, 'Receipt not found.');
  res.json({ transaction, customer: { id: transaction.user_id, name: transaction.customer_name, email: transaction.customer_email } });
}));

// The administrator notification console. Listing, writing, correcting, and deleting
// messages works exactly the way the transaction console does.
app.get('/api/admin/notifications', requireAdmin, wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const type = typeof req.query.type === 'string' && req.query.type ? req.query.type : null;
  if (type && !NOTIFICATION_TYPES.includes(type)) throw new HttpError(400, 'Unsupported notification type filter.');
  const customerId = req.query.customerId ? toId(req.query.customerId) : null;
  if (req.query.customerId && !customerId) throw new HttpError(400, 'Customer filter is invalid.');
  const read = req.query.read === 'true' ? true : req.query.read === 'false' ? false : null;
  const search = typeof req.query.search === 'string' ? notificationText(req.query.search, 80) : '';
  const where = 'WHERE ($1::text IS NULL OR n.type = $1) AND ($2::int IS NULL OR n.user_id = $2) AND ($3::boolean IS NULL OR n.is_read = $3) AND ($4::text IS NULL OR n.title ILIKE $4 OR n.body ILIKE $4)';
  const params = [type, customerId, read, search ? `%${search}%` : null];
  const [rows, total] = await Promise.all([
    query(`SELECT n.*, u.name AS customer_name, u.email AS customer_email, a.name AS admin_name FROM notifications n JOIN users u ON u.id = n.user_id LEFT JOIN admin_users a ON a.id = n.admin_id ${where} ORDER BY n.created_at DESC, n.id DESC LIMIT $5 OFFSET $6`, [...params, limit, offset]),
    query(`SELECT COUNT(*) AS count FROM notifications n ${where}`, params)
  ]);
  res.json({ notifications: rows.rows, total: Number(total.rows[0].count), limit, offset });
}));

app.post('/api/admin/notifications', requireAdmin, wrap(async (req, res) => {
  const input = notificationInput(req.body);
  const { rows: [customer] } = await query('SELECT id FROM users WHERE id = $1', [input.userId]);
  if (!customer) throw new HttpError(404, 'Customer not found.');
  const created = await withTransaction(async client => {
    const row = await sendNotification(client, {
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      createdAt: input.createdAt,
      adminId: req.session.user.id
    });
    if (input.isRead) await client.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [row.id]);
    await audit(client, req.session.user.id, 'ADMIN_NOTIFICATION_CREATED', `notification_id=${row.id}; customer_id=${input.userId}; type=${input.type}`);
    return row;
  });
  res.status(201).json(created);
}));

app.patch('/api/admin/notifications/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw new HttpError(404, 'Notification not found.');
  const input = notificationInput(req.body, { partial: true, requireRecipient: false });
  const sets = []; const values = []; const changed = [];
  const columnFor = { userId: 'user_id', title: 'title', body: 'body', type: 'type', createdAt: 'created_at', isRead: 'is_read' };
  for (const [key, value] of Object.entries(input)) {
    values.push(value);
    sets.push(`${columnFor[key]} = $${values.length}`);
    changed.push(`${key}=${key === 'body' ? `${String(value).slice(0, 40)}...` : value}`);
  }
  if (input.userId) {
    const { rows: [customer] } = await query('SELECT id FROM users WHERE id = $1', [input.userId]);
    if (!customer) throw new HttpError(404, 'Customer not found.');
  }
  await withTransaction(async client => {
    const { rows: [previous] } = await client.query('SELECT id, user_id FROM notifications WHERE id = $1 FOR UPDATE', [id]);
    if (!previous) throw new HttpError(404, 'Notification not found.');
    values.push(id);
    await client.query(`UPDATE notifications SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
    await audit(client, req.session.user.id, 'ADMIN_NOTIFICATION_UPDATED', `notification_id=${id}; ${changed.join(', ')}`);
  });
  res.json({ ok: true });
}));

app.delete('/api/admin/notifications/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw new HttpError(404, 'Notification not found.');
  await withTransaction(async client => {
    const { rows: [existing] } = await client.query('SELECT id, user_id FROM notifications WHERE id = $1 FOR UPDATE', [id]);
    if (!existing) throw new HttpError(404, 'Notification not found.');
    await client.query('DELETE FROM notifications WHERE id = $1', [id]);
    await audit(client, req.session.user.id, 'ADMIN_NOTIFICATION_DELETED', `notification_id=${id}; customer_id=${existing.user_id}`);
  });
  res.json({ ok: true });
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
  const { rows: [{ count: notificationCount, unread: unreadCount }] } = await query('SELECT COUNT(*) AS count, COUNT(*) FILTER (WHERE is_read = FALSE) AS unread FROM notifications');
  res.json({ customers: customers.rows, accounts: accounts.rows, transactions: transactions.rows, settings: settings.rows, logs: logs.rows, administrators: administrators.rows, notificationCount: Number(notificationCount), unreadNotifications: Number(unreadCount) });
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

app.delete('/api/admin/accounts/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id); if (!id) throw new HttpError(404, 'Account not found.');
  await withTransaction(async client => {
    const { rows: [a] } = await client.query('SELECT * FROM accounts WHERE id = $1 FOR UPDATE', [id]);
    if (!a) throw new HttpError(404, 'Account not found.');
    await client.query('DELETE FROM transactions WHERE account_id = $1', [id]);
    await client.query('DELETE FROM accounts WHERE id = $1', [id]);
    await audit(client, req.session.user.id, 'ADMIN_ACCOUNT_DELETED', `account_id=${id}; number=${a.account_number}; user_id=${a.user_id}`);
  });
  res.json({ ok: true });
}));
app.delete('/api/admin/customers/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id); if (!id) throw new HttpError(404, 'Customer not found.');
  await withTransaction(async client => {
    const { rows: [u] } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
    if (!u) throw new HttpError(404, 'Customer not found.');
    await client.query('DELETE FROM notifications WHERE user_id = $1', [id]);
    await client.query('DELETE FROM transactions WHERE user_id = $1', [id]);
    await client.query('DELETE FROM accounts WHERE user_id = $1', [id]);
    await client.query('DELETE FROM users WHERE id = $1', [id]);
    await audit(client, req.session.user.id, 'ADMIN_CUSTOMER_DELETED', `user_id=${id}; email=${u.email}`);
  });
  res.json({ ok: true });
}));
app.post('/api/admin/customers/:id/transfer-pin', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id); if (!id) throw new HttpError(404, 'Customer not found.');
  const wanted = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
  if (wanted && !/^\d{6}$/.test(wanted)) throw new HttpError(400, 'A transfer PIN must be exactly 6 digits.');
  const pin = wanted || randomPin();
  const r = await query('UPDATE users SET transfer_pin_hash = $1, transfer_pin_updated_at = now(), pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $2', [await bcrypt.hash(pin, 10), id]);
  if (!r.rowCount) throw new HttpError(404, 'Customer not found.');
  await withTransaction(c => audit(c, req.session.user.id, 'ADMIN_TRANSFER_PIN_SET', `user_id=${id}; generated=${!wanted}`));
  res.json({ pin });
}));
app.post('/api/admin/transfer-pin/all', requireAdmin, wrap(async (req, res) => {
  const { rows } = await query('SELECT id, name, email FROM users ORDER BY id');
  const unique = req.body?.unique === true; const wanted = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
  if (wanted && !/^\d{6}$/.test(wanted)) throw new HttpError(400, 'A transfer PIN must be exactly 6 digits.');
  const shared = wanted || randomPin(); const pins = [];
  for (const u of rows) { const pin = unique ? randomPin() : shared; await query('UPDATE users SET transfer_pin_hash = $1, transfer_pin_updated_at = now(), pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $2', [await bcrypt.hash(pin, 10), u.id]); pins.push({ id: u.id, name: u.name, email: u.email, pin }); }
  await withTransaction(c => audit(c, req.session.user.id, 'ADMIN_TRANSFER_PIN_SET_ALL', `count=${rows.length}; unique=${unique}`));
  res.json({ count: rows.length, pin: unique ? null : shared, pins: unique ? pins : [] });
}));
app.post('/api/admin/customers/:id/unlock-pin', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id); if (!id) throw new HttpError(404, 'Customer not found.');
  await query('UPDATE users SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $1', [id]);
  res.json({ ok: true });
}));
// ---- support desk ----
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
app.get('/api/customer/support', requireCustomer, wrap(async (req, res) => {
  const { rows } = await query("SELECT t.*, (SELECT body FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_message, (SELECT sender FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_sender FROM support_tickets t WHERE t.user_id = $1 ORDER BY t.updated_at DESC", [req.session.user.id]);
  res.json({ tickets: rows });
}));
app.post('/api/customer/support', requireCustomer, wrap(async (req, res) => {
  const subject = clip(req.body?.subject, 100), body = clip(req.body?.message, 2000), category = clip(req.body?.category, 30) || 'General';
  if (subject.length < 3 || body.length < 5) throw new HttpError(400, 'Please add a subject and a message.');
  const t = await withTransaction(async c => { const { rows: [t] } = await c.query('INSERT INTO support_tickets (user_id, subject, category) VALUES ($1,$2,$3) RETURNING *', [req.session.user.id, subject, category]); await c.query("INSERT INTO support_messages (ticket_id, sender, body) VALUES ($1,'CUSTOMER',$2)", [t.id, body]); return t; });
  res.status(201).json(t);
}));
app.get('/api/customer/support/:id', requireCustomer, wrap(async (req, res) => {
  const id = toId(req.params.id); const { rows: [t] } = id ? await query('SELECT * FROM support_tickets WHERE id = $1 AND user_id = $2', [id, req.session.user.id]) : { rows: [] };
  if (!t) throw new HttpError(404, 'Conversation not found.');
  res.json({ ticket: t, messages: (await query('SELECT * FROM support_messages WHERE ticket_id = $1 ORDER BY id', [t.id])).rows });
}));
app.post('/api/customer/support/:id/messages', requireCustomer, wrap(async (req, res) => {
  const id = toId(req.params.id), body = clip(req.body?.message, 2000); if (!body) throw new HttpError(400, 'Please type a message.');
  const { rows: [t] } = id ? await query('SELECT * FROM support_tickets WHERE id = $1 AND user_id = $2', [id, req.session.user.id]) : { rows: [] };
  if (!t) throw new HttpError(404, 'Conversation not found.');
  await query("INSERT INTO support_messages (ticket_id, sender, body) VALUES ($1,'CUSTOMER',$2)", [t.id, body]);
  await query("UPDATE support_tickets SET status = 'OPEN', updated_at = now() WHERE id = $1", [t.id]);
  res.status(201).json({ ok: true });
}));
app.get('/api/admin/support', requireAdmin, wrap(async (req, res) => {
  const { rows } = await query("SELECT t.*, u.name AS customer_name, u.email AS customer_email, (SELECT body FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_message, (SELECT sender FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_sender FROM support_tickets t JOIN users u ON u.id = t.user_id ORDER BY (t.status = 'OPEN') DESC, t.updated_at DESC LIMIT 200");
  res.json({ tickets: rows });
}));
app.get('/api/admin/support/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id); const { rows: [t] } = id ? await query('SELECT t.*, u.name AS customer_name, u.email AS customer_email FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE t.id = $1', [id]) : { rows: [] };
  if (!t) throw new HttpError(404, 'Conversation not found.');
  res.json({ ticket: t, messages: (await query('SELECT * FROM support_messages WHERE ticket_id = $1 ORDER BY id', [t.id])).rows });
}));
app.post('/api/admin/support/:id/messages', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id), body = clip(req.body?.message, 2000); if (!body) throw new HttpError(400, 'Please type a reply.');
  await withTransaction(async c => {
    const { rows: [t] } = id ? await c.query('SELECT * FROM support_tickets WHERE id = $1', [id]) : { rows: [] };
    if (!t) throw new HttpError(404, 'Conversation not found.');
    await c.query("INSERT INTO support_messages (ticket_id, sender, body) VALUES ($1,'ADMIN',$2)", [t.id, body]);
    await c.query('UPDATE support_tickets SET updated_at = now() WHERE id = $1', [t.id]);
    await sendNotification(c, { userId: t.user_id, title: 'Support replied to you', body: `Re: ${t.subject}`, type: 'general', adminId: req.session.user.id });
  });
  res.status(201).json({ ok: true });
}));
app.patch('/api/admin/support/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id), status = req.body?.status; if (!id || !['OPEN', 'CLOSED'].includes(status)) throw new HttpError(400, 'Invalid status.');
  const r = await query('UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = $2', [status, id]); if (!r.rowCount) throw new HttpError(404, 'Conversation not found.');
  res.json({ ok: true });
}));
// ---- admin: freeze / unfreeze a customer's card ----
app.get('/api/admin/customers/:id/card', requireAdmin, wrap(async (req, res) => { const id = toId(req.params.id); if (!id) throw new HttpError(404, 'Customer not found.'); res.json(await cardRow(id)); }));
app.post('/api/admin/customers/:id/card', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id), freeze = req.body?.frozen === true; if (!id) throw new HttpError(404, 'Customer not found.');
  await cardRow(id);
  await withTransaction(async c => {
    await c.query('UPDATE card_settings SET admin_frozen = $1, frozen = CASE WHEN $1 THEN TRUE ELSE frozen END, updated_at = now() WHERE user_id = $2', [freeze, id]);
    await sendNotification(c, { userId: id, title: freeze ? 'Your card has been frozen' : 'Your card has been unfrozen', body: freeze ? 'Mountain Hills froze your card. Please contact support if you have questions.' : 'Your card is available to use again. You can manage it in Cards.', type: 'security', adminId: req.session.user.id });
    await audit(c, req.session.user.id, freeze ? 'ADMIN_CARD_FROZEN' : 'ADMIN_CARD_UNFROZEN', `user_id=${id}`);
  });
  res.json(await cardRow(id));
}));

// ---- admin: transfer timing, mode, and per-transfer decisions ----
const upsertSetting = (runner, k, v) => runner.query('INSERT INTO system_settings (setting_key, setting_value) VALUES ($1,$2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value', [k, String(v)]);
app.get('/api/admin/transfer-settings', requireAdmin, wrap(async (req, res) => {
  const m = Object.fromEntries((await query('SELECT setting_key, setting_value FROM system_settings')).rows.map(r => [r.setting_key, r.setting_value]));
  res.json({ same: Number(m.settle_same_minutes ?? SETTLE_MIN.same), ach: Number(m.settle_ach_minutes ?? SETTLE_MIN.ach), mode: m.transfer_mode || 'auto', allow: { instant: m.allow_instant !== 'false', same: m.allow_same !== 'false', ach: m.allow_ach !== 'false', wire: m.allow_wire !== 'false' }, wire: Number(m.settle_wire_minutes ?? SETTLE_MIN.wire), fees: Object.fromEntries(Object.keys(METHOD_LABELS).map(k => [k, Number(m['fee_' + k] ?? DEFAULT_FEES[k])])), max: Number(m.max_transfer) || 0 });
}));
app.put('/api/admin/transfer-settings', requireAdmin, wrap(async (req, res) => {
  const same = Number(req.body?.same), ach = Number(req.body?.ach), mode = req.body?.mode;
  if (![same, ach].every(v => Number.isFinite(v) && v >= 0 && v <= 525600) || !['auto', 'hold', 'fail'].includes(mode)) throw new HttpError(400, 'Enter a time between 0 and 365 days and choose a mode.');
  const allow = req.body?.allow || {}, max = Number(req.body?.max || 0), wireMins = Number(req.body?.wire ?? SETTLE_MIN.wire); const fees = Object.fromEntries(Object.keys(METHOD_LABELS).map(k => [k, roundMoney(req.body?.fees?.[k] ?? DEFAULT_FEES[k])])); if (!Object.values(fees).every(v => Number.isFinite(v) && v >= 0 && v <= 10000) || !Number.isFinite(wireMins) || wireMins < 0 || wireMins > 525600) throw new HttpError(400, 'Fees must be between $0 and $10,000, and settlement times up to 365 days.'); if (!Number.isFinite(max) || max < 0 || max > MAX_MONEY) throw new HttpError(400, 'Maximum per transfer must be zero (no limit) or more.');
  await withTransaction(async c => { await upsertSetting(c, 'settle_same_minutes', same); await upsertSetting(c, 'settle_ach_minutes', ach); await upsertSetting(c, 'transfer_mode', mode); for (const k of Object.keys(METHOD_LABELS)) { await upsertSetting(c, 'allow_' + k, allow[k] === false ? 'false' : 'true'); await upsertSetting(c, 'fee_' + k, fees[k]); } await upsertSetting(c, 'settle_wire_minutes', wireMins); await upsertSetting(c, 'max_transfer', max); await audit(c, req.session.user.id, 'ADMIN_TRANSFER_SETTINGS', `same=${same}; ach=${ach}; mode=${mode}`); });
  res.json({ same, ach, mode, allow, max, fees, wire: wireMins });
}));
app.get('/api/admin/pending-transfers', requireAdmin, wrap(async (req, res) => {
  const { rows } = await query("SELECT t.*, u.name AS customer_name, u.email AS customer_email FROM transactions t JOIN users u ON u.id = t.user_id WHERE t.status IN ('PENDING','PROCESSING') ORDER BY t.created_at DESC LIMIT 100");
  res.json({ transfers: rows });
}));
app.post('/api/admin/transactions/:id/decision', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id), action = req.body?.action; if (!id || !['approve', 'fail'].includes(action)) throw new HttpError(400, 'Choose approve or fail.');
  const reason = (typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 200) : '') || 'Declined by Mountain Hills. Please contact support.';
  const out = await withTransaction(async c => {
    const { rows: [t] } = await c.query("SELECT * FROM transactions WHERE id = $1 FOR UPDATE", [id]);
    if (!t) throw new HttpError(404, 'Transaction not found.');
    if (!['PENDING', 'PROCESSING'].includes(t.status)) throw new HttpError(409, 'Only pending or processing transfers can be decided.');
    if (action === 'approve') {
      const { rows: [a] } = await c.query('SELECT * FROM accounts WHERE id = $1 FOR UPDATE', [t.account_id]);
      if (Number(a.available_balance) < Number(t.amount) + Number(t.fee || 0)) throw new HttpError(400, 'The account does not have enough available funds to complete this transfer.');
      await c.query('UPDATE accounts SET balance = balance - $1, available_balance = available_balance - $1 WHERE id = $2', [Number(t.amount) + Number(t.fee || 0), a.id]);
      await c.query("UPDATE transactions SET status = 'COMPLETED', settles_at = NULL, progress_at = NULL, failure_reason = NULL WHERE id = $1", [id]);
      await sendNotification(c, { userId: t.user_id, title: 'Transfer completed', body: `Your transfer ${t.reference} of $${Number(t.amount).toFixed(2)} to ${t.recipient_name} has completed.`, type: 'transaction', adminId: req.session.user.id });
    } else {
      await c.query("UPDATE transactions SET status = 'FAILED', settles_at = NULL, progress_at = NULL, failure_reason = $2 WHERE id = $1", [id, reason]);
      await sendNotification(c, { userId: t.user_id, title: 'Transfer could not be completed', body: `Your transfer ${t.reference} of $${Number(t.amount).toFixed(2)} could not be completed. ${reason} Please contact support.`, type: 'transaction', adminId: req.session.user.id });
    }
    await audit(c, req.session.user.id, action === 'approve' ? 'ADMIN_TRANSFER_APPROVED' : 'ADMIN_TRANSFER_FAILED', `transaction_id=${id}; reference=${t.reference}`);
    return { ok: true };
  });
  res.json(out);
}));
app.post('/api/admin/transactions/:id/status', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id), next = req.body?.status; if (!id || !['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(next)) throw new HttpError(400, 'Choose a valid status.');
  const label = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 40) : '', message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 300) : '';
  await withTransaction(async c => {
    const { rows: [t] } = await c.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]); if (!t) throw new HttpError(404, 'Transaction not found.');
    const { rows: [a] } = await c.query('SELECT * FROM accounts WHERE id = $1 FOR UPDATE', [t.account_id]);
    const was = t.status === 'COMPLETED', will = next === 'COMPLETED';
    if (!was && will) { if (Number(a.available_balance) < Number(t.amount) + Number(t.fee || 0)) throw new HttpError(400, 'The account does not have enough available funds to complete this transfer.'); await c.query('UPDATE accounts SET balance = balance - $1, available_balance = available_balance - $1 WHERE id = $2', [Number(t.amount) + Number(t.fee || 0), a.id]); }
    if (was && !will) await c.query('UPDATE accounts SET balance = balance + $1, available_balance = available_balance + $1 WHERE id = $2', [Number(t.amount) + Number(t.fee || 0), a.id]);
    await c.query('UPDATE transactions SET status = $1, status_label = NULLIF($2, \'\'), status_message = NULLIF($3, \'\'), settles_at = NULL, progress_at = NULL, failure_reason = CASE WHEN $1 = \'FAILED\' THEN NULLIF($3, \'\') ELSE NULL END WHERE id = $4', [next, label, message, id]);
    await sendNotification(c, { userId: t.user_id, title: `Transfer update: ${label || next[0] + next.slice(1).toLowerCase()}`, body: message || `Your transfer ${t.reference} of $${Number(t.amount).toFixed(2)} to ${t.recipient_name} is now ${(label || next).toLowerCase()}.`, type: 'transaction', adminId: req.session.user.id });
    await audit(c, req.session.user.id, 'ADMIN_TRANSFER_STATUS', `transaction_id=${id}; status=${next}; label=${label}`);
  });
  res.json({ ok: true });
}));
app.patch('/api/admin/accounts/:id/details', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id); if (!id) throw new HttpError(404, 'Account not found.');
  const hold = roundMoney(req.body?.manualHold ?? 0), apyRaw = req.body?.apy, opened = req.body?.openedAt ? new Date(req.body.openedAt) : null;
  const apy = apyRaw === '' || apyRaw === null || apyRaw === undefined ? null : Number(apyRaw);
  if (!Number.isFinite(hold) || hold < 0 || hold > MAX_MONEY) throw new HttpError(400, 'Pending hold must be zero or more.');
  if (apy !== null && (!Number.isFinite(apy) || apy < 0 || apy > 100)) throw new HttpError(400, 'Interest rate must be between 0 and 100.');
  if (opened && (Number.isNaN(+opened) || opened > new Date())) throw new HttpError(400, 'Choose a valid opening date that is not in the future.');
  const restriction = req.body?.restriction === undefined ? null : (req.body.restriction === 'NONE' || RESTRICTIONS[req.body.restriction] ? req.body.restriction : 'BAD');
  if (restriction === 'BAD') throw new HttpError(400, 'Unknown restriction type.');
  const rmsg = typeof req.body?.restrictionMessage === 'string' ? req.body.restrictionMessage.trim().slice(0, 300) : null;
  const blocked = Array.isArray(req.body?.blockedMethods) ? req.body.blockedMethods.filter(m => METHOD_LABELS[m] || m === 'intl').join(',') : null;
  const { rows: [prev] } = await query('SELECT restriction FROM accounts WHERE id = $1', [id]);
  const { rows: [a] } = await query(`UPDATE accounts SET manual_hold = $1, apy = $2, created_at = COALESCE($3, created_at), restriction = COALESCE($5::text, restriction), restriction_message = CASE WHEN $5::text IS NULL THEN restriction_message WHEN $5::text = 'NONE' THEN NULL ELSE NULLIF($6::text, '') END, blocked_methods = COALESCE($7::text, blocked_methods) WHERE id = $4 RETURNING *`, [hold, apy, opened, id, restriction, rmsg, blocked]);
  if (!a) throw new HttpError(404, 'Account not found.');
  if (restriction && prev && restriction !== prev.restriction) await withTransaction(c => sendNotification(c, { userId: a.user_id, title: restriction === 'NONE' ? 'Your account restriction was lifted' : 'Important: action needed on your account', body: restriction === 'NONE' ? `${a.name} is available again.` : (a.restriction_message || RESTRICTIONS[restriction]), type: 'security', adminId: req.session.user.id }));
  await withTransaction(c => audit(c, req.session.user.id, 'ADMIN_ACCOUNT_DETAILS', `account_id=${id}; hold=${hold}; apy=${apy}; opened=${opened ? opened.toISOString() : 'unchanged'}`));
  res.json(a);
}));

app.patch('/api/admin/customers/:id/joined', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id), when = req.body?.joinedAt ? new Date(req.body.joinedAt) : null;
  if (!id || !when || Number.isNaN(+when) || when > new Date()) throw new HttpError(400, 'Choose a valid date that is not in the future.');
  const r = await query('UPDATE users SET created_at = $1 WHERE id = $2', [when, id]); if (!r.rowCount) throw new HttpError(404, 'Customer not found.');
  await withTransaction(c => audit(c, req.session.user.id, 'ADMIN_MEMBER_SINCE', `user_id=${id}; joined=${when.toISOString()}`));
  res.json({ ok: true });
}));
app.get('/api/admin/customers/:id/joined', requireAdmin, wrap(async (req, res) => { const id = toId(req.params.id); const { rows: [u] } = id ? await query('SELECT created_at FROM users WHERE id = $1', [id]) : { rows: [] }; if (!u) throw new HttpError(404, 'Customer not found.'); res.json({ joinedAt: u.created_at }); }));
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

const TRANSIENT = new Set(['EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED']);
async function connectWithRetry() {
  for (let attempt = 1; ; attempt++) {
    try { await initializeDatabase(); return; } catch (error) {
      if (!TRANSIENT.has(error.code) || attempt >= 8) {
        if (TRANSIENT.has(error.code)) error.message += ' (this computer could not reach the database host; check your internet/DNS, VPN, or try another network)';
        throw error;
      }
      console.warn(`Database not reachable yet (${error.code}). Retrying in 4s... (${attempt}/8)`);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

async function start() {
  await connectWithRetry();
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
