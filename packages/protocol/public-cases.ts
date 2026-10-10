import { z } from 'zod';
import { fieldHash, ProofSchema, ORGANIZATION, GROUP } from './index';

export const PublicListSchema = z
  .object({ nonce: z.string().regex(/^[0-9a-f]{64}$/), proof: ProofSchema })
  .strict();
export const PublicSupportSchema = z.object({ proof: ProofSchema }).strict();
export const PublicCommentSchema = z
  .object({ text: z.string().trim().min(3).max(800), proof: ProofSchema })
  .strict();

export type PublicSignal =
  | { action: 'list'; nonce: string }
  | { action: 'support' | 'comment'; caseId: string; text?: string };

export function publicSignalScope(signal: PublicSignal) {
  return fieldHash(
    JSON.stringify([
      'incognito:public-scope:v1',
      ORGANIZATION,
      GROUP,
      signal.action,
      signal.action === 'list' ? signal.nonce : signal.caseId,
    ]),
  );
}

export function publicSignalMessage(signal: PublicSignal) {
  return fieldHash(
    JSON.stringify([
      'incognito:public-message:v1',
      ORGANIZATION,
      signal.action,
      signal.action === 'list' ? signal.nonce : signal.caseId,
      signal.action === 'comment' ? signal.text : null,
    ]),
  );
}
