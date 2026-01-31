import React from "react";
import { ReactFlowProvider } from "reactflow";
import FlowCanvasInner from "./FlowCanvasInner";

// 1. Accept 'setGlobalLoading' here
const FlowCanvas = ({ style, file, domain, setGlobalLoading }) => (
  <div style={style}>
    <ReactFlowProvider>
      {/* 2. Pass it down here */}
      <FlowCanvasInner 
        file={file} 
        domain={domain} 
        setGlobalLoading={setGlobalLoading} 
      />
    </ReactFlowProvider>
  </div>
);

export default FlowCanvas;