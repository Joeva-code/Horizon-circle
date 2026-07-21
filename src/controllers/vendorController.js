import { prisma } from '../config/database.js';

// @desc    Create/Update vendor profile
// @route   POST /api/vendor/profile
// @access  Private (Vendor only)
export const createOrUpdateProfile = async (req, res) => {
  try {
    const {
      businessName,
      category,
      description,
      location,
      priceRange,
      availability
    } = req.body;

    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    // Update profile
    const updatedProfile = await prisma.vendorProfile.update({
      where: { userId: req.user.id },
      data: {
        businessName: businessName || profile.businessName,
        category: category || profile.category,
        description: description !== undefined ? description : profile.description,
        location: location || profile.location,
        priceRange: priceRange !== undefined ? priceRange : profile.priceRange,
        availability: availability || profile.availability,
        isPublished: businessName && category && location ? true : profile.isPublished
      }
    });

    res.status(200).json({
      success: true,
      data: updatedProfile
    });
  } catch (error) {
    console.error('Create/Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating/updating profile'
    });
  }
};

// @desc    Get vendor profile
// @route   GET /api/vendor/profile
// @access  Private (Vendor only)
export const getProfile = async (req, res) => {
  try {
    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
};

// @desc    Upload profile image
// @route   POST /api/vendor/profile/image
// @access  Private (Vendor only)
export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image'
      });
    }

    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    const imageUrl = req.file.path;

    const updatedProfile = await prisma.vendorProfile.update({
      where: { userId: req.user.id },
      data: { profileImage: imageUrl }
    });

    res.status(200).json({
      success: true,
      data: {
        profileImage: updatedProfile.profileImage
      }
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading image'
    });
  }
};

// @desc    Upload portfolio images
// @route   POST /api/vendor/profile/portfolio
// @access  Private (Vendor only)
export const uploadPortfolioImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one image'
      });
    }

    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    const imageUrls = req.files.map(file => file.path);
    const currentImages = profile.portfolioImages || [];

    const updatedProfile = await prisma.vendorProfile.update({
      where: { userId: req.user.id },
      data: {
        portfolioImages: [...currentImages, ...imageUrls]
      }
    });

    res.status(200).json({
      success: true,
      data: {
        portfolioImages: imageUrls
      }
    });
  } catch (error) {
    console.error('Upload portfolio images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading portfolio images'
    });
  }
};

// @desc    Remove portfolio image
// @route   DELETE /api/vendor/profile/portfolio/:index
// @access  Private (Vendor only)
export const removePortfolioImage = async (req, res) => {
  try {
    const { index } = req.params;
    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    const images = profile.portfolioImages || [];
    if (index >= images.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image index'
      });
    }

    images.splice(index, 1);

    const updatedProfile = await prisma.vendorProfile.update({
      where: { userId: req.user.id },
      data: {
        portfolioImages: images
      }
    });

    res.status(200).json({
      success: true,
      message: 'Portfolio image removed successfully',
      data: updatedProfile
    });
  } catch (error) {
    console.error('Remove portfolio image error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing portfolio image'
    });
  }
};

// @desc    Get vendor dashboard
// @route   GET /api/vendor/dashboard
// @access  Private (Vendor only)
export const getDashboard = async (req, res) => {
  try {
    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    // Get enquiries
    const enquiries = await prisma.enquiry.findMany({
      where: { vendorId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        planner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Count by status
    const statusCounts = {
      NEW: enquiries.filter(e => e.status === 'NEW').length,
      RESPONDED: enquiries.filter(e => e.status === 'RESPONDED').length,
      BOOKED: enquiries.filter(e => e.status === 'BOOKED').length
    };

    // Get reviews
    const reviews = await prisma.review.findMany({
      where: { vendorId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
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
      data: {
        profile,
        dashboard: {
          totalEnquiries: enquiries.length,
          statusCounts,
          recentEnquiries: enquiries.slice(0, 10),
          recentReviews: reviews,
          stats: {
            responseRate: profile.responseRate,
            totalBookings: profile.totalBookings,
            averageRating: profile.averageRating,
            totalReviews: profile.totalReviews
          }
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard'
    });
  }
};

// @desc    Update availability
// @route   PUT /api/vendor/availability
// @access  Private (Vendor only)
export const updateAvailability = async (req, res) => {
  try {
    const { availability } = req.body;

    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    const updatedProfile = await prisma.vendorProfile.update({
      where: { userId: req.user.id },
      data: { availability }
    });

    res.status(200).json({
      success: true,
      data: updatedProfile
    });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating availability'
    });
  }
};

// @desc    Get vendor statistics
// @route   GET /api/vendor/stats
// @access  Private (Vendor only)
export const getVendorStats = async (req, res) => {
  try {
    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    const totalEnquiries = await prisma.enquiry.count({
      where: { vendorId: req.user.id }
    });

    const statusBreakdown = await prisma.enquiry.groupBy({
      by: ['status'],
      where: { vendorId: req.user.id },
      _count: true
    });

    const totalReviews = await prisma.review.count({
      where: { vendorId: req.user.id }
    });

    const ratingStats = await prisma.review.aggregate({
      where: { vendorId: req.user.id },
      _avg: { rating: true },
      _min: { rating: true },
      _max: { rating: true }
    });

    res.status(200).json({
      success: true,
      data: {
        totalEnquiries,
        statusBreakdown,
        totalReviews,
        averageRating: ratingStats._avg.rating || 0,
        minRating: ratingStats._min.rating || 0,
        maxRating: ratingStats._max.rating || 0
      }
    });
  } catch (error) {
    console.error('Get vendor stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor statistics'
    });
  }
};