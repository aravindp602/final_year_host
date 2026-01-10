import React from "react";
import ModelSelectionModule from "./ModelSelectionModule";

const ModelSelectionOptions = ({ models }) => {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <h4 style={{ marginBottom: "10px" }}>Model Selection</h4>

      {/* Grid Container */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr", // Two equal columns
          gap: "10px",
          minHeight: "50px",
        }}
      >
        {models.length > 0 ? (
          models.map((model) => (
            <ModelSelectionModule key={model.id} model={model} />
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
            Loading models...
          </p>
        )}
      </div>
    </div>
  );
};

export default ModelSelectionOptions;