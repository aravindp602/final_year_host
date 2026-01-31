import React, { useState, useEffect, useCallback, useMemo } from "react";
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

const FlowCanvasInner = ({ file, domain, setGlobalLoading }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [localFile, setLocalFile] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [mainBranchReady, setMainBranchReady] = useState(false);

  const [branchMap, setBranchMap] = useState(new Map());

  const { fitView, project } = useReactFlow();

  const nodeTypes = useMemo(() => nodeTypesRaw, []);

  useEffect(() => {
    if (results) setIsResultsOpen(true);
  }, [results]);

  /* ---------------- Helpers ---------------- */

  const childToParent = useCallback((childId, edgeList) => {
    const edge = edgeList.find(e => e.target === childId);
    return edge ? edge.source : null;
  }, []);

  const createLabelNode = useCallback((headNode, text, isMain) => ({
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
  }), []);

  /* ---------------- Branch Label Logic ---------------- */

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!mainBranchReady) return;

    setNodes(currentNodes => {
      const nodeMap = new Map(currentNodes.map(n => [n.id, n]));

      const parentToChildren = {};
      edges.forEach(e => {
        if (!parentToChildren[e.source]) parentToChildren[e.source] = [];
        parentToChildren[e.source].push(e.target);
      });

      const newBranchHeads = new Set();
      const continuationHeads = new Set();

      const traverse = (nodeId, isMain, currentBranchId) => {
        const children = parentToChildren[nodeId] || [];
        if (!children.length) return;

        if (isMain) {
          children.forEach(childId => {
            const child = nodeMap.get(childId);
            if (child?.data?.isLocked) {
              traverse(childId, true, null);
            } else {
              newBranchHeads.add(childId);
              traverse(childId, false, childId);
            }
          });
        } else {
          if (children.length === 1) {
            traverse(children[0], false, currentBranchId);
          } else {
            continuationHeads.add(children[0]);
            traverse(children[0], false, currentBranchId);

            children.slice(1).forEach(childId => {
              newBranchHeads.add(childId);
              traverse(childId, false, childId);
            });
          }
        }
      };

      if (nodeMap.has(DATASET_NODE_ID)) {
        traverse(DATASET_NODE_ID, true, null);
      }

      setBranchMap(prev => {
        const next = new Map(prev);

        for (const [id] of next) {
          if (!nodeMap.has(id)) next.delete(id);
        }

        const used = new Set(next.values());

        newBranchHeads.forEach(id => {
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

      const mainHead = parentToChildren[DATASET_NODE_ID]?.find(
        id => nodeMap.get(id)?.data?.isLocked
      );

      if (mainHead && nodeMap.has(mainHead)) {
        labels.push(createLabelNode(nodeMap.get(mainHead), "MAIN BRANCH", true));
      }

      branchMap.forEach((num, headId) => {
        if (nodeMap.has(headId)) {
          labels.push(createLabelNode(nodeMap.get(headId), `BRANCH ${num}`, false));
        }
      });

      continuationHeads.forEach(nodeId => {
        let curr = childToParent(nodeId, edges);
        let foundNum = null;

        while (curr && !foundNum) {
          if (branchMap.has(curr)) foundNum = branchMap.get(curr);
          curr = childToParent(curr, edges);
          if (curr === DATASET_NODE_ID) break;
        }

        if (foundNum && nodeMap.has(nodeId)) {
          if (!labels.find(l => l.id === `label_${nodeId}`)) {
            labels.push(
              createLabelNode(nodeMap.get(nodeId), `BRANCH ${foundNum}`, false)
            );
          }
        }
      });

      const nonLabelNodes = currentNodes.filter(n => n.type !== "branchLabel");
      return [...nonLabelNodes, ...labels];
    });
  }, [edges, mainBranchReady, childToParent, createLabelNode]);

  /* ---------------- Handlers ---------------- */

  const onNodesChange = useCallback((changes) => {
    setNodes(nds => {
      const updated = applyNodeChanges(changes, nds);
      const moved = new Set(
        changes.filter(c => c.type === "position" && c.dragging).map(c => c.id)
      );

      if (!moved.size) return updated;

      return updated.map(node => {
        if (node.type === "branchLabel") {
          const headId = node.id.replace("label_", "");
          if (moved.has(headId)) {
            const head = updated.find(n => n.id === headId);
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
    changes => setEdges(eds => applyEdgeChanges(changes, eds)),
    []
  );

  const handleClearCanvas = useCallback(() => {
    const datasetNode = nodes.find(n => n.id === DATASET_NODE_ID);
    setBranchMap(new Map());
    setNodes(datasetNode ? [datasetNode] : []);
    setEdges([]);
    setResults(null);
    setIsResultsOpen(false);
    setMainBranchReady(false);
  }, [nodes]);

  /* ---------------- Hooks ---------------- */

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
    file,
    domain,
    nodes,
    edges,
    project,
    setNodes,
    setEdges,
    setError,
    mainBranchReady,
  });

  const { handleRunConfig } = usePipelineRunner({
    localFile,
    nodes,
    edges,
    setResults,
    setError,
    setLoading: setGlobalLoading,
    onValidate: () => validatePipeline(nodes, edges),
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
      {error && <ErrorPopup message={error} onClose={() => setError(null)} />}

      <div style={{ flex: 1 }} onDrop={onDrop} onDragOver={onDragOver}>
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
          <ResultsPanel data={results} onClose={() => setIsResultsOpen(false)} />
        )}
      </div>
    </div>
  );
};

export default FlowCanvasInner;
