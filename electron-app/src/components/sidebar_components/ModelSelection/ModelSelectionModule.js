import React from "react";

const ModelSelectionModule = ({ model }) => {
  const handleDragStart = (e) => {
    const nodeData = {
      id: model.id,
      type: model.type,
      label: model.label,
      color: "#ADE498", // Pass the color so the node knows how to render itself
    };

    e.dataTransfer.setData("application/reactflow", JSON.stringify(nodeData));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{
        // --- LAYOUT & ALIGNMENT ---
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        minHeight: "50px",
        lineHeight: "1.3",
        wordBreak: "break-word",

        // --- VISUAL STYLING ---
        padding: "3px",
        borderRadius: "6px",
        backgroundColor: "#ADE498", // Keep the Green color for Models
        color: "#0f0101ff",
        border: "none",
        boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
        cursor: "grab",
        fontSize: "13px",
        fontWeight: "450",
        userSelect: "none",
        transition: "transform 0.1s ease, box-shadow 0.2s ease",
      }}
      // --- HOVER EFFECTS ---
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.15)";
      }}
    >
      {model.label}
    </div>
  );
};

export default ModelSelectionModule;