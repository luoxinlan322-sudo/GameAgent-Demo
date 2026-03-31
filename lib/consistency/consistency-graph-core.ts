import type {
  ConsistencyEdgeId,
  CreativePack,
  GameProposal,
  ToolName,
} from "../schemas";
import type { Html5PreparationPackage } from "../html5-render-schemas";
import {
  ConsistencyReportSchema,
  type ConsistencyEdgeResult,
  type ConsistencyReport,
  type RepairTask,
} from "../agent-consistency-schemas";
import { ALL_CONSISTENCY_EDGES } from "../agent-execution-config";
import { type ConsistencyArtifacts } from "./consistency-edge-defs";
import {
  evaluateEdgeFromArtifacts,
  uniqueStrings,
  clampStringList,
  clampText,
  buildRepairTask,
  checkGameplayEconomy,
  checkGameplaySystem,
  checkSystemScene,
  checkSceneUi,
  checkStoryCharacter,
  checkProposalAsset,
  checkAssetCoverage,
  checkProposalStory,
  checkProposalUi,
  checkEconomyAsset,
  checkStoryCopywriting,
  checkCharacterCopywriting,
  checkSceneCopywriting,
  checkUiCopywriting,
  checkAssetCopywriting,
  checkEconomyCopywriting,
  checkProposalCopywriting,
  checkGameplayCopywriting,
  checkSystemCopywriting,
  checkSceneLayout,
  checkUiLayout,
  checkCharacterLayout,
  checkSceneInteraction,
  checkUiInteraction,
  checkStoryTimeline,
  checkCopywritingTimeline,
  checkLayoutTimeline,
  checkLayoutLighting,
} from "./consistency-checks";

export function buildRuleConsistencyGraph(proposal: GameProposal, creativePack: CreativePack, html5Preparation?: Html5PreparationPackage | null, targetGenre?: string): ConsistencyEdgeResult[] {
  return [
    checkGameplayEconomy(creativePack, targetGenre),
    checkGameplaySystem(creativePack, targetGenre),
    checkSystemScene(creativePack),
    checkSceneUi(creativePack),
    checkStoryCharacter(creativePack.story, creativePack.characters),
    checkProposalAsset(proposal, creativePack.assetManifest),
    checkAssetCoverage(creativePack, "scene"),
    checkAssetCoverage(creativePack, "ui"),
    checkAssetCoverage(creativePack, "story"),
    checkAssetCoverage(creativePack, "character"),
    checkProposalStory(proposal, creativePack.story),
    checkProposalUi(proposal, creativePack.ui),
    checkEconomyAsset(creativePack.economy, creativePack.assetManifest),
    checkStoryCopywriting(creativePack.story, creativePack.copywriting),
    checkCharacterCopywriting(creativePack.characters, creativePack.copywriting),
    checkSceneCopywriting(creativePack.scene, creativePack.copywriting),
    checkUiCopywriting(creativePack.ui, creativePack.copywriting),
    checkAssetCopywriting(creativePack.assetManifest, creativePack.copywriting),
    checkEconomyCopywriting(creativePack.economy, creativePack.copywriting),
    checkProposalCopywriting(proposal, creativePack.copywriting),
    checkGameplayCopywriting(creativePack.gameplay, creativePack.copywriting),
    checkSystemCopywriting(creativePack.systems, creativePack.copywriting),
    checkSceneLayout(creativePack.scene, html5Preparation ?? undefined),
    checkUiLayout(creativePack.ui, html5Preparation ?? undefined),
    checkCharacterLayout(creativePack.characters, html5Preparation ?? undefined),
    checkSceneInteraction(creativePack.scene, html5Preparation ?? undefined),
    checkUiInteraction(creativePack.ui, html5Preparation ?? undefined),
    checkStoryTimeline(creativePack.story, html5Preparation ?? undefined),
    checkCopywritingTimeline(creativePack.copywriting, html5Preparation ?? undefined),
    checkLayoutTimeline(html5Preparation ?? undefined),
    checkLayoutLighting(html5Preparation ?? undefined, creativePack.story),
  ];
}

export function buildRuleConsistencyGraphForEdges(proposal: GameProposal, creativePack: CreativePack, html5Preparation: Html5PreparationPackage | null | undefined, edgeIds: ConsistencyEdgeId[], targetGenre?: string) {
  const requested = new Set<ConsistencyEdgeId>(edgeIds);
  return buildRuleConsistencyGraph(proposal, creativePack, html5Preparation, targetGenre).filter((edge) => requested.has(edge.edgeId));
}

export function buildRuleConsistencyGraphForArtifacts(artifacts: ConsistencyArtifacts, edgeIds: ConsistencyEdgeId[]) {
  const requested = new Set<ConsistencyEdgeId>(edgeIds);
  return ALL_CONSISTENCY_EDGES
    .filter((edge) => requested.has(edge.edgeId))
    .map((edge) => evaluateEdgeFromArtifacts(edge.edgeId, artifacts))
    .filter((edge): edge is ConsistencyEdgeResult => Boolean(edge));
}

export function mergeConsistencyReports(ruleEdges: ConsistencyEdgeResult[], semanticEdges: ConsistencyEdgeResult[] = []): ConsistencyReport {
  const merged = [...ruleEdges];
  for (const semanticEdge of semanticEdges) {
    const index = merged.findIndex((item) => item.edgeId === semanticEdge.edgeId);
    if (index === -1) {
      merged.push(semanticEdge);
      continue;
    }
    const current = merged[index];
    if (!semanticEdge.pass) {
      // For hard-level edges where the rule check already passed, the semantic review
      // can add issues/evidence/hints but should NOT override pass to false.
      // This prevents the semantic LLM from independently blocking the pipeline
      // when the deterministic rule check found no structural problems.
      const shouldOverridePass = current.level === "hard" && current.pass ? false : true;
      merged[index] = {
        ...current,
        pass: shouldOverridePass ? false : current.pass,
        severity: current.severity === "high" || semanticEdge.severity === "high" ? "high" : "medium",
        issues: uniqueStrings([...current.issues, ...semanticEdge.issues], 12),
        evidence: uniqueStrings([...(current.evidence ?? []), ...(semanticEdge.evidence ?? [])], 12),
        involvedTools: Array.from(new Set([...current.involvedTools, ...semanticEdge.involvedTools])).slice(0, 4) as ToolName[],
        problemLocationHints: [...current.problemLocationHints, ...semanticEdge.problemLocationHints]
          .filter((hint, index, array) => array.findIndex((candidate) => candidate.toolName === hint.toolName && candidate.reason === hint.reason) === index)
          .slice(0, 6),
      };
    }
  }
  const hardFailures = merged.filter((edge) => edge.level === "hard" && !edge.pass);
  const softWarnings = merged.filter((edge) => edge.level === "soft" && !edge.pass);
  const passedEdges = merged.filter((edge) => edge.pass);
  const repairTasks = [...hardFailures, ...softWarnings].map(buildRepairTask);
  const repairCandidates = Array.from(
    new Map(
      repairTasks.flatMap((task) =>
        task.candidateTools.map((toolName) => [
          toolName,
          {
            toolName,
            reasons: clampStringList(
              repairTasks
                .filter((candidate) => candidate.candidateTools.includes(toolName))
                .flatMap((candidate) => [candidate.problemSummary, candidate.whyItMatters, ...candidate.selectionGuidance, ...candidate.successConditions]),
              12,
              220,
            ),
            priority: Math.min(
              100,
              repairTasks
                .filter((candidate) => candidate.candidateTools.includes(toolName))
                .reduce((sum, candidate) => sum + (hardFailures.some((edge) => edge.edgeId === candidate.edgeId) ? 25 : 10), 0),
            ),
          },
        ]),
      ),
    ).values(),
  ).sort((a, b) => b.priority - a.priority);
  const affectedTools = Array.from(new Set(repairTasks.flatMap((task) => task.candidateTools))).slice(0, 12) as ToolName[];
  const summary =
    hardFailures.length === 0 && softWarnings.length === 0
      ? "All constraint edges passed. No blocking consistency issues were found."
      : `Detected ${hardFailures.length} hard-failure edges and ${softWarnings.length} soft-warning edges. The agent should repair based on reasons and success conditions.`;
  return ConsistencyReportSchema.parse({
    hardFailures,
    softWarnings,
    passedEdges,
    repairTasks,
    repairCandidates,
    affectedTools,
    summary,
    globalPass: hardFailures.length === 0,
  });
}

export function buildLocalConsistencyReport(
  ruleEdges: ConsistencyEdgeResult[],
  semanticEdges: ConsistencyEdgeResult[] = [],
  summaryPrefix?: string,
) {
  const report = mergeConsistencyReports(ruleEdges, semanticEdges);
  if (!summaryPrefix) return report;
  return ConsistencyReportSchema.parse({
    ...report,
    summary: clampText(`${summaryPrefix} ${report.summary}`, 260),
  });
}

export function buildConsistencyRepairBrief(report: ConsistencyReport) {
  if (report.globalPass) return "All hard consistency edges have passed. No repair is required.";
  return report.repairTasks
    .slice(0, 5)
    .map(
      (task, index) =>
        `${index + 1}. [${task.edgeId}] ${task.problemSummary}\nWhy: ${task.whyItMatters}\nSuccess conditions: ${task.successConditions.join(" | ")}\nInvolved tools: ${task.candidateTools.join(" / ")}\nGuidance: ${task.selectionGuidance.join(" | ")}`,
    )
    .join("\n");
}

export function buildSceneRepairFocus(report?: ConsistencyReport | null) {
  if (!report) return null;

  const relatedTasks = report.repairTasks.filter((task) =>
    task.candidateTools.includes("scene_design_tool") ||
    ["system_scene", "scene_asset", "scene_layout", "scene_interaction", "scene_copywriting", "scene_ui"].includes(task.edgeId),
  );

  if (relatedTasks.length === 0) return null;

  const relatedFailedEdges = [...report.hardFailures, ...report.softWarnings].filter((edge) =>
    relatedTasks.some((task) => task.edgeId === edge.edgeId),
  );

  const collectStructuredEntities = (prefixes: string[]) =>
    Array.from(
      new Map(
        relatedFailedEdges
          .flatMap((edge) => edge.evidence ?? [])
          .filter((line) => prefixes.some((prefix) => line.startsWith(prefix)))
          .flatMap((line) => {
            const entityEvidenceMatch = line.match(/entityId=([^;]+);\s*entityName=([^;]+);\s*type=([^;]+)/i);
            if (!entityEvidenceMatch) return [];
            return [
              {
                entityId: entityEvidenceMatch[1]?.trim(),
                entityName: entityEvidenceMatch[2]?.trim(),
                entityType: entityEvidenceMatch[3]?.trim(),
              },
            ];
          })
          .filter((item) => item.entityId || item.entityName)
          .map((item) => [item.entityId ?? item.entityName ?? "", item] as const),
      ).values(),
    ).slice(0, 12);

  const missingSceneEntities = collectStructuredEntities(["Missing scene carrier:"]);
  const missingBuildingDefinitions = collectStructuredEntities(["Missing building definition:"]);
  const missingEntities = Array.from(
    new Map(
      [...missingSceneEntities, ...missingBuildingDefinitions].map((item) => [item.entityId ?? item.entityName ?? "", item] as const),
    ).values(),
  ).slice(0, 12);

  return {
    relatedEdges: relatedTasks.map((task) => task.edgeId).slice(0, 8),
    problemSummaries: relatedTasks.map((task) => task.problemSummary).slice(0, 6),
    successConditions: Array.from(new Set(relatedTasks.flatMap((task) => task.successConditions))).slice(0, 8),
    strictIdentifiers: Array.from(new Set(relatedTasks.flatMap((task) => task.strictIdentifiers))).slice(0, 12),
    missingEntities,
    missingSceneEntities,
    missingBuildingDefinitions,
    problemLocationHints: relatedTasks
      .flatMap((task) => task.problemLocationHints)
      .filter(
        (hint, index, list) =>
          list.findIndex((candidate) => candidate.toolName === hint.toolName && candidate.reason === hint.reason) === index,
      )
      .slice(0, 8),
  };
}

