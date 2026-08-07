import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureChatRoomForBooking } from '../src/services/chatService.js';

test('ensureChatRoomForBooking reuses an existing room for the same booking', async () => {
  const existingRoom = {
    id: 'room-123',
    plannerId: 'planner-1',
    vendorId: 'vendor-1',
    enquiryId: 'enquiry-99'
  };

  const tx = {
    chatRoom: {
      findFirst: async ({ where }) => {
        assert.deepEqual(where, {
          enquiryId: 'enquiry-99'
        });
        return existingRoom;
      }
    }
  };

  const room = await ensureChatRoomForBooking(tx, {
    plannerId: 'planner-1',
    vendorId: 'vendor-1',
    enquiryId: 'enquiry-99'
  });

  assert.equal(room.id, 'room-123');
});

test('ensureChatRoomForBooking creates a room when none exists', async () => {
  const createdRoom = {
    id: 'room-456',
    plannerId: 'planner-2',
    vendorId: 'vendor-2',
    enquiryId: 'enquiry-100'
  };

  const tx = {
    chatRoom: {
      findFirst: async () => null,
      create: async ({ data }) => {
        assert.equal(data.enquiryId, 'enquiry-100');
        assert.equal(data.plannerId, 'planner-2');
        assert.equal(data.vendorId, 'vendor-2');
        return createdRoom;
      }
    }
  };

  const room = await ensureChatRoomForBooking(tx, {
    plannerId: 'planner-2',
    vendorId: 'vendor-2',
    enquiryId: 'enquiry-100'
  });

  assert.equal(room.id, 'room-456');
});
