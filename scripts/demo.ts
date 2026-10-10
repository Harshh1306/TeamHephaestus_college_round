import { mkdir, writeFile } from 'node:fs/promises';
import { runLab } from '../packages/lab/run';
const run = await runLab((r) =>
  console.log(`${r.passed ? 'PASS' : 'FAIL'} ${r.id} ${r.name} (${r.durationMs} ms)`),
);
await mkdir('docs/test-evidence', { recursive: true });
await writeFile('docs/test-evidence/latest.json', JSON.stringify(run, null, 2) + '\n');
console.log(
  `${run.passed}/${run.total} passed in ${(run.durationMs / 1000).toFixed(1)} s. Evidence: docs/test-evidence/latest.json`,
);
process.exit(run.passed === run.total ? 0 : 1);
