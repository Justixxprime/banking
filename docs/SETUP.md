# Setup (local development)

Aurum Sim now stores its data in PostgreSQL (Neon), not in a local SQLite file.

1. Install Node.js 22 or newer (Node 24 LTS recommended) and open PowerShell in the project folder.
2. `npm install`
3. `copy .env.example .env`, then open `.env` in Notepad and set:
   - `DATABASE_URL` to the Neon **dev** branch connection string (pooled),
   - `SESSION_SECRET` to a long random value (see the comment in `.env.example`).
4. If you have old local data in `data/aurum-sim.db`, copy it into Neon once, **before the first `npm start`**:
   - `npm run db:migrate-from-sqlite -- --dry-run` (look only)
   - `npm run db:migrate-from-sqlite` (copy and verify)
   - If you already started the app and demo data exists in the dev database, add `--replace` to overwrite it.
5. `npm start`, then open http://localhost:3000 (customer) or http://localhost:3000/admin (administrator).

Stop with `Ctrl+C`. `npm run dev` restarts automatically while editing. The SQLite file is never modified or required after the copy.
