import { test, expect } from 'vitest';
import { runLab } from '../packages/lab/run';
test('real cryptography, admission, privacy, revocation and concurrency', async () => {
  const run = await runLab((result) =>
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.id}: ${result.name}`),
  );
  expect(run.results.filter((r) => !r.passed)).toEqual([]);
  expect(run.total).toBeGreaterThanOrEqual(27);
});
