import React from "react";
import { Handle, Position } from "reactflow";
import preprocessIcon from "./icons/preprocess.png"; 

const nodeStyle = {
  border: "1px solid #FEBF63", // You might want to make this dynamic too if needed
  padding: 10,
  borderRadius: 12,
  // REMOVE FIXED BACKGROUND HERE
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  fontSize: 14,
  minWidth: 180,
  minHeight: 60,
  textAlign: "center",
  position: "relative",
};

const NormalPreprocessingNode = ({ data }) => {
  // Use the color passed from Sidebar, or fallback to Orange
  const dynamicColor = data.color || "#f8850bff";

  return (
    <div
      style={{
        ...nodeStyle,
        background: dynamicColor, // <--- APPLY DYNAMIC COLOR
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
        alt="preprocess"
        style={{ marginBottom: 4 }}
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
    </div>
  );
};

export default NormalPreprocessingNode;