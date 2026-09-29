# Continue Aurum Sim with Claude Code (Windows beginner guide)

Claude Code is a separate terminal assistant. It can continue this project if a Codex session ends, but it needs the same safety rules as this project.

## Before you start

1. Keep `.env` private. Never paste its `DATABASE_URL`, session secret, or passwords into Claude Code, GitHub, screenshots, or chat.
2. Open the project folder in File Explorer: `C:\Users\LENOVO\OneDrive\Desktop\aurum-sim-source`.
3. Use **Git Bash** for Claude Code on native Windows. Install Git for Windows first if you do not have Git Bash. WSL is also supported, but Git Bash is simpler for this project.

## Install Claude Code

Open **Git Bash** in the project folder and run this once:

```bash
npm install -g @anthropic-ai/claude-code
claude doctor
```

Do not use `sudo` on Windows. If the command is not found after installation, close Git Bash, open it again, and run `claude doctor`.

## Start it in Aurum Sim

In Git Bash:

```bash
cd /c/Users/LENOVO/OneDrive/Desktop/aurum-sim-source
claude
```

Choose your Anthropic/Claude account in the sign-in window. Then paste this prompt, without adding any secret values:

```text
You are continuing development of Aurum Sim, a FICTIONAL digital banking simulator. Read every file in docs/ first, especially AI_HANDOFF.md, AI_BUILD_RULES.md, API.md, DATABASE.md, and this handoff. Inspect existing code before editing.

Never add real banks, payment rails, financial connections, FDIC claims, or real-money functionality. Preserve the public customer homepage, login, customer dashboard, private /admin route, and server-side authorization. Do not use localStorage for accounts, sessions, balances, transfers, notifications, statements, or administrator data. Store important simulator data in Postgres and protect it with server-side authorization.

Never print, commit, or request .env secrets. Do not change Neon production casually. Use the Neon dev branch locally. Schema changes must be new numbered migrations in src/database.js. Test with npm test and node --check after editing. Do not commit, push, deploy, or delete files unless I specifically ask.

Current completed work includes: protected customer Notifications and Statements pages; private admin transaction history with add/edit/receipt; multiple administrator accounts; customer profile/security; account/customer/audit administration; and fictional/not-a-bank footers. Continue from docs/AI_HANDOFF.md and tell me the next safe step before making a large new feature.
```

## Continue later

In the same project folder, these commands resume a Claude Code conversation:

```bash
claude --continue
```

To begin a new conversation with a first instruction:

```bash
claude "Read docs/AI_HANDOFF.md and summarize the next safe development step."
```

Never use a command that skips permission prompts. Review every requested edit and command before approving it.
