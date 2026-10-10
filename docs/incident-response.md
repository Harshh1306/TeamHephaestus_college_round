# Incident response outline

This is a runbook to rehearse, not evidence that response operations are production-ready.

1. **Suspected reviewer key compromise:** suspend that reviewer’s API access, isolate the key, determine which key-version ciphertexts were exposed, and stop new encryption to it. A replacement key does not make previously exposed ciphertext safe. Establish reviewed migration and notification procedures.
2. **Authority compromise:** suspend enrollment/root publication, audit authorized changes, and publish a new signed epoch from trusted recovered keys. Do not restore an old valid root to bypass revocation. Independently verify issuer eligibility records.
3. **Reporter secret loss:** explain that the encrypted export is the recovery mechanism. Do not silently replace an identity and reset its quotas. Lost case credentials cannot be derived from institutional identity.
4. **Report database failure:** stop acknowledgements until commits can complete, preserve storage, restore in an isolated environment, and compare signed receipts and anchored commitments. Use the original case secret/nonce to recover lost response receipts.
5. **Blockchain outage:** retain pending batches and continue off-chain admission; retry the anchoring script once the node is healthy. Do not label an unverified root as anchored.
6. **Malicious frontend/supply chain:** stop distribution, investigate signed release/dependency provenance, and assume plaintext and secrets entered into that client may have been exposed. Browser encryption cannot fix a malicious client.

Preserve privacy-minimized evidence. Do not turn on full request-body or credential logging during an incident.
