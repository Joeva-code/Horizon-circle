import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';

const REFRESH_COOKIE = 'refreshToken';

const requireSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return process.env.JWT_SECRET;
};

const durationMs = (value) => {
  const match = /^(\d+)\s*([dhm])$/i.exec(value || '30d');
  if (!match) throw new Error('REFRESH_TOKEN_EXPIRE must use d, h, or m (for example 30d)');
  const multiplier = { d: 86_400_000, h: 3_600_000, m: 60_000 }[match[2].toLowerCase()];
  return Number(match[1]) * multiplier;
};

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const newRefreshToken = () => crypto.randomBytes(64).toString('base64url');

export const toPublicUser = ({ password, passwordResetToken, passwordResetExpires, emailVerificationToken, emailVerificationExpires, refreshTokens, ...user }) => user;

export const createAccessToken = (user) => jwt.sign(
  { id: user.id, role: user.role },
  requireSecret(),
  { expiresIn: process.env.JWT_EXPIRE || '15m' }
);

const createTokenPair = async (user, client = prisma) => {
  const refreshToken = newRefreshToken();
  await client.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: tokenHash(refreshToken),
      expiresAt: new Date(Date.now() + durationMs(process.env.REFRESH_TOKEN_EXPIRE || '30d'))
    }
  });
  return { accessToken: createAccessToken(user), refreshToken };
};

export const issueTokenPair = (user) => createTokenPair(user);

export const rotateRefreshToken = async (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') {
    const error = new Error('Refresh token is required');
    error.statusCode = 401;
    throw error;
  }

  const hash = tokenHash(rawToken);
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: { user: true }
  });

  if (!record) {
    const error = new Error('Invalid refresh token');
    error.statusCode = 401;
    throw error;
  }
  if (record.revokedAt) {
    // Reuse of a rotated token indicates possible token theft: revoke the user's sessions.
    await prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    const error = new Error('Refresh token reuse detected. Please sign in again.');
    error.statusCode = 401;
    throw error;
  }
  if (record.expiresAt <= new Date()) {
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    const error = new Error('Refresh token has expired');
    error.statusCode = 401;
    throw error;
  }
  if (!record.user.isActive && record.user.role !== 'VENDOR') {
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    const error = new Error('Your account has been deactivated');
    error.statusCode = 401;
    throw error;
  }
  if (!record.user.isVerified) {
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    const error = new Error('Please verify your email before continuing');
    error.statusCode = 403;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    const pair = await createTokenPair(record.user, tx);
    return { ...pair, user: record.user };
  });
};

export const revokeRefreshToken = async (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: tokenHash(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
};

const cookieOptions = () => {
  const sameSite = (process.env.REFRESH_COOKIE_SAME_SITE || 'lax').toLowerCase();
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite: ['lax', 'strict', 'none'].includes(sameSite) ? sameSite : 'lax',
    path: '/api/auth',
    maxAge: durationMs(process.env.REFRESH_TOKEN_EXPIRE || '30d')
  };
};

export const setRefreshCookie = (res, refreshToken) => res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
export const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, cookieOptions());

export const getRefreshToken = (req) => {
  if (req.body?.refreshToken) return req.body.refreshToken;
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.slice(`${REFRESH_COOKIE}=`.length)) : undefined;
};
