require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./config/logger');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // ─── CORS ───────────────────────────────────────────────────────────────────
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow requests with no origin (mobile apps, curl, etc.) in dev
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
          return cb(null, true);
        }
        cb(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    })
  );

  // ─── Body parsing ────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Request logging ─────────────────────────────────────────────────────────
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.info(msg.trim()) },
      skip: (req) => req.url === '/api/health',
    })
  );

  // ─── Routes ──────────────────────────────────────────────────────────────────
  app.use('/api', routes);

  // 404
  app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
