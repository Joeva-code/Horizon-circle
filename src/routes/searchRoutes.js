import express from 'express';
import { searchVendors, getVendorById, getCategories } from '../controllers/searchController.js';

const router = express.Router();

router.get('/vendors', searchVendors);
router.get('/vendors/:id', getVendorById);
router.get('/categories', getCategories);

export default router;