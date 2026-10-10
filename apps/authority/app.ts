import Fastify from 'fastify';
import { Group } from '@semaphore-protocol/group';
import { z } from 'zod';
import {
  ORGANIZATION,
  GROUP,
  FIELD,
  snapshotBytes,
  type Snapshot,
} from '../../packages/protocol/index';
import { safeEqual, signText } from '../../packages/server/signatures';
import { verifyPassword } from '../../packages/server/passwords';
export type Ledger = {
  epoch: number;
  members: { id: string; passwordHash: string; commitment?: string; revoked?: boolean }[];
  signingKey: string;
  adminToken: string;
};
export type AuthorityStore = {
  load: () => Promise<Ledger>;
  save: (ledger: Ledger) => Promise<void>;
  publish: (snapshot: Snapshot) => Promise<void>;
};
export function createAuthority(store: AuthorityStore) {
  const app = Fastify({ logger: false, bodyLimit: 4096 });
  let pending = Promise.resolve();
  async function serialize<T>(fn: () => Promise<T>) {
    const work = pending.then(fn);
    pending = work.then(
      () => {},
      () => {},
    );
    return work;
  }
  const { load, save } = store;
  function snapshot(l: Ledger): Snapshot {
    const members = l.members.filter((m) => m.commitment && !m.revoked).map((m) => m.commitment!);
    const s = {
      organizationId: ORGANIZATION,
      groupId: GROUP,
      epoch: l.epoch,
      members,
      root: new Group(members).root.toString(),
    };
    return { ...s, signature: signText(snapshotBytes(s), l.signingKey) };
  }
  const publish = (l: Ledger) => store.publish(snapshot(l));
  app.setErrorHandler((error, _req, reply) =>
    reply
      .code(error instanceof z.ZodError ? 400 : 503)
      .send({ code: error instanceof z.ZodError ? 'INVALID_PAYLOAD' : 'PUBLISH_UNAVAILABLE' }),
  );
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
  });
  app.post('/v1/enrollments', async (req, reply) => {
    const input = z
      .object({
        rollNumber: z.string().trim().min(1).max(100),
        password: z.string().min(1).max(256),
        commitment: z
          .string()
          .regex(/^[1-9][0-9]{0,76}$/)
          .refine((v) => BigInt(v) < FIELD),
      })
      .strict()
      .parse(req.body);
    return serialize(async () => {
      const ledger = await load();
      const member = ledger.members.find((m) => safeEqual(m.id, input.rollNumber));
      if (!member || !verifyPassword(input.password, member.passwordHash) || member.revoked)
        return reply.code(403).send({ code: 'NOT_ELIGIBLE' });
      if (member.commitment && member.commitment !== input.commitment)
        return reply.code(409).send({ code: 'ALREADY_ENROLLED' });
      if (ledger.members.some((m) => m.id !== member.id && m.commitment === input.commitment))
        return reply.code(409).send({ code: 'COMMITMENT_IN_USE' });
      if (!member.commitment) {
        member.commitment = input.commitment;
        ledger.epoch++;
        await save(ledger);
      }
      // Retry of the same enrollment republishes a previously interrupted update.
      await publish(ledger);
      return { active: true, snapshot: snapshot(ledger) };
    });
  });
  app.post('/v1/enrollments/revoke', async (req, reply) => {
    const { memberId } = z
      .object({ memberId: z.string().max(100) })
      .strict()
      .parse(req.body);
    return serialize(async () => {
      const ledger = await load();
      if (!safeEqual(req.headers.authorization ?? '', `Bearer ${ledger.adminToken}`))
        return reply.code(403).send({ code: 'ACCESS_DENIED' });
      const member = ledger.members.find((m) => m.id === memberId);
      if (!member) return reply.code(404).send({ code: 'NOT_FOUND' });
      if (!member.revoked) {
        if (
          member.commitment &&
          ledger.members.filter((m) => m.commitment && !m.revoked).length <= 3
        )
          return reply.code(409).send({ code: 'MINIMUM_GROUP_SIZE' });
        member.revoked = true;
        ledger.epoch++;
        await save(ledger);
      }
      await publish(ledger);
      return { revoked: true, effectiveEpoch: ledger.epoch };
    });
  });
  return app;
}
