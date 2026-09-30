// Notification routes are exercised against an in-memory stand-in for Postgres and for
// the session store, so no database connection is needed and nothing can be written to Neon.
const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

process.env.DATABASE_URL ||= 'postgresql://stub:stub@127.0.0.1:1/stub';
process.env.NODE_ENV = 'development';
process.env.SEED_DEMO_DATA = 'true';

const calls = [];
const handlers = [];
let replyRows = [];
let replyCount = 0;

const dispatch = (sql, params) => {
  calls.push({ sql, params });
  for (const handler of handlers) {
    if (handler.pattern.test(sql)) return handler.reply(sql, params);
  }
  // requireCustomer checks the account is still active on every request.
  if (/^SELECT status FROM users WHERE id = \$1/.test(sql)) return { rows: [{ status: 'ACTIVE' }], rowCount: 1 };
  if (/COUNT\(\*\)/.test(sql)) return { rows: [{ count: replyCount, unread: replyCount }], rowCount: 1 };
  return { rows: replyRows, rowCount: replyRows.length };
};

const pgPath = require.resolve('pg');
class FakePool {
  on() {}
  async query(sql, params) { return dispatch(sql, params); }
  async connect() { return { query: async (sql, params) => dispatch(sql, params), release() {} }; }
  async end() {}
}
require.cache[pgPath] = { id: pgPath, filename: pgPath, loaded: true, exports: { Pool: FakePool, types: { setTypeParser() {} } } };

const store = new Map();
const sessionPath = require.resolve('express-session');
require.cache[sessionPath] = {
  id: sessionPath,
  filename: sessionPath,
  loaded: true,
  exports: () => (req, res, next) => {
    const sid = req.headers['x-test-session'] || 'anonymous';
    if (!store.has(sid)) store.set(sid, {});
    const session = store.get(sid);
    session.destroy = callback => { store.delete(sid); setImmediate(callback); };
    session.regenerate = callback => { session.user = undefined; setImmediate(callback); };
    req.session = session;
    req.sessionID = sid;
    next();
  }
};
const storePath = require.resolve('connect-pg-simple');
require.cache[storePath] = { id: storePath, filename: storePath, loaded: true, exports: () => class { constructor() {} } };

const { app } = require('../src/server');

const request = (method, target, { body, sid = 'anon' } = {}) => new Promise((resolve, reject) => {
  const payload = body === undefined ? null : JSON.stringify(body);
  const { port } = server.address();
  const req = http.request({
    host: '127.0.0.1', port, path: target, method,
    headers: { 'content-type': 'application/json', 'x-test-session': sid, ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}) }
  }, response => {
    let text = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { text += chunk; });
    response.on('end', () => resolve({ status: response.statusCode, body: text ? JSON.parse(text) : null }));
  });
  req.on('error', reject);
  req.end(payload);
});

let server;
// audit() keeps the action in a bind parameter, so audits are found by params, not by SQL text.
const audits = action => calls.filter(call => /^INSERT INTO audit_logs/.test(call.sql) && call.params[1] === action);
test.before(async () => { server = app.listen(0); });
test.after(async () => { await new Promise(resolve => server.close(resolve)); });

const sign = (sid, user) => { store.set(sid, { user }); };
const reset = (rows = [], count = rows.length) => { calls.length = 0; handlers.length = 0; replyRows = rows; replyCount = count; };

test('a customer may only delete their own notification', async () => {
  reset();
  sign('customer', { id: 7, role: 'customer', name: 'Amara' });
  handlers.push({ pattern: /SELECT id FROM notifications WHERE id = \$1 AND user_id = \$2/, reply: () => ({ rows: [{ id: 41 }], rowCount: 1 }) });

  const ok = await request('DELETE', '/api/customer/notifications/41', { sid: 'customer' });
  assert.equal(ok.status, 200);
  const removed = calls.find(call => /^DELETE FROM notifications WHERE id = \$1 AND user_id = \$2/.test(call.sql));
  assert.deepEqual(removed.params, [41, 7], 'the delete must be scoped to the signed-in customer');

  reset();
  const stranger = await request('DELETE', '/api/customer/notifications/999', { sid: 'customer' });
  assert.equal(stranger.status, 404, 'a notification that is not theirs is hidden');
  assert.equal(calls.some(call => /^DELETE FROM notifications/.test(call.sql)), false, 'a rejected read must not delete anything');
});

test('clearing notifications only touches the signed-in profile', async () => {
  reset();
  sign('customer', { id: 7, role: 'customer', name: 'Amara' });
  handlers.push({ pattern: /^DELETE FROM notifications WHERE user_id = \$1/, reply: () => ({ rows: [], rowCount: 3 }) });
  const response = await request('POST', '/api/customer/notifications/clear', { sid: 'customer' });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, removed: 3 });
});

test('opening the notifications page marks the page as read', async () => {
  reset();
  sign('customer', { id: 7, role: 'customer', name: 'Amara' });
  handlers.push({ pattern: /^UPDATE notifications SET is_read = TRUE/, reply: () => ({ rows: [], rowCount: 2 }) });
  const response = await request('POST', '/api/customer/notifications/read', { sid: 'customer' });
  assert.deepEqual(response.body, { ok: true, updated: 2 });
});

test('the notification list is paginated and never leaves the customer', async () => {
  reset([{ id: 1, title: 'Card ready', body: 'Collect it at the counter.', type: 'general', is_read: false, created_at: new Date() }]);
  sign('customer', { id: 7, role: 'customer', name: 'Amara' });
  const response = await request('GET', '/api/customer/notifications?limit=12&offset=24', { sid: 'customer' });
  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.offset, 24);
  const listed = calls.find(call => /FROM notifications WHERE user_id = \$1/.test(call.sql));
  assert.equal(listed.params[0], 7);
  assert.equal(listed.sql.includes('admin_id'), false, 'the customer view must not expose the author');
});

test('administrators write the notification the customer will read', async () => {
  reset();
  sign('admin', { id: 2, role: 'admin', name: 'Root' });
  handlers.push({ pattern: /^SELECT id FROM users WHERE id = \$1/, reply: () => ({ rows: [{ id: 7 }], rowCount: 1 }) });
  handlers.push({ pattern: /INSERT INTO notifications/, reply: () => ({ rows: [{ id: 88 }], rowCount: 1 }) });

  const created = await request('POST', '/api/admin/notifications', {
    sid: 'admin',
    body: { userId: '7', title: 'Statement ready', body: 'Your September statement is available.', type: 'general', createdAt: '2026-09-01T09:30:00.000Z' }
  });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body, { id: 88 });

  const insert = calls.find(call => /INSERT INTO notifications/.test(call.sql));
  assert.equal(insert.params[0], 7);
  assert.equal(insert.params[1], 'Statement ready');
  assert.equal(insert.params[4], '2026-09-01T09:30:00.000Z', 'the administrator-chosen date is stored');
  assert.equal(insert.params[5], 2, 'the authoring administrator is recorded');
  const audited = audits('ADMIN_NOTIFICATION_CREATED');
  assert.equal(audited.length, 1);
  assert.equal(audited[0].params[0], 2, 'the audit names the administrator');
  assert.match(audited[0].params[2], /notification_id=88; customer_id=7/);

  const minimal = await request('POST', '/api/admin/notifications', {
    sid: 'admin',
    body: { userId: 7, title: 'Maintenance window', body: 'Service is scheduled on Sunday morning.' }
  });
  assert.equal(minimal.status, 201);
  const inserts = calls.filter(call => /INSERT INTO notifications/.test(call.sql));
  assert.equal(inserts[1].params[3], 'general', 'leaving the type out keeps the general default');
  assert.equal(inserts[1].params[4], null, 'no chosen date leaves the visible date to the moment it was sent');
});

test('a notification keeps the retired wording out and needs real text', async () => {
  reset();
  sign('admin', { id: 2, role: 'admin', name: 'Root' });
  const retired = await request('POST', '/api/admin/notifications', {
    sid: 'admin', body: { userId: 7, title: 'Important', body: 'This is only a simulation.', type: 'general' }
  });
  assert.equal(retired.status, 400);
  assert.match(retired.body.error, /not available/i);

  const blank = await request('POST', '/api/admin/notifications', { sid: 'admin', body: { userId: 7, title: '  ', body: 'Hello', type: 'general' } });
  assert.equal(blank.status, 400);

  const noCustomer = await request('POST', '/api/admin/notifications', { sid: 'admin', body: { title: 'Hello', body: 'World', type: 'general' } });
  assert.equal(noCustomer.status, 400, 'a message must be addressed to someone');

  const wrongType = await request('POST', '/api/admin/notifications', { sid: 'admin', body: { userId: 7, title: 'Hello', body: 'World', type: 'broadcast' } });
  assert.equal(wrongType.status, 400, 'an unknown type is refused instead of being quietly rewritten');
  const wrongEditType = await request('PATCH', '/api/admin/notifications/88', { sid: 'admin', body: { type: 'broadcast' } });
  assert.equal(wrongEditType.status, 400, 'an edit cannot invent a type either');

  assert.equal(calls.some(call => /INSERT INTO notifications/.test(call.sql)), false, 'rejected writes must not reach the table');
});

test('an administrator can edit every visible part of a notification', async () => {
  reset();
  sign('admin', { id: 2, role: 'admin', name: 'Root' });
  handlers.push({ pattern: /SELECT id, user_id FROM notifications WHERE id = \$1 FOR UPDATE/, reply: () => ({ rows: [{ id: 88, user_id: 7 }], rowCount: 1 }) });

  const edited = await request('PATCH', '/api/admin/notifications/88', {
    sid: 'admin',
    body: { title: 'Statement reissued', body: 'Please use this version.', createdAt: '2026-09-03T18:05:00.000Z', isRead: true, type: 'maintenance' }
  });
  assert.equal(edited.status, 200);
  const update = calls.find(call => /^UPDATE notifications SET/.test(call.sql));
  for (const column of ['title = $', 'body = $', 'type = $', 'created_at = $', 'is_read = $']) assert.match(update.sql, new RegExp(column.replace('$', '\\$')));
  assert.match(update.sql, /updated_at = now\(\)/);
  assert.equal(update.params.includes('Please use this version.'), true);
  assert.equal(update.params.includes(true), true, 'the read flag is editable too');

  const nothing = await request('PATCH', '/api/admin/notifications/88', { sid: 'admin', body: {} });
  assert.equal(nothing.status, 400, 'an empty edit is refused');
});

test('notification filters are validated and a delete is audited', async () => {
  reset([], 0);
  sign('admin', { id: 2, role: 'admin', name: 'Root' });
  const badFilter = await request('GET', '/api/admin/notifications?type=mystery', { sid: 'admin' });
  assert.equal(badFilter.status, 400);

  const filtered = await request('GET', '/api/admin/notifications?type=security&read=false&search=card', { sid: 'admin' });
  assert.equal(filtered.status, 200);
  const listed = calls.find(call => /FROM notifications n JOIN users/.test(call.sql));
  assert.deepEqual(listed.params.slice(0, 4), ['security', null, false, '%card%']);

  handlers.push({ pattern: /SELECT id, user_id FROM notifications WHERE id = \$1 FOR UPDATE/, reply: () => ({ rows: [{ id: 88, user_id: 7 }], rowCount: 1 }) });
  const gone = await request('DELETE', '/api/admin/notifications/88', { sid: 'admin' });
  assert.equal(gone.status, 200);
  const audited = audits('ADMIN_NOTIFICATION_DELETED');
  assert.equal(audited.length, 1);
  assert.match(audited[0].params[2], /notification_id=88; customer_id=7/);
  assert.equal(calls.some(call => /^DELETE FROM notifications WHERE id = \$1/.test(call.sql)), true);
});

test('customer sessions cannot reach the notification console', async () => {
  reset();
  sign('customer', { id: 7, role: 'customer', name: 'Amara' });
  for (const [method, target] of [['GET', '/api/admin/notifications'], ['POST', '/api/admin/notifications'], ['PATCH', '/api/admin/notifications/1'], ['DELETE', '/api/admin/notifications/1']]) {
    const response = await request(method, target, { sid: 'customer', body: {} });
    assert.equal(response.status, 401, `${method} ${target} must stay administrator-only`);
  }
  const anonymous = await request('DELETE', '/api/customer/notifications/1', { sid: 'nobody' });
  assert.equal(anonymous.status, 401);
});