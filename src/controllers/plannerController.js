import { prisma } from '../config/database.js';

const publicPlannerFields = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  avatar: true,
  createdAt: true,
  updatedAt: true
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
    const { firstName, lastName, avatar } = req.body;
    const data = {};

    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (avatar !== undefined) data.avatar = avatar;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one profile field to update'
      });
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
    const [planner, statusGroups, recentEnquiries, upcomingEvents, reviewableEnquiries] = await Promise.all([
      prisma.user.findUnique({ where: { id: plannerId }, select: publicPlannerFields }),
      prisma.enquiry.groupBy({
        by: ['status'],
        where: { plannerId },
        _count: { _all: true }
      }),
      prisma.enquiry.findMany({
        where: { plannerId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: {
          vendorProfile: {
            select: { id: true, businessName: true, category: true, location: true, profileImage: true }
          }
        }
      }),
      prisma.enquiry.findMany({
        where: { plannerId, eventDate: { gte: new Date() } },
        orderBy: { eventDate: 'asc' },
        take: 5,
        include: { vendorProfile: { select: { businessName: true, category: true, profileImage: true } } }
      }),
      prisma.enquiry.count({
        where: { plannerId, eventDate: { lt: new Date() }, review: null }
      })
    ]);

    const statusCounts = { NEW: 0, RESPONDED: 0, BOOKED: 0 };
    for (const group of statusGroups) statusCounts[group.status] = group._count._all;

    return res.status(200).json({
      success: true,
      data: {
        profile: planner,
        summary: {
          totalEnquiries: statusCounts.NEW + statusCounts.RESPONDED + statusCounts.BOOKED,
          statusCounts,
          upcomingEvents: upcomingEvents.length,
          reviewableEnquiries
        },
        recentEnquiries,
        upcomingEvents
      }
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

    const statusBreakdown = { NEW: 0, RESPONDED: 0, BOOKED: 0 };
    for (const group of statusGroups) statusBreakdown[group.status] = group._count._all;

    return res.status(200).json({
      success: true,
      data: {
        totalEnquiries: statusBreakdown.NEW + statusBreakdown.RESPONDED + statusBreakdown.BOOKED,
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
