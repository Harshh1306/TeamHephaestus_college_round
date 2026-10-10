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
  test('full lifecycle: pending lock, disappearance on acceptance, operational ownership, decline, and limit', async () => {
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
        { id: 'campus-safety', label: 'Campus Safety', publicKey: 'c'.repeat(64) },
      ],
      reviewers: [
        {
          id: 'facilities-one',
          name: 'Facilities reviewer one',
          departmentId: 'facilities',
          token: token('1'),
        },
        {
          id: 'services-one',
          name: 'Student services reviewer',
          departmentId: 'student-services',
          token: token('3'),
        },
        {
          id: 'safety-one',
          name: 'Campus safety reviewer',
          departmentId: 'campus-safety',
          token: token('4'),
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
      'INSERT INTO reports(id,topic,envelope,commitment,receipt,current_department,handoff_count) VALUES($1,$2,$3,$4,$5,$6,$7)',
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
        'facilities',
        0,
      ],
    );
    try {
      const facilitiesHeaders = { authorization: `Bearer ${token('1')}` };
      const servicesHeaders = { authorization: `Bearer ${token('3')}` };
      const safetyHeaders = { authorization: `Bearer ${token('4')}` };

      // 1. Initial State: Facilities owns the case
      const facInitial = await app.inject({ url: '/v1/reviewer/cases', headers: facilitiesHeaders });
      expect(facInitial.statusCode).toBe(200);
      expect(facInitial.json()).toHaveLength(1);
      expect(facInitial.json()[0].pendingHandoff).toBeNull();
      expect(facInitial.json()[0].handoffCount).toBe(0);

      // 2. Facilities initiates handoff to Student Services
      const created = await app.inject({
        method: 'POST',
        url: `/v1/reviewer/cases/${caseId}/handoffs`,
        headers: facilitiesHeaders,
        payload: {
          targetDepartment: 'student-services',
          summaryCiphertext: ciphertext,
        },
      });
      expect(created.statusCode).toBe(201);
      const handoffId = created.json().id;

      // 3. While pending: Facilities sees case greyed out / marked pending, and mutations are locked (409)
      const facPending = await app.inject({ url: '/v1/reviewer/cases', headers: facilitiesHeaders });
      expect(facPending.statusCode).toBe(200);
      expect(facPending.json()[0].pendingHandoff).toMatchObject({
        targetDepartment: 'student-services',
        target: 'Student Services',
      });

      // Actions locked for Facilities while pending
      const statusBlocked = await app.inject({
        method: 'PATCH',
        url: `/v1/reviewer/cases/${caseId}/status`,
        headers: facilitiesHeaders,
        payload: { status: 'triaged' },
      });
      expect(statusBlocked.statusCode).toBe(409);

      const msgBlocked = await app.inject({
        method: 'POST',
        url: `/v1/reviewer/cases/${caseId}/messages`,
        headers: facilitiesHeaders,
        payload: { id: '22222222-2222-4222-8222-222222222222', ciphertext },
      });
      expect(msgBlocked.statusCode).toBe(409);

      // Re-forwarding blocked while already pending
      const doubleForward = await app.inject({
        method: 'POST',
        url: `/v1/reviewer/cases/${caseId}/handoffs`,
        headers: facilitiesHeaders,
        payload: { targetDepartment: 'campus-safety', summaryCiphertext: ciphertext },
      });
      expect(doubleForward.statusCode).toBe(409);

      // Reporter sees case with active department
      const reporterView = await app.inject({
        url: `/v1/cases/${caseId}`,
        headers: { authorization: `Bearer ${secret}` },
      });
      expect(reporterView.statusCode).toBe(200);
      expect(reporterView.json().department).toBe('facilities');

      // 4. Student Services accepts the handoff
      const acceptRes = await app.inject({
        method: 'POST',
        url: `/v1/reviewer/handoffs/${handoffId}/accept`,
        headers: servicesHeaders,
      });
      expect(acceptRes.statusCode).toBe(200);

      // 5. Post-acceptance verification:
      // a) Case immediately disappears from Facilities' list
      const facAfter = await app.inject({ url: '/v1/reviewer/cases', headers: facilitiesHeaders });
      expect(facAfter.statusCode).toBe(200);
      expect(facAfter.json()).toEqual([]);

      // Facilities cannot access case directly anymore (403)
      const facDirect = await app.inject({ url: `/v1/reviewer/cases/${caseId}`, headers: facilitiesHeaders });
      expect(facDirect.statusCode).toBe(403);

      // b) Case is now in Student Services active list with handoffCount = 1
      const srvActive = await app.inject({ url: '/v1/reviewer/cases', headers: servicesHeaders });
      expect(srvActive.statusCode).toBe(200);
      expect(srvActive.json()).toHaveLength(1);
      expect(srvActive.json()[0].handoffCount).toBe(1);
      expect(srvActive.json()[0].pendingHandoff).toBeNull();
      expect(srvActive.json()[0].handoffHistory).toHaveLength(1);
      expect(srvActive.json()[0].handoffHistory[0]).toMatchObject({
        source: 'Facilities',
        target: 'Student Services',
        status: 'accepted',
      });

      // c) Student Services can operate on the case (update status, send reply)
      const srvStatus = await app.inject({
        method: 'PATCH',
        url: `/v1/reviewer/cases/${caseId}/status`,
        headers: servicesHeaders,
        payload: { status: 'triaged' },
      });
      expect(srvStatus.statusCode).toBe(200);

      const srvMsg = await app.inject({
        method: 'POST',
        url: `/v1/reviewer/cases/${caseId}/messages`,
        headers: servicesHeaders,
        payload: { id: '33333333-3333-4333-8333-333333333333', ciphertext },
      });
      expect(srvMsg.statusCode).toBe(201);

      // Reporter view now routes to Student Services
      const reporterViewAfter = await app.inject({
        url: `/v1/cases/${caseId}`,
        headers: { authorization: `Bearer ${secret}` },
      });
      expect(reporterViewAfter.json().department).toBe('student-services');

      // 6. Test Decline Behavior on a second handoff (Student Services -> Campus Safety)
      const handoff2 = await app.inject({
        method: 'POST',
        url: `/v1/reviewer/cases/${caseId}/handoffs`,
        headers: servicesHeaders,
        payload: { targetDepartment: 'campus-safety', summaryCiphertext: ciphertext },
      });
      expect(handoff2.statusCode).toBe(201);
      const handoff2Id = handoff2.json().id;

      // Campus Safety declines
      const declineRes = await app.inject({
        method: 'POST',
        url: `/v1/reviewer/handoffs/${handoff2Id}/decline`,
        headers: safetyHeaders,
      });
      expect(declineRes.statusCode).toBe(200);

      // Campus Safety (Dpt2) sees the declined handoff in their incoming handoffs list
      const safetyHandoffs = await app.inject({ url: '/v1/reviewer/handoffs', headers: safetyHeaders });
      expect(safetyHandoffs.statusCode).toBe(200);
      const declinedHandoffItem = safetyHandoffs.json().find((h: any) => h.id === handoff2Id);
      expect(declinedHandoffItem).toBeDefined();
      expect(declinedHandoffItem.status).toBe('declined');

      // Case reverts back to active in Student Services (Dpt1), pending lock cleared
      const srvReverted = await app.inject({ url: '/v1/reviewer/cases', headers: servicesHeaders });
      expect(srvReverted.json()[0].pendingHandoff).toBeNull();
      // Student Services (Dpt1) sees that the case handoff was declined in history
      const declinedInHistory = srvReverted.json()[0].handoffHistory.find((h: any) => h.status === 'declined');
      expect(declinedInHistory).toBeDefined();
      expect(declinedInHistory.targetDepartment).toBe('campus-safety');

      // Attempting to forward to Campus Safety AGAIN must fail (HANDOFF_PREVIOUSLY_DECLINED 409)
      const retryDeclined = await app.inject({
        method: 'POST',
        url: `/v1/reviewer/cases/${caseId}/handoffs`,
        headers: servicesHeaders,
        payload: { targetDepartment: 'campus-safety', summaryCiphertext: ciphertext },
      });
      expect(retryDeclined.statusCode).toBe(409);
      expect(retryDeclined.json().code).toBe('HANDOFF_PREVIOUSLY_DECLINED');

      // 7. Student Services forwards to Facilities instead (Handoff count -> 2)
      const handoff3 = await app.inject({
        method: 'POST',
        url: `/v1/reviewer/cases/${caseId}/handoffs`,
        headers: servicesHeaders,
        payload: { targetDepartment: 'facilities', summaryCiphertext: ciphertext },
      });
      expect(handoff3.statusCode).toBe(201);
      await app.inject({
        method: 'POST',
        url: `/v1/reviewer/handoffs/${handoff3.json().id}/accept`,
        headers: facilitiesHeaders,
      });

      // 8. Facilities forwards back to Student Services (Handoff count -> 3 = MAX)
      const handoff4 = await app.inject({
        method: 'POST',
        url: `/v1/reviewer/cases/${caseId}/handoffs`,
        headers: facilitiesHeaders,
        payload: { targetDepartment: 'student-services', summaryCiphertext: ciphertext },
      });
      expect(handoff4.statusCode).toBe(201);
      await app.inject({
        method: 'POST',
        url: `/v1/reviewer/handoffs/${handoff4.json().id}/accept`,
        headers: servicesHeaders,
      });

      // 9. Now handoff_count = 3. Attempting another handoff should be rejected (MAX_HANDOFFS_EXCEEDED 409)
      const handoffLimit = await app.inject({
        method: 'POST',
        url: `/v1/reviewer/cases/${caseId}/handoffs`,
        headers: servicesHeaders,
        payload: { targetDepartment: 'facilities', summaryCiphertext: ciphertext },
      });
      expect(handoffLimit.statusCode).toBe(409);
      expect(handoffLimit.json().code).toBe('MAX_HANDOFFS_EXCEEDED');
    } finally {
      await app.close();
      await db.close();
    }
  });
});
