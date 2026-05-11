/**
 * UX Auditor — Worker Processor
 * 
 * Consumes jobs from BullMQ queue and runs the full audit pipeline:
 *   Crawl → Simulate → Collect → Analyze → Report
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { Worker } = require('bullmq');
const { REDIS_CONNECTION, QUEUE_NAME } = require('../../infra/queue/connection');
const { runAudit } = require('./runner');

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { url } = job.data;
    console.log(`[Worker] Starting audit for: ${url} (Job ${job.id})`);

    try {
      // Progress: 0% — Starting
      await job.updateProgress(0);

      const result = await runAudit(url, async (stage, percent) => {
        console.log(`[Worker] ${stage} — ${percent}%`);
        await job.updateProgress(percent);
      });

      console.log(`[Worker] Audit complete for: ${url}`);
      return result;
    } catch (err) {
      console.error(`[Worker] Audit failed for ${url}:`, err.message);
      throw err;
    }
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 2, // max 2 audits at once (Playwright is memory-heavy)
    limiter: {
      max: 5,
      duration: 60000, // max 5 jobs per minute
    },
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully.`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err.message);
});

console.log('[Worker] UX Auditor worker is running...');