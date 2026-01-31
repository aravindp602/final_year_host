import { useCallback } from 'react';
import { addEdge } from 'reactflow';
import { validateConnection } from "../graphValidation";

export const useGraphInteractions = ({ 
  file,
  nodes,
  edges,
  project,
  setNodes,
  setEdges,
  setError,
  mainBranchReady
}) => {

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      if (!file) {
        setError("Please upload a dataset first.");
        return;
      }
      
      // --- LOCK CHECK ---
      if (!mainBranchReady) {
        setError("⚠️ Main Branch not found! Please run Normal/Domain preprocessing first.");
        return;
      }

      const container = document.querySelector(".react-flow__renderer")?.parentElement;
      if (!container) return;

      const bounds = container.getBoundingClientRect();
      const raw = event.dataTransfer.getData("application/reactflow");
      if (!raw) return;
      
      const dragged = JSON.parse(raw);
      const position = project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const nodeType =
        dragged.type === "model" ? "modelNode"
        : dragged.type === "preprocessing" ? "preprocessingNode"
        : dragged.type === "output" ? "outputNode"
        : dragged.type;

      const newNodeId = `${dragged.id}_${Date.now()}`;
      
      const newNode = {
        id: newNodeId,
        type: nodeType,
        position,
        data: {
          label: dragged.label,
          baseId: dragged.id,
          color: dragged.color,
          onDelete: () => {
            setNodes(nds => nds.filter(n => n.id !== newNodeId));
            setEdges(eds =>
              eds.filter(e => e.source !== newNodeId && e.target !== newNodeId)
            );
          },
        },
      };

      setNodes(nds => [...nds, newNode]);
    },
    [project, file, setNodes, setEdges, setError, mainBranchReady]
  );

  const onDragOver = useCallback(
    (e) => e.preventDefault(),
    []
  );

  const onConnect = useCallback(
    (params) => {
      const errorMessage = validateConnection(nodes, edges, params);
      if (errorMessage) {
        setError(errorMessage);
        return;
      }

      setEdges(eds =>
        addEdge(
          { 
            ...params,
            animated: true,
            markerEnd: { type: "arrowclosed" },
            style: { stroke: "#000", strokeWidth: 3 }
          },
          eds
        )
      );
    },
    [edges, nodes, setEdges, setError]
  );
  
  return { onDrop, onDragOver, onConnect };
};
