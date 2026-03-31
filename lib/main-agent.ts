import type { LangfuseObservation } from "@langfuse/tracing";
import { tagRepairIteration } from "./langfuse";
import { createDebugLog, finalizeDebugLog, getLatestDebugLog, getLatestFinalizedDebugLog } from "./debug-log";
import {
  runAssetManifestTool,
  runCharacterTool,
  runCopywritingTool,
  runEconomyTool,
  runGameplayTool,
  runIntentTool,
  runLayoutTool,
  runPlanningTool,
  runProposalTool,
  runRepairTool,
  runSceneTool,
  runStoryTool,
  runSystemDesignTool,
  runTimelineTool,
  runToolSelectionTool,
  runUiTool,
  runVerificationTool,
} from "./agent-tools";
import { runLocalRepairDecisionTool, runLocalSemanticConsistencyTool, runSemanticConsistencyTool } from "./consistency-tools";
import {
  buildSceneRepairFocus,
  buildLocalConsistencyReport,
  buildRuleConsistencyGraph,
  buildRuleConsistencyGraphForArtifacts,
  mergeConsistencyReports,
  type ConsistencyArtifacts,
} from "./consistency-graph";
import { evaluateProposal } from "./evaluator";
import { validateAllPhaseContracts, type AgentPhaseArtifacts } from "./agent-phase-contracts";
import { discoverCheckableEdges, discoverEdgesTriggeredByTool, getToolDependencies, TOOL_EXECUTION_CONFIG } from "./agent-execution-config";
import type {
  Html5PreparationPackage,
  InteractionConfigInput,
  LayoutConfigInput,
  LightingRenderConfigInput,
  SceneDefinition,
  TimelineConfigInput,
} from "./html5-render-schemas";
import type { ConsistencyReport, LocalRepairDecision, NodeConsistencyCheckpoint, RepairPlan, RepairAttemptRecord, RepairPlanWithHistory } from "./agent-consistency-schemas";
import type {
  AgentPlan,
  AssetManifest,
  CharacterCard,
  CopywritingPack,
  ConsistencyCheckResult,
  CreativePack,
  EconomyDesign,
  Evaluation,
  GameProposal,
  GameplayStructure,
  IntentAnalysis,
  PersonaInput,
  ReviewHistoryItem,
  SceneDesign,
  StoryResult,
  SystemDesign,
  ToolName,
  ToolSelection,
  UIInformationArchitecture,
  VerificationResult,
} from "./schemas";
import { getGenreProfile } from "./schemas";

export type MainAgentState = {
  sessionId: string;
  runId: string;
  persona: PersonaInput;
  messages: Array<{ role: "system" | "assistant" | "tool"; content: string }>;
  intent: IntentAnalysis | null;
  plan: AgentPlan | null;
  toolSelection: ToolSelection | null;
  gameplay: GameplayStructure | null;
  economy: EconomyDesign | null;
  systems: SystemDesign | null;
  proposal: GameProposal | null;
  scene: SceneDesign | null;
  ui: UIInformationArchitecture | null;
  story: StoryResult | null;
  characterCards: CharacterCard[] | null;
  assetManifest: AssetManifest | null;
  copywriting: CopywritingPack | null;
  sceneDefinitions: SceneDefinition[] | null;
  interactionConfig: InteractionConfigInput | null;
  layoutConfig: LayoutConfigInput | null;
  timelineConfig: TimelineConfigInput | null;
  lightingRenderConfig: LightingRenderConfigInput | null;
  html5Preparation: Html5PreparationPackage | null;
  consistency: ConsistencyCheckResult | null;
  consistencyReport: ConsistencyReport | null;
  evaluation: Evaluation | null;
  reviewHistory: ReviewHistoryItem[];
  verification: VerificationResult | null;
  repairPlan: RepairPlan | null;
  globalRepairCount: number;
  consistencyCheckpoints: NodeConsistencyCheckpoint[];
  iterationCount: number;
  maxIterations: number;
  finalResult: {
    proposal: GameProposal | null;
    creativePack: CreativePack | null;
    html5Preparation: Html5PreparationPackage | null;
    evaluation: Evaluation | null;
    reviewHistory: ReviewHistoryItem[];
    consistencyReport: ConsistencyReport | null;
  } | null;
};

type AgentEvent =
  | {
      type: "node";
      node: string;
      phase: string;
      title: string;
      status: "running" | "done" | "fallback" | "error";
      iteration: number;
      summary: string;
      output?: unknown;
    }
  | { type: "plan"; plan: AgentPlan }
  | { type: "generation"; generation: { proposal: GameProposal; creativePack: CreativePack } }
  | { type: "repair_plan"; repairPlan: RepairPlan }
  | { type: "html5_preparation"; html5Preparation: Html5PreparationPackage }
  | { type: "evaluation"; evaluation: Evaluation }
  | { type: "review_history"; history: ReviewHistoryItem[] }
  | { type: "consistency_report"; report: ConsistencyReport }
  | {
      type: "phase_contract";
      contract: {
        phaseId: string;
        title: string;
        pass: boolean;
        missingArtifacts: string[];
        notes: string[];
        requiredTools: ToolName[];
        html5Targets: string[];
      };
    };

type RunMainAgentParams = {
  sessionId: string;
  runId: string;
  persona: PersonaInput;
  langfuseParent?: LangfuseObservation;
  onEvent?: (event: AgentEvent) => void;
};

type ToolExecutorMap = Record<ToolName, () => Promise<unknown>>;

const TOOL_TITLE: Record<ToolName, string> = {
  gameplay_tool: "玩法结构工具",
  economy_tool: "数值与经济工具",
  system_design_tool: "系统策划工具",
  proposal_tool: "总体策划工具",
  scene_design_tool: "场景策划工具",
  ui_architecture_tool: "UI 架构工具",
  story_tool: "剧情工具",
  character_tool: "角色工具",
  asset_manifest_tool: "资产清单工具",
  copywriting_tool: "文案工具",
  layout_tool: "Layout 工具",
  timeline_tool: "Timeline 工具",
};

const TOOL_SUMMARY: Record<ToolName, string> = {
  gameplay_tool: "正在定义主循环、次循环、点击链路和反馈节奏。",
  economy_tool: "正在补齐货币、订单、升级、扩建券与装扮解锁的经济闭环。",
  system_design_tool: "正在生成经营、扩建、任务、活动与角色互动系统。",
  proposal_tool: "正在汇总体策划、原型范围和验证重点。",
  scene_design_tool: "正在生成主场景布局、交互区、坑位和动线。",
  ui_architecture_tool: "正在梳理顶栏、订单栏、任务栏、活动入口和建造面板。",
  story_tool: "正在生成世界观、角色名单、主线剧情和剧情锚点。",
  character_tool: "正在生成角色资料卡、系统职责和视觉关键词。",
  asset_manifest_tool: "正在汇总素材清单、规格、命名规则和背景要求。",
  copywriting_tool: "正在生成页面标题、按钮文案、场景提示、角色台词和资产标签。",
  layout_tool: "正在将场景、UI 与角色结果映射成可渲染的布局和交互绑定。",
  timeline_tool: "正在将剧情、文案与交互绑定映射成运行时时间线。",
};

const FULL_GENERATION_TOOL_ORDER: ToolName[] = [
  "gameplay_tool",
  "economy_tool",
  "system_design_tool",
  "proposal_tool",
  "scene_design_tool",
  "ui_architecture_tool",
  "story_tool",
  "character_tool",
  "asset_manifest_tool",
  "copywriting_tool",
  "layout_tool",
  "timeline_tool",
];

function appendMessage(state: MainAgentState, role: "system" | "assistant" | "tool", content: string) {
  state.messages.push({ role, content });
}

function emit(params: RunMainAgentParams, event: AgentEvent) {
  params.onEvent?.(event);
}

function createSystemNodeLog(params: RunMainAgentParams, state: MainAgentState, stage: string, phase: string, title: string, requestPayload: unknown) {
  return createDebugLog(stage, "system", undefined, requestPayload, {
    runId: params.runId,
    sessionId: params.sessionId,
    iteration: state.iterationCount,
    phase,
    title,
  });
}

function resolveNodeStatus(runId: string, stage: string, iteration: number) {
  const latestLog = getLatestFinalizedDebugLog(stage, runId, iteration) ?? getLatestDebugLog(stage, runId, iteration);
  if (!latestLog) return { status: "done" as const, error: undefined };
  if (latestLog.error) return { status: "error" as const, error: latestLog.error };
  if (latestLog.fallbackUsed) return { status: "fallback" as const, error: undefined };
  return { status: "done" as const, error: undefined };
}

function emitRunningNode(params: RunMainAgentParams, state: MainAgentState, node: string, phase: string, title: string, summary: string) {
  emit(params, { type: "node", node, phase, title, status: "running", iteration: state.iterationCount, summary });
}

function createCreativePack(state: MainAgentState): CreativePack | null {
  if (!state.gameplay || !state.economy || !state.systems || !state.scene || !state.ui || !state.story || !state.characterCards || !state.assetManifest) {
    return null;
  }

  return {
    gameplay: state.gameplay,
    economy: state.economy,
    systems: state.systems,
    scene: state.scene,
    ui: state.ui,
    story: state.story,
    characters: state.characterCards,
    assetManifest: state.assetManifest,
    copywriting: state.copywriting ?? undefined,
  };
}

function legacyConsistencyFromReport(report: ConsistencyReport): ConsistencyCheckResult {
  const failedIds = new Set(report.hardFailures.map((item) => item.edgeId));
  const issues = [...report.hardFailures, ...report.softWarnings].flatMap((item) => item.issues).slice(0, 12);
  const repairSuggestions = report.repairTasks.flatMap((item) => item.successConditions).slice(0, 8);

  return {
    pass: report.globalPass,
    gameplayEconomyAligned: !failedIds.has("gameplay_economy"),
    systemsSceneAligned: !failedIds.has("system_scene") && !failedIds.has("gameplay_system"),
    sceneUIAligned: !failedIds.has("scene_ui"),
    storyCharacterAligned: !failedIds.has("story_character"),
    assetManifestAligned:
      !failedIds.has("proposal_asset") &&
      !failedIds.has("scene_asset") &&
      !failedIds.has("ui_asset") &&
      !failedIds.has("story_asset") &&
      !failedIds.has("character_asset"),
    issues,
    repairSuggestions,
  };
}

function reviewContextText(state: MainAgentState) {
  if (state.reviewHistory.length === 0 && !state.repairPlan && !state.consistencyReport) {
    return "首轮运行，无上一轮返修信息。";
  }

  const lastReview = state.reviewHistory[state.reviewHistory.length - 1];
  return [
    lastReview ? `上一轮结论：第 ${lastReview.round} 轮 / ${lastReview.decision} / ${lastReview.score} 分 / ${lastReview.returned ? "已退回" : "已通过"}` : "",
    lastReview?.returnReasons.length ? `上一轮退回原因：${lastReview.returnReasons.join("；")}` : "",
    lastReview?.repairDirections.length ? `上一轮修缮方向：${lastReview.repairDirections.join("；")}` : "",
    state.repairPlan
      ? `当前返修 rationale：${state.repairPlan.rationale}；目标工具：${state.repairPlan.selectedTargets
          .map((item) => item.toolName)
          .join(", ")}`
      : "",
    state.consistencyReport ? `当前一致性摘要：${state.consistencyReport.summary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function recordReview(state: MainAgentState) {
  if (!state.evaluation || !state.verification || !state.consistencyReport) return;

  state.reviewHistory.push({
    round: state.iterationCount,
    returned: state.verification.needsRepair,
    decision: state.evaluation.decision,
    score: state.evaluation.totalScore,
    returnReasons: [...state.consistencyReport.hardFailures.flatMap((item) => item.issues), ...state.evaluation.blockedBy].slice(0, 10),
    repairDirections: state.consistencyReport.repairTasks.flatMap((item) => item.successConditions).slice(0, 8),
    failedEdges: state.consistencyReport.hardFailures.map((item) => item.edgeId).slice(0, 16),
    selectedRepairTools: state.repairPlan?.selectedTargets.map((item) => item.toolName).slice(0, 8) ?? [],
    repairRationale: state.repairPlan?.rationale ?? "",
  });
}

function canRunTool(state: MainAgentState, tool: ToolName) {
  return getToolDependencies(tool).every((dependency) => {
    switch (dependency) {
      case "gameplay_tool":
        return Boolean(state.gameplay);
      case "economy_tool":
        return Boolean(state.economy);
      case "system_design_tool":
        return Boolean(state.systems);
      case "proposal_tool":
        return Boolean(state.proposal);
      case "scene_design_tool":
        return Boolean(state.scene);
      case "ui_architecture_tool":
        return Boolean(state.ui);
      case "story_tool":
        return Boolean(state.story);
      case "character_tool":
        return Boolean(state.characterCards);
      case "asset_manifest_tool":
        return Boolean(state.assetManifest);
      case "copywriting_tool":
        return Boolean(state.copywriting);
      case "layout_tool":
        return Boolean(state.layoutConfig && state.sceneDefinitions && state.interactionConfig);
      case "timeline_tool":
        return Boolean(state.timelineConfig);
      default:
        return true;
    }
  });
}

function getResolvedToolsFromState(state: MainAgentState): ToolName[] {
  const resolved: ToolName[] = [];
  if (state.gameplay) resolved.push("gameplay_tool");
  if (state.economy) resolved.push("economy_tool");
  if (state.systems) resolved.push("system_design_tool");
  if (state.proposal) resolved.push("proposal_tool");
  if (state.scene) resolved.push("scene_design_tool");
  if (state.ui) resolved.push("ui_architecture_tool");
  if (state.story) resolved.push("story_tool");
  if (state.characterCards) resolved.push("character_tool");
  if (state.assetManifest) resolved.push("asset_manifest_tool");
  if (state.copywriting) resolved.push("copywriting_tool");
  if (state.layoutConfig && state.sceneDefinitions && state.interactionConfig) resolved.push("layout_tool");
  if (state.timelineConfig) resolved.push("timeline_tool");
  return resolved;
}

function buildConsistencyArtifactsFromState(state: MainAgentState, targetGenre?: string): ConsistencyArtifacts {
  return {
    targetGenre,
    proposal: state.proposal,
    gameplay: state.gameplay,
    economy: state.economy,
    systems: state.systems,
    scene: state.scene,
    ui: state.ui,
    story: state.story,
    characters: state.characterCards,
    assetManifest: state.assetManifest,
    copywriting: state.copywriting,
    html5Preparation: state.html5Preparation,
  };
}

function getToolOutput(state: MainAgentState, tool: ToolName): unknown {
  switch (tool) {
    case "gameplay_tool":
      return state.gameplay;
    case "economy_tool":
      return state.economy;
    case "system_design_tool":
      return state.systems;
    case "proposal_tool":
      return state.proposal;
    case "scene_design_tool":
      return state.scene;
    case "ui_architecture_tool":
      return state.ui;
    case "story_tool":
      return state.story;
    case "character_tool":
      return state.characterCards;
    case "asset_manifest_tool":
      return state.assetManifest;
    case "copywriting_tool":
      return state.copywriting;
    case "layout_tool":
      return state.layoutConfig && state.sceneDefinitions && state.interactionConfig
        ? { layoutConfig: state.layoutConfig, sceneDefinitions: state.sceneDefinitions, interactionConfig: state.interactionConfig }
        : null;
    case "timeline_tool":
      return state.timelineConfig && state.lightingRenderConfig && state.html5Preparation
        ? { timelineConfig: state.timelineConfig, lightingRenderConfig: state.lightingRenderConfig, html5Preparation: state.html5Preparation }
        : null;
    default:
      return null;
  }
}

function sortToolsByExecutionOrder(tools: ToolName[]) {
  return [...new Set(tools)].sort((left, right) => FULL_GENERATION_TOOL_ORDER.indexOf(left) - FULL_GENERATION_TOOL_ORDER.indexOf(right));
}

function collectRelatedToolsForEdges(edges: { sourceTool: ToolName; targetTool: ToolName }[], triggerTool: ToolName) {
  return sortToolsByExecutionOrder([triggerTool, ...edges.flatMap((edge) => [edge.sourceTool, edge.targetTool])]);
}

function buildLocalArtifactContext(state: MainAgentState, triggerTool: ToolName, relatedTools: ToolName[]) {
  return {
    triggerTool,
    relatedOutputs: Object.fromEntries(
      relatedTools
        .map((tool) => [tool, getToolOutput(state, tool)] as const)
        .filter((entry) => entry[1] != null),
    ),
    currentRepairPlan:
      state.repairPlan == null
        ? null
        : {
            rationale: state.repairPlan.rationale,
            selectedTargets: state.repairPlan.selectedTargets,
            recheckEdges: state.repairPlan.recheckEdges,
          },
  };
}

function buildLocalRepairPlan(decision: LocalRepairDecision, report: ConsistencyReport): RepairPlan {
  const selectedTargets = sortToolsByExecutionOrder(decision.selectedTargets)
    .slice(0, 3)
    .map((toolName) => {
      const relatedTasks = report.repairTasks.filter((task) => task.candidateTools.includes(toolName));
      return {
        toolName,
        whyThisTool:
          report.repairCandidates.find((candidate) => candidate.toolName === toolName)?.reasons[0] ??
          relatedTasks[0]?.whyItMatters ??
          decision.rationale,
        whyNotOtherTargets: decision.whyNotOtherTargets,
        costReasoning: decision.costReasoning,
        expectedImpact: Array.from(new Set(relatedTasks.flatMap((task) => task.successConditions))).slice(0, 6),
        relatedTaskEdges: Array.from(new Set(relatedTasks.map((task) => task.edgeId))).slice(0, 8),
      };
    });

  const recheckEdges = Array.from(
    new Set([
      ...decision.recheckEdges,
      ...selectedTargets.flatMap((item) => item.relatedTaskEdges),
      ...report.hardFailures.map((item) => item.edgeId),
    ]),
  ).slice(0, 16) as RepairPlan["recheckEdges"];

  // Collect rich failure diagnostics per edge to pass through to prompts
  const failedEdgeDetails = report.hardFailures
    .filter((edge) => recheckEdges.includes(edge.edgeId))
    .map((edge) => {
      const task = report.repairTasks.find((t) => t.edgeId === edge.edgeId);
      return {
        edgeId: edge.edgeId,
        issues: edge.issues.slice(0, 6),
        strictIdentifiers: task?.strictIdentifiers?.slice(0, 8) ?? [],
        repairSuggestions: edge.repairSuggestions?.slice(0, 4) ?? [],
      };
    })
    .slice(0, 16);

  const repairInstructions = report.repairTasks
    .filter((task) => recheckEdges.includes(task.edgeId))
    .map((task) => {
      const identifierHint = task.strictIdentifiers?.length
        ? ` Must include: ${task.strictIdentifiers.join(", ")}.`
        : "";
      return `[${task.edgeId}] ${task.problemSummary}${identifierHint}`;
    })
    .slice(0, 8)
    .join("\n");

  return {
    rationale: decision.rationale,
    selectedTargets,
    stopConditions: decision.successConditions.length > 0 ? decision.successConditions : ["The local failed consistency edges pass recheck."],
    recheckEdges,
    repairGoal: decision.rationale,
    repairInstructions: repairInstructions || "Focus repair on failed edges and prove the issue is resolved during recheck.",
    repairTools: selectedTargets.map((item) => item.toolName),
    expectedImprovements: Array.from(new Set(selectedTargets.flatMap((item) => item.expectedImpact).concat(decision.expectedImpact, decision.successConditions))).slice(0, 12),
    failedEdgeDetails,
  };
}

function getAllowedRepairTargets(report: ConsistencyReport) {
  const candidates =
    report.hardFailures.length > 0
      ? report.hardFailures.flatMap((edge) => edge.involvedTools)
      : [...report.hardFailures, ...report.softWarnings].flatMap((edge) => edge.involvedTools);
  return new Set<ToolName>(candidates);
}

function sanitizeLocalRepairTargets(state: MainAgentState, report: ConsistencyReport, selectedTargets: ToolName[]) {
  const allowedTargets = getAllowedRepairTargets(report);
  return sortToolsByExecutionOrder(
    selectedTargets.filter((tool) => allowedTargets.has(tool) && canRunTool(state, tool)),
  ).slice(0, 3);
}

function ensureToolCoverage(state: MainAgentState) {
  if (!state.toolSelection) return;

  const selectedSet = new Set<ToolName>(state.toolSelection.toolQueue);

  if (state.iterationCount === 1) {
    // First iteration must run ALL generation tools regardless of LLM selection.
    state.toolSelection.toolQueue = [...FULL_GENERATION_TOOL_ORDER];
    return;
  }

  const repairTargets = new Set<ToolName>((state.repairPlan?.selectedTargets ?? []).map((item) => item.toolName));
  if (repairTargets.size === 0) return;

  // Cascade to downstream dependents: if a tool is being repaired, its direct downstream
  // consumers should also be re-run to maintain consistency.
  const downstreamMap: Record<string, ToolName[]> = {
    story_tool: ["character_tool", "copywriting_tool"],
    character_tool: ["asset_manifest_tool", "copywriting_tool"],
    scene_design_tool: ["ui_architecture_tool", "asset_manifest_tool", "layout_tool"],
    ui_architecture_tool: ["asset_manifest_tool", "layout_tool"],
    asset_manifest_tool: ["copywriting_tool", "layout_tool"],
    copywriting_tool: ["timeline_tool"],
    layout_tool: ["timeline_tool"],
  };
  for (const target of [...repairTargets]) {
    for (const downstream of (downstreamMap[target] ?? [])) {
      repairTargets.add(downstream);
    }
  }

  if (["scene_design_tool", "ui_architecture_tool", "character_tool", "asset_manifest_tool"].some((tool) => repairTargets.has(tool as ToolName))) {
    repairTargets.add("layout_tool");
  }
  if (["story_tool", "copywriting_tool", "layout_tool"].some((tool) => repairTargets.has(tool as ToolName))) {
    repairTargets.add("timeline_tool");
  }

  const repairedQueue = [...state.toolSelection.toolQueue];
  for (const tool of FULL_GENERATION_TOOL_ORDER) {
    if (repairTargets.has(tool) && !selectedSet.has(tool)) {
      repairedQueue.push(tool);
    }
  }
  state.toolSelection.toolQueue = repairedQueue;
}

function summarizeOutput(tool: ToolName, output: unknown) {
  switch (tool) {
    case "gameplay_tool":
      return (output as GameplayStructure).oneSentenceLoop;
    case "economy_tool":
      return (output as EconomyDesign).orderCostLoop;
    case "system_design_tool":
      return (output as SystemDesign).systemOverview;
    case "proposal_tool":
      return (output as GameProposal).solutionName;
    case "scene_design_tool":
      return (output as SceneDesign).sceneConcept;
    case "ui_architecture_tool":
      return `定义 ${((output as UIInformationArchitecture).topBar?.length ?? 0) + ((output as UIInformationArchitecture).orderPanel?.length ?? 0)} 项核心界面结构`;
    case "story_tool":
      return (output as StoryResult).storyPositioning;
    case "character_tool":
      return `生成 ${(output as CharacterCard[]).length} 张角色资料卡`;
    case "asset_manifest_tool":
      return `生成 ${(output as AssetManifest).assetGroups.length} 项素材定义`;
    case "copywriting_tool":
      return `生成 ${((output as CopywritingPack).buttonLabels?.length ?? 0) + ((output as CopywritingPack).characterLines?.length ?? 0)} 条核心页面文案`;
    case "layout_tool":
      return `映射 ${((output as { layoutConfig: LayoutConfigInput }).layoutConfig?.scenes.length ?? 0)} 个布局场景`;
    case "timeline_tool":
      return `生成 ${((output as { timelineConfig: TimelineConfigInput }).timelineConfig?.timelines.length ?? 0)} 条运行时时间线`;
    default:
      return "已完成当前节点输出。";
  }
}

function createToolExecutors(params: RunMainAgentParams, state: MainAgentState): ToolExecutorMap {
  const genreProfile = getGenreProfile(params.persona.targetGenre);
  return {
    gameplay_tool: async () => {
      state.gameplay = await runGameplayTool(params.persona, state.plan!, state.iterationCount, {
        sessionId: params.sessionId,
        runId: params.runId,
        iteration: state.iterationCount,
        langfuseParent: params.langfuseParent,
      }, state.repairPlan, state.gameplay);
      return state.gameplay;
    },
    economy_tool: async () => {
      state.economy = await runEconomyTool(params.persona, state.plan!, state.gameplay!, state.iterationCount, {
        sessionId: params.sessionId,
        runId: params.runId,
        iteration: state.iterationCount,
        langfuseParent: params.langfuseParent,
      }, state.repairPlan, genreProfile, state.economy);
      return state.economy;
    },
    system_design_tool: async () => {
      state.systems = await runSystemDesignTool(params.persona, state.plan!, state.gameplay!, state.economy, state.iterationCount, {
        sessionId: params.sessionId,
        runId: params.runId,
        iteration: state.iterationCount,
        langfuseParent: params.langfuseParent,
      }, state.repairPlan, genreProfile, state.systems);
      return state.systems;
    },
    proposal_tool: async () => {
      state.proposal = await runProposalTool(params.persona, state.plan!, state.gameplay!, state.economy!, state.systems!, state.iterationCount, {
        sessionId: params.sessionId,
        runId: params.runId,
        iteration: state.iterationCount,
        langfuseParent: params.langfuseParent,
      }, state.repairPlan, state.proposal);
      return state.proposal;
    },
    scene_design_tool: async () => {
      state.scene = await runSceneTool(params.persona, state.plan!, state.gameplay!, state.systems!, state.proposal!, state.iterationCount, {
        sessionId: params.sessionId,
        runId: params.runId,
        iteration: state.iterationCount,
        langfuseParent: params.langfuseParent,
      }, state.repairPlan, state.scene, buildSceneRepairFocus(state.consistencyReport), genreProfile);
      return state.scene;
    },
    ui_architecture_tool: async () => {
      state.ui = await runUiTool(params.persona, state.plan!, state.systems!, state.scene!, state.iterationCount, {
        sessionId: params.sessionId,
        runId: params.runId,
        iteration: state.iterationCount,
        langfuseParent: params.langfuseParent,
      }, state.repairPlan, genreProfile, state.ui);
      return state.ui;
    },
    story_tool: async () => {
      state.story = await runStoryTool(params.persona, state.plan!, state.proposal!, state.systems!, state.iterationCount, {
        sessionId: params.sessionId,
        runId: params.runId,
        iteration: state.iterationCount,
        langfuseParent: params.langfuseParent,
      }, state.repairPlan, state.story);
      return state.story;
    },
    character_tool: async () => {
      state.characterCards = await runCharacterTool(params.persona, state.plan!, state.systems!, state.story!, state.iterationCount, {
        sessionId: params.sessionId,
        runId: params.runId,
        iteration: state.iterationCount,
        langfuseParent: params.langfuseParent,
      }, state.repairPlan, state.characterCards);
      return state.characterCards;
    },
    asset_manifest_tool: async () => {
      state.assetManifest = await runAssetManifestTool(
        params.persona,
        state.plan!,
        state.proposal!,
        state.economy!,
        state.scene!,
        state.ui!,
        state.story!,
        state.characterCards!,
        state.iterationCount,
        {
          sessionId: params.sessionId,
          runId: params.runId,
          iteration: state.iterationCount,
          langfuseParent: params.langfuseParent,
        },
        state.repairPlan,
        state.assetManifest,
      );
      return state.assetManifest;
    },
    copywriting_tool: async () => {
      state.copywriting = await runCopywritingTool(
        params.persona,
        state.plan!,
        state.proposal!,
        state.economy!,
        state.scene!,
        state.ui!,
        state.story!,
        state.characterCards!,
        state.assetManifest!,
        state.iterationCount,
        {
          sessionId: params.sessionId,
          runId: params.runId,
          iteration: state.iterationCount,
          langfuseParent: params.langfuseParent,
        },
        state.repairPlan,
        state.copywriting,
      );
      return state.copywriting;
    },
    layout_tool: async () => {
      const creativePack = createCreativePack(state);
      if (!state.proposal || !creativePack) {
        throw new Error("layout_tool requires proposal and a complete creative pack.");
      }
      const { layoutConfig, interactionConfig, sceneDefinitions } = runLayoutTool(params.persona, state.proposal, creativePack);
      state.sceneDefinitions = sceneDefinitions;
      state.interactionConfig = interactionConfig;
      state.layoutConfig = layoutConfig;
      return { layoutConfig, interactionConfig, sceneDefinitions };
    },
    timeline_tool: async () => {
      const creativePack = createCreativePack(state);
      if (!state.proposal || !creativePack) {
        throw new Error("timeline_tool requires proposal and a complete creative pack.");
      }
      const { html5Projection, timelineConfig, lightingRenderConfig } = runTimelineTool(params.persona, state.proposal, creativePack);
      state.timelineConfig = timelineConfig;
      state.lightingRenderConfig = lightingRenderConfig;
      state.html5Preparation = html5Projection;
      return { timelineConfig, lightingRenderConfig, html5Projection };
    },
  };
}

async function executeTool(params: RunMainAgentParams, state: MainAgentState, executors: ToolExecutorMap, tool: ToolName) {
  if (!canRunTool(state, tool)) {
    const toolConfig = TOOL_EXECUTION_CONFIG[tool];
    console.warn(`[executeTool] ${tool} 跳过：依赖未就绪。`);
    emit(params, {
      type: "node",
      node: tool,
      phase: "工具",
      title: toolConfig.title,
      status: "fallback",
      iteration: state.iterationCount,
      summary: `工具跳过（依赖未就绪，将由修复循环补齐）`,
      output: null,
    });
    return null;
  }
  const toolConfig = TOOL_EXECUTION_CONFIG[tool];
  emitRunningNode(params, state, tool, "工具", toolConfig.title, toolConfig.summary);
  try {
    const output = await executors[tool]();
    const status = resolveNodeStatus(params.runId, tool, state.iterationCount);
    emit(params, {
      type: "node",
      node: tool,
      phase: "工具",
      title: toolConfig.title,
      status: status.status,
      iteration: state.iterationCount,
      summary: status.error ?? summarizeOutput(tool, output),
      output,
    });
    return output;
  } catch (toolError) {
    const msg = toolError instanceof Error ? toolError.message : String(toolError);
    console.warn(`[executeTool] ${tool} 执行失败，标记为 soft-fail 并交由一致性修复处理：${msg.slice(0, 200)}`);
    emit(params, {
      type: "node",
      node: tool,
      phase: "工具",
      title: toolConfig.title,
      status: "fallback",
      iteration: state.iterationCount,
      summary: `工具执行失败（将由修复循环重试）：${msg.slice(0, 120)}`,
      output: null,
    });
    return null;
  }
}

async function runLocalConsistencyLoop(
  params: RunMainAgentParams,
  state: MainAgentState,
  executors: ToolExecutorMap,
  triggerTool: ToolName,
) {
  const localRepairLimit = Math.max(1, Number(process.env.MAX_LOCAL_REPAIR_ITERATIONS || "4"));
  let localRepairCount = 0;
  let previousDecision: LocalRepairDecision | null = null;
  const repairAttemptHistory: RepairAttemptRecord[] = [];
  // Track consecutive no-progress rounds for early termination
  let prevFailedEdgeSignature = "";
  let noProgressStreak = 0;
  let edgesToCheck = discoverEdgesTriggeredByTool(triggerTool, getResolvedToolsFromState(state)).map((edge) => edge.edgeId);

  while (edgesToCheck.length > 0) {
    const artifacts = buildConsistencyArtifactsFromState(state, params.persona.targetGenre);
    const ruleEdges = buildRuleConsistencyGraphForArtifacts(artifacts, edgesToCheck);
    if (ruleEdges.length === 0) {
      return;
    }

    const relatedTools = collectRelatedToolsForEdges(ruleEdges, triggerTool);
    const artifactContext = buildLocalArtifactContext(state, triggerTool, relatedTools);

    const ruleSummary = `检查 ${ruleEdges.length} 条当前可用边。`;
    emit(params, {
      type: "node",
      node: `local_rule_check_${triggerTool}`,
      phase: "反馈",
      title: `${TOOL_TITLE[triggerTool]}后局部规则检查`,
      status: ruleEdges.some((edge) => !edge.pass && edge.level === "hard") ? "fallback" : "done",
      iteration: state.iterationCount,
      summary: ruleSummary,
      output: ruleEdges,
    });

    let semanticReview: Awaited<ReturnType<typeof runLocalSemanticConsistencyTool>>;
    try {
      semanticReview = await runLocalSemanticConsistencyTool(
        params.persona,
        triggerTool,
        artifactContext,
        ruleEdges,
        {
          sessionId: params.sessionId,
          runId: params.runId,
          iteration: state.iterationCount,
          langfuseParent: params.langfuseParent,
        },
      );
    } catch (semanticError) {
      const msg = semanticError instanceof Error ? semanticError.message : String(semanticError);
      console.warn(`[runLocalConsistencyLoop] ${TOOL_TITLE[triggerTool]} 局部语义检查失败（${msg.slice(0, 120)}），降级为仅规则检查。`);
      semanticReview = {
        edges: ruleEdges.map((edge) => ({ ...edge, pass: true, severity: "low" as const, issues: [], evidence: edge.evidence ?? [], involvedTools: edge.involvedTools ?? [edge.sourceTool, edge.targetTool], problemLocationHints: edge.problemLocationHints ?? [] })),
        summary: `局部语义检查因超时跳过，仅使用规则检查结果。(${msg.slice(0, 80)})`,
      };
      emit(params, {
        type: "node",
        node: `local_semantic_check_${triggerTool}`,
        phase: "反馈",
        title: `${TOOL_TITLE[triggerTool]}后局部语义检查`,
        status: "fallback",
        iteration: state.iterationCount,
        summary: `语义检查超时降级：${msg.slice(0, 100)}`,
        output: null,
      });
    }

    if (!semanticReview.summary.startsWith("局部语义检查因超时")) {
      emit(params, {
        type: "node",
        node: `local_semantic_check_${triggerTool}`,
        phase: "反馈",
        title: `${TOOL_TITLE[triggerTool]}后局部语义检查`,
        status: resolveNodeStatus(params.runId, "local_semantic_consistency_tool", state.iterationCount).status,
        iteration: state.iterationCount,
        summary: semanticReview.summary,
        output: semanticReview,
      });
    }

    const localReport = buildLocalConsistencyReport(
      ruleEdges,
      semanticReview.edges,
      `${TOOL_TITLE[triggerTool]} 完成后，Agent 对当前已具备条件的约束边做局部检查。`,
    );

    // Back-fill the previous attempt's outcome now that we have the new consistency check
    if (repairAttemptHistory.length > 0) {
      const prevAttempt = repairAttemptHistory[repairAttemptHistory.length - 1];
      if (prevAttempt.stillFailedEdges.length === 0) {
        prevAttempt.stillFailedEdges = localReport.hardFailures.map((edge) => edge.edgeId);
        prevAttempt.remainingIssues = localReport.hardFailures.flatMap((edge) => edge.issues).slice(0, 6);
        prevAttempt.changeSummary = localReport.globalPass
          ? "修复成功，所有边通过"
          : `修复后仍有 ${localReport.hardFailures.length} 条边失败: ${localReport.hardFailures.map((e) => e.edgeId).join(", ")}`;
      }
    }
    state.consistencyReport = localReport;
    state.consistency = legacyConsistencyFromReport(localReport);
    state.consistencyCheckpoints.push({
      triggerTool,
      availableEdges: edgesToCheck,
      checkedEdges: ruleEdges.map((edge) => edge.edgeId),
      hardFailureEdges: localReport.hardFailures.map((edge) => edge.edgeId),
      softWarningEdges: localReport.softWarnings.map((edge) => edge.edgeId),
      localRepairCount,
      globalRepairCount: state.globalRepairCount,
      summary: localReport.summary,
    });

    emit(params, {
      type: "node",
      node: `local_consistency_report_${triggerTool}`,
      phase: "反馈",
      title: `${TOOL_TITLE[triggerTool]}后局部一致性报告`,
      status: localReport.globalPass ? "done" : "fallback",
      iteration: state.iterationCount,
      summary: localReport.summary,
      output: localReport,
    });

    if (localReport.globalPass) {
      return;
    }

    // No-progress early termination: if the exact same edges keep failing, stop early
    const currentFailedEdgeSignature = localReport.hardFailures
      .map((edge) => edge.edgeId)
      .sort()
      .join(",");
    if (currentFailedEdgeSignature === prevFailedEdgeSignature) {
      noProgressStreak += 1;
    } else {
      noProgressStreak = 0;
      prevFailedEdgeSignature = currentFailedEdgeSignature;
    }
    if (noProgressStreak >= 2) {
      console.warn(`${TOOL_TITLE[triggerTool]} 局部修复连续 ${noProgressStreak} 轮无进展（失败边不变: ${currentFailedEdgeSignature}），提前终止交由全局处理。`);
      return;
    }

    if (localRepairCount >= localRepairLimit) {
      console.warn(`${TOOL_TITLE[triggerTool]} 局部返修已达 ${localRepairLimit} 次，仍存在未通过边：${localReport.hardFailures.map((edge) => edge.edgeId).join(", ")}。将交由全局评估处理。`);
      return;
    }

    let decision: Awaited<ReturnType<typeof runLocalRepairDecisionTool>>;
    try {
      decision = await runLocalRepairDecisionTool(
        params.persona,
        triggerTool,
        artifactContext,
        localReport,
        localRepairCount,
        state.globalRepairCount,
        {
          sessionId: params.sessionId,
          runId: params.runId,
          iteration: state.iterationCount,
          langfuseParent: params.langfuseParent,
        },
        previousDecision,
        repairAttemptHistory,
      );
    } catch (decisionError) {
      const msg = decisionError instanceof Error ? decisionError.message : String(decisionError);
      console.warn(`[runLocalConsistencyLoop] ${TOOL_TITLE[triggerTool]} 局部返修决策失败（${msg.slice(0, 120)}），跳过本轮返修交由全局处理。`);
      return;
    }

    emit(params, {
      type: "node",
      node: `local_repair_decision_${triggerTool}`,
      phase: "反馈",
      title: `${TOOL_TITLE[triggerTool]}后局部返修决策`,
      status: decision.shouldRepairNow ? "fallback" : "done",
      iteration: state.iterationCount,
      summary: decision.rationale,
      output: decision,
    });

    let runnableSelectedTargets = sanitizeLocalRepairTargets(state, localReport, decision.selectedTargets);

    // Multi-tool coalescing: when the same edges keep failing (noProgressStreak >= 1),
    // force ALL involved tools from the stuck edges into the repair targets. This prevents
    // the ping-pong pattern where two tools alternate without converging (e.g. system_scene).
    if (noProgressStreak >= 1 && prevFailedEdgeSignature) {
      const stuckEdgeIds = new Set(prevFailedEdgeSignature.split(","));
      const allInvolvedTools = localReport.hardFailures
        .filter((e) => stuckEdgeIds.has(e.edgeId))
        .flatMap((e) => e.involvedTools);
      const runnableSet = new Set(runnableSelectedTargets);
      for (const tool of allInvolvedTools) {
        if (!runnableSet.has(tool) && canRunTool(state, tool)) {
          runnableSelectedTargets.push(tool);
          runnableSet.add(tool);
        }
      }
      runnableSelectedTargets = sortToolsByExecutionOrder(runnableSelectedTargets).slice(0, 4);
      console.warn(`[runLocalConsistencyLoop] ${TOOL_TITLE[triggerTool]} 检测到修复乒乓，强制合并修复工具集: ${runnableSelectedTargets.join(", ")}`);
    }

    previousDecision = {
      ...decision,
      selectedTargets: runnableSelectedTargets,
    };
    if (!decision.shouldRepairNow || runnableSelectedTargets.length === 0) {
      if (!localReport.globalPass) {
        console.warn(`[runLocalConsistencyLoop] ${TOOL_TITLE[triggerTool]} 局部一致性未通过，Agent 选择继续但未给出可执行返修目标。将交由全局评估处理。`);
      }
      return;
    }

    state.repairPlan = buildLocalRepairPlan({ ...decision, selectedTargets: runnableSelectedTargets }, localReport);

    // Attach repair history to the plan so prompt builders can render it
    const planWithHistory = state.repairPlan as RepairPlanWithHistory;
    planWithHistory._repairAttemptHistory = [...repairAttemptHistory];
    planWithHistory._currentAttempt = localRepairCount + 1;
    planWithHistory._maxAttempts = localRepairLimit;

    emit(params, { type: "repair_plan", repairPlan: state.repairPlan });
    localRepairCount += 1;
    state.globalRepairCount += 1;
    state.iterationCount += 1;

    // Snapshot which edges are targeted and what the goal is before executing
    const targetEdgesBefore = state.repairPlan.recheckEdges.slice();
    const repairGoalBefore = state.repairPlan.repairGoal;
    const repairedTools: string[] = [];

    for (const repairTool of sortToolsByExecutionOrder(state.repairPlan.selectedTargets.map((item) => item.toolName))) {
      await executeTool(params, state, executors, repairTool);
      repairedTools.push(repairTool);
    }

    // Record this attempt for next iteration's repair memory
    // (We'll fill stillFailedEdges + remainingIssues on the NEXT loop iteration's consistency check)
    repairAttemptHistory.push({
      attemptNumber: localRepairCount,
      repairedTool: repairedTools.join(", "),
      targetEdges: targetEdgesBefore,
      repairGoal: repairGoalBefore,
      stillFailedEdges: [], // filled after next consistency check
      remainingIssues: [], // filled after next consistency check
      changeSummary: `第${localRepairCount}次修复执行了工具: ${repairedTools.join(", ")}`,
    });

    // Tag repair iteration in Langfuse for observability
    tagRepairIteration({
      traceId: params.langfuseParent ? undefined : params.runId,
      runId: params.runId,
      sessionId: params.sessionId,
      triggerTool,
      localRepairCount,
      failedEdges: targetEdgesBefore,
      repairGoal: repairGoalBefore,
    });

    edgesToCheck = Array.from(
      new Set([
        ...decision.recheckEdges,
        ...discoverCheckableEdges(getResolvedToolsFromState(state), {
          onlyAffectedTools: [triggerTool, ...runnableSelectedTargets],
        }).map((edge) => edge.edgeId),
      ]),
    );
  }
}

export async function runMainAgent(params: RunMainAgentParams): Promise<MainAgentState> {
  const maxIterations = Math.max(1, Number(process.env.MAX_AGENT_REPAIR_ITERATIONS || "5"));
  const state: MainAgentState = {
    sessionId: params.sessionId,
    runId: params.runId,
    persona: params.persona,
    messages: [],
    intent: null,
    plan: null,
    toolSelection: null,
    gameplay: null,
    economy: null,
    systems: null,
    proposal: null,
    scene: null,
    ui: null,
    story: null,
    characterCards: null,
    assetManifest: null,
    copywriting: null,
    sceneDefinitions: null,
    interactionConfig: null,
    layoutConfig: null,
    timelineConfig: null,
    lightingRenderConfig: null,
    html5Preparation: null,
    consistency: null,
    consistencyReport: null,
    evaluation: null,
    reviewHistory: [],
    verification: null,
    repairPlan: null,
    globalRepairCount: 0,
    consistencyCheckpoints: [],
    iterationCount: 1,
    maxIterations,
    finalResult: null,
  };

  const perceiveLog = createSystemNodeLog(params, state, "perceive_input", "感知", "感知输入", { persona: params.persona });
  finalizeDebugLog(perceiveLog, {
    parsedResult: { persona: params.persona },
    rawContent: "已读取项目简报。",
    fallbackUsed: false,
  });
  appendMessage(state, "system", "主 Agent 已读取项目简报。");
  emit(params, {
    type: "node",
    node: "perceive_input",
    phase: "感知",
    title: "感知输入",
    status: "done",
    iteration: state.iterationCount,
    summary: "已读取项目简报。",
    output: { persona: params.persona },
  });

  // ── Global repair & tool-augmentation loop ──────────────────────────────
  // Iteration 1: run all 12 tools via ensureToolCoverage.
  // Iteration 2+: only re-run repair targets + downstream cascade,
  //               preserving correct prior results via previousBaseline.
  while (state.iterationCount <= state.maxIterations) {

  const repairContext = reviewContextText(state);

  emitRunningNode(params, state, "intent_recognition", "感知", "意图识别", "正在理解这一轮真正要解决的问题。");
  state.intent = await runIntentTool(params.persona, {
    sessionId: params.sessionId,
    runId: params.runId,
    iteration: state.iterationCount,
    langfuseParent: params.langfuseParent,
  }, repairContext);
  emit(params, {
    type: "node",
    node: "intent_recognition",
    phase: "感知",
    title: "意图识别",
    status: resolveNodeStatus(params.runId, "intent_recognition", state.iterationCount).status,
    iteration: state.iterationCount,
    summary: state.intent.taskDefinition,
    output: state.intent,
  });

  emitRunningNode(params, state, "planning", "规划", "规划拆解", "正在制定本轮任务拆分与并发计划。");
  state.plan = await runPlanningTool(params.persona, state.intent, {
    sessionId: params.sessionId,
    runId: params.runId,
    iteration: state.iterationCount,
    langfuseParent: params.langfuseParent,
  }, repairContext);
  emit(params, {
    type: "node",
    node: "planning",
    phase: "规划",
    title: "规划拆解",
    status: resolveNodeStatus(params.runId, "planning", state.iterationCount).status,
    iteration: state.iterationCount,
    summary: state.plan.nextDecision,
    output: state.plan,
  });
  emit(params, { type: "plan", plan: state.plan });

  emitRunningNode(params, state, "tool_selection", "规划", "工具选择", "正在自主决定本轮最小必要工具集。");
  state.toolSelection = await runToolSelectionTool(
    params.persona,
    state.intent,
    state.plan,
    state.iterationCount,
    {
      sessionId: params.sessionId,
      runId: params.runId,
      iteration: state.iterationCount,
      langfuseParent: params.langfuseParent,
    },
    state.repairPlan,
  );
  ensureToolCoverage(state);
  emit(params, {
    type: "node",
    node: "tool_selection",
    phase: "规划",
    title: "工具选择",
    status: resolveNodeStatus(params.runId, "tool_selection", state.iterationCount).status,
    iteration: state.iterationCount,
    summary: state.toolSelection.toolQueue.join(" -> "),
    output: state.toolSelection,
  });

  const executors = createToolExecutors(params, state);
  const plannedQueue = sortToolsByExecutionOrder(state.toolSelection.toolQueue);
  for (const tool of plannedQueue) {
    await executeTool(params, state, executors, tool);
    await runLocalConsistencyLoop(params, state, executors, tool);
  }

  // Emit phase contract checks
  const phaseArtifacts: AgentPhaseArtifacts = {
    gameplay: state.gameplay,
    economy: state.economy,
    systems: state.systems,
    proposal: state.proposal,
    scene: state.scene,
    ui: state.ui,
    story: state.story,
    characterCards: state.characterCards,
    assetManifest: state.assetManifest,
    copywriting: state.copywriting,
    sceneDefinitions: state.sceneDefinitions,
    interactionConfig: state.interactionConfig,
    layoutConfig: state.layoutConfig,
    timelineConfig: state.timelineConfig,
    lightingRenderConfig: state.lightingRenderConfig,
    html5Preparation: state.html5Preparation,
  };
  const phaseChecks = validateAllPhaseContracts(phaseArtifacts);
  for (const check of phaseChecks) {
    emit(params, { type: "phase_contract", contract: check });
  }

  const creativePack = createCreativePack(state);
  if (!state.proposal || !creativePack) {
    throw new Error("主 Agent 未能组装完整设计包。");
  }
  emit(params, { type: "generation", generation: { proposal: state.proposal, creativePack } });

  const ruleLog = createSystemNodeLog(params, state, "rule_consistency_check", "反馈", "规则一致性检查", { proposal: state.proposal, creativePack });
  const ruleEdges = buildRuleConsistencyGraph(state.proposal, creativePack, state.html5Preparation, params.persona.targetGenre);
  finalizeDebugLog(ruleLog, {
    parsedResult: ruleEdges,
    rawContent: `规则层完成 ${ruleEdges.length} 条边检查。`,
    fallbackUsed: false,
  });
  emit(params, {
    type: "node",
    node: "rule_consistency_check",
    phase: "反馈",
    title: "规则一致性检查",
    status: "done",
    iteration: state.iterationCount,
    summary: `完成 ${ruleEdges.length} 条边检查`,
    output: ruleEdges,
  });

  emitRunningNode(params, state, "semantic_consistency_tool", "反馈", "语义一致性检查", "正在补充语义层的一致性判断。");
  let semanticReview: Awaited<ReturnType<typeof runSemanticConsistencyTool>>;
  try {
    semanticReview = await runSemanticConsistencyTool(
      params.persona,
      state.proposal,
      creativePack,
      ruleEdges,
      {
        sessionId: params.sessionId,
        runId: params.runId,
        iteration: state.iterationCount,
        langfuseParent: params.langfuseParent,
      },
    );
    emit(params, {
      type: "node",
      node: "semantic_consistency_tool",
      phase: "反馈",
      title: "语义一致性检查",
      status: resolveNodeStatus(params.runId, "semantic_consistency_tool", state.iterationCount).status,
      iteration: state.iterationCount,
      summary: semanticReview.summary,
      output: semanticReview,
    });
  } catch (semanticError) {
    const msg = semanticError instanceof Error ? semanticError.message : String(semanticError);
    console.warn(`[runGlobalConsistencyCheck] 全局语义检查失败（${msg.slice(0, 120)}），降级为仅规则检查。`);
    semanticReview = {
      edges: ruleEdges.map((edge) => ({ ...edge, pass: true, severity: "low" as const, issues: [], evidence: edge.evidence ?? [], involvedTools: edge.involvedTools ?? [edge.sourceTool, edge.targetTool], problemLocationHints: edge.problemLocationHints ?? [] })),
      summary: `全局语义检查因超时跳过，仅使用规则检查结果。(${msg.slice(0, 80)})`,
    };
    emit(params, {
      type: "node",
      node: "semantic_consistency_tool",
      phase: "反馈",
      title: "语义一致性检查",
      status: "fallback",
      iteration: state.iterationCount,
      summary: `语义检查超时降级：${msg.slice(0, 100)}`,
      output: null,
    });
  }

  const reportLog = createSystemNodeLog(params, state, "consistency_report", "反馈", "一致性图谱聚合", {
    ruleEdges,
    semanticEdges: semanticReview.edges,
  });
  state.consistencyReport = mergeConsistencyReports(ruleEdges, semanticReview.edges);
  state.consistency = legacyConsistencyFromReport(state.consistencyReport);
  finalizeDebugLog(reportLog, {
    parsedResult: state.consistencyReport,
    rawContent: state.consistencyReport.summary,
    fallbackUsed: !state.consistencyReport.globalPass,
  });
  emit(params, {
    type: "node",
    node: "consistency_report",
    phase: "反馈",
    title: "一致性图谱聚合",
    status: state.consistencyReport.globalPass ? "done" : "fallback",
    iteration: state.iterationCount,
    summary: state.consistencyReport.summary,
    output: state.consistencyReport,
  });
  emit(params, { type: "consistency_report", report: state.consistencyReport });

  emitRunningNode(params, state, "evaluation_tool", "反馈", "评估工具", "正在从当前原型可执行性角度评审设计包。");
  state.evaluation = await evaluateProposal(
    params.persona,
    state.proposal,
    creativePack,
    state.plan,
    state.consistency,
    {
      sessionId: params.sessionId,
      runId: params.runId,
      iteration: state.iterationCount,
      phase: "反馈",
      title: "评估工具",
      langfuseParent: params.langfuseParent,
    },
  );
  emit(params, {
    type: "node",
    node: "evaluation_tool",
    phase: "反馈",
    title: "评估工具",
    status: resolveNodeStatus(params.runId, "evaluate", state.iterationCount).status,
    iteration: state.iterationCount,
    summary: `${state.evaluation.decision} / ${state.evaluation.totalScore} 分`,
    output: state.evaluation,
  });
  emit(params, { type: "evaluation", evaluation: state.evaluation });

  emitRunningNode(params, state, "verification", "反馈", "验证节点", "正在决定当前结果是否可以结束。");
  state.verification = await runVerificationTool(
    params.persona,
    state.intent,
    state.plan,
    state.proposal,
    state.evaluation,
    state.consistency,
    state.iterationCount,
    {
      sessionId: params.sessionId,
      runId: params.runId,
      iteration: state.iterationCount,
      langfuseParent: params.langfuseParent,
    },
  );
  emit(params, {
    type: "node",
    node: "verification",
    phase: "反馈",
    title: "验证节点",
    status: state.verification.needsRepair ? "fallback" : "done",
    iteration: state.iterationCount,
    summary: state.verification.summary,
    output: state.verification,
  });

  recordReview(state);
  emit(params, { type: "review_history", history: state.reviewHistory });

  // ── Global loop exit / continue decision ──
  if (!state.verification?.needsRepair || state.iterationCount >= state.maxIterations) {
    break;
  }

  // Build global repair plan for next iteration
  emitRunningNode(params, state, "repair_tool", "反馈", "全局返修规划", "正在根据评估与一致性结果规划下一轮修缮工具。");
  state.repairPlan = await runRepairTool(
    params.persona,
    state.intent!,
    state.plan!,
    state.proposal!,
    state.evaluation!,
    state.consistency!,
    state.verification,
    {
      sessionId: params.sessionId,
      runId: params.runId,
      iteration: state.iterationCount,
      langfuseParent: params.langfuseParent,
    },
  );
  emit(params, { type: "repair_plan", repairPlan: state.repairPlan });
  emit(params, {
    type: "node",
    node: "repair_tool",
    phase: "反馈",
    title: "全局返修规划",
    status: "done",
    iteration: state.iterationCount,
    summary: `修缮目标：${state.repairPlan.repairTools.join(", ")}`,
    output: state.repairPlan,
  });

  state.iterationCount += 1;
  state.globalRepairCount += 1;
  console.log(`[runMainAgent] 进入第 ${state.iterationCount} 轮全局修缮迭代。修缮工具：${state.repairPlan.repairTools.join(", ")}`);

  } // end while (global repair loop)

  const finalCreativePack = createCreativePack(state);
  state.finalResult = {
    proposal: state.proposal,
    creativePack: finalCreativePack,
    html5Preparation: state.html5Preparation,
    evaluation: state.evaluation,
    reviewHistory: state.reviewHistory,
    consistencyReport: state.consistencyReport,
  };

  const finalizeLog = createSystemNodeLog(params, state, "finalize", "结束", "最终输出", state.finalResult);
  finalizeDebugLog(finalizeLog, {
    parsedResult: state.finalResult,
    rawContent: "主 Agent 已完成最终组装并结束。",
    fallbackUsed: false,
  });
  emit(params, {
    type: "node",
    node: "finalize",
    phase: "结束",
    title: "最终输出",
    status: "done",
    iteration: state.iterationCount,
    summary: "主 Agent 已完成最终组装并结束。",
    output: state.finalResult,
  });
  if (state.finalResult.html5Preparation) {
    emit(params, { type: "html5_preparation", html5Preparation: state.finalResult.html5Preparation });
  }
  emit(params, { type: "review_history", history: state.reviewHistory });

  return state;
}

