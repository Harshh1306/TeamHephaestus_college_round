import { digest } from '../protocol/index';
const pair = (a: string, b: string) =>
  digest(JSON.stringify(['incognito:audit-node:v1', ...[a, b].sort()]));
export async function merkleRoot(leaves: string[]) {
  if (!leaves.length || leaves.some((l) => !/^[0-9a-f]{64}$/.test(l)))
    throw new Error('Invalid leaves');
  let level = [...leaves];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2)
      next.push(await pair(level[i], level[i + 1] || level[i]));
    level = next;
  }
  return level[0];
}
export async function inclusionProof(leaves: string[], leaf: string) {
  let index = leaves.indexOf(leaf),
    level = [...leaves];
  const siblings: string[] = [];
  if (index < 0) throw new Error('Leaf not found');
  while (level.length > 1) {
    siblings.push(level[index ^ 1] || level[index]);
    const next = [];
    for (let i = 0; i < level.length; i += 2)
      next.push(await pair(level[i], level[i + 1] || level[i]));
    level = next;
    index = Math.floor(index / 2);
  }
  return siblings;
}
export async function verifyInclusion(leaf: string, siblings: string[], root: string) {
  let current = leaf;
  for (const sibling of siblings) current = await pair(current, sibling);
  return current === root;
}
