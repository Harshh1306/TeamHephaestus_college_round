# Team setup guide

This guide starts the synthetic Incognito demonstrator on Windows, macOS, or Linux. Use Node.js 22.12+ and npm.

## First checkout

```sh
git clone <github-repository-url>
cd ShareLock
npm ci
npm run setup
npm run artifacts
```

`npm run setup` creates local synthetic identities, the roll-number/password roster, the enrollment authority ledger, and reviewer credentials. It preserves an existing `.local` directory. `npm run artifacts` downloads and verifies the local Semaphore proving artifacts.

Never commit `.local`, identity secrets, reviewer credentials, encrypted backups, or real reports. They are ignored by `.gitignore` and are synthetic development data only.

## Start and stop

```sh
npm run dev
```

Open <http://127.0.0.1:5173>. This starts the web UI on port 5173, reporting API on 3001, and enrollment authority on 3002. Stop everything with `Ctrl+C` in the same terminal.

The optional local blockchain uses a second terminal:

```sh
npm run chain:node
```

Stop it with `Ctrl+C`. If a port is already in use, stop the previous Node process before starting another copy.

## Demo credentials

Open `.local/demo-credentials.json` locally. An unused roll number and password activate membership. `10635 / 36201` is the fixed synthetic example. Existing activated records cannot be issued a second credential.

To add or change one unused roster account and update both the plaintext demo file and the authority hash in one command:

```sh
npx tsx scripts/roster.ts set 10656 48192
```

To regenerate the complete synthetic range `10631`–`10655`:

```sh
npx tsx scripts/roster.ts reset
```

## Reviewer workspace

Paste the contents of `.local/reviewer/credentials.json` into the Reviewer workspace. Reviewer decryption happens in the browser. Do not share that file outside the synthetic demo team.

## Clean local demo state

Do not delete `.local` casually: it contains the persistent demo database and keys. To start a fresh demo, stop the services, make a recoverable copy of `.local`, then remove the copy only after confirming the backup. Run `npm run setup` again and restart the services.
