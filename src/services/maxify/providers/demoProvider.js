/**
 * Maxify Demo Provider
 * 
 * Provides deterministic demo data for TechConnect Lagos 2026.
 * This simulates Maxify Tickets functionality for demo/prototype purposes.
 * 
 * DO NOT use in production. This is not a real Maxify API integration.
 */

// Demo event configuration
export const DEMO_EVENT = {
  id: 'techconnect-lagos-2026',
  name: 'TechConnect Lagos 2026',
  description: 'The premier tech conference bringing together developers, designers, and tech enthusiasts from across Nigeria and beyond.',
  eventType: 'Conference',
  expectedGuests: 500,
  eventDate: new Date('2026-12-15T09:00:00Z'),
  location: 'Lagos, Nigeria',
};

// Demo ticket types
export const DEMO_TICKET_TYPES = [
  {
    id: 'regular',
    name: 'Regular',
    price: 20000, // N20,000
    currency: 'NGN',
    totalSold: 184,
    maxCapacity: 400,
  },
  {
    id: 'vip',
    name: 'VIP',
    price: 50000, // N50,000
    currency: 'NGN',
    totalSold: 100,
    maxCapacity: 100,
  },
];

// Demo state (persisted in memory)
let demoState = {
  checkedIn: 230,
  guestList: [],
};

// Initialize demo guest list
const initializeDemoGuests = () => {
  const firstNames = ['Ada', 'Chidi', 'Fatima', 'Emeka', 'Ngozi', 'Oluwaseun', 'Amara', 'Kemi', 'Tunde', 'Funke'];
  const lastNames = ['Okonkwo', 'Adebayo', 'Eze', 'Nwosu', 'Okafor', 'Balogun', 'Adeyemi', 'Ibrahim', 'Ogunleye', 'Bello'];
  
  demoState.guestList = [];
  
  for (let i = 1; i <= 284; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const ticketType = i <= 184 ? 'Regular' : 'VIP';
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
    
    demoState.guestList.push({
      id: `guest-${i}`,
      firstName,
      lastName,
      email,
      ticketType,
      ticketCode: `TC2026-${ticketType.toUpperCase()}-${String(i).padStart(4, '0')}`,
      checkedIn: i <= 230,
      checkedInAt: i <= 230 ? new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString() : null,
      purchaseDate: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
    });
  }
  
  demoState.guestList.sort((a, b) => {
    if (a.checkedIn && !b.checkedIn) return -1;
    if (!a.checkedIn && b.checkedIn) return 1;
    return a.lastName.localeCompare(b.lastName);
  });
};

// Initialize on load
initializeDemoGuests();

/**
 * Create a demo event
 */
export const createEvent = async (eventData) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return {
    success: true,
    data: {
      ...DEMO_EVENT,
      ...eventData,
      id: eventData.id || DEMO_EVENT.id,
      status: 'LAUNCHED',
      maxifyEventId: `maxify-${DEMO_EVENT.id}`,
      maxifyEventUrl: `https://demo.maxify.tickets/event/${DEMO_EVENT.id}`,
      maxifyMode: 'demo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
};

/**
 * Get demo event details
 */
export const getEvent = async (eventId) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const registered = demoState.guestList.length;
  const checkedIn = demoState.checkedIn;
  const attendanceRate = registered > 0 ? (checkedIn / registered) * 100 : 0;
  
  return {
    success: true,
    data: {
      ...DEMO_EVENT,
      id: eventId || DEMO_EVENT.id,
      registered,
      checkedIn,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      maxifyEventUrl: `https://demo.maxify.tickets/event/${eventId || DEMO_EVENT.id}`,
      maxifyMode: 'demo',
    },
  };
};

/**
 * Create ticket type (demo - acknowledges)
 */
export const createTicketType = async (eventId, ticketTypeData) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  return {
    success: true,
    data: {
      ...ticketTypeData,
      id: ticketTypeData.id || `ticket-${Date.now()}`,
      eventId,
      totalSold: 0,
    },
  };
};

/**
 * Get ticket statistics
 */
export const getTicketStats = async (eventId) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const totalSold = DEMO_TICKET_TYPES.reduce((sum, type) => sum + type.totalSold, 0);
  const totalRevenue = DEMO_TICKET_TYPES.reduce((sum, type) => sum + (type.price * type.totalSold), 0);
  
  return {
    success: true,
    data: {
      eventId: eventId || DEMO_EVENT.id,
      ticketTypes: DEMO_TICKET_TYPES.map(type => ({
        ...type,
        revenue: type.price * type.totalSold,
        percentageSold: Math.round((type.totalSold / type.maxCapacity) * 100),
      })),
      totalSold,
      totalRevenue,
      totalCapacity: DEMO_TICKET_TYPES.reduce((sum, type) => sum + type.maxCapacity, 0),
      percentageSold: Math.round((totalSold / DEMO_EVENT.expectedGuests) * 100),
    },
  };
};

/**
 * Get guest statistics
 */
export const getGuestStats = async (eventId) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const registered = demoState.guestList.length;
  const checkedIn = demoState.checkedIn;
  const attendanceRate = registered > 0 ? (checkedIn / registered) * 100 : 0;
  
  return {
    success: true,
    data: {
      eventId: eventId || DEMO_EVENT.id,
      expectedGuests: DEMO_EVENT.expectedGuests,
      registered,
      checkedIn,
      notCheckedIn: registered - checkedIn,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
    },
  };
};

/**
 * Check in a guest (demo - modifies state)
 */
export const checkInGuest = async (eventId, ticketCode) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const guest = demoState.guestList.find(g => g.ticketCode === ticketCode);
  
  if (!guest) {
    return {
      success: false,
      message: 'Ticket not found',
    };
  }
  
  if (guest.checkedIn) {
    return {
      success: false,
      message: 'Guest already checked in',
      data: {
        ...guest,
        alreadyCheckedIn: true,
      },
    };
  }
  
  guest.checkedIn = true;
  guest.checkedInAt = new Date().toISOString();
  demoState.checkedIn++;
  
  return {
    success: true,
    message: 'Check-in successful',
    data: {
      ...guest,
      checkedIn: true,
      checkedInAt: guest.checkedInAt,
    },
  };
};

/**
 * Get attendance data
 */
export const getAttendance = async (eventId) => {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const registered = demoState.guestList.length;
  const checkedIn = demoState.checkedIn;
  const attendanceRate = registered > 0 ? (checkedIn / registered) * 100 : 0;
  
  const byTicketType = {
    Regular: demoState.guestList.filter(g => g.ticketType === 'Regular'),
    VIP: demoState.guestList.filter(g => g.ticketType === 'VIP'),
  };
  
  return {
    success: true,
    data: {
      eventId: eventId || DEMO_EVENT.id,
      summary: {
        registered,
        checkedIn,
        notCheckedIn: registered - checkedIn,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
      },
      byTicketType: {
        Regular: {
          total: byTicketType.Regular.length,
          checkedIn: byTicketType.Regular.filter(g => g.checkedIn).length,
        },
        VIP: {
          total: byTicketType.VIP.length,
          checkedIn: byTicketType.VIP.filter(g => g.checkedIn).length,
        },
      },
      recentCheckIns: demoState.guestList
        .filter(g => g.checkedIn)
        .sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt))
        .slice(0, 10)
        .map(g => ({
          id: g.id,
          name: `${g.firstName} ${g.lastName}`,
          ticketType: g.ticketType,
          checkedInAt: g.checkedInAt,
        })),
    },
  };
};

/**
 * Get event URL (demo)
 */
export const getEventUrl = async (eventId) => {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    success: true,
    data: {
      eventId: eventId || DEMO_EVENT.id,
      url: `https://demo.maxify.tickets/event/${eventId || DEMO_EVENT.id}`,
      mode: 'demo',
    },
  };
};

/**
 * Reset demo state (for testing)
 */
export const resetDemoState = () => {
  demoState.checkedIn = 230;
  initializeDemoGuests();
};

/**
 * Get demo event configuration
 */
export const getDemoEventConfig = () => {
  return {
    ...DEMO_EVENT,
    ticketTypes: DEMO_TICKET_TYPES,
  };
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
  resetDemoState,
  getDemoEventConfig,
};




