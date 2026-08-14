import express from 'express';
import {
  createOrUpdateProfile,
  getProfile,
  uploadProfileImage,
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

// Dashboard
router.get('/dashboard', getDashboard);

// Statistics
router.get('/stats', getVendorStats);

// Availability
router.put('/availability', updateAvailability);

export default router;