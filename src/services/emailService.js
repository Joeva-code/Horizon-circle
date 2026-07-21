import nodemailer from 'nodemailer';

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`${name} is not configured`);
    error.statusCode = 503;
    throw error;
  }
  return value;
};

export const ensureEmailConfigured = () => {
  required('SMTP_USER');
  required('SMTP_PASS');
};

const transporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || 'true') === 'true',
  auth: { user: required('SMTP_USER'), pass: required('SMTP_PASS') }
});

const link = (baseUrl, token) => {
  const url = new URL(baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
};

const send = async ({ to, subject, text, html }) => transporter().sendMail({
  from: process.env.EMAIL_FROM || required('SMTP_USER'), to, subject, text, html
});

export const sendVerificationEmail = ({ email, firstName, token }) => {
  const url = link(process.env.EMAIL_VERIFICATION_URL || 'http://localhost:5000/api/auth/verify-email', token);
  return send({
    to: email,
    subject: 'Verify your EventConnect email address',
    text: `Hello ${firstName || ''}, verify your email address: ${url}`,
    html: `<p>Hello ${firstName || ''},</p><p>Please <a href="${url}">verify your EventConnect email address</a>. This link expires in 24 hours.</p>`
  });
};

export const sendPasswordResetEmail = ({ email, firstName, token }) => {
  const url = link(process.env.PASSWORD_RESET_URL || 'http://localhost:3000/reset-password', token);
  return send({
    to: email,
    subject: 'Reset your EventConnect password',
    text: `Hello ${firstName || ''}, reset your password: ${url}`,
    html: `<p>Hello ${firstName || ''},</p><p>Please <a href="${url}">reset your EventConnect password</a>. This link expires in one hour.</p>`
  });
};
