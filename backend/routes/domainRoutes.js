const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { upload } = require("../middleware/upload");

// 1. Define Root Dir (Go up from 'routes' to 'backend')
const rootDir = path.join(__dirname, "..");

// 2. Portable Python Resolver
function resolvePythonExecutable() {
    // Check for Environment Variable (Cloud)
    if (process.env.PYTHON_EXECUTABLE) {
        return process.env.PYTHON_EXECUTABLE;
    }

    // Check Local venv (Windows vs Mac/Linux)
    const venvPython = process.platform === "win32"
        ? path.join(rootDir, "venv", "Scripts", "python.exe")
        : path.join(rootDir, "venv", "bin", "python");

    if (fs.existsSync(venvPython)) {
        return venvPython;
    }

    // Fallback to global default
    return process.platform === "win32" ? "python" : "python3";
}

const pythonExecutable = resolvePythonExecutable();
console.log(`🐍 [DomainRoutes] Using Python: ${pythonExecutable}`);

// POST /detect-domain
// Note: Changed upload.single("file") to "dataset" to match your Frontend code
router.post("/detect-domain", upload.single("dataset"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    
    // Path to the python script
    const scriptPath = path.join(rootDir, "domain_identification", "domain_identification.py");

    console.log("🚀 [Domain Detection] Running script:", scriptPath);

    const process = spawn(pythonExecutable, [scriptPath, filePath], {
        cwd: rootDir // Ensures Python runs from backend root context
    });

    let output = "";

    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    process.stderr.on("data", (data) => {
      console.error("🐍 Python Error:", data.toString());
    });

    process.on("close", (code) => {
      console.log("🐍 Raw Python Output:\n", output);

      if (code !== 0) {
        return res.status(500).json({ error: "Python process failed" });
      }

      try {
        // Parse the last line as JSON (handles potential print logs before JSON)
        const lastLine = output.trim().split("\n").pop();
        const result = JSON.parse(lastLine);
        res.json(result);
      } catch (error) {
        console.error("JSON Parse Error:", error);
        res.status(500).json({
          error: "Invalid Python output",
          raw: output
        });
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;