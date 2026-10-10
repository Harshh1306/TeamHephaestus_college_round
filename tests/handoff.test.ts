import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { Group } from '@semaphore-protocol/group';
import { Identity } from '@semaphore-protocol/identity';
import { createApp } from '../apps/api/app';
import { database, migrate } from '../packages/database/index';
import {
  accessVerifierFor,
  GROUP,
  ORGANIZATION,
  snapshotBytes,
  type Envelope,
} from '../packages/protocol/index';
import { signText } from '../packages/server/signatures';
import type { ApiConfig } from '../packages/server/config';

const pem = (key: any, type: 'pkcs8' | 'spki') => key.export({ type, format: 'pem' }).toString();
const token = (character: string) => character.repeat(64);
const ciphertext = 'A'.repeat(64);

describe('interdepartmental handoffs', () => {
  test('keeps the original case private while a target department receives a forwarded summary', async () => {
    const authority = generateKeyPairSync('ed25519');
    const receipt = generateKeyPairSync('ed25519');
    const members = ['handoff-alice', 'handoff-bob', 'handoff-carol'].map((secret) =>
      new Identity(secret).commitment.toString(),
    );
    const unsignedSnapshot = {
      organizationId: ORGANIZATION,
      groupId: GROUP,
      epoch: 1,
      root: new Group(members).root.toString(),
      members,
    };
    const config: ApiConfig = {
      authorityPublicKey: pem(authority.publicKey, 'spki'),
      receiptPrivateKey: pem(receipt.privateKey, 'pkcs8'),
      receiptPublicKey: pem(receipt.publicKey, 'spki'),
      departments: [
        { id: 'facilities', label: 'Facilities', publicKey: 'a'.repeat(64) },
        { id: 'student-services', label: 'Student Services', publicKey: 'b'.repeat(64) },
      ],
      reviewers: [
        {
          id: 'facilities-one',
          name: 'Facilities reviewer one',
          departmentId: 'facilities',
          token: token('1'),
        },
        {
          id: 'facilities-two',
          name: 'Facilities reviewer two',
          departmentId: 'facilities',
          token: token('2'),
        },
        {
          id: 'services-one',
          name: 'Student services reviewer',
          departmentId: 'student-services',
          token: token('3'),
        },
      ],
      topicDepartments: {
        'faculty-conduct': 'academic-affairs',
        administration: 'student-services',
        infrastructure: 'facilities',
        'campus-safety': 'campus-safety',
        other: 'ombuds-office',
      },
      snapshot: {
        ...unsignedSnapshot,
        signature: signText(snapshotBytes(unsignedSnapshot), pem(authority.privateKey, 'pkcs8')),
      },
    };
    const db = await database(':memory:');
    await migrate(db);
    const app = await createApp(db, config);
    const secret = token('f');
    const envelope: Envelope = {
      protocolVersion: 'incognito-v1',
      organizationId: ORGANIZATION,
      topicId: 'infrastructure',
      policyVersion: 1,
      period: '2026-10',
      slot: 0,
      keyVersion: 1,
      ciphertext,
      accessVerifier: await accessVerifierFor(secret),
      replyPublicKey: 'c'.repeat(64),
      nonce: 'd'.repeat(64),
    };
    const caseId = '11111111-1111-4111-8111-111111111111';
    await db.query(
      'INSERT INTO reports(id,topic,envelope,commitment,receipt) VALUES($1,$2,$3,$4,$5)',
      [
        caseId,
        envelope.topicId,
        JSON.stringify(envelope),
        'e'.repeat(64),
        JSON.stringify({
          caseId,
          commitment: 'e'.repeat(64),
          acceptedAt: new Date().toISOString(),
        }),
      ],
    );
    try {
      const sourceHeaders = { authorization: `Bearer ${token('1')}` };
      const targetHeaders = { authorization: `Bearer ${token('3')}` };
      const created = await app.inject({
        method: 'POST',
        url: `/v1/reviewer/cases/${caseId}/handoffs`,
        headers: sourceHeaders,
        payload: {
          targetDepartment: 'student-services',
          summaryCiphertext: ciphertext,
        },
      });
      expect(created.statusCode).toBe(201);
      const handoffId = created.json().id;

      const reporterView = await app.inject({
        url: `/v1/cases/${caseId}`,
        headers: { authorization: `Bearer ${secret}` },
      });
      expect(reporterView.statusCode).toBe(200);
      expect(reporterView.body).not.toContain('A'.repeat(20));
      expect(reporterView.json().handoffs).toBeUndefined();

      const targetInbox = await app.inject({
        url: '/v1/reviewer/handoffs',
        headers: targetHeaders,
      });
      expect(targetInbox.statusCode).toBe(200);
      expect(targetInbox.json()[0]).toMatchObject({
        id: handoffId,
        source: 'Facilities',
        target: 'Student Services',
        status: 'approved',
        summaryCiphertext: ciphertext,
      });
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/v1/reviewer/handoffs/${handoffId}/accept`,
            headers: targetHeaders,
          })
        ).statusCode,
      ).toBe(200);
      const events = await db.query<{ actor: string; action: string }>(
        'SELECT actor,action FROM review_events WHERE case_id=$1 ORDER BY created_at',
        [caseId],
      );
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: 'facilities-one',
            action: 'handoff-requested:student-services',
          }),
          expect.objectContaining({ actor: 'services-one', action: 'handoff-accepted:facilities' }),
        ]),
      );
    } finally {
      await app.close();
      await db.close();
    }
  });
});
