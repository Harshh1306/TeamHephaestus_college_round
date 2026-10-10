# Cryptographic specification — incognito-v1

## Versions

- Semaphore identity/group/proof SDK: **4.14.3**.
- Proving artifacts: Semaphore **4.13.0**, tree depth **6**, as selected by the installed SDK source.
- Artifact hashes: repository `artifacts.sha256.json`; downloaded from the official PSE artifact host and pinned after first acquisition.
- Initial group: three synthetic members; authority may enroll up to the configured synthetic roster. The protocol rejects snapshots with fewer than 3 or more than 64 distinct leaves.
- libsodium-wrappers-sumo: **0.8.4**; sealed boxes use ephemeral X25519 + XSalsa20-Poly1305 as implemented by libsodium.

## Encoding

All strings are UTF-8. Decimal public inputs have canonical decimal syntax with no leading zeros. Protocol objects reject unknown fields. SHA-256-to-field is the unsigned big-endian digest integer modulo the BN254 scalar field:

`21888242871839275222246405745257275088548364400416034343698204186575808495617`

Fixed-position JSON arrays establish field ordering. The SDK then applies its own public message/scope hashing internally; the application does not substitute a new proof protocol.

Scope preimage:

```text
["incognito:scope:v1", "college-demo", "institution-members-v1", 1,
 topicId, utcMonthYYYYMM, slot]
```

Only the current UTC month and slots 0, 1 and 2 are accepted. Scopes do not contain group roots, so routine enrollment updates do not reset quotas.

Envelope encoding, in exact order:

```text
[protocolVersion, organizationId, topicId, policyVersion, period,
 slot, keyVersion, ciphertext, accessVerifier, replyPublicKey, nonce]
```

For a member-public report, append a nested array `[summary, supportThreshold, privateUntilThreshold, title]`. For older public reports without a title, this nested array has only the first three elements. Private reports append nothing. This preserves the exact commitment bytes of existing reports while binding new public titles to their proofs and receipts.

`message = fieldHash(JSON.stringify(["incognito:message:v1", canonicalEnvelope]))`

`commitment = SHA256(JSON.stringify(["incognito:receipt:v1", canonicalEnvelope]))`

`accessVerifier = SHA256(JSON.stringify(["incognito:case-access:v1", secret]))`

The private case secret and client nonce are independent 256-bit random values. The browser also generates a fresh Curve25519 reply keypair per case. It encrypts report JSON to the pinned-by-configuration reviewer public key. Public-key authenticity ultimately depends on trusted client/configuration delivery in this demo.

New case vaults also retain a local copy of the original report title and details. That copy is included inside the password-encrypted backup and is not part of the API submission payload. Older case vaults remain usable without a local report copy.

`generateProof(identity, group, message, scope, 6, localArtifacts)` produces the actual Semaphore proof. The client identity is never an argument to the submission API.

## Signatures

Authority snapshots are Ed25519 signatures over the UTF-8 JSON array `[organizationId, groupId, epoch, root, members]`. The API reconstructs the Merkle root from the members and verifies the signature. The browser repeats this validation. The authority public key delivered by the app is not an independent trust anchor against a malicious app operator.

Acceptance receipts use a separate Ed25519 key and the preimage `["incognito:receipt-signature:v1", caseId, commitment, acceptedAt]`. The receipt signing private key belongs to the reporting service; it cannot decrypt reports. A signed receipt demonstrates acceptance by this service, not fair investigation or prevention of pre-acceptance censorship.

## Audit Merkle tree

Leaves are original envelope commitments. Each parent is SHA-256 of `["incognito:audit-node:v1", left, right]`, with the two lowercase hexadecimal children sorted lexicographically. Odd levels duplicate their final node. Proofs contain siblings; the verifier repeats sorted pair hashing. A singleton root equals its leaf. Batch IDs are random UUIDs hashed to bytes32 for the contract. No case IDs or per-report proofs are published to the chain.

The browser validates the original receipt signature, checks its commitment against the inclusion leaf, recomputes the Merkle path, and reads the contract root over the local RPC. Public testnet addresses, finality/reorganization behavior and independently pinned contract identity are not implemented yet.

## Secret storage

Membership and case secrets remain in browser memory. Exports use AES-256-GCM, a fresh 16-byte salt, 12-byte IV, and PBKDF2-HMAC-SHA-256 with 600,000 iterations and a user passphrase of at least 12 characters. The export format is versioned. Password strength and endpoint security remain important. Lost credentials cannot be silently reissued without considering quota resets.
