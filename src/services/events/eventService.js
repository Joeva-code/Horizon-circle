/**
 * Event Service
 * 
 * Core event business logic combining database operations with Maxify integration.
 */

import { prisma } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { calculateReadinessScore } from './readinessService.js';
import * as maxifyService from '../maxify/maxifyService.js';

/**
 * Create a new event
 */
export const createEvent = async (plannerId, eventData) => {
  try {
    const event = await prisma.event.create({
      data: {
        ...eventData,
        plannerId,
        status: 'DRAFT',
        readinessScore: 0,
      },
      include: {
        planner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    
    return { success: true, data: event };
  } catch (error) {
    console.error('Create event error:', error);
    return { success: false, message: 'Failed to create event' };
  }
};

/**
 * Get event by ID
 */
export const getEventById = async (eventId, userId) => {
  try {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        OR: [
          { plannerId: userId },
        ],
      },
      include: {
        planner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        eventVendors: {
          include: {
            vendor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        tickets: true,
        analytics: true,
      },
    });
    
    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }
    
    return { success: true, data: event };
  } catch (error) {
    console.error('Get event error:', error);
    return { success: false, message: 'Failed to fetch event' };
  }
};

/**
 * List events for a planner
 */
export const listPlannerEvents = async (plannerId, filters = {}) => {
  try {
    const where = { plannerId };
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    const events = await prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        eventVendors: {
          where: { status: 'CONFIRMED' },
        },
        tickets: true,
        analytics: true,
      },
    });
    
    return { success: true, data: events };
  } catch (error) {
    console.error('List events error:', error);
    return { success: false, message: 'Failed to fetch events' };
  }
};

/**
 * Update event
 */
export const updateEvent = async (eventId, userId, updateData) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, plannerId: userId },
    });
    
    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }
    
    const updated = await prisma.event.update({
      where: { id: eventId },
      data: updateData,
      include: {
        planner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    
    return { success: true, data: updated };
  } catch (error) {
    console.error('Update event error:', error);
    return { success: false, message: 'Failed to update event' };
  }
};

/**
 * Add vendor to event
 */
export const addVendorToEvent = async (eventId, userId, vendorId, enquiryId) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, plannerId: userId },
    });
    
    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }
    
    if (enquiryId) {
      const enquiry = await prisma.enquiry.findFirst({
        where: {
          id: enquiryId,
          plannerId: userId,
          status: 'BOOKED',
        },
      });
      
      if (!enquiry) {
        return { success: false, message: 'Enquiry not found or not booked', status: 404 };
      }
    }
    
    const eventVendor = await prisma.eventVendor.create({
      data: {
        eventId,
        vendorId,
        enquiryId,
        status: 'CONFIRMED',
      },
      include: {
        vendor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    
    return { success: true, data: eventVendor };
  } catch (error) {
    console.error('Add vendor to event error:', error);
    return { success: false, message: 'Failed to add vendor to event' };
  }
};

/**
 * Remove vendor from event
 */
export const removeVendorFromEvent = async (eventId, userId, vendorId) => {
  try {
    const result = await prisma.eventVendor.deleteMany({
      where: {
        eventId,
        vendorId,
        event: { plannerId: userId },
      },
    });
    
    if (result.count === 0) {
      return { success: false, message: 'Vendor not found in event', status: 404 };
    }
    
    return { success: true, message: 'Vendor removed from event' };
  } catch (error) {
    console.error('Remove vendor from event error:', error);
    return { success: false, message: 'Failed to remove vendor from event' };
  }
};

/**
 * Launch event with Maxify
 */
export const launchEventWithMaxify = async (eventId, userId) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, plannerId: userId },
      include: {
        eventVendors: true,
        tickets: true,
      },
    });
    
    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }
    
    if (event.status === 'LAUNCHED' || event.status === 'COMPLETED') {
      return { success: false, message: 'Event already launched', status: 400 };
    }
    
    const readinessResult = await calculateReadinessScore(eventId);
    if (!readinessResult.success) {
      return readinessResult;
    }
    
    if (!readinessResult.data.isReady) {
      return {
        success: false,
        message: 'Event is not ready to launch',
        data: readinessResult.data,
        status: 400,
      };
    }
    
    const maxifyResult = await maxifyService.createEvent({
      name: event.name,
      description: event.description,
      eventType: event.eventType,
      eventDate: event.eventDate.toISOString(),
      location: event.location,
      expectedGuests: event.guestCount,
    });
    
    if (!maxifyResult.success) {
      return maxifyResult;
    }
    
    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        status: 'LAUNCHED',
        maxifyEventId: maxifyResult.data.id,
        maxifyEventUrl: maxifyResult.data.url || maxifyResult.data.maxifyEventUrl,
        maxifySyncedAt: new Date(),
        maxifyMode: ENV.MAXIFY_INTEGRATION_MODE || 'demo',
      },
      include: {
        planner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    
    return { success: true, data: updated };
  } catch (error) {
    console.error('Launch event error:', error);
    return { success: false, message: 'Failed to launch event' };
  }
};

/**
 * Get event readiness
 */
export const getEventReadiness = async (eventId, userId) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, plannerId: userId },
    });
    
    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }
    
    const readinessResult = await calculateReadinessScore(eventId);
    if (!readinessResult.success) {
      return readinessResult;
    }
    
    await prisma.event.update({
      where: { id: eventId },
      data: { readinessScore: readinessResult.data.score },
    });
    
    return readinessResult;
  } catch (error) {
    console.error('Get event readiness error:', error);
    return { success: false, message: 'Failed to calculate readiness' };
  }
};

/**
 * Get Maxify integration info for an event
 */
export const getMaxifyIntegrationInfo = async (eventId, userId) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, plannerId: userId },
    });
    
    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }
    
    const integrationInfo = maxifyService.getIntegrationInfo();
    
    return {
      success: true,
      data: {
        ...integrationInfo,
        event: {
          id: event.id,
          name: event.name,
          status: event.status,
          maxifyEventId: event.maxifyEventId,
          maxifyEventUrl: event.maxifyEventUrl,
          maxifySyncedAt: event.maxifySyncedAt,
          maxifyMode: event.maxifyMode,
        },
      },
    };
  } catch (error) {
    console.error('Get Maxify integration info error:', error);
    return { success: false, message: 'Failed to fetch integration info' };
  }
};

export default {
  createEvent,
  getEventById,
  listPlannerEvents,
  updateEvent,
  addVendorToEvent,
  removeVendorFromEvent,
  launchEventWithMaxify,
  getEventReadiness,
  getMaxifyIntegrationInfo,
};






