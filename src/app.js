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
import bookingRoutes from './routes/bookingRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import plannerRoutes from './routes/plannerRoutes.js';
import { uploadAvatar } from './controllers/authController.js';
import { protect } from './middleware/auth.js';
import upload from './middleware/upload.js';

dotenv.config();

const app = express();

/* =========================
   CORS CONFIGURATION
========================= */

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000',

  // EventConnect Vercel frontend
  'https://event-connect-frontend-nine.vercel.app',

  // Horizon Circle Vercel frontend
  'https://orange-herizon-circle-a7pj-delta.vercel.app'
];

const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...new Set([
    ...defaultAllowedOrigins,
    ...configuredOrigins
  ])
];

console.log('✅ Allowed CORS origins:', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header
      // e.g. Postman, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error('❌ CORS blocked origin:', origin);

      return callback(
        new Error(`Origin ${origin} is not allowed by CORS`)
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept'
    ]
  })
);

/* =========================
   SECURITY
========================= */

app.use(helmet());

/* =========================
   BODY PARSING
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   RATE LIMITING
========================= */

const limiter = rateLimit({
  windowMs:
    (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) *
    60 *
    1000,

  max:
    parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) ||
    100,

  message: {
    success: false,
    message: 'Too many requests, please try again later'
  }
});

app.use('/api', limiter);

/* =========================
   ROOT ROUTE
========================= */

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the EventConnect API',
    version: '1.0.0',
    documentation: '/health',
    status: 'Running'
  });
});

/* =========================
   HEALTH CHECK
========================= */

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'EventConnect API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/* =========================
   FILE UPLOAD
========================= */

app.post(
  [
    '/api/user/avatar',
    '/api/user/avatar/upload',
    '/api/upload/avatar',
    '/api/uploads/avatar',
    '/api/upload',
    '/api/uploads',
    '/api/media/avatar',
    '/api/media/upload'
  ],
  protect,
  upload.any(),
  uploadAvatar
);

/* =========================
   API ROUTES
========================= */

app.use('/api/auth', authRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/planner', plannerRoutes);

/* =========================
   404 HANDLER
========================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */

app.use(errorHandler);

export default app;