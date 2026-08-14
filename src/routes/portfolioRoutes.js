import express from 'express';
import {
  getVendorPortfolio,
  createPortfolioItem,
  getMyPortfolio,
  updatePortfolioItem,
  deletePortfolioItem
} from '../controllers/portfolioController.js';

import { protect, restrictTo } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Public endpoint for planners to view vendor portfolio
router.get('/vendors/:vendorId/portfolio', getVendorPortfolio);

// Protected vendor portfolio endpoints
router.use('/portfolio', protect, restrictTo("VENDOR"));

router.get('/portfolio', getMyPortfolio);
router.post('/portfolio', upload.single('media'), createPortfolioItem);
router.put('/portfolio/:id', updatePortfolioItem);
router.delete('/portfolio/:id', deletePortfolioItem);

export default router;
