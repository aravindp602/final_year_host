import React, { useEffect, useState } from "react";
import axios from 'axios';
import FileUploader from "./sidebar_components/Initial_Preprocessing/FileUploader";
import DomainDetector from "./sidebar_components/Initial_Preprocessing/DomainDetector";
import Preprocessor from "./sidebar_components/Initial_Preprocessing/Preprocessor";
import PreprocessingOptions from "./sidebar_components/PreprocessingOptions/PreprocessingOptions";
import ModelSelectionOptions from "./sidebar_components/ModelSelection/ModelSelectionOptions";
import OutputOptions from "./sidebar_components/OutputOptions/OutputOptions";
import AIPlanOverlay from "./sidebar_components/Initial_Preprocessing/AIPlanOverlay";
import { API_BASE_URL } from "../config";

const Sidebar = ({
  file,
  onFileChange,
  onDomainDetected,
  domain,
  setGlobalLoading,
  // These props come from Dashboard.js state, but we also manage local state for the modal
  medicalPlan: propPlan,
  medicalExplanation: propExplanation,
  onPlanGenerated, // Callback to update Dashboard.js
  onPlanUpdate,
}) => {
  const [NormalprocessingModules, setNormalProcessingModules] = useState([]);
  const [DomainprocessingModules, setDomainProcessingModules] = useState([]);
  const [models, setModels] = useState([]);
  const [outputModules, setOutput] = useState([]);
  
  // Local state to control the modal visibility
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/normal-preprocessing-modules`).then(res => res.json()).then(setNormalProcessingModules).catch(err => console.error("Failed to fetch normal modules:", err));
    fetch(`${API_BASE_URL}/domain-based-preprocessing-modules`).then(res => res.json()).then(setDomainProcessingModules).catch(err => console.error("Failed to fetch domain modules:", err));
    fetch(`${API_BASE_URL}/model-list`).then(res => res.json()).then(setModels).catch(err => console.error("Failed to fetch models:", err));
    fetch(`${API_BASE_URL}/output-options`).then(res => res.json()).then(setOutput).catch(err => console.error("Failed to fetch outputs:", err));
  }, []);

  /**
   * Wrapper to handle the data coming from Preprocessor.js
   * Expected data structure from backend: { plan: {...}, summary: "...", strategy: "..." }
   */
  const handlePlanGeneratedWrapper = (plan, explanationData) => {
      // 1. Structure the explanation object correctly for the overlay
      // If explanationData is a string (legacy), wrap it. If object, use it.
      let explanationObj = {};
      
      if (typeof explanationData === 'string') {
          explanationObj = { summary: explanationData, strategy: explanationData };
      } else {
          explanationObj = { 
              summary: explanationData.summary || "Summary not available.", 
              strategy: explanationData.strategy || "Strategy not available." 
          };
      }

      // 2. Update Parent State (Dashboard.js)
      if (onPlanGenerated) {
          onPlanGenerated(plan, explanationObj);
      }

      // 3. Open the Modal immediately
      if (plan) {
          setIsPlanModalOpen(true);
      }
  };

  const handleExecutionSuccess = (responseData) => {
      setIsPlanModalOpen(false);
      window.dispatchEvent(new CustomEvent("normal-run-complete", { detail: responseData }));
  };

  return (
    <>
    <aside
      style={{
        width: 300,
        height: "100vh",
        backgroundColor: "#f0f2f5",
        borderRight: "1px solid #ccc",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: 12,
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 15,
        }}
      >
        {/* 1. Upload Section */}
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <FileUploader
            onFileSelect={onFileChange}
            onDatasetUpload={(file) =>
              window.dispatchEvent(
                new CustomEvent("dataset-selected", { detail: file })
              )
            }
          />

          {file && (
            <DomainDetector
              file={file}
              onDomainDetected={onDomainDetected}
              setLoading={setGlobalLoading}
            />
          )}

          {file && domain && (
            <Preprocessor
              file={file}
              detectedDomain={domain}
              setLoading={setGlobalLoading}
              onPlanGenerated={handlePlanGeneratedWrapper} 
            />
          )}

          {/* View AI Plan Button - Only shows if plan exists in props */}
          {propPlan && (
              <button 
                onClick={() => setIsPlanModalOpen(true)}
                style={{
                    width: '100%',            
                    marginTop: '15px',
                    padding: '10px',
                    backgroundColor: '#e7f1ff',
                    border: '1px solid #007bff', 
                    color: '#007bff',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background 0.2s'
                }}
              >
                <span>📋</span> View Generated AI Plan
              </button>
          )}

        </div>

        {/* 2. Preprocessing Options */}
        <PreprocessingOptions 
            NormalprocessingModules={NormalprocessingModules}
            DomainprocessingModules={DomainprocessingModules}
            domain={domain}
        />

        {/* 3. Model Selection */}
        <ModelSelectionOptions models={models} />

        {/* 4. Output Options */}
        <OutputOptions outputModules={outputModules} />
      </div>
    </aside>

    {/* --- RENDER MODAL OUTSIDE ASIDE --- */}
    {isPlanModalOpen && propPlan && (
        <AIPlanOverlay 
            file={file}
            initialPlan={propPlan}
            explanation={propExplanation} // Passes { summary, strategy }
            onUpdate={onPlanUpdate}
            onExecutionComplete={handleExecutionSuccess}
            onClose={() => setIsPlanModalOpen(false)}
        />
    )}
    </>
  );
};

export default Sidebar;