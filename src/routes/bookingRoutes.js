import express from 'express';
import {
  acceptBooking,
  bookVendor,
  declineBooking,
  getPlannerBookings,
  getVendorBookings
} from '../controllers/bookingController.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { bookingValidation, validate } from '../middleware/validation.js';

const router = express.Router();

router.use(protect);

router.post('/', restrictTo('PLANNER'), validate(bookingValidation.bookVendor), bookVendor);
router.get('/planner', restrictTo('PLANNER'), validate(bookingValidation.listBookings), getPlannerBookings);
router.get('/vendor', restrictTo('VENDOR'), validate(bookingValidation.listBookings), getVendorBookings);
router.post('/:id/accept', restrictTo('VENDOR'), validate(bookingValidation.bookingId), acceptBooking);
router.post('/:id/decline', restrictTo('VENDOR'), validate(bookingValidation.respondToBooking), declineBooking);

export default router;
