import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { Identity } from '@semaphore-protocol/identity';
import { Group } from '@semaphore-protocol/group';
import { verifyProof } from '@semaphore-protocol/proof';
import { createApp } from '../../apps/api/app';
import { database, migrate } from '../database/index';
import { keypair, seal, unseal, lockVault, unlockVault } from '../crypto/index';
import { prove } from '../crypto/prove';
import {
  randomHex,
  ORGANIZATION,
  GROUP,
  TOPICS,
  currentPeriod,
  accessVerifierFor,
  snapshotBytes,
  receiptBytes,
  type Envelope,
  type Snapshot,
  type Submission,
} from '../protocol/index';
import { signText, verifyText } from '../server/signatures';
export type LabResult = {
  id: string;
  name: string;
  passed: boolean;
  durationMs: number;
  evidence: string;
};
export async function runLab(onResult?: (result: LabResult) => void) {
  const started = performance.now(),
    results: LabResult[] = [];
  const check = async (id: string, name: string, fn: () => Promise<boolean>, evidence: string) => {
    const t = performance.now();
    let passed = false;
    try {
      passed = await fn();
    } catch {
      /* A failed assertion is evidence, not a passing guard. */
    }
    const result = {
      id,
      name,
      passed,
      durationMs: Math.round(performance.now() - t),
      evidence: passed ? evidence : 'Assertion failed. Inspect the integration test locally.',
    };
    results.push(result);
    onResult?.(result);
  };
  const keys = generateKeyPairSync('ed25519'),
    priv = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    pub = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const secrets = [randomHex(), randomHex(), randomHex()],
    members = secrets.map((v) => new Identity(v).commitment.toString());
  const unsigned = {
    organizationId: ORGANIZATION,
    groupId: GROUP,
    epoch: 1,
    root: new Group(members).root.toString(),
    members,
  };
  const snapshot: Snapshot = { ...unsigned, signature: signText(snapshotBytes(unsigned), priv) };
  const reviewerKeys = await keypair(),
    reporterKeys = await keypair(),
    caseSecret = randomHex();
  const config = {
    authorityPublicKey: pub,
    receiptPrivateKey: priv,
    receiptPublicKey: pub,
    reviewerPublicKey: reviewerKeys.publicKey,
    reviewerToken: randomHex(),
    reviewerTopics: [...TOPICS],
    snapshot,
  };
  const db = await database(':memory:');
  await migrate(db);
  const app = await createApp(db, config);
  const envelope: Envelope = {
    protocolVersion: 'incognito-v1',
    organizationId: ORGANIZATION,
    topicId: 'infrastructure',
    policyVersion: 1,
    period: currentPeriod(),
    slot: 0,
    keyVersion: 1,
    ciphertext: await seal(
      'Synthetic report: laboratory ventilation needs maintenance.',
      reviewerKeys.publicKey,
    ),
    accessVerifier: await accessVerifierFor(caseSecret),
    replyPublicKey: reporterKeys.publicKey,
    nonce: randomHex(),
  };
  const submit = (body: unknown) =>
    app.inject({ method: 'POST', url: '/v1/reports', payload: body as any });
  const change = (s: Submission, fn: (s: Submission) => void) => {
    const copy = structuredClone(s);
    fn(copy);
    return copy;
  };
  try {
    const valid = await prove(secrets[0], snapshot, envelope);
    await check(
      'ZK-01',
      'Real member proof verifies',
      () => verifyProof(valid.proof as any),
      'Generated and verified a Semaphore V4 Groth16 proof for one of three synthetic members.',
    );
    await check(
      'ZK-02',
      'Outsider rejected',
      async () => {
        try {
          await prove(randomHex(), snapshot, envelope);
          return false;
        } catch {
          const outsider = randomHex(),
            outsiderMembers = [new Identity(outsider).commitment.toString(), ...members.slice(1)];
          const forged = await prove(
            outsider,
            {
              ...snapshot,
              members: outsiderMembers,
              root: new Group(outsiderMembers).root.toString(),
            },
            envelope,
          );
          return (await submit(forged)).json().code === 'UNAUTHORIZED_GROUP';
        }
      },
      'A valid proof for an outsider-controlled group was rejected by the API.',
    );
    await check(
      'ZK-03',
      'Altered proof rejected',
      async () =>
        (await submit(change(valid, (s) => (s.proof.points[0] = '1')))).json().code ===
        'INVALID_PROOF',
      'Mutating a curve point fails cryptographic verification.',
    );
    await check(
      'ZK-04',
      'Unauthorized root rejected',
      async () =>
        (await submit(change(valid, (s) => (s.proof.merkleTreeRoot = '123')))).json().code ===
        'UNAUTHORIZED_GROUP',
      'The server checks its authorized membership state.',
    );
    await check(
      'SCOPE-01',
      'Topic substitution rejected',
      async () =>
        (await submit(change(valid, (s) => (s.envelope.topicId = 'other')))).json().code ===
        'INVALID_SCOPE',
      'Changing the topic invalidates the server-derived scope.',
    );
    await check(
      'MSG-01',
      'Ciphertext substitution rejected',
      async () =>
        (
          await submit(
            change(valid, (s) => (s.envelope.ciphertext = 'A' + s.envelope.ciphertext.slice(1))),
          )
        ).json().code === 'MESSAGE_MISMATCH',
      'The proof is bound to the exact encrypted report.',
    );
    await check(
      'MSG-02',
      'Case credential substitution rejected',
      async () =>
        (await submit(change(valid, (s) => (s.envelope.accessVerifier = randomHex())))).json()
          .code === 'MESSAGE_MISMATCH',
      'An intercepted proof cannot be rebound to an attacker’s case credential.',
    );
    await check(
      'API-01',
      'Expired period rejected',
      async () =>
        (await submit(change(valid, (s) => (s.envelope.period = '2000-01')))).json().code ===
        'POLICY_EXPIRED',
      'Admission accepts only the active UTC month.',
    );
    await check(
      'API-02',
      'Unauthorized slot rejected',
      async () => (await submit(change(valid, (s) => (s.envelope.slot = 3)))).statusCode === 400,
      'Only policy-authorized slots 0, 1 and 2 are accepted.',
    );
    await check(
      'PRIV-01',
      'Identity fields rejected',
      async () => (await submit({ ...valid, studentId: 'synthetic-student' })).statusCode === 400,
      'Strict schemas reject extra identity fields in report requests.',
    );
    await check(
      'API-03',
      'Oversized request rejected',
      async () => (await submit({ oversized: 'x'.repeat(160000) })).statusCode === 413,
      'Oversized requests are rejected before cryptographic verification.',
    );
    let caseId = '',
      receipt: any;
    await check(
      'DUP-02',
      'Concurrent duplicates: exactly one case',
      async () => {
        const responses = await Promise.all([submit(valid), submit(valid)]);
        const accepted = responses.filter((r) => r.statusCode === 201);
        if (accepted[0]) {
          receipt = accepted[0].json().receipt;
          caseId = receipt.caseId;
        }
        return (
          accepted.length === 1 &&
          responses.filter((r) => r.statusCode === 409).length === 1 &&
          (await db.query('SELECT id FROM reports')).length === 1 &&
          (await db.query('SELECT * FROM used_nullifiers')).length === 1
        );
      },
      'Two concurrent requests produced one case and one consumed nullifier.',
    );
    await check(
      'REPLAY-01',
      'Replay cannot disclose a case secret',
      async () => {
        const response = await submit(valid);
        return (
          response.statusCode === 409 &&
          !response.body.includes(caseSecret) &&
          !response.body.includes('receipt')
        );
      },
      'Replaying acceptance creates no second case and returns no secret.',
    );
    await check(
      'DUP-01',
      'Same slot produces the same nullifier',
      async () => {
        const second = await prove(secrets[0], snapshot, { ...envelope, nonce: randomHex() });
        return (
          second.proof.nullifier === valid.proof.nullifier &&
          (await submit(second)).statusCode === 409 &&
          (await db.query('SELECT id FROM reports')).length === 1
        );
      },
      'A fresh valid proof in the same slot is atomically rejected; insertion rolls back.',
    );
    await check(
      'SCOPE-02',
      'Another topic has a distinct nullifier',
      async () => {
        const other = await prove(secrets[0], snapshot, {
          ...envelope,
          topicId: 'other',
          nonce: randomHex(),
        });
        return (
          other.proof.nullifier !== valid.proof.nullifier &&
          (await submit(other)).statusCode === 201
        );
      },
      'Two authorized topics yield different nullifiers and both can be accepted.',
    );
    await check(
      'SCOPE-03',
      'Another authorized slot is accepted',
      async () => {
        const other = await prove(secrets[0], snapshot, {
          ...envelope,
          slot: 1,
          nonce: randomHex(),
        });
        return (
          other.proof.nullifier !== valid.proof.nullifier &&
          (await submit(other)).statusCode === 201
        );
      },
      'A second authorized slot permits a legitimate additional report.',
    );
    await check(
      'ENC-01',
      'Only the intended reviewer decrypts',
      async () => {
        const stranger = await keypair();
        const original = await unseal(
          envelope.ciphertext,
          reviewerKeys.publicKey,
          reviewerKeys.privateKey,
        );
        try {
          await unseal(envelope.ciphertext, stranger.publicKey, stranger.privateKey);
          return false;
        } catch {
          return original.startsWith('Synthetic report:');
        }
      },
      'Correct recipient decrypts; unrelated recipient fails sealed-box authentication.',
    );
    await check(
      'ENC-02',
      'Modified ciphertext fails decryption',
      async () => {
        try {
          await unseal(
            'A' + envelope.ciphertext.slice(1),
            reviewerKeys.publicKey,
            reviewerKeys.privateKey,
          );
          return false;
        } catch {
          return true;
        }
      },
      'Ciphertext corruption is detected by authenticated encryption.',
    );
    await check(
      'AUTH-01',
      'Unauthenticated reviewer denied',
      async () => (await app.inject({ url: '/v1/reviewer/cases' })).statusCode === 403,
      'The API, not just the UI, enforces reviewer access.',
    );
    await check(
      'AUTH-02',
      'Wrong case credential denied',
      async () =>
        (
          await app.inject({
            url: `/v1/cases/${caseId}`,
            headers: { authorization: `Bearer ${randomHex()}` },
          })
        ).statusCode === 403,
      'Case access requires its own random secret.',
    );
    await check(
      'AUTH-03',
      'Correct case credential accepted',
      async () =>
        (
          await app.inject({
            url: `/v1/cases/${caseId}`,
            headers: { authorization: `Bearer ${caseSecret}` },
          })
        ).statusCode === 200,
      'The reporter follows up without institutional authentication.',
    );
    await check(
      'RECOVERY-01',
      'Lost acceptance response can be recovered',
      async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/cases/access',
          payload: { secret: caseSecret, nonce: envelope.nonce },
        });
        return response.statusCode === 200 && response.json().receipt.caseId === caseId;
      },
      'A retained case secret and proof-bound nonce recover the original receipt.',
    );
    await check(
      'AUTH-04',
      'Reviewer topic permissions enforced',
      async () => {
        config.reviewerTopics = ['other'];
        const denied = await app.inject({
          url: `/v1/reviewer/cases/${caseId}`,
          headers: { authorization: `Bearer ${config.reviewerToken}` },
        });
        config.reviewerTopics = [...TOPICS];
        return denied.statusCode === 403;
      },
      'A valid reviewer token alone does not authorize a case outside its permitted topics.',
    );
    await check(
      'CASE-01',
      'Status transitions are checked and audited',
      async () => {
        const headers = { authorization: `Bearer ${config.reviewerToken}` };
        const invalid = await app.inject({
          method: 'PATCH',
          url: `/v1/reviewer/cases/${caseId}/status`,
          headers,
          payload: { status: 'resolved' },
        });
        const valid = await app.inject({
          method: 'PATCH',
          url: `/v1/reviewer/cases/${caseId}/status`,
          headers,
          payload: { status: 'triaged' },
        });
        return (
          invalid.statusCode === 409 &&
          valid.statusCode === 200 &&
          (await db.query('SELECT * FROM review_events WHERE case_id=$1', [caseId])).length === 1
        );
      },
      'Skipping directly to resolution is rejected; triage writes an audit event atomically.',
    );
    await check(
      'CASE-03',
      'Closure, reporter reopen request and reviewer reopen work',
      async () => {
        const reviewerHeaders = { authorization: `Bearer ${config.reviewerToken}` };
        const closed = await app.inject({
          method: 'PATCH',
          url: `/v1/reviewer/cases/${caseId}/status`,
          headers: reviewerHeaders,
          payload: {
            status: 'closed',
            reason: 'The maintenance team completed the corrective work.',
          },
        });
        const closedCase = await app.inject({
          url: `/v1/cases/${caseId}`,
          headers: { authorization: `Bearer ${caseSecret}` },
        });
        const blocked = await app.inject({
          method: 'POST',
          url: `/v1/cases/${caseId}/messages`,
          headers: { authorization: `Bearer ${caseSecret}` },
          payload: { id: randomUUID(), ciphertext: await seal('blocked', reviewerKeys.publicKey) },
        });
        const requested = await app.inject({
          method: 'POST',
          url: `/v1/cases/${caseId}/reopen`,
          headers: { authorization: `Bearer ${caseSecret}` },
          payload: { reason: 'I have one more detail to provide.' },
        });
        const reopened = await app.inject({
          method: 'PATCH',
          url: `/v1/reviewer/cases/${caseId}/status`,
          headers: reviewerHeaders,
          payload: { status: 'under-review' },
        });
        const finalCase = await app.inject({
          url: `/v1/cases/${caseId}`,
          headers: { authorization: `Bearer ${caseSecret}` },
        });
        return (
          closed.statusCode === 200 &&
          closedCase.statusCode === 200 &&
          closedCase.json().closureReason.includes('completed') &&
          blocked.statusCode === 409 &&
          requested.statusCode === 200 &&
          reopened.statusCode === 200 &&
          finalCase.json().status === 'under-review' &&
          finalCase.json().reopenRequested === false
        );
      },
      'Closed cases reject reporter messages, expose the reviewer summary, and reopen only after reviewer action.',
    );
    await check(
      'CASE-02',
      'Encrypted two-way follow-up works',
      async () => {
        const reply = await seal('Synthetic reviewer question', reporterKeys.publicKey),
          response = await seal('Synthetic reporter answer', reviewerKeys.publicKey);
        const a = await app.inject({
          method: 'POST',
          url: `/v1/reviewer/cases/${caseId}/messages`,
          headers: { authorization: `Bearer ${config.reviewerToken}` },
          payload: { id: randomUUID(), ciphertext: reply },
        });
        const b = await app.inject({
          method: 'POST',
          url: `/v1/cases/${caseId}/messages`,
          headers: { authorization: `Bearer ${caseSecret}` },
          payload: { id: randomUUID(), ciphertext: response },
        });
        return (
          a.statusCode === 201 &&
          b.statusCode === 201 &&
          (await unseal(reply, reporterKeys.publicKey, reporterKeys.privateKey)) ===
            'Synthetic reviewer question' &&
          (await unseal(response, reviewerKeys.publicKey, reviewerKeys.privateKey)) ===
            'Synthetic reporter answer'
        );
      },
      'Each direction decrypts only with its recipient’s private key.',
    );
    await check(
      'RECEIPT-01',
      'Receipt signature detects alteration',
      async () =>
        verifyText(receiptBytes(receipt), receipt.signature, pub) &&
        !verifyText(receiptBytes({ ...receipt, commitment: randomHex() }), receipt.signature, pub),
      'The Ed25519 receipt covers the case ID, commitment and acceptance time.',
    );
    await check(
      'ENC-03',
      'Encrypted backup restores; wrong password fails',
      async () => {
        const vault = await lockVault({ secret: caseSecret }, 'synthetic passphrase');
        if ((await unlockVault(vault, 'synthetic passphrase')).secret !== caseSecret) return false;
        try {
          await unlockVault(vault, 'wrong passphrase');
          return false;
        } catch {
          return true;
        }
      },
      'AES-GCM backup authentication and password-derived decryption execute successfully.',
    );
    await check(
      'PRIV-02',
      'Reporting records contain no member identity',
      async () => {
        const rows = JSON.stringify(await db.query('SELECT * FROM reports'));
        return (
          !rows.includes(secrets[0]) &&
          !rows.includes(members[0]) &&
          !rows.includes('Synthetic report:') &&
          !rows.includes(caseSecret)
        );
      },
      'Persisted report records contain ciphertext and per-case metadata, without membership secrets, commitments or plaintext.',
    );
    await check(
      'REV-01',
      'Revocation invalidates old proofs',
      async () => {
        const nextMembers = [new Identity(randomHex()).commitment.toString(), ...members.slice(1)];
        const next = {
          ...unsigned,
          epoch: 2,
          members: nextMembers,
          root: new Group(nextMembers).root.toString(),
        };
        const r = await app.inject({
          method: 'POST',
          url: '/v1/internal/snapshots',
          payload: { ...next, signature: signText(snapshotBytes(next), priv) },
        });
        return r.statusCode === 200 && (await submit(valid)).json().code === 'UNAUTHORIZED_GROUP';
      },
      'A signed new epoch is installed; all proofs against the old root are rejected.',
    );
    await check(
      'MEM-01',
      'Forged membership update rejected',
      async () =>
        (
          await app.inject({
            method: 'POST',
            url: '/v1/internal/snapshots',
            payload: { ...snapshot, epoch: 3 },
          })
        ).statusCode === 400,
      'A root update requires the enrollment authority’s valid signature.',
    );
    await check(
      'MEM-02',
      'Old signed root cannot be restored',
      async () =>
        (await app.inject({ method: 'POST', url: '/v1/internal/snapshots', payload: snapshot }))
          .statusCode === 409,
      'Monotonic epochs reject a correctly signed but outdated snapshot.',
    );
  } finally {
    await app.close();
    await db.close();
  }
  return {
    suite: 'Incognito adversarial admission v1',
    synthetic: true,
    executedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    results,
    passed: results.filter((r) => r.passed).length,
    total: results.length,
  };
}
