import { prisma } from '../config/database.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { clearRefreshCookie, getRefreshToken, issueTokenPair, revokeRefreshToken, rotateRefreshToken, setRefreshCookie, toPublicUser } from '../services/authService.js';
import { ensureEmailConfigured, sendPasswordResetEmail, sendVerificationEmail } from '../services/emailService.js';

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const newEmailToken = () => crypto.randomBytes(32).toString('hex');
const isStrongPassword = (password) => (
  typeof password === 'string'
  && password.length >= 8
  && /[a-z]/.test(password)
  && /[A-Z]/.test(password)
  && /\d/.test(password)
  && /[^A-Za-z0-9\s]/.test(password)
);

// @desc    Sign up user
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (req, res) => {
  try {
    const { email, password, firstName, lastName, accountType } = req.body;
    ensureEmailConfigured();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = newEmailToken();
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: accountType,
        emailVerificationToken: tokenHash(verificationToken),
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    // Create the profile belonging to the selected account type.
    if (user.role === 'VENDOR') {
      await prisma.vendorProfile.create({
        data: {
          userId: user.id,
          businessName: '',
          category: '',
          location: '',
          isPublished: false
        }
      });
    } else {
      await prisma.plannerProfile.create({
        data: { userId: user.id }
      });
    }

    await sendVerificationEmail({ email: user.email, firstName: user.firstName, token: verificationToken });

    // Registration is intentionally not an authenticated session. The user can
    // sign in only after the verification link marks the account as verified.
    res.status(202).json({
      success: true,
      message: 'Check your email to verify your account and complete sign up.',
      data: toPublicUser(user)
    });

  } catch (error) {
    console.error('Signup error:', error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error registering user'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email before signing in' });
    }

    // Verify password
    const isPasswordMatch = user.password && await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        lastLogin: new Date()
      }
    });

    // Remove password before sending response
    const { accessToken, refreshToken } = await issueTokenPair(user);
    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      token: accessToken,
      data: toPublicUser(user)
    });

  } catch (error) {
    console.error('Login error:', error);

    res.status(500).json({
      success: false,
      message: 'Error logging in'
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
  where: {
    id: req.user.id
  },
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    isVerified: true,
    isActive: true,
    lastLogin: true,
    createdAt: true,
    updatedAt: true,
    vendorProfile: true
  }
});

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { password, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('Get user error:', error);

    res.status(500).json({
      success: false,
      message: 'Error fetching user data'
    });
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        email
      }
    });

    if (user) {
      ensureEmailConfigured();
      const resetToken = newEmailToken();
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: tokenHash(resetToken), passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) }
      });
      await sendPasswordResetEmail({ email: user.email, firstName: user.firstName, token: resetToken });
    }

    // Same response prevents account enumeration.
    res.status(200).json({ success: true, message: 'If an account exists, password reset instructions have been sent.' });

  } catch (error) {
    console.error('Forgot password error:', error);

    res.status(500).json({
      success: false,
      message: 'Error processing password reset request'
    });
  }
};

// @desc    Set a new password from a one-time password-reset link
// @route   POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || !token || !isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'A valid token and a password of at least 8 characters with uppercase, lowercase, a number, and a special character are required'
      });
    }
    const user = await prisma.user.findFirst({ where: { passwordResetToken: tokenHash(token), passwordResetExpires: { gt: new Date() } } });
    if (!user) return res.status(400).json({ success: false, message: 'Password reset token is invalid or expired' });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(password, 10), passwordResetToken: null, passwordResetExpires: null, lastLogin: new Date() }
    });
    await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!updatedUser.isVerified) {
      return res.status(200).json({
        success: true,
        message: 'Password reset successfully. Please verify your email before signing in.',
        data: toPublicUser(updatedUser)
      });
    }

    const { accessToken, refreshToken } = await issueTokenPair(updatedUser);
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ success: true, message: 'Password reset successfully', token: accessToken, data: toPublicUser(updatedUser) });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Unable to reset password' });
  }
};

// @desc    Verify an email from the one-time verification link
// @route   GET /api/auth/verify-email?token=...
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (typeof token !== 'string' || !token) return res.status(400).json({ success: false, message: 'Verification token is required' });
    const user = await prisma.user.findFirst({ where: { emailVerificationToken: tokenHash(token), emailVerificationExpires: { gt: new Date() } } });
    if (!user) return res.status(400).json({ success: false, message: 'Verification link is invalid or expired' });
    await prisma.user.update({ where: { id: user.id }, data: { isVerified: true, emailVerificationToken: null, emailVerificationExpires: null } });
    res.status(200).json({ success: true, message: 'Email verified successfully. You can now sign in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ success: false, message: 'Unable to verify email' });
  }
};

// @desc    Send a replacement email-verification link
// @route   POST /api/auth/resend-verification
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = typeof email === 'string' ? await prisma.user.findUnique({ where: { email: email.toLowerCase() } }) : null;
    if (user && !user.isVerified) {
      ensureEmailConfigured();
      const verificationToken = newEmailToken();
      await prisma.user.update({ where: { id: user.id }, data: { emailVerificationToken: tokenHash(verificationToken), emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
      await sendVerificationEmail({ email: user.email, firstName: user.firstName, token: verificationToken });
    }
    res.status(200).json({ success: true, message: 'If the account needs verification, a link has been sent.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Unable to send verification email' });
  }
};

// @desc    Rotate a refresh token and return a short-lived access token
// @route   POST /api/auth/refresh
// @access  Public (requires the HTTP-only refresh cookie, or body token for native clients)
export const refresh = async (req, res) => {
  try {
    const { accessToken, refreshToken } = await rotateRefreshToken(getRefreshToken(req));
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ success: true, token: accessToken });
  } catch (error) {
    clearRefreshCookie(res);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Unable to refresh token' });
  }
};

// @desc    Revoke the current refresh token and clear its cookie
// @route   POST /api/auth/logout
// @access  Public
export const logout = async (req, res) => {
  try {
    await revokeRefreshToken(getRefreshToken(req));
    clearRefreshCookie(res);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to log out' });
  }
};
