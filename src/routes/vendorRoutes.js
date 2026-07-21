import express from 'express';
import {
  createOrUpdateProfile,
  getProfile,
  uploadProfileImage,
  uploadPortfolioImages,
  removePortfolioImage,
  getDashboard,
  updateAvailability,
  getVendorStats
} from '../controllers/vendorController.js';

import { protect, restrictTo } from '../middleware/auth.js';
import { validate, vendorValidation } from '../middleware/validation.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Protect all vendor routes
router.use(protect);

// Only vendors
router.use(restrictTo("VENDOR"));

// Profile
router.route('/profile')
  .get(getProfile)
  .post(validate(vendorValidation.createProfile), createOrUpdateProfile)
  .put(validate(vendorValidation.createProfile), createOrUpdateProfile);

// Upload profile image
router.post(
  '/profile/image',
  upload.single('image'),
  uploadProfileImage
);

// Upload portfolio images
router.post(
  '/profile/portfolio',
  upload.array('images', 10),
  uploadPortfolioImages
);

// Delete portfolio image
router.delete(
  '/profile/portfolio/:index',
  removePortfolioImage
);

// Dashboard
router.get('/dashboard', getDashboard);

// Statistics
router.get('/stats', getVendorStats);

// Availability
router.put('/availability', updateAvailability);

export default router;