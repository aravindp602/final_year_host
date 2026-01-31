import React, { useState, useEffect } from "react";
import axios from "axios";
import ErrorPopup from "../../ErrorPopup";
import { API_BASE_URL } from "../../../config";

const DomainDetector = ({ file, onDomainDetected, setLoading }) => {
  const [geminiDomain, setGeminiDomain] = useState(null);
  const [groqDomain, setGroqDomain] = useState(null);
  const [finalDomain, setFinalDomain] = useState(null);
  const [error, setError] = useState(null);

  // Reset state when a new file is uploaded
  useEffect(() => {
    setGeminiDomain(null);
    setGroqDomain(null);
    setFinalDomain(null);
    setError(null);
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

      const res = await axios.post(
        `${API_BASE_URL}/find-domain`,
        formData,
        { validateStatus: () => true } // 👈 prevent axios auto-throw
      );

      console.log("📦 Backend response:", res.status, res.data);

      // Explicit status handling
      if (res.status !== 200) {
        throw new Error(res.data?.error || "Domain detection failed");
      }

      const {
        gemini_domain,
        groq_domain,
        final_domain = res.data.domain, // backward compatibility
      } = res.data;

      setGeminiDomain(gemini_domain || null);
      setGroqDomain(groq_domain || null);
      setFinalDomain(final_domain || null);

      onDomainDetected(final_domain);

    } catch (err) {
      console.error("❌ Domain detection error:", err);
      setError(err.message || "Something went wrong while detecting domain.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <ErrorPopup
          message={error}
          onClose={() => setError(null)}
        />
      )}

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
          {/* {geminiDomain && (
            <p><strong>Gemini Prediction:</strong> {geminiDomain}</p>
          )}
          {groqDomain && (
            <p><strong>Groq Prediction:</strong> {groqDomain}</p>
          )}

          {(geminiDomain || groqDomain) && <hr />} */}

          <p><strong>Final Domain:</strong> {finalDomain}</p>
        </div>
      )}
    </div>
  );
};

export default DomainDetector;