/**
 * Shared Redis/BullMQ connection configuration.
 * Used by both API (producer) and Worker (consumer).
 */

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const QUEUE_NAME = 'ux-audit';

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    count: 100,    // keep last 100 completed jobs
    age: 86400,    // remove after 24h
  },
  removeOnFail: {
    count: 50,
  },
};

module.exports = {
  REDIS_CONNECTION,
  QUEUE_NAME,
  DEFAULT_JOB_OPTIONS,
};
