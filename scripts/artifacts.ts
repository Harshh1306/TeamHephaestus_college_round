import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = 'https://snark-artifacts.pse.dev/semaphore/4.13.0/semaphore-6';
await mkdir('public/artifacts', { recursive: true });
let manifest: Record<string, string> = {};
try {
  manifest = JSON.parse(await readFile('artifacts.sha256.json', 'utf8'));
} catch {
  /* First acquisition is recorded; subsequent downloads are pinned. */
}
for (const extension of ['wasm', 'zkey']) {
  const filename = `semaphore-6.${extension}`;
  let bytes: Buffer;
  try {
    bytes = await readFile(`public/artifacts/${filename}`);
  } catch {
    const response = await fetch(`${base}.${extension}`, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (manifest[filename] && manifest[filename] !== hash)
    throw new Error(`Artifact digest mismatch: ${filename}`);
  manifest[filename] = hash;
  await writeFile(`public/artifacts/${filename}`, bytes);
  console.log(`${filename}: ${bytes.length} bytes; SHA-256 ${hash}`);
}
await writeFile('artifacts.sha256.json', JSON.stringify(manifest, null, 2) + '\n');
