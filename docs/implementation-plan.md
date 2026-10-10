# Implementation progress

Source: the final message of the [shared blueprint](https://chatgpt.com/share/6aca1b72-9888-83e8-9821-d1705d322241).

## M1 — Verified anonymous admission: implemented and tested

- [x] Three synthetic Semaphore identities and an authorized group.
- [x] Browser worker generates a real proof; API verifies it.
- [x] Outsider group, modified proof, arbitrary root and message substitution rejected.
- [x] Server-derived category / UTC month / slot scopes.
- [x] Distinct nullifiers across topics and slots; repeat nullifiers within a slot.
- [x] Report and nullifier inserted in one PostgreSQL transaction.
- [x] Concurrent identical requests accept exactly once.
- [x] Ciphertext and per-case credentials bound to the proof.
- [x] Reporting records exclude institutional identity, member commitment and report plaintext.

## M2 — Admission and reporting: local demonstrator implemented

- [x] Separate enrollment process, synthetic roster with roll number and password, one commitment per roll number.
- [x] Signed group snapshots, monotonic epochs, strict root invalidation.
- [x] Publication retry and explicit revocation-effective acknowledgement.
- [x] Browser sealed-box encryption and privacy review.
- [x] Client-generated case credentials, signed receipt, lost-response recovery.
- [x] Proof artifact caching and pinned checksums.
- [ ] Replace synthetic roster passwords with institutional OIDC eligibility verification.
- [ ] Migrate the single-process enrollment file ledger to independently operated PostgreSQL with dedicated roles, migrations and backups.

## M3 — Product workflow: local demonstrator implemented

- [x] Overview, enrollment, reporting wizard, case tracking, reviewer inbox, Privacy Lab and transparency screens.
- [x] Password-encrypted membership and case exports; no plaintext localStorage.
- [x] API reviewer authentication and category authorization.
- [x] Local report decryption and audited status transitions.
- [x] Two-way sealed-box follow-up with a fresh reporter key per case.
- [x] Local identifying-content pattern warnings.
- [ ] OIDC/MFA, session lifetime, reviewer identity management and independently deployed portals.
- [ ] Encrypted evidence storage, metadata review and isolated safe attachment viewing.
- [x] Consent-gated interdepartmental routing with separate department recipient keys, encrypted
      minimum-necessary summaries, reporter approval/decline, destination acknowledgement and audit
      events.
- [ ] Protected notes, richer moderation, inbox pagination and controlled credential recovery.

## M4 — Blockchain and innovation: local chain verified

- [x] Solidity membership root registry and immutable audit batch anchors.
- [x] Real deployments and transactions on loopback-only Hardhat.
- [x] Merkle receipt inclusion, browser chain readback, tamper detection.
- [x] Contract ownership and overwrite-rejection checks.
- [x] Durable pending batch records and retryable anchoring script.
- [x] Live Security Testing Center backed by executed adversarial tests.
- [ ] Public testnet configuration, wallet custody, deployment and explorer verification.
- [ ] Scheduled batch worker, monitoring and reorganization/finality policy.
- [ ] Two-person or multisignature production contract governance.

## M5 — Evaluation and presentation

- [x] Automated admission, encryption, authorization, recovery, enrollment and Merkle tests.
- [x] Browser-tested enrollment → encrypted report → reviewer → two-way follow-up.
- [x] Dependency audit and exact dependency overrides for patched transitive versions.
- [x] Threat model, crypto specification, API summary, demo script and deployment notes.
- [ ] Independent privacy/security review and infrastructure log inspection.
- [ ] Production backup restore drills, failure injection and representative-device benchmarks.
- [ ] Public deployment, institutional evaluation and actual-user release approval.

The next implementation tranche should start with separate portal deployment and OIDC/MFA, then attachment handling and conflict-of-interest routing. The local demonstrator deliberately does not present these unfinished capabilities as complete.
