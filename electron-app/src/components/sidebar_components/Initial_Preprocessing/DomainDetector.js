import React, { useState, useEffect } from "react";
import axios from "axios";
import ErrorPopup from "../../ErrorPopup";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

const DomainDetector = ({ file, onDomainDetected, setLoading }) => {
  const [finalDomain, setFinalDomain] = useState(null);
  const [error, setError] = useState(null);

  // Reset state when file changes
  useEffect(() => {
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
    console.log("🌍 API URL:", API_URL);

    try {
      setLoading(true);
      setError(null);

      const res = await axios.post(
        `${API_URL}/find-domain`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("📦 Backend response:", res.data);

      const {
        final_domain,
        domain, // fallback support
      } = res.data;

      const resolvedFinalDomain = final_domain || domain || "Unknown";

      setFinalDomain(resolvedFinalDomain);
      onDomainDetected(resolvedFinalDomain);

    } catch (err) {
      console.error("❌ Domain detection failed:", err);

      if (err.response) {
        setError(`Server Error: ${err.response.data?.error || "Unknown error"}`);
      } else if (err.request) {
        setError("Cannot connect to backend server. Check if backend is running.");
      } else {
        setError("Unexpected error occurred.");
      }

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

      {finalDomain && (
        <div
          style={{
            marginTop: 15,
            padding: 14,
            backgroundColor: "#f0f8ff",
            borderRadius: 8,
            fontSize: "16px",
            textAlign: "center",
            fontWeight: "bold",
            letterSpacing: "0.5px",
          }}
        >
          Final Domain: {finalDomain}
        </div>
      )}
    </div>
  );
};

export default DomainDetector;