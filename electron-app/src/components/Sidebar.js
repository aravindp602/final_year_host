import React, { useEffect, useState } from "react";
import FileUploader from "./sidebar_components/Initial_Preprocessing/FileUploader";
import DomainDetector from "./sidebar_components/Initial_Preprocessing/DomainDetector";
import Preprocessor from "./sidebar_components/Initial_Preprocessing/Preprocessor";
import PreprocessingOptions from "./sidebar_components/PreprocessingOptions/PreprocessingOptions";
import ModelSelectionOptions from "./sidebar_components/ModelSelection/ModelSelectionOptions";
import OutputOptions from "./sidebar_components/OutputOptions/OutputOptions";
import AIPlanOverlay from "./sidebar_components/AI_Plan/AIPlanOverlay";
import { API_BASE_URL } from "../config";
import { Sparkles } from 'lucide-react'; 

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
  const [outputModules, setOutputModules] = useState([]);

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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
        setOutputModules(await outputRes.json());
      } catch (err) {
        console.error("Error fetching sidebar data:", err);
      }
    };
    fetchData();
  }, []);

  const handlePlanGeneratedWrapper = (plan, explanationData) => {
    let explanationObj = {};
    if (typeof explanationData === 'string') {
      explanationObj = { summary: explanationData, strategy: explanationData };
    } else {
      explanationObj = {
        summary: explanationData?.summary || "Summary not available.",
        strategy: explanationData?.strategy || "Strategy not available."
      };
    }
    if (onPlanGenerated) onPlanGenerated(plan, explanationObj);
    if (plan) setIsPlanModalOpen(true);
  };

  const handleExecutionSuccess = (responseData) => {
    setIsPlanModalOpen(false);
    window.dispatchEvent(new CustomEvent("normal-run-complete", { detail: responseData }));
  };

  return (
    <>
      <div style={styles.sidebarWrapper}>
        <aside style={{
          ...styles.sidebarContent,
          width: isCollapsed ? "0px" : "300px",
          transform: isCollapsed ? "translateX(-100%)" : "translateX(0)",
        }}>
          <div style={{...styles.scrollContainer, opacity: isCollapsed ? 0 : 1}}>
            
            {/* 1. DATA SETUP */}
            <div style={styles.card}>
              <div style={styles.sectionLabel}>1. Data Setup</div>
              <FileUploader
                onFileSelect={onFileChange}
                onDatasetUpload={(file) => window.dispatchEvent(new CustomEvent("dataset-selected", { detail: file }))}
              />
              {file && (
                <div style={{ marginTop: '12px' }}>
                  <DomainDetector file={file} onDomainDetected={onDomainDetected} setLoading={setGlobalLoading} />
                </div>
              )}
            </div>

            {/* 2. BUILD PIPELINE - ALIGNMENT FIXED */}
            {file && domain && (
              <div style={styles.card}>
                <div style={styles.sectionLabel}>2. Build Pipeline</div>
                
                <Preprocessor
                  file={file}
                  detectedDomain={domain}
                  setLoading={setGlobalLoading}
                  onPlanGenerated={handlePlanGeneratedWrapper}
                />

                {medicalPlan && (
                  <button
                    onClick={() => setIsPlanModalOpen(true)}
                    style={styles.viewStrategyBtn}
                  >
                    <Sparkles size={14} /> View AI Strategy
                  </button>
                )}
              </div>
            )}

            {/* 3. COMPONENTS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={styles.sectionLabel}>3. Component Library</div>
                <PreprocessingOptions
                    NormalprocessingModules={NormalprocessingModules}
                    DomainprocessingModules={DomainprocessingModules}
                    domain={domain}
                />
                <ModelSelectionOptions models={models} />
                <OutputOptions outputModules={outputModules} />
            </div>
          </div>
        </aside>

        <button onClick={() => setIsCollapsed(!isCollapsed)} style={styles.toggleBtn}>
          {isCollapsed ? "›" : "‹"}
        </button>
      </div>

      {isPlanModalOpen && medicalPlan && (
        <AIPlanOverlay
          file={file}
          domain={domain}
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

const styles = {
  sidebarWrapper: { position: "relative", height: "100vh", flexShrink: 0, zIndex: 50, transition: "width 0.3s ease" },
  sidebarContent: { height: "100%", backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", transition: "all 0.3s ease", overflow: "hidden" },
  scrollContainer: { padding: "16px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px", width: "300px", boxSizing: "border-box" },
  card: { padding: "16px", borderRadius: "12px", backgroundColor: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box" },
  sectionLabel: { fontSize: "10px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" },
  viewStrategyBtn: { width: '100%', marginTop: '10px', padding: '10px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', boxSizing: "border-box" },
  toggleBtn: { position: "absolute", top: "50%", right: "-32px", transform: "translateY(-50%)", width: "32px", height: "40px", borderTopRightRadius: "8px", borderBottomRightRadius: "8px", border: "1px solid #e2e8f0", borderLeft: "none", backgroundColor: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "#64748b", zIndex: 60 }
};

export default Sidebar;