const assert = require('node:assert/strict');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const request = (server, path) => new Promise((resolve, reject) => {
  const { port } = server.address();
  http.get({ host: '127.0.0.1', port, path }, response => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
  }).on('error', reject);
});

test('health check is available without starting database initialization', async () => {
  const { app } = require('../src/server');
  const server = app.listen(0);
  try {
    const response = await request(server, '/healthz');
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-type'].startsWith('application/json'), true);
    assert.deepEqual(JSON.parse(response.body), { ok: true });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('customer homepage has no public administrator link', async () => {
  const { app } = require('../src/server');
  const server = app.listen(0);
  try {
    const response = await request(server, '/');
    assert.equal(response.status, 200);
    assert.doesNotMatch(response.body, /href=["']\/admin["']/i);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('production refuses to run with demo seeding enabled', () => {
  const result = spawnSync(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
      NODE_ENV: 'production',
      SESSION_SECRET: 'a'.repeat(48),
      SEED_DEMO_DATA: 'true',
      ADMIN_EMAIL: 'owner@aurumsim.test',
      ADMIN_PASSWORD: 'a-safe-test-password'
    }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SEED_DEMO_DATA must be false/i);
});
