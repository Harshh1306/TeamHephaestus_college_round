# Five-minute judging script

## Prepare

Start `npm run dev` and `npm run chain:node`. Verify artifacts are cached. Keep synthetic credentials and encrypted backups locally. Run `npm run demo` beforehand and retain the results as a fallback. Choose an unused reporting slot; do not reset a live database between attempts.

## 0:00–0:35 — Problem

“An authenticated complaint form knows who you are. A public anonymous form does not know whether you belong. Incognito verifies membership without attaching a member identity to the report.”

Show the overview. Explain that proofs verify eligibility, not truth.

## 0:35–1:15 — Membership

Activate membership using a synthetic roll number and password, or unlock Alice’s existing credential. Explain the separate authority and local secret. Show an encrypted backup. Do not display raw private keys on a shared screen.

## 1:15–2:00 — Protected reporting

Write a harmless maintenance report. Show the privacy review and actual encryption/proof-generation stages. Acceptance produces a signed receipt and an independent case credential.

## 2:00–2:45 — Attacks and defenses

Run Privacy Lab. Expand outsider rejection, concurrent duplicates and different-topic nullifiers. Clarify that differences in nullifiers do not alone prove anonymity against every observer.

## 2:45–3:30 — Investigation

Unlock the reviewer workspace. Decrypt the report, triage it and send a question. Return to My case to decrypt the question anonymously. No student identity field is available through the reviewer API.

## 3:30–4:15 — Accountability

Run `npm run chain:demo`. Verify the original receipt in My case. Show that the local EVM contract stores only a batch commitment and that a changed leaf fails the Merkle check. Explicitly identify this as a local blockchain, not a public testnet deployment.

## 4:15–5:00 — Honest impact

Show the transparency screen. Explain operator collusion, metadata and compromised-client limits. Present the next milestone: independently operated enrollment, institution OIDC/MFA, protected evidence handling, and external security review.

## Likely questions

- **Can an outsider forge membership?** Their proof must verify against the authority’s current signed root.
- **Can Alice submit twice?** Each authorized slot has one nullifier; the database consumes it atomically.
- **Does a revoked identity work?** Once the new root is acknowledged, old roots are rejected even if proof verification started earlier.
- **Can the server read the report?** The reporting API has only the recipient public key. In this single-host demo, the machine owner remains trusted and could read separate key files or change the frontend.
- **What happens if the chain goes down?** Admission still works; batches remain pending and can be anchored later.
- **What happens if the acceptance response is lost?** A retained case secret and nonce can recover the original receipt.
