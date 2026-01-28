const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const dotenv = require("dotenv");
const { upload, uploadDir } = require("../middleware/upload");

dotenv.config();

// 1. Define Root Dir
const rootDir = path.join(__dirname, "..");

// 2. Portable Python Resolver
function resolvePythonExecutable() {
    if (process.env.PYTHON_EXECUTABLE) {
        return process.env.PYTHON_EXECUTABLE;
    }
    const venvPython = process.platform === "win32"
        ? path.join(rootDir, "venv", "Scripts", "python.exe")
        : path.join(rootDir, "venv", "bin", "python");

    if (fs.existsSync(venvPython)) return venvPython;
    return process.platform === "win32" ? "python" : "python3";
}

const pythonExecutable = resolvePythonExecutable();
console.log(`🐍 [DomainProcess] Using Python: ${pythonExecutable}`);

// --- Helper: Load JSON Safe ---
const loadJsonSafe = (filePath) => {
  try {
    const fullPath = path.join(rootDir, filePath);
    const raw = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
};

// --- Helper: Generate Graph Data based on Plan ---
const generateGraphData = (plan) => {
    const nodes = [];
    const edges = [];
    let xPos = 50;
    let lastNodeId = "dataset-node";

    // 1. Dataset Node
    nodes.push({ id: "dataset-node", type: "datasetNode", position: { x: xPos, y: 100 }, data: { label: "Dataset" } });
    xPos += 250;

    // 2. Extract Actions from Plan
    const actions = new Set();
    if (plan && typeof plan === 'object') {
        Object.values(plan).forEach(details => {
            if (details.action) actions.add(details.action);
        });
    }

    // 3. Map Actions to Nodes
    const actionMapping = [
        { key: 'drop', label: 'Drop Identifiers', id: 'dp_drop' },
        { key: 'one_hot_encode', label: 'One-Hot Encoding', id: 'dp_ohe' },
        { key: 'label_encode', label: 'Label Encoding', id: 'dp_le' },
        { key: 'scale', label: 'Standard Scaling', id: 'dp_scale' },
        { key: 'impute', label: 'Missing Val Imputation', id: 'dp_impute' }
    ];

    actionMapping.forEach(step => {
        if (actions.has(step.key)) {
            const newNodeId = `${step.id}_${Date.now()}`;
            nodes.push({
                id: newNodeId, type: "preprocessingNode", position: { x: xPos, y: 100 },
                data: { label: step.label, baseId: step.id, color: "#b730cfff" } // Purple for Domain
            });
            edges.push({ id: `e-${lastNodeId}-${newNodeId}`, source: lastNodeId, target: newNodeId, animated: true });
            lastNodeId = newNodeId;
            xPos += 250;
        }
    });

    // 4. AutoML Model Node
    const defaultModelId = "m1"; 
    const modelNodeId = `m_${defaultModelId}_${Date.now()}`;
    nodes.push({ id: modelNodeId, type: "modelNode", position: { x: xPos, y: 100 }, data: { label: "AutoML Search", baseId: defaultModelId } });
    edges.push({ id: `e-${lastNodeId}-${modelNodeId}`, source: lastNodeId, target: modelNodeId, animated: true });
    lastNodeId = modelNodeId;
    xPos += 250;

    // 5. Output Node
    const defaultOutputId = "o1";
    const outNodeId = `o_${defaultOutputId}_${Date.now()}`;
    nodes.push({ id: outNodeId, type: "outputNode", position: { x: xPos, y: 85 }, data: { label: "Scatter Plot", baseId: defaultOutputId } });
    edges.push({ id: `e-${lastNodeId}-${outNodeId}`, source: lastNodeId, target: outNodeId, animated: true });

    return { nodes, edges };
};

// --- Helper: Run Python Script (Smart Logging) ---
const runPythonScript = (scriptPath, args) => {
  return new Promise((resolve, reject) => {
    const python = spawn(pythonExecutable, ["-u", scriptPath, ...args], {
        cwd: rootDir 
    });

    let output = "";
    let errorOutput = "";
    let isPrintingJson = false;

    python.stdout.on("data", (data) => { 
        const str = data.toString();
        output += str;
        
        // --- SMART LOGGING LOGIC ---
        // Handles both __JSON_START__ (Normal) and __JSON_RESULT_START__ (Generator)
        
        // 1. Detect Start of JSON
        if (str.includes("__JSON_START__") || str.includes("__JSON_RESULT_START__")) {
            isPrintingJson = true;
            // Print content BEFORE the tag, then stop
            const parts = str.split(/__JSON_START__|__JSON_RESULT_START__/);
            if (parts[0] && parts[0].trim()) process.stdout.write(parts[0]);
        } 
        // 2. Detect End of JSON
        else if (str.includes("__JSON_END__") || str.includes("__JSON_RESULT_END__")) {
            isPrintingJson = false;
            // Print content AFTER the tag
            const parts = str.split(/__JSON_END__|__JSON_RESULT_END__/);
            if (parts[1] && parts[1].trim()) process.stdout.write(parts[1]);
        } 
        // 3. Normal Logs (Only print if NOT inside JSON block)
        else if (!isPrintingJson) {
            process.stdout.write(str);
        }
    });

    python.stderr.on("data", (data) => { 
        const str = data.toString();
        errorOutput += str;
        process.stdout.write(`[Py Log]: ${str}`); // Force stderr to terminal
    });

    python.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        const shortError = errorOutput.split('\n').filter(l => l.trim() !== '').slice(-3).join('\n');
        console.error(`[Py-Err] ${scriptPath} exited with code ${code}. Details:\n${shortError}`);
        reject(new Error(errorOutput || `Script exited with code ${code}`));
      }
    });
  });
};

// ==========================================
// ROUTE 1: GENERATE MEDICAL PLAN (LLM)
// ==========================================
router.post("/generate-medical-plan", upload.single("dataset"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file for plan generation" });
  
    console.log("🤖 [Medical Plan] Starting generation for:", req.file.filename);
    const filePath = path.join(uploadDir, req.file.filename);
  
    try {
        const output = await runPythonScript(
            "preprocessing/Domain_based_preprocessing/medical_plan_generator.py",
            [filePath]
        );
        
        // Extract JSON using the specific generator delimiter
        const match = output.match(/__JSON_RESULT_START__([\s\S]*?)__JSON_RESULT_END__/);
        if (!match) throw new Error("Could not find JSON result in Python output");
        
        const result = JSON.parse(match[1]);
        
        console.log("✅ [Medical Plan] Successfully generated.");
        res.json(result);

    } catch (err) {
        console.error("❌ [Medical Plan] Failed:", err.message);
        res.status(500).json({ message: "Plan generation failed.", details: err.message });
    }
});

// ==========================================
// ROUTE 2: REGENERATE PLAN (FROM EDITOR)
// ==========================================
router.post("/regenerate-plan", upload.single("dataset"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    if (!req.body.report) return res.status(400).json({ message: "No report text provided" });

    const filePath = path.join(uploadDir, req.file.filename);
    const reportText = req.body.report;

    console.log("🔄 [Medical Plan] Regenerating plan based on user edits...");

    try {
        const output = await runPythonScript(
            "preprocessing/Domain_based_preprocessing/medical_plan_generator.py",
            [filePath, "--regenerate", reportText]
        );

        const match = output.match(/__JSON_RESULT_START__([\s\S]*?)__JSON_RESULT_END__/);
        if (!match) throw new Error("Could not find JSON result in Python output");

        const result = JSON.parse(match[1]);
        
        console.log("✅ [Medical Plan] Regenerated successfully.");
        res.json(result);

    } catch (err) {
        console.error("❌ [Regen Plan] Failed:", err.message);
        res.status(500).json({ message: "Plan regeneration failed.", details: err.message });
    }
});

// ==========================================
// ROUTE 3: EXECUTE APPROVED PLAN (AutoML)
// ==========================================
router.post("/execute-approved-plan", upload.single("dataset"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Dataset file missing" });
    if (!req.body.plan) return res.status(400).json({ error: "Medical Plan missing" });
  
    const plan = JSON.parse(req.body.plan);
    const datasetPath = req.file.path;
    const branchName = "main_branch";
    
    // Setup Directories
    const logDirName = `${branchName}_logging`;
    const logDirPath = path.join(rootDir, "preprocessing", "Domain_based_preprocessing", logDirName);
    const outputCsvName = `${branchName}_processed.csv`;
    const preprocessedPath = path.join(rootDir, outputCsvName);
    
    if (!fs.existsSync(logDirPath)) fs.mkdirSync(logDirPath, { recursive: true });
  
    console.log(`\n🏥 Executing Medical Plan on ${branchName}...`);
  
    try {
      // 1. Run Preprocessing Executor
      await runPythonScript(
        "preprocessing/Domain_based_preprocessing/medical_plan_executor.py",
        [datasetPath, JSON.stringify(plan), preprocessedPath, logDirPath]
      );
      console.log(`   ✅ Preprocessing Complete.`);

      // 2. Model Training (AutoML)
      // Note: We force 'm1' (or 'm0' if your config uses that for AutoML) 
      const mList = ["m1"]; 
      let trainingResults = [];
      let trainedModelPath = null;

      try {
          const allModels = loadJsonSafe("model_selectionAndTraining/model_names.json");
          const selectedModels = allModels.filter(m => mList.includes(m.id));
          const payload = selectedModels.length > 0 ? selectedModels : [{ id: "m0", name: "AutoML", algo: "automl" }];

          const output = await runPythonScript(
            "model_selectionAndTraining/model_handler.py",
            [preprocessedPath, JSON.stringify(payload)]
          );

          const jsonStart = output.indexOf("__JSON_START__");
          const jsonEnd = output.indexOf("__JSON_END__");
          
          if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonStr = output.substring(jsonStart + 14, jsonEnd);
              try {
                  trainingResults = JSON.parse(jsonStr);
                  if (trainingResults.length > 0) trainedModelPath = trainingResults[0].path;
              } catch (e) { console.error("   ❌ JSON Parse Error:", e.message); }
          }
          console.log(`   ✅ Model Training Complete.`);
      } catch (err) {
          throw new Error(`Model Training Failed: ${err.message}`);
      }
  
      // 3. Output Generation
      const oList = ["o1"];
      let visualizationData = {};
      if (trainedModelPath) {
        try {
          const output = await runPythonScript(
            "output_section/output_handler.py",
            [preprocessedPath, trainedModelPath, JSON.stringify(oList)]
          );
          const jsonStart = output.indexOf("__JSON_START__");
          const jsonEnd = output.indexOf("__JSON_END__");
          if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonStr = output.substring(jsonStart + 14, jsonEnd);
              visualizationData = JSON.parse(jsonStr);
          }
          console.log(`   ✅ Output Generation Complete.`);
        } catch (err) { console.error(`[Output Error] ${err.message}`); }
      }
  
      // 4. Generate Graph Data
      const graphData = generateGraphData(plan);

      res.json({
          message: "Medical Plan Executed Successfully",
          graph: graphData,
          outputs: visualizationData,
          trainingResults: trainingResults,
          isCustom: false
      });
  
    } catch (err) {
      console.error("❌ Medical Plan Execution Failed:", err);
      res.status(500).json({ error: err.message });
    }
});

module.exports = { router };