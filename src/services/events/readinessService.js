/**
 * Event Readiness Service
 * 
 * Calculates event readiness scores based on completion criteria.
 */

/**
 * Calculate event readiness score (0-100)
 * 
 * Criteria:
 * - Event details complete (name, date, location, type): 25 points
 * - Guest count set: 10 points
 * - At least 1 vendor confirmed: 20 points
 * - At least 2 vendors confirmed: +10 points (30 total)
 * - At least 3 vendors confirmed: +10 points (40 total)
 * - Ticket types created: 25 points
 * - Event launched with Maxify: 25 points
 * 
 * Total: 100 points
 */
export const calculateReadinessScore = async (eventId) => {
  const { prisma } = await import('../config/database.js');
  
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      eventVendors: true,
      tickets: true,
    },
  });
  
  if (!event) {
    return {
      success: false,
      message: 'Event not found',
    };
  }
  
  let score = 0;
  const checks = [];
  
  // 1. Event details complete (25 points)
  const hasBasicDetails = 
    event.name &&
    event.eventDate &&
    event.location &&
    event.eventType;
  
  if (hasBasicDetails) {
    score += 25;
    checks.push({ name: 'Basic Details', passed: true, points: 25 });
  } else {
    checks.push({ 
      name: 'Basic Details', 
      passed: false, 
      points: 25,
      message: 'Missing: name, date, location, or event type'
    });
  }
  
  // 2. Guest count set (10 points)
  if (event.guestCount && event.guestCount > 0) {
    score += 10;
    checks.push({ name: 'Guest Count', passed: true, points: 10 });
  } else {
    checks.push({ name: 'Guest Count', passed: false, points: 10, message: 'Guest count not set' });
  }
  
  // 3. Vendors confirmed (40 points max)
  const confirmedVendors = event.eventVendors.filter(v => v.status === 'CONFIRMED').length;
  
  if (confirmedVendors >= 1) {
    score += 20;
    checks.push({ name: 'At least 1 vendor', passed: true, points: 20 });
  } else {
    checks.push({ name: 'At least 1 vendor', passed: false, points: 20, message: 'No vendors confirmed' });
  }
  
  if (confirmedVendors >= 2) {
    score += 10;
    checks.push({ name: 'At least 2 vendors', passed: true, points: 10 });
  }
  
  if (confirmedVendors >= 3) {
    score += 10;
    checks.push({ name: 'At least 3 vendors', passed: true, points: 10 });
  }
  
  // 4. Ticket types created (25 points)
  const hasTickets = event.tickets.length > 0;
  
  if (hasTickets) {
    score += 25;
    checks.push({ name: 'Ticket Types Created', passed: true, points: 25 });
  } else {
    checks.push({ name: 'Ticket Types Created', passed: false, points: 25, message: 'No ticket types created' });
  }
  
  // 5. Event launched with Maxify (25 points)
  if (event.maxifyEventId) {
    score += 25;
    checks.push({ name: 'Launched with Maxify', passed: true, points: 25 });
  } else {
    checks.push({ name: 'Launched with Maxify', passed: false, points: 25, message: 'Not launched yet' });
  }
  
  // Cap at 100
  score = Math.min(score, 100);
  
  // Determine status based on score
  let status = 'DRAFT';
  if (score >= 80) {
    status = 'READY';
  } else if (event.maxifyEventId) {
    status = 'LAUNCHED';
  }
  
  return {
    success: true,
    data: {
      score,
      status,
      checks,
      isReady: score >= 80,
    },
  };
};

/**
 * Get readiness level description
 */
export const getReadinessLevel = (score) => {
  if (score >= 90) return { level: 'Excellent', color: 'green', message: 'Your event is ready to launch!' };
  if (score >= 80) return { level: 'Good', color: 'blue', message: 'Your event is ready to launch.' };
  if (score >= 60) return { level: 'Fair', color: 'yellow', message: 'Almost there! Complete the remaining items.' };
  if (score >= 40) return { level: 'Poor', color: 'orange', message: 'More work needed before launch.' };
  return { level: 'Critical', color: 'red', message: 'Event setup incomplete.' };
};

export default {
  calculateReadinessScore,
  getReadinessLevel,
};
