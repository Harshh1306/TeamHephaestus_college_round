# Test run guide

Run commands from the repository root.

## Automated checks

```sh
npm run typecheck
npm run format:check
npm test
npm run demo
npm audit
npm run build
```

Expected results are zero type errors, all files formatted, all Vitest suites passing, the demo lab reporting every check passed, no known npm audit vulnerabilities, and a successful Vite production build. The demo writes sanitized evidence to `docs/test-evidence/latest.json`.

## Browser workflow

1. Start `npm run dev` and open <http://127.0.0.1:5173>.
2. Activate membership with an unused roll number/password from `.local/demo-credentials.json`.
3. Download the encrypted membership backup.
4. Submit a harmless synthetic report. Confirm My case displays its original title and full content, then download its encrypted case backup. Restore that backup and confirm the same text is still visible.
5. Open Reviewer workspace with `.local/reviewer/credentials.json`.
6. Open the case, decrypt it locally, and send an encrypted question. Confirm Anonymous follow-up appears above Forward to another department.
7. Return to My case, refresh status, decrypt the question, and send a reply. The reporter sees their newly sent message during the current session.
8. In the reviewer workspace, add a closure summary and select `closed`.
9. Return to My case and verify that the closure summary is visible and the reply control is disabled.
10. Enter a reopen reason and select `Request reopen`.
11. Refresh the reviewer inbox, confirm `reopen requested`, and move the case back to `under-review`.
12. Return to My case and verify that messaging is enabled again.
13. Use `Close case and choose another` or the encrypted case backup restore control to switch cases.

## Public cases workflow

Use three different **unused** demo roll-number/password pairs so you can create three membership credentials. Keep each browser session or encrypted membership backup separate.

1. With member A, create a report and enable **Make this case visible in Public cases**. Write a separate public summary title and a summary that contain no private report text, set the support threshold to `2`, and enable the option to keep reviewer priority private until the threshold. Submit and save the encrypted case backup.
2. Open Public cases with member A. Confirm the public summary title is the card heading and the summary is below it, while the full report text and private conversation are absent.
3. Open the reviewer inbox with the correct department credential. Confirm the complete report is in **Private cases** before it has two supports.
4. With member B, open Public cases, support the case, and optionally add one comment. Confirm the count is `1` and the comment is visible. A second support or comment from B must be rejected.
5. With member C, support the same case. Confirm the count is `2`. Refresh the reviewer inbox: it should now appear under **Public cases** with an urgent badge, ahead of less-supported public cases. The reviewer can still decrypt the full case.
6. Restore member A's case backup in My case. Confirm the count is `2`. Edit the public title, summary or threshold and save; check the feed and reviewer grouping again. Unpublish it and confirm the feed no longer lists it.
7. Create a separate fully private report. Verify it never appears in Public cases and stays in the reviewer Private cases group.

The automated `tests/public-cases.test.ts` integration test exercises proof-gated reading, duplicate support/comment rejection, threshold priority, owner-only publication edits, and omission of private case data from the member feed.

## Optional blockchain check

With the API and at least one accepted report running, start `npm run chain:node` in another terminal and run:

```sh
npm run chain:demo
```

Verify the receipt again from My case. The local chain uses chain ID 31337 and is reset when its node stops.

## Expected privacy behavior

The reporting API should never receive a roll number, password, membership secret, report plaintext, or reviewer private key. Different topics, slots, public cases, and public actions should use different nullifiers. The public feed must not contain the encrypted report or private conversation; summaries and comments are deliberately public to verified members. A closed case must reject reporter message POST requests with `CASE_CLOSED`. A reopen request must be visible to the reviewer and must require reviewer action before messages are accepted again.
