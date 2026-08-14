import { prisma } from '../config/database.js';
import { ensureChatRoomForBooking } from '../services/chatService.js';

const bookingInclude = {
  planner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true
    }
  },
  vendor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true
    }
  },
  vendorProfile: {
    select: {
      id: true,
      businessName: true,
      category: true,
      location: true,
      profileImage: true,
      averageRating: true,
      totalReviews: true
    }
  },
  chatRoom: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true
    }
  }
};

const bookingWhere = (where = {}) => ({
  ...where,
  isBookingRequest: true
});

const paginateBookings = async ({ where, page, limit }) => {
  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    prisma.enquiry.findMany({
      where: bookingWhere(where),
      orderBy: { bookingRequestedAt: 'desc' },
      skip,
      take: limit,
      include: bookingInclude
    }),
    prisma.enquiry.count({ where: bookingWhere(where) })
  ]);

  return {
    bookings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

const findAvailableVendorProfile = async (vendorId) => {
  const vendorProfile = await prisma.vendorProfile.findFirst({
    where: {
      userId: vendorId,
      user: {
        role: 'VENDOR'
      }
    }
  });

  if (!vendorProfile) {
    const vendorUser = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { id: true, role: true }
    });

    if (!vendorUser || vendorUser.role !== 'VENDOR') {
      throw Object.assign(new Error('Invalid vendor selection'), { statusCode: 422 });
    }

    return prisma.vendorProfile.create({
      data: {
        userId: vendorId,
        businessName: '',
        category: '',
        location: '',
        isPublished: true
      }
    });
  }

  return vendorProfile;
};

const acceptBookingById = async ({ bookingId, vendorId }) => {
  const booking = await prisma.enquiry.findFirst({
    where: bookingWhere({
      id: bookingId,
      vendorId
    })
  });

  if (!booking) {
    return { status: 404, message: 'Booking request not found or you do not have permission' };
  }

  if (booking.status === 'BOOKED') {
    return { status: 400, message: 'This booking request is already accepted' };
  }

  if (booking.status === 'DECLINED') {
    return { status: 400, message: 'A declined booking request cannot be accepted' };
  }

  const accepted = await prisma.$transaction(async (tx) => {
    const updated = await tx.enquiry.update({
      where: { id: booking.id },
      data: {
        status: 'BOOKED',
        bookedAt: new Date(),
        bookingRespondedAt: new Date()
      },
      include: bookingInclude
    });

    await tx.vendorProfile.update({
      where: { id: booking.vendorProfileId },
      data: { totalBookings: { increment: 1 } }
    });

    await ensureChatRoomForBooking(tx, {
      plannerId: booking.plannerId,
      vendorId: booking.vendorId,
      enquiryId: booking.id
    });

    return tx.enquiry.findUnique({
      where: { id: updated.id },
      include: bookingInclude
    });
  });

  return { status: 200, data: accepted };
};

// @desc    Send a booking request to a vendor
// @route   POST /api/bookings
// @access  Private (Planner only)
export const bookVendor = async (req, res) => {
  try {
    const {
      enquiryId,
      vendorId,
      eventType,
      eventDate,
      eventLocation,
      guestCount,
      budget,
      specialNotes
    } = req.body;

    if (enquiryId) {
      const enquiry = await prisma.enquiry.findFirst({
        where: {
          id: enquiryId,
          plannerId: req.user.id
        }
      });

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: 'Enquiry not found or you do not have permission'
        });
      }

      if (enquiry.isBookingRequest && enquiry.status === 'BOOKED') {
        return res.status(400).json({
          success: false,
          message: 'This enquiry is already booked'
        });
      }

      const vendorProfile = await findAvailableVendorProfile(enquiry.vendorId);

      const bookingRequest = await prisma.enquiry.update({
        where: { id: enquiry.id },
        data: {
          isBookingRequest: true,
          bookingRequestedAt: new Date(),
          bookingRespondedAt: null,
          bookedAt: null,
          status: 'NEW'
        },
        include: bookingInclude
      });

      return res.status(200).json({
        success: true,
        message: 'Booking request sent successfully',
        data: bookingRequest
      });
    }

    const vendorProfile = await findAvailableVendorProfile(vendorId);

    const bookingRequest = await prisma.$transaction(async (tx) => {
      const existingBooking = await tx.enquiry.findFirst({
        where: {
          plannerId: req.user.id,
          vendorId,
          eventType,
          eventDate: new Date(eventDate)
        }
      });

      if (existingBooking) {
        if (existingBooking.isBookingRequest && existingBooking.status === 'BOOKED') {
          return null;
        }

        const updated = await tx.enquiry.update({
          where: { id: existingBooking.id },
          data: {
            isBookingRequest: true,
            status: 'NEW',
            eventLocation,
            guestCount: guestCount ?? existingBooking.guestCount,
            budget: budget ?? existingBooking.budget,
            specialNotes: specialNotes ?? existingBooking.specialNotes,
            responseMessage: null,
            respondedAt: null,
            bookedAt: null,
            bookingRequestedAt: new Date(),
            bookingRespondedAt: null
          },
          include: bookingInclude
        });

        return tx.enquiry.findUnique({
          where: { id: updated.id },
          include: bookingInclude
        });
      }

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
          isBookingRequest: true,
          bookingRequestedAt: new Date(),
          status: 'NEW'
        },
        include: bookingInclude
      });

      await tx.vendorProfile.update({
        where: { id: vendorProfile.id },
        data: {
          enquiryCount: { increment: 1 },
          totalEnquiries: { increment: 1 }
        }
      });

      return tx.enquiry.findUnique({
        where: { id: created.id },
        include: bookingInclude
      });
    });

    if (!bookingRequest) {
      return res.status(409).json({
        success: false,
        message: 'You have already booked this vendor for this event'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Booking request sent successfully',
      data: bookingRequest
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'You have already sent a booking or enquiry to this vendor for this event'
      });
    }

    console.error('Book vendor error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sending booking request'
    });
  }
};

// @desc    Accept a booking request
// @route   POST /api/bookings/:id/accept
// @access  Private (Vendor only)
export const acceptBooking = async (req, res) => {
  try {
    const result = await acceptBookingById({ bookingId: req.params.id, vendorId: req.user.id });

    if (!result.data) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Booking request accepted successfully',
      data: result.data
    });
  } catch (error) {
    console.error('Accept booking error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error accepting booking request'
    });
  }
};

// @desc    Decline a booking request
// @route   POST /api/bookings/:id/decline
// @access  Private (Vendor only)
export const declineBooking = async (req, res) => {
  try {
    const booking = await prisma.enquiry.findFirst({
      where: bookingWhere({
        id: req.params.id,
        vendorId: req.user.id
      })
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking request not found or you do not have permission'
      });
    }

    if (booking.status === 'BOOKED') {
      return res.status(400).json({
        success: false,
        message: 'An accepted booking request cannot be declined'
      });
    }

    if (booking.status === 'DECLINED') {
      return res.status(400).json({
        success: false,
        message: 'This booking request is already declined'
      });
    }

    const declined = await prisma.enquiry.update({
      where: { id: booking.id },
      data: {
        status: 'DECLINED',
        responseMessage: req.body.responseMessage,
        respondedAt: new Date(),
        bookingRespondedAt: new Date()
      },
      include: bookingInclude
    });

    return res.status(200).json({
      success: true,
      message: 'Booking request declined successfully',
      data: declined
    });
  } catch (error) {
    console.error('Decline booking error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error declining booking request'
    });
  }
};

// @desc    Get bookings made by the signed-in planner
// @route   GET /api/bookings/planner
// @access  Private (Planner only)
export const getPlannerBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = { plannerId: req.user.id };
    if (status) where.status = status;

    const data = await paginateBookings({
      where,
      page,
      limit
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Get planner bookings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching planner bookings'
    });
  }
};

// @desc    Get bookings received by the signed-in vendor
// @route   GET /api/bookings/vendor
// @access  Private (Vendor only)
export const getVendorBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = { vendorId: req.user.id };
    if (status) where.status = status;

    const data = await paginateBookings({
      where,
      page,
      limit
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Get vendor bookings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching vendor bookings'
    });
  }
};
