import { prisma } from '../config/database.js';
import { createChatMessage } from '../services/chatService.js';

export const getUserChatRooms = async (req, res) => {
  try {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        OR: [
          { plannerId: req.user.id },
          { vendorId: req.user.id }
        ]
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        planner: {
          select: { id: true, firstName: true, lastName: true, avatar: true }
        },
        vendor: {
          select: { id: true, firstName: true, lastName: true, avatar: true }
        },
        enquiry: {
          select: {
            id: true,
            eventType: true,
            eventDate: true,
            status: true,
            eventLocation: true,
            budget: true
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true, avatar: true, role: true }
            }
          }
        }
      }
    });

    return res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    console.error('Get user chat rooms error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching chat rooms' });
  }
};

export const getChatRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { id: true, plannerId: true, vendorId: true }
    });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    if (room.plannerId !== req.user.id && room.vendorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not a participant in this chat' });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatar: true, role: true }
        }
      }
    });

    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error('Get chat room messages error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching chat messages' });
  }
};

export const sendChatRoomMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content } = req.body;

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { id: true, plannerId: true, vendorId: true }
    });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    if (room.plannerId !== req.user.id && room.vendorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not a participant in this chat' });
    }

    const message = await prisma.$transaction(async (tx) => {
      const created = await createChatMessage(tx, {
        roomId,
        senderId: req.user.id,
        content: content.trim()
      });

      await tx.chatRoom.update({
        where: { id: roomId },
        data: { updatedAt: new Date() }
      });

      return created;
    });

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error('Send chat room message error:', error);
    return res.status(500).json({ success: false, message: 'Error sending chat message' });
  }
};
