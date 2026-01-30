const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const dotenv = require("dotenv");
const { upload, uploadDir } = require("../middleware/upload");

dotenv.config();

const rootDir = path.join(__dirname, "..");

function resolvePythonExecutable() {
    if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE;
    const venvPython = process.platform === "win32"
        ? path.join(rootDir, "venv", "Scripts", "python.exe")
        : path.join(rootDir, "venv", "bin", "python");
    return fs.existsSync(venvPython) ? venvPython : (process.platform === "win32" ? "python" : "python3");
}

const pythonExecutable = resolvePythonExecutable();
console.log(`🐍 [DomainProcess] Using Python: ${pythonExecutable}`);

const loadJsonSafe = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, filePath), "utf8"));
  } catch (err) { return []; }
};

const generateGraphData = (plan) => {
    const nodes = [];
    const edges = [];
    let xPos = 50;
    let lastNodeId = "dataset-node";

    nodes.push({ id: "dataset-node", type: "datasetNode", position: { x: xPos, y: 100 }, data: { label: "Dataset" } });
    xPos += 250;

    const actions = new Set();
    if (plan && typeof plan === 'object') {
        Object.values(plan).forEach(details => {
            if (details.steps) {
                // New format: Array of steps
                details.steps.forEach(step => actions.add(step.action));
            } else if (details.action) {
                // Legacy format: Single action
                actions.add(details.action);
            }
        });
    }

    // [FIX] Complete Action Mapping for Graph Visualization
    const actionMapping = [
        { key: 'remove_duplicates', label: 'Remove Duplicates', id: 'dp1' },
        { key: 'impute', label: 'Handle Missing', id: 'dp2' },
        { key: 'outlier', label: 'Outlier Removal', id: 'dp3' },
        { key: 'polynomial', label: 'Poly Features', id: 'dp5' },
        { key: 'log', label: 'Log Transform', id: 'dp6' },
        { key: 'encode', label: 'Encoding', id: 'dp7' },
        { key: 'scale', label: 'Scaling', id: 'dp8' },
        { key: 'normalize', label: 'Normalization', id: 'dp9' },
        { key: 'pca', label: 'PCA', id: 'dp10' },
        { key: 'drop', label: 'Drop Columns', id: 'dp_drop' }
    ];

    actionMapping.forEach(step => {
        if (actions.has(step.key)) {
            const newNodeId = `${step.id}_${Date.now()}`;
            nodes.push({
                id: newNodeId, type: "preprocessingNode", position: { x: xPos, y: 100 },
                data: { label: step.label, baseId: step.id, color: "#b730cfff" }
            });
            edges.push({ id: `e-${lastNodeId}-${newNodeId}`, source: lastNodeId, target: newNodeId, animated: true });
            lastNodeId = newNodeId;
            xPos += 250;
        }
    });

    const defaultModelId = "m1"; 
    const modelNodeId = `m_${defaultModelId}_${Date.now()}`;
    nodes.push({ id: modelNodeId, type: "modelNode", position: { x: xPos, y: 100 }, data: { label: "AutoML Search", baseId: defaultModelId } });
    edges.push({ id: `e-${lastNodeId}-${modelNodeId}`, source: lastNodeId, target: modelNodeId, animated: true });
    lastNodeId = modelNodeId;
    xPos += 250;

    const defaultOutputId = "o1";
    const outNodeId = `o_${defaultOutputId}_${Date.now()}`;
    nodes.push({ id: outNodeId, type: "outputNode", position: { x: xPos, y: 85 }, data: { label: "Scatter Plot", baseId: defaultOutputId } });
    edges.push({ id: `e-${lastNodeId}-${outNodeId}`, source: lastNodeId, target: outNodeId, animated: true });

    return { nodes, edges };
};

function runPythonScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    // Force UTF-8 environment to prevent emoji crashes on Windows
    const python = spawn(pythonExecutable, ["-u", scriptPath, ...args], {
        cwd: rootDir,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => {
      const str = data.toString();
      stdout += str;
    });

    python.stderr.on("data", (data) => {
      const str = data.toString();
      stderr += str;
      process.stdout.write(`[Py Log]: ${str}`);
    });

    python.on("close", (code) => {
      // 1. Priority: JSON Result Block
      const resultMatch = stdout.match(/__JSON_RESULT_START__([\s\S]*?)__JSON_RESULT_END__/);
      if (resultMatch) {
        try {
          return resolve(JSON.parse(resultMatch[1].trim()));
        } catch (err) {
          console.error("JSON Parsing failed on result block:", err.message);
        }
      }

      // 2. Fallback: Full Output (if success)
      if (code === 0) return resolve(stdout);

      // 3. Failure
      reject(new Error(stderr || `Python exited with code ${code}`));
    });
  });
}

// ---------------- ROUTES ----------------

router.post("/generate-medical-plan", upload.single("dataset"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file" });

  console.log("🤖 [Medical Plan] Starting generation for:", req.file.filename);

  try {
    const result = await runPythonScript(
      "preprocessing/Domain_based_preprocessing/medical_plan_generator.py",
      [path.join(uploadDir, req.file.filename)]
    );
    console.log("✅ [Medical Plan] Successfully generated.");
    res.json(result);
  } catch (err) {
    console.error("❌ [Medical Plan] Failed:", err.message);
    res.status(500).json({ message: "Plan generation failed", details: err.message });
  }
});

router.post("/regenerate-plan", upload.single("dataset"), async (req, res) => {
    if (!req.file || !req.body.report) return res.status(400).json({ message: "Invalid request" });

    try {
        const result = await runPythonScript(
            "preprocessing/Domain_based_preprocessing/medical_plan_generator.py",
            [path.join(uploadDir, req.file.filename), "--regenerate", req.body.report]
        );
        console.log("✅ [Medical Plan] Regenerated successfully.");
        res.json(result);
    } catch (err) {
        console.error("❌ [Regen Plan] Failed:", err.message);
        res.status(500).json({ message: "Plan regeneration failed.", details: err.message });
    }
});

router.post("/execute-approved-plan", upload.single("dataset"), async (req, res) => {
    if (!req.file || !req.body.plan) return res.status(400).json({ error: "Missing data" });
  
    const plan = JSON.parse(req.body.plan);
    const branchName = "main_branch";
    const logDirPath = path.join(rootDir, "preprocessing", "Domain_based_preprocessing", `${branchName}_logging`);
    const preprocessedPath = path.join(rootDir, `${branchName}_processed.csv`);
    
    if (!fs.existsSync(logDirPath)) fs.mkdirSync(logDirPath, { recursive: true });
  
    console.log(`\n🏥 Executing Medical Plan on ${branchName}...`);
  
    try {
      // Step 1: Preprocessing
      await runPythonScript(
        "preprocessing/Domain_based_preprocessing/medical_plan_executor.py",
        [req.file.path, JSON.stringify(plan), preprocessedPath, logDirPath]
      );
      console.log(`   ✅ Preprocessing Complete.`);

      // Step 2: Training
      let trainingResults = [];
      let trainedModelPath = null;
      try {
          const allModels = loadJsonSafe("model_selectionAndTraining/model_names.json");
          const mList = ["m1"]; 
          const selectedModels = allModels.filter(m => mList.includes(m.id));
          const payload = selectedModels.length > 0 ? selectedModels : [{ id: "m0", name: "AutoML", algo: "automl" }];

          const output = await runPythonScript(
            "model_selectionAndTraining/model_handler.py",
            [preprocessedPath, JSON.stringify(payload)]
          );

          // Legacy Parsing
          const jsonStart = output.indexOf("__JSON_START__");
          const jsonEnd = output.indexOf("__JSON_END__");
          if (jsonStart !== -1 && jsonEnd !== -1) {
              trainingResults = JSON.parse(output.substring(jsonStart + 14, jsonEnd));
              if (trainingResults.length > 0) trainedModelPath = trainingResults[0].path;
          }
          console.log(`   ✅ Model Training Complete.`);
      } catch (err) { console.error(`[Model Error] ${err.message}`); }

      // Step 3: Output Generation
      let visualizationData = {};
      if (trainedModelPath) {
        try {
          const output = await runPythonScript(
            "output_section/output_handler.py",
            [preprocessedPath, trainedModelPath, JSON.stringify(["o1"])]
          );
          const jsonStart = output.indexOf("__JSON_START__");
          const jsonEnd = output.indexOf("__JSON_END__");
          if (jsonStart !== -1 && jsonEnd !== -1) {
              visualizationData = JSON.parse(output.substring(jsonStart + 14, jsonEnd));
          }
          console.log(`   ✅ Output Generation Complete.`);
        } catch (err) { console.error(`[Output Error] ${err.message}`); }
      }

      // Step 4: Generate Graph
      const graphData = generateGraphData(plan);

      res.json({
          message: "Medical Plan Executed Successfully",
          graph: graphData,
          outputs: visualizationData,
          trainingResults: trainingResults,
          isCustom: false
      });
  
    } catch (err) {
      console.error("❌ Execution Failed:", err);
      res.status(500).json({ error: err.message });
    }
});

module.exports = { router };