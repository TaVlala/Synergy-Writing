const DEV_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://0.0.0.0:5173',
  'http://0.0.0.0:5174',
];

const isProd = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PROD_CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const CORS_ORIGINS = isProd ? (PROD_CORS_ORIGINS.length ? PROD_CORS_ORIGINS : true) : DEV_CORS_ORIGINS;

function logConfigWarnings() {
  if (isProd && !process.env.JWT_SECRET) {
    console.warn('[auth] JWT_SECRET is not set in production; tokens are insecure.');
  }
  if (isProd && CORS_ORIGINS === true) {
    console.warn('[cors] CORS_ORIGINS is not set in production; allowing all origins.');
  }
}

module.exports = {
  isProd,
  JWT_SECRET,
  CORS_ORIGINS,
  logConfigWarnings,
};
