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

    const actions = new Map(); // Using Map to preserve label and moduleId
    if (plan && typeof plan === 'object') {
        Object.values(plan).forEach(details => {
            if (details.steps && Array.isArray(details.steps)) {
                details.steps.forEach(step => {
                    if (!actions.has(step.action)) {
                        actions.set(step.action, { label: step.label, id: step.moduleId });
                    }
                });
            } else if (details.action) {
                actions.set(details.action, { label: details.label || details.action, id: details.moduleId || `dp_${details.action}` });
            }
        });
    }

    // Logic order for visualization
    const logicalOrder = [
        "remove_duplicates", "impute", "handle_missing_values", 
        "outlier", "polynomial", "log", "encode", "scale", "normalize", "pca"
    ];

    const sortedActions = Array.from(actions.entries()).sort((a, b) => {
        let idxA = logicalOrder.findIndex(key => a[0].includes(key));
        let idxB = logicalOrder.findIndex(key => b[0].includes(key));
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    sortedActions.forEach(([key, info]) => {
        const newNodeId = `${info.id}_${Date.now()}`;
        nodes.push({
            id: newNodeId, type: "preprocessingNode", position: { x: xPos, y: 100 },
            data: { label: info.label, baseId: info.id, color: "#b730cfff" }
        });
        edges.push({ id: `e-${lastNodeId}-${newNodeId}`, source: lastNodeId, target: newNodeId, animated: true });
        lastNodeId = newNodeId;
        xPos += 250;
    });

    const defaultModelId = "m0"; 
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
    const python = spawn(pythonExecutable, ["-u", scriptPath, ...args], {
        cwd: rootDir,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let stdout = "";
    let stderr = "";
    let isPrintingJson = false;

    python.stdout.on("data", (data) => {
      const str = data.toString();
      stdout += str;
      if (str.includes("__JSON_START__") || str.includes("__JSON_RESULT_START__")) {
          isPrintingJson = true;
          const parts = str.split(/__JSON_START__|__JSON_RESULT_START__/);
          if (parts[0].trim()) process.stdout.write(parts[0]);
      } 
      else if (str.includes("__JSON_END__") || str.includes("__JSON_RESULT_END__")) {
          isPrintingJson = false;
          const parts = str.split(/__JSON_END__|__JSON_RESULT_END__/);
          if (parts[1] && parts[1].trim()) process.stdout.write(parts[1]);
      } 
      else if (!isPrintingJson) {
          process.stdout.write(str);
      }
    });

    python.stderr.on("data", (data) => {
      const str = data.toString();
      stderr += str;
      process.stdout.write(`[Py Log]: ${str}`);
    });

    python.on("close", (code) => {
      const resultMatch = stdout.match(/__JSON_RESULT_START__([\s\S]*?)__JSON_RESULT_END__/) || 
                          stdout.match(/__JSON_START__([\s\S]*?)__JSON_END__/);
      
      if (resultMatch) {
        try {
          return resolve(JSON.parse(resultMatch[1].trim()));
        } catch (err) {
          console.error("JSON Parsing failed:", err.message);
        }
      }
      if (code === 0) return resolve(stdout);
      reject(new Error(stderr || `Python exited with code ${code}`));
    });
  });
}

// ---------------- ROUTES ----------------

// [UPDATED] Generic Domain Plan Generator
router.post("/generate-domain-plan", upload.single("dataset"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file" });

  const filePath = path.join(uploadDir, req.file.filename);
  const detectedDomain = req.body.domain || "Medical"; // Sent from Frontend

  // Switch script based on detected domain
  let scriptPath = "preprocessing/Domain_based_preprocessing/medical_plan_generator.py";
  if (detectedDomain === "Finance") {
      scriptPath = "preprocessing/Domain_based_preprocessing/finance_plan_generator.py";
  }

  console.log(`🤖 [Plan Generation] Domain: ${detectedDomain} | Engine: ${scriptPath}`);

  try {
    const result = await runPythonScript(scriptPath, [filePath]);
    console.log("✅ [Plan Generation] Successfully generated.");
    res.json(result);
  } catch (err) {
    console.error("❌ [Plan Generation] Failed:", err.message);
    res.status(500).json({ message: "Plan generation failed", details: err.message });
  }
});

router.post("/regenerate-plan", upload.single("dataset"), async (req, res) => {
    if (!req.file || !req.body.report || !req.body.domain) return res.status(400).json({ message: "Invalid request" });

    const filePath = path.join(uploadDir, req.file.filename);
    const detectedDomain = req.body.domain;

    let scriptPath = "preprocessing/Domain_based_preprocessing/medical_plan_generator.py";
    if (detectedDomain === "Finance") {
        scriptPath = "preprocessing/Domain_based_preprocessing/finance_plan_generator.py";
    }

    try {
        const result = await runPythonScript(scriptPath, [filePath, "--regenerate", req.body.report]);
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
    const preprocessedPath = path.join(rootDir, `${branchName}_processed.csv`);
    const logDirPath = ""; 
  
    console.log(`\n🏥 Executing AI Strategy on ${branchName}...`);
  
    try {
      // Preprocessing logic is domain-agnostic (executes the JSON)
      await runPythonScript(
        "preprocessing/Domain_based_preprocessing/domain_plan_executor.py",
        [req.file.path, JSON.stringify(plan), preprocessedPath, logDirPath]
      );
      console.log(`   ✅ Preprocessing Complete.`);

      // Training
      let trainingResults = [];
      let trainedModelPath = null;
      try {
          const allModels = loadJsonSafe("model_selectionAndTraining/model_names.json");
          const payload = [{ id: "m0", name: "AutoML", algo: "automl" }];

          const result = await runPythonScript("model_selectionAndTraining/model_handler.py", [preprocessedPath, JSON.stringify(payload)]);

          if (typeof result === 'object') trainingResults = result;
          else if (typeof result === 'string') {
              const jsonStart = result.indexOf("__JSON_START__");
              const jsonEnd = result.indexOf("__JSON_END__");
              if (jsonStart !== -1 && jsonEnd !== -1) trainingResults = JSON.parse(result.substring(jsonStart + 14, jsonEnd));
          }

          if (trainingResults && trainingResults.length > 0) trainedModelPath = trainingResults[0].path;
          console.log(`   ✅ Model Training Complete.`);
      } catch (err) { console.error(`[Model Error] ${err.message}`); }

      // Output Generation
      let visualizationData = {};
      if (trainedModelPath) {
        try {
          const result = await runPythonScript("output_section/output_handler.py", [preprocessedPath, trainedModelPath, JSON.stringify(["o1"])]);
          if (typeof result === 'object') visualizationData = result;
          else if (typeof result === 'string') {
              const jsonStart = result.indexOf("__JSON_START__");
              const jsonEnd = result.indexOf("__JSON_END__");
              if (jsonStart !== -1 && jsonEnd !== -1) visualizationData = JSON.parse(result.substring(jsonStart + 14, jsonEnd));
          }
          console.log(`   ✅ Output Generation Complete.`);
        } catch (err) { console.error(`[Output Error] ${err.message}`); }
      }

      // Generate Graph
      const graphData = generateGraphData(plan);

      res.json({
          message: "AI Strategy Executed Successfully",
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