import type { ConsistencyEdgeId, ToolName } from "./schemas";

export type AgentPhaseId = "foundation" | "experience" | "rendering" | "html5_runtime" | "consistency" | "repair" | "finalize";

export type AgentPhaseConfig = {
  id: AgentPhaseId;
  title: string;
  goal: string;
  tools: ToolName[];
};

export type ToolExecutionConfig = {
  tool: ToolName;
  title: string;
  summary: string;
  phase: AgentPhaseId;
  dependsOn: ToolName[];
  html5Outputs: string[];
  concurrentWith: ToolName[];
};

export type ConsistencyEdgeConfig = {
  edgeId: ConsistencyEdgeId;
  sourceTool: ToolName;
  targetTool: ToolName;
  level: "hard" | "soft";
};

export const AGENT_PHASES: AgentPhaseConfig[] = [
  {
    id: "foundation",
    title: "Core design",
    goal: "Build the proposal, gameplay loop, economy loop, and system coverage that the prototype depends on.",
    tools: ["gameplay_tool", "economy_tool", "system_design_tool", "proposal_tool"],
  },
  {
    id: "experience",
    title: "Experience structure",
    goal: "Generate scene, UI, story, and character structures that players will actually encounter.",
    tools: ["scene_design_tool", "ui_architecture_tool", "story_tool", "character_tool"],
  },
  {
    id: "rendering",
    title: "Runtime payload",
    goal: "Generate asset, copy, and HTML5-facing payloads that can be consumed by Phaser/WebGL runtime code.",
    tools: ["asset_manifest_tool", "copywriting_tool"],
  },
  {
    id: "html5_runtime",
    title: "HTML5 runtime mapping",
    goal: "Map content outputs into deterministic layout, interaction, and timeline data that Phaser/WebGL can render directly.",
    tools: ["layout_tool", "timeline_tool"],
  },
  {
    id: "consistency",
    title: "Consistency graph",
    goal: "Check rule-based and semantic consistency across dependency edges before evaluation.",
    tools: [],
  },
  {
    id: "repair",
    title: "Reason-based repair",
    goal: "Let the main agent understand why a repair is needed, pick the most leveraged targets, then recheck affected edges.",
    tools: [],
  },
  {
    id: "finalize",
    title: "HTML5 handoff",
    goal: "Assemble the final creative pack, evaluation, and Phaser/WebGL preparation package.",
    tools: [],
  },
];

export const TOOL_EXECUTION_CONFIG: Record<ToolName, ToolExecutionConfig> = {
  gameplay_tool: {
    tool: "gameplay_tool",
    title: "玩法结构工具",
    summary: "Define the main loop, sub loops, click path, and feedback rhythm.",
    phase: "foundation",
    dependsOn: [],
    html5Outputs: [],
    concurrentWith: [],
  },
  economy_tool: {
    tool: "economy_tool",
    title: "数值与经济工具",
    summary: "Define currencies, faucets, sinks, upgrade thresholds, and monetization hooks.",
    phase: "foundation",
    dependsOn: ["gameplay_tool"],
    html5Outputs: [],
    concurrentWith: ["system_design_tool"],
  },
  system_design_tool: {
    tool: "system_design_tool",
    title: "系统策划工具",
    summary: "Define management, expansion, mission, event, role interaction, and collection systems.",
    phase: "foundation",
    dependsOn: ["gameplay_tool"],
    html5Outputs: [],
    concurrentWith: ["economy_tool"],
  },
  proposal_tool: {
    tool: "proposal_tool",
    title: "总体策划工具",
    summary: "Summarize positioning, prototype scope, validation focus, and project-level risks.",
    phase: "foundation",
    dependsOn: ["gameplay_tool", "economy_tool", "system_design_tool"],
    html5Outputs: [],
    concurrentWith: [],
  },
  scene_design_tool: {
    tool: "scene_design_tool",
    title: "场景策划工具",
    summary: "Define scene zones, interactive hotspots, building slots, and navigation flow.",
    phase: "experience",
    dependsOn: ["system_design_tool", "proposal_tool"],
    html5Outputs: ["sceneDefinitions", "layoutConfig", "interactionConfig"],
    concurrentWith: ["story_tool"],
  },
  ui_architecture_tool: {
    tool: "ui_architecture_tool",
    title: "UI 架构工具",
    summary: "Define HUD, order/task/event/build panels, and feedback surfaces.",
    phase: "experience",
    dependsOn: ["scene_design_tool", "system_design_tool"],
    html5Outputs: ["layoutConfig", "copywritingConfig", "interactionConfig"],
    concurrentWith: [],
  },
  story_tool: {
    tool: "story_tool",
    title: "剧情工具",
    summary: "Define story positioning, world summary, character roster, and chapter anchors.",
    phase: "experience",
    dependsOn: ["proposal_tool", "system_design_tool"],
    html5Outputs: ["copywritingConfig", "timelineConfig"],
    concurrentWith: ["scene_design_tool"],
  },
  character_tool: {
    tool: "character_tool",
    title: "角色工具",
    summary: "Define character cards, interaction roles, story anchors, and visual keywords.",
    phase: "experience",
    dependsOn: ["story_tool", "system_design_tool"],
    html5Outputs: ["layoutConfig", "copywritingConfig", "timelineConfig"],
    concurrentWith: [],
  },
  asset_manifest_tool: {
    tool: "asset_manifest_tool",
    title: "资产清单工具",
    summary: "Define production-grade assets, export rules, layer rules, and priority order.",
    phase: "rendering",
    dependsOn: ["proposal_tool", "economy_tool", "scene_design_tool", "ui_architecture_tool", "story_tool", "character_tool"],
    html5Outputs: ["assetManifest", "layoutConfig", "lightingRenderConfig"],
    concurrentWith: [],
  },
  copywriting_tool: {
    tool: "copywriting_tool",
    title: "文案工具",
    summary: "Generate page titles, panel titles, button labels, task copy, story-facing lines, and asset labels.",
    phase: "rendering",
    dependsOn: ["proposal_tool", "economy_tool", "scene_design_tool", "ui_architecture_tool", "story_tool", "character_tool", "asset_manifest_tool"],
    html5Outputs: ["copywritingConfig", "timelineConfig"],
    concurrentWith: [],
  },
  layout_tool: {
    tool: "layout_tool",
    title: "Layout 工具",
    summary: "Map scene, UI, character, and asset outputs into scene definitions, layout config, and interaction bindings.",
    phase: "html5_runtime",
    dependsOn: ["scene_design_tool", "ui_architecture_tool", "character_tool", "asset_manifest_tool"],
    html5Outputs: ["sceneDefinitions", "layoutConfig", "interactionConfig"],
    concurrentWith: [],
  },
  timeline_tool: {
    tool: "timeline_tool",
    title: "Timeline 工具",
    summary: "Map story, copy, interaction, and layout outputs into runtime event sequences and timing payloads.",
    phase: "html5_runtime",
    dependsOn: ["story_tool", "copywriting_tool", "layout_tool"],
    html5Outputs: ["timelineConfig", "lightingRenderConfig"],
    concurrentWith: [],
  },
};

export const HARD_CONSISTENCY_EDGES: ConsistencyEdgeConfig[] = [
  { edgeId: "gameplay_economy", sourceTool: "gameplay_tool", targetTool: "economy_tool", level: "hard" },
  { edgeId: "gameplay_system", sourceTool: "gameplay_tool", targetTool: "system_design_tool", level: "hard" },
  { edgeId: "system_scene", sourceTool: "system_design_tool", targetTool: "scene_design_tool", level: "hard" },
  { edgeId: "scene_ui", sourceTool: "scene_design_tool", targetTool: "ui_architecture_tool", level: "hard" },
  { edgeId: "story_character", sourceTool: "story_tool", targetTool: "character_tool", level: "hard" },
  { edgeId: "proposal_asset", sourceTool: "proposal_tool", targetTool: "asset_manifest_tool", level: "hard" },
  { edgeId: "scene_asset", sourceTool: "scene_design_tool", targetTool: "asset_manifest_tool", level: "hard" },
  { edgeId: "ui_asset", sourceTool: "ui_architecture_tool", targetTool: "asset_manifest_tool", level: "hard" },
  { edgeId: "story_asset", sourceTool: "story_tool", targetTool: "asset_manifest_tool", level: "hard" },
  { edgeId: "character_asset", sourceTool: "character_tool", targetTool: "asset_manifest_tool", level: "hard" },
  { edgeId: "story_copywriting", sourceTool: "story_tool", targetTool: "copywriting_tool", level: "hard" },
  { edgeId: "character_copywriting", sourceTool: "character_tool", targetTool: "copywriting_tool", level: "hard" },
  { edgeId: "scene_copywriting", sourceTool: "scene_design_tool", targetTool: "copywriting_tool", level: "hard" },
  { edgeId: "ui_copywriting", sourceTool: "ui_architecture_tool", targetTool: "copywriting_tool", level: "hard" },
  { edgeId: "asset_copywriting", sourceTool: "asset_manifest_tool", targetTool: "copywriting_tool", level: "hard" },
  { edgeId: "economy_copywriting", sourceTool: "economy_tool", targetTool: "copywriting_tool", level: "hard" },
  { edgeId: "scene_layout", sourceTool: "scene_design_tool", targetTool: "layout_tool", level: "hard" },
  { edgeId: "ui_layout", sourceTool: "ui_architecture_tool", targetTool: "layout_tool", level: "hard" },
  { edgeId: "character_layout", sourceTool: "character_tool", targetTool: "layout_tool", level: "hard" },
  { edgeId: "scene_interaction", sourceTool: "scene_design_tool", targetTool: "layout_tool", level: "hard" },
  { edgeId: "ui_interaction", sourceTool: "ui_architecture_tool", targetTool: "layout_tool", level: "hard" },
  { edgeId: "story_timeline", sourceTool: "story_tool", targetTool: "timeline_tool", level: "hard" },
  { edgeId: "copywriting_timeline", sourceTool: "copywriting_tool", targetTool: "timeline_tool", level: "hard" },
  { edgeId: "layout_timeline", sourceTool: "layout_tool", targetTool: "timeline_tool", level: "hard" },
];

export const SOFT_CONSISTENCY_EDGES: ConsistencyEdgeConfig[] = [
  { edgeId: "proposal_story", sourceTool: "proposal_tool", targetTool: "story_tool", level: "soft" },
  { edgeId: "proposal_ui", sourceTool: "proposal_tool", targetTool: "ui_architecture_tool", level: "soft" },
  { edgeId: "economy_asset", sourceTool: "economy_tool", targetTool: "asset_manifest_tool", level: "soft" },
  { edgeId: "proposal_copywriting", sourceTool: "proposal_tool", targetTool: "copywriting_tool", level: "soft" },
  { edgeId: "gameplay_copywriting", sourceTool: "gameplay_tool", targetTool: "copywriting_tool", level: "soft" },
  { edgeId: "system_copywriting", sourceTool: "system_design_tool", targetTool: "copywriting_tool", level: "soft" },
  { edgeId: "layout_lighting", sourceTool: "layout_tool", targetTool: "timeline_tool", level: "soft" },
];

export const ALL_CONSISTENCY_EDGES = [...HARD_CONSISTENCY_EDGES, ...SOFT_CONSISTENCY_EDGES];

export function getToolDependencies(tool: ToolName) {
  return TOOL_EXECUTION_CONFIG[tool].dependsOn;
}

export function getConcurrentTools(tool: ToolName) {
  return TOOL_EXECUTION_CONFIG[tool].concurrentWith;
}

export function getPhaseForTool(tool: ToolName) {
  return TOOL_EXECUTION_CONFIG[tool].phase;
}

export function getHtml5OutputsForTool(tool: ToolName) {
  return TOOL_EXECUTION_CONFIG[tool].html5Outputs;
}

export function getExecutionBatches(toolQueue: ToolName[], preResolved: ToolName[] = []) {
  const pending = new Set(toolQueue);
  const batches: ToolName[][] = [];
  const resolved = new Set<ToolName>(preResolved);

  while (pending.size > 0) {
    const runnable = [...pending].filter((tool) =>
      getToolDependencies(tool).every((dependency) => !pending.has(dependency) || resolved.has(dependency)),
    );
    if (runnable.length === 0) {
      throw new Error(`Unresolvable tool dependency graph: ${[...pending].join(", ")}`);
    }
    batches.push(runnable);
    runnable.forEach((tool) => {
      pending.delete(tool);
      resolved.add(tool);
    });
  }

  return batches;
}

export function discoverCheckableEdges(
  resolvedTools: ToolName[],
  options?: {
    includeSoft?: boolean;
    onlyAffectedTools?: ToolName[];
    excludeEdges?: ConsistencyEdgeId[];
  },
) {
  const resolved = new Set<ToolName>(resolvedTools);
  const includeSoft = options?.includeSoft ?? true;
  const onlyAffected = options?.onlyAffectedTools ? new Set<ToolName>(options.onlyAffectedTools) : null;
  const exclude = new Set<ConsistencyEdgeId>(options?.excludeEdges ?? []);

  return ALL_CONSISTENCY_EDGES.filter((edge) => {
    if (!includeSoft && edge.level === "soft") return false;
    if (exclude.has(edge.edgeId)) return false;
    if (!resolved.has(edge.sourceTool) || !resolved.has(edge.targetTool)) return false;
    if (!onlyAffected) return true;
    return onlyAffected.has(edge.sourceTool) || onlyAffected.has(edge.targetTool);
  });
}

export function discoverEdgesTriggeredByTool(
  tool: ToolName,
  resolvedTools: ToolName[],
  options?: {
    includeSoft?: boolean;
    excludeEdges?: ConsistencyEdgeId[];
  },
) {
  return discoverCheckableEdges(resolvedTools, {
    includeSoft: options?.includeSoft,
    excludeEdges: options?.excludeEdges,
    onlyAffectedTools: [tool],
  });
}
