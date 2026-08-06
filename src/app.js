import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import errorHandler from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import enquiryRoutes from './routes/enquiryRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import plannerRoutes from './routes/plannerRoutes.js';
import { uploadAvatar } from './controllers/authController.js';
import { protect } from './middleware/auth.js';
import upload from './middleware/upload.js';

dotenv.config();

const app = express();

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://orange-herizon-circle-a7pj-delta.vercel.app'
];
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...configuredOrigins])];

// Rate limiting
const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  }
});

// Middleware
app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header include server-to-server calls and
    // health checks. Browser requests must be explicitly allow-listed.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiter to API routes
app.use('/api', limiter);

/**
 * Root Route
 */
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the EventConnect API',
    version: '1.0.0',
    documentation: '/health',
    status: 'Running'
  });
});

/**
 * Health Check
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'EventConnect API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * API Routes
 */
app.post([
  '/api/user/avatar',
  '/api/user/avatar/upload',
  '/api/upload/avatar',
  '/api/uploads/avatar',
  '/api/upload',
  '/api/uploads',
  '/api/media/avatar',
  '/api/media/upload'
], protect, upload.any(), uploadAvatar);

app.use('/api/auth', authRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/planner', plannerRoutes);

/**
 * 404 Handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

/**
 * Global Error Handler
 */
app.use(errorHandler);

export default app;
