/**
 * x402 router — mounts the three Delibera x402 endpoints under /x402.
 *
 * Route map:
 *   GET  /x402/info             → x402-info        (free)
 *   POST /x402/deliberate       → x402-deliberate  ($0.01 USDC)
 *   GET  /x402/verdict/:id      → x402-verdict     ($0.002 USDC)
 *
 * The x402 payment middleware is mounted separately in index.ts
 * via `app.use('/x402/*', createX402Middleware())`. That middleware
 * only intercepts the exact routes it was configured for (deliberate
 * + verdict); /x402/info passes through without payment negotiation.
 */

import { Hono } from 'hono';
import infoRoute from './x402-info';
import deliberateRoute from './x402-deliberate';
import verdictRoute from './x402-verdict';

const app = new Hono();

app.route('/info', infoRoute);
app.route('/deliberate', deliberateRoute);
app.route('/verdict', verdictRoute);

export default app;
