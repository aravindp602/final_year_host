import React from "react";

const OutputOptionModule = ({ output }) => {
  const handleDragStart = (e) => {
    const nodeData = {
      id: output.id,
      type: output.type,
      label: output.label,
      name: output.name,
      color: "#e5db15ff", // Pass color for node rendering
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
        padding: "5px",
        borderRadius: "6px",
        backgroundColor: "#e5db15ff", // Yellow for Output
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
      {output.label}
    </div>
  );
};

export default OutputOptionModule;