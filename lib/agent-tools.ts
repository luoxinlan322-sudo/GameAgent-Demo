import type { LangfuseObservation } from "@langfuse/tracing";
import type { DebugLogEntry } from "./debug-log";
import { getBaseURL, getModelName, getOpenAIClient, getProviderExtraBody } from "./openai";
import {
  AssetManifestSchema,
  CharacterListSchema,
  CopywritingPackSchema,
  ConsistencyCheckSchema,
  EconomyDesignSchema,
  EvaluationSchema,
  GameplayStructureSchema,
  IntentAnalysisSchema,
  PlanSchema,
  ProposalSchema,
  SceneRepairPatchSchema,
  SceneDesignSchema,
  StorySchema,
  SystemDesignSchema,
  ToolSelectionSchema,
  UIInformationArchitectureSchema,
  VerificationSchema,
  createEconomyDesignSchema,
  createSystemDesignSchema,
  createSceneDesignSchema,
  createUIInformationArchitectureSchema,
  type GenreFeatureProfile,
  type AgentPlan,
  type AssetManifest,
  type CharacterCard,
  type CopywritingPack,
  type ConsistencyCheckResult,
  type ConsistencyEdgeId,
  type CreativePack,
  type EconomyDesign,
  type Evaluation,
  type GameProposal,
  type GameplayStructure,
  type IntentAnalysis,
  type PersonaInput,
  type SceneRepairPatch,
  type SceneDesign,
  type StoryResult,
  type SystemDesign,
  type ToolName,
  type ToolSelection,
  type UIInformationArchitecture,
  type VerificationResult,
} from "./schemas";
import {
  ConsistencySemanticReviewSchema,
  RepairPlanSchema,
  type ConsistencyEdgeResult,
  type ConsistencyReport,
  type ConsistencySemanticReview,
  type RepairPlan,
} from "./agent-consistency-schemas";
import {
  deriveAssetManifestInput,
  deriveCopywritingConfig,
  deriveHtml5RuntimeProjection,
  deriveInteractionBindings,
  deriveLayoutConfig,
  deriveLightingRenderConfig,
  deriveSceneDefinitions,
  deriveTimelineConfig,
  type Html5PreparationPackage,
  type InteractionConfigInput,
  type LightingRenderConfigInput,
  type SceneDefinition,
  type LayoutConfigInput,
  type TimelineConfigInput,
} from "./html5-render-schemas";
import { buildConsistencyAwareRepairPlanPrompt, buildSemanticConsistencyPrompt } from "./consistency-prompts";
import {
  buildAssetManifestPrompt,
  buildCharacterToolPrompt,
  buildCopywritingPrompt,
  buildEconomyToolPrompt,
  buildEvaluatorPrompt,
  buildGameplayToolPrompt,
  buildIntentPrompt,
  buildPlannerWithIntentPrompt,
  buildProposalToolPrompt,
  buildRepairPlanPrompt,
  buildSceneRepairPatchPrompt,
  buildSceneToolPrompt,
  buildStoryToolPrompt,
  buildSystemDesignPrompt,
  buildToolSelectionPrompt,
  buildUiToolPrompt,
  buildVerificationPrompt,
} from "./prompts";
import { runStructuredChat } from "./qwen-chat";
import {
  repairPlanSelectedTools,
  repairPlanContextText,
  mockIntent,
  mockPlan,
  inferRepairTools,
  mockToolSelection,
  mockProposal,
  mockGameplay,
  mockEconomy,
  mockSystems,
  mockScene,
  mockUi,
  mockStory,
  mockCharacters,
  mockAssets,
  buildDynamicCharacterFallback,
  buildDynamicAssetFallback,
  buildDynamicCopywritingFallback,
  buildDynamicRepairFallback,
  mockVerification,
  mockRepairPlan,
} from "./agent/agent-tools-fallbacks";

type ToolContext = {
  sessionId: string;
  runId: string;
  iteration: number;
  langfuseParent?: LangfuseObservation;
};

type ToolErrorWithLog = Error & { logEntry?: DebugLogEntry };

function shouldUseStaticFallbacks() {
  return process.env.ENABLE_STATIC_FALLBACKS === "true";
}


function applyFallback(logEntry: DebugLogEntry | undefined, parsedResult: unknown, rawContent: string) {
  if (!logEntry) return;
  Object.assign(logEntry, { parsedResult, rawContent, fallbackUsed: true });
}

function mergeUniqueStrings(current: string[], append: string[]) {
  return Array.from(new Set([...current, ...append]));
}

function normalizeSceneKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "")
    .trim();
}

function buildSceneFocusKeySet(sceneRepairFocus?: {
  strictIdentifiers?: string[];
  missingEntities?: Array<{ entityId?: string; entityName?: string }>;
  missingSceneEntities?: Array<{ entityId?: string; entityName?: string }>;
  missingBuildingDefinitions?: Array<{ entityId?: string; entityName?: string }>;
} | null) {
  const keys = new Set<string>();
  for (const identifier of sceneRepairFocus?.strictIdentifiers ?? []) {
    const normalized = normalizeSceneKey(identifier);
    if (normalized) keys.add(normalized);
  }
  for (const entity of sceneRepairFocus?.missingEntities ?? []) {
    for (const value of [entity.entityId, entity.entityName]) {
      if (!value) continue;
      const normalized = normalizeSceneKey(value);
      if (normalized) keys.add(normalized);
    }
  }
  for (const entity of sceneRepairFocus?.missingSceneEntities ?? []) {
    for (const value of [entity.entityId, entity.entityName]) {
      if (!value) continue;
      const normalized = normalizeSceneKey(value);
      if (normalized) keys.add(normalized);
    }
  }
  for (const entity of sceneRepairFocus?.missingBuildingDefinitions ?? []) {
    for (const value of [entity.entityId, entity.entityName]) {
      if (!value) continue;
      const normalized = normalizeSceneKey(value);
      if (normalized) keys.add(normalized);
    }
  }
  return keys;
}

function isSceneValueRelevant(value: string | undefined, focusKeys: Set<string>) {
  if (!value) return false;
  const normalized = normalizeSceneKey(value);
  if (!normalized) return false;
  for (const key of focusKeys) {
    if (normalized.includes(key) || key.includes(normalized)) return true;
  }
  return false;
}

function buildSceneRepairSystemSubset(
  systems: SystemDesign,
  sceneRepairFocus?: {
    strictIdentifiers?: string[];
    missingEntities?: Array<{ entityId?: string; entityName?: string }>;
    missingSceneEntities?: Array<{ entityId?: string; entityName?: string }>;
    missingBuildingDefinitions?: Array<{ entityId?: string; entityName?: string }>;
  } | null,
) {
  const focusKeys = buildSceneFocusKeySet(sceneRepairFocus);
  if (focusKeys.size === 0) {
    return {
      systemOverview: systems.systemOverview,
      systemEntities: systems.systemEntities.slice(0, 8),
      systemToEntityMap: systems.systemToEntityMap.slice(0, 8),
    };
  }

  const systemEntities = systems.systemEntities.filter((entity) =>
    [entity.entityId, entity.entityName, ...entity.relatedSystems, ...entity.relatedScenes].some((value) => isSceneValueRelevant(value, focusKeys)),
  );
  const allowedEntityIds = new Set(systemEntities.map((entity) => entity.entityId));
  const systemToEntityMap = systems.systemToEntityMap.filter((mapping) => mapping.entityIds.some((entityId) => allowedEntityIds.has(entityId)));

  return {
    systemOverview: systems.systemOverview,
    systemEntities: systemEntities.slice(0, 12),
    systemToEntityMap: systemToEntityMap.slice(0, 12),
  };
}

function buildSceneRepairBaselineSubset(
  currentSceneBaseline: SceneDesign,
  sceneRepairFocus?: {
    strictIdentifiers?: string[];
    missingEntities?: Array<{ entityId?: string; entityName?: string }>;
    missingSceneEntities?: Array<{ entityId?: string; entityName?: string }>;
    missingBuildingDefinitions?: Array<{ entityId?: string; entityName?: string }>;
  } | null,
) {
  const focusKeys = buildSceneFocusKeySet(sceneRepairFocus);
  if (focusKeys.size === 0) {
    return {
      sceneConcept: currentSceneBaseline.sceneConcept,
      sceneZones: currentSceneBaseline.sceneZones.slice(0, 8),
      interactiveAreas: currentSceneBaseline.interactiveAreas.slice(0, 8),
      buildingSlots: currentSceneBaseline.buildingSlots.slice(0, 8),
      contentHotspots: currentSceneBaseline.contentHotspots.slice(0, 8),
      sceneEntities: currentSceneBaseline.sceneEntities.slice(0, 10),
      zoneEntityMap: currentSceneBaseline.zoneEntityMap.slice(0, 10),
      buildingDefinitions: currentSceneBaseline.buildingDefinitions.slice(0, 10),
    };
  }

  const sceneEntities = currentSceneBaseline.sceneEntities.filter((entity) =>
    [entity.entityId, entity.entityName, ...entity.relatedSystems, ...entity.relatedScenes].some((value) => isSceneValueRelevant(value, focusKeys)),
  );
  const allowedEntityIds = new Set(sceneEntities.map((entity) => entity.entityId));
  const zoneEntityMap = currentSceneBaseline.zoneEntityMap.filter(
    (mapping) =>
      isSceneValueRelevant(mapping.zoneName, focusKeys) ||
      mapping.entityIds.some((entityId) => allowedEntityIds.has(entityId) || isSceneValueRelevant(entityId, focusKeys)),
  );
  const buildingDefinitions = currentSceneBaseline.buildingDefinitions.filter((building) =>
    [building.buildingId, building.buildingName, building.slotName, building.buildingType].some((value) => isSceneValueRelevant(value, focusKeys)),
  );

  return {
    sceneConcept: currentSceneBaseline.sceneConcept,
    sceneZones: currentSceneBaseline.sceneZones.filter((zone) => isSceneValueRelevant(zone, focusKeys)).slice(0, 8),
    interactiveAreas: currentSceneBaseline.interactiveAreas.filter((area) => isSceneValueRelevant(area, focusKeys)).slice(0, 8),
    buildingSlots: currentSceneBaseline.buildingSlots.filter((slot) => isSceneValueRelevant(slot, focusKeys)).slice(0, 8),
    contentHotspots: currentSceneBaseline.contentHotspots.filter((hotspot) => isSceneValueRelevant(hotspot, focusKeys)).slice(0, 8),
    sceneEntities: sceneEntities.slice(0, 12),
    zoneEntityMap: zoneEntityMap.slice(0, 12),
    buildingDefinitions: buildingDefinitions.slice(0, 12),
  };
}

function prioritizeMergedSceneStrings(
  baseline: string[],
  append: string[],
  maxItems: number,
  sceneRepairFocus?: {
    strictIdentifiers?: string[];
    missingEntities?: Array<{ entityId?: string; entityName?: string }>;
    missingSceneEntities?: Array<{ entityId?: string; entityName?: string }>;
    missingBuildingDefinitions?: Array<{ entityId?: string; entityName?: string }>;
  } | null,
) {
  const baselineUnique = mergeUniqueStrings(baseline, []);
  const focusKeys = buildSceneFocusKeySet(sceneRepairFocus);
  const appendUnique = mergeUniqueStrings([], append).filter((item) => !baselineUnique.includes(item));

  const relevantAppend = appendUnique.filter((item) => isSceneValueRelevant(item, focusKeys));
  const fallbackAppend = appendUnique.filter((item) => !relevantAppend.includes(item));

  return [...baselineUnique, ...relevantAppend, ...fallbackAppend].slice(0, maxItems);
}

function sceneDefinitionKeys(definition: { buildingId: string; buildingName: string; slotName: string }) {
  return [definition.buildingId, definition.buildingName, definition.slotName]
    .map((value) => normalizeSceneKey(value))
    .filter(Boolean);
}

function definitionsConflict(
  current: { buildingId: string; buildingName: string; slotName: string },
  incoming: { buildingId: string; buildingName: string; slotName: string },
  focusKeys: Set<string>,
) {
  const currentKeys = sceneDefinitionKeys(current);
  const incomingKeys = sceneDefinitionKeys(incoming);
  const overlap =
    currentKeys.some((key) => incomingKeys.some((candidate) => key === candidate || key.includes(candidate) || candidate.includes(key))) ||
    [...focusKeys].some(
      (focus) =>
        currentKeys.some((key) => key.includes(focus) || focus.includes(key)) &&
        incomingKeys.some((key) => key.includes(focus) || focus.includes(key)),
    );
  return overlap;
}

function mergeSceneRepairPatch(
  currentScene: SceneDesign,
  patch: SceneRepairPatch,
  sceneRepairFocus?: {
    strictIdentifiers?: string[];
    missingEntities?: Array<{ entityId?: string; entityName?: string }>;
    missingSceneEntities?: Array<{ entityId?: string; entityName?: string }>;
    missingBuildingDefinitions?: Array<{ entityId?: string; entityName?: string }>;
  } | null,
): SceneDesign {
  const sceneEntities = Array.from(
    new Map(
      [...currentScene.sceneEntities, ...patch.appendSceneEntities].map((entity) => [entity.entityId, entity] as const),
    ).values(),
  );

  const zoneMap = new Map(currentScene.zoneEntityMap.map((mapping) => [mapping.zoneName, { ...mapping }]));
  for (const mapping of patch.appendZoneEntityMap) {
    const existing = zoneMap.get(mapping.zoneName);
    zoneMap.set(mapping.zoneName, {
      zoneName: mapping.zoneName,
      entityIds: mergeUniqueStrings(existing?.entityIds ?? [], mapping.entityIds).slice(0, 8),
    });
  }
  const zoneEntityMap = Array.from(zoneMap.values());

  const focusKeys = buildSceneFocusKeySet(sceneRepairFocus);
  const buildingDefinitions = [...currentScene.buildingDefinitions];
  for (const incoming of patch.appendBuildingDefinitions) {
    const exactIndex = buildingDefinitions.findIndex((building) => building.buildingId === incoming.buildingId);
    if (exactIndex >= 0) {
      buildingDefinitions[exactIndex] = incoming;
      continue;
    }
    const conflictIndex = buildingDefinitions.findIndex((building) => definitionsConflict(building, incoming, focusKeys));
    if (conflictIndex >= 0) {
      buildingDefinitions[conflictIndex] = incoming;
      continue;
    }
    if (buildingDefinitions.length < 12) {
      buildingDefinitions.push(incoming);
    }
  }

  return {
    ...currentScene,
    sceneZones: prioritizeMergedSceneStrings(currentScene.sceneZones, patch.appendSceneZones, 7, sceneRepairFocus),
    interactiveAreas: prioritizeMergedSceneStrings(currentScene.interactiveAreas, patch.appendInteractiveAreas, 8, sceneRepairFocus),
    buildingSlots: prioritizeMergedSceneStrings(currentScene.buildingSlots, patch.appendBuildingSlots, 8, sceneRepairFocus),
    contentHotspots: prioritizeMergedSceneStrings(currentScene.contentHotspots, patch.appendContentHotspots, 6, sceneRepairFocus),
    sceneEntities,
    zoneEntityMap,
    buildingDefinitions,
  };
}

async function runWithSchema<T>({
  prompt,
  stage,
  schema,
  schemaName,
  requestPayload,
  debugMeta,
  fallback,
  fallbackContent,
  timeoutMs,
}: {
  prompt: string;
  stage: string;
  schema: Parameters<typeof runStructuredChat>[0]["schema"];
  schemaName: string;
  requestPayload: unknown;
  debugMeta: ToolContext & { phase: string; title: string };
  fallback: T;
  fallbackContent: string;
  timeoutMs?: number;
}): Promise<T> {
  const client = getOpenAIClient();
  if (!client) {
    if (shouldUseStaticFallbacks()) return fallback;
    throw new Error(`Tool ${stage} failed: missing model client`);
  }

  const effectiveTimeoutMs =
    timeoutMs ??
    (stage === "proposal_tool"
      ? Number(process.env.PROPOSAL_TOOL_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS || "600000")
      : Number(process.env.LLM_TIMEOUT_MS || "600000"));

  try {
    const result = await runStructuredChat({
      client,
      model: getModelName(),
      baseURL: getBaseURL(),
      schema,
      schemaName,
      stage,
      messages: [{ role: "user", content: prompt }],
      extraBody: getProviderExtraBody(stage),
      requestPayload,
      debugMeta,
      timeoutMs: effectiveTimeoutMs,
    });

    return result.parsed as T;
  } catch (error) {
    if (shouldUseStaticFallbacks()) {
      applyFallback((error as ToolErrorWithLog).logEntry, fallback, fallbackContent);
      return fallback;
    }

    const wrapped = error instanceof Error ? error : new Error(String(error));
    const nodeError = new Error(`Tool ${stage} failed: ${wrapped.message}`) as ToolErrorWithLog;
    nodeError.logEntry = (error as ToolErrorWithLog).logEntry;
    throw nodeError;
  }
}

export async function runIntentTool(brief: PersonaInput, ctx: ToolContext, repairContext?: string) {
  const fallback = mockIntent(brief);
  return runWithSchema<IntentAnalysis>({
    prompt: buildIntentPrompt(brief, repairContext),
    stage: "intent_recognition",
    schema: IntentAnalysisSchema,
    schemaName: "intent_analysis",
    requestPayload: { brief, repairContext },
    debugMeta: { ...ctx, phase: "感知", title: "意图识别" },
    fallback,
    fallbackContent: "意图识别超时，使用本地回退结果。",
  });
}

export async function runPlanningTool(brief: PersonaInput, intent: IntentAnalysis, ctx: ToolContext, repairContext?: string) {
  const fallback = mockPlan(intent);
  return runWithSchema<AgentPlan>({
    prompt: buildPlannerWithIntentPrompt(brief, intent, repairContext),
    stage: "planning",
    schema: PlanSchema,
    schemaName: "agent_plan",
    requestPayload: { brief, intent, repairContext },
    debugMeta: { ...ctx, phase: "规划", title: "规划拆解" },
    fallback,
    fallbackContent: "规划节点超时，使用本地回退结果。",
  });
}

export async function runToolSelectionTool(
  brief: PersonaInput,
  intent: IntentAnalysis,
  plan: AgentPlan,
  iteration: number,
  ctx: ToolContext,
  repairPlan?: RepairPlan | null,
) {
  const fallback = mockToolSelection(iteration, repairPlan);
  return runWithSchema<ToolSelection>({
    prompt: buildToolSelectionPrompt(brief, intent, plan, iteration, repairPlan),
    stage: "tool_selection",
    schema: ToolSelectionSchema,
    schemaName: "tool_selection",
    requestPayload: { brief, intent, plan, iteration, repairPlan },
    debugMeta: { ...ctx, phase: "规划", title: "工具选择" },
    fallback,
    fallbackContent: "工具选择超时，使用本地回退结果。",
  });
}

export async function runGameplayTool(brief: PersonaInput, plan: AgentPlan, iteration: number, ctx: ToolContext, repairPlan?: RepairPlan | null, previousBaseline?: unknown) {
  const fallback = mockGameplay();
  return runWithSchema<GameplayStructure>({
    prompt: buildGameplayToolPrompt(brief, plan, iteration, repairPlan, previousBaseline),
    stage: "gameplay_tool",
    schema: GameplayStructureSchema,
    schemaName: "gameplay_structure",
    requestPayload: { brief, plan, iteration, repairPlan },
    debugMeta: { ...ctx, phase: "工具", title: "玩法结构工具" },
    fallback,
    fallbackContent: "玩法结构工具超时，使用本地回退结果。",
  });
}

export async function runEconomyTool(
  brief: PersonaInput,
  plan: AgentPlan,
  gameplay: GameplayStructure,
  iteration: number,
  ctx: ToolContext,
  repairPlan?: RepairPlan | null,
  genreProfile?: GenreFeatureProfile | null,
  previousBaseline?: unknown,
) {
  const fallback = mockEconomy();
  const schema = genreProfile ? createEconomyDesignSchema(genreProfile) : EconomyDesignSchema;
  return runWithSchema<EconomyDesign>({
    prompt: buildEconomyToolPrompt(brief, plan, gameplay, iteration, repairPlan, genreProfile, previousBaseline),
    stage: "economy_tool",
    schema,
    schemaName: "economy_design",
    requestPayload: { brief, plan, gameplay, iteration, repairPlan },
    debugMeta: { ...ctx, phase: "工具", title: "数值与经济工具" },
    fallback,
    fallbackContent: "数值与经济工具超时，使用本地回退结果。",
  });
}

export async function runSystemDesignTool(
  brief: PersonaInput,
  plan: AgentPlan,
  gameplay: GameplayStructure,
  economy: EconomyDesign | null,
  iteration: number,
  ctx: ToolContext,
  repairPlan?: RepairPlan | null,
  genreProfile?: GenreFeatureProfile | null,
  previousBaseline?: unknown,
) {
  const fallback = mockSystems();
  const schema = genreProfile ? createSystemDesignSchema(genreProfile) : SystemDesignSchema;
  return runWithSchema<SystemDesign>({
    prompt: buildSystemDesignPrompt(brief, plan, gameplay, economy, iteration, repairPlan, genreProfile, previousBaseline),
    stage: "system_design_tool",
    schema,
    schemaName: "system_design",
    requestPayload: { brief, plan, gameplay, economy, iteration, repairPlan },
    debugMeta: { ...ctx, phase: "工具", title: "系统策划工具" },
    fallback,
    fallbackContent: "系统策划工具超时，使用本地回退结果。",
  });
}

export async function runProposalTool(
  brief: PersonaInput,
  plan: AgentPlan,
  gameplay: GameplayStructure,
  economy: EconomyDesign,
  systems: SystemDesign,
  iteration: number,
  ctx: ToolContext,
  repairPlan?: RepairPlan | null,
  previousBaseline?: unknown,
) {
  const fallback = mockProposal(brief);
  return runWithSchema<GameProposal>({
    prompt: buildProposalToolPrompt(brief, plan, gameplay, economy, systems, iteration, repairPlan, previousBaseline),
    stage: "proposal_tool",
    schema: ProposalSchema,
    schemaName: "proposal_summary",
    requestPayload: { brief, plan, gameplay, economy, systems, iteration, repairPlan },
    debugMeta: { ...ctx, phase: "工具", title: "总体策划工具" },
    fallback,
    fallbackContent: "总体策划工具超时，使用本地回退结果。",
  });
}

export async function runSceneTool(
  brief: PersonaInput,
  plan: AgentPlan,
  gameplay: GameplayStructure,
  systems: SystemDesign,
  proposal: GameProposal,
  iteration: number,
  ctx: ToolContext,
  repairPlan?: RepairPlan | null,
  currentSceneBaseline?: SceneDesign | null,
  sceneRepairFocus?: {
    relatedEdges: string[];
    problemSummaries: string[];
    successConditions: string[];
    strictIdentifiers: string[];
    missingEntities: Array<{ entityId?: string; entityName?: string; entityType?: string }>;
    missingSceneEntities?: Array<{ entityId?: string; entityName?: string; entityType?: string }>;
    missingBuildingDefinitions?: Array<{ entityId?: string; entityName?: string; entityType?: string }>;
    problemLocationHints: Array<{ toolName: string; confidence: string; reason: string }>;
  } | null,
  genreProfile?: GenreFeatureProfile | null,
) {
  const fallback = mockScene();
  const schema = genreProfile ? createSceneDesignSchema(genreProfile) : SceneDesignSchema;
  if (repairPlan && currentSceneBaseline && sceneRepairFocus) {
    const focusedSystems = buildSceneRepairSystemSubset(systems, sceneRepairFocus);
    const focusedBaseline = buildSceneRepairBaselineSubset(currentSceneBaseline, sceneRepairFocus);
    const patch = await runWithSchema<SceneRepairPatch>({
      prompt: buildSceneRepairPatchPrompt(
        brief,
        focusedSystems,
        focusedBaseline,
        sceneRepairFocus,
      ),
      stage: "scene_design_patch_tool",
      schema: SceneRepairPatchSchema,
      schemaName: "scene_design_repair_patch",
      requestPayload: { brief, systems, currentSceneBaseline, sceneRepairFocus, repairPlan, iteration, mode: "patch" },
      debugMeta: { ...ctx, phase: "工具", title: "场景策划工具" },
      fallback: {
        preserveEntityIds: [],
        appendSceneZones: [],
        appendInteractiveAreas: [],
        appendBuildingSlots: [],
        appendContentHotspots: [],
        appendSceneEntities: [],
        appendZoneEntityMap: [],
        appendBuildingDefinitions: [],
      },
      fallbackContent: "场景策划工具返修补丁超时，使用空补丁。",
    });

    return schema.parse(mergeSceneRepairPatch(currentSceneBaseline, patch, sceneRepairFocus));
  }

  return runWithSchema<SceneDesign>({
    prompt: buildSceneToolPrompt(brief, plan, gameplay, systems, proposal, iteration, repairPlan, currentSceneBaseline, sceneRepairFocus, genreProfile),
    stage: "scene_design_tool",
    schema,
    schemaName: "scene_design",
    requestPayload: { brief, plan, gameplay, systems, proposal, iteration, repairPlan, currentSceneBaseline, sceneRepairFocus },
    debugMeta: { ...ctx, phase: "工具", title: "场景策划工具" },
    fallback,
    fallbackContent: "场景策划工具超时，使用本地回退结果。",
  });
}

export async function runUiTool(
  brief: PersonaInput,
  plan: AgentPlan,
  systems: SystemDesign,
  scene: SceneDesign,
  iteration: number,
  ctx: ToolContext,
  repairPlan?: RepairPlan | null,
  genreProfile?: GenreFeatureProfile | null,
  previousBaseline?: unknown,
) {
  const fallback = mockUi();
  const schema = genreProfile ? createUIInformationArchitectureSchema(genreProfile) : UIInformationArchitectureSchema;
  return runWithSchema<UIInformationArchitecture>({
    prompt: buildUiToolPrompt(brief, plan, systems, scene, iteration, repairPlan, genreProfile, previousBaseline),
    stage: "ui_architecture_tool",
    schema,
    schemaName: "ui_information_architecture",
    requestPayload: { brief, plan, systems, scene, iteration, repairPlan },
    debugMeta: { ...ctx, phase: "工具", title: "UI架构工具" },
    fallback,
    fallbackContent: "UI架构工具超时，使用本地回退结果。",
  });
}

export async function runStoryTool(
  brief: PersonaInput,
  plan: AgentPlan,
  proposal: GameProposal,
  systems: SystemDesign,
  iteration: number,
  ctx: ToolContext,
  repairPlan?: RepairPlan | null,
  previousBaseline?: unknown,
) {
  const fallback = mockStory();
  return runWithSchema<StoryResult>({
    prompt: buildStoryToolPrompt(brief, plan, proposal, systems, iteration, repairPlan, previousBaseline),
    stage: "story_tool",
    schema: StorySchema,
    schemaName: "story_result",
    requestPayload: { brief, plan, proposal, systems, iteration, repairPlan },
    debugMeta: { ...ctx, phase: "工具", title: "剧情工具" },
    fallback,
    fallbackContent: "剧情工具超时，使用本地回退结果。",
  });
}

export async function runCharacterTool(
  brief: PersonaInput,
  plan: AgentPlan,
  systems: SystemDesign,
  story: StoryResult,
  iteration: number,
  ctx: ToolContext,
  repairPlan?: RepairPlan | null,
  previousBaseline?: unknown,
) {
  const fallback = buildDynamicCharacterFallback(story);
  const result = await runWithSchema<{ cards: CharacterCard[] }>({
    prompt: buildCharacterToolPrompt(brief, plan, systems, story, iteration, repairPlan, previousBaseline),
    stage: "character_tool",
    schema: CharacterListSchema,
    schemaName: "character_cards",
    requestPayload: { brief, plan, systems, story, iteration, repairPlan },
    debugMeta: { ...ctx, phase: "工具", title: "角色工具" },
    fallback: { cards: fallback },
    fallbackContent: "角色工具超时，使用本地回退结果。",
  });
  return result.cards;
}

export async function runAssetManifestTool(
  brief: PersonaInput,
  plan: AgentPlan,
  proposal: GameProposal,
  economy: EconomyDesign,
  scene: SceneDesign,
  ui: UIInformationArchitecture,
  story: StoryResult,
  characters: CharacterCard[],
  iteration: number,
  ctx: ToolContext,
  repairPlan?: RepairPlan | null,
  previousBaseline?: unknown,
) {
  const fallback = buildDynamicAssetFallback(scene, ui, story, characters);
  return runWithSchema<AssetManifest>({
    prompt: buildAssetManifestPrompt(brief, plan, proposal, economy, scene, ui, story, characters, iteration, repairPlan, previousBaseline),
    stage: "asset_manifest_tool",
    schema: AssetManifestSchema,
    schemaName: "asset_manifest",
    requestPayload: { brief, plan, proposal, economy, scene, ui, story, characters, iteration, repairPlan },
    debugMeta: { ...ctx, phase: "工具", title: "资产清单工具" },
    fallback,
    fallbackContent: "资产清单工具超时，使用本地回退结果。",
  });
}

export async function runCopywritingTool(
  brief: PersonaInput,
  plan: AgentPlan,
  proposal: GameProposal,
  economy: EconomyDesign,
  scene: SceneDesign,
  ui: UIInformationArchitecture,
  story: StoryResult,
  characters: CharacterCard[],
  assetManifest: AssetManifest,
  iteration: number,
  ctx: ToolContext,
  repairPlan?: RepairPlan | null,
  previousBaseline?: unknown,
) {
  const fallback = buildDynamicCopywritingFallback(story, characters, assetManifest);
  return runWithSchema<CopywritingPack>({
    prompt: buildCopywritingPrompt(brief, plan, proposal, economy, scene, ui, story, characters, assetManifest, iteration, repairPlan, previousBaseline),
    stage: "copywriting_tool",
    schema: CopywritingPackSchema,
    schemaName: "copywriting_pack",
    requestPayload: { brief, plan, proposal, economy, scene, ui, story, characters, assetManifest, iteration, repairPlan },
    debugMeta: { ...ctx, phase: "工具", title: "文案工具" },
    fallback,
    fallbackContent: "文案工具超时，使用本地回退结果。",
  });
}

export function runLayoutTool(
  brief: PersonaInput,
  proposal: GameProposal,
  creativePack: CreativePack,
): {
  layoutConfig: LayoutConfigInput;
  interactionConfig: InteractionConfigInput;
  sceneDefinitions: SceneDefinition[];
} {
  const assetManifestInput = deriveAssetManifestInput(creativePack);
  const sceneDefinitions = deriveSceneDefinitions(brief, proposal, creativePack, assetManifestInput);
  const interactionConfig = deriveInteractionBindings(creativePack);
  const layoutConfig = deriveLayoutConfig(creativePack, assetManifestInput);
  return {
    layoutConfig,
    interactionConfig,
    sceneDefinitions,
  };
}

export function runTimelineTool(
  brief: PersonaInput,
  proposal: GameProposal,
  creativePack: CreativePack,
): {
  html5Projection: Html5PreparationPackage;
  timelineConfig: TimelineConfigInput;
  lightingRenderConfig: LightingRenderConfigInput;
} {
  const html5Projection = deriveHtml5RuntimeProjection(brief, proposal, creativePack) as Html5PreparationPackage;
  const interactionConfig = deriveInteractionBindings(creativePack);
  const layoutConfig = deriveLayoutConfig(creativePack, deriveAssetManifestInput(creativePack));
  const timelineConfig = deriveTimelineConfig(creativePack, deriveCopywritingConfig(creativePack), interactionConfig, layoutConfig);
  const lightingRenderConfig = deriveLightingRenderConfig(creativePack);
  return {
    html5Projection,
    timelineConfig,
    lightingRenderConfig,
  };
}

export function runConsistencyCheckTool(creativePack: CreativePack): ConsistencyCheckResult {
  const issues: string[] = [];
  const repairSuggestions: string[] = [];

  const gameplayText = JSON.stringify(creativePack.gameplay);
  const economyText = JSON.stringify(creativePack.economy);
  const systemsText = JSON.stringify(creativePack.systems);
  const sceneText = JSON.stringify(creativePack.scene);
  const uiText = JSON.stringify(creativePack.ui);

  const gameplayEconomyAligned =
    creativePack.economy.orderCostLoop.includes("订单") &&
    (gameplayText.includes("订单") || gameplayText.includes("经营")) &&
    creativePack.economy.coreCurrencies.length >= 3;
  if (!gameplayEconomyAligned) {
    issues.push("玩法结构与数值经济未形成清晰闭环，订单驱动或货币循环解释不足。");
    repairSuggestions.push("优先补玩法结构与数值经济，让订单、收益、升级、装扮解锁形成闭环。");
  }

  const systemsSceneAligned =
    creativePack.scene.interactiveAreas.length >= 4 &&
    (sceneText.includes("扩建") || sceneText.includes("建造")) &&
    (systemsText.includes("扩建") || systemsText.includes("经营"));
  if (!systemsSceneAligned) {
    issues.push("系统策划与场景策划没有对齐，可交互区域或建筑坑位不足以承接系统。");
    repairSuggestions.push("补充场景中的交互区域、建筑坑位和动线，让其能承接经营与扩建系统。");
  }

  const sceneUIAligned =
    creativePack.ui.orderPanel.length > 0 &&
    creativePack.ui.buildModePanel.length > 0 &&
    (uiText.includes("订单") && sceneText.includes("订单")) &&
    (uiText.includes("建造") || uiText.includes("扩建"));
  if (!sceneUIAligned) {
    issues.push("场景策划与 UI 架构不一致，订单栏、建造入口或活动入口无法映射到场景动线。");
    repairSuggestions.push("优先返修场景策划和 UI 架构，明确场景热点与界面入口的一一对应。");
  }

  const cardNames = new Set(creativePack.characters.map((card) => card.name));
  const anchorSet = new Set(creativePack.story.chapterAnchors);
  const missingCards = creativePack.story.characterRoster.filter((name) => !cardNames.has(name));
  const missingMentions = creativePack.story.characterRoster.filter(
    (name) => !JSON.stringify(creativePack.story.mainPlotBeats).includes(name) && !JSON.stringify(creativePack.story.chapterAnchors).includes(name),
  );
  const invalidAnchors = creativePack.characters.filter((card) => card.storyAnchors.some((anchor) => !anchorSet.has(anchor))).map((card) => card.name);
  const storyCharacterAligned = missingCards.length === 0 && missingMentions.length === 0 && invalidAnchors.length === 0;
  if (!storyCharacterAligned) {
    if (missingCards.length > 0) {
      issues.push(`剧情中的核心角色缺少资料卡：${missingCards.join("、")}`);
      repairSuggestions.push(`补充角色资料卡：${missingCards.join("、")}`);
    }
    if (missingMentions.length > 0) {
      issues.push(`剧情主线或锚点未实际提及核心角色：${missingMentions.join("、")}`);
      repairSuggestions.push(`补充剧情提及：${missingMentions.join("、")}`);
    }
    if (invalidAnchors.length > 0) {
      issues.push(`角色资料卡使用了无效剧情锚点：${invalidAnchors.join("、")}`);
      repairSuggestions.push(`修正角色卡剧情锚点映射：${invalidAnchors.join("、")}`);
    }
  }

  const dependencyPool = new Set<string>([
    ...creativePack.scene.sceneZones,
    ...creativePack.story.characterRoster,
    ...creativePack.story.chapterAnchors,
    "订单栏",
    "建造模式",
    "活动入口",
  ]);
  const invalidAssets = creativePack.assetManifest.assetGroups.filter((item) => item.sourceDependencies.every((dep) => !dependencyPool.has(dep)));
  const assetManifestAligned = invalidAssets.length === 0 && creativePack.assetManifest.assetGroups.every((item) => item.backgroundRequirement.length > 0);
  if (!assetManifestAligned) {
    issues.push("资产清单中的部分素材没有有效上游依赖，或背景要求不明确。");
    repairSuggestions.push("返修资产清单，确保每个素材都绑定角色、场景、UI 或剧情锚点，并明确背景要求。");
  }

  return ConsistencyCheckSchema.parse({
    pass: issues.length === 0,
    gameplayEconomyAligned,
    systemsSceneAligned,
    sceneUIAligned,
    storyCharacterAligned,
    assetManifestAligned,
    issues,
    repairSuggestions,
  });
}

export async function runVerificationTool(
  brief: PersonaInput,
  intent: IntentAnalysis,
  plan: AgentPlan,
  proposal: GameProposal,
  evaluation: Evaluation,
  consistency: ConsistencyCheckResult,
  iteration: number,
  ctx: ToolContext,
) {
  const fallback = mockVerification(evaluation);
  return runWithSchema<VerificationResult>({
    prompt: buildVerificationPrompt(
      brief,
      {
        decision: evaluation.decision,
        totalScore: evaluation.totalScore,
        blockedBy: evaluation.blockedBy,
        recommendations: evaluation.recommendations,
      },
      JSON.stringify(consistency, null, 2),
      [],
    ),
    stage: "verification",
    schema: VerificationSchema,
    schemaName: "verification",
    requestPayload: { brief, intent, plan, proposal, evaluation, consistency, iteration },
    debugMeta: { ...ctx, phase: "反馈", title: "验证节点" },
    fallback,
    fallbackContent: "验证节点超时，使用本地回退结果。",
  });
}

export async function runRepairTool(
  brief: PersonaInput,
  intent: IntentAnalysis,
  plan: AgentPlan,
  proposal: GameProposal,
  evaluation: Evaluation,
  consistency: ConsistencyCheckResult,
  verification: VerificationResult,
  ctx: ToolContext,
) {
  const fallback = mockRepairPlan(verification);
  return runWithSchema<RepairPlan>({
    prompt: buildRepairPlanPrompt(
      brief,
      JSON.stringify(consistency, null, 2),
      JSON.stringify(
        {
          decision: evaluation.decision,
          totalScore: evaluation.totalScore,
          blockedBy: evaluation.blockedBy,
          recommendations: evaluation.recommendations,
          verificationSummary: verification.summary,
        },
        null,
        2,
      ),
      [],
    ),
    stage: "repair_tool",
    schema: RepairPlanSchema,
    schemaName: "repair_plan",
    requestPayload: { brief, intent, plan, proposal, evaluation, consistency, verification },
    debugMeta: { ...ctx, phase: "反馈", title: "返修规划" },
    fallback,
    fallbackContent: "返修规划超时，使用本地回退结果。",
  });
}

export async function runEvaluationTool(
  brief: PersonaInput,
  plan: AgentPlan | undefined,
  proposal: GameProposal,
  creativePack: CreativePack,
  blockedBy: string[],
  ctx: ToolContext,
) {
  const boundedBlockedBy = blockedBy.slice(0, 10);
  const fallback = EvaluationSchema.parse({
    hardGates: {
      loopsClear: true,
      economyClosedLoop: true,
      systemCoverage: true,
      sceneUiReady: true,
      storyCharacterAligned: true,
      assetManifestExecutable: true,
    },
    blockedBy: boundedBlockedBy,
    scores: {
      gameplayStructure: 16,
      economyBalance: 12,
      systemCoverage: 13,
      sceneUiReadiness: 12,
      storyCharacterConsistency: 8,
      assetManifestExecutability: 12,
      smallScaleTestFit: 17,
    },
    totalScore: 90,
    decision: boundedBlockedBy.length > 0 ? "修改后复评" : "优先进入测试",
    summary: "当前设计包已具备进入原型评审的基础，但仍需结合真实一致性结果决定是否返修。",
    risks: ["经济与素材承接可能仍不够完整", "UI 与场景入口关系仍需结合真实运行链路验证"],
    recommendations: ["先完成 HTML5 小范围原型装配", "再用一致性图继续追踪返修重点"],
  });

  return runWithSchema<Evaluation>({
    prompt: buildEvaluatorPrompt(brief, proposal, creativePack, boundedBlockedBy.join("；") || "当前无额外阻塞项。"),
    stage: "evaluate",
    schema: EvaluationSchema,
    schemaName: "evaluation",
    requestPayload: { brief, plan, proposal, creativePack, blockedBy: boundedBlockedBy },
    debugMeta: { ...ctx, phase: "反馈", title: "评估工具" },
    fallback,
    fallbackContent: "评估工具超时，使用本地回退结果。",
  });
}



