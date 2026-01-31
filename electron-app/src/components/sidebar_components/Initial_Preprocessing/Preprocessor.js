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
        const res = await axios.post(`${API_BASE_URL}/generate-medical-plan`, formData);
        if (onPlanGenerated) {
            onPlanGenerated(res.data.plan, { 
                summary: res.data.summary, 
                strategy: res.data.strategy 
            });
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to generate AI plan.");
      } finally {
        setLoading(false);
      }
    } else {
      try {
        formData.append("isCustom", "false");
        const res = await axios.post(`${API_BASE_URL}/preprocess-normal`, formData);
        if (res.data.graph && res.data.outputs) {
          window.dispatchEvent(new CustomEvent("normal-run-complete", { detail: res.data }));
        }
      } catch (err) {
        setError("Something went wrong during normal preprocessing.");
      } finally {
        setLoading(false);
      }
    }
  };

  const normalizedDomain = detectedDomain ? detectedDomain.toString().trim().toLowerCase() : "";
  const isMedical = normalizedDomain === "medical";

  return (
    <div style={styles.container}>
      {error && <ErrorPopup message={error} onClose={() => setError(null)} />}
      
      <h3 style={styles.sectionHeader}>Create Main Branch With:</h3>

      <div style={styles.buttonWrapper}>
        {isMedical && (
          <button
            onClick={() => handlePreprocess("domain")}
            style={{ ...styles.baseButton, ...styles.aiButton }}
            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
          >
            {/* <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg> */}
            AI Generated Plan
          </button>
        )}

        <button
          onClick={() => handlePreprocess("normal")}
          style={{ 
            ...styles.baseButton, 
            ...styles.normalButton,
            width: isMedical ? "auto" : "100%" 
          }}
          onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
        >
          {/* <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg> */}
          Normal Preprocessing
        </button>
      </div>
    </div>
  );
};

/* ===================== STYLES ===================== */

const styles = {
  container: {
    marginTop: "12px",
    padding: "12px 0",
    borderTop: "1px solid #f1f5f9",
  },
  sectionHeader: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#64748b", // Slate-500
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "0 0 10px 0",
  },
  buttonWrapper: {
    display: "flex",
    flexDirection: "row",
    gap: "8px",
  },
  baseButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 12px",
    border: "none",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "400",
    cursor: "pointer",
    flex: 1,
    transition: "all 0.2s ease",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  aiButton: {
    background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)", // Professional Purple
    color: "white",
  },
  normalButton: {
    background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", // Professional Green
    color: "white",
  },
  icon: {
    width: "14px",
    height: "14px",
  }
};

export default Preprocessor;