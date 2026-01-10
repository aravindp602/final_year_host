import React, { useState, useEffect, useCallback } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, applyNodeChanges, applyEdgeChanges, useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

import nodeTypes from "./nodeTypes";
import { ResultsPanel } from "./ResultsPanel";
import ErrorPopup from '../ErrorPopup';

import { useGraphEvents } from "./hooks/useGraphEvents";
import { useGraphInteractions } from "./hooks/useGraphInteractions";
import { usePipelineRunner } from "./hooks/usePipelineRunner";
import { validatePipeline } from './graphValidation';

const DATASET_NODE_ID = "dataset-node";

const FlowCanvasInner = ({ file, domain, setGlobalLoading }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [localFile, setLocalFile] = useState(null);
  const [results, setResults] = useState(null); 
  const [error, setError] = useState(null);
  
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [mainBranchReady, setMainBranchReady] = useState(false);
  
  // Store mapping of HeadNodeID -> BranchNumber
  const [branchMap, setBranchMap] = useState(new Map()); 

  const { fitView, project } = useReactFlow();

  useEffect(() => {
    if (results) setIsResultsOpen(true);
  }, [results]);

  // --- SMART BRANCH LABELING & RECYCLING SYSTEM ---
  useEffect(() => {
    if (!mainBranchReady) return;

    setNodes((currentNodes) => {
        const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
        
        // Build Tree Structure
        const parentToChildren = {};
        edges.forEach(e => {
            if (!parentToChildren[e.source]) parentToChildren[e.source] = [];
            parentToChildren[e.source].push(e.target);
        });

        // 1. Identify which nodes are "Heads" of a branch segment
        const newBranchHeads = new Set();  // Nodes that start a NEW branch number
        const continuationHeads = new Set(); // Nodes that continue an existing custom branch but need a label (split lower path)

        // Helper: Recursive traverse to identify heads
        const traverse = (nodeId, isMainBranch, currentCustomBranchId) => {
            const children = parentToChildren[nodeId] || [];
            
            if (children.length === 0) return;

            // Scenario A: We are on Main Branch
            if (isMainBranch) {
                children.forEach(childId => {
                    const child = nodeMap.get(childId);
                    if (child.data.isLocked) {
                        // Still Main Branch
                        traverse(childId, true, null);
                    } else {
                        // Deviation -> New Custom Branch
                        newBranchHeads.add(childId);
                        traverse(childId, false, childId); // childId becomes the ID for this custom branch
                    }
                });
            } 
            // Scenario B: We are on a Custom Branch
            else {
                if (children.length === 1) {
                    // Straight line -> Continue current branch, no new labels
                    traverse(children[0], false, currentCustomBranchId);
                } else {
                    // SPLIT detected on Custom Branch!
                    // Child 0: Continues the current branch number
                    // Child 1+: Start NEW branches
                    
                    // 1. Continuation (Lower Path) - Request a label here explicitly
                    continuationHeads.add(children[0]); 
                    traverse(children[0], false, currentCustomBranchId);

                    // 2. New Branches (Upper Path / Others)
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

        // 2. Update Branch Number Map (Recycle Numbers)
        setBranchMap(prevMap => {
            const nextMap = new Map(prevMap);
            
            // Clean up deleted nodes
            for (const [id] of nextMap) {
                if (!nodeMap.has(id)) nextMap.delete(id);
            }

            // Get currently used numbers
            const usedNumbers = new Set(nextMap.values());

            // Assign numbers to NEW heads
            newBranchHeads.forEach(headId => {
                if (!nextMap.has(headId)) {
                    // Find lowest available number
                    let num = 1;
                    while (usedNumbers.has(num)) num++;
                    
                    nextMap.set(headId, num);
                    usedNumbers.add(num);
                }
            });

            return nextMap;
        });

        // 3. Generate Label Nodes
        const labels = [];
        const mainHead = parentToChildren[DATASET_NODE_ID]?.find(id => nodeMap.get(id)?.data.isLocked);
        
        // A. Main Branch Label
        if (mainHead && nodeMap.has(mainHead)) {
            labels.push(createLabelNode(nodeMap.get(mainHead), "MAIN BRANCH", true));
        }

        // B. New Branch Labels (from Map)
        branchMap.forEach((num, headId) => {
            if (nodeMap.has(headId)) {
                labels.push(createLabelNode(nodeMap.get(headId), `BRANCH ${num}`, false));
            }
        });

        // C. Continuation Labels (The "Lower Branch" fix)
        // We look up the branch number of the *parent* chain to label this continuation
        // For simplicity in this logic, we know continuationHeads continues the parent's branch.
        // We need to find the branch number associated with the *ancestor* head.
        // However, a simpler visual trick: The user wants to see "Branch X" repeated.
        
        // Note: For perfect consistency, we rely on the visual traverse. 
        // If a node is in `continuationHeads`, it inherits its parent's branch number.
        // We can brute-force find it by checking nearest upstream key in branchMap.
        
        continuationHeads.forEach(nodeId => {
             // Find upstream branch number
             let curr = childToParent(nodeId, edges);
             let foundNum = null;
             while(curr && !foundNum) {
                 if (branchMap.has(curr)) foundNum = branchMap.get(curr);
                 else curr = childToParent(curr, edges);
                 if (curr === DATASET_NODE_ID) break;
             }
             
             if (foundNum && nodeMap.has(nodeId)) {
                 // Prevent duplicate labels if one already exists
                 const existing = labels.find(l => l.id === `label_${nodeId}`);
                 if (!existing) {
                    labels.push(createLabelNode(nodeMap.get(nodeId), `BRANCH ${foundNum}`, false));
                 }
             }
        });

        const nonLabelNodes = currentNodes.filter(n => n.type !== 'branchLabel');
        return [...nonLabelNodes, ...labels];
    });

  }, [edges, mainBranchReady, branchMap.size]); // Trigger on edge changes or branch count changes

  // Helper to find parent (single input assumption checked in validation)
  const childToParent = (childId, edgeList) => {
      const edge = edgeList.find(e => e.target === childId);
      return edge ? edge.source : null;
  };

  const createLabelNode = (headNode, text, isMain) => ({
      id: `label_${headNode.id}`,
      type: 'branchLabel',
      position: { x: headNode.position.x, y: headNode.position.y - 40 }, 
      data: { label: text },
      draggable: false,
      zIndex: 1001, 
      style: { 
          pointerEvents: 'none',
          width: 200,
          textAlign: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          color: isMain ? '#888' : '#666'
      } 
  });

  // --- NODE CHANGE HANDLER (Keep labels attached) ---
  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const updatedNodes = applyNodeChanges(changes, nds);
      const movedNodeIds = new Set(
          changes.filter(c => c.type === 'position' && c.dragging).map(c => c.id)
      );

      if (movedNodeIds.size === 0) return updatedNodes;

      return updatedNodes.map(node => {
          if (node.type === 'branchLabel') {
              const headNodeId = node.id.replace('label_', '');
              if (movedNodeIds.has(headNodeId)) {
                  const headNode = updatedNodes.find(n => n.id === headNodeId);
                  if (headNode) {
                      return {
                          ...node,
                          position: { x: headNode.position.x, y: headNode.position.y - 40 }
                      };
                  }
              }
          }
          return node;
      });
    });
  }, [setNodes]);

  useGraphEvents({ setNodes, setEdges, setLocalFile, setResults, setError, fitView, setMainBranchReady });

  const { onDrop, onDragOver, onConnect } = useGraphInteractions({
    file, domain, nodes, edges, project, setNodes, setEdges, setError, mainBranchReady
  });

  // Pass validation to Pipeline Runner
  const { handleRunConfig } = usePipelineRunner({
    localFile, nodes, edges, setResults, setError, setLoading: setGlobalLoading,
    onValidate: () => validatePipeline(nodes, edges) // <--- HOOK UP VALIDATION HERE
  });

  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [setEdges]);

  const handleClearCanvas = useCallback(() => {
    const datasetNode = nodes.find(n => n.id === DATASET_NODE_ID);
    setBranchMap(new Map()); // Reset branch counters
    setNodes(datasetNode ? [datasetNode] : []);
    setEdges([]);
    setResults(null);
    setIsResultsOpen(false);
    setMainBranchReady(false);
  }, [nodes]);

  return (
    <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
      {error && <ErrorPopup message={error} onClose={() => setError(null)} />}

      <div style={{ flex: 1, position: "relative" }} onDrop={onDrop} onDragOver={onDragOver}>
        
        {results && !isResultsOpen && (
            <button onClick={() => setIsResultsOpen(true)} style={{ position: "absolute", top: 10, right: 330, zIndex: 10, padding: "8px 16px", background: "#17a2b8", color: "white", border: "none", borderRadius: 6, cursor: "pointer", boxShadow: "0 2px 5px rgba(0,0,0,0.2)", fontWeight: "bold" }}>
                View Results 📊
            </button>
        )}

        <button onClick={handleClearCanvas} style={{ position: "absolute", top: 10, right: 180, zIndex: 10, padding: "8px 16px", background: "#6c757d", color: "white", border: "none", borderRadius: 6, cursor: "pointer", boxShadow: "0 2px 5px rgba(0,0,0,0.2)" }}>Clear Canvas</button>

        <button onClick={handleRunConfig} style={{ position: "absolute", top: 10, right: 10, zIndex: 10, padding: "8px 16px", background: "#e20606ff", color: "white", border: "none", borderRadius: 6, cursor: "pointer", boxShadow: "0 2px 5px rgba(0,0,0,0.2)" }}>Run Configuration</button>

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