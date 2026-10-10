# Incognito

**Prove you belong. Keep who you are.**

A working, synthetic-data hackathon demonstrator of verified anonymous reporting. Built from the final [shared implementation blueprint](https://chatgpt.com/share/6aca1b72-9888-83e8-9821-d1705d322241). The checkout is named ShareLock; the product name follows the blueprint: Incognito.

The demo uses real Semaphore V4 proofs, browser-side libsodium encryption, transactional nullifier consumption, signed receipts, encrypted two-way case messages, and a live adversarial test lab. Solidity contracts anchor membership state and batch commitments on a local Hardhat blockchain.

## Start here

Use Node 22.12+ or Node 24 LTS and npm. This implementation was also exercised on the available Node 25.6.1 Windows host.

```sh
npm ci
npm run setup
npm run artifacts
npm run dev
```

Open **http://127.0.0.1:5173**.

Setup creates three synthetic identities and 21 unused roll-number/password pairs. It preserves existing setup on subsequent runs and migrates older demo invitations to password hashes. The artifacts command downloads the version-matched Semaphore 4.13.0 depth-6 circuit and checks it against `artifacts.sha256.json`. The SDK version is 4.14.3; its source explicitly selects these 4.13.0 proving artifacts. Once dependencies and artifacts are downloaded, the demo runs without an external network.

Local credentials are intentionally ignored by Git:

- `.local/demo-credentials.json`: Alice, Bob, Carol and synthetic roll-number/password pairs.
- `.local/reviewer/credentials.json`: reviewer token and decryption keys.
- `.local/authority/ledger.json`: synthetic enrollment ledger and authority signing key.
- `.local/reporting-config.json`: reporting configuration; contains no member or reviewer decryption private key.

Do not publish `.local`, identity seeds, case backups, or reviewer credentials. These keys are for synthetic development data only.

## Run the demonstration

1. **Membership:** enter an unused `rollNumber` and `password` from `.local/demo-credentials.json`, or expand “Use a synthetic seed for testing” and paste Alice’s `secret`. Download an encrypted membership backup with a passphrase of at least 12 characters.
2. **Protected report:** choose a category and slot, enter a synthetic report, review privacy hints, and submit. The browser generates the ZK proof in a worker and sends only ciphertext and public proof inputs.
3. **Private case:** download the encrypted case backup. Its independent secret and decryption key are your route back after closing the tab.
4. **Reviewer workspace:** paste the contents of the reviewer credentials file. Open the case, decrypt locally, triage it, and send an encrypted question.
5. **My case:** the reporter can decrypt that question and reply without institutional login. Reviewer credentials are cleared when leaving the reviewer screen; identity and case secrets stay only in the open app’s memory.
6. **Privacy Lab:** run the security checks. The lab creates fresh synthetic identities and a separate in-memory PostgreSQL engine; it does not touch demo cases.
7. **Blockchain:** in another terminal run `npm run chain:node`; with the API running and at least one accepted report, run `npm run chain:demo`. Return to My case and Verify receipt to check the signature, Merkle inclusion and local chain root.

The public testnet has **not** been deployed. `chain:demo` refuses any chain other than the local chain ID 31337 and uses its development accounts. It writes no complaint text, case IDs, credentials or nullifiers on-chain. Hardhat state resets when its node restarts; re-run `chain:demo` to deploy and anchor again.

## Verify the implementation

```sh
npm run typecheck
npm run build
npm test
npm run demo
npm audit
```

`npm run demo` writes sanitized, actually executed results to `docs/test-evidence/latest.json`. Contract evidence is in `docs/test-evidence/chain.json`. `npm test` includes the admission suite, odd/even Merkle inclusion, and enrollment authorization, concurrent issuance, publication retry and revocation.

On this Windows machine the sandbox prevented Vite/Vitest from accessing certain temporary files. The same build and tests passed outside that sandbox. No filesystem protections need to be disabled for ordinary local development.

## Architecture

```text
Browser: local identity → sealed-box ciphertext → Semaphore proof
                              │
                              ▼
Enrollment authority      Reporting API               Reviewer browser
127.0.0.1:3002            127.0.0.1:3001               local decryption
one credential/member →  signed current group root →  permitted cases
separate synthetic       atomic report + nullifier    encrypted follow-up
roster and signing key   signed acceptance receipt
                              │
                              ▼
                         Audit batches → local EVM contracts
```

The frontend is React + Vite, the APIs are Fastify + Zod, and the storage adapter supports PGlite and PostgreSQL. PGlite is a real embedded PostgreSQL engine, used so the demo requires no Docker. SQL transactions, unique indexes and row locks enforce admission. Explicit SQL is used instead of Drizzle in this first implementation so the transaction boundaries are easy to inspect.

Set `REPORTING_DATABASE_URL` to a PostgreSQL connection string to use an external database. The default `.local/reporting-db` is persistent PGlite storage. Do not run two API processes against the same PGlite directory. The external PostgreSQL adapter is supplied but was not exercised against a running external database in this session.

This is a modular TypeScript repository with one npm dependency graph. The development UI exposes reporter, enrollment, reviewer and transparency screens together. Separate origins, credentials, operating-system accounts and organizational control remain deployment work; separate processes alone do not prove administrator unlinkability.

## Handoff documents

- [Team setup guide](docs/TEAM_SETUP_GUIDE.md)
- [Feature guide](docs/FEATURE_GUIDE.md)
- [Test run guide](docs/TEST_RUN_GUIDE.md)
- [Implementation progress and next milestones](docs/implementation-plan.md)
- [Requirements and acceptance mapping](docs/requirements.md)
- [Architecture and trust boundaries](docs/architecture.md)
- [Cryptographic specification](docs/crypto-specification.md)
- [Threat model](docs/threat-model.md)
- [API contract](docs/api-contracts.yaml)
- [Security evaluation](docs/security-evaluation.md)
- [Five-minute demo script](docs/demo-script.md)
- [Deployment and recovery](docs/deployment.md)

**Use synthetic reports only.** The demonstrator is not an audited service for real sensitive disclosures. See the checklist for OIDC/MFA, independent service operation, key lifecycle, encrypted attachments, evidence scanning, public testnet deployment and external security review.
