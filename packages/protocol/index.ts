import { z } from 'zod';

export const PROTOCOL = 'incognito-v1' as const;
export const ORGANIZATION = 'college-demo';
export const GROUP = 'institution-members-v1';
export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const TOPICS = [
  'faculty-conduct',
  'administration',
  'infrastructure',
  'campus-safety',
  'other',
] as const;
export const TOPIC_LABELS: Record<string, string> = {
  'faculty-conduct': 'Faculty conduct',
  administration: 'Administration',
  infrastructure: 'Infrastructure',
  'campus-safety': 'Campus safety',
  other: 'Other concern',
};
const decimal = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,77})$/)
  .refine((v) => BigInt(v) < 1n << 256n);
const hex = z.string().regex(/^[0-9a-f]{64}$/);
export const ProofSchema = z
  .object({
    merkleTreeDepth: z.literal(6),
    merkleTreeRoot: decimal,
    nullifier: decimal,
    message: decimal,
    scope: decimal,
    points: z.tuple([decimal, decimal, decimal, decimal, decimal, decimal, decimal, decimal]),
  })
  .strict();
export const EnvelopeSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL),
    organizationId: z.literal(ORGANIZATION),
    topicId: z.enum(TOPICS),
    policyVersion: z.literal(1),
    period: z.string().regex(/^\d{4}-\d{2}$/),
    slot: z.number().int().min(0).max(2),
    keyVersion: z.literal(1),
    ciphertext: z
      .string()
      .min(64)
      .max(100000)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    accessVerifier: hex,
    replyPublicKey: hex,
    nonce: hex,
  })
  .strict();
export const SubmissionSchema = z.object({ envelope: EnvelopeSchema, proof: ProofSchema }).strict();
export type Envelope = z.infer<typeof EnvelopeSchema>;
export type Submission = z.infer<typeof SubmissionSchema>;
export type Topic = (typeof TOPICS)[number];
export type Snapshot = {
  organizationId: string;
  groupId: string;
  epoch: number;
  root: string;
  members: string[];
  signature: string;
};
export type Receipt = {
  caseId: string;
  commitment: string;
  acceptedAt: string;
  signature: string;
  integrityStatus: 'pending-anchor';
};
export const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
export function hexToBytes(hex: string) {
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) throw new Error('Invalid hex');
  return Uint8Array.from(hex.match(/../g)!, (v) => parseInt(v, 16));
}
export const randomHex = () => bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value: string) {
  return bytesToHex(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  );
}
export async function fieldHash(value: string) {
  return (BigInt('0x' + (await digest(value))) % FIELD).toString();
}
export const currentPeriod = (now = new Date()) => now.toISOString().slice(0, 7);
export function canonicalEnvelope(e: Envelope) {
  return JSON.stringify([
    e.protocolVersion,
    e.organizationId,
    e.topicId,
    e.policyVersion,
    e.period,
    e.slot,
    e.keyVersion,
    e.ciphertext,
    e.accessVerifier,
    e.replyPublicKey,
    e.nonce,
  ]);
}
export const messageFor = (e: Envelope) =>
  fieldHash(JSON.stringify(['incognito:message:v1', canonicalEnvelope(e)]));
export const commitmentFor = (e: Envelope) =>
  digest(JSON.stringify(['incognito:receipt:v1', canonicalEnvelope(e)]));
export const scopeFor = (e: Pick<Envelope, 'topicId' | 'period' | 'slot'>) =>
  fieldHash(
    JSON.stringify(['incognito:scope:v1', ORGANIZATION, GROUP, 1, e.topicId, e.period, e.slot]),
  );
export const accessVerifierFor = (secret: string) =>
  digest(JSON.stringify(['incognito:case-access:v1', secret]));
export const snapshotBytes = (s: Omit<Snapshot, 'signature'>) =>
  JSON.stringify([s.organizationId, s.groupId, s.epoch, s.root, s.members]);
export const receiptBytes = (r: Pick<Receipt, 'caseId' | 'commitment' | 'acceptedAt'>) =>
  JSON.stringify(['incognito:receipt-signature:v1', r.caseId, r.commitment, r.acceptedAt]);
export function privacyWarnings(text: string): string[] {
  const warnings: string[] = [];
  if (/\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/i.test(text))
    warnings.push('An email address may identify you or someone else.');
  if (/(?:\+?\d[\s()-]*){10,}/.test(text))
    warnings.push('A phone number or long ID may identify a person.');
  if (/\b(my name is|student id|roll number|i am the only|room \d+)\b/i.test(text))
    warnings.push('Personal identifiers or unique circumstances may reveal who you are.');
  return warnings;
}
