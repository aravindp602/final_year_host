import React from "react";
import { Handle, Position } from "reactflow";

// IMPORT THE IMAGE
import datasetIcon from "./icons/dataset.png";

const DatasetNode = ({ data }) => {
  return (
    <div
      style={{
        padding: 12,
        width: 180,
        borderRadius: 8,
        border: "2px solid #007bff",
        background: "#e7f1ff",
        textAlign: "center",
        position: "relative",
        fontWeight: "bold",
      }}
    >
      {/* Custom Icon */}
      <img
        src={datasetIcon}
        alt="dataset"
        width={32}
        style={{ marginBottom: 6 }}
      />

      <div>Dataset</div>

      {/* OUTPUT ONLY — NO INPUT */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ background: "#007bff", width: 10, height: 10 }}
      />
    </div>
  );
};

export default DatasetNode;
