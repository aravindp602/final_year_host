import React, { useEffect, useState } from "react";
import FileUploader from "./sidebar_components/Initial_Preprocessing/FileUploader";
import DomainDetector from "./sidebar_components/Initial_Preprocessing/DomainDetector";
import Preprocessor from "./sidebar_components/Initial_Preprocessing/Preprocessor";
import PreprocessingOptions from "./sidebar_components/PreprocessingOptions/PreprocessingOptions";
import ModelSelectionOptions from "./sidebar_components/ModelSelection/ModelSelectionOptions";
import OutputOptions from "./sidebar_components/OutputOptions/OutputOptions";
import AIPlanOverlay from "./sidebar_components/AI_Plan/AIPlanOverlay";
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
  // --- Data State ---
  const [NormalprocessingModules, setNormalProcessingModules] = useState([]);
  const [DomainprocessingModules, setDomainProcessingModules] = useState([]);
  const [models, setModels] = useState([]);
  const [outputModules, setOutput] = useState([]);

  // --- UI State ---
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // --- Fetch Initial Data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [normalRes, domainRes, modelRes, outputRes] = await Promise.all([
          fetch(`${API_BASE_URL}/normal-preprocessing-modules`),
          fetch(`${API_BASE_URL}/domain-based-preprocessing-modules`),
          fetch(`${API_BASE_URL}/model-list`),
          fetch(`${API_BASE_URL}/output-options`)
        ]);

        setNormalProcessingModules(await normalRes.json());
        setDomainProcessingModules(await domainRes.json());
        setModels(await modelRes.json());
        setOutput(await outputRes.json());
      } catch (err) {
        console.error("Error fetching sidebar data:", err);
      }
    };

    fetchData();
  }, []);

  // --- Handlers ---

  /**
   * Wrapper to handle the data coming from Preprocessor.js
   * Handles legacy string explanations vs new object structure.
   */
  const handlePlanGeneratedWrapper = (plan, explanationData) => {
    // 1. Structure the explanation object correctly for the overlay
    let explanationObj = {};

    if (typeof explanationData === 'string') {
      explanationObj = { summary: explanationData, strategy: explanationData };
    } else {
      explanationObj = {
        summary: explanationData?.summary || "Summary not available.",
        strategy: explanationData?.strategy || "Strategy not available."
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
    window.dispatchEvent(
      new CustomEvent("normal-run-complete", { detail: responseData })
    );
  };

  return (
    <>
      {/* ===== SIDEBAR CONTAINER (Handles Width Animation) ===== */}
      <div
        style={{
          position: "relative",
          width: isCollapsed ? "0px" : "300px",
          transition: "width 0.3s ease",
          // overflow visible allows the toggle button to sit outside
          overflow: "visible", 
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        {/* ===== ACTUAL SIDEBAR CONTENT ===== */}
        <aside
          style={{
            width: "300px",
            height: "100vh",
            backgroundColor: "#f0f2f5", // Cleaner modern gray from V1
            borderRight: "1px solid #ccc",
            display: "flex",
            flexDirection: "column",
            transform: isCollapsed ? "translateX(-100%)" : "translateX(0)",
            transition: "transform 0.3s ease",
            position: "absolute", // Fixes layout during animation
            left: 0,
            top: 0,
          }}
        >
          {/* Hide content when collapsed to prevent focus/interaction issues */}
          <div
            style={{
              padding: 12,
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 15,
              opacity: isCollapsed ? 0 : 1,
              transition: "opacity 0.2s ease",
              pointerEvents: isCollapsed ? "none" : "auto",
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

              {/* View AI Plan Button - CUSTOMIZED */}
              {medicalPlan && (
                <button
                  onClick={() => setIsPlanModalOpen(true)}
                  style={{
                    width: '90%',
                    margin: '8px auto 0',
                    padding: '12px 16px',
                    // Modern Blue Gradient
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '700',
                    // Soft blue shadow for depth
                    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    transition: 'transform 0.1s ease, box-shadow 0.2s ease',
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 15px rgba(37, 99, 235, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(37, 99, 235, 0.25)';
                  }}
                >
                  <span style={{ fontSize: '16px' }}>✨</span> View AI Strategy
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

        {/* ===== TOGGLE BUTTON ===== */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            position: "absolute",
            top: "50%",
            right: "-32px", // Positioned just outside the sidebar
            transform: "translateY(-50%)",
            width: "32px",
            height: "40px",
            borderTopRightRadius: "8px",
            borderBottomRightRadius: "8px",
            border: "1px solid #ccc",
            borderLeft: "none",
            backgroundColor: "#ffffff",
            cursor: "pointer",
            boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px",
            fontWeight: "bold",
            color: "#555",
            zIndex: 60, // Above sidebar
          }}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? "›" : "‹"}
        </button>
      </div>

      {/* ===== AI PLAN OVERLAY (Rendered outside layout flow) ===== */}
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