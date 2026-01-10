// electron-app/src/config.js
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

export const API_BASE_URL = isLocal 
  ? "http://localhost:5001" 
  : "https://final-year-project-j0wc.onrender.com"; // We will get this URL later