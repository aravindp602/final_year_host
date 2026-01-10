import React, { useState, useEffect } from "react";
import axios from "axios";
import ErrorPopup from '../../ErrorPopup';
import { API_BASE_URL } from "../../config";

// 1. Accept setLoading prop (was local state before)
const DomainDetector = ({ file, onDomainDetected, setLoading }) => {
  const [domain, setDomain] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDomain(null);
  }, [file]);

  const handleFindDomain = async () => {
    if (!file) {
      setError("Please upload a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("dataset", file);
    console.log("🚀 [DomainDetector] Sending file to backend:", file.name);

    try {
      setLoading(true); // Triggers global overlay
      setError(null);

      const res = await axios.post(`${API_BASE_URL}/find-domain`, formData);

      console.log("📦 [DomainDetector] Backend raw response:", res);

      if (res.data && res.data.domain) {
        setDomain(res.data.domain);
        onDomainDetected(res.data.domain);
      } else {
        console.warn("⚠️ No 'domain' field found");
        setError("Could not detect domain.");
      }
    } catch (err) {
      console.error("❌ Error:", err);
      setError("Something went wrong.");
    } finally {
      setLoading(false); // Hides global overlay
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

      {domain && (
        <div style={{ 
            marginTop: 15,
            padding: 10,
            backgroundColor: "#f0f8ff",
            borderRadius: 6,
            fontWeight: "bold",
            textAlign: "center"
          }}>
          Domain: {domain}
        </div>
      )}
    </div>
  );
};

export default DomainDetector;