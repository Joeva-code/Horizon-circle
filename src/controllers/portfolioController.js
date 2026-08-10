import { prisma } from '../config/database.js';

// @desc    Get vendor public portfolio
// @route   GET /api/vendors/:vendorId/portfolio
// @access  Public
export const getVendorPortfolio = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendorProfile = await prisma.vendorProfile.findUnique({
      where: { userId: vendorId },
      include: {
        portfolioItems: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!vendorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        portfolioItems: vendorProfile.portfolioItems || []
      }
    });
  } catch (error) {
    console.error('Get vendor portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor portfolio'
    });
  }
};

// @desc    Create portfolio item
// @route   POST /api/vendor/portfolio
// @access  Private (Vendor only)
export const createPortfolioItem = async (req, res) => {
  try {
    const { caption, priceRange, mediaType, description } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a media file'
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

    const itemCount = await prisma.portfolioItem.count({
      where: { vendorProfileId: profile.id }
    });

    const item = await prisma.portfolioItem.create({
      data: {
        vendorProfileId: profile.id,
        url: file.path,
        thumbnailUrl: file.path,
        caption: caption || null,
        description: description || null,
        priceRange: priceRange || null,
        mediaType: mediaType || (file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE'),
        sortOrder: itemCount
      }
    });

    const serializedItem = {
      id: item.id,
      vendorProfileId: item.vendorProfileId,
      mediaType: item.mediaType,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl,
      caption: item.caption,
      description: item.description,
      priceRange: item.priceRange,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };

    res.status(201).json({
      success: true,
      data: serializedItem
    });
  } catch (error) {
    console.error('Create portfolio item error:', error);
    const message = error instanceof Error ? error.message : 'Error creating portfolio item';
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Error creating portfolio item' : message
    });
  }
};

// @desc    Get vendor's own portfolio
// @route   GET /api/vendor/portfolio
// @access  Private (Vendor only)
export const getMyPortfolio = async (req, res) => {
  try {
    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        portfolioItems: {
          orderBy: { sortOrder: 'asc' }
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
      data: {
        portfolioItems: profile.portfolioItems || []
      }
    });
  } catch (error) {
    console.error('Get my portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio'
    });
  }
};

// @desc    Update portfolio item
// @route   PUT /api/vendor/portfolio/:id
// @access  Private (Vendor only)
export const updatePortfolioItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, priceRange, sortOrder } = req.body;

    const item = await prisma.portfolioItem.findUnique({
      where: { id },
      include: {
        vendorProfile: true
      }
    });

    if (!item || item.vendorProfile.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    const updatedItem = await prisma.portfolioItem.update({
      where: { id },
      data: {
        caption: caption !== undefined ? caption : item.caption,
        priceRange: priceRange !== undefined ? priceRange : item.priceRange,
        sortOrder: sortOrder !== undefined ? sortOrder : item.sortOrder
      }
    });

    res.status(200).json({
      success: true,
      data: updatedItem
    });
  } catch (error) {
    console.error('Update portfolio item error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating portfolio item'
    });
  }
};

// @desc    Delete portfolio item
// @route   DELETE /api/vendor/portfolio/:id
// @access  Private (Vendor only)
export const deletePortfolioItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.portfolioItem.findUnique({
      where: { id },
      include: {
        vendorProfile: true
      }
    });

    if (!item || item.vendorProfile.userId !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }

    await prisma.portfolioItem.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Portfolio item deleted successfully'
    });
  } catch (error) {
    console.error('Delete portfolio item error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting portfolio item'
    });
  }
};
