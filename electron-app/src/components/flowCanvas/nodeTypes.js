import DatasetNode from "./nodes/DatasetNode";
import NormalPreprocessingNode from "./nodes/NormalPreprocessingNode";
import DomainPreprocessingNode from "./nodes/DomainPreprocessingNode";
import ModelNode from "./nodes/ModelNode";
import OutputNode from "./nodes/OutputNode";
import BranchLabelNode from "./nodes/BranchLabelNode"; // New Label Component

const nodeTypes = {
  // 1. Main Node Types (Match Sidebar 'type' props)
  normal: NormalPreprocessingNode,
  domain: DomainPreprocessingNode,
  model: ModelNode,
  output: OutputNode,
  dataset: DatasetNode,

  // 2. New Branch Label Node (For "Main Branch", "Branch 1", etc.)
  branchLabel: BranchLabelNode, 

  // 3. Legacy/Fallback Keys (Safety net for older logic)
  datasetNode: DatasetNode,
  normalpreprocessingNode: NormalPreprocessingNode,
  modelNode: ModelNode,
  outputNode: OutputNode,
};

export default nodeTypes;