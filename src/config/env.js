/**
 * Environment Configuration
 * 
 * Centralized environment variable access with validation.
 */

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '15m',
  REFRESH_TOKEN_EXPIRE: process.env.REFRESH_TOKEN_EXPIRE || '30d',
  
  // Maxify Integration
  MAXIFY_INTEGRATION_MODE: process.env.MAXIFY_INTEGRATION_MODE || 'demo',
  MAXIFY_API_KEY: process.env.MAXIFY_API_KEY,
  MAXIFY_API_URL: process.env.MAXIFY_API_URL,
  MAXIFY_WEBHOOK_SECRET: process.env.MAXIFY_WEBHOOK_SECRET,
  
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW || 15,
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  
  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  OAUTH_SUCCESS_REDIRECT: process.env.OAUTH_SUCCESS_REDIRECT,
};

/**
 * Validate that required environment variables are set
 */
export const validateEnv = () => {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !ENV[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate Maxify configuration if in production mode
  if (ENV.MAXIFY_INTEGRATION_MODE === 'production') {
    const maxifyRequired = ['MAXIFY_API_KEY', 'MAXIFY_API_URL'];
    const maxifyMissing = maxifyRequired.filter(key => !ENV[key]);
    
    if (maxifyMissing.length > 0) {
      throw new Error(
        `Maxify production mode requires: ${maxifyMissing.join(', ')}. ` +
        'Either set these environment variables or switch to demo mode with MAXIFY_INTEGRATION_MODE=demo.'
      );
    }
  }
};
