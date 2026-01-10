const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { upload } = require("../middleware/upload");

const rootDir = path.join(__dirname, "..");

// --- PORTABLE PYTHON RESOLVER ---
function resolvePythonExecutable() {
    if (process.env.PYTHON_EXECUTABLE) {
        return process.env.PYTHON_EXECUTABLE;
    }

    const venvPython = process.platform === "win32"
        ? path.join(rootDir, "venv", "Scripts", "python.exe")
        : path.join(rootDir, "venv", "bin", "python");

    if (fs.existsSync(venvPython)) {
        return venvPython;
    }

    return process.platform === "win32" ? "python" : "python3";
}

const pythonExecutable = resolvePythonExecutable();
console.log(`🐍 [NormalProcess] Using Python: ${pythonExecutable}`);

const loadJsonSafe = (filePath) => {
  try {
    const fullPath = path.join(rootDir, filePath);
    const raw = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
};

const generateGraphData = (pList, mList, oList) => {
  const nodes = [];
  const edges = [];
  let lastNodeId = "dataset-node";
  let xPos = 50; 
  
  nodes.push({
    id: "dataset-node",
    type: "datasetNode",
    position: { x: xPos, y: 100 },
    data: { label: "Dataset" },
  });
  xPos += 250;

  const allPreproc = loadJsonSafe("preprocessing/Normal_preprocessing/normal_preprocessing_modules.json");
  const allModels = loadJsonSafe("model_selectionAndTraining/model_names.json");
  const allOutputs = loadJsonSafe("output_section/output_options.json");

  pList.forEach((id) => {
    const module = allPreproc.find(m => m.id === id);
    if (!module) return;
    const newNodeId = `p_${id}_${Date.now()}`;
    nodes.push({ id: newNodeId, type: "preprocessingNode", position: { x: xPos, y: 100 }, data: { label: module.label, baseId: id } });
    edges.push({ id: `e-${lastNodeId}-${newNodeId}`, source: lastNodeId, target: newNodeId, animated: true });
    lastNodeId = newNodeId;
    xPos += 250;
  });

  mList.forEach((id) => {
    const module = allModels.find(m => m.id === id);
    if (!module) return;
    const newNodeId = `m_${id}_${Date.now()}`;
    nodes.push({ id: newNodeId, type: "modelNode", position: { x: xPos, y: 100 }, data: { label: module.label, baseId: id } });
    edges.push({ id: `e-${lastNodeId}-${newNodeId}`, source: lastNodeId, target: newNodeId, animated: true });
    lastNodeId = newNodeId;
    xPos += 250;
  });

  oList.forEach((id) => {
    const module = allOutputs.find(m => m.id === id);
    if (!module) return;
    const newNodeId = `o_${id}_${Date.now()}`;
    nodes.push({ id: newNodeId, type: "outputNode", position: { x: xPos, y: 85 }, data: { label: module.label, baseId: id } });
    edges.push({ id: `e-${lastNodeId}-${newNodeId}`, source: lastNodeId, target: newNodeId, animated: true });
    lastNodeId = newNodeId;
    xPos += 250;
  });

  return { nodes, edges };
};

const runPythonScript = (scriptPath, args) => {
  return new Promise((resolve, reject) => {
    // UPDATED: Use the resolved python executable
    const python = spawn(pythonExecutable, ["-u", scriptPath, ...args], {
        cwd: rootDir // Ensure correct working directory
    });
    let output = "";
    let errorOutput = "";
    
    // Flag to track if we are currently inside the JSON data block
    let isPrintingJson = false;

    python.stdout.on("data", (data) => { 
        const str = data.toString();
        output += str; // Always capture full output for logic
        
        // --- SMART LOGGING ---
        // 1. Detect Start of JSON
        if (str.includes("__JSON_START__")) {
            isPrintingJson = true;
            const preJson = str.split("__JSON_START__")[0];
            if (preJson.trim()) process.stdout.write(preJson);
        } 
        // 2. Detect End of JSON
        else if (str.includes("__JSON_END__")) {
            isPrintingJson = false;
            const postJson = str.split("__JSON_END__")[1];
            if (postJson && postJson.trim()) process.stdout.write(postJson);
        } 
        // 3. Normal Logs (Only print if NOT inside JSON block)
        else if (!isPrintingJson) {
            // Check for Winner Line to highlight
            if (str.includes("====== BEST MODEL FOUND:")) {
                const lines = str.split('\n');
                const winnerLine = lines.find(l => l.includes("====== BEST MODEL FOUND:"));
                if (winnerLine) {
                    console.log("\x1b[32m%s\x1b[0m", winnerLine); // Green Text
                }
            } else {
                process.stdout.write(str);
            }
        }
    });

    python.stderr.on("data", (data) => { errorOutput += data.toString(); });

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

const processBranch = async (branchName, datasetPath, pList, mList, oList) => {
  console.log(`\n🌿 Processing Branch: ${branchName}`);
  
  const logDirName = `${branchName}_logging`;
  const logDirPath = path.join(rootDir, "preprocessing", "Normal_preprocessing", logDirName);
  
  if (!fs.existsSync(logDirPath)) fs.mkdirSync(logDirPath, { recursive: true });

  const outputCsvName = `${branchName}_processed.csv`;
  const preprocessedPath = path.join(rootDir, outputCsvName);

  const allModules = loadJsonSafe("preprocessing/Normal_preprocessing/normal_preprocessing_modules.json");
  const modulesToUse = pList.map(id => allModules.find(m => m.id === id)).filter(Boolean);

  // A. PREPROCESSING
  try {
    await runPythonScript(
      "preprocessing/Normal_preprocessing/normal_preprocessing_handler.py",
      [datasetPath, JSON.stringify(modulesToUse), preprocessedPath, logDirPath]
    );
    console.log(`   ✅ Preprocessing Complete.`);
  } catch (err) {
    throw new Error(`Preprocessing Failed: ${err.message.split('\n').pop()}`); 
  }

  // B. MODEL TRAINING
  let trainingResults = [];
  let trainedModelPath = null;

  if (mList.length > 0) {
    try {
      const allModels = loadJsonSafe("model_selectionAndTraining/model_names.json");
      const selectedModels = allModels.filter(m => mList.includes(m.id));
      
      if (selectedModels.length > 0) {
        const output = await runPythonScript(
          "model_selectionAndTraining/model_handler.py",
          [preprocessedPath, JSON.stringify(selectedModels)]
        );

        const jsonStart = output.indexOf("__JSON_START__");
        const jsonEnd = output.indexOf("__JSON_END__");
        
        if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonStr = output.substring(jsonStart + 14, jsonEnd);
            try {
                trainingResults = JSON.parse(jsonStr);
                if (trainingResults.length > 0) {
                    trainedModelPath = trainingResults[0].path;
                }
            } catch (e) {
                console.error("   ❌ JSON Parse Error:", e.message);
            }
        }
        console.log(`   ✅ Model Training Complete.`);
      }
    } catch (err) {
      throw new Error(`Model Training Failed: ${err.message}`);
    }
  }

  // C. OUTPUT GENERATION
  let visualizationData = {};
  if (oList.length > 0) {
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
        } catch (err) {
           console.error(`[Output Error] ${err.message}`);
        }
      } else {
          console.log("   ⚠️ Output generation skipped (No trained model found)");
      }
  }

  const graphData = generateGraphData(pList, mList, oList);

  return {
    outputs: visualizationData,
    trainingResults: trainingResults,
    graph: graphData
  };
};

router.post("/preprocess-normal", upload.single("dataset"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Dataset file missing" });

  const isCustom = req.body.isCustom === "true";
  let customIds = req.body.ids ? JSON.parse(req.body.ids) : [];
  let modelIds = req.body.modelIds ? JSON.parse(req.body.modelIds) : [];
  let outputIds = req.body.outputIds ? JSON.parse(req.body.outputIds) : [];

  if (!isCustom) {
     modelIds = ['m1'];
     outputIds = ['o1'];
     const allModules = loadJsonSafe("preprocessing/Normal_preprocessing/normal_preprocessing_modules.json");
     if (customIds.length === 0) customIds = allModules.map(m => m.id);
  }

  try {
    const result = await processBranch("main_branch", req.file.path, customIds, modelIds, outputIds);
    res.json({ message: "Pipeline Completed Successfully", ...result });
  } catch (err) {
    res.status(500).json({ message: "Pipeline Processing Failed", error: err.message });
  }
});

module.exports = { router, processBranch };