# Privacy guarantees

The verifier learns that an authorized member submitted an envelope in the permitted scope. It does not receive the identity secret or the member commitment that generated the proof. Report payloads contain no institutional identity field. Reviewer responses use a fresh per-case public key.

Case messages are intentionally linkable within that case. The backend sees category, ciphertext length, public proof values during verification, accepted time, follow-up metadata and a case-secret hash. Nullifiers are kept in restricted admission records and are omitted from the reviewer API.

Public case summaries and member comments are intentionally visible to verified members and stored as plaintext by the reporting service. The full report and case conversation remain encrypted. Public feed reads, supports and comments require membership proofs. Case-and-action-scoped nullifiers enforce one support and one comment per member per case without publishing a reusable member identifier. The backend can still correlate activity using request timing, IP/network metadata, and content; reporters and commenters may identify themselves in what they write. Changing a public summary after submission is authorized by the case secret, which links edits to that case only.

The UI makes no third-party analytics/font requests. Semaphore artifacts are served locally after setup. This does not hide IP addresses from hosting infrastructure, prevent timing correlation, or protect against a compromised browser/host. Reviewers may infer authorship from report contents. Credentials and backups are only as safe as their device, password and key custody.

The synthetic authority ledger and reporting database are different files and accessed by different services. They are not administratively isolated on the development machine. Do not claim that this setup prevents the host administrator from correlating activity.
