import sodium from 'libsodium-wrappers-sumo';
import { hexToBytes, bytesToHex } from '../protocol/index';

export async function keypair() {
  await sodium.ready;
  const k = sodium.crypto_box_keypair();
  return { publicKey: bytesToHex(k.publicKey), privateKey: bytesToHex(k.privateKey) };
}
export async function seal(text: string, publicKey: string) {
  await sodium.ready;
  return sodium.to_base64(
    sodium.crypto_box_seal(text, hexToBytes(publicKey)),
    sodium.base64_variants.ORIGINAL,
  );
}
export async function unseal(ciphertext: string, publicKey: string, privateKey: string) {
  await sodium.ready;
  return sodium.to_string(
    sodium.crypto_box_seal_open(
      sodium.from_base64(ciphertext, sodium.base64_variants.ORIGINAL),
      hexToBytes(publicKey),
      hexToBytes(privateKey),
    ),
  );
}

// Secret material stays in memory. Only this password-encrypted export is persisted.
export async function lockVault(value: unknown, password: string) {
  if (password.length < 12) throw new Error('Use a backup passphrase of at least 12 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await vaultKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return JSON.stringify({
    version: 1,
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(ciphertext)),
  });
}
export async function unlockVault(serialized: string, password: string) {
  const v = JSON.parse(serialized);
  if (v.version !== 1 || typeof v.ciphertext !== 'string' || v.ciphertext.length > 200000)
    throw new Error('Invalid backup');
  const key = await vaultKey(password, hexToBytes(v.salt));
  return JSON.parse(
    new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: hexToBytes(v.iv) },
        key,
        hexToBytes(v.ciphertext),
      ),
    ),
  );
}
async function vaultKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
