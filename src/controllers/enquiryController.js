import { prisma } from '../config/database.js';
import { ensureChatRoomForEnquiry, ensureChatRoomForBooking } from '../services/chatService.js';

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatar: true
};

const vendorProfileSelect = {
  id: true,
  businessName: true,
  category: true,
  location: true,
  profileImage: true,
  averageRating: true,
  totalReviews: true
};

const chatRoomSelect = {
  id: true,
  createdAt: true,
  updatedAt: true
};

const enquiryListInclude = {
  planner: { select: personSelect },
  vendor: { select: personSelect },
  vendorProfile: { select: vendorProfileSelect },
  chatRoom: { select: chatRoomSelect }
};

const ensureChatForAcceptedEnquiry = (tx, enquiry) => {
  return ensureChatRoomForEnquiry(tx, {
    plannerId: enquiry.plannerId,
    vendorId: enquiry.vendorId,
    enquiryId: enquiry.id
  });
};

// @desc    Create enquiry
// @route   POST /api/enquiries
// @access  Private (Planner only)
export const createEnquiry = async (req, res) => {
  try {
    const {
      vendorId,
      eventType,
      eventDate,
      eventLocation,
      guestCount,
      budget,
      specialNotes
    } = req.body;

    let vendorProfile = await prisma.vendorProfile.findUnique({
      where: { userId: vendorId }
    });

    if (!vendorProfile) {
      vendorProfile = await prisma.vendorProfile.create({
        data: {
          userId: vendorId,
          businessName: '',
          category: '',
          location: '',
          isPublished: true
        }
      });
    }

    const duplicateEnquiry = await prisma.enquiry.findFirst({
      where: {
        plannerId: req.user.id,
        vendorId,
        eventDate: new Date(eventDate),
        eventType
      }
    });

    if (duplicateEnquiry) {
      return res.status(400).json({
        success: false,
        message: 'You have already sent a similar enquiry to this vendor',
        data: {
          existingEnquiryId: duplicateEnquiry.id
        }
      });
    }

    const enquiry = await prisma.$transaction(async (tx) => {
      const created = await tx.enquiry.create({
        data: {
          plannerId: req.user.id,
          vendorId,
          vendorProfileId: vendorProfile.id,
          eventType,
          eventDate: new Date(eventDate),
          eventLocation,
          guestCount: guestCount ?? null,
          budget: budget ?? null,
          specialNotes,
          status: 'NEW'
        },
        include: enquiryListInclude
      });

      await tx.vendorProfile.update({
        where: { id: vendorProfile.id },
        data: { enquiryCount: { increment: 1 }, totalEnquiries: { increment: 1 } }
      });

      return created;
    });

    return res.status(201).json({
      success: true,
      message: 'Enquiry sent successfully',
      data: enquiry
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'You have already sent this enquiry to this vendor'
      });
    }

    console.error('Create enquiry error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sending enquiry'
    });
  }
};

// @desc    Get enquiries for planner
// @route   GET /api/enquiries/planner
// @access  Private (Planner only)
export const getPlannerEnquiries = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const whereClause = { plannerId: req.user.id };

    if (status) whereClause.status = status;

    const skip = (page - 1) * limit;

    const [enquiries, total] = await Promise.all([
      prisma.enquiry.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: enquiryListInclude
      }),
      prisma.enquiry.count({ where: whereClause })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        enquiries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get planner enquiries error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching enquiries'
    });
  }
};

// @desc    Get enquiries for vendor
// @route   GET /api/enquiries/vendor
// @access  Private (Vendor only)
export const getVendorEnquiries = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const whereClause = { vendorId: req.user.id };

    if (status) whereClause.status = status;

    const skip = (page - 1) * limit;

    const [enquiries, total, totalEnquiries, respondedEnquiries] = await Promise.all([
      prisma.enquiry.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: enquiryListInclude
      }),
      prisma.enquiry.count({ where: whereClause }),
      prisma.enquiry.count({ where: { vendorId: req.user.id } }),
      prisma.enquiry.count({
        where: {
          vendorId: req.user.id,
          status: { in: ['RESPONDED', 'DECLINED', 'BOOKED'] }
        }
      })
    ]);

    const responseRate = totalEnquiries > 0 ? (respondedEnquiries / totalEnquiries) * 100 : 0;

    await prisma.vendorProfile.update({
      where: { userId: req.user.id },
      data: { responseRate: parseFloat(responseRate.toFixed(2)) }
    });

    return res.status(200).json({
      success: true,
      data: {
        enquiries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get vendor enquiries error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching enquiries'
    });
  }
};

// @desc    Update enquiry status
// @route   PUT /api/enquiries/:id/status
// @access  Private (Vendor only)
export const updateEnquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, responseMessage } = req.body;

    const enquiry = await prisma.enquiry.findFirst({
      where: {
        id,
        vendorId: req.user.id
      }
    });

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found or you do not have permission'
      });
    }

    if (['BOOKED', 'DECLINED'].includes(enquiry.status)) {
      return res.status(400).json({
        success: false,
        message: `A ${enquiry.status.toLowerCase()} enquiry cannot be changed`
      });
    }

    if (status === enquiry.status) {
      return res.status(400).json({
        success: false,
        message: `Enquiry is already ${status.toLowerCase()}`
      });
    }

    if (status === 'BOOKED' && enquiry.status !== 'RESPONDED') {
      return res.status(400).json({
        success: false,
        message: 'An enquiry must be accepted before it can be booked'
      });
    }

    const updateData = { status };

    if (['RESPONDED', 'DECLINED'].includes(status)) {
      updateData.responseMessage = responseMessage;
      updateData.respondedAt = new Date();
    }

    if (status === 'BOOKED') {
      updateData.bookedAt = new Date();
    }

    const updatedEnquiry = await prisma.$transaction(async (tx) => {
      const updated = await tx.enquiry.update({
        where: { id },
        data: updateData,
        include: enquiryListInclude
      });

      if (status === 'RESPONDED') {
        await ensureChatForAcceptedEnquiry(tx, enquiry);
      }

      if (status === 'BOOKED') {
        await tx.vendorProfile.update({
          where: { id: enquiry.vendorProfileId },
          data: { totalBookings: { increment: 1 } }
        });
      }

      return tx.enquiry.findUnique({
        where: { id: updated.id },
        include: enquiryListInclude
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Enquiry status updated successfully',
      data: updatedEnquiry
    });
  } catch (error) {
    console.error('Update enquiry status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating enquiry status'
    });
  }
};

// @desc    Accept an enquiry and open the planner/vendor chat
// @route   POST /api/enquiries/:id/accept
// @access  Private (Vendor only)
export const acceptEnquiry = async (req, res) => {
  req.body.status = 'RESPONDED';
  return updateEnquiryStatus(req, res);
};

// @desc    Decline an enquiry
// @route   POST /api/enquiries/:id/decline
// @access  Private (Vendor only)
export const declineEnquiry = async (req, res) => {
  req.body.status = 'DECLINED';
  return updateEnquiryStatus(req, res);
};

// @desc    Open the chat for an accepted/booked enquiry
// @route   GET /api/enquiries/:id/chat
// @access  Private
export const openEnquiryChat = async (req, res) => {
  try {
    const { id } = req.params;

    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      select: {
        id: true,
        plannerId: true,
        vendorId: true,
        status: true,
        chatRoom: { select: chatRoomSelect }
      }
    });

    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    if (enquiry.plannerId !== req.user.id && enquiry.vendorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this chat'
      });
    }

    const allowedStatuses = ['RESPONDED', 'BOOKED'];
    if (enquiry.isBookingRequest && enquiry.status === 'NEW') {
      allowedStatuses.push('NEW');
    }

    if (!allowedStatuses.includes(enquiry.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chat opens after the vendor accepts the enquiry'
      });
    }

    const room = enquiry.chatRoom ?? await prisma.$transaction((tx) => {
      if (enquiry.isBookingRequest) {
        return ensureChatRoomForBooking(tx, {
          plannerId: enquiry.plannerId,
          vendorId: enquiry.vendorId,
          enquiryId: enquiry.id
        });
      }
      return ensureChatForAcceptedEnquiry(tx, enquiry);
    });

    return res.status(200).json({ success: true, data: room });
  } catch (error) {
    console.error('Open enquiry chat error:', error);
    return res.status(500).json({ success: false, message: 'Error opening enquiry chat' });
  }
};

// @desc    Get enquiry details
// @route   GET /api/enquiries/:id
// @access  Private
export const getEnquiryDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      include: {
        ...enquiryListInclude,
        vendorProfile: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    if (enquiry.plannerId !== req.user.id && enquiry.vendorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this enquiry'
      });
    }

    return res.status(200).json({
      success: true,
      data: enquiry
    });
  } catch (error) {
    console.error('Get enquiry details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching enquiry details'
    });
  }
};
