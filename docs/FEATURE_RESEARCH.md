# Two-hour MVP research: Blind Evidence Seal

Research date: 10 October 2026. This replaces the abandoned Privacy Shield proposal. No application feature has been implemented.

## Recommendation

Let a verified reporter commit to the exact bytes of a document without uploading it. Put the blinded fingerprint inside their encrypted report, bind it to the existing signed submission receipt, and verify a supplied file later when the reporter chooses to disclose its opening.

Product phrase: **Seal now. Reveal when ready. Detect replacement.**

Example: a member has a sensitive invoice. They file a report containing its blinded fingerprint while keeping the invoice on their device. Later, the original invoice passes verification; an edited total fails. A fresh seal of the same invoice in another case has a different commitment.

This establishes a match to committed bytes. It does not establish that an allegation is true, a file is genuine, the reporter owns it, or its creation date is accurate.

## Research and differentiation

| Primary source                                                                            | Existing idea                                                       | Implication                                                                                                       |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [SecureDrop source guide](https://docs.securedrop.org/en/stable/source/source.html)       | Anonymous submission of messages and files.                         | Ordinary encrypted file upload is established functionality. Our addition commits before receiving file contents. |
| [OpenTimestamps](https://opentimestamps.org/)                                             | Browser hashing and independently verifiable timestamp proofs.      | Fingerprinting and timestamping are not novel. Do not claim we invented them.                                     |
| [OpenTimestamps client](https://github.com/opentimestamps/opentimestamps-client)          | Nonces protect file digests; timing can still expose relationships. | Use fresh randomness per file and case, with no reusable raw digest.                                              |
| [Callisto cryptographic approach](https://www.projectcallisto.org/cryptographic-approach) | Encrypted reporting and private matching.                           | Valuable prior art, but its machinery is inappropriate to rush into two hours.                                    |
| [Whispli Pulse](https://www.whispli.com/pulse)                                            | Anonymous surveys and early-risk signals.                           | An anonymous corroboration poll alone is not strong differentiation.                                              |
| [Semaphore documentation](https://semaphore.pse.dev/learn)                                | Anonymous membership proofs and signals such as votes.              | Voting is reusable prior art, but a new polling workflow still needs admission rules and persistence.             |

Our proposed distinction is anonymous verified membership, topic-scoped duplicate control, independent case credentials and evidence committed before disclosure. This research cannot establish worldwide novelty or what other teams are building.

Other candidates: richer local identity warnings would be faster but extend functionality already present in our privacy review; anonymous corroboration needs more backend work; cloud AI rewriting introduces a new disclosure boundary and uncertain meaning preservation.

## Why this fits the current code

- `apps/web/App.tsx` already seals report JSON locally; add an optional evidence commitment to that encrypted JSON.
- `packages/protocol/index.ts` binds the encrypted envelope into the proof message and receipt commitment.
- `apps/api/app.ts` signs that commitment with a case reference and acceptance time. No new admission service or database table is needed.
- `apps/web/api.ts` defines the case vault. Add optional opening data and the exact submitted envelope to the existing encrypted backup.
- The reviewer already decrypts report JSON locally; add a local verification panel.

Important finding: the case API currently returns ciphertext and a receipt, but not the full original envelope. A valid receipt signature alone does not establish that the displayed evidence belongs to that receipt. Preserve the original envelope and verify the complete binding.

## Minimum scope

One optional file, maximum 20 MiB. Read bytes through the browser file picker, without file-content upload or cloud AI. Use native SHA-256 through [Web Crypto](https://www.w3.org/TR/WebCryptoAPI/).

Proposed construction:

```text
fileDigest = SHA256(exact file bytes)
salt = fresh 32 random bytes
commitment = SHA256(UTF8(JSON.stringify([
  "incognito:evidence:v1", saltHex, fileDigestHex
])))
```

Store only a versioned evidence ID and commitment inside the encrypted report. Exclude original filename, path, modification time, raw file digest and salt. Generate a fresh ID per seal; never derive it from membership or file contents.

Keep the salt and full submitted envelope in the encrypted case backup. Preserve them through retries and receipt recovery. Do not persist file bytes.

After acceptance, let the reporter export a small opening bundle: evidence ID, salt, original encrypted envelope and receipt. Exclude membership secrets, case-access secrets and private keys. Explain that disclosure allows the recipient to test candidate files. The existing encrypted follow-up channel can carry this small JSON bundle.

Reviewer verification must:

1. Verify the receipt using the configured receipt public key, never a key supplied in the bundle.
2. Recompute the full envelope commitment and match it to the signed receipt.
3. Match its case reference and ciphertext to the selected case.
4. Decrypt that envelope and extract its original evidence commitment.
5. Hash the locally selected file with the disclosed salt and compare commitments.

Show separate outcomes: **File matches original seal**, **File differs**, and **Receipt binding invalid**. Missing or malformed openings cannot pass. Existing reports without evidence must remain readable.

The reviewer needs the original file separately, with the reporter's consent. A local chooser verifies a file; it does not deliver one. Automatic attachment sharing, previews, redaction, independent timestamping and multi-file management are outside this MVP.

## Two-hour budget

This is an engineering estimate based on the inspected code, not a guarantee.

| Minutes | Work                                                                              |
| ------- | --------------------------------------------------------------------------------- |
| 0–15    | Commitment helper, opening validation and file-size limit.                        |
| 15–40   | Report picker and encrypted manifest; preserve envelope and opening in the vault. |
| 40–60   | Opening export and encrypted-backup compatibility.                                |
| 60–85   | Reviewer local verification with complete receipt binding.                        |
| 85–110  | Security checks, typecheck/build and browser walkthrough.                         |
| 110–120 | Update feature/test guides and rehearse the demo.                                 |

Reuse current receipts and optional local audit anchoring. Avoid new deployment, contracts, models, file-storage services or ZK circuits. If receipt binding is unfinished, the feature is unfinished.

## One-minute judge demonstration

1. Select a synthetic invoice while writing a report; its contents stay local.
2. Submit with the existing membership proof and retain the encrypted backup.
3. Open the report as reviewer: it contains a seal, not the invoice.
4. Disclose the opening and select the original invoice locally: verification passes.
5. Select an invoice with one changed amount: verification fails.
6. Show a second seal of the same bytes has a different commitment.

Pitch: “A member can commit evidence without handing it over immediately. When they choose to disclose it, we detect whether those exact bytes match the original report.”

## Verification and boundaries

A small local Web Crypto experiment was executed during research: original bytes matched; a changed byte failed; fresh randomness changed the seal; a wrong opening failed. This validates those examples, not the unimplemented receipt/export/UI integration or a formally audited scheme.

Required checks: changed envelope/receipt/commitment rejection, wrong case/salt rejection, no file bytes or original metadata in requests/storage, backup restoration, old-report compatibility and unchanged forged-proof/duplicate controls. Renaming identical bytes should pass. Re-saving a PDF, changing embedded metadata or taking another screenshot should fail because bytes differ.

Acceptance time is asserted by our receipt-signing service. The existing local Hardhat chain demonstrates anchoring, not independently trusted public time. Do not call this a court-admissible certificate, proof of possession or independent timestamp. OpenTimestamps is a possible later extension; blockchain confirmation is not necessarily immediate.

Fresh randomness prevents equality matching of unopened commitments. Once a file is disclosed in multiple cases, its contents can link those cases. Network timing, revealing report text, compromised clients and host-operator access remain outside this feature's protection.

This fits administrator privacy and cross-topic correlation resistance by minimizing evidence disclosure and avoiding global file/member identifiers. Membership verification and duplicate control remain the existing system's responsibility.
