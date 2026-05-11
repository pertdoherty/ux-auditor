/**
 * UX Auditor — API Server
 * 
 * Endpoints:
 *   POST /audit          — Submit a URL for UX audit
 *   GET  /audit/:jobId   — Check job status & get results
 *   GET  /health         — Health check
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const { Queue } = require('bullmq');
const { REDIS_CONNECTION, QUEUE_NAME, DEFAULT_JOB_OPTIONS } = require('../../infra/queue/connection');

const app = express();
app.use(cors());
app.use(express.json());

// ── Queue ──────────────────────────────────────────────────
const auditQueue = new Queue(QUEUE_NAME, {
  connection: REDIS_CONNECTION,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

// ── POST /audit ────────────────────────────────────────────
app.post('/audit', async (req, res) => {
  const { url } = req.body;

  if (!url || !url.startsWith('http')) {
    return res.status(400).json({
      success: false,
      error: 'A valid URL starting with http(s):// is required.',
    });
  }

  try {
    const job = await auditQueue.add('audit-job', {
      url,
      requestedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      jobId: job.id,
      message: 'Audit queued successfully.',
    });
  } catch (err) {
    console.error('[API] Failed to queue audit:', err.message);
    res.status(500).json({ success: false, error: 'Failed to queue audit.' });
  }
});

// ── GET /audit/:jobId ──────────────────────────────────────
app.get('/audit/:jobId', async (req, res) => {
  try {
    const job = await auditQueue.getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found.' });
    }

    const state = await job.getState();
    const progress = job.progress || 0;
    const result = job.returnvalue || null;
    const failedReason = job.failedReason || null;

    res.json({
      success: true,
      jobId: job.id,
      state,       // 'waiting' | 'active' | 'completed' | 'failed'
      progress,    // 0-100
      result,      // null until completed
      failedReason,
    });
  } catch (err) {
    console.error('[API] Failed to get job:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get job status.' });
  }
});

// ── GET /health ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`[API] UX Auditor API running on port ${PORT}`);
});
