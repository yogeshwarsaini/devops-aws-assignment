const express = require('express');
const os = require('os');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let requestCount = 0;

// Simple request logger -> stdout (picked up by CloudWatch agent later)
app.use((req, res, next) => {
  requestCount++;
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration
    }));
  });
  next();
});

// Health check - used by load balancer / monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime_seconds: process.uptime(),
    hostname: os.hostname(),
    timestamp: new Date().toISOString()
  });
});

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'DevOps Assignment Demo API',
    version: '1.0.0',
    requestCount
  });
});

// Sample GET API - list items (simulated data)
app.get('/api/items', (req, res) => {
  const items = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    price: (Math.random() * 100).toFixed(2)
  }));
  res.json({ count: items.length, items });
});

// Sample GET with a bit of CPU work - useful for load testing bottlenecks
app.get('/api/compute', (req, res) => {
  let total = 0;
  for (let i = 0; i < 1e6; i++) {
    total += Math.sqrt(i);
  }
  res.json({ result: total });
});

// Sample POST API
app.post('/api/items', (req, res) => {
  const { name, price } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'name and price are required' });
  }
  res.status(201).json({ id: Date.now(), name, price });
});

// Metrics endpoint (basic, for demo)
app.get('/metrics', (req, res) => {
  res.json({
    requestCount,
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
