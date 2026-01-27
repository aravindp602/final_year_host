import React, { useState } from "react"; 
import axios from "axios";
import ErrorPopup from '../../ErrorPopup'; 
import { API_BASE_URL } from "../../../config";

const Preprocessor = ({ file, detectedDomain, setLoading, onPlanGenerated }) => {
  const [error, setError] = useState(null); 

  const handlePreprocess = async (type) => {
    if (!file) {
      setError("Please upload a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("dataset", file);
    
    setError(null); 
    setLoading(true);

    if (type === "domain") {
      try {
        console.log("🤖 Calling Medical Plan Generator...");
        const res = await axios.post(`${API_BASE_URL}/generate-medical-plan`, formData);
        console.log("✅ Plan received:", res.data);
        
        // --- FIX IS HERE ---
        // The backend returns: { plan: {}, summary: "...", strategy: "..." }
        // We need to package summary/strategy into the second argument
        if (onPlanGenerated) {
            onPlanGenerated(res.data.plan, { 
                summary: res.data.summary, 
                strategy: res.data.strategy 
            });
        }

      } catch (err) {
        console.error("❌ Error generating medical plan:", err);
        setError(err.response?.data?.message || "Failed to generate AI plan.");
      } finally {
        setLoading(false);
      }
    } else {
      // Normal Preprocessing Logic
      try {
        formData.append("isCustom", "false");
        console.log(`⚙️ Starting normal preprocessing...`);
        const res = await axios.post(`${API_BASE_URL}/preprocess-normal`, formData);
        
        if (res.data.graph && res.data.outputs) {
          window.dispatchEvent(new CustomEvent("normal-run-complete", { detail: res.data }));
        }
      } catch (err) {
        console.error("❌ Error during normal preprocessing:", err);
        setError("Something went wrong during normal preprocessing.");
      } finally {
        setLoading(false);
      }
    }
  };

  const normalizedDomain = detectedDomain ? detectedDomain.toString().trim().toLowerCase() : "";
  const isMedical = normalizedDomain === "medical";

  return (
    <div>
      {error && <ErrorPopup message={error} onClose={() => setError(null)} />}
      <p style={{ marginBottom: 10, fontWeight: "bold" }}>Create Main Branch with:</p>

      {isMedical ? (
        <div style={{ display: "flex", flexDirection: "row", gap: 10 }}> 
          <button
            onClick={() => handlePreprocess("domain")}
            style={{
              padding: "8px 12px", border: "none", borderRadius: 6,
              backgroundColor: "#b730cfff", color: "white", cursor: "pointer",
              flex: 1
            }}
          >
            Generate AI Plan
          </button>
          <button
            onClick={() => handlePreprocess("normal")}
            style={{
              padding: "8px 12px", border: "none", borderRadius: 6,
              backgroundColor: "#28a745", color: "white",
              cursor: "pointer", flex: 1,
            }}
          >
            Normal Preprocessing
          </button>
        </div>
      ) : (
        <button
          onClick={() => handlePreprocess("normal")}
          style={{
            padding: "8px 12px", border: "none", borderRadius: 6,
            backgroundColor: "#28a745", color: "white",
            cursor: "pointer", width: "100%",
          }}
        >
          Normal Preprocessing
        </button>
      )}
    </div>
  );
};

export default Preprocessor;