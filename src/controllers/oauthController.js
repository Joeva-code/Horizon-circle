// Google sign-in is temporarily disabled
// import { OAuth2Client } from "google-auth-library";
// import { prisma } from "../config/database.js";
// import { issueTokenPair, setRefreshCookie, toPublicUser } from '../services/authService.js';
//
// const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
//
// export const googleLogin = async (req, res) => {
//   try {
//     const { token, accountType, role, termsAccepted } = req.body;
//
//     if (!token) {
//       return res.status(400).json({
//         success: false,
//         message: "Google token is required"
//       });
//     }
//
//     const selectedAccountType = accountType ?? role ?? 'PLANNER';
//     const requestedRole = typeof selectedAccountType === 'string'
//       ? selectedAccountType.trim().toUpperCase()
//       : '';
//     if (!['PLANNER', 'VENDOR'].includes(requestedRole)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Account type must be Vendor or Planner'
//       });
//     }
//
//     const ticket = await client.verifyIdToken({
//       idToken: token,
//       audience: process.env.GOOGLE_CLIENT_ID
//     });
//
//     const payload = ticket.getPayload();
//
//     const {
//       email,
//       given_name,
//       family_name,
//       picture,
//       sub,
//       email_verified: emailVerified
//     } = payload;
//
//     if (!email || !emailVerified) {
//       return res.status(401).json({
//         success: false,
//         message: 'Google did not provide a verified email address'
//       });
//     }
//
//     let user = await prisma.user.findUnique({
//       where: {
//         email
//       }
//     });
//
//     if (!user) {
//       if (termsAccepted !== true) {
//         return res.status(400).json({
//           success: false,
//           message: 'You must accept the terms and conditions before signing up'
//         });
//       }
//
//       user = await prisma.$transaction(async (tx) => {
//         const newUser = await tx.user.create({
//           data: {
//             email,
//             firstName: given_name,
//             lastName: family_name,
//             avatar: picture,
//             role: requestedRole,
//             provider: "GOOGLE",
//             providerId: sub,
//             isVerified: true,
//             termsAcceptedAt: new Date()
//           }
//         });
//
//         if (requestedRole === 'VENDOR') {
//           await tx.vendorProfile.create({
//             data: {
//               userId: newUser.id,
//               businessName: '',
//               category: '',
//               location: '',
//               isPublished: false
//             }
//           });
//         } else {
//           await tx.plannerProfile.create({
//             data: { userId: newUser.id }
//           });
//         }
//
//         return newUser;
//       });
//     }
//
//     user = await prisma.user.update({
//       where: {
//         id: user.id
//       },
//       data: {
//         lastLogin: new Date(),
//         isVerified: true,
//         avatar: user.avatar || picture
//       }
//     });
//
//     const { accessToken, refreshToken } = await issueTokenPair(user);
//     setRefreshCookie(res, refreshToken);
//
//     return res.status(200).json({
//       success: true,
//       token: accessToken,
//       data: toPublicUser(user)
//     });
//
//   } catch (error) {
//     console.error(error);
//
//     return res.status(401).json({
//       success: false,
//       message: "Invalid Google token"
//     });
//   }
// };
