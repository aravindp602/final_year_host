import React, { useState } from "react";
import PreprocessingModule from "../PreprocessingOptions/PreprocessingModule";

const PreprocessingOptions = ({
  NormalprocessingModules,
  DomainprocessingModules,
  domain,
}) => {
  const [activeTab, setActiveTab] = useState("normal");
  const NORMAL_COLOR = "#e87e0eff";
  const DOMAIN_COLOR = "#b730cfff";

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <h4 style={{ marginBottom: "10px" }}>Drag-and-Drop Modules</h4>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          backgroundColor: "#f1f3f5",
          borderRadius: "6px",
          padding: "4px",
          marginBottom: "15px",
        }}
      >
        <div
          onClick={() => setActiveTab("normal")}
          style={{
            flex: 1,
            textAlign: "center",
            padding: "6px 0",
            fontSize: "13px",
            fontWeight: activeTab === "normal" ? "600" : "400",
            borderRadius: "5px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            backgroundColor: activeTab === "normal" ? "#fff" : "transparent",
            color: activeTab === "normal" ? NORMAL_COLOR : "#777",
            boxShadow:
              activeTab === "normal" ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
            border:
              activeTab === "normal"
                ? `1px solid ${NORMAL_COLOR}20`
                : "1px solid transparent",
          }}
        >
          Normal
        </div>

        <div
          onClick={() => setActiveTab("domain")}
          style={{
            flex: 1,
            textAlign: "center",
            padding: "6px 0",
            fontSize: "13px",
            fontWeight: activeTab === "domain" ? "600" : "400",
            borderRadius: "5px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            backgroundColor: activeTab === "domain" ? "#fff" : "transparent",
            color: activeTab === "domain" ? DOMAIN_COLOR : "#777",
            boxShadow:
              activeTab === "domain" ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
            border:
              activeTab === "domain"
                ? `1px solid ${DOMAIN_COLOR}20`
                : "1px solid transparent",
          }}
        >
          Domain Based
        </div>
      </div>

      {/* Module List Content - Updated to Grid Layout */}
      <div 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr 1fr",
          gap: "10px", 
          minHeight: "50px" 
        }}
      >
        {activeTab === "normal" && (
          <>
            {NormalprocessingModules.length > 0 ? (
              NormalprocessingModules.map((module) => (
                <PreprocessingModule
                  key={module.id}
                  module={module}
                  type="normal"
                  color={NORMAL_COLOR}
                />
              ))
            ) : (
              <p style={{ fontSize: 14, color: "#666", gridColumn: "1 / -1", textAlign: "center" }}>
                Loading normal modules...
              </p>
            )}
          </>
        )}
        {activeTab === "domain" && (
          <>
            {domain ? (
              DomainprocessingModules.length > 0 ? (
                DomainprocessingModules.map((module) => (
                  <PreprocessingModule
                    key={module.id}
                    module={module}
                    type="domain"
                    color={DOMAIN_COLOR}
                  />
                ))
              ) : (
                <p style={{ fontSize: 14, color: "#666", gridColumn: "1 / -1", textAlign: "center" }}>
                  Fetching modules for {domain}...
                </p>
              )
            ) : (
              <div
                style={{
                  gridColumn: "1 / -1", // Span across both columns
                  textAlign: "center",
                  padding: "20px 0",
                  color: "#888",
                  fontSize: "13px",
                  fontStyle: "italic",
                }}
              >
                No domain detected yet. <br /> Upload a file to unlock domain
                modules.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PreprocessingOptions;