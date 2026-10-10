import { readFile, writeFile, rename } from 'node:fs/promises';
import { createAuthority } from './app';
const file = '.local/authority/ledger.json';
const app = createAuthority({
  load: async () => JSON.parse(await readFile(file, 'utf8')),
  save: async (ledger) => {
    await writeFile(file + '.tmp', JSON.stringify(ledger, null, 2));
    await rename(file + '.tmp', file);
  },
  publish: async (snapshot) => {
    const response = await fetch('http://127.0.0.1:3001/v1/internal/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('PUBLISH_UNAVAILABLE');
  },
});
await app.listen({ port: 3002, host: '127.0.0.1' });
console.log('Enrollment authority ready on http://127.0.0.1:3002 (separate synthetic roster)');
