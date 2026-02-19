// Server configuration
// Centralized configuration for the Express server

export const PORT = process.env.PORT || 5000;

// Allowed origins for CORS (add VPS URL or set PUBLIC_URL env, e.g. http://187.77.87.208:5000)
const DEFAULT_ORIGINS = ["http://localhost:5000"];
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const ALLOWED_ORIGINS = PUBLIC_URL
  ? [...DEFAULT_ORIGINS, PUBLIC_URL.replace(/\/$/, "")]
  : DEFAULT_ORIGINS;

export const CORS_OPTIONS = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "Cache-Control"],
  exposedHeaders: ["Content-Type", "Cache-Control"],
  optionsSuccessStatus: 200,
  preflightContinue: false,
};
