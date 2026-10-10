import { database, migrate } from '../../packages/database/index';
import { config } from '../../packages/server/config';
import { createApp } from './app';
const db = await database(process.env.REPORTING_DATABASE_URL || '.local/reporting-db');
await migrate(db);
const app = await createApp(db, config());
let labRunning = false;
app.post('/v1/lab/run', async (_req, reply) => {
  if (process.env.NODE_ENV === 'production') return reply.code(404).send({ code: 'NOT_FOUND' });
  if (labRunning) return reply.code(429).send({ code: 'LAB_BUSY' });
  labRunning = true;
  try {
    const { runLab } = await import('../../packages/lab/run');
    return await runLab();
  } finally {
    labRunning = false;
  }
});
await app.listen({ port: 3001, host: '127.0.0.1' });
console.log(
  'Reporting API ready on http://127.0.0.1:3001 (synthetic demo; request logging disabled)',
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    await app.close();
    await db.close();
    process.exit(0);
  });
