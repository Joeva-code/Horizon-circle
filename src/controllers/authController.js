import { prisma } from '../config/database.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { clearRefreshCookie, getRefreshToken, issueTokenPair, revokeRefreshToken, rotateRefreshToken, setRefreshCookie, toPublicUser } from '../services/authService.js';
import { ensureEmailConfigured, sendPasswordResetEmail } from '../services/emailService.js';
import { enqueueVerificationEmail } from '../services/emailJobService.js';

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
    const { email, password, firstName, lastName, accountType, termsAccepted } = req.body;
    // Keep this guard in the controller as well as the route validator so a
    // caller cannot create an account if the handler is reused elsewhere.
    if (termsAccepted !== true) {
      return res.status(400).json({
        success: false,
        message: 'You must accept the terms and conditions before signing up'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = newEmailToken();
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: accountType,
          termsAcceptedAt: new Date(),
          emailVerificationToken: tokenHash(verificationToken),
          emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
      if (createdUser.role === 'VENDOR') {
        await tx.vendorProfile.create({ data: { userId: createdUser.id, businessName: '', category: '', location: '', isPublished: false } });
      } else {
        await tx.plannerProfile.create({ data: { userId: createdUser.id } });
      }
      await enqueueVerificationEmail(tx, { user: createdUser, token: verificationToken });
      return createdUser;
    });

    // Registration does not create a session. Users can sign in immediately;
    // the client can use isVerified to prompt them to verify their email.
    res.status(202).json({
      success: true,
      message: 'Signup successful; check your email.',
      data: toPublicUser(user)
    });

  } catch (error) {
    console.error('Signup error:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }
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
    avatar: true,
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

// @desc    Upload current user's avatar
// @route   POST /api/auth/avatar
// @access  Private
export const uploadAvatar = async (req, res) => {
  try {
    const file = req.file || req.files?.[0];

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image'
      });
    }

    const avatar = file.path;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        isVerified: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatar,
        avatarUrl: avatar,
        user
      }
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error uploading avatar'
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
      const verificationToken = newEmailToken();
      await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({ where: { id: user.id }, data: { emailVerificationToken: tokenHash(verificationToken), emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
        await enqueueVerificationEmail(tx, { user: updatedUser, token: verificationToken });
      });
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
