# Feature guide

## Membership activation

The enrollment authority checks a synthetic roll number and password. It registers only the browser-generated public Semaphore commitment. The membership secret stays in the browser and can be downloaded as an encrypted membership backup.

## Protected reports

The reporter chooses a topic and slot, writes a synthetic report, and reviews privacy warnings. The browser encrypts the report to the reviewer key and generates a real Semaphore proof in a worker. The API verifies eligibility, scope, message binding, and the unique nullifier before accepting the report.

## Private cases

Each accepted report receives an independent case secret, reply key, and encrypted case backup. A reporter can close the current case and restore another backup. The reviewer sees cases independently and does not receive membership identity data.

## Case lifecycle

Reviewers can move cases through triage, investigation, awaiting information, resolution, and closure. Closing requires a written summary. The reporter sees the closure summary and cannot send messages while the case is closed. The reporter can submit a reopen request with a reason. The reviewer sees a reopen notification, reviews the reason, and moves the case back to `under-review` before messaging is enabled again.

## Reviewer follow-up

Reviewers decrypt reports locally, send encrypted questions, and receive encrypted reporter replies. The reviewer inbox refreshes manually and checks for reopen requests periodically.

## Privacy Lab and transparency

Privacy Lab runs isolated adversarial checks against fresh synthetic data. Transparency verifies signed receipts, Merkle inclusion, and the optional local Hardhat anchor. These checks demonstrate the local implementation; they do not prove anonymity against every network observer or colluding operator.
