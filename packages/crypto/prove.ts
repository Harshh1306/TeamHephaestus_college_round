import { Identity } from '@semaphore-protocol/identity';
import { Group } from '@semaphore-protocol/group';
import { generateProof } from '@semaphore-protocol/proof';
import {
  publicSignalMessage,
  publicSignalScope,
  type PublicSignal,
} from '../protocol/public-cases';
import {
  messageFor,
  scopeFor,
  type Envelope,
  type Snapshot,
  type Submission,
} from '../protocol/index';
export async function prove(
  secret: string,
  snapshot: Snapshot,
  envelope: Envelope,
  browser = false,
): Promise<Submission> {
  const identity = new Identity(secret),
    group = new Group(snapshot.members);
  if (group.root.toString() !== snapshot.root || group.indexOf(identity.commitment) < 0)
    throw new Error('This credential is not in the current authorized membership group.');
  const root = browser ? '/artifacts' : 'public/artifacts';
  const proof = await generateProof(
    identity,
    group,
    await messageFor(envelope),
    await scopeFor(envelope),
    6,
    { wasm: `${root}/semaphore-6.wasm`, zkey: `${root}/semaphore-6.zkey` },
  );
  return { envelope, proof } as Submission;
}

export async function provePublicSignal(
  secret: string,
  snapshot: Snapshot,
  signal: PublicSignal,
  browser = false,
) {
  const identity = new Identity(secret);
  const group = new Group(snapshot.members);
  if (group.root.toString() !== snapshot.root || group.indexOf(identity.commitment) < 0)
    throw new Error('This credential is not in the current authorized membership group.');
  const root = browser ? '/artifacts' : 'public/artifacts';
  return generateProof(
    identity,
    group,
    await publicSignalMessage(signal),
    await publicSignalScope(signal),
    6,
    { wasm: `${root}/semaphore-6.wasm`, zkey: `${root}/semaphore-6.zkey` },
  );
}
