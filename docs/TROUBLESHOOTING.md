# Troubleshooting

If `npm start` says a module is missing, run `npm install`. If you see an old `better-sqlite3` binding error, run `npm install` again after pulling the current project files. If port 3000 is already in use, set another `PORT` value in `.env`. To reset local demo data, stop the server and delete `data/aurum-sim.db`.
