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
  signup: [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password')
      .isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 })
      .withMessage('Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character'),
    body('firstName').optional().isString().trim(),
    body('lastName').optional().isString().trim(),
    body().custom((_, { req }) => {
      // `accountType` is the public registration field. Accept `role` too so
      // existing clients keep working while they migrate.
      const accountType = req.body.accountType ?? req.body.role;

      if (typeof accountType !== 'string') {
        throw new Error('Account type must be Vendor or Planner');
      }

      const normalizedAccountType = accountType.trim().toUpperCase();
      if (!['PLANNER', 'VENDOR'].includes(normalizedAccountType)) {
        throw new Error('Account type must be Vendor or Planner');
      }

      req.body.accountType = normalizedAccountType;
      return true;
    })
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
    body('avatar').optional({ nullable: true }).isURL().withMessage('Avatar must be a valid URL'),
    body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 30 }).withMessage('Phone must be at most 30 characters'),
    body('location').optional({ nullable: true }).isString().trim().isLength({ max: 200 }).withMessage('Location must be at most 200 characters'),
    body('bio').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }).withMessage('Bio must be at most 2,000 characters'),
    body('preferredEventTypes').optional().isArray({ max: 20 }).withMessage('Preferred event types must be an array of up to 20 items'),
    body('preferredEventTypes.*').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Each preferred event type must be between 1 and 100 characters')
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
