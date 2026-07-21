import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { issueTokenPair, setRefreshCookie, toPublicUser } from '../services/authService.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || "7d"
    }
  );
};

export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Google token is required"
      });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    const {
      email,
      given_name,
      family_name,
      picture,
      sub,
      email_verified: emailVerified
    } = payload;

    if (!email || !emailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Google did not provide a verified email address'
      });
    }

    let user = await prisma.user.findUnique({
      where: {
        email
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          firstName: given_name,
          lastName: family_name,
          avatar: picture,
          provider: "GOOGLE",
          providerId: sub,
          isVerified: true
        }
      });
    }

    user = await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        lastLogin: new Date(),
        isVerified: true,
        provider: "GOOGLE",
        providerId: sub,
        avatar: user.avatar || picture
      }
    });

    const { accessToken, refreshToken } = await issueTokenPair(user);
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      token: accessToken,
      data: toPublicUser(user)
    });

  } catch (error) {
    console.error(error);

    return res.status(401).json({
      success: false,
      message: "Invalid Google token"
    });
  }
};
