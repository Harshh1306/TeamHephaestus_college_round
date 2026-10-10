import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, saltHex, hashHex] = stored.split(':');
  if (
    algorithm !== 'scrypt' ||
    !/^[0-9a-f]{32}$/.test(saltHex ?? '') ||
    !/^[0-9a-f]{64}$/.test(hashHex ?? '')
  )
    return false;
  const expected = Buffer.from(hashHex, 'hex');
  return timingSafeEqual(scryptSync(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH), expected);
}
