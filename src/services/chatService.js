export const ensureChatRoomForEnquiry = async (tx, { plannerId, vendorId, enquiryId }) => {
  const existingRoom = await tx.chatRoom.findFirst({
    where: { enquiryId }
  });

  if (existingRoom) {
    return existingRoom;
  }

  return tx.chatRoom.create({
    data: {
      plannerId,
      vendorId,
      enquiryId
    }
  });
};

export const ensureChatRoomForBooking = ensureChatRoomForEnquiry;

export const createChatMessage = async (tx, { roomId, senderId, content }) => {
  return tx.chatMessage.create({
    data: {
      roomId,
      senderId,
      content
    },
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true
        }
      }
    }
  });
};
