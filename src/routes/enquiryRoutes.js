import express from 'express';
import {
  acceptEnquiry,
  createEnquiry,
  declineEnquiry,
  getPlannerEnquiries,
  getVendorEnquiries,
  updateEnquiryStatus,
  getEnquiryDetails,
  openEnquiryChat
} from '../controllers/enquiryController.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { validate, enquiryValidation } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.post('/', restrictTo('PLANNER'), validate(enquiryValidation.createEnquiry), createEnquiry);
router.get('/planner', restrictTo('PLANNER'), validate(enquiryValidation.listEnquiries), getPlannerEnquiries);
router.get('/vendor', restrictTo('VENDOR'), validate(enquiryValidation.listEnquiries), getVendorEnquiries);
router.post('/:id/accept', restrictTo('VENDOR'), validate(enquiryValidation.respondToEnquiry), acceptEnquiry);
router.post('/:id/decline', restrictTo('VENDOR'), validate(enquiryValidation.respondToEnquiry), declineEnquiry);
router.get('/:id/chat', validate(enquiryValidation.enquiryId), openEnquiryChat);
router.get('/:id', validate(enquiryValidation.enquiryId), getEnquiryDetails);
router.put('/:id/status', restrictTo('VENDOR'), validate(enquiryValidation.updateStatus), updateEnquiryStatus);

export default router;
