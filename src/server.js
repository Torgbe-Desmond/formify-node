require('dotenv').config();

const { createApp } = require('./app');
const { connectDB } = require('./config/db');
const logger = require('./config/logger');

const PORT = parseInt(process.env.PORT || '5000', 10);

async function bootstrap() {
  try {
    await connectDB();

    const app = createApp();

    app.listen(PORT, () => {
      logger.info(`FastTransfers API listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    logger.error({ message: 'Failed to start server', error: err.message, stack: err.stack });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully');
  process.exit(0);
});

bootstrap();
