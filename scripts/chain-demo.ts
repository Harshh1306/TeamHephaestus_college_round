import { readFile, writeFile } from 'node:fs/promises';
import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { hardhat } from 'viem/chains';
import { compileContracts } from './compile-contracts';
import { digest } from '../packages/protocol/index';
import { verifyInclusion, inclusionProof } from '../packages/audit/merkle';
const rpc = 'http://127.0.0.1:8545';
const publicClient = createPublicClient({ chain: hardhat, transport: http(rpc) });
if ((await publicClient.getChainId()) !== 31337)
  throw new Error('This script is restricted to the local development chain.');
const wallet = createWalletClient({ chain: hardhat, transport: http(rpc) });
const [account, outsider] = await wallet.getAddresses();
const artifacts = await compileContracts();
let addresses: Record<string, Address> = {};
try {
  addresses = JSON.parse(await readFile('.local/chain.json', 'utf8'));
} catch {
  /* First deployment. */
}
for (const name of ['AuditAnchor', 'MembershipRegistry']) {
  if (!addresses[name] || !(await publicClient.getCode({ address: addresses[name] }))) {
    const hash = await wallet.deployContract({ ...artifacts[name], account, args: [] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success' || !receipt.contractAddress)
      throw new Error('Deployment failed');
    addresses[name] = receipt.contractAddress;
  }
}
await writeFile('.local/chain.json', JSON.stringify(addresses, null, 2));
const config = JSON.parse(await readFile('.local/reporting-config.json', 'utf8'));
async function api(path: string, method = 'GET', body?: unknown) {
  const r = await fetch(`http://127.0.0.1:3001${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.reviewerToken}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.code);
  return result;
}
const policy = await api('/v1/reporting-policy');
const membership = { address: addresses.MembershipRegistry, abi: artifacts.MembershipRegistry.abi };
const epoch = (await publicClient.readContract({ ...membership, functionName: 'epoch' })) as bigint;
if (epoch < BigInt(policy.snapshot.epoch)) {
  const hash = await wallet.writeContract({
    ...membership,
    account,
    functionName: 'publish',
    args: [BigInt(policy.snapshot.epoch), BigInt(policy.snapshot.root)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}
const batch = await api('/v1/reviewer/audit/prepare', 'POST', {});
const batchId = `0x${await digest(batch.id)}` as const,
  root = `0x${batch.root}` as const;
const anchor = { address: addresses.AuditAnchor, abi: artifacts.AuditAnchor.abi };
const existing = await publicClient.readContract({
  ...anchor,
  functionName: 'roots',
  args: [batchId],
});
let hash = batch.transaction_hash;
if (existing === `0x${'0'.repeat(64)}`) {
  hash = await wallet.writeContract({
    ...anchor,
    account,
    functionName: 'anchor',
    args: [batchId, root],
  });
  const tx = await publicClient.waitForTransactionReceipt({ hash });
  if (tx.status !== 'success') throw new Error('Anchor transaction failed');
} else if (existing !== root) throw new Error('On-chain root conflict');
const readback = await publicClient.readContract({
  ...anchor,
  functionName: 'roots',
  args: [batchId],
});
if (readback !== root) throw new Error('On-chain integrity check failed');
if (hash) await api('/v1/reviewer/audit/confirm', 'POST', { id: batch.id, transactionHash: hash });
let ownerEnforced = false,
  overwriteRejected = false;
try {
  await publicClient.simulateContract({
    ...anchor,
    account: outsider,
    functionName: 'anchor',
    args: [`0x${await digest('outsider')}`, root],
  });
} catch {
  ownerEnforced = true;
}
try {
  await publicClient.simulateContract({
    ...anchor,
    account,
    functionName: 'anchor',
    args: [batchId, root],
  });
} catch {
  overwriteRejected = true;
}
const leaf = batch.leaves[0],
  proof = await inclusionProof(batch.leaves, leaf);
const inclusionValid = await verifyInclusion(leaf, proof, batch.root);
const tamperDetected = !(await verifyInclusion(await digest('tampered record'), proof, batch.root));
const evidence = {
  network: 'local-hardhat',
  chainId: 31337,
  addresses,
  batchId,
  root,
  transactionHash: hash,
  ownerEnforced,
  overwriteRejected,
  inclusionValid,
  tamperDetected,
  membershipRoot: String(await publicClient.readContract({ ...membership, functionName: 'root' })),
};
await writeFile('docs/test-evidence/chain.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
if (!ownerEnforced || !overwriteRejected || !inclusionValid || !tamperDetected)
  process.exitCode = 1;
