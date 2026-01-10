import React from "react";

const PreprocessingModule = ({ module, color, type }) => {
  const handleDragStart = (e) => {
    const nodeData = {
      id: module.id,
      type: type || module.type, 
      label: module.label || module.name,
      color: color, 
    };
    
    console.log("🚀 [Sidebar] Drag Start:", nodeData);
    
    e.dataTransfer.setData("application/reactflow", JSON.stringify(nodeData));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{
        display: "flex",             // Enables flexbox
        justifyContent: "center",    // Centers horizontally
        alignItems: "center",        // Centers vertically
        textAlign: "center",         // Centers multi-line text
        minHeight: "50px",           // Ensures uniform height in the grid
        lineHeight: "1.3",           // Better spacing for two-line labels
        wordBreak: "break-word",     // Prevents text overflow
        
        // --- VISUAL STYLES ---
        padding: "3px",
        borderRadius: "6px",
        backgroundColor: color || "#ccc", 
        color: "#0f0101ff", 
        border: "none", 
        boxShadow: "0 2px 4px rgba(0,0,0,0.15)", 
        cursor: "grab",
        fontSize: "13px",
        fontWeight: "450",   
        userSelect: "none",
        transition: "transform 0.1s ease, box-shadow 0.2s ease", 
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.15)";
      }}
    >
      {module.label || module.name}
    </div>
  );
};

export default PreprocessingModule;