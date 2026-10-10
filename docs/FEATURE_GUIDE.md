# Feature guide

## Membership activation

The enrollment authority checks a synthetic roll number and password. It registers only the browser-generated public Semaphore commitment. The membership secret stays in the browser and can be downloaded as an encrypted membership backup.

## Protected reports

The reporter chooses a topic and slot, writes a synthetic report, and reviews privacy warnings. The browser encrypts the report to the reviewer key and generates a real Semaphore proof in a worker. The API verifies eligibility, scope, message binding, and the unique nullifier before accepting the report.

## Private cases

Each accepted report receives an independent case secret, reply key, and encrypted case backup. A reporter can close the current case and restore another backup. The reviewer sees cases independently and does not receive membership identity data.

My case shows the original title and content immediately after submission. This private copy remains in browser memory and is included in new encrypted case backups; it is never sent to the API as plaintext. Restoring a new backup restores the original text too. Older backups still open but cannot display text that was never saved in them.

## Public cases and community support

During case creation, a reporter can keep the case private or publish a separate, member-visible summary with a public title. The public title is 3–120 characters and the summary is 20–1000 characters; both are proof-bound when the report is submitted. Public case cards display this title above the summary. Older public cases use a short summary excerpt as their heading until their owner adds a title in My case. The full report and conversation remain encrypted and are never included in the public feed. A case owner can later publish, edit, or unpublish the title and summary from My case using that case's independent secret. Unpublishing hides it from new feed requests but cannot retract copies that members already saw.

The Public cases tab requires an active membership credential on the device. Reading the feed, supporting a case, and posting a comment each require a fresh Semaphore membership proof. A member can support and comment on each case once; a comment is optional, visible to other members, and limited to 800 characters. The feed shows the support count, threshold, and comments. Case-scoped action nullifiers prevent repeat actions without exposing the member's identity or correlating actions across cases through a reused nullifier.

A reporter chooses a support threshold and can delay **public reviewer priority** until it is met. Before then, the reviewer still sees the complete case in Private cases. Once the threshold is reached, the case moves to the reviewer's Public cases group with an urgent badge. If the reporter does not delay priority, the case appears in that group immediately. Public cases are ordered by support count, with urgency breaking ties. The reporter can see the support count in My case.

Public summaries and comments are not encrypted. They can reveal a writer through their content, timing, or writing style. The UI prompts reporters to remove identifying details; members should use synthetic text in this demo. One-comment-per-member is a basic abuse limit, not content moderation.

## Case lifecycle

Reviewers can move cases through triage, investigation, awaiting information, resolution, and closure. Closing requires a written summary. The reporter sees the closure summary and cannot send messages while the case is closed. The reporter can submit a reopen request with a reason. The reviewer sees a reopen notification, reviews the reason, and moves the case back to `under-review` before messaging is enabled again.

## Reviewer follow-up

Reviewers decrypt reports locally, send encrypted questions, and receive encrypted reporter replies. The reviewer inbox refreshes manually and checks for reopen requests periodically.

The selected case shows Anonymous follow-up above Forward to another department, so the reviewer can read and reply to the conversation before reaching the transfer controls.

## Interdepartmental handoffs

Each reporting category is owned by one department: Academic Affairs, Student Services,
Facilities, Campus Safety, or the Ombuds Office. Multiple authorized reviewers can work from a
department's encrypted inbox.

If a case needs another department, the owning reviewer writes a minimum-necessary summary and
chooses a destination department. The browser encrypts that summary to the destination
department before it is submitted. The handoff is routed internally so the reportee experiences
a seamless single point of contact without exposing internal administrative structure.
An authorized destination reviewer must explicitly acknowledge the handoff.

The original report and anonymous conversation remain with the owning department; the receiving
department sees only the encrypted summary. Handoff audit events record the source,
destination, and acknowledgement, never the summary plaintext.

The synthetic demo uses a departmental inbox key shared by its reviewers so two reviewers can
demonstrate a shared queue. Production should replace this with individual recipient encryption,
managed reviewer identities, and key rotation.

## Privacy Lab and transparency

Privacy Lab runs isolated adversarial checks against fresh synthetic data. Transparency verifies signed receipts, Merkle inclusion, and the optional local Hardhat anchor. These checks demonstrate the local implementation; they do not prove anonymity against every network observer or colluding operator.
