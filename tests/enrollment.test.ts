import { test, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { Identity } from '@semaphore-protocol/identity';
import { createAuthority, type Ledger } from '../apps/authority/app';
import { randomHex } from '../packages/protocol/index';
import { validSnapshot } from '../packages/server/signatures';
import { hashPassword } from '../packages/server/passwords';

test('enrollment authorization, concurrent issuance, retry and effective revocation', async () => {
  const keys = generateKeyPairSync('ed25519');
  const passwords = Array.from({ length: 5 }, () => randomHex());
  let ledger: Ledger = {
    epoch: 1,
    signingKey: keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    adminToken: randomHex(),
    members: Array.from({ length: 5 }, (_, i) => ({
      id: `synthetic-${i}`,
      passwordHash: hashPassword(passwords[i]),
      ...(i < 3 ? { commitment: new Identity(randomHex()).commitment.toString() } : {}),
    })),
  };
  const publicKey = keys.publicKey.export({ format: 'pem', type: 'spki' }).toString();
  let published = ledger.epoch,
    failPublication = false;
  const app = createAuthority({
    load: async () => structuredClone(ledger),
    save: async (l) => {
      ledger = structuredClone(l);
    },
    publish: async (s) => {
      if (failPublication) throw new Error('Unavailable');
      expect(validSnapshot(s, publicKey)).toBe(true);
      published = s.epoch;
    },
  });
  const commitment = new Identity(randomHex()).commitment.toString();
  const enroll = (rollNumber: string, password: string, c = commitment) =>
    app.inject({
      method: 'POST',
      url: '/v1/enrollments',
      payload: { rollNumber, password, commitment: c },
    });
  try {
    expect((await enroll('unknown', passwords[3])).statusCode).toBe(403);
    expect((await enroll(ledger.members[3].id, 'incorrect')).statusCode).toBe(403);
    expect(ledger.members[3].commitment).toBeUndefined();
    const responses = await Promise.all([
      enroll(ledger.members[3].id, passwords[3]),
      enroll(ledger.members[3].id, passwords[3], new Identity(randomHex()).commitment.toString()),
    ]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(ledger.members[3].commitment).toBe(commitment);
    expect(published).toBe(2);
    expect((await enroll(ledger.members[3].id, passwords[3])).statusCode).toBe(200);
    expect((await enroll(ledger.members[4].id, passwords[4])).statusCode).toBe(409);
    failPublication = true;
    const revoke = () =>
      app.inject({
        method: 'POST',
        url: '/v1/enrollments/revoke',
        headers: { authorization: `Bearer ${ledger.adminToken}` },
        payload: { memberId: ledger.members[3].id },
      });
    expect((await revoke()).statusCode).toBe(503);
    expect(published).toBe(2); // Failed publication is not acknowledged as effective.
    failPublication = false;
    const result = await revoke();
    expect(result.statusCode).toBe(200);
    expect(result.json().effectiveEpoch).toBe(published);
    expect((await enroll(ledger.members[3].id, passwords[3])).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/enrollments/revoke',
          headers: { authorization: `Bearer ${randomHex()}` },
          payload: { memberId: ledger.members[0].id },
        })
      ).statusCode,
    ).toBe(403);
  } finally {
    await app.close();
  }
});
