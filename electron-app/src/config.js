// electron-app/src/config.js

const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// ✅ FORCE REMOTE IP: This will connect to the IP even when running locally
//export const API_BASE_URL = "http://52.44.137.19:5001";

/* 👇 Keep this for later. 
   When you are done testing, uncomment this block to automatically switch 
   between localhost (dev) and the remote server (production).
*/
 export const API_BASE_URL = isLocal
  ? "http://localhost:5001"
   : "http://52.44.137.19:5001";
