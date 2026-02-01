import { useEffect, useCallback } from 'react';

const DATASET_NODE_ID = "dataset-node";

// Spacing factor to spread out the auto-generated nodes
const SPACING_FACTOR = 1.4; 

export const useGraphEvents = ({ 
  setNodes,
  setEdges,
  setLocalFile,
  setResults,
  setError,
  fitView,
  setMainBranchReady 
}) => {

  // --- 1. HANDLE DATASET UPLOAD ---
  const addOrUpdateDatasetNode = useCallback((uploadedFile) => {
    console.log("📂 [FlowCanvas] Dataset Selected:", uploadedFile.name);
    setLocalFile(uploadedFile); 
    setResults(null);
    setError(null); 
    setMainBranchReady(false); 
    
    const datasetNode = {
      id: DATASET_NODE_ID,
      type: "datasetNode",
      position: { x: 0, y: 100 },  // Reset to 0,0 for cleaner alignment
      data: {
        label: `Dataset: ${uploadedFile.name}`,
        file: uploadedFile,
        isLocked: true
      },
      draggable: false,
    };

    setNodes([datasetNode]);
    setEdges([]);

    setTimeout(() => fitView(), 200);
  }, [fitView, setLocalFile, setResults, setError, setNodes, setEdges, setMainBranchReady]);

  // --- 2. LISTEN FOR EVENTS ---
  useEffect(() => {
    const handler = (ev) => addOrUpdateDatasetNode(ev.detail);
    window.addEventListener("dataset-selected", handler);
    return () => window.removeEventListener("dataset-selected", handler);
  }, [addOrUpdateDatasetNode]);

  // --- 3. HANDLE PIPELINE COMPLETION ---
  useEffect(() => {
    const handleNormalRun = (event) => {
      console.group("📊 [FlowCanvas] Pipeline Execution Completed");
      console.log("Raw Event Data:", event.detail);
      
      const { outputs, graph, trainingResults, isCustom } = event.detail; 
      
      // Determine Branch Color (Purple for Domain, Orange for Normal)
      const mainBranchColor = isCustom ? "#b730cfff" : "#e87e0eff"; 

      // Update Results Panel Data
      if (outputs) {
        setResults(prev => ({
          ...prev,
          main: { outputs, trainingResults }
        }));
      }
      
      // Update Graph Nodes
      if (graph && graph.nodes && graph.edges) {
        console.log(`Processing ${graph.nodes.length} nodes from backend...`);

        // Filter out the backend's dataset node (we keep our local one)
        const newNodes = graph.nodes
          .filter(n => n.id !== DATASET_NODE_ID)
          .map(n => {
            let nodeType = n.type; // Default

            // Map Backend Types to React Flow Types
            if (n.type === 'domain') {
              nodeType = 'domain';
            } else if (nodeType === 'preprocessingNode' || nodeType === 'preprocessing') {
              // Check ID to decide color/type (dp = domain, p = normal)
              const baseId = n.data?.baseId || "";
              nodeType = baseId.toLowerCase().startsWith('dp') ? 'domain' : 'normal';
            } else if (nodeType === 'modelNode') {
              nodeType = 'model';
            } else if (nodeType === 'outputNode') {
              nodeType = 'output';
            }
            
            return {
              ...n,
              type: nodeType,
              draggable: false,
              connectable: true,
              position: { 
                x: n.position.x * SPACING_FACTOR, 
                y: n.position.y 
              },
              data: {
                ...n.data,
                label: n.label || n.data?.label,
                isLocked: true,
                color: n.data?.color || mainBranchColor, // Prefer backend color
                onDelete: undefined // Locked nodes can't be deleted
              },
            };
          });
        
        setNodes(prev => {
          // Robustly find or recreate the dataset node
          let dataset = prev.find(n => n.id === DATASET_NODE_ID);
          
          if (!dataset) {
            // Fallback if dataset node was somehow lost
            console.warn("⚠️ Dataset node missing in prev state, recreating placeholder.");
            dataset = {
              id: DATASET_NODE_ID,
              type: "datasetNode",
              position: { x: 0, y: 100 },
              data: { label: "Dataset (Reloaded)", isLocked: true },
              draggable: false
            };
          }

          // Combine Dataset Node + New Pipeline Nodes
          return [dataset, ...newNodes];
        });

        setEdges(graph.edges);
        setMainBranchReady(true);
        
        console.log("✅ Graph Updated. Nodes:", newNodes.length + 1);
        setTimeout(() => fitView({ padding: 0.2 }), 150); // Add padding to fitView
      } else {
        console.error("❌ No graph data found in response!");
      }
      console.groupEnd();
    };
    
    window.addEventListener("normal-run-complete", handleNormalRun);
    return () => window.removeEventListener("normal-run-complete", handleNormalRun);
  }, [fitView, setNodes, setEdges, setResults, setMainBranchReady]);
};