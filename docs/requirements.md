# Requirements traceability

| Blueprint requirement                   | Implemented evidence                                  | Remaining qualification                                       |
| --------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| Authorized anonymous membership         | Browser Semaphore proof; ZK-01…04                     | Issuance checks synthetic roll number and password            |
| Cross-topic cryptographic unlinkability | SCOPE-02 distinct scoped nullifiers                   | Does not establish network/content unlinkability              |
| Fair anonymous quotas                   | Three slots/category/month; DUP tests                 | Admin policy editor and urgent alternative route pending      |
| One credential per eligible member      | Serialized enrollment tests                           | Single-process local file ledger; no institutional SSO        |
| Encrypted reporting                     | Browser libsodium; ENC tests                          | Trusted frontend and reviewer key authenticity assumed        |
| Reviewer privacy and permissions        | Topic checks and no enrollment endpoints; AUTH tests  | Independent operators and OIDC/MFA pending                    |
| Protected case lifecycle                | Audited transitions; CASE-01                          | Escalation and separate reviewer keys pending                 |
| Anonymous two-way follow-up             | Browser walkthrough and CASE-02                       | Per-message attachments and richer retry UI pending           |
| Revocation                              | Signed epochs, authoritative row lock; REV-01         | Root publication must be acknowledged                         |
| Submission receipt                      | Ed25519, recovery and receipt tests                   | Receipt key rotation pending                                  |
| Blockchain accountability               | Local deployments, contract readback and Merkle tests | Public testnet deployment pending                             |
| Security Testing Center                 | Live isolated runner; saved JSON evidence             | External infrastructure review remains manual                 |
| Privacy advisor                         | Local pattern checks                                  | No claim of detecting all identifying details                 |
| Evidence attachments                    | No upload accepted in this version                    | Encryption, storage, metadata review and safe viewing pending |
| Production governance                   | Threat model and operational runbooks                 | Procedures need rehearsal and external assessment             |
