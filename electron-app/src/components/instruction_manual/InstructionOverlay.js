import React from "react";
import fileUploaderImg from "./findDomain.GIF";
import mainBranchCreation from "./createBranch.GIF";
import playAroundImg from "./experiment.GIF";

const InstructionOverlay = ({ onClose }) => {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.6)", // Slightly darker for better focus
        zIndex: 10000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backdropFilter: "blur(5px)", // Increased blur
      }}
    >
      <div
        style={{
          width: "90%",
          maxWidth: "1000px", // Wider to fit side-by-side images
          height: "85%",
          backgroundColor: "#fff",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 30px",
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#fff",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#2c3e50", fontSize: "24px" }}>
              📘 User Guide
            </h2>
            <p style={{ margin: "5px 0 0", color: "#7f8c8d", fontSize: "14px" }}>
              Follow these steps to set up your pipelines.
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "#f1f2f6",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              cursor: "pointer",
              color: "#333",
              transition: "background 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#e1e2e6")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#f1f2f6")}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            padding: "40px",
            overflowY: "auto",
            color: "#333",
            lineHeight: "1.6",
          }}
        >
          {/* Step 1 */}
          <div style={styles.stepContainer}>
            <div style={styles.textColumn}>
              <h3 style={styles.stepTitle}>
                <span style={styles.stepNumber}>1</span> Select File & Domain
              </h3>
              <p>
                Select your file using the upload button and click on{" "}
                <strong>Find Domain</strong>.
              </p>
              <div style={styles.infoTag}>
                ℹ️ Supports <strong>.csv</strong> files only.
              </div>
            </div>
            <div style={styles.imageColumn}>
              {/* PLACEHOLDER: Replace src with your specific GIF/Image for Step 1 */}
              <img
                src={fileUploaderImg}
                alt="Select File Demo"
                style={styles.image}
              />
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Step 2 */}
          <div style={styles.stepContainer}>
            <div style={styles.textColumn}>
              <h3 style={styles.stepTitle}>
                <span style={styles.stepNumber}>2</span> Create Main Branch
              </h3>
              <p>
                Create your main pipeline branch. The system will adapt based on
                your data.
              </p>
              <div style={styles.subBox}>
                <strong>For Medical Domains:</strong> You will see two options:
                <ul style={{ paddingLeft: "20px", marginTop: "5px", marginBottom: 0 }}>
                  <li>Generate a <strong>Domain-Based AI Plan</strong></li>
                  <li>Click on <strong>Normal Preprocessing Plan</strong></li>
                </ul>
              </div>
            </div>
            <div style={styles.imageColumn}>
              {/* PLACEHOLDER: Replace src with your specific GIF/Image for Step 2 */}
              <img
                src={mainBranchCreation}
                alt="Branch Creation Demo"
                style={styles.image}
              />
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Step 3 */}
          <div style={styles.stepContainer}>
            <div style={styles.textColumn}>
              <h3 style={styles.stepTitle}>
                <span style={styles.stepNumber}>3</span> Experiment
              </h3>
              <p>
                Create new branches to test different configurations and play
                around with the pipeline settings. Press "Run Configuration" to see
                the results.
              </p>
            </div>
            <div style={styles.imageColumn}>
              {/* PLACEHOLDER: Replace src with your specific GIF/Image for Step 3 */}
              <img
                src={playAroundImg}
                alt="New Branches Demo"
                style={styles.image}
              />
            </div>
          </div>

          {/* Important Note */}
          <div
            style={{
              marginTop: "40px",
              padding: "20px",
              backgroundColor: "#fff3cd",
              border: "1px solid #ffeeba",
              borderRadius: "8px",
              color: "#856404",
              display: "flex",
              gap: "15px",
              alignItems: "start",
            }}
          >
            <span style={{ fontSize: "24px" }}>⚠️</span>
            <div>
              <strong style={{ display: "block", marginBottom: "5px" }}>
                Notes
              </strong>
              <p style={{ whiteSpace: "pre-line" }}>
                1. The main branch cannot be edited{"\n"}
                2. All branches must contain exactly:
                <ul style={{ margin: "5px 0 0 20px" }}>
                  <li>1 Dataset Node</li>
                  <li>1 Model Node</li>
                  <li>1 Output Node</li>
                </ul>
                3. No branches can be made for domain specific pipeline.
              </p>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Styles object to keep the JSX cleaner
const styles = {
  stepContainer: {
    display: "flex",
    flexWrap: "wrap", // Allows stacking on very small screens
    gap: "30px",
    alignItems: "center",
    marginBottom: "20px",
  },
  textColumn: {
    flex: "1 1 300px", // Grows and shrinks, min-width 300px
  },
  imageColumn: {
    flex: "1 1 300px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "auto",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    border: "1px solid #eee",
    objectFit: "cover",
  },
  stepTitle: {
    color: "#007bff",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: 0,
  },
  stepNumber: {
    background: "#007bff",
    color: "white",
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "16px",
    fontWeight: "bold",
  },
  infoTag: {
    marginTop: "10px",
    fontSize: "14px",
    color: "#555",
    background: "#f8f9fa",
    padding: "8px 12px",
    borderRadius: "6px",
    display: "inline-block",
  },
  subBox: {
    marginTop: "15px",
    padding: "15px",
    backgroundColor: "#f0f7ff",
    borderRadius: "8px",
    fontSize: "14px",
    borderLeft: "4px solid #007bff",
  },
  divider: {
    border: "none",
    borderTop: "1px dashed #ddd",
    margin: "30px 0",
  },
};

export default InstructionOverlay;