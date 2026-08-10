import dotenv from 'dotenv';
import app from './src/app.js';
import { connectDB, disconnectDB } from './src/config/database.js';
import { validateEnv } from './src/config/env.js';
import { startEmailQueueWorker } from './src/services/emailJobService.js';
import { initializeSocket } from './src/chat/socket.js';

dotenv.config();

// Validate environment variables
validateEnv();

const PORT = process.env.PORT || 5000;

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    const emailQueueWorker = startEmailQueueWorker();
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 EventConnect Server running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 API URL: http://localhost:${PORT}/api`);
    });

    initializeSocket(server);

    // Graceful shutdown
    const shutdown = async () => {
      clearInterval(emailQueueWorker);
      console.log('🔄 Shutting down gracefully...');
      
      server.close(async () => {
        await disconnectDB();
        console.log('💤 Server closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('⚠️ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
