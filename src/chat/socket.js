import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { createChatMessage } from '../services/chatService.js';

export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://orange-herizon-circle-a7pj-delta.vercel.app'
      ],
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: missing token'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });

      if (!user) {
        return next(new Error('Authentication error: user not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-room', async ({ roomId }) => {
      if (!roomId) return;

      const room = await prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: { id: true, plannerId: true, vendorId: true }
      });

      if (!room) return;

      const isParticipant = [room.plannerId, room.vendorId].includes(socket.user.id);
      if (!isParticipant) return;

      socket.join(roomId);
      socket.emit('joined-room', { roomId });
    });

    socket.on('send-message', async ({ roomId, content }) => {
      if (!roomId || !content || !content.trim()) return;

      const room = await prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: { id: true, plannerId: true, vendorId: true }
      });

      if (!room) return;

      const isParticipant = [room.plannerId, room.vendorId].includes(socket.user.id);
      if (!isParticipant) return;

      const message = await prisma.$transaction(async (tx) => {
        const created = await createChatMessage(tx, {
          roomId,
          senderId: socket.user.id,
          content: content.trim()
        });

        await tx.chatRoom.update({
          where: { id: roomId },
          data: { updatedAt: new Date() }
        });

        return created;
      });

      io.to(roomId).emit('new-message', message);
    });

    socket.on('disconnect', () => {
      // no-op
    });
  });

  return io;
};
