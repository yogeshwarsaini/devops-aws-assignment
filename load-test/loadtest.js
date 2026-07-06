// k6 load test script
// Install k6: https://k6.io/docs/get-started/installation/
// Run: k6 run loadtest.js --env BASE_URL=http://YOUR_EC2_PUBLIC_IP

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const errorRate = new Rate('errors');
const computeLatency = new Trend('compute_endpoint_latency');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp up to 10 users
    { duration: '1m', target: 50 },    // ramp up to 50 users
    { duration: '2m', target: 50 },    // stay at 50 users (steady load)
    { duration: '30s', target: 100 },  // spike to 100 users
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],   // 95% of requests should be < 1s
    errors: ['rate<0.05'],               // error rate should be < 5%
  },
};

export default function () {
  const responses = {
    health: http.get(`${BASE_URL}/health`),
    items: http.get(`${BASE_URL}/api/items`),
    compute: http.get(`${BASE_URL}/api/compute`),
  };

  check(responses.health, { 'health status 200': (r) => r.status === 200 });
  check(responses.items, { 'items status 200': (r) => r.status === 200 });
  check(responses.compute, { 'compute status 200': (r) => r.status === 200 });

  errorRate.add(responses.health.status !== 200);
  errorRate.add(responses.items.status !== 200);
  errorRate.add(responses.compute.status !== 200);
  computeLatency.add(responses.compute.timings.duration);

  sleep(1);
}

// After run, k6 prints a summary with:
// - http_req_duration (latency: avg, min, max, p90, p95)
// - http_reqs (throughput - requests/sec)
// - http_req_failed (error rate)
// Export to JSON for graphing: k6 run --out json=results.json loadtest.js
