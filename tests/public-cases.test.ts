import { expect, test } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { Identity } from '@semaphore-protocol/identity';
import { Group } from '@semaphore-protocol/group';
import { createApp } from '../apps/api/app';
import { database, migrate } from '../packages/database/index';
import { keypair, seal } from '../packages/crypto/index';
import { prove, provePublicSignal } from '../packages/crypto/prove';
import {
  accessVerifierFor,
  canonicalEnvelope,
  currentPeriod,
  randomHex,
  snapshotBytes,
  type Envelope,
  type Snapshot,
} from '../packages/protocol/index';
import { signText } from '../packages/server/signatures';

test('public summaries require membership, support is unique, and threshold changes reviewer priority', async () => {
  const signingKeys = generateKeyPairSync('ed25519');
  const privateKey = signingKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicKey = signingKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const secrets = [randomHex(), randomHex(), randomHex()];
  const members = secrets.map((secret) => new Identity(secret).commitment.toString());
  const unsigned = {
    organizationId: 'college-demo',
    groupId: 'institution-members-v1',
    epoch: 1,
    root: new Group(members).root.toString(),
    members,
  };
  const snapshot: Snapshot = {
    ...unsigned,
    signature: signText(snapshotBytes(unsigned), privateKey),
  };
  const reviewerKeys = await keypair();
  const replyKeys = await keypair();
  const caseSecret = randomHex();
  const reviewerToken = randomHex();
  const db = await database(':memory:');
  await migrate(db);
  const app = await createApp(db, {
    authorityPublicKey: publicKey,
    receiptPrivateKey: privateKey,
    receiptPublicKey: publicKey,
    reviewerPublicKey: reviewerKeys.publicKey,
    reviewerToken,
    reviewerTopics: ['infrastructure'],
    snapshot,
  });

  try {
    const envelope: Envelope = {
      protocolVersion: 'incognito-v1',
      organizationId: 'college-demo',
      topicId: 'infrastructure',
      policyVersion: 1,
      period: currentPeriod(),
      slot: 0,
      keyVersion: 1,
      ciphertext: await seal(
        JSON.stringify({ title: 'Private report', details: 'Details only for the reviewer.' }),
        reviewerKeys.publicKey,
      ),
      accessVerifier: await accessVerifierFor(caseSecret),
      replyPublicKey: replyKeys.publicKey,
      nonce: randomHex(),
      publication: {
        title: 'Laboratory ventilation needs repair',
        summary: 'The campus laboratory ventilation has repeatedly failed.',
        supportThreshold: 2,
        privateUntilThreshold: true,
      },
    };
    const submission = await prove(secrets[0], snapshot, envelope);
    const substitutedTitle = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      payload: {
        ...submission,
        envelope: {
          ...envelope,
          publication: { ...envelope.publication!, title: 'A different concern' },
        },
      },
    });
    expect(substitutedTitle.statusCode).toBe(400);
    expect(substitutedTitle.json().code).toBe('MESSAGE_MISMATCH');
    const submitted = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      payload: submission,
    });
    expect(submitted.statusCode).toBe(201);
    const id = submitted.json().receipt.caseId as string;
    const reviewerHeaders = { authorization: `Bearer ${reviewerToken}` };
    const reporterHeaders = { authorization: `Bearer ${caseSecret}` };

    const privateCaseSecret = randomHex();
    const privateEnvelope: Envelope = {
      ...envelope,
      publication: undefined,
      slot: 1,
      nonce: randomHex(),
      accessVerifier: await accessVerifierFor(privateCaseSecret),
    };
    const privateCase = await app.inject({
      method: 'POST',
      url: '/v1/reports',
      payload: await prove(secrets[1], snapshot, privateEnvelope),
    });
    expect(privateCase.statusCode).toBe(201);

    expect(
      (await app.inject({ method: 'POST', url: '/v1/public-cases/list', payload: {} })).statusCode,
    ).toBe(400);
    const read = async () => {
      const nonce = randomHex();
      const proof = await provePublicSignal(secrets[1], snapshot, { action: 'list', nonce });
      return app.inject({
        method: 'POST',
        url: '/v1/public-cases/list',
        payload: { nonce, proof },
      });
    };
    const visible = await read();
    expect(visible.statusCode).toBe(200);
    expect(visible.json()).toHaveLength(1);
    expect(visible.json()[0].title).toBe(envelope.publication!.title);
    expect(visible.body).toContain('campus laboratory ventilation');
    expect(visible.body).not.toContain('Details only for the reviewer');
    expect(visible.body).not.toContain('ciphertext');
    expect(visible.body).not.toContain(privateCase.json().receipt.caseId);

    const reviewerList = async () =>
      (
        await app.inject({ method: 'GET', url: '/v1/reviewer/cases', headers: reviewerHeaders })
      ).json() as any[];
    expect((await reviewerList()).find((item) => item.id === id).reviewerPublic).toBe(false);
    expect((await reviewerList()).find((item) => item.id === id).publicTitle).toBe(
      envelope.publication!.title,
    );

    const support = async (secret: string) => {
      const proof = await provePublicSignal(secret, snapshot, { action: 'support', caseId: id });
      return app.inject({
        method: 'POST',
        url: `/v1/public-cases/${id}/support`,
        payload: { proof },
      });
    };
    expect((await support(secrets[1])).json().supportCount).toBe(1);
    expect((await support(secrets[1])).statusCode).toBe(409);
    expect((await reviewerList()).find((item) => item.id === id).reviewerPublic).toBe(false);
    expect((await support(secrets[2])).json().supportCount).toBe(2);
    const afterThreshold = await reviewerList();
    expect(afterThreshold[0].id).toBe(id);
    expect(afterThreshold[0].reviewerPublic).toBe(true);
    expect(afterThreshold[0].publicUrgent).toBe(true);
    expect(
      (await app.inject({ method: 'GET', url: `/v1/cases/${id}`, headers: reporterHeaders })).json()
        .supportCount,
    ).toBe(2);

    const commentText = 'I have experienced the ventilation problem as well.';
    const commentProof = await provePublicSignal(secrets[1], snapshot, {
      action: 'comment',
      caseId: id,
      text: commentText,
    });
    const commentBody = { text: commentText, proof: commentProof };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/v1/public-cases/${id}/comments`,
          payload: commentBody,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/v1/public-cases/${id}/comments`,
          payload: commentBody,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/v1/public-cases/${id}/comments`,
          payload: { ...commentBody, text: 'Different text' },
        })
      ).statusCode,
    ).toBe(400);
    expect((await read()).json()[0].comments[0].text).toBe(commentText);
    const supportNullifier = (
      await db.query<{ nullifier: string }>(
        'SELECT nullifier FROM public_supports WHERE case_id=$1',
        [id],
      )
    )[0].nullifier;
    const commentNullifier = (
      await db.query<{ nullifier: string }>(
        'SELECT nullifier FROM public_comments WHERE case_id=$1',
        [id],
      )
    )[0].nullifier;
    expect(supportNullifier).not.toBe(commentNullifier);

    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/v1/cases/${id}/publication`,
          payload: { publication: null },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/v1/cases/${id}/publication`,
          headers: reporterHeaders,
          payload: { publication: null },
        })
      ).statusCode,
    ).toBe(200);
    expect((await read()).json()).toHaveLength(0);
    expect((await support(secrets[0])).statusCode).toBe(404);
    expect((await reviewerList()).find((item) => item.id === id).reviewerPublic).toBe(false);
    const reopened = {
      title: 'Ventilation remains unresolved',
      summary: 'The ventilation concern remains unresolved for campus members.',
      supportThreshold: 3,
      privateUntilThreshold: true,
    };
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/v1/cases/${id}/publication`,
          headers: reporterHeaders,
          payload: { publication: reopened },
        })
      ).statusCode,
    ).toBe(200);
    const republished = (await read()).json()[0];
    expect(republished.supportCount).toBe(2);
    expect(republished.title).toBe(reopened.title);
    expect(
      (await app.inject({ method: 'GET', url: `/v1/cases/${id}`, headers: reporterHeaders })).json()
        .publicTitle,
    ).toBe(reopened.title);
    expect((await reviewerList()).find((item) => item.id === id).reviewerPublic).toBe(false);
    expect((await support(secrets[0])).json().supportCount).toBe(3);
    expect((await reviewerList()).find((item) => item.id === id).publicUrgent).toBe(true);

    const lowerSupportCaseId = privateCase.json().receipt.caseId as string;
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/v1/cases/${lowerSupportCaseId}/publication`,
          headers: { authorization: `Bearer ${privateCaseSecret}` },
          payload: {
            publication: {
              summary: 'The library has a separate concern to review.',
              supportThreshold: 1,
              privateUntilThreshold: false,
            },
          },
        })
      ).statusCode,
    ).toBe(200);
    expect((await reviewerList()).map((item) => item.id)).toEqual([id, lowerSupportCaseId]);

    // The new migration is repeatable and does not overwrite a saved title.
    await migrate(db);
    expect((await read()).json().find((item: any) => item.id === id).title).toBe(reopened.title);
    // Legacy public reports retain exactly the bytes used by their existing receipts.
    const legacyPublication = {
      summary: 'A legacy summary without a public title.',
      supportThreshold: 2,
      privateUntilThreshold: true,
    };
    const privateFields = JSON.parse(canonicalEnvelope(privateEnvelope));
    expect(canonicalEnvelope({ ...privateEnvelope, publication: legacyPublication })).toBe(
      JSON.stringify([...privateFields, [legacyPublication.summary, 2, true]]),
    );
  } finally {
    await app.close();
    await db.close();
  }
}, 180000);
