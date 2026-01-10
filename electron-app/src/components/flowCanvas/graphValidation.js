import { extractChains } from './branchExtractor';

const DATASET_NODE_ID = "dataset-node";

// --- Type Helpers (Handles variations in naming) ---
const isModel = (type) => ['model', 'modelNode'].includes(type);
const isOutput = (type) => ['output', 'outputNode'].includes(type);
const isPreprocessing = (type) => 
  ['normal', 'domain', 'preprocessing', 'preprocessingNode', 'normalpreprocessingNode'].includes(type);

// --- Core Graph Utilities ---

export const buildAdjacency = (edgeList) => {
  const map = new Map();
  for (const e of edgeList) {
    if (!map.has(e.source)) map.set(e.source, []);
    map.get(e.source).push(e.target);
  }
  return map;
};

export const mapNodes = (nodesList) =>
  new Map(nodesList.map((n) => [n.id, n]));

export const isConnectedToDataset = (nodeId, edges) => {
  if (nodeId === DATASET_NODE_ID) return true;
  const incoming = edges.filter((e) => e.target === nodeId);
  if (incoming.length === 0) return false;
  return incoming.some((e) => isConnectedToDataset(e.source, edges));
};

// --- Recursive Checkers ---

/**
 * Checks if a Model node exists anywhere upstream in the chain.
 */
function hasUpstreamModel(startNodeId, edges, nodeMap) {
  // Build Reverse Adjacency (Child -> Parent)
  const revMap = new Map();
  for (const e of edges) revMap.set(e.target, e.source);

  let curr = startNodeId;
  while (curr) {
    const node = nodeMap.get(curr);
    // Use helper to check for 'model' or 'modelNode'
    if (node && isModel(node.type)) return true;
    
    if (curr === DATASET_NODE_ID) return false;
    curr = revMap.get(curr);
  }
  return false;
}

/**
 * Checks for duplicate baseIds (e.g., two PCA nodes) in one path
 */
export const hasDuplicateBaseIdInAnyPath = (nodes, edges) => {
  const adjacency = buildAdjacency(edges);
  const nodeMap = mapNodes(nodes);
  let duplicateFound = false;

  const dfs = (nodeId, used) => {
    if (duplicateFound) return;
    const node = nodeMap.get(nodeId);
    const baseId = node?.data?.baseId || null;

    if (baseId && used.has(baseId)) {
      duplicateFound = true;
      return;
    }
    const nextUsed = new Set(used);
    if (baseId) nextUsed.add(baseId);

    const children = adjacency.get(nodeId) || [];
    for (const child of children) {
      dfs(child, nextUsed);
    }
  };
  if (nodeMap.has(DATASET_NODE_ID)) dfs(DATASET_NODE_ID, new Set());
  return duplicateFound;
};

// ======================================================
// VALIDATOR 1: Real-time Connection Rules (onConnect)
// ======================================================
export const validateConnection = (nodes, edges, connection) => {
  const nodeMap = mapNodes(nodes);
  const sourceNode = nodeMap.get(connection.source);
  const targetNode = nodeMap.get(connection.target);

  if (!sourceNode || !targetNode) return "Node not found.";

  // --- RULE: PREVENT CONVERGENCE (Merging Branches) ---
  // Check if the target node ALREADY has an incoming edge.
  const targetAlreadyHasInput = edges.some(e => e.target === connection.target);
  if (targetAlreadyHasInput) {
      return "❌ Branches cannot merge! A node can only have one input.";
  }

  // Basic Validation
  if (connection.target === DATASET_NODE_ID) return "❌ Cannot connect INTO the Dataset node.";
  if (!isConnectedToDataset(connection.source, edges)) return "❌ Source must be connected to the Dataset first.";

  // --- RULE: STRICT ORDERING (No Preprocessing AFTER Model) ---
  if (isPreprocessing(targetNode.type)) {
      // 1. Check immediate parent
      if (isModel(sourceNode.type)) {
          return "❌ Logic Error: Cannot place Preprocessing AFTER a Model.";
      }
      // 2. Check entire upstream history
      if (hasUpstreamModel(connection.source, edges, nodeMap)) {
          return "❌ Logic Error: This branch already has a Model upstream. Preprocessing must come BEFORE the model.";
      }
  }

  // --- RULE: ONLY ONE MODEL PER BRANCH ---
  if (isModel(targetNode.type)) {
      // 1. Check immediate parent
      if (isModel(sourceNode.type)) {
          return "❌ Only one Model allowed per branch.";
      }
      // 2. Check entire upstream history
      if (hasUpstreamModel(connection.source, edges, nodeMap)) {
          return "❌ This branch already has a Model upstream. Only one model allowed.";
      }
  }
  
  // --- RULE: OUTPUT MUST BE END ---
  if (isOutput(sourceNode.type)) {
      return `Rule Error: Output nodes ("${sourceNode.data.label}") must be the end of a pipeline.`;
  }

  // Check for duplicates
  const simulatedEdges = [...edges, { ...connection, id: `sim_${Date.now()}` }];
  if (hasDuplicateBaseIdInAnyPath(nodes, simulatedEdges)) {
    return "❌ Same module cannot appear twice in the same branch!";
  }

  return null; // Connection Allowed
};

// ======================================================
// VALIDATOR 2: Final Pipeline "Run" Rules
// ======================================================

function findStandaloneNodes(nodes, edges) {
  for (const node of nodes) {
    if (node.id === DATASET_NODE_ID) continue;
    // Labels are visual only, skip them
    if (node.type === 'branchLabel') continue; 
    
    if (!isConnectedToDataset(node.id, edges)) {
       return `Error: Node "${node.data.label}" is not part of a chain from the Dataset node.`;
    }
  }
  return null;
}

export function validatePipeline(nodes, edges) {
  // 1. Check for floating nodes
  const standaloneError = findStandaloneNodes(nodes, edges);
  if (standaloneError) return standaloneError;

  // 2. Extract Branches
  // extractChains returns object: { "main": [...], "branch_1": [...] }
  const chains = extractChains(nodes, edges);
  const branchNames = Object.keys(chains);

  if (branchNames.length === 0) {
    return "❌ No complete pipeline found. Connect your nodes from the Dataset to an Output.";
  }

  // 3. Validate Completeness for EVERY Branch
  for (const name of branchNames) {
      const path = chains[name];
      const lastNode = path[path.length - 1];

      // A. Must end in Output
      if (!isOutput(lastNode.type)) {
          return `❌ Incomplete Branch: "${name}" must end with an Output node.`;
      }

      // B. Must contain a Model
      const hasModelNode = path.some(n => isModel(n.type));
      if (!hasModelNode) {
          return `❌ Missing Model: "${name}" does not contain a Machine Learning Model.`;
      }
  }
  
  return null;
}