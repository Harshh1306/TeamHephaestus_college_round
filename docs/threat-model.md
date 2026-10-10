# Threat model

Assets: membership secrets, roll-number-to-commitment mappings, password hashes, report plaintext, recipient keys, case credentials, nullifier integrity, receipts and audit history.

Attackers considered: outsiders, malicious enrolled reporters, unauthorized reviewers, replaying observers, compromised operators and infrastructure observers. The first group of controls is executable; the latter operator/network risks require deployment and governance controls beyond this demo.

| Threat                                 | Control                                                                 | Limit                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Outsider makes their own group         | Server-authorized signed root plus Groth16 verification                 | Authority must correctly enroll people                                                                    |
| Multiple credentials per person        | Unique synthetic roster entry, serialized issuance                      | Stolen password and corrupt issuer are not solved                                                         |
| Replay or concurrent double submission | Unique nullifier and transaction                                        | A person with multiple improperly issued identities has extra quota                                       |
| Altered report or case credential      | Message-bound canonical envelope                                        | Honest browser and key distribution assumed                                                               |
| Revoked credential on old root         | Monotonic signed epoch and atomic root recheck                          | Takes effect after publication acknowledgement                                                            |
| Unauthorized case access               | Reviewer token/topic check or high-entropy case secret                  | Demo bearer tokens lack MFA, expiration and managed revocation                                            |
| Database leak                          | Stored ciphertext; private decryption keys outside report configuration | Topic, timestamps and ciphertext size remain visible                                                      |
| Report tampering                       | Authenticated ciphertext, signed receipt, Merkle anchor                 | Original receipt must be retained; status/messages are not yet anchored                                   |
| Cross-topic cryptographic linking      | Scope-specific nullifiers, per-case keys and no reporter ID             | Reusing case credentials manually or revealing details can still link cases                               |
| Forged or repeated public support      | Current-root membership proof and unique case/action nullifier          | Extra credentials allow extra supports; anonymous proof cannot exclude a case's author from supporting it |
| Public summary or comment abuse        | Member-only proof, size limits, one comment per member per case         | No automated content moderation; published text may identify its author                                   |
| Public action correlation              | Different nullifiers for each case and action                           | Timing, IP address, and writing style remain linkable by an operator                                      |
| Malicious frontend                     | None sufficient in this deployment                                      | App operator could replace keys or capture plaintext before encryption                                    |
| Network observer                       | No analytics; cookies omitted; request logger disabled                  | Server, proxy, DNS, host and ISP metadata remain outside this guarantee                                   |
| Issuer/operator collusion              | Separate code/process interfaces                                        | Same development host owner can read all local files                                                      |
| Denial of service                      | Bounded bodies and two concurrent verifications                         | No full infrastructure-level resource protection or distributed rate limiter                              |

Three or four demo members are an extremely small anonymity set. A real deployment needs broad enrollment, batching, minimum meaningful group sizes, operational separation and assessment of timing correlation.

No automated test is labelled as proving anonymity against colluding operators. A valid proof demonstrates eligibility, not truth of allegations. An anonymous case cannot directly reveal which member should be sanctioned; content moderation and independently authorized membership revocation have separate roles.
