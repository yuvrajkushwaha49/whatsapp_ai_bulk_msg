import http from 'http';
import app from './app.js';
import { checkConnection } from './database/db.js';
import { initSocketServer } from './socket.js';
import logger from './utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || '5000', 10);

async function startServer() {
  logger.info('⚡ [Server] Checking database connection...');
  await checkConnection();

  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(PORT, () => {
    logger.info(`✨ CampaignFlow Backend API listening on port ${PORT}`);
    logger.info(`🌐 Health check available at http://localhost:${PORT}/api/health`);
  });

  const handleShutdown = (signal) => {
    logger.info(`🛑 Received ${signal}. Shutting down gracefully...`);
    httpServer.close(() => {
      logger.info('👋 Server closed. Exiting process.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer().catch(err => {
  logger.error('❌ Failed to start CampaignFlow backend:', err);
  process.exit(1);
});
