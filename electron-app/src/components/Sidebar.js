import React, { useEffect, useState } from "react";
import axios from 'axios';
import FileUploader from "./sidebar_components/Initial_Preprocessing/FileUploader";
import DomainDetector from "./sidebar_components/Initial_Preprocessing/DomainDetector";
import Preprocessor from "./sidebar_components/Initial_Preprocessing/Preprocessor";
import PreprocessingOptions from "./sidebar_components/PreprocessingOptions/PreprocessingOptions";
import ModelSelectionOptions from "./sidebar_components/ModelSelection/ModelSelectionOptions";
import OutputOptions from "./sidebar_components/OutputOptions/OutputOptions";
import AIPlanOverlay from "./sidebar_components/Initial_Preprocessing/AIPlanOverlay";
// 1. Ensure this path is correct based on your folder structure
import { API_BASE_URL } from "../config";

const Sidebar = ({
  file,
  onFileChange,
  onDomainDetected,
  domain,
  setGlobalLoading,
  medicalPlan,
  medicalExplanation,
  onPlanGenerated,
  onPlanUpdate,
}) => {
  const [NormalprocessingModules, setNormalProcessingModules] = useState([]);
  const [DomainprocessingModules, setDomainProcessingModules] = useState([]);
  const [models, setModels] = useState([]);
  const [outputModules, setOutput] = useState([]);
  
  // --- STATE FOR MODAL VISIBILITY ---
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  useEffect(() => {
    // 2. UPDATED: Use API_BASE_URL for all fetches
    fetch(`${API_BASE_URL}/normal-preprocessing-modules`).then(res => res.json()).then(setNormalProcessingModules).catch(err => console.error("Failed to fetch normal modules:", err));
    fetch(`${API_BASE_URL}/domain-based-preprocessing-modules`).then(res => res.json()).then(setDomainProcessingModules).catch(err => console.error("Failed to fetch domain modules:", err));
    fetch(`${API_BASE_URL}/model-list`).then(res => res.json()).then(setModels).catch(err => console.error("Failed to fetch models:", err));
    fetch(`${API_BASE_URL}/output-options`).then(res => res.json()).then(setOutput).catch(err => console.error("Failed to fetch outputs:", err));
  }, []);

  const handlePlanGeneratedWrapper = (plan, explanation) => {
      onPlanGenerated(plan, explanation);
      if(plan) {
          setIsPlanModalOpen(true);
      }
  };

  const handleExecutionSuccess = (responseData) => {
      setIsPlanModalOpen(false);
      window.dispatchEvent(new CustomEvent("normal-run-complete", { detail: responseData }));
  };

  // --- FINALIZED LOGIC FOR APPROVING THE PLAN ---
  const handleApprovePlan = async (approvedPlan) => {
    console.log("✅ [Sidebar] Plan Approved! Sending to backend:", approvedPlan);
    setGlobalLoading(true);
    setIsPlanModalOpen(false); // Close the modal immediately when executing

    const formData = new FormData();
    formData.append("dataset", file);
    formData.append("plan", JSON.stringify(approvedPlan));

    try {
        // 3. UPDATED: Use API_BASE_URL for execution
        const res = await axios.post(`${API_BASE_URL}/execute-approved-plan`, formData);
        
        console.log("✅ [Sidebar] Main branch created from plan:", res.data);
        
        window.dispatchEvent(new CustomEvent("normal-run-complete", { detail: res.data }));
        
    } catch (error) {
        console.error("❌ Error executing approved plan:", error);
        alert("Failed to create the main branch from the approved plan. Check the backend console for errors.");
    } finally {
        setGlobalLoading(false);
    }
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

          {/* --- NEW BUTTON: View AI Plan (Blue Theme & Centered) --- */}
          {medicalPlan && (
              <button 
                onClick={() => setIsPlanModalOpen(true)}
                style={{
                    width: '80%',            
                    margin: '15px auto 0 auto',
                    padding: '10px',
                    backgroundColor: '#f1f3f5',
                    border: '1px solid #007bff', 
                    color: '#007bff',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 4px rgba(0,123,255,0.2)'
                }}
              >
                <span>📋</span>View AI Plan
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
    {isPlanModalOpen && medicalPlan && (
        <AIPlanOverlay 
            file={file}
            initialPlan={medicalPlan}
            explanation={medicalExplanation}
            onUpdate={onPlanUpdate}
            onExecutionComplete={handleExecutionSuccess}
            onClose={() => setIsPlanModalOpen(false)}
        />
    )}
    </>
  );
};

export default Sidebar;