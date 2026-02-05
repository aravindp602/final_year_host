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
  flexDirection: "row", // [FIX] Changed from 'column' to 'row'
  gap: "10px",          // Added gap for horizontal spacing
  alignItems: "center"
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
  fontSize: "13px",
  whiteSpace: "nowrap" // Prevents text wrapping in a single line
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
  const initializedRef = useRef(false);

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
    if (file && !initializedRef.current) {
       const datasetNode = {
          id: DATASET_NODE_ID,
          type: "datasetNode",
          position: { x: 0, y: 100 },
          data: { label: `Dataset: ${file.name}`, file: file, isLocked: true },
          draggable: false,
       };
       setNodes([datasetNode]);
       initializedRef.current = true;
       
       setTimeout(() => {
         if (fitView) fitView();
       }, 100);
    }
  }, [file, fitView]); 

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

      const traverse = (nodeId, isMain) => {
        const children = parentToChildren[nodeId] || [];
        if (!children.length) return;

        if (isMain) {
          children.forEach((childId) => {
            const child = nodeMap.get(childId);
            if (child?.data?.isLocked) traverse(childId, true);
            else {
              newBranchHeads.add(childId);
              traverse(childId, false);
            }
          });
        } else {
          if (children.length === 1) {
            traverse(children[0], false);
          } else {
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

      setBranchMap((prev) => {
        const next = new Map(prev);
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

      const labels = [];
      const currentMap = branchMapRef.current;

      const mainHead = parentToChildren[DATASET_NODE_ID]?.find(
        (id) => nodeMap.get(id)?.data?.isLocked
      );
      if (mainHead) {
        labels.push(createLabelNode(nodeMap.get(mainHead), "MAIN BRANCH", true));
      }

      currentMap.forEach((num, headId) => {
        if (nodeMap.has(headId)) {
          labels.push(
            createLabelNode(nodeMap.get(headId), `BRANCH ${num}`, false)
          );
        }
      });

      continuationHeads.forEach((nodeId) => {
        let curr = childToParent(nodeId, edges);
        let foundNum = null;
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

      const nonLabels = currentNodes.filter((n) => n.type !== "branchLabel");
      return [...nonLabels, ...labels];
    });
  }, [edges, mainBranchReady, childToParent, createLabelNode]);

  /* ---------------- HANDLERS ---------------- */

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds);
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
    initializedRef.current = false; 
  }, [nodes]);

  /* ---------------- CUSTOM HOOKS ---------------- */

  useGraphEvents({
    setNodes,
    setEdges,
    setLocalFile,
    setResults,
    setError,
    fitView,
    setMainBranchReady,
  });

  const { onDrop, onDragOver, onConnect } = useGraphInteractions({
    file: localFile || file, 
    nodes,
    edges,
    project,
    setNodes,
    setEdges,
    setError,
    mainBranchReady,
  });

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

      {/* ACTION BUTTONS: Now in a ROW */}
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