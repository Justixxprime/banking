// One-time copy of the old local SQLite database into PostgreSQL (Neon).
// The SQLite file is opened READ-ONLY and is never changed.
//
//   npm run db:migrate-from-sqlite -- --dry-run      (look only, connects to nothing)
//   npm run db:migrate-from-sqlite                   (copy into the DATABASE_URL database)
//   npm run db:migrate-from-sqlite -- --replace      (first wipe the target's Aurum tables, then copy)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const replace = args.includes('--replace');
const fileArg = args.find(a => a.startsWith('--file='));
const sqlitePath = path.resolve(fileArg ? fileArg.slice('--file='.length) : path.join(__dirname, '../data/aurum-sim.db'));
const fail = message => { console.error(`\n${message}\n`); process.exit(1); };

const toTimestamp = value => {
  if (!value) return null;
  const date = new Date(String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`); // SQLite stores UTC
  if (Number.isNaN(date.getTime())) throw new Error(`Cannot read the date "${value}"`);
  return date.toISOString();
};

const newAdminPassword = process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 10 ? process.env.ADMIN_PASSWORD : null;
const plans = [
  { table: 'users', identity: true, columns: ['id', 'name', 'email', 'password_hash'], map: r => [r.id, r.name, String(r.email).trim().toLowerCase(), r.password_hash] },
  { table: 'admin_users', identity: true, columns: ['id', 'name', 'email', 'password_hash'], map: r => [r.id, r.name, String(r.email).trim().toLowerCase(), newAdminPassword ? bcrypt.hashSync(newAdminPassword, 12) : r.password_hash] },
  { table: 'accounts', identity: true, columns: ['id', 'user_id', 'name', 'account_type', 'account_number', 'balance', 'available_balance', 'status', 'transfers_enabled', 'created_at'], map: r => [r.id, r.user_id, r.name, r.account_type, r.account_number, r.balance, r.available_balance, r.status, Boolean(r.transfers_enabled), toTimestamp(r.created_at)] },
  { table: 'transactions', identity: true, columns: ['id', 'user_id', 'account_id', 'reference', 'recipient_name', 'recipient_account', 'recipient_bank', 'amount', 'description', 'status', 'created_at'], map: r => [r.id, r.user_id, r.account_id, r.reference, r.recipient_name, r.recipient_account, r.recipient_bank, r.amount, r.description, r.status, toTimestamp(r.created_at)] },
  { table: 'notifications', identity: true, columns: ['id', 'user_id', 'title', 'body', 'created_at'], map: r => [r.id, r.user_id, r.title, r.body, toTimestamp(r.created_at)] },
  { table: 'audit_logs', identity: true, columns: ['id', 'admin_id', 'action', 'detail', 'created_at'], map: r => [r.id, r.admin_id, r.action, r.detail, toTimestamp(r.created_at)] },
  { table: 'system_settings', identity: false, columns: ['setting_key', 'setting_value'], conflict: 'ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value', map: r => [r.setting_key, r.setting_value] }
];
const cents = rows => rows.reduce((sum, value) => sum + Math.round(Number(value) * 100), 0);

async function main() {
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); } catch { fail('This Node.js is too old to read the SQLite file. Install Node.js 22.5 or newer (Node 24 LTS is recommended) and try again.'); }
  if (!fs.existsSync(sqlitePath)) fail(`Could not find the SQLite file at:\n${sqlitePath}\nRun this command from the project folder, or pass --file=path\\to\\aurum-sim.db`);

  const source = new DatabaseSync(sqlitePath, { readOnly: true });
  if (!source.prepare("SELECT 1 FROM app_metadata WHERE meta_key = 'usd_migration_v1'").get()) fail('This SQLite file has not had the old USD conversion applied yet.\nStart the old SQLite version once (so it finishes its own upgrade), then run this again.');
  const data = Object.fromEntries(plans.map(plan => [plan.table, source.prepare(`SELECT * FROM ${plan.table}`).all().map(row => ({ ...row }))]));
  const expected = {
    balance: cents(data.accounts.map(r => r.balance)),
    available: cents(data.accounts.map(r => r.available_balance)),
    amount: cents(data.transactions.map(r => r.amount))
  };

  console.log(`\nSQLite file: ${sqlitePath}`);
  for (const plan of plans) console.log(`  ${plan.table.padEnd(16)} ${data[plan.table].length} rows`);
  console.log(`  total balances   $${(expected.balance / 100).toFixed(2)}   total transfer amounts $${(expected.amount / 100).toFixed(2)}`);
  if (newAdminPassword) console.log('  ADMIN_PASSWORD is set, so the copied administrator gets that new password.');
  if (dryRun) { console.log('\nDRY RUN: nothing was copied. Run again without --dry-run to copy.\n'); return; }

  const db = require('../src/database');
  const host = new URL(process.env.DATABASE_URL).host;
  console.log(`\nTarget database host: ${host}`);
  await db.initializeDatabase();

  if (replace) {
    console.log('--replace was given: the Aurum tables in the target database will be EMPTIED first. Press Ctrl+C within 5 seconds to cancel.');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  await db.withTransaction(async client => {
    if (replace) await client.query('TRUNCATE notifications, transactions, accounts, audit_logs, admin_users, users RESTART IDENTITY CASCADE');
    for (const table of ['users', 'admin_users', 'accounts', 'transactions', 'notifications', 'audit_logs']) {
      const { rows: [{ count }] } = await client.query(`SELECT COUNT(*) AS count FROM ${table}`);
      if (count > 0) throw new Error(`The target table "${table}" already has ${count} rows. Nothing was copied. If this is your practice database and you want to overwrite it, run again with --replace.`);
    }
    for (const plan of plans) {
      const placeholders = plan.columns.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${plan.table} (${plan.columns.join(', ')}) VALUES (${placeholders}) ${plan.conflict || ''}`;
      for (const row of data[plan.table]) await client.query(sql, plan.map(row));
      if (plan.identity) await client.query(`SELECT setval(pg_get_serial_sequence('${plan.table}', 'id'), COALESCE((SELECT MAX(id) FROM ${plan.table}), 0) + 1, false)`);
    }
    // Check the copy before saving it. Any mismatch cancels everything.
    for (const plan of plans) {
      const { rows: [{ count }] } = await client.query(`SELECT COUNT(*) AS count FROM ${plan.table}`);
      if (count !== data[plan.table].length) throw new Error(`Row count mismatch in ${plan.table}: expected ${data[plan.table].length}, found ${count}. Nothing was saved.`);
    }
    const { rows: [sums] } = await client.query('SELECT (SELECT COALESCE(SUM(balance * 100), 0) FROM accounts) AS balance, (SELECT COALESCE(SUM(available_balance * 100), 0) FROM accounts) AS available, (SELECT COALESCE(SUM(amount * 100), 0) FROM transactions) AS amount');
    for (const key of ['balance', 'available', 'amount']) if (Math.round(sums[key]) !== expected[key]) throw new Error(`Money total mismatch (${key}). Nothing was saved.`);
  });

  console.log('\nCopy finished and verified: row counts and money totals match the SQLite file.\n');
  await db.pool.end();
}

main().catch(error => { console.error(`\nMigration stopped: ${error.message}\n`); process.exit(1); });
