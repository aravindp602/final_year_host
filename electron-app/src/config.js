// electron-app/src/config.js

const isBrowser = typeof window !== "undefined";

const isLocal =
  isBrowser &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

// Prefer env var (Vercel / production safe)
export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (isLocal
    ? "http://localhost:5001"
    : "http://52.44.137.19:5001");
