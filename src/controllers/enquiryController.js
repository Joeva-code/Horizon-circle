import { prisma } from '../config/database.js';

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

    // Check if vendor exists and is published
    const vendorProfile = await prisma.vendorProfile.findUnique({
      where: { userId: vendorId }
    });

    if (!vendorProfile || !vendorProfile.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not available'
      });
    }

    // Reject duplicates before creating the record. The database unique
    // constraint below is the final safeguard against concurrent requests.
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
        include: {
          planner: { select: { id: true, firstName: true, lastName: true, email: true } },
          vendor: { select: { id: true, firstName: true, lastName: true, email: true } },
          vendorProfile: true
        }
      });

      await tx.vendorProfile.update({
        where: { id: vendorProfile.id },
        data: { enquiryCount: { increment: 1 }, totalEnquiries: { increment: 1 } }
      });

      return created;
    });

    res.status(201).json({
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
    res.status(500).json({
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

    const whereClause = {
      plannerId: req.user.id
    };

    if (status) {
      whereClause.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const enquiries = await prisma.enquiry.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        vendor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
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
        }
      }
    });

    const total = await prisma.enquiry.count({
      where: whereClause
    });

    res.status(200).json({
      success: true,
      data: {
        enquiries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get planner enquiries error:', error);
    res.status(500).json({
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

    const whereClause = {
      vendorId: req.user.id
    };

    if (status) {
      whereClause.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const enquiries = await prisma.enquiry.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        planner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        vendorProfile: {
          select: {
            id: true,
            businessName: true
          }
        }
      }
    });

    const total = await prisma.enquiry.count({
      where: whereClause
    });

    // Update response rate
    const totalEnquiries = await prisma.enquiry.count({
      where: { vendorId: req.user.id }
    });

    const respondedEnquiries = await prisma.enquiry.count({
      where: {
        vendorId: req.user.id,
        status: {
          in: ['RESPONDED', 'BOOKED']
        }
      }
    });

    const responseRate = totalEnquiries > 0 ? (respondedEnquiries / totalEnquiries) * 100 : 0;

    await prisma.vendorProfile.update({
      where: { userId: req.user.id },
      data: {
        responseRate: parseFloat(responseRate.toFixed(2))
      }
    });

    res.status(200).json({
      success: true,
      data: {
        enquiries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get vendor enquiries error:', error);
    res.status(500).json({
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
      },
      include: {
        vendorProfile: true
      }
    });

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found or you do not have permission'
      });
    }

    if (enquiry.status === 'BOOKED') {
      return res.status(400).json({ success: false, message: 'A booked enquiry cannot be changed' });
    }

    if (status === enquiry.status) {
      return res.status(400).json({ success: false, message: `Enquiry is already ${status.toLowerCase()}` });
    }

    if (status === 'BOOKED' && enquiry.status !== 'RESPONDED') {
      return res.status(400).json({ success: false, message: 'An enquiry must be responded to before it can be booked' });
    }

    const updateData = { status };

    if (status === 'RESPONDED') {
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
        include: {
          planner: { select: { id: true, firstName: true, lastName: true, email: true } },
          vendor: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      if (status === 'BOOKED') {
        await tx.vendorProfile.update({
          where: { id: enquiry.vendorProfileId },
          data: { totalBookings: { increment: 1 } }
        });
      }

      return updated;
    });

    res.status(200).json({
      success: true,
      message: 'Enquiry status updated successfully',
      data: updatedEnquiry
    });
  } catch (error) {
    console.error('Update enquiry status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating enquiry status'
    });
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
        planner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        vendor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
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

    // Check if user is authorized to view this enquiry
    if (enquiry.plannerId !== req.user.id && enquiry.vendorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this enquiry'
      });
    }

    res.status(200).json({
      success: true,
      data: enquiry
    });
  } catch (error) {
    console.error('Get enquiry details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enquiry details'
    });
  }
};
