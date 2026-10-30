import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from './utils/logger.js';

let ioInstance = null;

/**
 * Initialize Socket.IO with JWT Authentication & Tenant Room Isolation
 */
export function initSocketServer(httpServer) {
  ioInstance = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 30000,
    pingInterval: 10000
  });

  // JWT Authentication Middleware for Socket Connections
  ioInstance.use((socket, next) => {
    try {
      const authHeader = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (!authHeader) {
        return next(new Error('Authentication token required for WebSocket connection'));
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const secret = process.env.JWT_SECRET || 'dev_jwt_secret_campaignflow_super_secure_key_12345';
      const decoded = jwt.verify(token, secret);

      socket.user = decoded;
      socket.businessId = decoded.businessId || decoded.business_id;

      if (!socket.businessId && decoded.role !== 'superadmin') {
        return next(new Error('Valid tenant context required for WebSocket connection'));
      }

      next();
    } catch (err) {
      logger.warn(`[Socket:Auth] Unauthorized connection rejected: ${err.message}`);
      next(new Error('Invalid or expired authentication token'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const user = socket.user;
    const businessId = socket.businessId;

    logger.info(`🔌 [Socket:Connected] User #${user.id} (${user.role}) connected to tenant:${businessId}`);

    // Join tenant-scoped room
    if (businessId) {
      socket.join(`tenant:${businessId}`);
    } else if (user.role === 'superadmin') {
      socket.join('tenant:superadmin');
    }

    // Join conversation room on demand
    socket.on('join_conversation', (conversationId) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
        logger.debug(`[Socket] User #${user.id} joined conversation:${conversationId}`);
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
        logger.debug(`[Socket] User #${user.id} left conversation:${conversationId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug(`🔌 [Socket:Disconnected] User #${user.id} disconnected (${reason})`);
    });
  });

  logger.info('🚀 [Socket] Real-time Socket.IO Server initialized with tenant room security');
  return ioInstance;
}

/**
 * Emit an event safely to all connected clients of a specific tenant
 */
export function emitToTenant(businessId, event, data) {
  if (!ioInstance) return;
  try {
    ioInstance.to(`tenant:${businessId}`).emit(event, data);
    // Also notify superadmin room
    ioInstance.to('tenant:superadmin').emit(event, { ...data, _tenantId: businessId });
  } catch (err) {
    logger.error(`[Socket] Failed to emit ${event} to tenant:${businessId}:`, err);
  }
}

/**
 * Emit an event to a specific conversation room
 */
export function emitToConversation(conversationId, event, data) {
  if (!ioInstance) return;
  try {
    ioInstance.to(`conversation:${conversationId}`).emit(event, data);
  } catch (err) {
    logger.error(`[Socket] Failed to emit ${event} to conversation:${conversationId}:`, err);
  }
}

export function getIO() {
  return ioInstance;
}

export default {
  initSocketServer,
  emitToTenant,
  emitToConversation,
  getIO
};
