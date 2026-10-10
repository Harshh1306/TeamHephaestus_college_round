import { test, expect } from 'vitest';
import { digest } from '../packages/protocol/index';
import { merkleRoot, inclusionProof, verifyInclusion } from '../packages/audit/merkle';
test('Merkle inclusion for odd and even batches detects tampering', async () => {
  for (const size of [1, 2, 3, 4, 7]) {
    const leaves = await Promise.all(
      Array.from({ length: size }, (_, i) => digest(`synthetic report ${i}`)),
    );
    const root = await merkleRoot(leaves);
    for (const leaf of leaves) {
      const proof = await inclusionProof(leaves, leaf);
      expect(await verifyInclusion(leaf, proof, root)).toBe(true);
      expect(await verifyInclusion(await digest('modified report'), proof, root)).toBe(false);
    }
  }
});
