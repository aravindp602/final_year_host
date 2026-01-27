// electron-app/src/config.js

const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const API_BASE_URL = isLocal
  ? "http://localhost:5001"
  : "http://52.44.137.19:5001";
