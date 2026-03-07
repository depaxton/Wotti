// Server configuration
// Centralized configuration for the Express server

export const PORT = process.env.PORT || 5000;

// Allowed origins for CORS (add more via PUBLIC_URL env, e.g. http://your-domain.com:5000)
const DEFAULT_ORIGINS = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://187.77.87.208:5000", // default VPS
];
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const ALLOWED_ORIGINS = PUBLIC_URL
  ? [...DEFAULT_ORIGINS, PUBLIC_URL.replace(/\/$/, "")]
  : DEFAULT_ORIGINS;

export const CORS_OPTIONS = {
  origin: (origin, callback) => callback(null, true), // מאפשר בקשות מכל מקור
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "Cache-Control"],
  exposedHeaders: ["Content-Type", "Cache-Control"],
  optionsSuccessStatus: 200,
  preflightContinue: false,
};
