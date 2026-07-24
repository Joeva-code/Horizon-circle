import express from 'express';
import { signup, login, getMe, forgotPassword, resetPassword, resendVerification, verifyEmail, refresh, logout } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate, authValidation } from '../middleware/validation.js';
import { googleLogin } from "../controllers/oauthController.js";

const router = express.Router();

// `/register` is retained for the deployed web client. New clients should use
// the clearer `/signup` endpoint; both use the exact same validation and flow.
router.post(['/signup', '/register'], validate(authValidation.signup), signup);
router.post('/login', validate(authValidation.login), login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/google', googleLogin);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;
