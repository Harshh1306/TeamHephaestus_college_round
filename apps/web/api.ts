import { Group } from '@semaphore-protocol/group';
import {
  snapshotBytes,
  type DepartmentId,
  type Snapshot,
  type Submission,
  type Envelope,
  type Receipt,
} from '../../packages/protocol/index';
export type Policy = {
  period: string;
  departments: { id: DepartmentId; label: string; publicKey: string }[];
  topicDepartments: Record<string, DepartmentId>;
  authorityPublicKey: string;
  receiptPublicKey: string;
  snapshot: Snapshot;
};
export async function api<T = any>(
  path: string,
  method = 'GET',
  body?: unknown,
  token?: string,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => {
    throw new Error('The service is restarting or unavailable. Please try again in a moment.');
  });
  if (!response.ok) throw new Error(data.code || 'REQUEST_FAILED');
  return data;
}
export async function verifySignature(text: string, signature: string, publicKey: string) {
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'OKP', crv: 'Ed25519', x: publicKey, ext: true },
    { name: 'Ed25519' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'Ed25519',
    key,
    Uint8Array.from(atob(signature), (c) => c.charCodeAt(0)),
    new TextEncoder().encode(text),
  );
}
export async function getPolicy(): Promise<Policy> {
  const policy = await api<Policy>('/v1/reporting-policy');
  if (
    new Group(policy.snapshot.members).root.toString() !== policy.snapshot.root ||
    !(await verifySignature(
      snapshotBytes(policy.snapshot),
      policy.snapshot.signature,
      policy.authorityPublicKey,
    ))
  )
    throw new Error('Membership snapshot authentication failed.');
  return policy;
}
export function browserProof(
  secret: string,
  snapshot: Snapshot,
  envelope: Envelope,
): Promise<Submission> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./proof.worker.ts', import.meta.url), { type: 'module' });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Proof generation timed out. Your report has not been sent.'));
    }, 180000);
    worker.onmessage = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.submission);
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error('Could not load the proof engine. Run npm run artifacts and retry.'));
    };
    worker.postMessage({ secret, snapshot, envelope });
  });
}
export type CaseVault = {
  kind: 'case';
  secret: string;
  replyKeys: { publicKey: string; privateKey: string };
  nonce: string;
  receipt?: Receipt;
};
export const friendly = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error);
  const messages: Record<string, string> = {
    DUPLICATE_SUBMISSION:
      'This reporting slot has already been used. Choose another available slot.',
    UNAUTHORIZED_GROUP: 'Membership changed. Refresh the page to use the latest group.',
    POLICY_EXPIRED: 'This reporting period has ended. Refresh and try again.',
    ACCESS_DENIED: 'These credentials do not grant access. Check your private credential.',
    ALREADY_ENROLLED: 'This roll number already has a credential. Restore the original backup.',
    NOT_ELIGIBLE: 'Roll number or password is incorrect, or this membership is unavailable.',
    VERIFIER_BUSY: 'The verifier is busy. Your slot has not been consumed; please retry.',
    LAB_BUSY: 'A security test is already running. Try again when it finishes.',
    CASE_CLOSED: 'This case is closed. Request a reopen from the reviewer to continue.',
    CASE_NOT_CLOSED: 'This case is not currently closed.',
    REOPEN_ALREADY_REQUESTED: 'A reopen request is already waiting for reviewer action.',
    CLOSURE_REASON_REQUIRED: 'The reviewer must provide a closure summary.',
    INVALID_HANDOFF_TARGET: 'Choose a different authorized department for this handoff.',
    HANDOFF_ALREADY_ACTIVE: 'A handoff to this department is already active for this case.',
    HANDOFF_ALREADY_DECIDED: 'This handoff already has a recorded decision.',
    HANDOFF_NOT_APPROVED: 'The reporter must approve this handoff before it can be accepted.',
  };
  return messages[raw] || raw;
};
export async function verifyLocalAnchor(inclusion: any) {
  if (!inclusion.chain?.verified || inclusion.chain.chainId !== 31337) return false;
  const { createPublicClient, http, parseAbi } = await import('viem');
  const client = createPublicClient({
    transport: http('http://127.0.0.1:8545', { timeout: 3000, retryCount: 0 }),
  });
  if ((await client.getChainId()) !== 31337) return false;
  const root = await client.readContract({
    address: inclusion.chain.contract,
    abi: parseAbi(['function roots(bytes32) view returns (bytes32)']),
    functionName: 'roots',
    args: [inclusion.chain.batchId],
  });
  return root === `0x${inclusion.root}`;
}
