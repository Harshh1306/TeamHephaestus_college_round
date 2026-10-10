import { readFile } from 'node:fs/promises';
import {
  createPublicClient,
  http,
  parseAbi,
  decodeFunctionData,
  type Address,
  type Hex,
} from 'viem';
import { digest } from '../protocol/index';
export const auditAbi = parseAbi([
  'function roots(bytes32) view returns (bytes32)',
  'function anchor(bytes32 batchId, bytes32 root)',
]);
export async function chainEvidence(id: string, root: string, transactionHash?: string) {
  const addresses = JSON.parse(await readFile('.local/chain.json', 'utf8'));
  const address: Address = addresses.AuditAnchor;
  const client = createPublicClient({
    transport: http('http://127.0.0.1:8545', { timeout: 3000, retryCount: 0 }),
  });
  if ((await client.getChainId()) !== 31337) throw new Error('Wrong chain');
  const batchId = `0x${await digest(id)}` as Hex;
  const actual = await client.readContract({
    address,
    abi: auditAbi,
    functionName: 'roots',
    args: [batchId],
  });
  if (actual !== `0x${root}`) throw new Error('Commitment mismatch');
  if (transactionHash) {
    const hash = transactionHash as Hex;
    const [tx, receipt] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
    ]);
    const call = decodeFunctionData({ abi: auditAbi, data: tx.input });
    if (
      tx.to?.toLowerCase() !== address.toLowerCase() ||
      receipt.status !== 'success' ||
      call.functionName !== 'anchor' ||
      call.args[0] !== batchId ||
      call.args[1] !== `0x${root}`
    )
      throw new Error('Invalid anchor transaction');
  }
  return { verified: true, chainId: 31337, network: 'local-hardhat', contract: address, batchId };
}
