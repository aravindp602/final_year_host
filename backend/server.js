const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs"); 
const { spawn } = require("child_process");

// Load .env
dotenv.config();

const { upload, uploadDir } = require("./middleware/upload");
const resourceRoutes = require("./routes/resources");

// 1. Import Normal Processing Routes & Helper
const { router: normalProcessRoutes, processBranch } = require("./routes/normalProcess");

// 2. Import Domain Processing Routes
const { router: domainProcessRoutes } = require("./routes/domainProcess");

const app = express();
const PORT = 5001; 

// --- PORTABLE PYTHON RESOLVER ---
function resolvePythonExecutable() {
    if (process.env.PYTHON_EXECUTABLE) {
        return process.env.PYTHON_EXECUTABLE;
    }
    const backendDir = __dirname;
    const venvPython = process.platform === "win32"
        ? path.join(backendDir, "venv", "Scripts", "python.exe")
        : path.join(backendDir, "venv", "bin", "python");

    if (fs.existsSync(venvPython)) {
        return venvPython;
    }
    return process.platform === "win32" ? "python" : "python3";
}
const pythonExecutable = resolvePythonExecutable();

// --- FIXED CORS CONFIGURATION ---
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://automatedclusteringelite.vercel.app", 
  "https://automated-clustering-elite.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || true) { // Force True for debugging
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  credentials: true 
}));

// [FIX] Use Regex for wildcard to avoid path-to-regexp PathError
app.options(/(.*)/, cors());

app.use(express.json());

// 3. Register Routes
app.use(resourceRoutes);
app.use(normalProcessRoutes);
app.use(domainProcessRoutes); 

/* ---------------- Domain Identification (PYTHON) ---------------- */

app.post("/find-domain", upload.single("dataset"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const filePath = path.join(uploadDir, req.file.filename);
  const scriptPath = path.join(__dirname, "domain_identification/domain_identification.py");

  console.log("🚀 [Domain Detection] Running python script...");

  const pythonProcess = spawn(pythonExecutable, [scriptPath, filePath]);

  let output = "";

  pythonProcess.stdout.on("data", (data) => {
    output += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error("🐍 Python Error:", data.toString());
  });

  pythonProcess.on("close", (code) => {
    console.log("🐍 Raw Python Output:\n", output);

    if (code !== 0) {
      console.warn("⚠️ Python script failed. Returning default Medical domain.");
      return res.json({ domain: "Medical" });
    }

    try {
      const lastLine = output.trim().split("\n").pop();
      const result = JSON.parse(lastLine);
      res.json(result);
    } catch (err) {
      console.error("❌ Failed to parse domain JSON. Fallback to Medical.");
      res.json({ domain: "Medical" });
    }
  });
});

/* ---------------- Run Configuration ---------------- */

app.post("/run-config", upload.single("dataset"), async (req, res) => {
  try {
    if (!req.file) {
        return res.status(400).json({ message: "Dataset file is required" });
    }

    let chainsRaw = req.body.chains;
    if (typeof chainsRaw === "string") {
        chainsRaw = JSON.parse(chainsRaw);
    }

    console.log("🚀 [RunConfig] Received Branches:", Object.keys(chainsRaw));

    const branchPromises = Object.entries(chainsRaw).map(async ([branchName, nodes]) => {
        console.log(`\n🌿 [Branch: ${branchName}] Processing ${nodes.length} nodes...`);

        const pList = [];
        const mList = [];
        const oList = [];

        nodes.forEach((step) => {
            const baseId = step.baseId || "";
            if (baseId.startsWith('n') || baseId.startsWith('p')) pList.push(baseId);
            else if (baseId.startsWith('m')) mList.push(baseId);
            else if (baseId.startsWith('o')) oList.push(baseId);
        });

        try {
            const result = await processBranch(branchName, req.file.path, pList, mList, oList);
            return { branchName, status: 'success', data: result };
        } catch (error) {
            console.error(`❌ [${branchName} FAILED] ${error.message}`);
            return { branchName, status: 'error', error: error.message };
        }
    });

    const resultsArray = await Promise.all(branchPromises);

    const finalResults = {};

    resultsArray.forEach(item => {
        if (item.status === 'success') {
            finalResults[item.branchName] = item.data;
        } else {
            finalResults[item.branchName] = {
                status: 'failed',
                error: item.error,
                trainingResults: [], 
                outputs: {}
            };
        }
    });

    res.json({
        message: "Multi-Branch Pipeline Completed",
        outputs: finalResults, 
        trainingResults: [], 
        graph: {} 
    });

  } catch (err) {
    console.error("❌ [RunConfig] Critical Error:", err);
    if (!res.headersSent) {
        res.status(500).json({ message: "Error processing configuration", details: err.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});