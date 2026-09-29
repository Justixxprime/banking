const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const publicDir = path.join(__dirname, '..', 'public');
const bundlePath = path.join(publicDir, 'app-v2.js');
const bundle = fs.readFileSync(bundlePath, 'utf8');

// Wording that must never reach a visitor again: the site presents itself as a real bank.
const FORBIDDEN_VISITOR_COPY = [
  /aurum sim/i,
  /fictional/i,
  /simulat/i,
  /\bdemo\b/i,
  /\bfdic\b/i,
  /not a bank/i,
  /no real money/i,
  /no financial services/i,
  /portfolio use/i,
  /learn as you go/i,
  /educational/i,
  /prefilled/i,
  /not a financial service/i,
  /proof of funds/i
];

// Server code keeps internal seeding names such as SEED_DEMO_DATA, so \bdemo\b is not listed here.
const FORBIDDEN_CODE_COPY = FORBIDDEN_VISITOR_COPY.filter(pattern => pattern.source !== '\\bdemo\\b');

const request = (server, target) => new Promise((resolve, reject) => {
  const { port } = server.address();
  http.get({ host: '127.0.0.1', port, path: target }, response => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
  }).on('error', reject);
});

// Runs public/app-v2.js against a minimal DOM so view functions can be inspected without a browser.
// Pass nowMs to pin the sandbox clock, which is how greeting() is exercised at each hour.
const renderApp = (pathname, nowMs, { fetchImpl } = {}) => {
  const appRoot = { innerHTML: '' };
  const element = () => ({
    innerHTML: '', className: '', textContent: '', value: '', style: {}, dataset: {},
    insertAdjacentHTML() {}, append() {}, remove() {}, reset() {}, addEventListener() {},
    setAttribute() {}, focus() {}, querySelector: () => null, querySelectorAll: () => [],
    classList: { add() {}, remove() {}, toggle() {} }
  });
  const nodes = new Map();
  const document = {
    querySelector: selector => {
      if (selector === '#app') return appRoot;
      if (!nodes.has(selector)) nodes.set(selector, element());
      return nodes.get(selector);
    },
    querySelectorAll: () => [],
    createElement: () => element(),
    getElementById: () => element(),
    addEventListener() {},
    head: { insertAdjacentHTML() {} },
    body: { append() {}, insertAdjacentHTML() {} }
  };
  const fixedDate = nowMs === undefined ? Date : class extends Date {
    constructor(...args) { super(...(args.length ? args : [currentMs])); }
    static now() { return currentMs; }
  };
  let currentMs = nowMs;
  let timerId = 0;
  const deferred = new Map();
  const sandbox = {
    document,
    location: { pathname, hostname: 'localhost', href: pathname, search: '', assign() {} },
    console,
    fetch: fetchImpl || (async () => ({ ok: true, json: async () => ({}) })),
    setTimeout: (callback, delay) => { const id = ++timerId; deferred.set(id, { callback, delay }); return id; },
    clearTimeout: id => deferred.delete(id),
    setInterval: (callback, delay) => { const id = ++timerId; deferred.set(id, { callback, delay, repeat: true }); return id; },
    clearInterval: id => deferred.delete(id), requestAnimationFrame: callback => callback(),
    Intl, Date: fixedDate, Math, JSON, URLSearchParams, addEventListener() {}, print() {},
    FormData: class { constructor() { this.entries = []; } }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(bundle, sandbox, { filename: 'app-v2.js' });

  // app-v2.js installs its current views and dispatches from inside setTimeout(..., 0).
  // Non-repeating timers run once; the 1s clock interval stays queued so advanceTo() can tick it again.
  const drain = () => {
    for (const [id, entry] of [...deferred.entries()].sort((left, right) => left[1].delay - right[1].delay)) {
      if (!entry.repeat) deferred.delete(id);
      entry.callback();
    }
  };
  drain();
  // Mimics a browser holding the page open: move the device clock, then let the ticker run.
  const advanceTo = ms => { currentMs = ms; drain(); };
  return {
    get html() { return appRoot.innerHTML; },
    run: expression => vm.runInContext(expression, sandbox),
    read: selector => (nodes.get(selector) || {}).textContent,
    drain,
    advanceTo
  };
};

test('shipped front-end assets contain no simulation wording', () => {
  const assets = fs.readdirSync(publicDir).filter(name => /\.(js|html|css)$/.test(name));
  assert.deepEqual(assets.sort(), ['app-v2.js', 'desktop.css', 'index.html', 'motion.css', 'styles.css']);

  for (const asset of assets) {
    const text = fs.readFileSync(path.join(publicDir, asset), 'utf8');
    for (const pattern of FORBIDDEN_VISITOR_COPY) {
      assert.doesNotMatch(text, pattern, `${asset} still contains ${pattern}`);
    }
  }
});

test('server and seed copy contain no simulation wording', () => {
  for (const file of ['src/server.js', 'src/database.js', 'package.json', 'public/index.html']) {
    const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    for (const pattern of FORBIDDEN_CODE_COPY) {
      assert.doesNotMatch(text, pattern, `${file} still contains ${pattern}`);
    }
  }
});

test('prose dashes are gone and only numeric ranges remain', () => {
  // Em dashes are allowed only as an empty-value placeholder, en dashes only as range separators.
  const allowed = [/\|\|'\u2014'/, /: '\u2014'/, /\}\u2013\$\{/, /\)\u2013\$\{/];
  const dashes = [...bundle.matchAll(/[\u2013\u2014]/g)];
  assert.equal(dashes.length, 5, `expected 5 remaining dashes, found ${dashes.length}`);

  for (const match of dashes) {
    const window = bundle.slice(Math.max(0, match.index - 12), match.index + 12);
    assert.ok(allowed.some(pattern => pattern.test(window)), `prose dash near ${JSON.stringify(window)}`);
  }
});

test('entry views render customer-ready copy', () => {
  const home = renderApp('/').html;
  assert.match(home, /wordmark">Aurum</);
  assert.match(home, /Banking built with clarity, care, and craft\./);
  assert.match(home, /Personal \u00b7 Business \u00b7 Savings \u00b7 Wealth/);
  assert.match(home, /\u00a9 \d{4} Aurum\. All rights reserved\./);
  assert.match(home, /follow your balances, accounts, and activity with clarity\./);
  assert.doesNotMatch(home, /href="\/admin"/);

  const admin = renderApp('/admin').html;
  assert.match(admin, /control center\./);
  assert.match(admin, /Enter your approved administrator credentials\./);
  assert.match(admin, /Authorized administrators only\. All activity is logged\./);
  assert.doesNotMatch(admin, /name="(?:email|password)"[^>]*value="/);
});

// The dashboard clock is rendered entirely from the visitor's own device.
const CUSTOMER_PAYLOAD = {
  accounts: [{ id: 1, name: 'Everyday Checking', account_number: 'AUR-0001', account_type: 'Checking', available_balance: 4820.55 }],
  transactions: [],
  notifications: []
};

const renderDashboard = async (hour, minute = 0) => {
  const harness = renderApp('/', new Date(2026, 0, 15, hour, minute, 30).getTime(), {
    fetchImpl: async url => ({ ok: true, json: async () => (String(url).includes('/api/customer/dashboard') ? CUSTOMER_PAYLOAD : {}) })
  });
  await harness.run("state.user = { id: 1, name: 'Amara Okoye', role: 'customer' }; dashboard()");
  harness.drain();
  return harness;
};

test('the dashboard greeting follows the visitor device', async () => {
  const cases = [[0, 'Good morning'], [8, 'Good morning'], [11, 'Good morning'], [12, 'Good afternoon'], [16, 'Good afternoon'], [17, 'Good evening'], [21, 'Good evening'], [23, 'Good evening']];

  for (const [hour, expected] of cases) {
    const harness = await renderDashboard(hour, 30);
    assert.equal(harness.read('#live-greeting'), expected, `at ${hour}:30`);
  }

  const evening = await renderDashboard(22, 30);
  assert.equal(evening.read('#live-date'), 'Thursday, January 15', 'the date line follows the device calendar');

  // The zone/time strip is retired: the workspace never shows a device time zone name.
  assert.doesNotMatch(evening.html, /clock-row/, 'the retired clock strip must not come back');
  assert.doesNotMatch(evening.html, /live-clock|live-zone/, 'no live clock or zone node ships');
  assert.doesNotMatch(bundle, /timeZoneName/, 'no view may format a time zone name');

  // A visitor who leaves the page open across a boundary sees the greeting refresh without a reload.
  evening.advanceTo(new Date(2026, 0, 16, 3, 0, 30).getTime());
  assert.equal(evening.read('#live-greeting'), 'Good morning', 'the greeting refreshes on the next tick');
  assert.equal(evening.read('#live-date'), 'Friday, January 16', 'the date refreshes on the next tick');

  // One definition, one call: no page may keep its own frozen salutation.
  assert.doesNotMatch(bundle, /live-local-time/, 'the retired single-use clock must be gone');
  assert.equal((bundle.match(/Good morning,/g) || []).length, 0, 'no fixed morning literal may ship');
  assert.equal((bundle.match(/startLiveTime/g) || []).length, 2, 'the shell should define the clock once and start it once');
});

// Printable output must have content whether the document sits in a modal or inside #app.
test('print rules keep statements and receipts on paper', () => {
  const print = bundle.match(/@page\{margin:14mm\}@media print\{[\s\S]*?\n/);
  assert.ok(print, 'the print stylesheet must ship');
  const css = print[0];

  // Hiding the page behind an open modal is fine; hiding everything is not.
  assert.doesNotMatch(css, /body>\*:not\(\.modal-v2\)\{display:none/, 'an unconditional hide blanks every non-modal print view');
  assert.match(css, /body:has\(> \.modal-v2\)>:not\(\.modal-v2\)\{display:none/, 'siblings are hidden only while a modal is open');

  assert.match(css, /\.modal-v2\{[^}]*overflow:visible/, 'the modal must stop scrolling internally on paper');
  assert.match(css, /\.statement-print\{display:block!important\}/, 'the statement body stays visible when printed');
  assert.match(css, /break-inside:avoid/, 'rows must not split across pages');
  assert.match(css, /print-color-adjust:exact/, 'tinted chips print without the background checkbox');
  assert.match(css, /\.data-table-wrap[^}]*overflow:visible/, 'wide tables must not be clipped on paper');
  assert.equal((bundle.match(/@media print/g) || []).length, 1, 'exactly one print stylesheet');

  // The retired time strip must not linger in the print rules either.
  assert.doesNotMatch(bundle, /clock-row/, 'the retired clock strip has no print rule left');
});

test('every live view has exactly one definition', () => {
  const views = ['home', 'login', 'adminLogin', 'dashboard', 'transactions', 'adminDashboard'];
  for (const view of views) {
    const definitions = bundle.match(new RegExp(`(?:window\\.)?\\b${view}\\s*=\\s*(?:async\\s*)?\\(`, 'g')) || [];
    assert.equal(definitions.length, 1, `${view} is defined ${definitions.length} times`);
  }
  const dispatch = bundle.match(/location\.pathname==='\/admin'\?adminLogin\(\):home\(\);/g) || [];
  assert.equal(dispatch.length, 1, 'bootstrap dispatch should exist once');
});

test('the served bundle matches disk and dead assets are gone', async () => {
  const { app } = require('../src/server');
  const server = app.listen(0);
  try {
    const bundleResponse = await request(server, '/app-v2.js');
    assert.equal(bundleResponse.status, 200);
    assert.equal(bundleResponse.body, fs.readFileSync(bundlePath, 'utf8'), 'served bundle must equal the file on disk');
    assert.match(bundleResponse.headers['cache-control'], /no-cache/, 'the bundle must be revalidated so a browser cannot keep stale code');

    for (const dead of ['/app.js', '/teaching.css']) {
      const response = await request(server, dead);
      assert.equal(response.status, 404, `${dead} should no longer be served`);
    }

    const home = await request(server, '/');
    assert.equal(home.status, 200);
    assert.equal((home.body.match(/<script[^>]*src="([^"]+)"/g) || []).join(''), '<script src="/app-v2.js"');
    assert.match(home.headers['cache-control'], /no-cache/, 'the page must be revalidated so a browser cannot keep stale markup');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('demo credentials stay gated to loopback hosts', () => {
  const literals = [...bundle.matchAll(/(?:amara|admin)@aurumsim\.test|demo1234|admin1234/g)];
  assert.equal(literals.length, 2, 'only the demo customer email and password should exist');
  assert.doesNotMatch(bundle, /admin1234/, 'no administrator password may ship in the bundle');

  const guards = [...bundle.matchAll(/localDemo/g)].map(match => match.index);
  for (const literal of literals) {
    assert.ok(guards.some(guard => guard < literal.index && literal.index - guard < 200),
      `${literal[0]} is not behind the loopback guard`);
  }
  const prefills = bundle.match(/ value="demo1234"/g) || [];
  const guardedPrefills = bundle.match(/localDemo\?' value="demo1234"'/g) || [];
  assert.equal(prefills.length, guardedPrefills.length, 'the demo password must only be prefilled on localhost');
});