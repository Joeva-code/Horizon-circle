/**
 * Maxify Service
 * 
 * Provider abstraction layer for Maxify Tickets integration.
 * 
 * Selects provider based on MAXIFY_INTEGRATION_MODE environment variable:
 * - 'demo': Uses MaxifyDemoProvider (deterministic demo data)
 * - 'production': Uses MaxifyApiProvider (real Maxify API calls)
 * 
 * The frontend and application code never know which provider is active.
 * All provider selection happens server-side.
 */

import { ENV } from '../../config/env.js';
import demoProvider from './providers/demoProvider.js';

// Conditionally import production provider to avoid errors if axios is not installed
let apiProvider = null;
try {
  const apiModule = await import('./providers/apiProvider.js');
  apiProvider = apiModule.default;
} catch (error) {
  console.warn('[Maxify] API provider not available:', error.message);
}

/**
 * Get the active provider based on configuration
 */
const getProvider = () => {
  const mode = ENV.MAXIFY_INTEGRATION_MODE || 'demo';
  
  switch (mode) {
    case 'production':
      if (!apiProvider) {
        throw new Error(
          'Maxify API provider is not available. ' +
          'Please install axios or switch to demo mode by setting MAXIFY_INTEGRATION_MODE=demo.'
        );
      }
      return apiProvider;
      
    case 'demo':
    default:
      return demoProvider;
  }
};

/**
 * Maxify Service - Public API
 * 
 * All methods delegate to the active provider.
 * The frontend should call these methods without knowing which provider is active.
 */

/**
 * Create an event in Maxify
 */
export const createEvent = async (eventData) => {
  const provider = getProvider();
  return provider.createEvent(eventData);
};

/**
 * Get event details from Maxify
 */
export const getEvent = async (eventId) => {
  const provider = getProvider();
  return provider.getEvent(eventId);
};

/**
 * Create a ticket type in Maxify
 */
export const createTicketType = async (eventId, ticketTypeData) => {
  const provider = getProvider();
  return provider.createTicketType(eventId, ticketTypeData);
};

/**
 * Get ticket statistics from Maxify
 */
export const getTicketStats = async (eventId) => {
  const provider = getProvider();
  return provider.getTicketStats(eventId);
};

/**
 * Get guest statistics from Maxify
 */
export const getGuestStats = async (eventId) => {
  const provider = getProvider();
  return provider.getGuestStats(eventId);
};

/**
 * Check in a guest via Maxify
 */
export const checkInGuest = async (eventId, ticketCode) => {
  const provider = getProvider();
  return provider.checkInGuest(eventId, ticketCode);
};

/**
 * Get attendance data from Maxify
 */
export const getAttendance = async (eventId) => {
  const provider = getProvider();
  return provider.getAttendance(eventId);
};

/**
 * Get event URL from Maxify
 */
export const getEventUrl = async (eventId) => {
  const provider = getProvider();
  return provider.getEventUrl(eventId);
};

/**
 * Get integration mode information for UI
 */
export const getIntegrationInfo = () => {
  const mode = ENV.MAXIFY_INTEGRATION_MODE || 'demo';
  
  return {
    mode,
    isDemo: mode === 'demo',
    isProduction: mode === 'production',
    providerName: mode === 'demo' ? 'Partner Demo Environment' : 'Maxify API',
    description: mode === 'demo'
      ? 'This prototype demonstrates the proposed EventConnect × Maxify Tickets workflow. Production API integration requires partner credentials.'
      : 'Connected to Maxify Tickets API',
  };
};

/**
 * Reset demo state (only works in demo mode)
 */
export const resetDemoState = () => {
  if (ENV.MAXIFY_INTEGRATION_MODE !== 'demo') {
    throw new Error('resetDemoState can only be called in demo mode');
  }
  return demoProvider.resetDemoState();
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
  getIntegrationInfo,
  resetDemoState,
};
