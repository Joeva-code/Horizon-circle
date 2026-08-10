import express from 'express';
import {
  createEvent,
  getEvent,
  listEvents,
  updateEvent,
  addVendor,
  removeVendor,
  getReadiness,
  launchEvent,
  getMaxifyInfo,
} from '../controllers/eventController.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { eventValidation, validate } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(protect);
router.use(restrictTo('PLANNER'));

// Event CRUD
router.post('/', validate(eventValidation.createEvent), createEvent);
router.get('/', validate(eventValidation.listEvents), listEvents);
router.get('/:id', validate(eventValidation.eventId), getEvent);
router.patch('/:id', validate(eventValidation.eventId), validate(eventValidation.updateEvent), updateEvent);

// Vendor management
router.post('/:id/vendors', validate(eventValidation.eventId), validate(eventValidation.addVendor), addVendor);
router.delete('/:id/vendors/:vendorId', validate(eventValidation.eventId), validate(eventValidation.vendorId), removeVendor);

// Readiness and launch
router.get('/:id/readiness', validate(eventValidation.eventId), getReadiness);
router.post('/:id/launch', validate(eventValidation.eventId), launchEvent);

// Maxify integration
router.get('/:id/maxify/info', validate(eventValidation.eventId), getMaxifyInfo);

export default router;
