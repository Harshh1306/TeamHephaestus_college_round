import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';

export interface DB {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (tx: DB) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function database(location: string): Promise<DB> {
  if (/^postgres(ql)?:\/\//.test(location)) {
    const client = postgres(location, { max: 5 });
    const wrap = (sql: any): DB => ({
      query: async (q, p = []) => Array.from(await sql.unsafe(q, p)) as any,
      transaction: (fn) => sql.begin((tx: any) => fn(wrap(tx))),
      close: () => sql.end(),
    });
    return wrap(client);
  }
  const pg = new PGlite(location === ':memory:' ? undefined : location);
  await pg.waitReady;
  const wrap = (p: any): DB => ({
    query: async (q, args = []) => (await p.query(q, args)).rows,
    transaction: (fn) => p.transaction((tx: any) => fn(wrap(tx))),
    close: () => pg.close(),
  });
  return wrap(pg);
}
export async function migrate(db: DB) {
  for (const query of [
    `CREATE TABLE IF NOT EXISTS group_state (id integer PRIMARY KEY CHECK(id=1), epoch integer NOT NULL, snapshot jsonb NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS reports (id uuid PRIMARY KEY, topic text NOT NULL, envelope jsonb NOT NULL, commitment text NOT NULL UNIQUE, receipt jsonb NOT NULL, status text NOT NULL DEFAULT 'submitted', closure_reason text, reopen_requested boolean NOT NULL DEFAULT false, reopen_reason text, created_at timestamptz NOT NULL DEFAULT now())`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS closure_reason text`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS reopen_requested boolean NOT NULL DEFAULT false`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS reopen_reason text`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS current_department text`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS handoff_count integer NOT NULL DEFAULT 0`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS public_summary text`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS public_title text`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS support_threshold integer`,
    `ALTER TABLE reports ADD COLUMN IF NOT EXISTS private_until_threshold boolean NOT NULL DEFAULT false`,
    `UPDATE reports SET current_department = CASE WHEN topic = 'faculty-conduct' THEN 'academic-affairs' WHEN topic = 'administration' THEN 'student-services' WHEN topic = 'infrastructure' THEN 'facilities' WHEN topic = 'campus-safety' THEN 'campus-safety' ELSE 'ombuds-office' END WHERE current_department IS NULL`,
    `CREATE TABLE IF NOT EXISTS used_nullifiers (organization text NOT NULL, scope text NOT NULL, nullifier text NOT NULL, report_id uuid NOT NULL REFERENCES reports(id), PRIMARY KEY(organization, scope, nullifier))`,
    `CREATE TABLE IF NOT EXISTS case_messages (id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES reports(id), direction text NOT NULL CHECK(direction IN ('reporter','reviewer')), ciphertext text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS public_supports (case_id uuid NOT NULL REFERENCES reports(id), nullifier text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(case_id,nullifier))`,
    `CREATE TABLE IF NOT EXISTS public_comments (case_id uuid NOT NULL REFERENCES reports(id), nullifier text NOT NULL, text text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(case_id,nullifier))`,
    `CREATE INDEX IF NOT EXISTS public_comments_case_created_idx ON public_comments(case_id,created_at)`,
    `CREATE TABLE IF NOT EXISTS review_events (id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES reports(id), actor text NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS case_handoffs (id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES reports(id), source_department text NOT NULL, target_department text NOT NULL, summary_ciphertext text NOT NULL, status text NOT NULL CHECK(status IN ('awaiting-reporter-consent','approved','declined','accepted','cancelled')), requester_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, accepted_at timestamptz)`,
    `CREATE INDEX IF NOT EXISTS case_handoffs_target_status_created_idx ON case_handoffs(target_department,status,created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS audit_batches (id uuid PRIMARY KEY, root text NOT NULL, leaves jsonb NOT NULL, transaction_hash text, created_at timestamptz NOT NULL DEFAULT now())`,
  ])
    await db.query(query);
}
