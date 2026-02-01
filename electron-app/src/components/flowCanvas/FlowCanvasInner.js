import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

import nodeTypesRaw from "./nodeTypes";
import { ResultsPanel } from "./ResultsPanel";
import ErrorPopup from "../ErrorPopup";

import { useGraphEvents } from "./hooks/useGraphEvents";
import { useGraphInteractions } from "./hooks/useGraphInteractions";
import { usePipelineRunner } from "./hooks/usePipelineRunner";
import { validatePipeline } from "./graphValidation";

const DATASET_NODE_ID = "dataset-node";

// --- STYLES ---
const actionContainerStyle = {
  position: "absolute",
  top: 10,
  right: 10,
  zIndex: 20,
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  alignItems: "flex-end"
};

const btnStyle = (bg) => ({
  padding: "8px 16px",
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
  fontWeight: "bold",
  fontSize: "13px"
});

const FlowCanvasInner = ({ file, domain, setGlobalLoading }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [localFile, setLocalFile] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [mainBranchReady, setMainBranchReady] = useState(false);

  // Branch Labeling State
  const [branchMap, setBranchMap] = useState(new Map());
  const branchMapRef = useRef(branchMap);

  // React Flow Hooks
  const { fitView, project } = useReactFlow();
  const nodeTypes = useMemo(() => nodeTypesRaw, []);

  // --- Keep Ref Sync ---
  useEffect(() => {
    branchMapRef.current = branchMap;
  }, [branchMap]);

  // --- Auto-Open Results ---
  useEffect(() => {
    if (results) setIsResultsOpen(true);
  }, [results]);

  // --- Initialize Dataset Node if file exists on mount ---
  useEffect(() => {
    if (file && nodes.length === 0) {
       // This handles the case where file prop is passed but event missed
       const datasetNode = {
          id: DATASET_NODE_ID,
          type: "datasetNode",
          position: { x: 0, y: 100 },
          data: { label: `Dataset: ${file.name}`, file: file, isLocked: true },
          draggable: false,
       };
       setNodes([datasetNode]);
       setTimeout(() => fitView && fitView(), 100);
    }
  }, [file, fitView]); // Removed nodes.length dependency to avoid loop, handled by check

  /* ---------------- HELPERS ---------------- */

  const childToParent = useCallback((childId, edgeList) => {
    const edge = edgeList.find((e) => e.target === childId);
    return edge ? edge.source : null;
  }, []);

  const createLabelNode = useCallback(
    (headNode, text, isMain) => ({
      id: `label_${headNode.id}`,
      type: "branchLabel",
      position: { x: headNode.position.x, y: headNode.position.y - 40 },
      data: { label: text },
      draggable: false,
      zIndex: 1001,
      style: {
        pointerEvents: "none",
        width: 200,
        textAlign: "center",
        fontSize: "12px",
        fontWeight: "bold",
        color: isMain ? "#888" : "#666",
      },
    }),
    []
  );

  /* ---------------- BRANCH LABEL LOGIC ---------------- */
  useEffect(() => {
    if (!mainBranchReady) return;

    setNodes((currentNodes) => {
      const nodeMap = new Map(currentNodes.map((n) => [n.id, n]));
      const parentToChildren = {};

      edges.forEach((e) => {
        if (!parentToChildren[e.source]) parentToChildren[e.source] = [];
        parentToChildren[e.source].push(e.target);
      });

      const newBranchHeads = new Set();
      const continuationHeads = new Set();

      // Recursive traversal to identify branches
      const traverse = (nodeId, isMain) => {
        const children = parentToChildren[nodeId] || [];
        if (!children.length) return;

        if (isMain) {
          children.forEach((childId) => {
            const child = nodeMap.get(childId);
            // If child is locked, it's still main branch
            if (child?.data?.isLocked) traverse(childId, true);
            else {
              // Deviation -> New Custom Branch
              newBranchHeads.add(childId);
              traverse(childId, false);
            }
          });
        } else {
          // Custom Branch Logic
          if (children.length === 1) {
            traverse(children[0], false);
          } else {
            // Split
            continuationHeads.add(children[0]);
            traverse(children[0], false);
            children.slice(1).forEach((id) => {
              newBranchHeads.add(id);
              traverse(id, false);
            });
          }
        }
      };

      if (nodeMap.has(DATASET_NODE_ID)) traverse(DATASET_NODE_ID, true);

      // Update Branch Map
      setBranchMap((prev) => {
        const next = new Map(prev);
        // Cleanup deleted
        for (const [id] of next) if (!nodeMap.has(id)) next.delete(id);

        const used = new Set(next.values());
        newBranchHeads.forEach((id) => {
          if (!next.has(id)) {
            let num = 1;
            while (used.has(num)) num++;
            next.set(id, num);
            used.add(num);
          }
        });
        return next;
      });

      // Generate Label Nodes
      const labels = [];
      const currentMap = branchMapRef.current;

      // 1. Main Branch Label
      const mainHead = parentToChildren[DATASET_NODE_ID]?.find(
        (id) => nodeMap.get(id)?.data?.isLocked
      );
      if (mainHead) {
        labels.push(createLabelNode(nodeMap.get(mainHead), "MAIN BRANCH", true));
      }

      // 2. Custom Branch Labels
      currentMap.forEach((num, headId) => {
        if (nodeMap.has(headId)) {
          labels.push(
            createLabelNode(nodeMap.get(headId), `BRANCH ${num}`, false)
          );
        }
      });

      // 3. Continuation Labels
      continuationHeads.forEach((nodeId) => {
        let curr = childToParent(nodeId, edges);
        let foundNum = null;
        // Backtrack to find parent branch number
        while (curr && !foundNum) {
          if (currentMap.has(curr)) foundNum = currentMap.get(curr);
          curr = childToParent(curr, edges);
        }

        if (foundNum && nodeMap.has(nodeId)) {
          labels.push(
            createLabelNode(nodeMap.get(nodeId), `BRANCH ${foundNum}`, false)
          );
        }
      });

      // Filter out old labels and add new ones
      const nonLabels = currentNodes.filter((n) => n.type !== "branchLabel");
      return [...nonLabels, ...labels];
    });
  }, [edges, mainBranchReady, childToParent, createLabelNode]);

  /* ---------------- HANDLERS ---------------- */

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds);
      
      // Update label positions if parent moves
      const moved = new Set(
        changes.filter((c) => c.type === "position" && c.dragging).map((c) => c.id)
      );

      if (!moved.size) return updated;

      return updated.map((node) => {
        if (node.type === "branchLabel") {
          const headId = node.id.replace("label_", "");
          if (moved.has(headId)) {
            const head = updated.find((n) => n.id === headId);
            if (head) {
              return {
                ...node,
                position: { x: head.position.x, y: head.position.y - 40 },
              };
            }
          }
        }
        return node;
      });
    });
  }, []);

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const handleClearCanvas = useCallback(() => {
    const datasetNode = nodes.find((n) => n.id === DATASET_NODE_ID);
    setBranchMap(new Map());
    setNodes(datasetNode ? [datasetNode] : []);
    setEdges([]);
    setResults(null);
    setIsResultsOpen(false);
    setMainBranchReady(false);
  }, [nodes]);

  /* ---------------- CUSTOM HOOKS ---------------- */

  // Handles: Dataset Upload Event, Pipeline Completion Event
  useGraphEvents({
    setNodes,
    setEdges,
    setLocalFile,
    setResults,
    setError,
    fitView,
    setMainBranchReady,
  });

  // Handles: Drag-and-Drop, Connecting Nodes
  const { onDrop, onDragOver, onConnect } = useGraphInteractions({
    file: localFile || file, // Use localFile if event set it, else prop
    nodes,
    edges,
    project,
    setNodes,
    setEdges,
    setError,
    mainBranchReady,
  });

  // Handles: Run Configuration Button
  const { handleRunConfig } = usePipelineRunner({
    localFile: localFile || file,
    nodes,
    edges,
    setResults,
    setError,
    setLoading: setGlobalLoading,
    onValidate: () => validatePipeline(nodes, edges),
  });

  return (
    <div style={{ flex: 1, position: "relative", height: "100%" }}>
      {error && <ErrorPopup message={error} onClose={() => setError(null)} />}

      {/* ACTION BUTTONS */}
      <div style={actionContainerStyle}>
        {results && !isResultsOpen && (
          <button
            onClick={() => setIsResultsOpen(true)}
            style={btnStyle("#17a2b8")}
          >
            View Results 📊
          </button>
        )}

        <button onClick={handleClearCanvas} style={btnStyle("#6c757d")}>
          Clear Canvas
        </button>

        <button onClick={handleRunConfig} style={btnStyle("#e20606ff")}>
          Run Configuration
        </button>
      </div>

      <div style={{ flex: 1, height: "100%" }} onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <MiniMap />
          <Background />
          <Controls />
        </ReactFlow>

        {isResultsOpen && results && (
          <ResultsPanel
            data={results}
            onClose={() => setIsResultsOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default FlowCanvasInner;