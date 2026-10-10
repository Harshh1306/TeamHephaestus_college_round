import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { verifyProof } from '@semaphore-protocol/proof';
import { z } from 'zod';
import type { DB } from '../../packages/database/index';
import {
  SubmissionSchema,
  scopeFor,
  messageFor,
  commitmentFor,
  receiptBytes,
  currentPeriod,
  accessVerifierFor,
  ORGANIZATION,
  TOPICS,
  type Snapshot,
  type Envelope,
  type Receipt,
} from '../../packages/protocol/index';
import { safeEqual, signText, validSnapshot, rawPublicKey } from '../../packages/server/signatures';
import {
  configuredDepartments,
  configuredReviewers,
  departmentForTopic,
  departmentLabel,
  type ApiConfig,
  type ReviewerConfig,
} from '../../packages/server/config';
import { merkleRoot, inclusionProof } from '../../packages/audit/merkle';
import { chainEvidence } from '../../packages/audit/chain';

class ApiError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
type Case = {
  id: string;
  topic: string;
  envelope: Envelope;
  receipt: Receipt;
  commitment: string;
  status: string;
  closure_reason: string | null;
  reopen_requested: boolean;
  reopen_reason: string | null;
  created_at: string;
};
type Handoff = {
  id: string;
  case_id: string;
  source_department: string;
  target_department: string;
  summary_ciphertext: string;
  status: string;
  requester_id: string;
  created_at: string;
  decided_at: string | null;
  accepted_at: string | null;
  topic?: string;
  case_status?: string;
};
export async function createApp(db: DB, config: ApiConfig, now = () => new Date()) {
  const app = Fastify({ logger: false, bodyLimit: 150000, requestTimeout: 30000 });
  let activeVerifications = 0;
  app.addHook('onSend', async (_req, reply) => {
    reply
      .header('Cache-Control', 'no-store')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Content-Type-Options', 'nosniff');
  });
  app.setErrorHandler((error, _req, reply) => {
    const e = error as { statusCode?: number };
    if (error instanceof ApiError) return reply.code(error.status).send({ code: error.code });
    if (error instanceof z.ZodError || e.statusCode === 400 || e.statusCode === 413)
      return reply.code(e.statusCode === 413 ? 413 : 400).send({ code: 'INVALID_PAYLOAD' });
    if ((error as { code?: string }).code === '23505')
      return reply.code(409).send({ code: 'DUPLICATE_SUBMISSION' });
    return reply.code(500).send({ code: 'INTERNAL_ERROR' });
  });
  async function currentSnapshot(tx: DB = db, lock = false) {
    const [row] = await tx.query<{ snapshot: Snapshot }>(
      `SELECT snapshot FROM group_state WHERE id=1${lock ? ' FOR UPDATE' : ''}`,
    );
    if (!row) throw new ApiError('GROUP_UNAVAILABLE', 503);
    return row.snapshot;
  }
  async function installSnapshot(snapshot: Snapshot) {
    if (!validSnapshot(snapshot, config.authorityPublicKey))
      throw new ApiError('UNAUTHORIZED_GROUP');
    await db.transaction(async (tx) => {
      const rows = await tx.query<{ epoch: number; snapshot: Snapshot }>(
        'SELECT epoch,snapshot FROM group_state WHERE id=1 FOR UPDATE',
      );
      if (rows[0] && snapshot.epoch < rows[0].epoch) throw new ApiError('STALE_EPOCH', 409);
      if (rows[0]?.epoch === snapshot.epoch && rows[0].snapshot.root !== snapshot.root)
        throw new ApiError('EPOCH_CONFLICT', 409);
      await tx.query(
        'INSERT INTO group_state(id,epoch,snapshot) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET epoch=$1,snapshot=$2',
        [snapshot.epoch, JSON.stringify(snapshot)],
      );
    });
  }
  if (!(await db.query('SELECT id FROM group_state WHERE id=1')).length)
    await installSnapshot(config.snapshot);
  app.get('/v1/health', async () => ({
    ok: true,
    mode: 'synthetic-demo',
    protocol: 'incognito-v1',
  }));
  app.get('/v1/reporting-policy', async () => ({
    organizationId: ORGANIZATION,
    policyVersion: 1,
    period: currentPeriod(now()),
    slots: [0, 1, 2],
    topics: TOPICS,
    keyVersion: 1,
    departments: configuredDepartments(config).map(({ id, label, publicKey }) => ({
      id,
      label,
      publicKey,
    })),
    topicDepartments: Object.fromEntries(
      TOPICS.map((topic) => [topic, departmentForTopic(config, topic)]),
    ),
    authorityPublicKey: rawPublicKey(config.authorityPublicKey),
    receiptPublicKey: rawPublicKey(config.receiptPublicKey),
    snapshot: await currentSnapshot(),
  }));
  app.post('/v1/internal/snapshots', async (req) => {
    const s = z
      .object({
        organizationId: z.string(),
        groupId: z.string(),
        epoch: z.number().int().positive(),
        root: z.string().max(78),
        members: z
          .array(z.string().regex(/^[0-9]{1,78}$/))
          .min(3)
          .max(64),
        signature: z.string().max(128),
      })
      .strict()
      .parse(req.body);
    await installSnapshot(s);
    return { accepted: true, epoch: s.epoch };
  });
  app.post('/v1/reports', async (req, reply) => {
    const { envelope, proof } = SubmissionSchema.parse(req.body);
    if (envelope.period !== currentPeriod(now())) throw new ApiError('POLICY_EXPIRED');
    if (proof.scope !== (await scopeFor(envelope))) throw new ApiError('INVALID_SCOPE');
    if (proof.message !== (await messageFor(envelope))) throw new ApiError('MESSAGE_MISMATCH');
    if (proof.merkleTreeRoot !== (await currentSnapshot()).root)
      throw new ApiError('UNAUTHORIZED_GROUP');
    if (activeVerifications >= 2) throw new ApiError('VERIFIER_BUSY', 429);
    activeVerifications++;
    let valid = false;
    try {
      valid = await verifyProof(proof as Parameters<typeof verifyProof>[0]);
    } catch {
      /* Fail closed, without leaking proof internals. */
    } finally {
      activeVerifications--;
    }
    if (!valid) throw new ApiError('INVALID_PROOF');
    const caseId = randomUUID(),
      commitment = await commitmentFor(envelope),
      acceptedAt = now().toISOString();
    const receipt: Receipt = {
      caseId,
      commitment,
      acceptedAt,
      integrityStatus: 'pending-anchor',
      signature: signText(
        receiptBytes({ caseId, commitment, acceptedAt }),
        config.receiptPrivateKey,
      ),
    };
    await db.transaction(async (tx) => {
      // The same row lock serializes membership changes and report admission.
      if (proof.merkleTreeRoot !== (await currentSnapshot(tx, true)).root)
        throw new ApiError('UNAUTHORIZED_GROUP');
      if (envelope.period !== currentPeriod(now())) throw new ApiError('POLICY_EXPIRED');
      await tx.query(
        'INSERT INTO reports(id,topic,envelope,commitment,receipt) VALUES($1,$2,$3,$4,$5)',
        [caseId, envelope.topicId, JSON.stringify(envelope), commitment, JSON.stringify(receipt)],
      );
      await tx.query(
        'INSERT INTO used_nullifiers(organization,scope,nullifier,report_id) VALUES($1,$2,$3,$4)',
        [ORGANIZATION, proof.scope, proof.nullifier, caseId],
      );
    });
    return reply.code(201).send({ accepted: true, receipt });
  });
  async function readCase(id: string) {
    z.uuid().parse(id);
    const [row] = await db.query<Case>('SELECT * FROM reports WHERE id=$1', [id]);
    if (!row) throw new ApiError('ACCESS_DENIED', 403);
    return row;
  }
  function reviewer(req: { headers: { authorization?: string } }, topic?: string): ReviewerConfig {
    const actor = configuredReviewers(config).find((candidate) =>
      safeEqual(req.headers.authorization ?? '', `Bearer ${candidate.token}`),
    );
    if (!actor) throw new ApiError('ACCESS_DENIED', 403);
    if (topic && !config.reviewers?.length && !config.reviewerTopics?.includes(topic))
      throw new ApiError('ACCESS_DENIED', 403);
    if (
      topic &&
      departmentForTopic(config, topic as (typeof TOPICS)[number]) !== actor.departmentId
    )
      throw new ApiError('ACCESS_DENIED', 403);
    return actor;
  }
  async function reporter(req: { headers: { authorization?: string } }, row: Case) {
    const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    if (
      !/^[0-9a-f]{64}$/.test(token) ||
      !safeEqual(await accessVerifierFor(token), row.envelope.accessVerifier)
    )
      throw new ApiError('ACCESS_DENIED', 403);
  }
  const params = (req: { params: unknown }) => z.object({ id: z.uuid() }).parse(req.params);
  const visible = (row: Case) => ({
    id: row.id,
    topic: row.topic,
    status: row.status,
    closureReason: row.closure_reason,
    reopenRequested: row.reopen_requested,
    reopenReason: row.reopen_reason,
    createdAt: row.created_at,
    receipt: row.receipt,
    ciphertext: row.envelope.ciphertext,
    replyPublicKey: row.envelope.replyPublicKey,
    department: departmentForTopic(config, row.topic as (typeof TOPICS)[number]),
  });
  app.get('/v1/reviewer/cases', async (req) => {
    const actor = reviewer(req);
    const rows = await db.query<Case>('SELECT * FROM reports ORDER BY created_at DESC LIMIT 100');
    return rows
      .filter(
        (row) =>
          departmentForTopic(config, row.topic as (typeof TOPICS)[number]) === actor.departmentId,
      )
      .map(visible);
  });
  app.get('/v1/reviewer/cases/:id', async (req) => {
    reviewer(req);
    const row = await readCase(params(req).id);
    reviewer(req, row.topic);
    return visible(row);
  });
  app.patch('/v1/reviewer/cases/:id/status', async (req) => {
    const actor = reviewer(req);
    const id = params(req).id;
    const { status, reason } = z
      .object({
        status: z.enum(['triaged', 'under-review', 'awaiting-information', 'resolved', 'closed']),
        reason: z.string().trim().max(5000).optional(),
      })
      .strict()
      .parse(req.body);
    await db.transaction(async (tx) => {
      const [row] = await tx.query<Case>('SELECT * FROM reports WHERE id=$1 FOR UPDATE', [id]);
      if (!row) throw new ApiError('ACCESS_DENIED', 403);
      if (reviewer(req, row.topic).id !== actor.id) throw new ApiError('ACCESS_DENIED', 403);
      const transitions: Record<string, string[]> = {
        submitted: ['triaged', 'closed'],
        triaged: ['under-review', 'closed'],
        'under-review': ['awaiting-information', 'resolved', 'closed'],
        'awaiting-information': ['under-review', 'resolved', 'closed'],
        resolved: ['closed'],
        closed: ['under-review'],
      };
      if (!transitions[row.status]?.includes(status)) throw new ApiError('INVALID_TRANSITION', 409);
      if (status === 'closed' && !reason) throw new ApiError('CLOSURE_REASON_REQUIRED', 400);
      await tx.query(
        "UPDATE reports SET status=$1, closure_reason=CASE WHEN $1='closed' THEN $2 ELSE closure_reason END, reopen_requested=CASE WHEN $1='under-review' AND status='closed' THEN false ELSE reopen_requested END WHERE id=$3",
        [status, reason ?? null, id],
      );
      await tx.query('INSERT INTO review_events(id,case_id,actor,action) VALUES($1,$2,$3,$4)', [
        randomUUID(),
        id,
        actor.id,
        status === 'closed' ? `status:closed:${reason}` : `status:${status}`,
      ]);
    });
    return { updated: true };
  });
  app.post('/v1/cases/:id/reopen', async (req) => {
    const id = params(req).id;
    const { reason } = z
      .object({ reason: z.string().trim().min(1).max(5000) })
      .strict()
      .parse(req.body);
    await db.transaction(async (tx) => {
      const [row] = await tx.query<Case>('SELECT * FROM reports WHERE id=$1 FOR UPDATE', [id]);
      if (!row) throw new ApiError('ACCESS_DENIED', 403);
      await reporter(req, row);
      if (row.status !== 'closed') throw new ApiError('CASE_NOT_CLOSED', 409);
      if (row.reopen_requested) throw new ApiError('REOPEN_ALREADY_REQUESTED', 409);
      await tx.query('UPDATE reports SET reopen_requested=true, reopen_reason=$1 WHERE id=$2', [
        reason,
        id,
      ]);
      await tx.query('INSERT INTO review_events(id,case_id,actor,action) VALUES($1,$2,$3,$4)', [
        randomUUID(),
        id,
        'anonymous-reporter',
        `reopen-requested:${reason}`,
      ]);
    });
    return { requested: true };
  });
  app.get('/v1/cases/:id', async (req) => {
    const row = await readCase(params(req).id);
    await reporter(req, row);
    return {
      id: row.id,
      topic: row.topic,
      status: row.status,
      closureReason: row.closure_reason,
      reopenRequested: row.reopen_requested,
      reopenReason: row.reopen_reason,
      receipt: row.receipt,
    };
  });
  app.post('/v1/cases/access', async (req) => {
    const { secret, nonce } = z
      .object({
        secret: z.string().regex(/^[0-9a-f]{64}$/),
        nonce: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict()
      .parse(req.body);
    const [row] = await db.query<Case>(
      `SELECT * FROM reports WHERE envelope->>'nonce'=$1 AND envelope->>'accessVerifier'=$2`,
      [nonce, await accessVerifierFor(secret)],
    );
    if (!row) throw new ApiError('ACCESS_DENIED', 403);
    return {
      id: row.id,
      status: row.status,
      closureReason: row.closure_reason,
      reopenRequested: row.reopen_requested,
      reopenReason: row.reopen_reason,
      receipt: row.receipt,
    };
  });
  for (const role of ['reviewer', 'reporter'] as const) {
    const route =
      role === 'reviewer' ? '/v1/reviewer/cases/:id/messages' : '/v1/cases/:id/messages';
    async function authorize(req: any) {
      if (role === 'reviewer') reviewer(req);
      const row = await readCase(params(req).id);
      if (role === 'reviewer') reviewer(req, row.topic);
      else await reporter(req, row);
      return row;
    }
    app.get(route, async (req) => {
      const row = await authorize(req);
      return db.query(
        'SELECT id,direction,ciphertext,created_at FROM case_messages WHERE case_id=$1 ORDER BY created_at,id',
        [row.id],
      );
    });
    app.post(route, async (req, reply) => {
      const row = await authorize(req);
      if (role === 'reporter' && row.status === 'closed') throw new ApiError('CASE_CLOSED', 409);
      const data = z
        .object({
          id: z.uuid(),
          ciphertext: z
            .string()
            .min(64)
            .max(50000)
            .regex(/^[A-Za-z0-9+/]+={0,2}$/),
        })
        .strict()
        .parse(req.body);
      await db.transaction(async (tx) => {
        await tx.query(
          'INSERT INTO case_messages(id,case_id,direction,ciphertext) VALUES($1,$2,$3,$4)',
          [data.id, row.id, role, data.ciphertext],
        );
        if (role === 'reviewer') {
          const actor = reviewer(req, row.topic);
          await tx.query('INSERT INTO review_events(id,case_id,actor,action) VALUES($1,$2,$3,$4)', [
            randomUUID(),
            row.id,
            actor.id,
            'encrypted-reply',
          ]);
        }
      });
      return reply.code(201).send({ accepted: true });
    });
  }
  const handoffParams = (req: { params: unknown }) =>
    z.object({ id: z.uuid(), handoffId: z.uuid() }).parse(req.params);
  const ciphertext = z
    .string()
    .min(64)
    .max(50000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/);
  app.post('/v1/reviewer/cases/:id/handoffs', async (req, reply) => {
    const id = params(req).id;
    const row = await readCase(id);
    const actor = reviewer(req, row.topic);
    const data = z
      .object({
        targetDepartment: z.string(),
        summaryCiphertext: ciphertext,
      })
      .strict()
      .parse(req.body);
    const target = configuredDepartments(config).find(
      (department) => department.id === data.targetDepartment,
    );
    if (!target || target.id === actor.departmentId) throw new ApiError('INVALID_HANDOFF_TARGET');
    const handoffId = randomUUID();
    await db.transaction(async (tx) => {
      const [locked] = await tx.query<Case>('SELECT * FROM reports WHERE id=$1 FOR UPDATE', [id]);
      if (!locked) throw new ApiError('ACCESS_DENIED', 403);
      reviewer(req, locked.topic);
      const existing = await tx.query<{ id: string }>(
        "SELECT id FROM case_handoffs WHERE case_id=$1 AND target_department=$2 AND status IN ('approved','accepted')",
        [id, target.id],
      );
      if (existing.length) throw new ApiError('HANDOFF_ALREADY_ACTIVE', 409);
      await tx.query(
        'INSERT INTO case_handoffs(id,case_id,source_department,target_department,summary_ciphertext,status,requester_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          handoffId,
          id,
          actor.departmentId,
          target.id,
          data.summaryCiphertext,
          'approved',
          actor.id,
        ],
      );
      await tx.query('INSERT INTO review_events(id,case_id,actor,action) VALUES($1,$2,$3,$4)', [
        randomUUID(),
        id,
        actor.id,
        `handoff-requested:${target.id}`,
      ]);
    });
    return reply.code(201).send({ id: handoffId, status: 'approved' });
  });
  app.get('/v1/reviewer/handoffs', async (req) => {
    const actor = reviewer(req);
    const rows = await db.query<Handoff>(
      "SELECT h.*,r.topic,r.status AS case_status FROM case_handoffs h JOIN reports r ON r.id=h.case_id WHERE h.target_department=$1 AND h.status IN ('approved','accepted') ORDER BY h.created_at DESC",
      [actor.departmentId],
    );
    return rows.map((handoff) => ({
      id: handoff.id,
      caseId: handoff.case_id,
      topic: handoff.topic,
      caseStatus: handoff.case_status,
      source: departmentLabel(config, handoff.source_department as any),
      target: departmentLabel(config, handoff.target_department as any),
      status: handoff.status,
      createdAt: handoff.created_at,
      summaryCiphertext: handoff.summary_ciphertext,
    }));
  });
  app.post('/v1/reviewer/handoffs/:handoffId/accept', async (req) => {
    const { handoffId } = z.object({ handoffId: z.uuid() }).parse(req.params);
    const actor = reviewer(req);
    await db.transaction(async (tx) => {
      const [handoff] = await tx.query<Handoff>(
        'SELECT * FROM case_handoffs WHERE id=$1 FOR UPDATE',
        [handoffId],
      );
      if (!handoff || handoff.target_department !== actor.departmentId)
        throw new ApiError('ACCESS_DENIED', 403);
      if (handoff.status === 'accepted') return;
      if (handoff.status !== 'approved') throw new ApiError('HANDOFF_NOT_APPROVED', 409);
      await tx.query("UPDATE case_handoffs SET status='accepted',accepted_at=now() WHERE id=$1", [
        handoff.id,
      ]);
      await tx.query('INSERT INTO review_events(id,case_id,actor,action) VALUES($1,$2,$3,$4)', [
        randomUUID(),
        handoff.case_id,
        actor.id,
        `handoff-accepted:${handoff.source_department}`,
      ]);
    });
    return { accepted: true };
  });
  app.get('/v1/cases/:id/inclusion', async (req) => {
    const row = await readCase(params(req).id);
    await reporter(req, row);
    const batches = await db.query<{
      id: string;
      root: string;
      leaves: string[];
      transaction_hash: string | null;
    }>('SELECT * FROM audit_batches ORDER BY created_at');
    const batch = batches.find((b) => b.leaves.includes(row.commitment));
    if (!batch) return { status: 'pending-anchor' };
    let chain: Awaited<ReturnType<typeof chainEvidence>> | { verified: false } = {
      verified: false,
    };
    try {
      chain = await chainEvidence(batch.id, batch.root, batch.transaction_hash || undefined);
    } catch {
      /* Offline/pending anchoring is never shown as verified. */
    }
    return {
      id: batch.id,
      root: batch.root,
      commitment: row.commitment,
      siblings: await inclusionProof(batch.leaves, row.commitment),
      transactionHash: batch.transaction_hash,
      chain,
    };
  });
  app.post('/v1/reviewer/audit/prepare', async (req) => {
    reviewer(req);
    return db.transaction(async (tx) => {
      await currentSnapshot(tx, true);
      const batches = await tx.query<{
        id: string;
        root: string;
        leaves: string[];
        transaction_hash: string | null;
      }>('SELECT * FROM audit_batches ORDER BY created_at DESC');
      const pending = batches.find((b) => !b.transaction_hash);
      if (pending) return pending;
      const included = new Set(batches.flatMap((b) => b.leaves));
      const records = await tx.query<{ commitment: string }>(
        'SELECT commitment FROM reports ORDER BY created_at,id',
      );
      const leaves = records.map((r) => r.commitment).filter((c) => !included.has(c));
      if (!leaves.length) {
        if (batches[0]) return batches[0];
        throw new ApiError('NO_REPORTS', 409);
      }
      const id = randomUUID(),
        root = await merkleRoot(leaves);
      await tx.query('INSERT INTO audit_batches(id,root,leaves) VALUES($1,$2,$3)', [
        id,
        root,
        JSON.stringify(leaves),
      ]);
      return { id, root, leaves, transaction_hash: null };
    });
  });
  app.post('/v1/reviewer/audit/confirm', async (req) => {
    reviewer(req);
    const { id, transactionHash } = z
      .object({ id: z.uuid(), transactionHash: z.string().regex(/^0x[0-9a-f]{64}$/) })
      .strict()
      .parse(req.body);
    const [batch] = await db.query<{ root: string }>('SELECT root FROM audit_batches WHERE id=$1', [
      id,
    ]);
    if (!batch) throw new ApiError('NOT_FOUND', 404);
    try {
      await chainEvidence(id, batch.root, transactionHash);
    } catch {
      throw new ApiError('ANCHOR_NOT_VERIFIED', 409);
    }
    await db.query('UPDATE audit_batches SET transaction_hash=$1 WHERE id=$2', [
      transactionHash,
      id,
    ]);
    return { confirmed: true };
  });
  return app;
}
