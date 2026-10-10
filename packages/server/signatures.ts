import { sign, verify, timingSafeEqual, createPublicKey } from 'node:crypto';
import { Group } from '@semaphore-protocol/group';
import { GROUP, ORGANIZATION, snapshotBytes, type Snapshot } from '../protocol/index';
export const signText = (text: string, privateKey: string) =>
  sign(null, Buffer.from(text), privateKey).toString('base64');
export const verifyText = (text: string, signature: string, publicKey: string) => {
  try {
    return verify(null, Buffer.from(text), publicKey, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
};
export function validSnapshot(s: Snapshot, key: string) {
  try {
    return (
      s.organizationId === ORGANIZATION &&
      s.groupId === GROUP &&
      Number.isSafeInteger(s.epoch) &&
      s.epoch >= 1 &&
      s.members.length >= 3 &&
      s.members.length <= 64 &&
      new Set(s.members).size === s.members.length &&
      new Group(s.members).root.toString() === s.root &&
      verifyText(snapshotBytes(s), s.signature, key)
    );
  } catch {
    return false;
  }
}
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export const rawPublicKey = (pem: string) => createPublicKey(pem).export({ format: 'jwk' }).x!;
