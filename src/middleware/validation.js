import { body, param, query, validationResult } from 'express-validator';

export const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({
      success: false,
      errors: errors.array()
    });
  };
};

// Common validation rules
export const authValidation = {
  register: [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('firstName').optional().isString().trim(),
    body('lastName').optional().isString().trim(),
    body('role').isIn(['PLANNER', 'VENDOR']).withMessage('Invalid role selected')
  ],
  login: [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
  ]
};

export const vendorValidation = {
  createProfile: [
    body('businessName').notEmpty().withMessage('Business name is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('location').notEmpty().withMessage('Location is required'),
    body('description').optional().isString().trim(),
    body('priceRange').optional().isString().trim()
  ]
};

export const enquiryValidation = {
  createEnquiry: [
    body('vendorId').isUUID().withMessage('Invalid vendor ID'),
    body('eventType').notEmpty().withMessage('Event type is required'),
    body('eventDate').isISO8601().toDate().withMessage('Invalid event date format'),
    body('eventLocation').notEmpty().withMessage('Event location is required'),
    body('guestCount').optional().isInt({ min: 1 }).toInt().withMessage('Guest count must be a positive number'),
    body('budget').optional().isNumeric().toFloat().withMessage('Budget must be a number'),
    body('specialNotes').optional().isString().trim().isLength({ max: 2000 }).withMessage('Special notes cannot exceed 2,000 characters')
  ],
  listEnquiries: [
    query('status').optional().isIn(['NEW', 'RESPONDED', 'BOOKED']).withMessage('Invalid enquiry status'),
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be at least 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100')
  ],
  enquiryId: [
    param('id').isUUID().withMessage('Invalid enquiry ID')
  ],
  updateStatus: [
    param('id').isUUID().withMessage('Invalid enquiry ID'),
    body('status').isIn(['RESPONDED', 'BOOKED']).withMessage('Status must be RESPONDED or BOOKED'),
    body('responseMessage')
      .if(body('status').equals('RESPONDED'))
      .trim()
      .notEmpty().withMessage('A response message is required when responding')
      .isLength({ max: 2000 }).withMessage('Response message cannot exceed 2,000 characters')
  ]
};

export const plannerValidation = {
  updateProfile: [
    body('firstName').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('First name must be between 1 and 100 characters'),
    body('lastName').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Last name must be between 1 and 100 characters'),
    body('avatar').optional({ nullable: true }).isURL().withMessage('Avatar must be a valid URL')
  ]
};

export const reviewValidation = {
  createReview: [
    body('enquiryId').isUUID().withMessage('Invalid enquiry ID'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('review').notEmpty().isLength({ min: 3 }).withMessage('Review must be at least 3 characters')
  ],
  updateReview: [
    param('id').isUUID().withMessage('Invalid review ID'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('review').notEmpty().isLength({ min: 3 }).withMessage('Review must be at least 3 characters')
  ]
};
