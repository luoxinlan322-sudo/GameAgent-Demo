import type { LangfuseObservation } from "@langfuse/tracing";
import { getBaseURL, getModelName, getOpenAIClient, getProviderExtraBody } from "./openai";
import { runStructuredChat } from "./qwen-chat";
import {
  buildConsistencyAwareRepairPlanPrompt,
  buildLocalRepairDecisionPrompt,
  buildLocalSemanticConsistencyPrompt,
  buildSemanticConsistencyPrompt,
} from "./consistency-prompts";
import {
  ConsistencySemanticReviewSchema,
  LocalRepairDecisionSchema,
  RepairPlanSchema,
  type ConsistencyEdgeResult,
  type ConsistencyReport,
  type ConsistencySemanticReview,
  type LocalRepairDecision,
  type RepairPlan,
} from "./agent-consistency-schemas";
import type { AgentPlan, ConsistencyEdgeId, CreativePack, GameProposal, IntentAnalysis, PersonaInput, ToolName } from "./schemas";

type ToolContext = {
  sessionId: string;
  runId: string;
  iteration: number;
  langfuseParent?: LangfuseObservation;
};

type ToolErrorWithLog = Error & { logEntry?: unknown };

function getEdgeRepairLimit() {
  return Math.max(1, Number(process.env.MAX_EDGE_REPAIR_ATTEMPTS || "5"));
}

function getRepairTargetLimit() {
  return Math.max(1, Math.min(3, Number(process.env.MAX_REPAIR_TARGETS || "3")));
}

function countEdgeFailures(reviewHistory: unknown, edgeId: ConsistencyEdgeId) {
  if (!Array.isArray(reviewHistory)) return 0;
  return reviewHistory.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const failedEdges = (item as { failedEdges?: unknown }).failedEdges;
    return Array.isArray(failedEdges) && failedEdges.includes(edgeId);
  }).length;
}

function shouldUseStaticFallbacks() {
  return process.env.ENABLE_STATIC_FALLBACKS === "true";
}

function getCandidatePriorityMap(consistencyReport: ConsistencyReport) {
  return new Map(consistencyReport.repairCandidates.map((candidate) => [candidate.toolName, candidate.priority] as const));
}

function buildFocusedRecheckEdges(selectedTargets: RepairPlan["selectedTargets"], fallbackEdges: RepairPlan["recheckEdges"] = []) {
  return Array.from(
    new Set([
      ...selectedTargets.flatMap((item) => item.relatedTaskEdges),
      ...fallbackEdges,
    ]),
  ).slice(0, 12) as RepairPlan["recheckEdges"];
}

function prioritizeRepairTargets(
  targets: RepairPlan["selectedTargets"],
  consistencyReport: ConsistencyReport,
) {
  const priorityMap = getCandidatePriorityMap(consistencyReport);
  const merged = Array.from(
    new Map(
      targets.map((target) => [
        target.toolName,
        {
          ...target,
          expectedImpact: Array.from(new Set(target.expectedImpact)).slice(0, 6),
          relatedTaskEdges: Array.from(new Set(target.relatedTaskEdges)).slice(0, 8) as RepairPlan["selectedTargets"][number]["relatedTaskEdges"],
        },
      ]),
    ).values(),
  ).sort((a, b) => (priorityMap.get(b.toolName) ?? 0) - (priorityMap.get(a.toolName) ?? 0));

  return merged.slice(0, getRepairTargetLimit());
}

function focusRepairPlan(plan: RepairPlan, consistencyReport: ConsistencyReport): RepairPlan {
  const selectedTargets = prioritizeRepairTargets(plan.selectedTargets, consistencyReport);
  return {
    ...plan,
    selectedTargets,
    repairTools: selectedTargets.map((item) => item.toolName).slice(0, 8),
    recheckEdges: buildFocusedRecheckEdges(selectedTargets, plan.recheckEdges),
    expectedImprovements: Array.from(new Set(selectedTargets.flatMap((item) => item.expectedImpact).concat(plan.stopConditions))).slice(0, 8),
  };
}

async function runSchemaTool<T>(params: {
  prompt: string;
  schema: Parameters<typeof runStructuredChat>[0]["schema"];
  schemaName: string;
  stage: string;
  requestPayload: unknown;
  debugMeta: ToolContext & { phase: string; title: string };
  fallback: T;
  timeoutMs?: number;
  maxRepairAttempts?: number;
}) {
  const client = getOpenAIClient();
  if (!client) {
    if (shouldUseStaticFallbacks()) return params.fallback;
    throw new Error(`Tool ${params.stage} failed: missing model client`);
  }

  try {
    const result = await runStructuredChat({
      client,
      model: getModelName(),
      baseURL: getBaseURL(),
      schema: params.schema,
      schemaName: params.schemaName,
      stage: params.stage,
      messages: [{ role: "user", content: params.prompt }],
      extraBody: getProviderExtraBody(params.stage),
      requestPayload: params.requestPayload,
      debugMeta: params.debugMeta,
      timeoutMs: params.timeoutMs ?? Number(process.env.LLM_TIMEOUT_MS || "600000"),
      maxRepairAttempts: params.maxRepairAttempts,
    });

    return result.parsed as T;
  } catch (error) {
    if (shouldUseStaticFallbacks()) return params.fallback;

    const wrapped = error instanceof Error ? error : new Error(String(error));
    const nodeError = new Error(`Tool ${params.stage} failed: ${wrapped.message}`) as ToolErrorWithLog;
    nodeError.logEntry = (error as ToolErrorWithLog).logEntry;
    throw nodeError;
  }
}

function makeSemanticPassEdge(edge: ConsistencyEdgeResult): ConsistencyEdgeResult {
  return {
    ...edge,
    pass: true,
    severity: "low",
    issues: [],
    evidence: edge.evidence ?? [],
    involvedTools: edge.involvedTools ?? [edge.sourceTool, edge.targetTool],
    problemLocationHints: edge.problemLocationHints ?? [],
  };
}

function buildRepairFallbackFromReport(consistencyReport: ConsistencyReport): RepairPlan {
  const targetLimit = getRepairTargetLimit();
  const topCandidates = consistencyReport.repairCandidates.slice(0, targetLimit);
  const taskPool =
    topCandidates.length > 0
      ? consistencyReport.repairTasks.filter((task) => task.candidateTools.some((toolName) => topCandidates.some((candidate) => candidate.toolName === toolName)))
      : consistencyReport.repairTasks.slice(0, targetLimit + 1);
  const selectedTargets = taskPool.reduce<
    Array<{
      toolName: ToolName;
      whyThisTool: string;
      whyNotOtherTargets: string;
      costReasoning: string;
      expectedImpact: string[];
      relatedTaskEdges: ConsistencyEdgeId[];
    }>
  >((acc, task) => {
    for (const toolName of task.candidateTools) {
      const existing = acc.find((item) => item.toolName === toolName);
      if (existing) {
        existing.expectedImpact = Array.from(new Set([...existing.expectedImpact, ...task.successConditions])).slice(0, 6);
        existing.relatedTaskEdges = Array.from(new Set([...existing.relatedTaskEdges, task.edgeId])).slice(0, 8) as ConsistencyEdgeId[];
        continue;
      }

      acc.push({
        toolName,
        whyThisTool: task.whyItMatters,
        whyNotOtherTargets: "This fallback keeps the target set small and does not automatically expand to every involved tool.",
        costReasoning: "Choose the highest-frequency candidate tool first to reduce repair scope during fallback planning.",
        expectedImpact: task.successConditions.slice(0, 4),
        relatedTaskEdges: [task.edgeId as ConsistencyEdgeId],
      });

      if (acc.length >= targetLimit) break;
    }

    return acc;
  }, []);

  const rationale = consistencyReport.summary;
  const stopConditions =
    taskPool.length > 0
      ? Array.from(new Set(taskPool.flatMap((task) => task.successConditions))).slice(0, 6)
      : ["所有硬失败边复检通过。", "关键上游输出与下游承载重新对齐。"];
  const recheckEdges = Array.from(new Set(taskPool.map((task) => task.edgeId))).slice(0, 8).filter(Boolean) as RepairPlan["recheckEdges"];

  return focusRepairPlan({
    rationale,
    selectedTargets:
      selectedTargets.length > 0
        ? selectedTargets
        : [
            {
              toolName: "asset_manifest_tool",
              whyThisTool: "当前失败边无法自动归并到明确工具，先从资产承载层收敛最常见的下游问题。",
              whyNotOtherTargets: "未自动扩大到更多工具，避免 fallback 计划直接替 Agent 做决定。",
              costReasoning: "资产承载层通常能用较小改动覆盖多条下游问题，适合作为 fallback 默认值。",
              expectedImpact: ["减少关键资产缺口", "为文案与 UI 提供稳定承载"],
              relatedTaskEdges: consistencyReport.hardFailures.slice(0, 4).map((item) => item.edgeId as ConsistencyEdgeId),
            },
          ],
    stopConditions,
    recheckEdges,
    repairGoal: rationale,
    repairInstructions: "围绕失败边做局部返修，优先修复影响范围最大的上游工具，不要全量重跑。",
    repairTools: selectedTargets.map((item) => item.toolName).slice(0, 8),
    expectedImprovements: stopConditions,
    failedEdgeDetails: consistencyReport.hardFailures.slice(0, 16).map((edge) => {
      const task = consistencyReport.repairTasks.find((t) => t.edgeId === edge.edgeId);
      return {
        edgeId: edge.edgeId,
        issues: edge.issues.slice(0, 6),
        strictIdentifiers: task?.strictIdentifiers?.slice(0, 8) ?? [],
        repairSuggestions: edge.repairSuggestions?.slice(0, 4) ?? [],
      };
    }),
  }, consistencyReport);
}

function escalateRepeatedEdges(
  plan: RepairPlan,
  consistencyReport: ConsistencyReport,
  previousRepairPlan?: RepairPlan | null,
) {
  if (!previousRepairPlan) return plan;

  const previousTargets = new Set(previousRepairPlan.selectedTargets.map((item) => item.toolName));
  const repeatedEdges = consistencyReport.hardFailures
    .map((edge) => edge.edgeId)
    .filter((edgeId) => previousRepairPlan.recheckEdges.includes(edgeId));

  if (repeatedEdges.length === 0) return plan;

  return focusRepairPlan({
    ...plan,
    rationale:
      repeatedEdges.length > 0
        ? `${plan.rationale}；检测到重复失败边 ${Array.from(new Set(repeatedEdges)).join("、")}，请重新评估是否需要升级到更上游或双侧修复。`
        : plan.rationale,
    selectedTargets: plan.selectedTargets.map((target) => ({
      ...target,
      whyNotOtherTargets: `${target.whyNotOtherTargets} Repeated failures exist, but escalation should still be chosen by the agent rather than auto-expanded here.`,
    })),
    repairTools: plan.selectedTargets.map((item) => item.toolName).slice(0, 8),
    recheckEdges: Array.from(new Set([...plan.recheckEdges, ...repeatedEdges])).slice(0, 16) as RepairPlan["recheckEdges"],
  }, consistencyReport);
}

function ensureHardFailureCoverage(
  plan: RepairPlan,
  _consistencyReport: ConsistencyReport,
) {
  return plan;
}

export async function runSemanticConsistencyTool(
  brief: PersonaInput,
  proposal: GameProposal,
  creativePack: CreativePack,
  ruleEdges: ConsistencyEdgeResult[],
  ctx: ToolContext,
) {
  const fallback: ConsistencySemanticReview = {
    edges: ruleEdges
      .filter((edge) =>
        [
          "proposal_story",
          "proposal_ui",
          "economy_asset",
          "gameplay_system",
          "system_scene",
          "scene_ui",
          "story_character",
          "story_copywriting",
          "character_copywriting",
          "scene_copywriting",
          "ui_copywriting",
          "asset_copywriting",
          "economy_copywriting",
          "proposal_copywriting",
          "gameplay_copywriting",
          "system_copywriting",
        ].includes(edge.edgeId),
      )
      .map(makeSemanticPassEdge),
    summary: "未发现额外的语义一致性问题。",
  };

  return runSchemaTool<ConsistencySemanticReview>({
    prompt: buildSemanticConsistencyPrompt(brief, proposal, creativePack, ruleEdges),
    schema: ConsistencySemanticReviewSchema,
    schemaName: "semantic_consistency_review",
    stage: "semantic_consistency_tool",
    requestPayload: { brief, proposal, creativePack, ruleEdges },
    debugMeta: { ...ctx, phase: "反馈", title: "语义一致性检查" },
    fallback,
    timeoutMs: Number(process.env.SEMANTIC_CONSISTENCY_TIMEOUT_MS || "180000"),
    maxRepairAttempts: Math.min(1, Number(process.env.MAX_NODE_REPAIR_ATTEMPTS || "2")),
  });
}

export async function runLocalSemanticConsistencyTool(
  brief: PersonaInput,
  triggerTool: ToolName,
  artifactContext: unknown,
  ruleEdges: ConsistencyEdgeResult[],
  ctx: ToolContext,
) {
  const fallback: ConsistencySemanticReview = {
    edges: ruleEdges.map(makeSemanticPassEdge),
    summary: "No additional local semantic issue was found.",
  };

  return runSchemaTool<ConsistencySemanticReview>({
    prompt: buildLocalSemanticConsistencyPrompt({ brief, triggerTool, artifactContext, ruleEdges }),
    schema: ConsistencySemanticReviewSchema,
    schemaName: "local_semantic_consistency_review",
    stage: "local_semantic_consistency_tool",
    requestPayload: { brief, triggerTool, artifactContext, ruleEdges },
    debugMeta: { ...ctx, phase: "反馈", title: "局部语义一致性检查" },
    fallback,
    timeoutMs: Number(process.env.LOCAL_SEMANTIC_CONSISTENCY_TIMEOUT_MS || "90000"),
    maxRepairAttempts: 1,
  });
}

export async function runLocalRepairDecisionTool(
  brief: PersonaInput,
  triggerTool: ToolName,
  artifactContext: unknown,
  consistencyReport: ConsistencyReport,
  localRepairCount: number,
  globalRepairCount: number,
  ctx: ToolContext,
  previousDecision?: LocalRepairDecision | null,
) {
  const fallback: LocalRepairDecision = {
    shouldRepairNow: consistencyReport.hardFailures.length > 0,
    rationale:
      consistencyReport.hardFailures.length > 0
        ? "Local hard-failure edges remain and should be repaired before downstream generation."
        : "No blocking local hard-failure edge remains. Continue to the next tool.",
    successConditions: consistencyReport.repairTasks.flatMap((task) => task.successConditions).slice(0, 6),
    selectedTargets: consistencyReport.repairCandidates.slice(0, 3).map((candidate) => candidate.toolName),
    whyTheseTargets: "These tools are the highest-frequency candidates across the current failed edges.",
    whyNotOtherTargets: "Other involved tools are left untouched in fallback mode to avoid auto-expanding the repair scope.",
    costReasoning: "Fallback mode keeps the repair set small and favors the most reusable local lever.",
    expectedImpact: consistencyReport.repairTasks.flatMap((task) => task.successConditions).slice(0, 6),
    recheckEdges: consistencyReport.hardFailures.map((edge) => edge.edgeId).slice(0, 12),
  };

  return runSchemaTool<LocalRepairDecision>({
    prompt: buildLocalRepairDecisionPrompt({
      brief,
      triggerTool,
      artifactContext,
      consistencyReport,
      localRepairCount,
      globalRepairCount,
      previousDecision,
    }),
    schema: LocalRepairDecisionSchema,
    schemaName: "local_repair_decision",
    stage: "local_repair_decision_tool",
    requestPayload: {
      brief,
      triggerTool,
      artifactContext,
      consistencyReport,
      localRepairCount,
      globalRepairCount,
      previousDecision,
    },
    debugMeta: { ...ctx, phase: "反馈", title: "局部返修决策" },
    fallback,
    timeoutMs: Number(process.env.LOCAL_REPAIR_DECISION_TIMEOUT_MS || "90000"),
    maxRepairAttempts: 1,
  });
}

export async function runConsistencyAwareRepairTool(
  brief: PersonaInput,
  intent: IntentAnalysis,
  plan: AgentPlan,
  proposal: GameProposal,
  consistencyReport: ConsistencyReport,
  reviewHistory: unknown,
  previousRepairPlan: RepairPlan | null | undefined,
  ctx: ToolContext,
) {
  const edgeRepairLimit = getEdgeRepairLimit();
  const fallback = escalateRepeatedEdges(buildRepairFallbackFromReport(consistencyReport), consistencyReport, previousRepairPlan);
  const result = await runSchemaTool<RepairPlan>({
    prompt: buildConsistencyAwareRepairPlanPrompt(brief, intent, plan, proposal, consistencyReport, reviewHistory, previousRepairPlan),
    schema: RepairPlanSchema,
    schemaName: "consistency_repair_plan",
    stage: "consistency_repair_planner",
    requestPayload: { brief, intent, plan, proposal, consistencyReport, reviewHistory },
    debugMeta: { ...ctx, phase: "反馈", title: "一致性感知返修规划" },
    fallback,
    timeoutMs: Number(process.env.CONSISTENCY_REPAIR_TIMEOUT_MS || "120000"),
    maxRepairAttempts: 1,
  });

  const normalizedPlan: RepairPlan = {
    ...result,
    repairGoal: result.repairGoal ?? result.rationale,
    repairInstructions:
      result.repairInstructions ??
      "围绕失败边做局部返修，优先修复影响范围最大的上游工具，不要全量重跑。",
    repairTools: result.repairTools ?? result.selectedTargets.map((item) => item.toolName),
    expectedImprovements:
      result.expectedImprovements ??
      Array.from(new Set(result.selectedTargets.flatMap((item) => item.expectedImpact).concat(result.stopConditions))).slice(0, 8),
  };

  const focusedPlan = focusRepairPlan(normalizedPlan, consistencyReport);
  const escalatedPlan = escalateRepeatedEdges(focusedPlan, consistencyReport, previousRepairPlan);
  const coveredPlan = ensureHardFailureCoverage(escalatedPlan, consistencyReport);

  const saturatedEdges = consistencyReport.hardFailures
    .map((failure) => ({
      failure,
      attempts: countEdgeFailures(reviewHistory, failure.edgeId as ConsistencyEdgeId),
    }))
    .filter((item) => item.attempts >= edgeRepairLimit);

  if (saturatedEdges.length === 0) {
    return coveredPlan;
  }

  const expandedTargets = [...coveredPlan.selectedTargets];
  for (const { failure } of saturatedEdges) {
    for (const toolName of failure.involvedTools) {
      if (expandedTargets.some((item) => item.toolName === toolName)) continue;
      expandedTargets.push({
        toolName,
        whyThisTool: `边 ${failure.edgeId} 已连续失败多轮，达到单边返修阈值后升级为高优先级问题，需要扩大修复杠杆。`,
        whyNotOtherTargets: "Reached edge retry saturation, so this additional tool is exposed as a candidate for the next decision.",
        costReasoning: "This is a guarded escalation candidate after repeated failed retries, not an automatic mandatory repair target.",
        expectedImpact: failure.repairSuggestions.slice(0, 4).length > 0 ? failure.repairSuggestions.slice(0, 4) : ["本轮必须解除该硬失败边。"],
        relatedTaskEdges: [failure.edgeId as ConsistencyEdgeId],
      });
      if (expandedTargets.length >= 4) break;
    }
    if (expandedTargets.length >= 4) break;
  }

  return focusRepairPlan({
    ...coveredPlan,
    rationale: `${coveredPlan.rationale}；以下硬失败边已达到单边返修阈值 ${edgeRepairLimit}：${saturatedEdges
      .map((item) => item.failure.edgeId)
      .join("、")}。`,
    selectedTargets: expandedTargets,
    repairTools: expandedTargets.map((item) => item.toolName).slice(0, 8),
    recheckEdges: Array.from(
      new Set([...coveredPlan.recheckEdges, ...saturatedEdges.map((item) => item.failure.edgeId as ConsistencyEdgeId)]),
    ).slice(0, 16) as RepairPlan["recheckEdges"],
  }, consistencyReport);
}
