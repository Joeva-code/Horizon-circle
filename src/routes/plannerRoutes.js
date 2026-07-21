import express from 'express';
import { getDashboard, getProfile, getStats, updateProfile } from '../controllers/plannerController.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { plannerValidation, validate } from '../middleware/validation.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('PLANNER'));

router.route('/profile')
  .get(getProfile)
  .put(validate(plannerValidation.updateProfile), updateProfile);

router.get('/dashboard', getDashboard);
router.get('/stats', getStats);

export default router;
