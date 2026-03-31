import type {
  AgentPlan,
  AssetManifest,
  CharacterCard,
  CopywritingPack,
  EconomyDesign,
  GameProposal,
  GameplayStructure,
  GenreFeatureProfile,
  IntentAnalysis,
  PersonaInput,
  SceneDesign,
  StoryResult,
  SystemDesign,
  UIInformationArchitecture,
} from "../schemas";
import type { RepairPlan, RepairAttemptRecord } from "../agent-consistency-schemas";
import {
  briefBlock,
  fewShotBlock,
  genreOptionalFieldsBlock,
  jsonBlock,
  jsonOnlyInstruction,
  previousOutputBlock,
  productionGradeInstruction,
  repairChecklistBlock,
  repairContextBlock,
  repairHistoryBlock,
} from "./prompt-blocks";
import { stageRepairGuidance } from "../llm/structured-chat";
import {
  ASSET_FEWSHOT,
  COPYWRITING_FEWSHOT,
  ECONOMY_FEWSHOT,
  SCENE_FEWSHOT,
  SCENE_REPAIR_FEWSHOT,
  STORY_FEWSHOT,
  UI_FEWSHOT,
} from "./prompt-fewshots";

export function buildIntentPrompt(brief: PersonaInput, repairContext?: string) {
  return `
You are the intent recognition node for a Game Agent. Decide what this round should solve first.
${jsonOnlyInstruction(["taskDefinition", "successSignals", "coreConstraints", "riskHypotheses", "recommendedFlow"])}

Requirements:
- Think like a game producer preparing a small-scope prototype review.
- If repair context exists, absorb the repair reasons instead of repeating round-one planning.
- recommendedFlow must be a short ordered list of concrete steps.
${briefBlock(brief)}
${repairContextBlock(repairContext)}
`.trim();
}

export function buildPlannerWithIntentPrompt(brief: PersonaInput, intent: IntentAnalysis, repairContext?: string) {
  return `
You are the planning node for a Game Agent. Break the current goal into a dependency-aware and partially parallel plan.
${jsonOnlyInstruction(["goalUnderstanding", "successCriteria", "keyRisks", "taskBreakdown", "parallelPlan", "checklist", "nextDecision"])}

Requirements:
- Every item in taskBreakdown must include step, purpose, output, and dependsOn.
- parallelPlan should only include genuinely parallel batches.
- In repair rounds, prefer targeted repair over full regeneration.
${briefBlock(brief)}
${jsonBlock("Current intent analysis", intent)}
${repairContextBlock(repairContext)}
`.trim();
}

export function buildToolSelectionPrompt(
  brief: PersonaInput,
  intent: IntentAnalysis,
  plan: AgentPlan,
  iteration: number,
  repairPlan?: RepairPlan | null,
) {
  return `
You are the tool-selection node for a Game Agent. Choose the smallest necessary tool set for this round.
${jsonOnlyInstruction(["roundGoal", "toolQueue", "callReasons", "parallelBatches"])}

Available tools:
- gameplay_tool
- economy_tool
- system_design_tool
- proposal_tool
- scene_design_tool
- ui_architecture_tool
- story_tool
- character_tool
- asset_manifest_tool
- copywriting_tool
- layout_tool
- timeline_tool

Dependency hints:
- economy_tool and system_design_tool depend on gameplay_tool
- proposal_tool depends on gameplay/economy/system
- scene_design_tool depends on plan/gameplay/system/proposal
- ui_architecture_tool depends on plan/system/scene
- story_tool depends on plan/proposal/system
- character_tool depends on plan/system/story
- asset_manifest_tool depends on plan/proposal/economy/scene/ui/story/character
- copywriting_tool depends on plan/proposal/economy/scene/ui/story/character/asset_manifest
- layout_tool depends on scene/ui/character/asset_manifest
- timeline_tool depends on story/copywriting/layout

Repair hints:
- Missing role cards: prefer character_tool
- Story/role mismatch: prefer story_tool, then character_tool if needed
- UI/scene mismatch: prefer ui_architecture_tool, then scene_design_tool if needed
- Missing asset carriers for tickets, decorations, event art, or portraits: prefer asset_manifest_tool
- Copy mismatch against story/UI/assets: prefer copywriting_tool, then upstream tools if needed
- Missing engine targets or runtime anchors: prefer layout_tool
- Missing event timing or trigger sequencing: prefer timeline_tool

Output requirements:
- dependency must be a single string, not an array
- toolQueue must contain only tools that really need to run this round
${briefBlock(brief)}
${jsonBlock("Current intent analysis", intent)}
${jsonBlock("Current plan", plan)}
${jsonBlock("Current repair plan", repairPlan ?? null)}
Current iteration: ${iteration}
`.trim();
}

export function buildGameplayToolPrompt(brief: PersonaInput, plan: AgentPlan, iteration: number, repairPlan?: RepairPlan | null, previousBaseline?: unknown) {
  return `
You are gameplay_tool. Output the gameplay structure for the current prototype slice.
${jsonOnlyInstruction(["oneSentenceLoop", "mainLoop", "subLoops", "clickPath", "feedbackRhythm", "failRecover", "testFocus", "loopEntities", "loopActions"])}
${productionGradeInstruction("gameplay_tool", ["map the core loop into state transitions", "make click path runnable in HTML5 interaction design", "fit short-session prototype testing", "define reusable entities for downstream system, scene, asset, layout, and copy tools"])}

Requirements:
- Each item should describe one action or one feedback beat.
- failRecover should not rely on punitive systems.
  - loopEntities must include the core playable or interactable entities in this prototype slice.
  - loopActions must use actorEntityId and targetEntityId from loopEntities.entityId.
  - Prefer stable entity IDs that can survive downstream runtime assembly.
  - entityName must be meaningful and reusable. Do not use placeholder names like facility_1, building_2, or entity_3 when a real runtime carrier name is available.
  - Make the runtime entity set complete enough for downstream system, scene, asset, layout, and copy tools.
- If the design implies management or simulation, include a compact but complete set of facilities or buildings, at least one expansion or build carrier, one event or activity carrier, one hotspot, and one resource token.
- loopActions should make the production -> order -> reward -> upgrade or expansion path explicit.
${briefBlock(brief)}
${jsonBlock("Current plan", plan)}
${repairChecklistBlock(repairPlan, stageRepairGuidance("gameplay_tool"))}
${previousOutputBlock(previousBaseline)}
Current iteration: ${iteration}
`.trim();
}

export function buildEconomyToolPrompt(
  brief: PersonaInput,
  plan: AgentPlan,
  gameplay: GameplayStructure,
  iteration: number,
  repairPlan?: RepairPlan | null,
  genreProfile?: GenreFeatureProfile | null,
  previousBaseline?: unknown,
) {
  return `
You are economy_tool. Output the economy structure for the current prototype slice.
${jsonOnlyInstruction([
    "coreCurrencies",
    "faucets",
    "sinks",
    "orderCostLoop",
    "upgradeThresholds",
    "decorationUnlocks",
    "monetizationHooks",
    "pacingControls",
  ])}
${productionGradeInstruction("economy_tool", ["orders, rewards, and upgrades must form a closed loop", "output should be close to a balancing table", "expansion tickets and limited decoration hooks must map into assets and copy"])}
${ECONOMY_FEWSHOT}
${genreOptionalFieldsBlock(genreProfile)}
Requirements:
- coreCurrencies must include at least one basic operating currency and one expansion or event progression currency.
- faucets, sinks, and upgradeThresholds should each contain at least 3 items aligned with the main loop.
- orderCostLoop must explicitly describe the closed loop from order reward to reinvestment to stronger future orders.
- 【专业数值要求】economy_tool 的输出必须达到专业策划级别：
  - orderCostLoop 必须包含具体的数值公式，例如"单笔订单收益 = 基础报酬 × 菜品等级系数(1.0/1.3/1.6) + 小费随机(0~20%基础报酬)"。
  - upgradeThresholds 每条须注明具体花费数额和解锁条件，例如"经营等级3级(累计收入≥500金币)时花费200金币+2扩建券解锁二号摊位升级"。
  - faucets 和 sinks 需量化每次产出/消耗范围，例如"每笔订单产出15~40金币"。
  - pacingControls 需描述数值曲线，例如"前10单利润率约60%，中期(11~30单)利润率下降到35%以维持扩建需求"。
  - 如有成长曲线或平衡公式，必须用简洁的数学表达式写出(如 cost = base × 1.15^level)。
- decorationUnlocks and monetizationHooks should mention expansion tickets, limited decorations, or equivalent prototype hooks when relevant.
- pacingControls should describe at least early-stage and mid-stage pacing.
  - If gameplay exposes resource_token entities or named order/build carriers, explicitly map them into the economy layer through coreCurrencies, faucets, sinks, or orderCostLoop instead of leaving them implicit.
  - When gameplay defines a runtime resource entity, mention its exact entityId or exact entityName at least once in coreCurrencies, faucets, sinks, or orderCostLoop so downstream runtime mapping can prove the linkage.
  - Include concrete reward/cost language, not only abstract progression language. The economy output should make it obvious what the player earns, what they spend, and what stronger future orders or expansions become available.
- When repair feedback mentions missing carrier or currency coverage, preserve already valid economy items and add only the missing mappings, reward rules, or cost rules.
${briefBlock(brief)}
${jsonBlock("Current plan", plan)}
${jsonBlock("Gameplay structure", gameplay)}
${repairChecklistBlock(repairPlan, stageRepairGuidance("economy_tool"))}
${previousOutputBlock(previousBaseline)}
Current iteration: ${iteration}
`.trim();
}

export function buildSystemDesignPrompt(
  brief: PersonaInput,
  plan: AgentPlan,
  gameplay: GameplayStructure,
  economy: EconomyDesign | null,
  iteration: number,
  repairPlan?: RepairPlan | null,
  genreProfile?: GenreFeatureProfile | null,
  previousBaseline?: unknown,
) {
  return `
You are system_design_tool. Output the system design for the current prototype.
${jsonOnlyInstruction([
    "systemOverview",
    "managementSystem",
    "expansionSystem",
    "missionSystem",
    "eventSystem",
    "roleInteractionSystem",
    "collectionSystem",
    "socialLightSystem",
    "systemEntities",
    "systemToEntityMap",
  ])}
${productionGradeInstruction("system_design_tool", ["all systems must serve the main loop", "systems must map into scene and UI carriers", "role interaction should support character cards and dialogue", "system-level entities must stay reusable for scene, asset, layout, and interaction mapping"])}
${genreOptionalFieldsBlock(genreProfile)}

  Requirements:
  - Stay within the current prototype scope.
  - expansionSystem, eventSystem, and roleInteractionSystem must describe concrete interactions that can be placed into scene/UI/runtime layers.
  - systemEntities should extend or refine gameplay entities, not invent an unrelated world model.
  - systemToEntityMap must state which entities each system owns or exposes.
  - systemToEntityMap must be an array of objects with systemName, entityIds, and responsibility. Do not output a dictionary keyed by system name.
  - Do not collapse buildings, facilities, visitor-style actors, and event carriers into a single vague concept.
- If gameplay implies operation, expansion, collection, role interaction, or event packaging, systemEntities and systemToEntityMap must expose those carriers explicitly for scene and asset planning.
- Distinguish runtime carrier types clearly:
  - use resource_token for currencies, coupons, points, tickets, or materials,
  - use building or facility for visible scene carriers,
  - use activity_carrier for event boards, booths, banners, or similar visible event anchors.
  - If gameplay includes residents, customers, visitors, companions, or dialogue-facing roles, systemEntities must expose at least one character or visitor carrier and systemToEntityMap must attach it to roleInteractionSystem, eventSystem, or another loop-facing system.
  - Treat people-facing carriers as first-class runtime entities. A resident, customer, tourist, mayor, host, helper, or companion should usually be typed as character or visitor, not facility.
  - If an entityId or entityName already signals a people-facing carrier, preserve that role typing across repair rounds instead of collapsing it into a scene object.
  - systemToEntityMap must make those people-facing carriers actionable: they should appear in roleInteractionSystem, eventSystem, missionSystem, or another loop-facing system with a concrete responsibility.
  - Do not classify pure currencies or abstract resources as building or facility entities unless the design truly needs a visible scene object for them.
  - Do not mark resource-like entities as requiresLayout=true by default. Only do so when the resource itself must appear as a visible world object instead of only UI or reward feedback.
${briefBlock(brief)}
${jsonBlock("Current plan", plan)}
${jsonBlock("Gameplay structure", gameplay)}
${jsonBlock("Economy design", economy)}
${repairChecklistBlock(repairPlan, stageRepairGuidance("system_design_tool"))}
${previousOutputBlock(previousBaseline)}
Current iteration: ${iteration}
`.trim();
}

export function buildProposalToolPrompt(
  brief: PersonaInput,
  plan: AgentPlan,
  gameplay: GameplayStructure,
  economy: EconomyDesign,
  systems: SystemDesign,
  iteration: number,
  repairPlan?: RepairPlan | null,
  previousBaseline?: unknown,
) {
  return `
You are proposal_tool. Output a compact but production-usable prototype proposal.
${jsonOnlyInstruction([
    "systemArchitecture",
    "economySummary",
    "coreGameplaySummary",
    "majorSystems",
    "growthPlan",
    "liveOpsHooks",
    "prototypeScope",
    "prototypeMilestones",
    "riskNotes",
  ])}
${productionGradeInstruction("proposal_tool", ["keep scope small but complete", "align systems, economy, and milestone framing", "make downstream scene/UI/asset work executable"])}

Requirements:
- prototypeScope and prototypeMilestones must be concrete enough for downstream tools.
- riskNotes should focus on prototype execution and validation risks.
${briefBlock(brief)}
${jsonBlock("Current plan", plan)}
${jsonBlock("Gameplay structure", gameplay)}
${jsonBlock("Economy design", economy)}
${jsonBlock("System design", systems)}
${repairChecklistBlock(repairPlan, stageRepairGuidance("proposal_tool"))}
${previousOutputBlock(previousBaseline)}
Current iteration: ${iteration}
`.trim();
}

export function buildSceneToolPrompt(
  brief: PersonaInput,
  plan: AgentPlan,
  gameplay: GameplayStructure,
  systems: SystemDesign,
  proposal: GameProposal,
  iteration: number,
  repairPlan?: RepairPlan | null,
  currentSceneBaseline?: Pick<SceneDesign, "sceneZones" | "buildingSlots" | "sceneEntities" | "zoneEntityMap" | "buildingDefinitions"> | null,
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
  return `
You are scene_design_tool. Output a scene plan that can later feed layout and runtime binding.
${jsonOnlyInstruction(["sceneConcept", "sceneZones", "interactiveAreas", "buildingSlots", "navigationFlow", "stateTransitions", "contentHotspots", "sceneEntities", "zoneEntityMap", "buildingDefinitions"])}
${productionGradeInstruction("scene_design_tool", ["provide concrete scene carriers for systems", "name hotspots clearly so UI, copy, layout, and assets can reference them", "support later runtime layout binding", "define building and hotspot entities in a runtime-friendly way"])}
${SCENE_FEWSHOT}
${SCENE_REPAIR_FEWSHOT}
${genreOptionalFieldsBlock(genreProfile)}

Requirements:
- sceneZones, interactiveAreas, buildingSlots, and contentHotspots should be named as reusable identifiers for downstream tools.
- If repairPlan points out missing hotspots or missing carriers, add them explicitly instead of paraphrasing.
- sceneEntities should include buildings, facilities, hotspots, and activity carriers that must later appear in layout or assets.
- zoneEntityMap must map scene zones to entityIds from sceneEntities or upstream entities.
- buildingDefinitions must define the concrete building taxonomy and slot mapping for runtime assembly.
- buildingDefinitions should cover every building or facility entity that appears in systemEntities and requires layout.
- zoneEntityMap should explicitly place each runtime-relevant system entity into at least one scene zone.
- sceneEntities, zoneEntityMap, and buildingDefinitions must stay mutually aligned. Do not add an entity to only one structure and forget the others.
- Build the runtime carrier tables in this order: sceneEntities first, then zoneEntityMap, then buildingDefinitions for every layout-required building, facility, or activity carrier.
- In repair rounds, treat Current scene baseline as the existing valid package. Preserve already valid carriers and add the missing ones. Do not rewrite the scene into a narrower version that drops previously satisfied entities.
- In repair rounds, behave like a patch operation over the current baseline:
  1. keep existing valid rows,
  2. identify the missing entities from Scene repair focus,
  3. add those entities into sceneEntities,
  4. map them into zoneEntityMap,
  5. add or extend buildingDefinitions when layout is required.
- If an entity already exists correctly in the baseline, keep its identifier, zone placement, and building definition unless the repair focus explicitly says it is wrong.
- Never solve a missing-carrier issue by replacing the whole scene with a new concept. Keep the scene concept stable unless the repair focus explicitly says the concept itself is invalid.
- If the checker evidence names a missing entityId or entityName, reuse that exact identifier and place it into sceneEntities, zoneEntityMap, and buildingDefinitions when applicable.
- If a missing item is a building or facility, it must appear in buildingDefinitions with buildingId, buildingName, buildingType, slotName, gameplayPurpose, and upgradeHook.
- If a missing item is an activity_carrier with requiresLayout=true, it must also appear in buildingDefinitions as one canonical runtime carrier. Do not represent it only as a hotspot, banner mention, or loose content hotspot.
- For an activity_carrier repair, prefer one stable canonical building definition:
  - buildingId should be derived from the entityId and remain reusable across later repairs,
  - buildingName should visibly reflect the entityName,
  - buildingType should clearly indicate an event or activity carrier,
  - slotName should be a stable runtime slot name rather than a prose description.
- If the baseline already contains a loose alias for the same activity carrier, replace or align it to the canonical definition instead of adding a second competing carrier.
- Define a compact but complete scene carrier set. If the design implies expansion, visitor flow, event interaction, or decoration placement, the scene should expose concrete carriers for them.
- buildingDefinitions should name meaningful building or facility types instead of one generic shop whenever the gameplay implies more than one operational carrier.
- If Scene repair focus is present, resolve those failures by patching the three carrier tables together. Do not only fix one table.
- Before finalizing output, self-check all entities named in Scene repair focus:
  - are they present in sceneEntities?
  - are they mapped in zoneEntityMap?
  - if requiresLayout=true, do they appear in buildingDefinitions?
${briefBlock(brief)}
${jsonBlock("Current plan", plan)}
${jsonBlock("Gameplay structure", gameplay)}
${jsonBlock("System design", systems)}
${jsonBlock("Proposal", proposal)}
${repairChecklistBlock(repairPlan, stageRepairGuidance("scene_design_tool"))}
${jsonBlock("Current scene baseline", currentSceneBaseline ?? null)}
${jsonBlock("Scene repair focus", sceneRepairFocus ?? null)}
Current iteration: ${iteration}
`.trim();
}

export function buildSceneRepairPatchPrompt(
  brief: PersonaInput,
  systems: Pick<SystemDesign, "systemOverview" | "systemEntities" | "systemToEntityMap">,
  currentSceneBaseline: Pick<
    SceneDesign,
    | "sceneConcept"
    | "sceneZones"
    | "interactiveAreas"
    | "buildingSlots"
    | "contentHotspots"
    | "sceneEntities"
    | "zoneEntityMap"
    | "buildingDefinitions"
  >,
  sceneRepairFocus: {
    relatedEdges: string[];
    problemSummaries: string[];
    successConditions: string[];
    strictIdentifiers: string[];
    missingEntities: Array<{ entityId?: string; entityName?: string; entityType?: string }>;
    missingSceneEntities?: Array<{ entityId?: string; entityName?: string; entityType?: string }>;
    missingBuildingDefinitions?: Array<{ entityId?: string; entityName?: string; entityType?: string }>;
    problemLocationHints: Array<{ toolName: string; confidence: string; reason: string }>;
  },
) {
  return `
You are scene_design_repair_patch_tool.
You are not rewriting the full scene package.
You are producing a minimal additive patch over the current scene baseline.
${jsonOnlyInstruction([
    "preserveEntityIds",
    "appendSceneZones",
    "appendInteractiveAreas",
    "appendBuildingSlots",
    "appendContentHotspots",
    "appendSceneEntities",
    "appendZoneEntityMap",
    "appendBuildingDefinitions",
  ])}

Patch rules:
- Preserve the current scene baseline. Do not regenerate full arrays.
- Only append missing carriers required to satisfy Scene repair focus.
- Reuse exact entityId or entityName identifiers from Scene repair focus and system design.
- Prioritize the structured missingEntities list over broad narrative rewriting.
- When missingBuildingDefinitions is present, treat it as the highest-priority patch target and ensure those exact entities receive canonical building definitions first.
- Keep one stable building or facility carrier per layout-required entity. If the baseline already has conflicting carriers for the same entity, append the canonical replacement only once instead of generating multiple aliases.
- For any missing entity whose entityType is activity_carrier and requiresLayout=true:
  - append exactly one canonical building definition,
  - reuse the original entityId in the buildingId or a stable derivative of it,
  - reuse the original entityName in the buildingName or a close visible variant,
  - use an event/activity-oriented buildingType,
  - give it one stable slotName suitable for later layout and timeline binding.
- Do not solve an activity_carrier repair by only adding appendInteractiveAreas, appendContentHotspots, or appendSceneEntities. A canonical appendBuildingDefinitions row is mandatory.
  - For every missing entity, repair all required tables together:
    1. appendSceneEntities
    2. appendZoneEntityMap
    3. appendBuildingDefinitions when layout is required
  - If a missing entity is an activity_carrier, building, or facility with requiresLayout=true, appendBuildingDefinitions is mandatory. Do not rely on only appendSceneEntities or appendZoneEntityMap.
  - If an entity is already present correctly in the baseline, do not append a duplicate.
  - appendBuildingDefinitions should only contain the missing building or facility carriers, not the entire baseline.
- appendZoneEntityMap may either add a new zone row or extend an existing zone with missing entityIds.
- appendInteractiveAreas, appendBuildingSlots, and appendContentHotspots should only be used when the missing carrier truly needs a new visible surface.
- Keep the patch minimal, machine-mergeable, and runtime-friendly.

Self-check before output:
- Every strict identifier in Scene repair focus is either preserved or appended.
- Every missing entity in Scene repair focus is either already preserved in baseline or covered by the patch.
- Every appended layout-required entity appears in appendBuildingDefinitions.
- Every appended entity appears in appendZoneEntityMap.
- No layout-required entity is represented by multiple conflicting building definitions after this patch.
- Every activity_carrier with requiresLayout=true has one canonical building definition suitable for runtime binding.

${briefBlock(brief)}
${jsonBlock("System design", systems)}
${jsonBlock("Current scene baseline", currentSceneBaseline)}
${jsonBlock("Scene repair focus", sceneRepairFocus)}
`.trim();
}

export function buildUiToolPrompt(
  brief: PersonaInput,
  plan: AgentPlan,
  systems: SystemDesign,
  scene: SceneDesign,
  iteration: number,
  repairPlan?: RepairPlan | null,
  genreProfile?: GenreFeatureProfile | null,
  previousBaseline?: unknown,
) {
  return `
You are ui_architecture_tool. Output the information architecture and key panels for the current prototype.
${jsonOnlyInstruction(["topBar", "orderPanel", "taskPanel", "shopEntry", "eventEntry", "buildModePanel", "feedbackLayer"])}
${productionGradeInstruction("ui_architecture_tool", ["UI must map directly to scene hotspots and system entry points", "support runtime assembly", "avoid over-design beyond the prototype scope"])}
${UI_FEWSHOT}
${genreOptionalFieldsBlock(genreProfile)}

Requirements:
- buildModePanel must contain 2 to 4 discrete items and each item should name one build-mode UI element.
- If repairPlan mentions missing UI coverage for scene hotspots, add the exact missing entry points.
${briefBlock(brief)}
${jsonBlock("Current plan", plan)}
${jsonBlock("System design", systems)}
${jsonBlock("Scene design", scene)}
${repairChecklistBlock(repairPlan, stageRepairGuidance("ui_architecture_tool"))}
${previousOutputBlock(previousBaseline)}
Current iteration: ${iteration}
`.trim();
}

export function buildStoryToolPrompt(
  brief: PersonaInput,
  plan: AgentPlan,
  proposal: GameProposal,
  systems: SystemDesign,
  iteration: number,
  repairPlan?: RepairPlan | null,
  previousBaseline?: unknown,
) {
  return `
You are story_tool. Output a light narrative package that directly supports runtime beats, copywriting, and character cards.
${jsonOnlyInstruction(["storyPositioning", "worldSummary", "coreConflict", "characterRoster", "mainPlotBeats", "chapterAnchors", "emotionalTone"])}
${productionGradeInstruction("story_tool", ["provide clean role anchors for character cards", "keep chapter anchors reusable in copywriting and timeline", "do not drift into long-form branching narrative"])}
${STORY_FEWSHOT}

Requirements:
- characterRoster must be a pure array of role names only.
- characterRoster should contain 3-6 role names depending on the game complexity. Do NOT always default to exactly 3 — if the story implies support characters, visitors, or quest-givers, include them.
- chapterAnchors must contain at least 3 short reusable anchors for downstream tools.
- mainPlotBeats must contain at least 3 short reusable beats for downstream tools.
- chapterAnchors and mainPlotBeats must stay runtime-friendly, reusable, and concise instead of collapsing into one broad summary.
- If repairPlan says a role is missing or not mentioned, fix the roster and anchors explicitly.
- Use one consistent naming locale for role names. Do not mix English aliases and Chinese aliases in the same package.
- Every role in characterRoster must be referenced by at least one chapterAnchor or mainPlotBeat using the exact same role name.
- If a previous attempt failed because chapterAnchors were missing or too few, prioritize adding concrete chapterAnchors before rewriting other fields.
${briefBlock(brief)}
${jsonBlock("Current plan", plan)}
${jsonBlock("Proposal", proposal)}
${jsonBlock("System design", systems)}
${repairChecklistBlock(repairPlan, stageRepairGuidance("story_tool"))}
${previousOutputBlock(previousBaseline)}
Current iteration: ${iteration}
`.trim();
}

export function buildCharacterToolPrompt(
  brief: PersonaInput,
  plan: AgentPlan,
  systems: SystemDesign,
  story: StoryResult,
  iteration: number,
  repairPlan?: RepairPlan | null,
  previousBaseline?: unknown,
) {
  return `
You are character_tool. Output structured character cards that map directly to story anchors, interaction responsibilities, and visual production.
${jsonOnlyInstruction(["cards", "populationSummary", "entityRegistry"])}
${productionGradeInstruction("character_tool", ["cover every core role from the story roster", "map each role to interaction responsibility and visual keywords", "keep storyAnchors aligned to chapterAnchors or mainPlotBeats", "separate core roles, support roles, and visitor-style roles when relevant"])}

Requirements:
- The number of cards should match the story complexity: return 3-6 cards depending on how many named roles the story contains. Do NOT always default to exactly 3 — if characterRoster has 4-6 names, output a card for each.
- Every core role in characterRoster must have a corresponding card.
- storyAnchors must reference story.chapterAnchors or mainPlotBeats, not freeform role summaries.
- Each card must include entityId and characterCategory.
- populationSummary should summarize the current cast composition for downstream content and asset planning.
- entityRegistry should cover every returned card and any runtime-relevant visitor archetypes already implied by the story.
- If the current design implies ambient visitors, customers, support actors, or rotating event participants, represent them through characterCategory and populationSummary instead of ignoring them.
${briefBlock(brief)}
${jsonBlock("Current plan", plan)}
${jsonBlock("System design", systems)}
${jsonBlock("Story package", story)}
${repairChecklistBlock(repairPlan, stageRepairGuidance("character_tool"))}
${previousOutputBlock(previousBaseline)}
Current iteration: ${iteration}
`.trim();
}

export function buildAssetManifestPrompt(
  brief: PersonaInput,
  plan: AgentPlan,
  proposal: GameProposal,
  economy: EconomyDesign,
  scene: SceneDesign,
  ui: UIInformationArchitecture,
  story: StoryResult,
  characters: CharacterCard[],
  iteration: number,
  repairPlan?: RepairPlan | null,
  previousBaseline?: unknown,
) {
  return `
You are asset_manifest_tool. Output an executable asset manifest for image generation and HTML5 assembly.
${jsonOnlyInstruction(["visualStyle", "exportRules", "layeredRules", "assetGroups", "priorityOrder", "entityRegistry"])}
${productionGradeInstruction("asset_manifest_tool", ["map assets to concrete runtime carriers", "cover key scene, UI, role, and event needs", "stay inside current prototype scope", "bind every critical runtime asset back to entity IDs and runtime targets"])}
${ASSET_FEWSHOT}

Requirements:
- assetType must be one of: 角色立绘, 场景背景, 场景物件, 建筑单体, UI图标, UI面板, 活动插图, 装扮素材.
- 【场景背景硬性要求】assetGroups 中必须包含至少一个 assetType="场景背景" 的条目。场景背景是整个可玩区域的大底图，所有建筑坑位、交互热点、角色和道具都渲染在它上面。场景背景必须满足：
  - spec 应为宽屏比例（如 1920x1080 或 2560x1440），适合移动端横屏或竖屏构图。
  - layer 应为场景最底层（如 "scene-background"）。
  - runtimeTargets 应包含场景根容器或底层画布的引用。
  - deliveryScope 应为 "scene"。
  - 场景背景的构图和配色必须与 buildingSlots 和 sceneZones 的空间布局契合——建筑坑位和交互热点在背景上的位置应有视觉锚点或留白区域。
  - sourceDependencies 应引用场景设计的 sceneConcept 和相关 sceneZones。
- 【角色立绘硬性要求】story.characterRoster 中的每一个角色都必须有一个对应的"角色立绘"类型资产。如果 characterRoster 有 N 个角色，assetGroups 中必须至少有 N 个 assetType="角色立绘" 的条目，每个角色一个。不允许遗漏任何角色的立绘。
- Cover key buildings, key scene props, event carriers, UI entry assets, and role portraits when relevant.
- If repairPlan mentions missing activity entry, expansion ticket, limited decoration, or role art support, add explicit asset carriers.
- Every asset group must include entityIds, runtimeTargets, and deliveryScope.
- entityIds should reference upstream gameplay/system/scene/character entities whenever possible.
- runtimeTargets must be concrete enough for layout, interaction, or UI assembly.
- entityRegistry should summarize the asset-covered entities that matter to runtime output.
- Prefer a compact but complete manifest. If upstream tools define facilities, buildings, visitors, support characters, expansion carriers, or event carriers, the manifest should cover them instead of dropping them to keep the list small.
- Every upstream entity with requiresAsset=true must appear in entityRegistry and be covered by at least one asset group through entityIds or sourceDependencies.
- If an upstream entity is a visible resource token, event currency, reward currency, expansion currency, or similar runtime-facing token, create an explicit asset carrier for it instead of assuming text-only coverage.
- Resource or event tokens that players see in HUD, reward flyouts, event panels, or progress surfaces should usually use deliveryScope "ui" or "event" and include concrete runtimeTargets.
${briefBlock(brief)}
${jsonBlock("Current plan", plan)}
${jsonBlock("Proposal", proposal)}
${jsonBlock("Economy design", economy)}
${jsonBlock("Scene design", scene)}
${jsonBlock("UI architecture", ui)}
${jsonBlock("Story package", story)}
${jsonBlock("Character cards", characters)}
${repairChecklistBlock(repairPlan, stageRepairGuidance("asset_manifest_tool"))}
${previousOutputBlock(previousBaseline)}
Current iteration: ${iteration}
`.trim();
}

export function buildCopywritingPrompt(
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
  repairPlan?: RepairPlan | null,
  previousBaseline?: unknown,
) {
  return `
You are copywriting_tool. Output direct in-game copy aligned to scene targets, UI targets, role names, anchors, and asset labels.
${jsonOnlyInstruction([
    "pageTitles",
    "panelTitles",
    "buttonLabels",
    "taskAndOrderCopy",
    "eventEntryCopy",
    "sceneHints",
    "characterLines",
    "characterCardCopy",
    "assetLabels",
  ])}
${productionGradeInstruction("copywriting_tool", ["copy must be directly placeable in game pages and runtime events", "names and targets must stay aligned with upstream tools", "copy should support testing instead of writing lore paragraphs"])}
${COPYWRITING_FEWSHOT}

Requirements:
- Reuse exact role names, anchor names, UI target names, and asset-facing labels when those are identifiers.
- Keep prose natural, but keep identifiers exact.
- If repairPlan says a hotspot, anchor, or carrier is missing, add copy for that carrier explicitly.
- relatedEntity must stay short and machine-usable. Use one compact identifier such as a role name, hotspot name, chapter anchor, asset name, or entity identifier. Do not put full sentences in relatedEntity.
- Keep the copy package concise, but complete enough to cover critical page titles, order or task copy, event entry copy, scene hints, character-facing copy, and priority asset labels.
- Treat copy coverage as a runtime visibility checklist, not as optional flavor writing.
- Every core role name in story.characterRoster and character cards must appear verbatim in at least one visible copy carrier.
- At least 3 key story anchors or plot beats must be surfaced through taskAndOrderCopy, eventEntryCopy, characterLines, or sceneHints.
- If the economy contains expansion tickets, vouchers, coins, theme decorations, limited decorations, avatar frames, or bundle hooks, expose those terms verbatim in buttonLabels, eventEntryCopy, taskAndOrderCopy, or assetLabels.
- assetLabels must explicitly cover the priority assets from assetManifest.priorityOrder, not just generic UI labels.
- If a priority asset is a portrait, building, event panel, or reward carrier, produce an assetLabel or directly visible copy reference for it.
- If the current round is a repair round, preserve already valid copy items and add the missing labels, hooks, and cast references instead of rewriting the whole package into a shorter variant.
- Before finalizing, self-check:
  1. which roster names are already visible in copy,
  2. which anchors or beats are already visible,
  3. which priority assets have assetLabels,
  4. which economy hooks have visible labels or CTAs,
  5. add the missing ones before returning.
${briefBlock(brief)}
${jsonBlock("Current plan", plan)}
${jsonBlock("Proposal", proposal)}
${jsonBlock("Economy design", economy)}
${jsonBlock("Scene design", scene)}
${jsonBlock("UI architecture", ui)}
${jsonBlock("Story package", story)}
${jsonBlock("Character cards", characters)}
${jsonBlock("Asset manifest", assetManifest)}
${repairChecklistBlock(repairPlan, stageRepairGuidance("copywriting_tool"))}
${previousOutputBlock(previousBaseline)}
Current iteration: ${iteration}
`.trim();
}

export function buildEvaluatorPrompt(
  brief: PersonaInput,
  proposal: GameProposal,
  creativePack: {
    gameplay: GameplayStructure;
    economy: EconomyDesign;
    systems: SystemDesign;
    scene: SceneDesign;
    ui: UIInformationArchitecture;
    story: StoryResult;
    characters: CharacterCard[];
    assetManifest: AssetManifest;
    copywriting?: CopywritingPack | null;
  },
  blockedBySummary?: string,
) {
  return `
You are evaluation_tool. Evaluate whether the current prototype package is ready for a small-scope test.
${jsonOnlyInstruction(["scores", "totalScore", "summary", "risks", "recommendations", "hardGates", "blockedBy", "decision"])}

Requirements:
- Treat missing structural blockers as blockedBy items.
- hardGates must include booleans for loopsClear, economyClosedLoop, systemCoverage, sceneUiReady, storyCharacterAligned, and assetManifestExecutable.
- decision should distinguish between reject, revise, test, and prioritize-for-test outcomes.
${briefBlock(brief)}
${jsonBlock("Proposal", proposal)}
${jsonBlock("Creative pack", creativePack)}
Additional blockers: ${blockedBySummary || "None"}
`.trim();
}

export function buildVerificationPrompt(
  brief: PersonaInput,
  evaluation: unknown,
  consistencyReport: unknown,
  reviewHistory: unknown,
  iteration?: number,
) {
  return `
You are verification. Decide whether the current run should stop, proceed to repair, or finish.
${jsonOnlyInstruction(["passed", "issues", "needsRepair", "recommendedNextStep"])}

Requirements:
- If hard failures remain in the consistency report, passed must be false.
- recommendedNextStep should be a short but explicit instruction.
- Use evaluation and consistency together. Do not trust only one of them.
${briefBlock(brief)}
${jsonBlock("Evaluation", evaluation)}
${jsonBlock("Consistency report", consistencyReport)}
${jsonBlock("Review history", reviewHistory)}
Current iteration: ${iteration ?? 1}
`.trim();
}

export function buildRepairPlanPrompt(
  brief: PersonaInput,
  evaluation: unknown,
  consistencyReport: unknown,
  reviewHistory: unknown,
  iteration?: number,
) {
  return `
You are repair_tool. Create a repair plan for the next round.
${jsonOnlyInstruction(["repairGoal", "repairInstructions", "repairTools", "expectedImprovements", "recheckEdges"])}

Requirements:
- Prefer targeted repair over full regeneration.
- recheckEdges must list the consistency edges that should be re-validated after repair.
- expectedImprovements should be written as observable outcomes, not vague aspirations.
${briefBlock(brief)}
${jsonBlock("Evaluation", evaluation)}
${jsonBlock("Consistency report", consistencyReport)}
${jsonBlock("Review history", reviewHistory)}
Current iteration: ${iteration ?? 1}
`.trim();
}
