import React from "react";
import OutputOptionModule from "./OutputOptionModule";

const OutputOptions = ({ outputModules }) => {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        marginBottom: 90, // Keep the bottom margin here
      }}
    >
      <h4 style={{ marginBottom: "10px" }}>Output Options</h4>

      {/* Grid Container */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr", // Two equal columns
          gap: "10px",
          minHeight: "50px",
        }}
      >
        {outputModules.length > 0 ? (
          outputModules.map((module) => (
            <OutputOptionModule key={module.id} output={module} />
          ))
        ) : (
          <p
            style={{
              fontSize: 14,
              color: "#666",
              gridColumn: "1 / -1",
              textAlign: "center",
            }}
          >
            Loading output options...
          </p>
        )}
      </div>
    </div>
  );
};

export default OutputOptions;