import { io } from 'socket.io-client';

let socket = null;

export function initSocket() {
  const token = localStorage.getItem('cf_token');
  if (!token) return null;

  if (socket && socket.connected) {
    return socket;
  }

  const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

  socket = io(socketUrl, {
    auth: {
      token: `Bearer ${token}`
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000
  });

  socket.on('connect', () => {
    // Connected to tenant real-time room
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket:Client] Real-time connection error:', err.message);
  });

  return socket;
}

export function getSocket() {
  if (!socket) return initSocket();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default {
  initSocket,
  getSocket,
  disconnectSocket
};
