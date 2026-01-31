import { buildAdjacency, mapNodes } from "./graphValidation";

const DATASET_NODE_ID = "dataset-node";

/**
 * Extracts chains and organizes them into named branches.
 * Matches keys to the VISUAL labels on the canvas.
 * Returns: { "main": [...], "branch_1": [...], "branch_2": [...] }
 */
export const extractChains = (nodes, edges) => {
  const adjacency = buildAdjacency(edges);
  const nodeMap = mapNodes(nodes);

  // 1. Create a Lookup Map for Visual Labels
  // We look for nodes of type 'branchLabel'.
  // The ID of these labels is formatted as "label_{TARGET_NODE_ID}" in FlowCanvasInner.
  const labelLookup = {};
  
  nodes.forEach(n => {
    if (n.type === 'branchLabel') {
       // Extract the ID of the node this label belongs to
       const targetNodeId = n.id.replace('label_', '');
       // Store map: { "node_123": "BRANCH 1" }
       labelLookup[targetNodeId] = n.data.label;
    }
  });

  const paths = [];

  // DFS to find all unique paths from Dataset to an end node (leaf)
  const dfs = (nodeId, currentPath) => {
    const node = nodeMap.get(nodeId);
    
    // Build path payload (excluding dataset node itself)
    let newPath = currentPath;
    if (nodeId !== DATASET_NODE_ID && node) {
      newPath = [
        ...currentPath,
        {
          id: node.id,
          baseId: node.data.baseId,
          label: node.data.label,
          type: node.type,
          isLocked: node.data.isLocked || false 
        },
      ];
    }

    const children = adjacency.get(nodeId) || [];

    // If leaf node (no children), save the path
    if (children.length === 0) {
      if (newPath.length > 0) paths.push(newPath);
      return;
    }

    for (const child of children) {
      dfs(child, newPath);
    }
  };

  if (nodeMap.has(DATASET_NODE_ID)) {
    dfs(DATASET_NODE_ID, []);
  }

  // --- Naming Logic ---
  const labeledBranches = {};
  let fallbackCounter = 1;

  paths.forEach((path) => {
    // 1. Check for Main Branch (Last node is locked)
    const lastNode = path[path.length - 1];
    const isMain = lastNode && lastNode.isLocked;

    if (isMain) {
        labeledBranches["main"] = path;
    } else {
        // 2. Determine Custom Branch Name based on Visual Label
        // We traverse the path BACKWARDS (from Leaf -> Root).
        // The first node we encounter that has a label attached is the owner of this branch.
        let foundLabel = null;

        for (let i = path.length - 1; i >= 0; i--) {
            const nodeId = path[i].id;
            if (labelLookup[nodeId]) {
                foundLabel = labelLookup[nodeId]; // e.g., "BRANCH 1"
                break;
            }
        }

        if (foundLabel) {
            // Convert "BRANCH 1" -> "branch_1"
            const key = foundLabel.toLowerCase().replace(/\s+/g, '_');
            labeledBranches[key] = path;
        } else {
            // Fallback (should rarely happen if visual logic works)
            labeledBranches[`branch_unknown_${fallbackCounter}`] = path;
            fallbackCounter++;
        }
    }
  });

  return labeledBranches;
};