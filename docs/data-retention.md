# Data inventory and retention

The local demonstrator has no automatic deletion job. Synthetic reports and messages persist until the operator archives or removes the demo workspace. Do not claim that closing a tab erases server records.

| Data                                | Location                                | Local behavior                                             |
| ----------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| Membership secret                   | Browser memory / encrypted export       | Lost on reload unless exported                             |
| Case secret and reply key           | Browser memory / encrypted export       | Independent for each case                                  |
| Eligibility-to-commitment mapping   | Authority ledger                        | Retained for synthetic issuance/revocation                 |
| Ciphertext, case metadata, messages | Reporting database                      | Persistent                                                 |
| Nullifier/scope                     | Restricted admission table              | Needed to preserve quota enforcement                       |
| Reviewer status events              | Reporting database                      | Persistent audit trail                                     |
| Receipt signing key                 | Reporting configuration                 | Must survive receipt verification lifecycle                |
| Reviewer private key                | Separate reviewer file / browser memory | Never loaded by the reporting service                      |
| Merkle roots and membership roots   | Local blockchain                        | Node lifetime; public-chain commitments would be permanent |

A real policy must define investigation windows, escalation, backup expiry, legal holds, and destruction of old encryption keys. Deleting cases without a compatible nullifier retention policy can accidentally permit repeat submissions. Public-chain commitments cannot be treated as deletable private records.
