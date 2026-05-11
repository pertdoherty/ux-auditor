const express = require('express');
const { Queue } = require('bullmq');

const app = express();
app.use(express.json());

const queue = new Queue('audit', {
  connection: { host: 'localhost', port: 6379 }
});

app.post('/audit', async (req, res) => {
  const { url } = req.body;

  const job = await queue.add('audit-job', { url });

  res.json({
    success: true,
    jobId: job.id
  });
});

app.listen(3000, () => {
  console.log('API running on port 3000');
});
