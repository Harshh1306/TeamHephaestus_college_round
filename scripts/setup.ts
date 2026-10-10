import { mkdir, writeFile, access, readFile, rename } from 'node:fs/promises';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { Identity } from '@semaphore-protocol/identity';
import { Group } from '@semaphore-protocol/group';
import { keypair } from '../packages/crypto/index';
import { randomHex, ORGANIZATION, GROUP, TOPICS, snapshotBytes } from '../packages/protocol/index';
import { signText } from '../packages/server/signatures';
import { hashPassword } from '../packages/server/passwords';
try {
  await access('.local/reporting-config.json');
  const ledgerPath = '.local/authority/ledger.json';
  const credentialsPath = '.local/demo-credentials.json';
  const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
  if (ledger.members.some((member: { token?: string }) => member.token)) {
    const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
    const passwords = new Map<string, string>();
    ledger.members = ledger.members.map(
      (member: { id: string; token?: string; passwordHash?: string }) => {
        if (!member.token) return member;
        passwords.set(member.id, member.token);
        const { token, ...rest } = member;
        return { ...rest, passwordHash: hashPassword(token) };
      },
    );
    credentials.enrollment = credentials.enrollment.map((entry: { id: string }) => ({
      rollNumber: entry.id,
      password: passwords.get(entry.id),
    }));
    await writeFile(credentialsPath + '.tmp', JSON.stringify(credentials, null, 2));
    await rename(credentialsPath + '.tmp', credentialsPath);
    await writeFile(ledgerPath + '.tmp', JSON.stringify(ledger, null, 2));
    await rename(ledgerPath + '.tmp', ledgerPath);
    console.log('Migrated existing synthetic invitations to roll-number/password enrollment.');
  }
  console.log('Setup already exists. Existing identities and cases were preserved.');
  process.exit(0);
} catch {
  /* Fresh demo. */
}
await mkdir('.local/authority', { recursive: true });
await mkdir('.local/reviewer', { recursive: true });
const authority = generateKeyPairSync('ed25519'),
  receipt = generateKeyPairSync('ed25519');
const pem = (k: any, type: 'pkcs8' | 'spki') => k.export({ type, format: 'pem' }).toString();
const members = ['Alice', 'Bob', 'Carol'].map((name) => {
  const secret = randomHex();
  const identity = new Identity(secret);
  return { name, secret, commitment: identity.commitment.toString() };
});
const roster = Array.from({ length: 24 }, (_, i) => {
  const password = randomBytes(12).toString('base64url');
  return {
    id: `student-${String(i + 1).padStart(2, '0')}`,
    password,
    passwordHash: hashPassword(password),
    ...(i < 3 ? { commitment: members[i].commitment } : {}),
  };
});
const s = {
  organizationId: ORGANIZATION,
  groupId: GROUP,
  epoch: 1,
  root: new Group(members.map((m) => m.commitment)).root.toString(),
  members: members.map((m) => m.commitment),
};
const snapshot = {
  ...s,
  signature: signText(snapshotBytes(s), pem(authority.privateKey, 'pkcs8')),
};
const reviewer = await keypair(),
  reviewerToken = randomHex();
await writeFile(
  '.local/authority/ledger.json',
  JSON.stringify(
    {
      epoch: 1,
      members: roster.map(({ password, ...member }) => member),
      signingKey: pem(authority.privateKey, 'pkcs8'),
      adminToken: randomHex(),
    },
    null,
    2,
  ),
);
await writeFile(
  '.local/reporting-config.json',
  JSON.stringify(
    {
      authorityPublicKey: pem(authority.publicKey, 'spki'),
      receiptPrivateKey: pem(receipt.privateKey, 'pkcs8'),
      receiptPublicKey: pem(receipt.publicKey, 'spki'),
      reviewerPublicKey: reviewer.publicKey,
      reviewerToken,
      reviewerTopics: TOPICS,
      snapshot,
    },
    null,
    2,
  ),
);
await writeFile(
  '.local/reviewer/credentials.json',
  JSON.stringify({ ...reviewer, token: reviewerToken }, null, 2),
);
await writeFile(
  '.local/demo-credentials.json',
  JSON.stringify(
    {
      warning: 'Synthetic demo credentials only. Never publish this file.',
      members,
      enrollment: roster.slice(3).map((m) => ({ rollNumber: m.id, password: m.password })),
      reviewerFile: '.local/reviewer/credentials.json',
    },
    null,
    2,
  ),
);
console.log('Created 3 synthetic members and 21 unused roll-number/password accounts.');
console.log(
  'Demo credentials: .local/demo-credentials.json; reviewer keys: .local/reviewer/credentials.json',
);
console.log('No private reviewer or member key is in the reporting configuration.');
