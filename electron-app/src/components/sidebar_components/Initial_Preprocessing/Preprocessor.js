import React, { useState } from "react"; 
import axios from "axios";
import ErrorPopup from '../../ErrorPopup'; 
import { API_BASE_URL } from "../../../config";

const Preprocessor = ({ file, detectedDomain, setLoading, onPlanGenerated }) => {
  const [error, setError] = useState(null); 
  const [llmMode, setLlmMode] = useState("local"); // Toggles between 'local' and 'api'

  const handlePreprocess = async (type) => {
    if (!file) return setError("Please upload a file first.");

    const formData = new FormData();
    formData.append("dataset", file);
    formData.append("domain", detectedDomain || "Medical");
    formData.append("llmMode", llmMode); // Send the selected mode!
    
    setError(null); 
    setLoading(true);

    if (type === "domain") {
      try {
        const res = await axios.post(`${API_BASE_URL}/generate-domain-plan`, formData);
        if (onPlanGenerated) {
            onPlanGenerated(res.data.plan, { summary: res.data.summary, strategy: res.data.strategy });
        }
      } catch (err) {
        setError(`Failed to generate AI plan. Ensure ${llmMode === 'local' ? 'Ollama is running' : 'HF Token is set'}.`);
      } finally {
        setLoading(false);
      }
    } else {
      try {
        formData.append("isCustom", "false");
        const res = await axios.post(`${API_BASE_URL}/preprocess-normal`, formData);
        if (res.data.graph) {
          window.dispatchEvent(new CustomEvent("normal-run-complete", { detail: res.data }));
        }
      } catch (err) {
        setError("Normal preprocessing failed.");
      } finally {
        setLoading(false);
      }
    }
  };

  const isAIEnabled = ["medical", "finance"].includes(detectedDomain?.toLowerCase());

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      {error && <ErrorPopup message={error} onClose={() => setError(null)} />}
      
      {/* LLM ENGINE TOGGLE UI */}
      {isAIEnabled && (
        <div style={toggleContainerStyle}>
          <span style={toggleLabelStyle}>AI Engine:</span>
          <div style={switchWrapperStyle}>
            <button 
              onClick={() => setLlmMode("local")}
              style={llmMode === "local" ? activeToggleStyle : inactiveToggleStyle}
            >
              Local (Ollama)
            </button>
            <button 
              onClick={() => setLlmMode("api")}
              style={llmMode === "api" ? activeToggleStyle : inactiveToggleStyle}
            >
              Cloud (API)
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", width: "100%" }}>
        {isAIEnabled && (
          <button
            onClick={() => handlePreprocess("domain")}
            style={{ ...btnStyle, background: "#a855f7" }}
          >
            AI Plan
          </button>
        )}
        <button
          onClick={() => handlePreprocess("normal")}
          style={{ 
            ...btnStyle, 
            background: "#22c55e",
            flex: isAIEnabled ? 1 : 'none',
            width: isAIEnabled ? 'auto' : '100%'
          }}
        >
          Normal Preprocessing
        </button>
      </div>
    </div>
  );
};

// --- STYLES ---
const btnStyle = { display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 4px", border: "none", borderRadius: "8px", fontSize: "11px", fontWeight: "700", cursor: "pointer", flex: 1, color: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.1)", whiteSpace: "nowrap" };
const toggleContainerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' };
const toggleLabelStyle = { fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' };
const switchWrapperStyle = { display: 'flex', gap: '4px', backgroundColor: '#e2e8f0', padding: '3px', borderRadius: '6px' };
const activeToggleStyle = { background: '#fff', color: '#3b82f6', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '10px', fontWeight: '700', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'all 0.2s ease-in-out' };
const inactiveToggleStyle = { background: 'transparent', color: '#64748b', border: 'none', padding: '4px 10px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease-in-out' };

export default Preprocessor;