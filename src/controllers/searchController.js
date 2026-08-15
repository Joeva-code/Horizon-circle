import { prisma } from '../config/database.js';
import { isAvailableOn, normalizeAvailability } from '../services/availabilityService.js';

// @desc    Search vendors with filters
// @route   GET /api/search/vendors
// @access  Public
export const searchVendors = async (req, res) => {
  try {
    const {
      category,
      location,
      minBudget,
      maxBudget,
      date,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const whereClause = {
      user: {
        role: 'VENDOR',
        isActive: true
      },
      isPublished: true
    };

    // Category filter
    if (category) {
      whereClause.category = category;
    }

    // Location filter (case-insensitive)
    if (location) {
      whereClause.location = {
        contains: location,
        mode: 'insensitive'
      };
    }

    // Search in business name or description
    if (search) {
      whereClause.OR = [
        {
          businessName: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }

    // Price range filter
    if (minBudget || maxBudget) {
      // Budget filtering is handled in memory after querying
    }

    // Build order object
    let orderBy = {};
    if (sortBy === 'rating') {
      orderBy = { averageRating: sortOrder };
    } else if (sortBy === 'reviews') {
      orderBy = { totalReviews: sortOrder };
    } else if (sortBy === 'enquiries') {
      orderBy = { totalEnquiries: sortOrder };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Get all matching vendors (budget filtering must happen before pagination
    // because priceRange is stored as a string and cannot be filtered in Prisma)
    const allVendors = await prisma.vendorProfile.findMany({
      where: whereClause,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isVerified: true
          }
        },
        portfolioItems: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    let filteredVendors = allVendors;
    if (minBudget || maxBudget) {
      filteredVendors = allVendors.filter(vendor => {
        if (!vendor.priceRange) return true;
        const priceStr = vendor.priceRange.replace(/[₦,]/g, '').trim();
        const parts = priceStr.split('-').map(p => parseInt(p.trim()));
        
        if (parts.length === 1) {
          const price = parseInt(parts[0]);
          if (minBudget && price < parseInt(minBudget)) return false;
          if (maxBudget && price > parseInt(maxBudget)) return false;
          return true;
        } else if (parts.length === 2) {
          const low = parts[0];
          const high = parts[1];
          if (minBudget && high < parseInt(minBudget)) return false;
          if (maxBudget && low > parseInt(maxBudget)) return false;
          return true;
        }
        return true;
      });
    }

    if (date) {
      const eventDate = new Date(date);
      filteredVendors = filteredVendors.filter(vendor => {
        return isAvailableOn(vendor.availability, eventDate);
      });
    }

    const total = filteredVendors.length;

    res.status(200).json({
      success: true,
      data: {
        vendors: filteredVendors,
        pagination: {
          page: 1,
          limit: total,
          total,
          totalPages: 1
        }
      }
    });
  } catch (error) {
    console.error('Search vendors error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching vendors'
    });
  }
};

// @desc    Get vendor by ID
// @route   GET /api/vendors/:id
// @access  Public
export const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendorProfile.findFirst({
      where: {
        id,
        user: {
          role: 'VENDOR',
          isActive: true
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isVerified: true,
            createdAt: true
          }
        },
        portfolioItems: {
          orderBy: { sortOrder: 'asc' }
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: {
            planner: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    await prisma.vendorProfile.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1
        }
      }
    });

    res.status(200).json({
      success: true,
      data: vendor
    });
  } catch (error) {
    console.error('Get vendor by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor details'
    });
  }
};

// @desc    Get vendor categories
// @route   GET /api/search/categories
// @access  Public
export const getCategories = async (req, res) => {
  try {
    const categories = await prisma.vendorProfile.findMany({
      where: {
        user: {
          role: 'VENDOR',
          isActive: true
        },
        category: {
          not: ''
        }
      },
      distinct: ['category'],
      select: {
        category: true
      }
    });

    res.status(200).json({
      success: true,
      data: categories.map(c => c.category)
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
};

// @desc    Get the unavailable dates for a vendor
// @route   GET /api/search/vendors/:id/availability
// @access  Public
export const getVendorAvailability = async (req, res) => {
  try {
    const vendor = await prisma.vendorProfile.findFirst({
      where: {
        id: req.params.id,
        user: {
          role: 'VENDOR',
          isActive: true
        }
      },
      select: { availability: true }
    });

    if (!vendor) {
      return res.status(200).json({ success: true, data: { unavailableDates: [] } });
    }

    return res.status(200).json({ success: true, data: normalizeAvailability(vendor.availability) });
  } catch (error) {
    console.error('Get vendor availability error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching vendor availability' });
  }
};
