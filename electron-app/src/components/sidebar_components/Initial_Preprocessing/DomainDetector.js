import React, { useState, useEffect } from "react";
import axios from "axios";
import ErrorPopup from '../../ErrorPopup';
import { API_BASE_URL } from "../../../config"; 

const DomainDetector = ({ file, onDomainDetected, setLoading }) => {
  const [geminiDomain, setGeminiDomain] = useState(null);
  const [groqDomain, setGroqDomain] = useState(null);
  const [ollamaDomain, setOllamaDomain] = useState(null);
  const [finalDomain, setFinalDomain] = useState(null);
  const [targetColumn, setTargetColumn] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setGeminiDomain(null);
    setGroqDomain(null);
    setOllamaDomain(null);
    setFinalDomain(null);
    setTargetColumn(null);
  }, [file]);

  const handleFindDomain = async () => {
    if (!file) {
      setError("Please upload a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("dataset", file);
    console.log("🚀 [DomainDetector] Sending file:", file.name);

    try {
      setLoading(true);
      setError(null);

      // ✅ Use Dynamic URL from config
      const res = await axios.post(`${API_BASE_URL}/find-domain`, formData);
      console.log("📦 Backend response:", res.data);

      // Backend currently returns simple { domain: "Medical" } in DEV MODE.
      // If you update the Python logic later to return details, this UI will show them.
      // For now, we fallback to safe defaults if fields are missing.
      
      const {
        gemini_domain,
        groq_domain,
        ollama_domain,
        final_domain = res.data.domain, // Fallback for simple backend
        target_column
      } = res.data;

      setGeminiDomain(gemini_domain);
      setGroqDomain(groq_domain);
      setOllamaDomain(ollama_domain);
      setFinalDomain(final_domain);
      setTargetColumn(target_column);

      // Pass result to parent
      // Note: onDomainDetected(domain) -> usually takes 1 arg, check Sidebar.js if it takes 2.
      onDomainDetected(final_domain);

    } catch (err) {
      console.error("❌ Error:", err);
      setError("Something went wrong while detecting domain.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <ErrorPopup message={error} onClose={() => setError(null)} />}

      <button
        onClick={handleFindDomain}
        style={{
          padding: "8px 12px",
          border: "none",
          borderRadius: 6,
          backgroundColor: "#007bff",
          color: "white",
          cursor: "pointer",
          width: "100%",
          marginTop: 15,
        }}
      >
        Find Domain
      </button>

      {/* ----- RESULT UI ----- */}
      {finalDomain && (
        <div
          style={{
            marginTop: 15,
            padding: 12,
            backgroundColor: "#f0f8ff",
            borderRadius: 8,
            fontSize: "14px",
          }}
        >
          {/* Show details only if they exist (Advanced Backend Mode) */}
          {geminiDomain && <p><strong>Gemini Prediction:</strong> {geminiDomain}</p>}
          {groqDomain && <p><strong>Groq Prediction:</strong> {groqDomain}</p>}
          {ollamaDomain && <p><strong>Ollama Prediction:</strong> {ollamaDomain}</p>}
          
          {(geminiDomain || groqDomain) && <hr />}
          
          <p><strong>Final Domain:</strong> {finalDomain}</p>
          {targetColumn && <p><strong>Target Column:</strong> {targetColumn}</p>}
        </div>
      )}
    </div>
  );
};

export default DomainDetector;