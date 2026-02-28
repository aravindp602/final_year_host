const express = require("express");
const router = express.Router();
const path = require("path");
const { spawn } = require("child_process");
const upload = require("../middleware/upload");

// POST /api/detect-domain
router.post("/detect-domain", upload.single("dataset"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;

    const pythonPath = path.join(__dirname, "../venv/bin/python");
    const scriptPath = path.join(
      __dirname,
      "../domain_identification/domain_identification.py"
    );

    const process = spawn(
      pythonPath,
      [scriptPath, filePath],
      { timeout: 120000 }
    );

    let output = "";

    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    process.stderr.on("data", (data) => {
      console.error("🐍 Python STDERR:", data.toString());
    });

    process.on("close", (code) => {
      console.log("🐍 Raw Python Output:\n", output);

      if (code !== 0) {
        return res.status(500).json({ error: "Python process failed" });
      }

      try {
        const lastLine = output.trim().split("\n").pop();
        const result = JSON.parse(lastLine);
        res.json(result);
      } catch (error) {
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
