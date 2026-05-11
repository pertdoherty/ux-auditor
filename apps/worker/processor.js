const { Worker } = require('bullmq');
const { runAudit } = require('./runner');

new Worker('audit', async job => {
  const result = await runAudit(job.data.url);
  console.log('Audit done:', result);
}, {
  connection: { host: 'localhost', port: 6379 }
});