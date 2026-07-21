import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';

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
      // For price range, we'll filter after query since priceRange is stored as string
      // We'll handle this in memory for MVP
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

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

    // Get vendors
    const vendors = await prisma.vendorProfile.findMany({
      where: whereClause,
      orderBy,
      skip,
      take,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isVerified: true
          }
        }
      }
    });

    // Get total count
    const total = await prisma.vendorProfile.count({
      where: whereClause
    });

    // If budget filters are provided, filter in memory
    let filteredVendors = vendors;
    if (minBudget || maxBudget) {
      filteredVendors = vendors.filter(vendor => {
        if (!vendor.priceRange) return true;
        // Parse price range (e.g., "₦50,000 - ₦100,000" or "₦50,000+")
        const priceStr = vendor.priceRange.replace(/[₦,]/g, '').trim();
        const parts = priceStr.split('-').map(p => parseInt(p.trim()));
        
        if (parts.length === 1) {
          // Single price or "X+"
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

    // If date filter is provided, check availability
    if (date) {
      const eventDate = new Date(date);
      filteredVendors = filteredVendors.filter(vendor => {
        if (!vendor.availability) return true;
        // Check if vendor is available on the date
        // This is a simplified check - you can expand based on your availability data structure
        return true;
      });
    }

    res.status(200).json({
      success: true,
      data: {
        vendors: filteredVendors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
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

    // Increment view count
    await prisma.vendorProfile.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1
        }
      }
    });

    const vendor = await prisma.vendorProfile.findUnique({
      where: { id },
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

    if (!vendor.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not available'
      });
    }

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
      where: { isPublished: true },
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