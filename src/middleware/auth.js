import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
    });

    if (!user) {
      console.warn('[auth] Token valid but user not found', {
        tokenUserId: decoded.id,
        tokenRole: decoded.role,
        endpoint: req.originalUrl,
        method: req.method,
      });
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive && user.role !== 'VENDOR') {
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before continuing",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    console.error("Authentication Error:", error);

    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.warn('[auth] restrictTo called without authenticated user', {
        endpoint: req.originalUrl,
        method: req.method,
        requiredRoles: roles,
      });
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    if (!roles.includes(req.user.role)) {
      console.warn('[auth] Authorization denied', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl,
        method: req.method,
      });
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    next();
  };
};
