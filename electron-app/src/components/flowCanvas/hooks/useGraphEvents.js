import { useEffect, useCallback } from 'react';

const DATASET_NODE_ID = "dataset-node";

// Increase this factor to add more space between backend nodes
const SPACING_FACTOR = 1.4; 

const createOnDelete = (setNodes, setEdges) => (nodeId) => {
  setNodes((nds) => nds.filter((n) => n.id !== nodeId));
  setEdges((eds) =>
    eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
  );
};

export const useGraphEvents = ({ 
    setNodes, setEdges, setLocalFile, setResults, setError, fitView, setMainBranchReady 
}) => {

  const addOrUpdateDatasetNode = useCallback((uploadedFile) => {
    setLocalFile(uploadedFile); 
    setResults(null);
    setError(null); 
    setMainBranchReady(false); 
    
    const datasetNode = {
      id: DATASET_NODE_ID,
      type: "datasetNode",
      // --- FIX 1: Move Dataset Node LEFT to create initial gap ---
      position: { x: -150, y: 100 }, 
      data: { label: `Dataset: ${uploadedFile.name}`, file: uploadedFile, isLocked: true },
      draggable: false,
    };

    setNodes([datasetNode]);
    setEdges([]);

    setTimeout(() => fitView(), 300);
  }, [fitView, setLocalFile, setResults, setError, setNodes, setEdges, setMainBranchReady]);

  useEffect(() => {
    const handler = (ev) => addOrUpdateDatasetNode(ev.detail);
    window.addEventListener("dataset-selected", handler);
    return () => window.removeEventListener("dataset-selected", handler);
  }, [addOrUpdateDatasetNode]);

  useEffect(() => {
    const handleNormalRun = (event) => {
      console.log("📊 [FlowCanvas] Main Branch Received!", event.detail);
      
      const { outputs, graph, trainingResults, isCustom } = event.detail; 

      const mainBranchColor = isCustom ? "#b730cfff" : "#e87e0eff"; 

      if (outputs) {
        setResults((prev) => ({
            ...prev,
            "main": { outputs, trainingResults }
        }));
      }
      
      if (graph && graph.nodes && graph.edges) {
        const mainNodes = graph.nodes
        .filter(n => n.id !== DATASET_NODE_ID)
        .map((n) => {
            let nodeType = n.type;

            // Detect Node Type (Normal vs Domain)
            if (nodeType === 'preprocessingNode' || nodeType === 'preprocessing') {
                const baseId = n.data?.baseId || "";
                if (baseId.toLowerCase().startsWith('dp')) {
                    nodeType = 'domain'; 
                } else {
                    nodeType = 'normal'; 
                }
            }
            else if (nodeType === 'modelNode') nodeType = 'model';
            else if (nodeType === 'outputNode') nodeType = 'output';
            
            return {
              ...n,
              type: nodeType, 
              draggable: false, 
              connectable: true,
              // --- FIX 2: Spread out the nodes using Scale Factor ---
              position: { 
                  x: n.position.x * SPACING_FACTOR, 
                  y: n.position.y 
              },
              data: {
                ...n.data,
                label: n.label || n.data.label, 
                isLocked: true, 
                color: mainBranchColor, 
                onDelete: undefined 
              },
            };
        });
        
        setNodes((prev) => {
            const dataset = prev.find(n => n.id === DATASET_NODE_ID);
            return dataset ? [dataset, ...mainNodes] : mainNodes;
        });
        setEdges(graph.edges);
        
        setMainBranchReady(true); 
        setTimeout(() => fitView(), 100);
      }
    };
    
    window.addEventListener("normal-run-complete", handleNormalRun);
    return () => window.removeEventListener("normal-run-complete", handleNormalRun);
  }, [fitView, setNodes, setEdges, setResults, setMainBranchReady]);
};