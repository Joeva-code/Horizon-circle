import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';

const GOOGLE_PROVIDER = 'GOOGLE';

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`${name} is not configured`);
    error.statusCode = 503;
    throw error;
  }
  return value;
};

const buildAppToken = (user) => jwt.sign(
  { id: user.id, role: user.role },
  requireEnv('JWT_SECRET'),
  { expiresIn: process.env.JWT_EXPIRE || '7d' }
);

const toSafeUser = ({ password, passwordResetToken, passwordResetExpires, ...user }) => user;

export const verifyGoogleCredential = async (credential) => {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    const error = new Error('Google did not provide a verified email address');
    error.statusCode = 401;
    throw error;
  }

  return {
    providerId: payload.sub,
    email: payload.email.toLowerCase(),
    firstName: payload.given_name || null,
    lastName: payload.family_name || null,
    avatar: payload.picture || null
  };
};

export const findOrCreateGoogleUser = async (googleUser, role = 'PLANNER') => {
  let user = await prisma.user.findFirst({
    where: { provider: GOOGLE_PROVIDER, providerId: googleUser.providerId }
  });

  if (user) return user;

  // A verified Google email may safely be linked to an existing local account.
  user = await prisma.user.findUnique({ where: { email: googleUser.email } });
  if (user) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        provider: GOOGLE_PROVIDER,
        providerId: googleUser.providerId,
        avatar: user.avatar || googleUser.avatar,
        isVerified: true,
        lastLogin: new Date()
      }
    });
  }

  try {
    user = await prisma.user.create({
      data: {
        ...googleUser,
        provider: GOOGLE_PROVIDER,
        role,
        isVerified: true,
        lastLogin: new Date()
      }
    });
    if (role === 'VENDOR') {
      await prisma.vendorProfile.create({
        data: { userId: user.id, businessName: '', category: '', location: '', isPublished: true }
      });
    }
    return user;
  } catch (error) {
    // Concurrent first logins can race on the unique email/provider constraints.
    if (error.code === 'P2002') {
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email: googleUser.email }, { provider: GOOGLE_PROVIDER, providerId: googleUser.providerId }] }
      });
      if (existing) return existing;
    }
    throw error;
  }
};

export const authenticateGoogleCredential = async (credential, role) => {
  const googleUser = await verifyGoogleCredential(credential);
  const user = await findOrCreateGoogleUser(googleUser, role);
  if (!user.isActive && user.role !== 'VENDOR') {
    const error = new Error('Your account has been deactivated');
    error.statusCode = 401;
    throw error;
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  return { token: buildAppToken(user), user: toSafeUser(user) };
};

export const getGoogleAuthorizationUrl = (role) => {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = requireEnv('GOOGLE_REDIRECT_URI');
  const state = jwt.sign({ purpose: 'google-oauth', role }, requireEnv('JWT_SECRET'), { expiresIn: '10m' });
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  return client.generateAuthUrl({ access_type: 'offline', scope: ['openid', 'email', 'profile'], prompt: 'select_account', state });
};

export const authenticateGoogleAuthorizationCode = async (code, state) => {
  let stateData;
  try {
    stateData = jwt.verify(state, requireEnv('JWT_SECRET'));
  } catch {
    const error = new Error('OAuth state is invalid or expired');
    error.statusCode = 400;
    throw error;
  }
  if (stateData.purpose !== 'google-oauth' || !['PLANNER', 'VENDOR'].includes(stateData.role)) {
    const error = new Error('OAuth state is invalid');
    error.statusCode = 400;
    throw error;
  }
  const client = new OAuth2Client(requireEnv('GOOGLE_CLIENT_ID'), requireEnv('GOOGLE_CLIENT_SECRET'), requireEnv('GOOGLE_REDIRECT_URI'));
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    const error = new Error('Google did not return an ID token');
    error.statusCode = 401;
    throw error;
  }
  return authenticateGoogleCredential(tokens.id_token, stateData.role);
};
