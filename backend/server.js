const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load .env
dotenv.config();

const { upload } = require("./middleware/upload");
const resourceRoutes = require("./routes/resources");

// 1. Import Normal Processing Routes & Helper
const { router: normalProcessRoutes, processBranch } = require("./routes/normalProcess");

// 2. Import Domain Processing Routes (Includes generate-medical-plan)
const { router: domainProcessRoutes } = require("./routes/domainProcess");

const app = express();
const PORT = 5001; 

// --- UPDATED CORS CONFIGURATION ---
app.use(cors({
  origin: "*", // Allow all origins (Easiest for testing deployment)
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true // Allow cookies if needed (though * origin limits this in some browsers, it helps for now)
}));



app.use(express.json());

// 3. Register Routes
app.use(resourceRoutes);
app.use(normalProcessRoutes);
app.use(domainProcessRoutes); 

/* ---------------- Remaining Logic ---------------- */

app.post("/find-domain", upload.single("dataset"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  console.log("🚀 [Domain Detection] File received:", req.file.filename);
  console.log("⚠️ [DEV MODE] Returning hardcoded domain: Medical");

  setTimeout(() => {
    res.json({ domain: "Medical" });
  }, 1000);
});

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

    // Prepare Promises
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