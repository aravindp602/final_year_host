// routes/resources.js
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

// Helper to point to the project root directory
const rootDir = path.join(__dirname, "..");

// 1. Preprocessing Modules
router.get("/normal-preprocessing-modules", (req, res) => {
  // DEBUG: Print the calculated path
  const moduleFilePath = path.join(rootDir, "preprocessing", "Normal_preprocessing", "normal_preprocessing_modules.json");
  console.log("📂 Attempting to read Normal Modules at:", moduleFilePath);

  fs.readFile(moduleFilePath, "utf8", (err, data) => {
    if (err) {
      console.error("❌ Error reading Normal module file:", err.message);
      return res.status(500).json({ error: "Failed to load modules", details: err.message });
    }
    try {
      const modules = JSON.parse(data);
      
      // DEBUG: Check if it is an array
      if (!Array.isArray(modules)) {
         console.warn("⚠️ Warning: Normal modules JSON is not an array!");
      }
      
      console.log(`✅ Loaded ${modules.length} Normal modules.`);
      res.json(modules);
    } catch (parseErr) {
      console.error("❌ Invalid JSON format in Normal modules:", parseErr);
      res.status(500).json({ error: "Invalid module file format" });
    }
  });
});

router.get("/domain-based-preprocessing-modules", (req, res) => {
  const moduleFilePath = path.join(rootDir, "preprocessing", "Domain_based_preprocessing", "domain_based_preprocessing_modules.json");
  console.log("📂 Attempting to read Domain Modules at:", moduleFilePath);

  fs.readFile(moduleFilePath, "utf8", (err, data) => {
    if (err) {
      console.error("❌ Error reading Domain module file:", err.message);
      return res.status(500).json({ error: "Failed to load modules", details: err.message });
    }
    try {
      const modules = JSON.parse(data);
      console.log(`✅ Loaded ${modules.length} Domain modules.`);
      res.json(modules);
    } catch (parseErr) {
      console.error("❌ Invalid JSON format in Domain modules:", parseErr);
      res.status(500).json({ error: "Invalid module file format" });
    }
  });
});

// 3. Model List
router.get("/model-list", (req, res) => {
  const modelFilePath = path.join(rootDir, "model_selectionAndTraining", "model_names.json");
  
  fs.readFile(modelFilePath, "utf8", (err, data) => {
    if (err) {
      console.error("❌ Error reading Model file:", err.message);
      return res.status(500).json({ error: "Failed to load models" });
    }
    try {
      const models = JSON.parse(data);
      res.json(models);
    } catch (parseErr) {
      console.error("❌ Invalid JSON in models:", parseErr);
      res.status(500).json({ error: "Invalid model file format" });
    }
  });
});

// 4. Output Options
router.get("/output-options", (req, res) => {
  const outputFilePath = path.join(rootDir, "output_section", "output_options.json");

  fs.readFile(outputFilePath, "utf8", (err, data) => {
    if (err) {
      console.error("❌ Error reading Output file:", err.message);
      return res.status(500).json({ error: "Failed to load output options" });
    }
    try {
      const outputs = JSON.parse(data);
      res.json(outputs);
    } catch (parseErr) {
      console.error("❌ Invalid JSON in outputs:", parseErr);
      res.status(500).json({ error: "Invalid output file format" });
    }
  });
});

module.exports = router;