import { prisma } from '../config/database.js';

// @desc    Create review
// @route   POST /api/reviews
// @access  Private (Planner only)
export const createReview = async (req, res) => {
  try {
    const { enquiryId, rating, review } = req.body;

    // Check if enquiry exists and belongs to planner
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      include: {
        vendorProfile: true
      }
    });

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    if (enquiry.plannerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to review this enquiry'
      });
    }

    // Check if event has passed
    const eventDate = new Date(enquiry.eventDate);
    const now = new Date();
    if (eventDate > now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot review before event date'
      });
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: { enquiryId }
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Review already exists for this enquiry'
      });
    }

    // Create review
    const newReview = await prisma.review.create({
      data: {
        enquiryId,
        plannerId: req.user.id,
        vendorId: enquiry.vendorId,
        vendorProfileId: enquiry.vendorProfileId,
        rating,
        review
      },
      include: {
        planner: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        vendor: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: newReview
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting review'
    });
  }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private (Planner only)
export const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;

    const existingReview = await prisma.review.findUnique({
      where: { id }
    });

    if (!existingReview) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (existingReview.plannerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this review'
      });
    }

    // Check if within edit window (48 hours)
    const createdAt = new Date(existingReview.createdAt);
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);

    if (hoursDiff > 48) {
      return res.status(400).json({
        success: false,
        message: 'Review can only be edited within 48 hours of submission'
      });
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        rating,
        review,
        isEdited: true,
        editedAt: new Date()
      },
      include: {
        planner: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: updatedReview
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating review'
    });
  }
};

// @desc    Get vendor reviews
// @route   GET /api/reviews/vendor/:vendorId
// @access  Public
export const getVendorReviews = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Check if vendor exists
    const vendor = await prisma.user.findUnique({
      where: { id: vendorId }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const reviews = await prisma.review.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        planner: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        enquiry: {
          select: {
            eventType: true,
            eventDate: true
          }
        }
      }
    });

    const total = await prisma.review.count({
      where: { vendorId }
    });

    const stats = await prisma.review.aggregate({
      where: { vendorId },
      _avg: { rating: true },
      _count: true
    });

    res.status(200).json({
      success: true,
      data: {
        reviews,
        stats: {
          total: stats._count,
          averageRating: stats._avg.rating || 0
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get vendor reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews'
    });
  }
};