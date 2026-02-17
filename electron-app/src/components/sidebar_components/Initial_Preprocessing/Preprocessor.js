import React, { useState } from "react"; 
import axios from "axios";
import ErrorPopup from '../../ErrorPopup'; 
import { API_BASE_URL } from "../../../config";

const Preprocessor = ({ file, detectedDomain, setLoading, onPlanGenerated }) => {
  const [error, setError] = useState(null); 

  const handlePreprocess = async (type) => {
    if (!file) return setError("Please upload a file first.");

    const formData = new FormData();
    formData.append("dataset", file);
    formData.append("domain", detectedDomain);
    
    setError(null); 
    setLoading(true);

    if (type === "domain") {
      try {
        const res = await axios.post(`${API_BASE_URL}/generate-domain-plan`, formData);
        if (onPlanGenerated) {
            onPlanGenerated(res.data.plan, { summary: res.data.summary, strategy: res.data.strategy });
        }
      } catch (err) {
        setError(`Failed to generate ${detectedDomain} plan.`);
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

const btnStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 4px",
    border: "none",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer",
    flex: 1,
    color: "white",
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
    whiteSpace: "nowrap"
};

export default Preprocessor;