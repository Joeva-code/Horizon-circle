import express from 'express';
import {
  createEnquiry,
  getPlannerEnquiries,
  getVendorEnquiries,
  updateEnquiryStatus,
  getEnquiryDetails
} from '../controllers/enquiryController.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { validate, enquiryValidation } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.post('/', restrictTo('PLANNER'), validate(enquiryValidation.createEnquiry), createEnquiry);
router.get('/planner', restrictTo('PLANNER'), validate(enquiryValidation.listEnquiries), getPlannerEnquiries);
router.get('/vendor', restrictTo('VENDOR'), validate(enquiryValidation.listEnquiries), getVendorEnquiries);
router.get('/:id', validate(enquiryValidation.enquiryId), getEnquiryDetails);
router.put('/:id/status', restrictTo('VENDOR'), validate(enquiryValidation.updateStatus), updateEnquiryStatus);

export default router;
