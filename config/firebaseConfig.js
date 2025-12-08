// Firebase configuration and scheduling settings

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBEefVPvPgGp2eoESZyKP3BDYVeFWzURWo",
  authDomain: "woti-86d84.firebaseapp.com",
  projectId: "woti-86d84",
  storageBucket: "woti-86d84.firebasestorage.app",
  messagingSenderId: "234173640784",
  appId: "1:234173640784:web:61b30ae101abf7b1fea155",
  measurementId: "G-NKV6KMFW75",
  collection: "users",

  // Intervals (in milliseconds)
  statusCheckIntervalMs: 60 * 60 * 1000, // every hour
  upsertIntervalMs: 2 * 60 * 60 * 1000, // every 2 hours

  // Trial configuration
  trialDays: 14,

  // Optional fallback phone if provided via environment (otherwise set per-session)
  defaultPhone: process.env.FIREBASE_DEFAULT_PHONE || null,
};

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

export const FIREBASE_ENDPOINTS = {
  collectionUrl: `${FIRESTORE_BASE_URL}/${FIREBASE_CONFIG.collection}`,
  documentUrl: (documentId) =>
    `${FIRESTORE_BASE_URL}/${FIREBASE_CONFIG.collection}/${encodeURIComponent(documentId)}`,
};

export function getFirestoreAuthParams() {
  return { key: FIREBASE_CONFIG.apiKey };
}

