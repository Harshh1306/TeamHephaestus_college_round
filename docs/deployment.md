# Deployment and local operations

## Local development

`npm ci`, `npm run setup`, `npm run artifacts`, `npm run dev`.

Loopback ports: UI 5173, report API 3001, enrollment authority 3002, optional Hardhat 8545. `npm run build` produces static assets in `dist`, including proving artifacts. The default server binds loopback only. There is no public deployment in this implementation.

`REPORTING_DATABASE_URL` optionally selects an external PostgreSQL database. The API migrates its schema on startup. The local default is persistent PGlite in `.local/reporting-db`. Run one owner process per PGlite directory. The authority file ledger is likewise single-process. For a real deployment use versioned migrations and separate database credentials/roles; the current inline migration setup is demonstrator infrastructure.

The combined development UI is not a production separation boundary. Split reporter, enrollment and reviewer origins, CSP policies, authentication sessions and operational permissions. Disable the lab endpoint in deployed environments (`NODE_ENV=production`) and operate security demonstrations in a separate synthetic sandbox.

## Public testnet prerequisite

Choose a test network and RPC, fund a dedicated test-only deployment wallet, establish who controls the authority and anchoring roles, and configure independently verifiable contract addresses. Do not use Hardhat’s public development keys outside local development. The current script deliberately accepts only chain ID 31337; a public deployment needs a separate reviewed script and network configuration.

## Backup and restore procedure to rehearse

Stop the API and authority before copying their demo storage. Keep report data, authority ledger/signing key, receipt signing key and reviewer decryption keys in separate encrypted backups with restricted custodians. Copy a backup into a fresh isolated workspace, restore dependencies/artifacts, start the services, then test a synthetic receipt, reviewer decryption and duplicate replay. Compare group epoch/root before allowing writes. Never run a restore over the only live copy.

Browser identities and case credentials use user-held encrypted exports. A backup’s passphrase is not recoverable by the server. Membership replacement must not silently reset quotas; it is not implemented in this version.

## Rollback

Preserve the lockfile, artifact checksums and crypto protocol version. Roll back application code only when its schemas and canonical encodings remain compatible with the stored records. Restore data through a reviewed migration/recovery operation, not by deleting `.local`. Rollback of a compromised root to an earlier epoch is rejected intentionally.

## Key lifecycle and release gate

The demo has one reviewer key version and one receipt signing key. Production rotation requires key-versioned recipient routing, protected re-encryption where appropriate, historical receipt verification keys, compromise procedures, access revocation and tested backups. These procedures and OIDC/MFA must be implemented and rehearsed before sensitive reports are accepted.
