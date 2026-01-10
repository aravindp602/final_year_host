import React from "react";
import { Handle, Position } from "reactflow";
import outputlIcon from "./icons/output.png"; // place icon in same folder

const nodeStyle = {
  border: "1px solid #4DA6FF",
  padding: 10,
  borderRadius: 12,
  background: "#e5db15ff", // light blue/green
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  fontSize: 14,
  minWidth: 180,
  minHeight: 60,
  textAlign: "center",
  position: "relative",
};

const OutputNode = ({ data }) => {
  return (
    <div
      style={{
        ...nodeStyle,
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
        src={outputlIcon}
        width={28}
        alt="model"
        style={{ marginBottom: 4 }}
      />

      {/* HANDLES */}
      
      {/* Target Handle (Left) - Allows inputs INTO this node */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#4DA6FF", width: 12, height: 12, borderRadius: "50%" }}
      />

      {/* REMOVED: Source Handle (Right) - This prevents outputs FROM this node */}

      <strong>{data.label}</strong>
    </div>
  );
};

export default OutputNode;