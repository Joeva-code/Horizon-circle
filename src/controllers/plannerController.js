import { prisma } from '../config/database.js';

const publicPlannerFields = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
  plannerProfile: true
};

// @desc    Get the signed-in planner profile
// @route   GET /api/planner/profile
// @access  Private (Planner only)
export const getProfile = async (req, res) => {
  try {
    const planner = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: publicPlannerFields
    });

    return res.status(200).json({ success: true, data: planner });
  } catch (error) {
    console.error('Get planner profile error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching planner profile' });
  }
};

// @desc    Update the signed-in planner profile
// @route   PUT /api/planner/profile
// @access  Private (Planner only)
export const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, avatar, phone, location, bio, preferredEventTypes } = req.body;
    const data = {};
    const profileData = {};

    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (avatar !== undefined) data.avatar = avatar;
    if (phone !== undefined) profileData.phone = phone;
    if (location !== undefined) profileData.location = location;
    if (bio !== undefined) profileData.bio = bio;
    if (preferredEventTypes !== undefined) profileData.preferredEventTypes = preferredEventTypes;

    if (Object.keys(data).length === 0 && Object.keys(profileData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one profile field to update'
      });
    }

    if (Object.keys(profileData).length > 0) {
      data.plannerProfile = {
        upsert: {
          create: profileData,
          update: profileData
        }
      };
    }

    const planner = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: publicPlannerFields
    });

    return res.status(200).json({
      success: true,
      message: 'Planner profile updated successfully',
      data: planner
    });
  } catch (error) {
    console.error('Update planner profile error:', error);
    return res.status(500).json({ success: false, message: 'Error updating planner profile' });
  }
};

// @desc    Get planner dashboard
// @route   GET /api/planner/dashboard
// @access  Private (Planner only)
export const getDashboard = async (req, res) => {
  try {
    const plannerId = req.user.id;
    const [
      planner,
      events,
      enquiries,
      allVendors,
      eventAnalyticsList,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: plannerId }, select: publicPlannerFields }),
      prisma.event.findMany({
        where: { plannerId },
        orderBy: { createdAt: 'desc' },
        include: {
          eventVendors: true,
          tickets: true,
          analytics: true,
        },
      }),
      prisma.enquiry.findMany({
        where: { plannerId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          vendor: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
          vendorProfile: { select: { id: true, businessName: true, category: true, location: true, profileImage: true } },
          chatRoom: { select: { id: true, createdAt: true, updatedAt: true } },
        },
      }),
      prisma.vendorProfile.findMany({
        where: { isPublished: true },
        select: { id: true, businessName: true, category: true, location: true, profileImage: true, averageRating: true, totalReviews: true },
        take: 50,
      }),
      prisma.eventAnalytics.findMany({ orderBy: { generatedAt: 'desc' } }),
    ]);

    const analyticsMap = new Map(eventAnalyticsList.map(a => [a.eventId, a]));

    const activeEvents = events.filter((e) => ['READY', 'LAUNCHED'].includes(e.status));
    const bookedEnquiries = enquiries.filter((e) => e.status === 'BOOKED');
    const openEnquiries = enquiries.filter((e) => e.status === 'NEW');
    const totalGuestsRegistered = events.reduce((sum, e) => sum + (e.analytics?.totalTickets ?? 0), 0);
    const totalTicketsSold = events.reduce((sum, e) => sum + (e.tickets?.length ?? 0), 0);

    const averageHealth = events.length > 0
      ? Math.round(events.reduce((sum, e) => sum + (e.readinessScore ?? 0), 0) / events.length)
      : 0;

    const healthBreakdown = events.length > 0
      ? {
          excellent: events.filter((e) => (e.readinessScore ?? 0) >= 80).length,
          good: events.filter((e) => (e.readinessScore ?? 0) >= 60 && (e.readinessScore ?? 0) < 80).length,
          average: events.filter((e) => (e.readinessScore ?? 0) >= 40 && (e.readinessScore ?? 0) < 60).length,
          needsAttention: events.filter((e) => (e.readinessScore ?? 0) < 40).length,
        }
      : { excellent: 0, good: 0, average: 0, needsAttention: 0 };

    function getEventHealthCategories(event) {
      const confirmedVendors = event.eventVendors.filter(v => v.status === 'CONFIRMED').length;
      const pendingVendors = event.eventVendors.filter(v => v.status === 'INVITED').length;
      const declinedVendors = event.eventVendors.filter(v => v.status === 'DECLINED').length;
      const hasTickets = (event.tickets?.length ?? 0) > 0;
      const isLaunched = !!event.maxifyEventId;

      const venueComplete = !!(event.name && event.eventDate && event.location && event.eventType);
      const guestsComplete = (event.guestCount ?? 0) > 0;

      const categories = [
        {
          name: 'Venue',
          status: venueComplete ? 'Complete' : 'Needs Attention',
        },
        {
          name: 'Vendors',
          status: confirmedVendors > 0 ? (pendingVendors > 0 ? 'In Progress' : 'Complete') : 'Needs Attention',
        },
        {
          name: 'Guests',
          status: guestsComplete ? 'Complete' : 'Needs Attention',
        },
        {
          name: 'Ticketing',
          status: hasTickets ? (isLaunched ? 'Complete' : 'In Progress') : 'Needs Attention',
        },
        {
          name: 'Event setup',
          status: (event.readinessScore ?? 0) >= 80 ? 'Complete' : (event.readinessScore ?? 0) >= 40 ? 'In Progress' : 'Needs Attention',
        },
      ];

      return categories;
    }

    const recentActivities = enquiries
      .slice()
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 5)
      .map((enquiry) => ({
        id: enquiry.id,
        headline: `${enquiry.status} — ${enquiry.vendor?.firstName && enquiry.vendor?.lastName ? `${enquiry.vendor.firstName} ${enquiry.vendor.lastName}` : enquiry.vendorProfile?.businessName || 'Vendor'}`,
        detail: `${enquiry.eventType} on ${new Date(enquiry.eventDate).toLocaleDateString()}`,
        time: enquiry.createdAt ? new Date(enquiry.createdAt).toLocaleDateString() : 'Recent',
        status: enquiry.status,
        eventType: enquiry.eventType,
        eventDate: new Date(enquiry.eventDate).toLocaleDateString(),
      }));

    const upcomingTasks = events.slice(0, 3).map((event, idx) => ({
      id: event.id + '-task-' + idx,
      text: idx === 0 ? 'Review vendor proposals' : idx === 1 ? 'Share event with guests' : 'Confirm catering order',
      event: event.name,
      due: idx === 0 ? 'Due today' : idx === 1 ? 'Due tomorrow' : 'Due in 3 days',
      checked: false,
    }));

    const vendorStatusCounts = enquiries.reduce(
      (acc, enquiry) => {
        acc[enquiry.status] = (acc[enquiry.status] || 0) + 1;
        return acc;
      },
      { NEW: 0, RESPONDED: 0, DECLINED: 0, BOOKED: 0 }
    );

    return res.status(200).json({
      success: true,
      data: {
        profile: planner,
        summary: {
          activeEvents: activeEvents.length,
          vendorsBooked: bookedEnquiries.length,
          ticketsSold: totalTicketsSold,
          guestsRegistered: totalGuestsRegistered,
          openEnquiries: openEnquiries.length,
        },
        events: events.map((e) => {
          const analytics = analyticsMap.get(e.id);
          const confirmedVendors = e.eventVendors.filter(v => v.status === 'CONFIRMED').length;
          const pendingVendors = e.eventVendors.filter(v => v.status === 'INVITED').length;
          const declinedVendors = e.eventVendors.filter(v => v.status === 'DECLINED').length;
          const totalVendors = confirmedVendors + pendingVendors + declinedVendors;

          return {
            id: e.id,
            name: e.name,
            eventType: e.eventType,
            eventDate: e.eventDate,
            location: e.location,
            guestCount: e.guestCount,
            status: e.status,
            readinessScore: e.readinessScore ?? 0,
            ticketsSold: e.tickets?.length ?? 0,
            ticketCapacity: e.guestCount,
            vendorProgress: {
              total: totalVendors,
              confirmed: confirmedVendors,
              pending: pendingVendors,
              declined: declinedVendors,
            },
            maxifyConnected: !!e.maxifyEventId,
            maxifyEventId: e.maxifyEventId,
            analytics: analytics ? {
              totalTickets: analytics.totalTickets,
              totalCheckedIn: analytics.totalCheckedIn,
              attendanceRate: analytics.attendanceRate,
            } : null,
            eventHealthCategories: getEventHealthCategories(e),
          };
        }),
        eventHealth: {
          average: averageHealth,
          breakdown: healthBreakdown,
        },
        vendorTeam: {
          totalVendors: allVendors.length,
          confirmed: vendorStatusCounts.BOOKED,
          pending: vendorStatusCounts.NEW + vendorStatusCounts.RESPONDED,
          declined: vendorStatusCounts.DECLINED,
        },
        maxifyTickets: events
          .filter((e) => e.maxifyEventId)
          .map((e) => {
            const analytics = analyticsMap.get(e.id);
            return {
              eventId: e.id,
              eventName: e.name,
              totalSold: analytics?.totalTickets ?? e.tickets?.length ?? 0,
              totalCheckedIn: analytics?.totalCheckedIn ?? 0,
              attendanceRate: analytics?.attendanceRate ?? 0,
              maxifyEventId: e.maxifyEventId,
              maxifySyncedAt: e.maxifySyncedAt,
              maxifyMode: e.maxifyMode,
            };
          }),
        recentActivities,
        upcomingTasks,
      },
    });
  } catch (error) {
    console.error('Get planner dashboard error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching planner dashboard' });
  }
};

// @desc    Get planner statistics
// @route   GET /api/planner/stats
// @access  Private (Planner only)
export const getStats = async (req, res) => {
  try {
    const plannerId = req.user.id;
    const [statusGroups, totalBudget, reviewedEnquiries] = await Promise.all([
      prisma.enquiry.groupBy({ by: ['status'], where: { plannerId }, _count: { _all: true } }),
      prisma.enquiry.aggregate({ where: { plannerId }, _sum: { budget: true } }),
      prisma.review.count({ where: { plannerId } })
    ]);

    const statusBreakdown = { NEW: 0, RESPONDED: 0, DECLINED: 0, BOOKED: 0 };
    for (const group of statusGroups) statusBreakdown[group.status] = group._count._all;

    return res.status(200).json({
      success: true,
      data: {
        totalEnquiries: statusBreakdown.NEW + statusBreakdown.RESPONDED + statusBreakdown.DECLINED + statusBreakdown.BOOKED,
        statusBreakdown,
        totalBookings: statusBreakdown.BOOKED,
        totalBudget: totalBudget._sum.budget || 0,
        reviewsSubmitted: reviewedEnquiries
      }
    });
  } catch (error) {
    console.error('Get planner stats error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching planner statistics' });
  }
};
