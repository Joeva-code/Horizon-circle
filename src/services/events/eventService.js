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
    const { plannerId: _plannerId, ...sanitizedEventData } = eventData;
    const event = await prisma.event.create({
      data: {
        ...sanitizedEventData,
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
    const message = error instanceof Error ? error.message : 'Failed to create event';
    return { success: false, message, status: 400 };
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

/**
 * Get ticket stats for an event
 */
export const getEventTicketStats = async (eventId, userId) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, plannerId: userId },
      include: {
        tickets: true,
      },
    });

    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }

    const tickets = event.tickets || [];
    const ticketTypeMap = new Map();

    for (const ticket of tickets) {
      const type = ticket.ticketType || 'General';
      if (!ticketTypeMap.has(type)) {
        ticketTypeMap.set(type, {
          id: type.toLowerCase().replace(/\s+/g, '-'),
          name: type,
          price: 0,
          currency: 'NGN',
          totalSold: 0,
          maxCapacity: event.guestCount || 0,
          revenue: 0,
          percentageSold: 0,
        });
      }
      const stats = ticketTypeMap.get(type);
      stats.totalSold += 1;
    }

    const ticketTypes = Array.from(ticketTypeMap.values());
    const totalSold = tickets.length;
    const totalCapacity = event.guestCount || 0;
    const percentageSold = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0;

    return {
      success: true,
      data: {
        eventId: event.id,
        ticketTypes,
        totalSold,
        totalRevenue: 0,
        totalCapacity,
        percentageSold,
      },
    };
  } catch (error) {
    console.error('Get ticket stats error:', error);
    return { success: false, message: 'Failed to fetch ticket stats' };
  }
};

/**
 * Get attendance data for an event
 */
export const getEventAttendance = async (eventId, userId) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, plannerId: userId },
      include: {
        tickets: true,
        checkIns: true,
      },
    });

    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }

    const tickets = event.tickets || [];
    const checkIns = event.checkIns || [];
    const checkedInCount = checkIns.length;

    const byTicketType = {
      Regular: { total: 0, checkedIn: 0 },
      VIP: { total: 0, checkedIn: 0 },
    };

    for (const ticket of tickets) {
      const type = ticket.ticketType || 'Regular';
      const key = byTicketType[type] ? type : 'Regular';
      byTicketType[key].total += 1;
      if (ticket.checkedInAt) {
        byTicketType[key].checkedIn += 1;
      }
    }

    const registered = tickets.length;
    const notCheckedIn = registered - checkedInCount;
    const attendanceRate = registered > 0 ? Math.round((checkedInCount / registered) * 100) : 0;

    return {
      success: true,
      data: {
        eventId: event.id,
        summary: {
          registered,
          checkedIn: checkedInCount,
          notCheckedIn,
          attendanceRate,
        },
        byTicketType,
        recentCheckIns: checkIns.slice(0, 20).map((checkIn) => ({
          id: checkIn.id,
          ticketCode: checkIn.ticket?.ticketCode,
          attendeeName: checkIn.ticket?.purchaserName,
          ticketType: checkIn.ticket?.ticketType,
          checkedInAt: checkIn.timestamp,
          method: checkIn.method,
        })),
      },
    };
  } catch (error) {
    console.error('Get attendance error:', error);
    return { success: false, message: 'Failed to fetch attendance' };
  }
};

/**
 * Get analytics for an event
 */
export const getEventAnalyticsData = async (eventId, userId) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, plannerId: userId },
      include: {
        analytics: true,
        tickets: true,
        checkIns: true,
      },
    });

    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }

    const tickets = event.tickets || [];
    const checkIns = event.checkIns || [];
    const totalTickets = tickets.length;
    const totalCheckedIn = checkIns.length;
    const attendanceRate = totalTickets > 0 ? Math.round((totalCheckedIn / totalTickets) * 100) : 0;

    let analytics = event.analytics;
    if (!analytics) {
      analytics = await prisma.eventAnalytics.create({
        data: {
          eventId: event.id,
          totalTickets,
          totalCheckedIn,
          attendanceRate,
        },
      });
    }

    return {
      success: true,
      data: {
        id: analytics.id,
        eventId: event.id,
        totalTickets,
        totalCheckedIn,
        attendanceRate,
        generatedAt: analytics.generatedAt,
      },
    };
  } catch (error) {
    console.error('Get analytics error:', error);
    return { success: false, message: 'Failed to fetch analytics' };
  }
};

/**
 * Get guest stats for an event
 */
export const getEventGuestStats = async (eventId, userId) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, plannerId: userId },
      include: {
        tickets: true,
        checkIns: true,
      },
    });

    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }

    const tickets = event.tickets || [];
    const checkIns = event.checkIns || [];
    const registered = tickets.length;
    const checkedIn = checkIns.length;
    const notCheckedIn = registered - checkedIn;
    const attendanceRate = registered > 0 ? Math.round((checkedIn / registered) * 100) : 0;

    return {
      success: true,
      data: {
        eventId: event.id,
        expectedGuests: event.guestCount || 0,
        registered,
        checkedIn,
        notCheckedIn,
        attendanceRate,
      },
    };
  } catch (error) {
    console.error('Get guest stats error:', error);
    return { success: false, message: 'Failed to fetch guest stats' };
  }
};

/**
 * Get the raw ticket list for an event (planner-owned only)
 */
export const getEventTickets = async (eventId, userId) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, plannerId: userId },
      include: {
        tickets: {
          orderBy: { purchaseDate: 'asc' },
        },
      },
    });

    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }

    return { success: true, data: event.tickets || [] };
  } catch (error) {
    console.error('Get event tickets error:', error);
    return { success: false, message: 'Failed to fetch event tickets' };
  }
};

/**
 * Sync an event's MaxifyTickets integration state.
 * Refreshes maxifySyncedAt and pulls latest stats from the active provider
 * without fabricating a successful external response.
 */
export const syncMaxifyEvent = async (eventId, userId) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, plannerId: userId },
    });

    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }

    if (!event.maxifyEventId) {
      return {
        success: false,
        message: 'Event is not connected to MaxifyTickets yet. Connect it first.',
        status: 400,
      };
    }

    // Attempt to refresh from the provider. In production this is a real API
    // call; in demo mode it resolves to deterministic demo data. A provider
    // failure is surfaced (not silently turned into a fake success).
    try {
      await maxifyService.getTicketStats(event.maxifyEventId);
      await maxifyService.getAttendance(event.maxifyEventId);
    } catch (error) {
      console.warn('[Maxify] Sync refresh failed:', error.message);
      return {
        success: false,
        message: error.message || 'Failed to sync with MaxifyTickets',
        status: 502,
      };
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
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

    return { success: true, message: 'Synced successfully', data: updated };
  } catch (error) {
    console.error('Sync Maxify event error:', error);
    return { success: false, message: 'Failed to sync event with Maxify' };
  }
};

/**
 * Connect / create a MaxifyTickets record for a planner-owned event.
 * If already connected, just refreshes the sync timestamp.
 */
export const connectMaxifyEvent = async (eventId, userId) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, plannerId: userId },
    });

    if (!event) {
      return { success: false, message: 'Event not found', status: 404 };
    }

    if (event.maxifyEventId) {
      const alreadyConnected = await prisma.event.update({
        where: { id: eventId },
        data: { maxifySyncedAt: new Date() },
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
      return { success: true, message: 'Event already connected to MaxifyTickets', data: alreadyConnected };
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
        maxifyEventId: maxifyResult.data.id,
        maxifyEventUrl: maxifyResult.data.url || maxifyResult.data.maxifyEventUrl || null,
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

    return { success: true, message: 'Connected to MaxifyTickets', data: updated };
  } catch (error) {
    console.error('Connect Maxify event error:', error);
    return { success: false, message: 'Failed to connect event with Maxify' };
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
  getEventTickets,
  getEventTicketStats,
  getEventAttendance,
  getEventAnalyticsData,
  getEventGuestStats,
  syncMaxifyEvent,
  connectMaxifyEvent,
};






