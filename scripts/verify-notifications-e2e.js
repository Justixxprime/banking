// End-to-end check of the notification feature against the configured dev database.
// Run it with `npm run db:verify-notifications` after changing notification routes.
//
// It creates two throwaway accounts with random passwords, signs in over real HTTP,
// drives every customer and administrator notification route, and then removes every
// row it touched. Row counts are compared before and after, so the database must end
// exactly as it began. It refuses to run against a production configuration and never
// prints a connection string, a secret, or a password.
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
require('dotenv').config(); // the guards below need the values from .env

if (process.env.NODE_ENV === 'production') {
  console.error('This check is for the Neon dev branch only. Clear NODE_ENV and point DATABASE_URL at dev first.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and use the Neon dev connection string.');
  process.exit(1);
}

const PORT = 4315;
process.env.PORT = String(PORT);
process.env.NODE_ENV = 'development';
delete process.env.SEED_DEMO_DATA;

const { start } = require('../src/server');
const { pool } = require('../src/database');

const stamp = Date.now().toString(36).toLowerCase(); // sign-in lowercases emails, so the address must be stored lowercased too
const TEMP_ADMIN = { name: `QA Notify Admin ${stamp}`, email: `qa-admin-${stamp}@aurumtest.invalid`, password: `Temp-${crypto.randomBytes(9).toString('hex')}` };
const TEMP_USER = { name: `QA Notify Customer ${stamp}`, email: `qa-user-${stamp}@aurumtest.invalid`, password: `Temp-${crypto.randomBytes(9).toString('hex')}` };

const jars = new Map();
const call = (jar, method, path, body) => new Promise((resolve, reject) => {
  const payload = body === undefined ? null : JSON.stringify(body);
  const request = http.request({
    host: '127.0.0.1',
    port: PORT,
    path,
    method,
    headers: { 'content-type': 'application/json', ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}) }
  }, response => {
    const cookie = response.headers['set-cookie'];
    if (cookie) jars.set(jar, cookie.map(c => c.split(';')[0]).join('; '));
    let text = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { text += chunk; });
    response.on('end', () => {
      let parsed = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
      resolve({ status: response.statusCode, body: parsed });
    });
  });
  request.on('error', reject);
  if (jars.get(jar)) request.setHeader('cookie', jars.get(jar));
  request.end(payload);
});

const note = (label, value) => console.log(`  ok  ${label}: ${value}`);
// Session counts are reported but not compared: server start-up prunes expired rows,
// so the honest test for sessions is that none of the temporary accounts keep any.
const snapshot = async () => (await pool.query(`SELECT
  (SELECT COUNT(*) FROM notifications)::int AS notifications,
  (SELECT COUNT(*) FROM audit_logs)::int AS audits,
  (SELECT COUNT(*) FROM users)::int AS users,
  (SELECT COUNT(*) FROM admin_users)::int AS admins,
  (SELECT COUNT(*) FROM "session")::int AS sessions`)).rows[0];
const find = (list, id) => list.find(item => item.id === id);

async function flow() {
  const { rows: [preexisting] } = await pool.query('SELECT id, user_id FROM notifications ORDER BY id LIMIT 1');

  const adminSignIn = await call('admin', 'POST', '/api/auth/login', { email: TEMP_ADMIN.email, password: TEMP_ADMIN.password, role: 'admin' });
  assert.equal(adminSignIn.status, 200, 'the temporary administrator can sign in');
  const userSignIn = await call('customer', 'POST', '/api/auth/login', { email: TEMP_USER.email, password: TEMP_USER.password });
  assert.equal(userSignIn.status, 200, 'the temporary customer can sign in');
  note('sessions opened', `admin=${adminSignIn.body.user.id} customer=${userSignIn.body.user.id}`);

  // An administrator writes a message and chooses the date the customer will see.
  const created = await call('admin', 'POST', '/api/admin/notifications', {
    userId: userSignIn.body.user.id,
    title: 'Card collection window',
    body: 'Collect your new card at the counter between nine and seventeen on weekdays.',
    type: 'offer',
    createdAt: '2026-09-04T08:05:00.000Z'
  });
  assert.equal(created.status, 201, `a new notification is stored: ${JSON.stringify(created.body)}`);
  const first = created.body.id;
  note('admin created', `id=${first}`);

  // A second, unread message for the customer-side flow, saved with no date chosen.
  const second = await call('admin', 'POST', '/api/admin/notifications', {
    userId: userSignIn.body.user.id,
    title: 'Statement ready',
    body: 'Your August statement is available to download.',
    type: 'transaction'
  });
  assert.equal(second.status, 201);
  note('admin created unread', `id=${second.body.id}`);

  const listed = await call('admin', 'GET', `/api/admin/notifications?limit=20&offset=0&customerId=${userSignIn.body.user.id}&type=offer`);
  assert.equal(listed.status, 200);
  const row = find(listed.body.notifications, first);
  assert.ok(row, 'the console listing shows the new row through the filters');
  assert.equal(listed.body.total, 1, 'filters narrow the total count too');
  assert.equal(row.created_at, '2026-09-04T08:05:00.000Z', 'the administrator-chosen date is what is stored');
  assert.equal(row.admin_name, TEMP_ADMIN.name, 'the author is recorded for the console');
  assert.equal(row.is_read, false, 'a saved message starts unread');
  note('listed row', `${row.title} | ${row.type} | ${row.created_at}`);

  // The console edits everything the customer sees, including the date.
  const edited = await call('admin', 'PATCH', `/api/admin/notifications/${first}`, {
    title: 'Card collection window changed',
    body: 'Collect your new card between ten and sixteen instead.',
    createdAt: '2026-09-05T14:30:00.000Z',
    type: 'maintenance',
    isRead: true
  });
  assert.equal(edited.status, 200);
  const afterEdit = find((await call('admin', 'GET', `/api/admin/notifications?limit=20&offset=0&customerId=${userSignIn.body.user.id}`)).body.notifications, first);
  assert.equal(afterEdit.title, 'Card collection window changed');
  assert.equal(afterEdit.type, 'maintenance');
  assert.equal(afterEdit.created_at, '2026-09-05T14:30:00.000Z');
  assert.equal(afterEdit.is_read, true, 'the console can mark a message read');
  note('admin edited', `${afterEdit.title} | ${afterEdit.type} | ${afterEdit.created_at} | read=${afterEdit.is_read}`);
  assert.equal(find((await call('admin', 'GET', '/api/admin/notifications?limit=20&offset=0&type=maintenance&read=true')).body.notifications, first).id, first, 'the read filter matches');
  assert.ok(!find((await call('admin', 'GET', `/api/admin/notifications?limit=20&offset=0&customerId=${userSignIn.body.user.id}&read=false`)).body.notifications, first), 'the unread filter excludes it');

  // Search covers both the title and the body.
  const searched = await call('admin', 'GET', '/api/admin/notifications?limit=20&offset=0&search=download');
  assert.ok(find(searched.body.notifications, second.body.id), 'body search finds the row');
  note('console search', `matched=${searched.body.total}`);

  // Retired wording and malformed input must be refused.
  const retired = await call('admin', 'POST', '/api/admin/notifications', { userId: userSignIn.body.user.id, title: 'Heads up', body: 'Remember this is only a simulation.', type: 'general' });
  assert.equal(retired.status, 400, 'retired wording cannot be written back');
  note('retired wording refused', retired.body.error);
  for (const bad of [
    { title: 'No recipient', body: 'A message with no customer.' },
    { userId: userSignIn.body.user.id, title: '', body: 'Empty title.' },
    { userId: userSignIn.body.user.id, title: 'Bad date', body: 'A message with a bad date.', createdAt: 'not-a-date' },
    { userId: userSignIn.body.user.id, title: 'Bad type', body: 'A message with an unsupported type.', type: 'broadcast' }
  ]) {
    const response = await call('admin', 'POST', '/api/admin/notifications', bad);
    assert.equal(response.status, 400, `rejected input: ${JSON.stringify(bad)} -> ${response.status} ${JSON.stringify(response.body)}`);
  }
  const ghost = await call('admin', 'POST', '/api/admin/notifications', { userId: 999999, title: 'Ghost', body: 'A message for a customer who does not exist.' });
  assert.equal(ghost.status, 404, 'an unknown recipient is a 404');
  const badFilter = await call('admin', 'GET', '/api/admin/notifications?type=broadcast');
  assert.equal(badFilter.status, 400, 'an unknown filter type is refused instead of silently returning nothing');
  note('invalid writes refused', 'missing recipient, empty title, bad date, bad type, unknown customer, bad filter');
  const emptyPatch = await call('admin', 'PATCH', `/api/admin/notifications/${first}`, {});
  assert.equal(emptyPatch.status, 400, 'an edit with nothing to change is refused');
  const missingRow = await call('admin', 'PATCH', '/api/admin/notifications/987654', { title: 'Not there' });
  assert.equal(missingRow.status, 404, 'editing a row that does not exist is a 404');

  // What the customer sees.
  const page = await call('customer', 'GET', '/api/customer/notifications?limit=12&offset=0');
  assert.equal(page.status, 200);
  assert.equal(page.body.total, 2);
  assert.equal(page.body.unread, 1, 'only the unread message counts once');
  const visible = find(page.body.notifications, second.body.id);
  assert.ok(visible, 'the customer reads the administrator message');
  assert.deepEqual(Object.keys(visible).sort(), ['body', 'created_at', 'id', 'is_read', 'title', 'type'], 'the customer payload exposes only customer fields');
  assert.equal(find(page.body.notifications, first).title, 'Card collection window changed', 'edits reach the customer');
  note('customer listing', `total=${page.body.total} unread=${page.body.unread} fields=${Object.keys(visible).join(',')}`);

  const dashboard = await call('customer', 'GET', '/api/customer/dashboard');
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.unreadNotifications, 1);
  assert.equal(dashboard.body.notifications.length, 2);
  assert.equal(dashboard.body.notifications[0].admin_id, undefined, 'the author stays server-side');
  note('customer dashboard', `unread=${dashboard.body.unreadNotifications}`);

  // Dismiss one message; the other survives.
  const dismissed = await call('customer', 'DELETE', `/api/customer/notifications/${first}`);
  assert.equal(dismissed.status, 200);
  assert.ok(find((await call('customer', 'GET', '/api/customer/notifications?limit=12&offset=0')).body.notifications, second.body.id), 'the other message is untouched');

  // Nobody may delete or read somebody else's message.
  if (preexisting) {
    const foreign = await call('customer', 'DELETE', `/api/customer/notifications/${preexisting.id}`);
    assert.equal(foreign.status, 404, "another customer's message is invisible");
    assert.ok((await pool.query('SELECT id FROM notifications WHERE id = $1', [preexisting.id])).rows.length, 'and it is still on record');
    note('ownership enforced', `id=${preexisting.id} stays with its owner`);
  }

  // Opening the page marks everything read.
  const marked = await call('customer', 'POST', '/api/customer/notifications/read');
  assert.deepEqual(marked.body, { ok: true, updated: 1 });
  assert.equal((await call('customer', 'GET', '/api/customer/dashboard')).body.unreadNotifications, 0);
  note('mark read', `updated=${marked.body.updated}`);

  const cleared = await call('customer', 'POST', '/api/customer/notifications/clear');
  assert.equal(cleared.body.removed, 1);
  assert.equal((await call('customer', 'GET', '/api/customer/notifications?limit=12&offset=0')).body.total, 0);
  note('clear all', `removed=${cleared.body.removed}`);

  // The console stays behind the administrator role.
  for (const target of ['/api/admin/notifications?limit=20&offset=0', '/api/admin/overview']) {
    assert.equal((await call('customer', 'GET', target)).status, 401, `a customer session cannot open ${target}`);
  }
  assert.equal((await call('nobody', 'GET', '/api/admin/notifications')).status, 401, 'an anonymous request is refused');
  assert.equal((await call('nobody', 'GET', '/api/customer/notifications')).status, 401, 'an anonymous customer read is refused');
  assert.equal((await call('nobody', 'POST', '/api/customer/notifications/clear')).status, 401, 'an anonymous clear is refused');
  assert.equal((await call('admin', 'POST', '/api/customer/notifications/clear')).status, 401, 'an administrator session cannot clear customer messages');
  assert.equal((await call('admin', 'DELETE', `/api/customer/notifications/${second.body.id}`)).status, 401, 'an administrator session cannot use the customer route');
  note('role separation', 'console is admin-only, customer routes are customer-only');

  // Deleting from the console works and is audited. The customer emptied their own list
  // above, so a fresh row is authored and then deleted from the console side.
  const third = await call('admin', 'POST', '/api/admin/notifications', { userId: userSignIn.body.user.id, title: 'Archived notice', body: 'This row is deleted from the console.', type: 'general' });
  assert.equal(third.status, 201);
  const removed = await call('admin', 'DELETE', `/api/admin/notifications/${third.body.id}`);
  assert.equal(removed.status, 200);
  assert.ok(!find((await call('admin', 'GET', `/api/admin/notifications?limit=20&offset=0&customerId=${userSignIn.body.user.id}`)).body.notifications, third.body.id), 'the row is gone from the console');
  assert.equal((await call('admin', 'DELETE', `/api/admin/notifications/${third.body.id}`)).status, 404, 'deleting a row twice reports it as missing');
  const audit = await call('admin', 'GET', '/api/admin/audit?limit=20&offset=0');
  const actions = audit.body.logs.filter(entry => entry.action.startsWith('ADMIN_NOTIFICATION')).map(entry => entry.action);
  assert.ok(actions.includes('ADMIN_NOTIFICATION_CREATED'), 'creates are audited');
  assert.ok(actions.includes('ADMIN_NOTIFICATION_UPDATED'), 'edits are audited');
  assert.ok(actions.includes('ADMIN_NOTIFICATION_DELETED'), 'deletions are audited');
  note('audit trail', [...new Set(actions)].join(', '));

  const overview = await call('admin', 'GET', '/api/admin/overview');
  assert.equal(typeof overview.body.notificationCount, 'number');
  assert.equal(typeof overview.body.unreadNotifications, 'number');
  note('overview counters', `sent=${overview.body.notificationCount} unread=${overview.body.unreadNotifications}`);
}

(async () => {
  const before = await snapshot();
  console.log('before:', JSON.stringify(before));
  await pool.query('INSERT INTO admin_users (name, email, password_hash) VALUES ($1, $2, $3)', [TEMP_ADMIN.name, TEMP_ADMIN.email, bcrypt.hashSync(TEMP_ADMIN.password, 10)]);
  await pool.query("INSERT INTO users (name, email, password_hash, status) VALUES ($1, $2, $3, 'ACTIVE')", [TEMP_USER.name, TEMP_USER.email, bcrypt.hashSync(TEMP_USER.password, 10)]);
  const { rows: [tempAdmin] } = await pool.query('SELECT id FROM admin_users WHERE email = $1', [TEMP_ADMIN.email]);
  const { rows: [tempUser] } = await pool.query('SELECT id FROM users WHERE email = $1', [TEMP_USER.email]);
  console.log('temporary accounts:', JSON.stringify({ admin: tempAdmin.id, customer: tempUser.id }));

  const server = await start();
  let failure = null;
  try {
    await flow();
    console.log('ALL ASSERTIONS PASSED');
  } catch (error) {
    failure = error;
  } finally {
    await call('admin', 'POST', '/api/auth/logout');
    await call('customer', 'POST', '/api/auth/logout');
    await new Promise(resolve => server.close(resolve));
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [tempUser.id]);
    await pool.query('DELETE FROM audit_logs WHERE admin_id = $1', [tempAdmin.id]);
    await pool.query('DELETE FROM accounts WHERE user_id = $1', [tempUser.id]);
    await pool.query('DELETE FROM transactions WHERE user_id = $1', [tempUser.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [tempUser.id]);
    await pool.query('DELETE FROM admin_users WHERE id = $1', [tempAdmin.id]);
    await pool.query(`DELETE FROM "session" WHERE sess->'user'->>'role' = 'admin' AND sess->'user'->>'id' = $1`, [String(tempAdmin.id)]);
    await pool.query(`DELETE FROM "session" WHERE sess->'user'->>'role' = 'customer' AND sess->'user'->>'id' = $1`, [String(tempUser.id)]);
  }
  const after = await snapshot();
  console.log('after:', JSON.stringify(after));
  const { rows: [orphanSessions] } = await pool.query(`SELECT COUNT(*)::int AS count FROM "session"
    WHERE (sess->'user'->>'role' = 'admin' AND sess->'user'->>'id' = $1)
       OR (sess->'user'->>'role' = 'customer' AND sess->'user'->>'id' = $2)`,
    [String(tempAdmin.id), String(tempUser.id)]);
  const { rows: [orphanRows] } = await pool.query('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1', [tempUser.id]);
  const clean = before.notifications === after.notifications && before.users === after.users
    && before.admins === after.admins && before.audits === after.audits
    && orphanSessions.count === 0 && orphanRows.count === 0;
  console.log('database left unchanged:', clean);
  await pool.end();
  if (failure) { console.error('E2E FAILED:', failure.message); process.exit(1); }
  if (!clean) { console.error('E2E FAILED: temporary rows were left behind'); process.exit(1); }
})().catch(error => { console.error('harness error:', error.message); process.exit(1); });