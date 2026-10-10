import { readFile, mkdir, writeFile } from 'node:fs/promises';
// solc ships a JavaScript compiler but does not publish TypeScript declarations.
// @ts-ignore
import solc from 'solc';
export async function compileContracts() {
  const names = ['AuditAnchor', 'MembershipRegistry'];
  const sources = Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [
        `${name}.sol`,
        { content: await readFile(`contracts/${name}.sol`, 'utf8') },
      ]),
    ),
  );
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: 'Solidity',
        sources,
        settings: {
          evmVersion: 'cancun',
          optimizer: { enabled: true, runs: 200 },
          outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
        },
      }),
    ),
  );
  if (output.errors?.some((e: any) => e.severity === 'error'))
    throw new Error(JSON.stringify(output.errors));
  await mkdir('.local/contracts', { recursive: true });
  const artifacts = Object.fromEntries(
    names.map((name) => {
      const contract = output.contracts[`${name}.sol`][name];
      return [
        name,
        { abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` as `0x${string}` },
      ];
    }),
  );
  for (const name of names)
    await writeFile(`.local/contracts/${name}.json`, JSON.stringify(artifacts[name], null, 2));
  return artifacts;
}
