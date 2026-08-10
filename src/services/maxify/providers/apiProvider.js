/**
 * Maxify API Provider
 * 
 * Production implementation for Maxify Tickets API integration.
 * 
 * This is a STUB implementation awaiting official Maxify API documentation and credentials.
 * DO NOT use in production until Maxify partner credentials are configured.
 * 
 * Required environment variables:
 * - MAXIFY_API_KEY
 * - MAXIFY_API_URL
 * - MAXIFY_WEBHOOK_SECRET (optional)
 */

import axios from 'axios';

// Validate configuration on load
const validateConfig = () => {
  const apiKey = process.env.MAXIFY_API_KEY;
  const apiUrl = process.env.MAXIFY_API_URL;
  
  if (!apiKey || !apiUrl) {
    throw new Error(
      'Maxify API provider requires MAXIFY_API_KEY and MAXIFY_API_URL environment variables. ' +
      'Please configure these or switch to demo mode by setting MAXIFY_INTEGRATION_MODE=demo.'
    );
  }
};

// Lazy validation - only validate when a method is called
let configValidated = false;

const ensureConfigValid = () => {
  if (!configValidated) {
    validateConfig();
    configValidated = true;
  }
};

const maxifyClient = axios.create({
  baseURL: process.env.MAXIFY_API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.MAXIFY_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging (development only)
if (process.env.NODE_ENV === 'development') {
  maxifyClient.interceptors.request.use((config) => {
    console.log(`[Maxify API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  });
}

/**
 * Create event via Maxify API
 */
export const createEvent = async (eventData) => {
  ensureConfigValid();
  
  try {
    const response = await maxifyClient.post('/events', eventData);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Maxify API createEvent error:', error.message);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to create event via Maxify API',
    };
  }
};

/**
 * Get event via Maxify API
 */
export const getEvent = async (eventId) => {
  ensureConfigValid();
  
  try {
    const response = await maxifyClient.get(`/events/${eventId}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Maxify API getEvent error:', error.message);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch event from Maxify API',
    };
  }
};

/**
 * Create ticket type via Maxify API
 */
export const createTicketType = async (eventId, ticketTypeData) => {
  ensureConfigValid();
  
  try {
    const response = await maxifyClient.post(`/events/${eventId}/ticket-types`, ticketTypeData);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Maxify API createTicketType error:', error.message);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to create ticket type via Maxify API',
    };
  }
};

/**
 * Get ticket statistics via Maxify API
 */
export const getTicketStats = async (eventId) => {
  ensureConfigValid();
  
  try {
    const response = await maxifyClient.get(`/events/${eventId}/tickets/stats`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Maxify API getTicketStats error:', error.message);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch ticket stats from Maxify API',
    };
  }
};

/**
 * Get guest statistics via Maxify API
 */
export const getGuestStats = async (eventId) => {
  ensureConfigValid();
  
  try {
    const response = await maxifyClient.get(`/events/${eventId}/guests/stats`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Maxify API getGuestStats error:', error.message);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch guest stats from Maxify API',
    };
  }
};

/**
 * Check in guest via Maxify API
 */
export const checkInGuest = async (eventId, ticketCode) => {
  ensureConfigValid();
  
  try {
    const response = await maxifyClient.post(`/events/${eventId}/check-in`, { ticketCode });
    return {
      success: true,
      message: 'Check-in successful',
      data: response.data,
    };
  } catch (error) {
    console.error('Maxify API checkInGuest error:', error.message);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to check in guest via Maxify API',
    };
  }
};

/**
 * Get attendance via Maxify API
 */
export const getAttendance = async (eventId) => {
  ensureConfigValid();
  
  try {
    const response = await maxifyClient.get(`/events/${eventId}/attendance`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Maxify API getAttendance error:', error.message);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch attendance from Maxify API',
    };
  }
};

/**
 * Get event URL via Maxify API
 */
export const getEventUrl = async (eventId) => {
  ensureConfigValid();
  
  try {
    const response = await maxifyClient.get(`/events/${eventId}/url`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Maxify API getEventUrl error:', error.message);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch event URL from Maxify API',
    };
  }
};

export default {
  createEvent,
  getEvent,
  createTicketType,
  getTicketStats,
  getGuestStats,
  checkInGuest,
  getAttendance,
  getEventUrl,
};
