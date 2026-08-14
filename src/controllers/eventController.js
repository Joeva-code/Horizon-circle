/**
 * Event Controller
 * 
 * Handles HTTP requests for event operations.
 */

import eventService from '../services/events/eventService.js';

// @desc    Create a new event
// @route   POST /api/events
// @access  Private (Planner only)
export const createEvent = async (req, res) => {
  try {
    const plannerId = req.user.id;
    const eventData = req.body;
    
    const result = await eventService.createEvent(plannerId, eventData);
    
    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }
    
    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: result.data,
    });
  } catch (error) {
    console.error('Create event controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create event',
    });
  }
};

// @desc    Get event by ID
// @route   GET /api/events/:id
// @access  Private (Planner only)
export const getEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await eventService.getEventById(id, userId);
    
    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }
    
    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get event controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch event',
    });
  }
};

// @desc    List events for planner
// @route   GET /api/events
// @access  Private (Planner only)
export const listEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;
    
    const result = await eventService.listPlannerEvents(userId, { status });
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message,
      });
    }
    
    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('List events controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
    });
  }
};

// @desc    Update event
// @route   PATCH /api/events/:id
// @access  Private (Planner only)
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;
    
    const result = await eventService.updateEvent(id, userId, updateData);
    
    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: result.data,
    });
  } catch (error) {
    console.error('Update event controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update event',
    });
  }
};

// @desc    Add vendor to event
// @route   POST /api/events/:id/vendors
// @access  Private (Planner only)
export const addVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { vendorId, enquiryId } = req.body;
    
    const result = await eventService.addVendorToEvent(id, userId, vendorId, enquiryId);
    
    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }
    
    return res.status(201).json({
      success: true,
      message: 'Vendor added to event',
      data: result.data,
    });
  } catch (error) {
    console.error('Add vendor controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add vendor to event',
    });
  }
};

// @desc    Remove vendor from event
// @route   DELETE /api/events/:id/vendors/:vendorId
// @access  Private (Planner only)
export const removeVendor = async (req, res) => {
  try {
    const { id, vendorId } = req.params;
    const userId = req.user.id;
    
    const result = await eventService.removeVendorFromEvent(id, userId, vendorId);
    
    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }
    
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Remove vendor controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove vendor from event',
    });
  }
};

// @desc    Get event readiness
// @route   GET /api/events/:id/readiness
// @access  Private (Planner only)
export const getReadiness = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await eventService.getEventReadiness(id, userId);
    
    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }
    
    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get readiness controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate readiness',
    });
  }
};

// @desc    Launch event with Maxify
// @route   POST /api/events/:id/launch
// @access  Private (Planner only)
export const launchEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await eventService.launchEventWithMaxify(id, userId);
    
    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
        data: result.data,
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Event launched successfully',
      data: result.data,
    });
  } catch (error) {
    console.error('Launch event controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to launch event',
    });
  }
};

// @desc    Get Maxify integration info
// @route   GET /api/events/:id/maxify/info
// @access  Private (Planner only)
export const getMaxifyInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await eventService.getMaxifyIntegrationInfo(id, userId);

    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get Maxify info controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Maxify integration info',
    });
  }
};

// @desc    Get ticket stats for an event
// @route   GET /api/events/:id/ticket-stats
// @access  Private (Planner only)
export const getTicketStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await eventService.getEventTicketStats(id, userId);

    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get ticket stats controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket stats',
    });
  }
};

// @desc    Get attendance data for an event
// @route   GET /api/events/:id/attendance
// @access  Private (Planner only)
export const getAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await eventService.getEventAttendance(id, userId);

    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get attendance controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance',
    });
  }
};

// @desc    Get analytics for an event
// @route   GET /api/events/:id/analytics
// @access  Private (Planner only)
export const getAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await eventService.getEventAnalyticsData(id, userId);

    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get analytics controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
    });
  }
};

// @desc    Get guest stats for an event
// @route   GET /api/events/:id/guest-stats
// @access  Private (Planner only)
export const getGuestStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await eventService.getEventGuestStats(id, userId);

    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get guest stats controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch guest stats',
    });
  }
};

// @desc    Get ticket list for an event
// @route   GET /api/events/:id/tickets
// @access  Private (Planner only)
export const getTickets = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await eventService.getEventTickets(id, userId);

    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get tickets controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
    });
  }
};

// @desc    Sync MaxifyTickets integration for an event
// @route   POST /api/events/:id/maxify/sync
// @access  Private (Planner only)
export const syncMaxify = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await eventService.syncMaxifyEvent(id, userId);

    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
        data: result.data,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error('Sync Maxify controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync event with Maxify',
    });
  }
};

// @desc    Connect MaxifyTickets for an event
// @route   POST /api/events/:id/maxify/connect
// @access  Private (Planner only)
export const connectMaxify = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await eventService.connectMaxifyEvent(id, userId);

    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error('Connect Maxify controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect event with Maxify',
    });
  }
};

export default {
  createEvent,
  getEvent,
  listEvents,
  updateEvent,
  addVendor,
  removeVendor,
  getReadiness,
  launchEvent,
  getMaxifyInfo,
  getTickets,
  getTicketStats,
  getAttendance,
  getAnalytics,
  getGuestStats,
  syncMaxify,
  connectMaxify,
};



