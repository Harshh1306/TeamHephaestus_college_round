# Architecture

## Code ownership

| Path                | Responsibility                                                            |
| ------------------- | ------------------------------------------------------------------------- |
| `apps/web`          | React screens, browser-only decryption and worker proof generation        |
| `apps/authority`    | Enrollment authorization, issuance serialization, signed root publication |
| `apps/api`          | Proof admission, cases, permissions, messages, receipts and audit batches |
| `packages/protocol` | Strict schemas and canonical cryptographic encodings                      |
| `packages/crypto`   | Libsodium sealed boxes, encrypted exports and Semaphore adapter           |
| `packages/database` | PostgreSQL/PGlite adapter and schema                                      |
| `packages/server`   | Signatures and reporting configuration                                    |
| `packages/audit`    | Domain-separated Merkle inclusion and independent chain readback          |
| `packages/lab`      | Isolated adversarial test runner shared by CLI, Vitest and UI             |
| `contracts`         | MembershipRegistry and AuditAnchor Solidity sources                       |

## Trust boundaries

The enrollment authority checks a synthetic roll number and password, and knows roll-number-to-commitment associations, but receives no report payload. The reporter sends only a public commitment there. The reporting API has the authority public key, current signed group snapshot, reviewer public key, its own receipt signing key and demo reviewer authentication verifier. It does not load the institutional roster or reviewer decryption key. A reviewer sees permitted ciphertext and case metadata; decryption happens locally.

These are code and process boundaries on one development machine. They are not independent operating-system or organizational boundaries. The same host owner can read every `.local` file. Production requires independent credentials, origins, operators, backups and keys according to the threat model.

## Admission transaction

1. Strictly parse bounded input; reject extra fields.
2. Derive the authorized month/category/slot scope independently.
3. Recompute the exact message from the encrypted envelope.
4. Check the authoritative root, and cryptographically verify the proof.
5. Begin a transaction; acquire the current-root row lock.
6. Recheck the root and period after verification.
7. Insert the report and the unique `(organization, scope, nullifier)` record.
8. Commit both or neither; return a signed receipt with no private credentials.

Signed snapshot installation takes the same row lock and accepts only monotonic epochs. Revocation is effective once the reporting API acknowledges the new root. If publication fails, the authority retains the pending state and returns an error; an authenticated retry republishes it. The system does not claim instantaneous revocation before that acknowledgement.

## Storage and jobs

Reporting uses a persistent PGlite engine by default; a PostgreSQL connection can be configured. Enrollment uses an atomically replaced JSON ledger and serialized requests within one process. This ledger must not be shared across multiple authority processes. It is a demo convenience, not a distributed transaction system.

Audit preparation serializes on the group-state lock and stores immutable batch data. The local worker script deploys/contracts if necessary, publishes membership state, anchors the batch, reads it back, then asks the API to confirm. Confirmation validates the actual transaction and root on the local chain. A pending batch can be retried. An RPC outage leaves report admission functional.

The current audit commitment covers the original accepted envelope. Later status changes and case messages have database audit records but are **not included in that original blockchain commitment**. A later version can anchor an append-only case-event log with explicit versions.
