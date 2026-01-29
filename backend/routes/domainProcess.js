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
                details.steps.forEach(step => actions.add(step.action));
            } else if (details.action) {
                actions.add(details.action);
            }
        });
    }

    const actionMapping = [
        { key: 'drop', label: 'Drop Identifiers', id: 'dp_drop' },
        { key: 'impute', label: 'Imputation', id: 'dp_impute' },
        { key: 'log', label: 'Log Transform', id: 'dp_log' },
        { key: 'encode', label: 'Encoding', id: 'dp_encode' },
        { key: 'scale', label: 'Scaling', id: 'dp_scale' }
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

const runPythonScript = (scriptPath, args) => {
  return new Promise((resolve, reject) => {
    const python = spawn(pythonExecutable, ["-u", scriptPath, ...args], { cwd: rootDir });
    let output = "";
    let errorOutput = "";
    let isPrintingJson = false;

    python.stdout.on("data", (data) => { 
        const str = data.toString();
        output += str;
        
        if (str.includes("__JSON_START__") || str.includes("__JSON_RESULT_START__")) {
            isPrintingJson = true;
            const parts = str.split(/__JSON_START__|__JSON_RESULT_START__/);
            if (parts[0].trim()) process.stdout.write(parts[0]);
        } 
        else if (str.includes("__JSON_END__") || str.includes("__JSON_RESULT_END__")) {
            isPrintingJson = false;
            const parts = str.split(/__JSON_END__|__JSON_RESULT_END__/);
            if (parts[1].trim()) process.stdout.write(parts[1]);
        } 
        else if (!isPrintingJson) {
            process.stdout.write(str);
        }
    });

    python.stderr.on("data", (data) => { 
        const str = data.toString();
        errorOutput += str;
        process.stdout.write(`[Py Log]: ${str}`); 
    });

    python.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(errorOutput || `Script exited with code ${code}`));
    });
  });
};

router.post("/generate-medical-plan", upload.single("dataset"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file" });
    console.log("🤖 [Medical Plan] Starting generation for:", req.file.filename);
  
    try {
        const output = await runPythonScript(
            "preprocessing/Domain_based_preprocessing/medical_plan_generator.py",
            [path.join(uploadDir, req.file.filename)]
        );
        
        const match = output.match(/__JSON_RESULT_START__([\s\S]*?)__JSON_RESULT_END__/);
        if (!match) throw new Error("Could not find JSON result");
        
        const result = JSON.parse(match[1]);
        console.log("✅ [Medical Plan] Successfully generated.");
        res.json(result);

    } catch (err) {
        console.error("❌ [Medical Plan] Failed:", err.message);
        res.status(500).json({ message: "Plan generation failed.", details: err.message });
    }
});

router.post("/regenerate-plan", upload.single("dataset"), async (req, res) => {
    if (!req.file || !req.body.report) return res.status(400).json({ message: "Invalid request" });

    try {
        const output = await runPythonScript(
            "preprocessing/Domain_based_preprocessing/medical_plan_generator.py",
            [path.join(uploadDir, req.file.filename), "--regenerate", req.body.report]
        );

        const match = output.match(/__JSON_RESULT_START__([\s\S]*?)__JSON_RESULT_END__/);
        if (!match) throw new Error("Could not find JSON result");

        const result = JSON.parse(match[1]);
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
      await runPythonScript(
        "preprocessing/Domain_based_preprocessing/medical_plan_executor.py",
        [req.file.path, JSON.stringify(plan), preprocessedPath, logDirPath]
      );
      console.log(`   ✅ Preprocessing Complete.`);

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
              trainingResults = JSON.parse(output.substring(jsonStart + 14, jsonEnd));
              if (trainingResults.length > 0) trainedModelPath = trainingResults[0].path;
          }
          console.log(`   ✅ Model Training Complete.`);
      } catch (err) { throw new Error(`Model Training Failed: ${err.message}`); }

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