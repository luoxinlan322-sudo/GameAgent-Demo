import type { AgentPlan, CreativePack, GameProposal, IntentAnalysis, PersonaInput, ToolName } from "./schemas";
import type { ConsistencyEdgeResult, ConsistencyReport, LocalRepairDecision, RepairPlan, RepairAttemptRecord } from "./agent-consistency-schemas";

function jsonBlock(label: string, value: unknown) {
  return `${label}:\n${JSON.stringify(value, null, 2)}`;
}

function briefBlock(brief: PersonaInput) {
  return jsonBlock("project_brief", brief);
}

function jsonOnlyInstruction(fields: string[]) {
  return [
    "Return one valid JSON object only.",
    "Do not output markdown, explanation, code fences, or wrappers.",
    `Top-level fields must be: ${fields.join(", ")}`,
  ].join(" ");
}

function compactJson(label: string, value: unknown) {
  return `${label}:\n${JSON.stringify(value, null, 2)}`;
}

export function buildSemanticConsistencyPrompt(
  brief: PersonaInput,
  proposal: GameProposal,
  creativePack: CreativePack,
  ruleEdges: unknown,
) {
  return `
You are semantic_consistency_tool.
Your job is to add semantic consistency judgments only.
Do not repeat rule-layer checks that already validate membership, identifier existence, or missing fields.
${jsonOnlyInstruction(["edges", "summary"])}

Each item in edges must contain:
- edgeId
- sourceTool
- targetTool
- level
- pass
- severity
- issues
- evidence
- involvedTools
- problemLocationHints

Only cover these semantic edges:
- gameplay_system
- system_scene
- scene_ui
- story_character
- proposal_story
- proposal_ui
- economy_asset
- story_copywriting
- character_copywriting
- scene_copywriting
- ui_copywriting
- asset_copywriting
- economy_copywriting
- proposal_copywriting
- gameplay_copywriting
- system_copywriting

Requirements:
- Even when an edge passes semantically, return one pass=true result for that edge.
- involvedTools should list only the tools materially involved in the edge.
- problemLocationHints should explain where the issue appears to live without dictating the final repair choice.
- evidence should cite concrete upstream or downstream support only.
- Do not treat structural field absence as a semantic issue.
- Focus on:
  1. Whether systems truly serve gameplay
  2. Whether story and character outputs stay aligned
  3. Whether UI scope matches the current small-scale test
  4. Whether copy accurately carries story, character, scene, UI, asset, and economy intent

${briefBlock(brief)}
${jsonBlock("proposal", proposal)}
${jsonBlock("creative_pack", creativePack)}
${jsonBlock("rule_edges", ruleEdges)}
`.trim();
}

export function buildConsistencyAwareRepairPlanPrompt(
  brief: PersonaInput,
  intent: IntentAnalysis,
  plan: AgentPlan,
  proposal: GameProposal,
  consistencyReport: ConsistencyReport,
  reviewHistory: unknown,
  previousRepairPlan?: RepairPlan | null,
) {
  return `
You are consistency_repair_planner.
Your job is not to rerun every tool blindly.
Your job is to decide which tools should be repaired this round, why they are the highest leverage targets, and what outcome is sufficient to stop.
${jsonOnlyInstruction(["rationale", "selectedTargets", "stopConditions", "recheckEdges"])}

Each item in selectedTargets must contain:
- toolName
- whyThisTool
- whyNotOtherTargets
- costReasoning
- expectedImpact
- relatedTaskEdges

Planning rules:
- Prefer upstream tools that can resolve multiple failed edges at once.
- Select at most 4 tools.
- Select from the repair task candidateTools, not from arbitrary tools.
- If story_character and character_asset both fail, prefer character_tool first.
- If story_copywriting and character_copywriting both fail, prefer story_tool or character_tool before copywriting_tool.
- If scene_ui and ui_asset both fail, prefer ui_architecture_tool first, then scene_design_tool only if needed.
- If proposal_asset fails, prefer asset_manifest_tool first; touch proposal_tool only if necessary.
- If economy_asset and asset_copywriting fail together, prefer asset_manifest_tool or economy_tool instead of only patching copywriting_tool.
- If the same edge keeps failing across review history and the previous round already repaired a downstream tool, escalate to a more upstream tool with larger leverage.
- For layout or timeline failures, first judge whether the problem is missing upstream content or missing runtime mapping. Only repair layout_tool or timeline_tool alone when upstream content is already stable.
- Repair should satisfy success conditions, not string-match old failure text. Strict identifiers must still remain exact.

Output rules:
- rationale must explain why these targets were chosen instead of alternatives.
- whyNotOtherTargets must explain why other involved tools are not selected yet.
- costReasoning must explain the rewrite-cost and downstream-impact tradeoff.
- stopConditions must describe observable success conditions, not action steps.
- recheckEdges must only include edges directly affected by the selected targets.
- This is reason-based repair, not string-based repair.

${briefBlock(brief)}
${jsonBlock("intent", intent)}
${jsonBlock("plan", plan)}
${jsonBlock("proposal", proposal)}
${jsonBlock("consistency_report", consistencyReport)}
${jsonBlock("review_history", reviewHistory)}
${jsonBlock("previous_repair_plan", previousRepairPlan ?? null)}
`.trim();
}

export function buildLocalSemanticConsistencyPrompt(params: {
  brief: PersonaInput;
  triggerTool: ToolName;
  artifactContext: unknown;
  ruleEdges: ConsistencyEdgeResult[];
}) {
  return `
You are local_semantic_consistency_tool.
Your job is to review only the currently checkable local edges after one tool has completed.
${jsonOnlyInstruction(["edges", "summary"])}

Rules:
- Only review the edges already listed in rule_edges.
- Do not repeat structural failures already captured by rule_edges.
- Each edge result must include:
  edgeId, sourceTool, targetTool, level, pass, severity, issues, evidence, involvedTools, problemLocationHints
- Return pass=true edges when there is no semantic concern.
- problemLocationHints should diagnose likely problem locations, not prescribe repair targets.
- Focus on why the local mismatch matters for the next tool, not on global redesign.

${briefBlock(params.brief)}
${compactJson("trigger_tool", params.triggerTool)}
${compactJson("artifact_context", params.artifactContext)}
${jsonBlock("rule_edges", params.ruleEdges)}
`.trim();
}

export function buildLocalRepairDecisionPrompt(params: {
  brief: PersonaInput;
  triggerTool: ToolName;
  artifactContext: unknown;
  consistencyReport: ConsistencyReport;
  localRepairCount: number;
  globalRepairCount: number;
  previousDecision?: LocalRepairDecision | null;
  repairAttemptHistory?: RepairAttemptRecord[];
}) {
  const historyContext = params.repairAttemptHistory && params.repairAttemptHistory.length > 0
    ? `\n修复历史 (已尝试 ${params.repairAttemptHistory.length} 次):\n${params.repairAttemptHistory.slice(-3).map((a) => `  第${a.attemptNumber}次: 目标=${a.targetEdges.join(",")} → 仍失败=${a.stillFailedEdges.join(",") || "待检查"}`).join("\n")}\n如果同一边连续失败 3+ 次，考虑选择不同的修复工具或建议在全局层面解决。`
    : "";

  return `
You are local_repair_decider.
Decide whether the agent should repair immediately after the current tool, or continue.
${jsonOnlyInstruction(["shouldRepairNow", "rationale", "selectedTargets", "whyTheseTargets", "whyNotOtherTargets", "costReasoning", "successConditions", "expectedImpact", "recheckEdges"])}

Decision rules:
- Repair now when hard-failure edges would pollute downstream generation if left unresolved.
- Prefer the smallest high-leverage target set.
- selectedTargets must only contain tools named in the failed edges' involvedTools.
- Use problemLocationHints as evidence, not as commands.
- Judge targets by upstream/downstream leverage and rewrite cost.
- If a failed edge suggests entity typing, carrier responsibility, or requiresLayout classification is wrong, prefer the upstream structural tool before repeatedly patching downstream scene or layout outputs.
- successConditions must describe verifiable outcomes, not vague actions.
- recheckEdges must only include edges that should be revalidated after the local repair.
- Respect exact identifiers when they matter, but do not turn repair into string-matching.
- If the issue is only a soft warning and it does not block the next tool, you may continue.

Output guidance:
- shouldRepairNow=true when at least one hard failure should be stopped here.
- selectedTargets should usually be 1-3 tools.
- rationale should summarize the local repair choice.
- whyTheseTargets should explain why the chosen tools are the best local lever.
- whyNotOtherTargets should explain why other involved tools are not selected yet.
- costReasoning should compare repair cost and downstream impact.
- expectedImpact should describe the local outcomes expected after repair.
- Every expectedImpact item must be a standalone phrase of at least 4 characters, such as "Expose a visitor carrier in systemEntities" or "Stabilize scene carrier mapping for layout-required entities".
- Do not output empty, abbreviated, or punctuation-only expectedImpact items.

${briefBlock(params.brief)}
${compactJson("trigger_tool", params.triggerTool)}
${compactJson("local_repair_count", params.localRepairCount)}
${compactJson("global_repair_count", params.globalRepairCount)}
${compactJson("artifact_context", params.artifactContext)}
${jsonBlock("consistency_report", params.consistencyReport)}
${jsonBlock("previous_local_decision", params.previousDecision ?? null)}
${historyContext}
`.trim();
}
