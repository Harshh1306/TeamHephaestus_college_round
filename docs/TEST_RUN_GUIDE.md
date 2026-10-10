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
4. Submit a harmless synthetic report and download its encrypted case backup.
5. Open Reviewer workspace with `.local/reviewer/credentials.json`.
6. Open the case, decrypt it locally, and send an encrypted question.
7. Return to My case, refresh status, decrypt the question, and send a reply. The reporter sees their newly sent message during the current session.
8. In the reviewer workspace, add a closure summary and select `closed`.
9. Return to My case and verify that the closure summary is visible and the reply control is disabled.
10. Enter a reopen reason and select `Request reopen`.
11. Refresh the reviewer inbox, confirm `reopen requested`, and move the case back to `under-review`.
12. Return to My case and verify that messaging is enabled again.
13. Use `Close case and choose another` or the encrypted case backup restore control to switch cases.

## Optional blockchain check

With the API and at least one accepted report running, start `npm run chain:node` in another terminal and run:

```sh
npm run chain:demo
```

Verify the receipt again from My case. The local chain uses chain ID 31337 and is reset when its node stops.

## Expected privacy behavior

The reporting API should never receive a roll number, password, membership secret, report plaintext, or reviewer private key. Different topics and slots should use different nullifiers. A closed case must reject reporter message POST requests with `CASE_CLOSED`. A reopen request must be visible to the reviewer and must require reviewer action before messages are accepted again.
