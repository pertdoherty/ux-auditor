
const { Worker } = require('bullmq');
const { runAudit } = require('./runner');
new Worker('audit', async job=>{
  await runAudit(job.data.url);
}, {connection:{host:'localhost',port:6379}});
