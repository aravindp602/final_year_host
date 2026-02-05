// electron-app/src/config.js

const isBrowser = typeof window !== "undefined";

const isLocal =
  isBrowser &&
  (window.location.hostname === "localhost" ||
   window.location.hostname === "127.0.0.1");

/**
 * Local:
 *   React (localhost:3000 / 3001) → Backend (localhost:5001)
 *
 * Production (Vercel):
 *   https://automatedclusteringelite.vercel.app
 *   → HTTPS Cloudflare Tunnel
 *   → AWS backend (localhost:5001)
 */
export const API_BASE_URL = isLocal
  ? "http://localhost:5001"
  : "https://astronomy-prostores-cruises-via.trycloudflare.com";