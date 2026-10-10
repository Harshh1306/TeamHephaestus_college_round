# Security evaluation

The executable source of admission-test evidence is `packages/lab/run.ts`. CLI, Vitest and the browser Privacy Lab use this runner. Each run constructs fresh identities and a new in-memory PGlite PostgreSQL database, then destroys that database. No visual result is hardcoded to pass.

Latest actual results: [test-evidence/latest.json](test-evidence/latest.json). Local contract evidence: [test-evidence/chain.json](test-evidence/chain.json). Durations are measurements on this machine, not promises for other devices.

The admission suite tests real membership proofs, outsider-controlled groups, curve-point tampering, roots, scopes, encrypted messages, case-credential substitution, periods, slots, unexpected identity fields, size limits, simultaneous requests, replay, transactional rollback, topic/slot nullifiers, decryption permissions, ciphertext integrity, reviewer permissions, anonymous case access, receipt recovery, case transitions, messages, signatures, backups and revocation.

Additional Vitest tests exercise password-gated enrollment, simultaneous attempts to issue different credentials to one roll number, commitment reuse, revoked memberships, failed root publication retry, and odd/even Merkle trees. The local contract script executes ownership and write-once checks and verifies inclusion/tampering against actual on-chain roots.

Browser QA exercised enrollment, proof generation in a Web Worker, accepted encrypted reporting, authorized local decryption, triage, reporter follow-up and reviewer response decryption. No real institutional data was used.

Dependency audit initially found vulnerable transitive dependencies. Exact overrides pin `ws` 8.21.0, `underscore` 1.13.8, `tmp` 0.2.7 and `snarkjs` 0.7.5. The runtime proof SDK already used snarkjs 0.7.5; the override also replaces an older transitive circuit-test copy. Real proof generation/verification was rerun after the update. The resulting npm audit reported zero known vulnerabilities at the time of implementation. That is not a security certification.

Not established: independent audit, external PostgreSQL behavior under multi-process production load, traffic unlinkability, full metadata/log inventory, production recovery, distributed failover, public-chain finality, malicious-client resistance or immunity to operator collusion.
