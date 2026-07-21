import express from 'express';
import {
  createReview,
  updateReview,
  getVendorReviews
} from '../controllers/reviewController.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { validate, reviewValidation } from '../middleware/validation.js';

const router = express.Router();

// Public routes
router.get('/vendor/:vendorId', getVendorReviews);

// Protected routes
router.use(protect);
router.post('/', restrictTo('PLANNER'), validate(reviewValidation.createReview), createReview);
router.put('/:id', restrictTo('PLANNER'), validate(reviewValidation.updateReview), updateReview);

export default router;
