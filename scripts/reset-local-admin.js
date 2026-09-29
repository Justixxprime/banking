// Local recovery helper for an existing single administrator.
// It never runs in production and never prints passwords or connection strings.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query, withTransaction, audit } = require('../src/database');

const fail = message => { console.error(`\n${message}\n`); process.exitCode = 1; };

async function main() {
  if (process.env.NODE_ENV === 'production') return fail('This recovery command is local-development only. It will not run with NODE_ENV=production.');
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = String(process.env.ADMIN_NAME || 'Aurum Administrator').trim();
  if (!name || name.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 10 || password.length > 100) {
    return fail('Set ADMIN_NAME, ADMIN_EMAIL, and a new 10-100 character ADMIN_PASSWORD in your local .env, then run this command again.');
  }
  const { rows } = await query('SELECT id FROM admin_users ORDER BY id');
  if (rows.length !== 1) return fail(`Found ${rows.length} administrator accounts. For safety, sign in with another administrator and use the Administrators page instead.`);
  const administrator = rows[0];
  await withTransaction(async client => {
    await client.query('UPDATE admin_users SET name = $1, email = $2, password_hash = $3, updated_at = now() WHERE id = $4', [name, email, await bcrypt.hash(password, 12), administrator.id]);
    await client.query(`DELETE FROM "session" WHERE sess->'user'->>'role' = 'admin' AND sess->'user'->>'id' = $1`, [String(administrator.id)]);
    await audit(client, null, 'LOCAL_ADMIN_RECOVERED', `administrator_id=${administrator.id}`);
  });
  console.log('Local administrator email and password were reset from .env. Sign in again with ADMIN_EMAIL and ADMIN_PASSWORD.');
}

main().catch(error => { console.error(`\nLocal administrator recovery failed: ${error.message}\n`); process.exitCode = 1; }).finally(() => pool.end());
