export type { ConsistencyArtifacts } from "./consistency/consistency-edge-defs";
export { getConsistencyEdgeGuide } from "./consistency/consistency-edge-defs";
export {
  buildRuleConsistencyGraph,
  buildRuleConsistencyGraphForEdges,
  buildRuleConsistencyGraphForArtifacts,
  mergeConsistencyReports,
  buildLocalConsistencyReport,
  buildConsistencyRepairBrief,
  buildSceneRepairFocus,
} from "./consistency/consistency-graph-core";