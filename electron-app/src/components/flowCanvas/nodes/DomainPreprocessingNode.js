import React, { memo } from "react";
import { Handle, Position } from "reactflow";
// You can use a specific icon for domain if you have one, otherwise reuse preprocess
import preprocessIcon from "./icons/preprocess.png"; 

const nodeStyle = {
  border: "1px solid #9C27B0", // Purple border
  padding: 10,
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  fontSize: 14,
  minWidth: 180,
  minHeight: 60,
  textAlign: "center",
  position: "relative",
};

const DomainPreprocessingNode = ({ data }) => {
  // Default to Purple if no color is passed
  const dynamicColor = data.color || "#b730cfff";

  return (
    <div
      style={{
        ...nodeStyle,
        background: dynamicColor,
        borderRadius: 16,
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center", 
      }}
    >
      {/* DELETE BUTTON */}
      <button
        onClick={data.onDelete}
        style={{
          position: "absolute",
          top: -10,
          right: -10,
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: "none",
          background: "#e74c3c",
          color: "#fff",
          cursor: "pointer",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        x
      </button>

      {/* ICON */}
      <img
        src={preprocessIcon}
        width={28}
        alt="domain-preprocess"
        style={{ marginBottom: 4 }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />

      {/* HANDLES */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#4DA6FF", width: 12, height: 12, borderRadius: "50%" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "#4DA6FF", width: 12, height: 12, borderRadius: "50%" }}
      />

      <strong>{data.label}</strong>
      {/* Optional: Add a small badge to indicate it is Domain based */}
      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>Domain Specific</div>
    </div>
  );
};

export default memo(DomainPreprocessingNode);