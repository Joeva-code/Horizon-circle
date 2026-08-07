import express from 'express';
import {
  getChatRoomMessages,
  getUserChatRooms,
  sendChatRoomMessage
} from '../controllers/chatController.js';
import { protect } from '../middleware/auth.js';
import { chatValidation, validate } from '../middleware/validation.js';

const router = express.Router();

router.use(protect);

router.get('/rooms', getUserChatRooms);
router.get('/rooms/:roomId/messages', validate(chatValidation.roomId), getChatRoomMessages);
router.post('/rooms/:roomId/messages', validate(chatValidation.sendMessage), sendChatRoomMessage);

export default router;
