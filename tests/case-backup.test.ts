import { expect, test } from 'vitest';
import { keypair, lockVault, unlockVault } from '../packages/crypto/index';
import { randomHex } from '../packages/protocol/index';
import type { CaseVault } from '../apps/web/api';

test('case backups retain the reporter copy encrypted and still accept older backups', async () => {
  const legacy: CaseVault = {
    kind: 'case',
    secret: randomHex(),
    nonce: randomHex(),
    replyKeys: await keypair(),
  };
  const current: CaseVault = {
    ...legacy,
    report: {
      title: 'Private laboratory concern',
      details: 'First line of the original report.\nSecond line stays intact.',
    },
  };
  const passphrase = 'Synthetic backup passphrase';
  const serialized = await lockVault(current, passphrase);
  expect(serialized).not.toContain(current.report!.title);
  expect(serialized).not.toContain(current.report!.details);
  expect(await unlockVault(serialized, passphrase)).toEqual(current);
  const restoredLegacy = await unlockVault(await lockVault(legacy, passphrase), passphrase);
  expect(restoredLegacy).toEqual(legacy);
  expect(restoredLegacy.report).toBeUndefined();
});
