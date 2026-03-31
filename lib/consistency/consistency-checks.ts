import type {
  AssetManifest,
  CharacterCard,
  ConsistencyEdgeId,
  CopywritingPack,
  CreativePack,
  EconomyDesign,
  EntityRegistryItem,
  GameProposal,
  GameplayStructure,
  SceneDesign,
  StoryResult,
  SystemDesign,
  ToolName,
  UIInformationArchitecture,
} from "../schemas";
import type { Html5PreparationPackage } from "../html5-render-schemas";
import type {
  ConsistencyEdgeResult,
  RepairTask,
} from "../agent-consistency-schemas";
import { getSpec, getConsistencyEdgeGuide, EDGE_REASONING, EDGE_PROBLEM_SUMMARY, type ConsistencyArtifacts } from "./consistency-edge-defs";

export function uniqueStrings(values: string[], limit = 12) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, limit);
}

export function clampText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd();
}

export function clampStringList(values: string[], limit: number, maxLength: number) {
  return uniqueStrings(
    values
      .map((item) => clampText(item, maxLength))
      .filter(Boolean),
    limit,
  );
}

export function normalizeEntity(value: string) {
  return value
    .replace(/[\s"'`“”‘’（）()【】\[\]{}，。、,:：；!?]/g, "")
    .replace(/UI/g, "ui")
    .toLowerCase();
}

export function slugifyTarget(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function toLayoutTargetId(value: string) {
  return `target_${slugifyTarget(value) || "item"}`;
}

export function buildAnchorSearchKeys(anchor: string) {
  const raw = anchor.trim();
  const keys = new Set<string>();
  if (!raw) return [];
  keys.add(normalizeEntity(raw));
  const colonParts = raw.split(/[:：/]/).map((part) => part.trim()).filter(Boolean);
  for (const part of colonParts) keys.add(normalizeEntity(part));
  const clauseParts = raw.split(/[、，,；;]/).map((part) => part.trim()).filter(Boolean);
  for (const part of clauseParts) keys.add(normalizeEntity(part));
  return [...keys].filter((item) => item.length >= 2);
}

export function buildSceneSearchKeys(area: string) {
  const raw = area.trim();
  const variants = new Set<string>();
  const base = normalizeEntity(raw);
  if (!base) return [];
  variants.add(base);
  [/热区/g, /区域/g, /入口/g, /提示/g, /点击/g, /拖拽/g, /展示台/g, /展示点/g, /面板/g, /公告板/g].forEach((pattern) => {
    const next = base.replace(pattern, "");
    if (next.length >= 2) variants.add(next);
  });
  return [...variants];
}

export function buildAssetSearchKeys(assetName: string) {
  const raw = assetName.trim();
  const variants = new Set<string>();
  const base = normalizeEntity(raw);
  if (!base) return [];
  variants.add(base);
  [/角色立绘/g, /建筑单体/g, /ui图标/g, /ui面板/g, /活动插图/g, /装扮素材/g, /图标/g, /卡牌/g, /入口/g].forEach((pattern) => {
    const next = base.replace(pattern, "");
    if (next.length >= 2) variants.add(next);
  });
  return [...variants];
}

export function stringify(value: unknown) {
  return JSON.stringify(value, null, 0);
}

export function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function collectAssetDescriptors(assetManifest: AssetManifest) {
  return assetManifest.assetGroups.map((group) => ({
    assetName: group.assetName,
    assetType: group.assetType,
    purpose: group.purpose,
    entityIds: group.entityIds,
    runtimeTargets: group.runtimeTargets,
    sourceDependencies: group.sourceDependencies,
    normalizedAssetName: normalizeEntity(group.assetName),
    normalizedPurpose: normalizeEntity(group.purpose),
    normalizedEntityIds: group.entityIds.map((item) => normalizeEntity(item)).filter(Boolean),
    normalizedRuntimeTargets: group.runtimeTargets.map((item) => normalizeEntity(item)).filter(Boolean),
    normalizedDependencies: group.sourceDependencies.map((item) => normalizeEntity(item)).filter(Boolean),
  }));
}

export function buildEntityKeySet(items: Array<{ entityId?: string; entityName?: string }>) {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.entityId) keys.add(normalizeEntity(item.entityId));
    if (item.entityName) keys.add(normalizeEntity(item.entityName));
  }
  return keys;
}

export function collectSceneEntityKeys(scene: CreativePack["scene"]) {
  const keys = new Set<string>();
  for (const entity of scene.sceneEntities) {
    keys.add(normalizeEntity(entity.entityId));
    keys.add(normalizeEntity(entity.entityName));
  }
  for (const mapping of scene.zoneEntityMap) {
    keys.add(normalizeEntity(mapping.zoneName));
    for (const entityId of mapping.entityIds) keys.add(normalizeEntity(entityId));
  }
  for (const building of scene.buildingDefinitions) {
    keys.add(normalizeEntity(building.buildingId));
    keys.add(normalizeEntity(building.buildingName));
    keys.add(normalizeEntity(building.slotName));
  }
  return keys;
}

export function collectAssetEntityKeys(assetManifest: AssetManifest) {
  const keys = new Set<string>();
  for (const entity of assetManifest.entityRegistry) {
    keys.add(normalizeEntity(entity.entityId));
    keys.add(normalizeEntity(entity.entityName));
  }
  for (const descriptor of collectAssetDescriptors(assetManifest)) {
    descriptor.normalizedEntityIds.forEach((item) => keys.add(item));
    descriptor.normalizedDependencies.forEach((item) => keys.add(item));
    descriptor.normalizedRuntimeTargets.forEach((item) => keys.add(item));
    keys.add(descriptor.normalizedAssetName);
  }
  return keys;
}

export function assetMatchesEntity(assetManifest: AssetManifest, entity: string, extraKeywords: string[] = []) {
  const descriptors = collectAssetDescriptors(assetManifest);
  const normalizedEntity = normalizeEntity(entity);
  const normalizedKeywords = extraKeywords.map(normalizeEntity).filter(Boolean);
  return descriptors.some((descriptor) => {
    if (descriptor.normalizedDependencies.includes(normalizedEntity)) return true;
    if (descriptor.normalizedEntityIds.includes(normalizedEntity)) return true;
    if (descriptor.normalizedAssetName.includes(normalizedEntity) || descriptor.normalizedPurpose.includes(normalizedEntity)) return true;
    return normalizedKeywords.some(
      (keyword) =>
        descriptor.normalizedDependencies.includes(keyword) ||
        descriptor.normalizedEntityIds.includes(keyword) ||
        descriptor.normalizedAssetName.includes(keyword) ||
        descriptor.normalizedPurpose.includes(keyword) ||
        descriptor.normalizedRuntimeTargets.includes(keyword),
    );
  });
}

export function entityMatchesAssetRegistry(assetManifest: AssetManifest, entity: EntityRegistryItem, extraKeywords: string[] = []) {
  const descriptorMatches = assetMatchesEntity(assetManifest, entity.entityName, [entity.entityId, ...extraKeywords]);
  if (descriptorMatches) return true;
  const assetKeys = collectAssetEntityKeys(assetManifest);
  return assetKeys.has(normalizeEntity(entity.entityId)) || assetKeys.has(normalizeEntity(entity.entityName));
}

export function entityExistsInScene(scene: CreativePack["scene"], entity: EntityRegistryItem) {
  const sceneKeys = collectSceneEntityKeys(scene);
  return sceneKeys.has(normalizeEntity(entity.entityId)) || sceneKeys.has(normalizeEntity(entity.entityName));
}

export function buildingDefinitionMatchesEntity(scene: CreativePack["scene"], entity: EntityRegistryItem) {
  const entityKeys = [entity.entityId, entity.entityName]
    .map((value) => normalizeEntity(value))
    .filter(Boolean);
  return scene.buildingDefinitions.some((building) => {
    const buildingKeys = [building.buildingId, building.buildingName, building.slotName]
      .map((value) => normalizeEntity(value))
      .filter(Boolean);
    return entityKeys.some((entityKey) =>
      buildingKeys.some((buildingKey) => buildingKey === entityKey || buildingKey.includes(entityKey) || entityKey.includes(buildingKey)),
    );
  });
}

export function isResourceLikeEntity(entity: EntityRegistryItem) {
  const combined = [entity.entityId, entity.entityName, entity.functionalRole, entity.entityType]
    .map((item) => normalizeEntity(item))
    .join(" ");
  return /(resource|currency|token|coin|gold|point|coupon|ticket|material|energy|stamina|score|rating|stat|meter|gauge|value|值|度|声望|魅力|繁荣|好感|经验|等级|level|exp|reputation|fame|charm|prosperity|metric)/.test(combined);
}

export function isDecorOrZoneEntity(entity: EntityRegistryItem) {
  const combined = [entity.entityId, entity.entityName, entity.entityType, entity.functionalRole]
    .map((s) => normalizeEntity(s))
    .join(" ");
  return /(deco|decoration|ornament|lamp|banner|flag|poster|zone_|area_|region_)/.test(combined);
}

export function needsSceneCarrier(entity: EntityRegistryItem) {
  if (isDecorOrZoneEntity(entity)) return false;
  if (entity.entityType === "scene_hotspot" || entity.entityType === "building" || entity.entityType === "facility" || entity.entityType === "activity_carrier") {
    return !isResourceLikeEntity(entity) || entity.entityType === "activity_carrier";
  }
  if (entity.entityType === "resource_token") return false;
  return entity.requiresLayout && !isResourceLikeEntity(entity);
}

export function needsBuildingDefinition(entity: EntityRegistryItem) {
  if (entity.entityType === "building" || entity.entityType === "facility" || entity.entityType === "activity_carrier") {
    return !isResourceLikeEntity(entity) || entity.entityType === "activity_carrier";
  }
  return false;
}

export function collectCopyLines(copywriting?: CopywritingPack) {
  if (!copywriting) return [];
  return [
    ...copywriting.pageTitles,
    ...copywriting.panelTitles,
    ...copywriting.buttonLabels,
    ...copywriting.taskAndOrderCopy,
    ...copywriting.eventEntryCopy,
    ...copywriting.sceneHints,
    ...copywriting.characterLines,
    ...copywriting.characterCardCopy,
    ...copywriting.assetLabels,
  ];
}

export function buildEdgeResult(
  edgeId: ConsistencyEdgeId,
  pass: boolean,
  severity: "low" | "medium" | "high",
  issues: string[],
  involvedTools: ToolName[],
  evidence: string[] = [],
  problemLocationHints: ConsistencyEdgeResult["problemLocationHints"] = [],
): ConsistencyEdgeResult {
  const spec = getSpec(edgeId);
  return {
    edgeId,
    sourceTool: spec.sourceTool,
    targetTool: spec.targetTool,
    level: spec.level,
    pass,
    severity,
    issues: clampStringList(issues, 12, 220),
    evidence: clampStringList(evidence, 12, 220),
    involvedTools: Array.from(new Set(involvedTools)).slice(0, 4) as ToolName[],
    problemLocationHints: problemLocationHints.slice(0, 6).map((hint) => ({
      toolName: hint.toolName,
      confidence: hint.confidence,
      reason: clampText(hint.reason, 220),
    })),
    repairSuggestions: clampStringList(issues.map((item) => `Repair: ${item}`), 8, 220),
  };
}

export function isManagementSimGenre(targetGenre?: string): boolean {
  return !targetGenre || targetGenre === "模拟经营";
}

export function checkGameplayEconomy(creativePack: CreativePack, targetGenre?: string) {
  const issues: string[] = [];
  const evidence: string[] = [];
  const problemLocationHints: ConsistencyEdgeResult["problemLocationHints"] = [];
  const pushEvidence = (items: string[]) => {
    for (const it of items) {
      if (typeof it !== "string") continue;
      evidence.push(it.length > 220 ? `${it.slice(0, 217)}...` : it);
    }
  };
  const gameplayText = stringify(creativePack.gameplay);
  const economyText = stringify(creativePack.economy);
  const tokenEntities = creativePack.gameplay.loopEntities.filter((entity) => entity.entityType === "resource_token");
  if (isManagementSimGenre(targetGenre)) {
    if (!includesAny(gameplayText, ["订单", "经营", "扩建", "装扮"])) issues.push("Gameplay loop is missing order, management, expansion, or decoration signals.");
    if (!includesAny(economyText, ["订单", "金币", "升级", "装扮"])) issues.push("Economy design is missing rewards, upgrade costs, or decoration unlocks.");
  }
  if (creativePack.economy.coreCurrencies.length < 2) issues.push("Core currency count is too small.");
  if (creativePack.economy.faucets.length < 3) issues.push("Economy faucets are incomplete.");
  if (creativePack.economy.sinks.length < 3) issues.push("Economy sinks are incomplete.");
  if (creativePack.economy.upgradeThresholds.length < 3) issues.push("Upgrade thresholds are incomplete.");
  if (creativePack.economy.faucets.length < 3 || creativePack.economy.sinks.length < 3) {
    evidence.push(`Economy loop counts: faucets=${creativePack.economy.faucets.length}, sinks=${creativePack.economy.sinks.length}, currencies=${creativePack.economy.coreCurrencies.length}`);
  }
  if (creativePack.economy.upgradeThresholds.length < 3) {
    evidence.push(`Current upgrade thresholds: ${creativePack.economy.upgradeThresholds.join(" | ")}`);
  }
  if (creativePack.economy.orderCostLoop.length < 24) {
    evidence.push(`Current orderCostLoop: ${creativePack.economy.orderCostLoop}`);
    problemLocationHints.push({
      toolName: "economy_tool",
      confidence: "high",
      reason: "The order loop narrative does not yet prove how rewards, reinvestment, and stronger future orders connect.",
    });
  }
  if (isManagementSimGenre(targetGenre) && (!creativePack.economy.orderCostLoop.includes("订单") || creativePack.economy.orderCostLoop.length < 24)) issues.push("Order cost loop description is incomplete.");
  if (!isManagementSimGenre(targetGenre) && creativePack.economy.orderCostLoop.length < 24) issues.push("Economy core loop description is too short.");
  const uncoveredTokens = tokenEntities.filter(
    (entity) =>
      !creativePack.economy.coreCurrencies.some((item) => item.includes(entity.entityName) || item.includes(entity.entityId)) &&
      !economyText.includes(entity.entityName) &&
      !economyText.includes(entity.entityId),
  );
  if (uncoveredTokens.length) {
    issues.push(`Loop resource entities are not reflected by the economy layer: ${uncoveredTokens.map((entity) => entity.entityName).join(", ")}`);
    evidence.push(`Missing resource-token mapping: ${uncoveredTokens.slice(0, 6).map((entity) => `${entity.entityId}/${entity.entityName}`).join("; ")}`);
    problemLocationHints.push({
      toolName: "economy_tool",
      confidence: "high",
      reason: "Gameplay already defines runtime resource carriers, but the economy layer does not map them into currencies, faucets, sinks, or the order loop.",
    });
  }
  return buildEdgeResult("gameplay_economy", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["economy_tool", "gameplay_tool"], [
    creativePack.gameplay.oneSentenceLoop,
    creativePack.economy.orderCostLoop,
    ...evidence,
  ], problemLocationHints);
}

export function checkGameplaySystem(creativePack: CreativePack, targetGenre?: string) {
  const issues: string[] = [];
  const evidence: string[] = [];
  const problemLocationHints: ConsistencyEdgeResult["problemLocationHints"] = [];
  const systemEntityKeys = buildEntityKeySet(creativePack.systems.systemEntities);
  const mappedSystemEntityKeys = new Set(
    creativePack.systems.systemToEntityMap.flatMap((item) => item.entityIds.map((entityId) => normalizeEntity(entityId))),
  );
  if (isManagementSimGenre(targetGenre)) {
    if (!includesAny(stringify(creativePack.systems), ["经营", "任务", "活动"])) issues.push("System design is missing management, task, or event coverage.");
  } else {
    if (!includesAny(stringify(creativePack.systems), ["任务", "活动", "技能", "战斗", "探索", "抽卡", "关卡"])) issues.push("System design is missing task, event, or core mechanic coverage.");
  }
  if (includesAny(stringify(creativePack.gameplay), ["扩建"]) && !includesAny(stringify(creativePack.systems), ["扩建"])) issues.push("Gameplay emphasizes expansion but system design does not carry expansion.");
  if (includesAny(stringify(creativePack.gameplay), ["角色", "互动", "陪伴"]) && !includesAny(creativePack.systems.roleInteractionSystem, ["角色", "互动", "对话", "气泡"])) {
    issues.push("Gameplay includes role interaction, but the system layer does not carry it.");
  }
  const uncoveredLoopEntities = creativePack.gameplay.loopEntities
    .filter((entity) => !systemEntityKeys.has(normalizeEntity(entity.entityId)) && !systemEntityKeys.has(normalizeEntity(entity.entityName)))
    .filter((entity) => !mappedSystemEntityKeys.has(normalizeEntity(entity.entityId)));
  if (uncoveredLoopEntities.length) {
    issues.push(`Loop entities are not covered by system entities or mappings: ${uncoveredLoopEntities.slice(0, 5).map((entity) => entity.entityName).join(", ")}`);
    evidence.push(
      `Uncovered gameplay loop entities: ${uncoveredLoopEntities
        .slice(0, 5)
        .map((entity) => `${entity.entityId}/${entity.entityName}/${entity.entityType}`)
        .join("; ")}`,
    );
  }
  const buildingLikeCount = creativePack.systems.systemEntities.filter((entity) => entity.entityType === "building" || entity.entityType === "facility").length;
  const visitorLikeCount = creativePack.systems.systemEntities.filter((entity) => entity.entityType === "visitor" || entity.entityType === "character").length;
  const gameplayRoleLikeEntities = creativePack.gameplay.loopEntities.filter((entity) =>
    ["visitor", "character"].includes(entity.entityType) || includesAny(stringify(entity), ["璁垮", "瑙掕壊", "灞呮皯", "椤惧", "闄即", "浜掑姩", "瀵硅瘽"]),
  );
  const gameplayBuildLikeEntities = creativePack.gameplay.loopEntities.filter((entity) =>
    ["building", "facility"].includes(entity.entityType) || includesAny(stringify(entity), ["缁忚惀", "寤洪€?", "鎵╁缓", "搴楅摵", "璁炬柦"]),
  );
  evidence.push(
    `System entity type counts: building_or_facility=${buildingLikeCount}, visitor_or_character=${visitorLikeCount}, total=${creativePack.systems.systemEntities.length}`,
  );
  evidence.push(
    `Current system entities: ${creativePack.systems.systemEntities
      .slice(0, 8)
      .map((entity) => `${entity.entityId}/${entity.entityName}/${entity.entityType}`)
      .join("; ")}`,
  );
  if (gameplayRoleLikeEntities.length) {
    evidence.push(
      `Gameplay role-like entities: ${gameplayRoleLikeEntities
        .slice(0, 6)
        .map((entity) => `${entity.entityId}/${entity.entityName}/${entity.entityType}`)
        .join("; ")}`,
    );
  }
  if (gameplayBuildLikeEntities.length) {
    evidence.push(
      `Gameplay build-like entities: ${gameplayBuildLikeEntities
        .slice(0, 6)
        .map((entity) => `${entity.entityId}/${entity.entityName}/${entity.entityType}`)
        .join("; ")}`,
    );
  }
  if (includesAny(stringify(creativePack.gameplay), ["经营", "店", "建造", "扩建"]) && buildingLikeCount === 0) {
    issues.push("System entities do not expose any building or facility carrier for the gameplay loop.");
    evidence.push("Missing carrier type: building/facility. Gameplay implies operation, build, or expansion, but the system layer exposes no matching scene-facing carrier.");
    evidence.push(
      `Expected build-like carriers from gameplay: ${gameplayBuildLikeEntities
        .slice(0, 6)
        .map((entity) => `${entity.entityId}/${entity.entityName}`)
        .join("; ")}`,
    );
    problemLocationHints.push({
      toolName: "system_design_tool",
      confidence: "high",
      reason: "Gameplay already expects build or management carriers, but the system layer does not define matching building or facility entities.",
    });
  }
  if (includesAny(stringify(creativePack.gameplay), ["访客", "角色", "互动", "陪伴"]) && visitorLikeCount === 0) {
    issues.push("System entities do not expose any visitor or role carrier for the gameplay loop.");
    evidence.push("Missing carrier type: visitor/character. Gameplay implies people-facing interaction, but the system layer exposes no stable visitor or character entity.");
    evidence.push(
      `Expected role-like carriers from gameplay: ${gameplayRoleLikeEntities
        .slice(0, 6)
        .map((entity) => `${entity.entityId}/${entity.entityName}`)
        .join("; ")}`,
    );
    problemLocationHints.push({
      toolName: "system_design_tool",
      confidence: "high",
      reason: "Gameplay expects role or visitor interaction, but the system layer does not define matching people-facing carriers.",
    });
  }
  return buildEdgeResult(
    "gameplay_system",
    issues.length === 0,
    issues.length > 1 ? "high" : "medium",
    issues,
    ["system_design_tool", "gameplay_tool"],
    [creativePack.systems.systemOverview, ...evidence],
    problemLocationHints,
  );
}

export function checkSystemScene(creativePack: CreativePack) {
  const issues: string[] = [];
  const evidence: string[] = [];
  const problemLocationHints: ConsistencyEdgeResult["problemLocationHints"] = [];
  const pushEvidence = (items: string[]) => {
    for (const it of items) {
      if (typeof it !== "string") continue;
      evidence.push(it.length > 220 ? `${it.slice(0, 217)}...` : it);
    }
  };
  const systemsText = stringify(creativePack.systems);
  const sceneText = stringify(creativePack.scene);
  const mistypedLayoutEntities = creativePack.systems.systemEntities.filter(
    (entity) => isResourceLikeEntity(entity) && (entity.requiresLayout || entity.entityType === "building" || entity.entityType === "facility"),
  );
  const missingSceneEntities = creativePack.systems.systemEntities
    .filter((entity) => needsSceneCarrier(entity))
    .filter((entity) => !entityExistsInScene(creativePack.scene, entity));
  const missingBuildingDefinitions = creativePack.systems.systemEntities
    .filter((entity) => needsBuildingDefinition(entity))
    .filter((entity) => !buildingDefinitionMatchesEntity(creativePack.scene, entity));
  const conflictingBuildingDefinitions = creativePack.systems.systemEntities
    .filter((entity) => needsBuildingDefinition(entity) || needsSceneCarrier(entity))
    .map((entity) => {
      const matches = creativePack.scene.buildingDefinitions.filter((building) => {
        const candidates = [building.buildingId, building.buildingName, building.slotName].map(normalizeEntity);
        const entityKeys = [entity.entityId, entity.entityName].map(normalizeEntity);
        return entityKeys.some((key) => key && candidates.some((candidate) => candidate === key || candidate.includes(key) || key.includes(candidate)));
      });
      return { entity, matches };
    })
    .filter((item) => item.matches.length > 1);
  if (mistypedLayoutEntities.length) {
    issues.push(`System design is classifying resource-like entities as scene buildings or layout carriers: ${mistypedLayoutEntities.slice(0, 6).map((entity) => entity.entityName).join(", ")}`);
    pushEvidence(mistypedLayoutEntities.slice(0, 6).map((entity) => `Typing conflict: entityId=${entity.entityId}; entityName=${entity.entityName}; type=${entity.entityType}; requiresLayout=${String(entity.requiresLayout)}; functionalRole=${entity.functionalRole}`));
    problemLocationHints.push({
      toolName: "system_design_tool",
      confidence: "high",
      reason: "This entity looks like a resource or currency token, so the upstream system layer should classify it as a non-building carrier unless the design truly needs a visible world object.",
    });
  }
  if (includesAny(systemsText, ["扩建"]) && creativePack.scene.buildingSlots.length < 3) issues.push("Expansion exists in systems but scene building slots are insufficient.");
  if (includesAny(systemsText, ["活动"]) && !includesAny(sceneText, ["活动"])) issues.push("Event system exists but the scene layer has no event carrier.");
  if (includesAny(systemsText, ["角色互动"]) && !includesAny(sceneText, ["角色", "停留", "互动"])) issues.push("Role interaction has no scene carrier.");
  if (missingSceneEntities.length) {
    issues.push(`Scene is missing carriers for these system entities: ${missingSceneEntities.slice(0, 6).map((entity) => entity.entityName).join(", ")}`);
    pushEvidence(missingSceneEntities.slice(0, 6).map((entity) => `Missing scene carrier: entityId=${entity.entityId}; entityName=${entity.entityName}; type=${entity.entityType}; relatedSystems=${entity.relatedSystems.join("|")}`));
    problemLocationHints.push({
      toolName: "scene_design_tool",
      confidence: "high",
      reason: "System entities already exist, but the scene layer does not place them into sceneEntities or zoneEntityMap.",
    });
  }
  if (missingBuildingDefinitions.length) {
    issues.push(`Scene building definitions do not cover these building or facility entities: ${missingBuildingDefinitions.slice(0, 6).map((entity) => entity.entityName).join(", ")}`);
    pushEvidence(missingBuildingDefinitions.slice(0, 6).map((entity) => `Missing building definition: entityId=${entity.entityId}; entityName=${entity.entityName}; type=${entity.entityType}`));
    problemLocationHints.push({
      toolName: "scene_design_tool",
      confidence: "high",
      reason: "Scene output is missing buildingDefinitions for entities that the system layer already marked as building or facility carriers.",
    });
    problemLocationHints.push({
      toolName: "system_design_tool",
      confidence: "medium",
      reason: "If scene repair keeps failing, the system layer may be over-declaring layout-required entities or using unstable entity names.",
    });
  }
  if (conflictingBuildingDefinitions.length) {
    // Record as evidence/hint but do not add to issues — conflicting (redundant) carriers are not as critical as missing carriers
    pushEvidence(
      conflictingBuildingDefinitions.slice(0, 6).map((item) =>
        `Conflicting building definitions (informational): entityId=${item.entity.entityId}; entityName=${item.entity.entityName}; carriers=${item.matches
          .map((building) => `${building.buildingId}/${building.buildingName}/${building.slotName}`)
          .join("|")}`,
      ),
    );
    problemLocationHints.push({
      toolName: "scene_design_tool",
      confidence: "medium",
      reason: "The scene layer should keep one stable building or facility carrier per layout-required entity instead of generating multiple conflicting definitions.",
    });
  }
  if (mistypedLayoutEntities.length || missingSceneEntities.length || missingBuildingDefinitions.length || conflictingBuildingDefinitions.length) {
    pushEvidence([`Current sceneEntities: ${creativePack.scene.sceneEntities.slice(0, 12).map((entity) => `${entity.entityId}/${entity.entityName}`).join(", ")}`]);
    pushEvidence([`Current zoneEntityMap: ${creativePack.scene.zoneEntityMap.slice(0, 12).map((mapping) => `${mapping.zoneName}=>${mapping.entityIds.join("|")}`).join(", ")}`]);
    pushEvidence([`Current buildingDefinitions: ${creativePack.scene.buildingDefinitions.slice(0, 12).map((building) => `${building.buildingId}/${building.buildingName}/${building.slotName}`).join(", ")}`]);
  }
  return buildEdgeResult(
    "system_scene",
    issues.length === 0,
    issues.length > 1 ? "high" : "medium",
    issues,
    ["scene_design_tool", "system_design_tool"],
    [creativePack.scene.sceneConcept, ...evidence],
    problemLocationHints,
  );
}

export function checkSceneUi(creativePack: CreativePack) {
  const issues: string[] = [];
  const sceneText = stringify(creativePack.scene);
  const uiText = stringify(creativePack.ui);
  if (includesAny(sceneText, ["订单"]) && creativePack.ui.orderPanel.length < 2) issues.push("Scene contains order carriers but UI order panel is incomplete.");
  if (includesAny(sceneText, ["建造", "扩建"]) && creativePack.ui.buildModePanel.length < 2) issues.push("Scene contains build carriers but UI build mode panel is incomplete.");
  if (includesAny(sceneText, ["活动"]) && creativePack.ui.eventEntry.length < 2) issues.push("Scene contains event carriers but UI event entry is incomplete.");
  if (!includesAny(uiText, ["反馈", "飞字", "弹层", "提示"])) issues.push("UI layer lacks feedback carriers for scene actions.");
  return buildEdgeResult("scene_ui", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["ui_architecture_tool", "scene_design_tool"], [creativePack.ui.buildModePanel.join(" / ")]);
}

export function checkStoryCharacter(story: StoryResult, characters: CharacterCard[]) {
  const issues: string[] = [];
  const storyMentions = stringify([story.worldSummary, story.coreConflict, story.mainPlotBeats, story.chapterAnchors]);
  const names = new Set(characters.map((card) => card.name));
  const entityIds = new Set(characters.map((card) => normalizeEntity(card.entityId)).filter(Boolean));
  const anchorPool = [...story.chapterAnchors, ...story.mainPlotBeats];
  const normalizedAnchorPool = anchorPool.map((anchor) => normalizeEntity(anchor));
  const missingCards = story.characterRoster.filter((name) => !names.has(name));
  const unmentioned = story.characterRoster.filter((name) => !storyMentions.includes(name));
  const invalidAnchors = characters
    .filter((card) =>
      card.storyAnchors.some((anchor) => {
        const normalized = normalizeEntity(anchor);
        return !normalizedAnchorPool.some((candidate) => candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate));
      }),
    )
    .map((card) => card.name);
  const missingEntityIds = characters.filter((card) => !card.entityId || !entityIds.has(normalizeEntity(card.entityId))).map((card) => card.name);
  const rosterWithoutCoreCards = characters.filter((card) => card.characterCategory === "core").map((card) => card.name).filter((name) => !story.characterRoster.includes(name));
  if (missingCards.length) issues.push(`Story roster is missing character cards: ${missingCards.join(", ")}`);
  if (unmentioned.length) issues.push(`Core roster names are not actually referenced by story text: ${unmentioned.join(", ")}`);
  if (invalidAnchors.length) issues.push(`Character cards reference invalid story anchors: ${invalidAnchors.join(", ")}`);
  if (missingEntityIds.length) issues.push(`Character cards are missing stable entityId bindings: ${missingEntityIds.join(", ")}`);
  if (rosterWithoutCoreCards.length) issues.push(`Core character cards are not present in the story roster: ${rosterWithoutCoreCards.join(", ")}`);
  return buildEdgeResult("story_character", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["character_tool", "story_tool"], [...story.characterRoster, ...story.chapterAnchors]);
}

export function checkProposalAsset(proposal: GameProposal, assetManifest: AssetManifest) {
  const issues: string[] = [];
  const proposalText = stringify(proposal);
  const missingRequiredAssets = assetManifest.entityRegistry.filter((entity) => entity.requiresAsset).filter((entity) => !entityMatchesAssetRegistry(assetManifest, entity)).map((entity) => entity.entityName);
  if (assetManifest.assetGroups.length < 5) issues.push("Asset manifest is too small for the prototype scope.");
  if (!includesAny(proposalText, ["活动", "装扮"]) && includesAny(stringify(assetManifest), ["活动", "装扮"])) issues.push("Asset manifest exceeds the prototype scope defined by the proposal.");
  if (missingRequiredAssets.length) issues.push(`Required asset-backed entities are missing from the asset manifest: ${missingRequiredAssets.slice(0, 6).join(", ")}`);
  return buildEdgeResult("proposal_asset", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["asset_manifest_tool", "proposal_tool"], assetManifest.priorityOrder);
}

export function checkAssetCoverage(creativePack: CreativePack, source: "scene" | "ui" | "story" | "character") {
  const issues: string[] = [];
  const problemLocationHints: ConsistencyEdgeResult["problemLocationHints"] = [];
  if (source === "scene") {
    const sceneEntities = uniqueStrings([...creativePack.scene.sceneZones, ...creativePack.scene.interactiveAreas, ...creativePack.scene.contentHotspots], 10);
    const missing = sceneEntities.filter((entity) => !assetMatchesEntity(creativePack.assetManifest, entity, ["场景", "区域", "建筑", "热区", "面板", "图标"]));
    const missingBuildings = creativePack.scene.buildingDefinitions.filter((building) => !assetMatchesEntity(creativePack.assetManifest, building.buildingName, [building.buildingId, building.slotName])).map((building) => building.buildingName);
    const missingSceneEntityAssets = creativePack.scene.sceneEntities
      .filter((entity) => entity.requiresAsset)
      .filter((entity) => !entityMatchesAssetRegistry(creativePack.assetManifest, entity, [entity.entityId]))
      .map((entity) => entity.entityName);
    // Allow tolerance: only flag as issue if >1/3 of items are missing (LLM naming variance is expected)
    const missingThreshold = (total: number) => Math.max(1, Math.ceil(total / 3));
    if (missing.length > missingThreshold(sceneEntities.length)) issues.push(`Scene carriers are missing asset support: ${missing.slice(0, 5).join(", ")}`);
    if (missingBuildings.length > missingThreshold(creativePack.scene.buildingDefinitions.length)) issues.push(`Building definitions are missing asset coverage: ${missingBuildings.slice(0, 5).join(", ")}`);
    if (missingSceneEntityAssets.length > missingThreshold(creativePack.scene.sceneEntities.filter((e) => e.requiresAsset).length)) issues.push(`Scene entities that require assets are not covered by the manifest: ${missingSceneEntityAssets.slice(0, 6).join(", ")}`);
    if (issues.length > 0) {
      problemLocationHints.push({
        toolName: "asset_manifest_tool",
        confidence: "high",
        reason: "The asset manifest is missing carriers that the scene layer already defined.",
      });
      problemLocationHints.push({
        toolName: "scene_design_tool",
        confidence: "medium",
        reason: "If the asset layer cannot cover the scene carriers cleanly, scene naming or carrier granularity may be unstable.",
      });
    }
  }
  if (source === "ui") {
    const required = [
      ...creativePack.ui.orderPanel.slice(0, 2).map((entity) => ({ entity, keywords: ["订单", "公告板", "面板", "图标"] })),
      ...creativePack.ui.buildModePanel.slice(0, 2).map((entity) => ({ entity, keywords: ["建造", "扩建", "空地", "面板", "图标"] })),
      ...creativePack.ui.eventEntry.slice(0, 2).map((entity) => ({ entity, keywords: ["活动", "入口", "卡片", "海报", "KV", "图标", "面板"] })),
    ];
    const missing = required.filter(({ entity, keywords }) => !assetMatchesEntity(creativePack.assetManifest, entity, keywords)).map((item) => item.entity);
    if (missing.length) issues.push(`UI carriers are missing asset support: ${missing.join(", ")}`);
  }
  if (source === "story") {
    const missing = creativePack.story.chapterAnchors.filter((anchor) => !assetMatchesEntity(creativePack.assetManifest, anchor, ["活动", "插图", "包装"]));
    if (missing.length) issues.push(`Story anchors are missing event or packaging assets: ${missing.slice(0, 4).join(", ")}`);
  }
  if (source === "character") {
    const missing = creativePack.characters.filter((card) => {
      const entity: EntityRegistryItem = {
        entityId: card.entityId,
        entityName: card.name,
        entityType: card.characterCategory === "visitor" ? "visitor" : "character",
        functionalRole: card.interactionResponsibility,
        isCore: card.characterCategory === "core",
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: card.relatedSystems,
        relatedScenes: card.spawnContext ?? [],
      };
      return !entityMatchesAssetRegistry(creativePack.assetManifest, entity, ["角色", "立绘", "角色卡"]);
    }).map((card) => card.name);
    if (missing.length) issues.push(`Character carriers are missing portrait or card assets: ${missing.join(", ")}`);
  }
  return buildEdgeResult(
    `${source}_asset` as ConsistencyEdgeId,
    issues.length === 0,
    issues.length > 1 ? "high" : "medium",
    issues,
    source === "scene" ? ["asset_manifest_tool", "scene_design_tool"] : ["asset_manifest_tool"],
    issues,
    problemLocationHints,
  );
}

export function checkProposalStory(proposal: GameProposal, story: StoryResult) {
  const issues: string[] = [];
  if (proposal.projectPositioning.includes("轻量") && story.mainPlotBeats.length > 6) issues.push("Story packaging is too heavy for a lightweight prototype.");
  return buildEdgeResult("proposal_story", issues.length === 0, "low", issues, ["story_tool"], [proposal.projectPositioning, story.storyPositioning]);
}

export function checkProposalUi(proposal: GameProposal, ui: CreativePack["ui"]) {
  const issues: string[] = [];
  if (proposal.prototypeScope.includes("单主场景") && ui.topBar.length + ui.orderPanel.length + ui.taskPanel.length > 16) {
    issues.push("UI scope is too heavy for a single-scene prototype.");
  }
  return buildEdgeResult("proposal_ui", issues.length === 0, "low", issues, ["ui_architecture_tool"], [proposal.prototypeScope]);
}

export function checkEconomyAsset(economy: CreativePack["economy"], assetManifest: AssetManifest) {
  const issues: string[] = [];
  const economyText = stringify(economy);
  if (/扩建券|扩建材料|扩建许可|扩建道具/.test(economyText) && !assetMatchesEntity(assetManifest, "扩建券", ["扩建材料", "扩建许可", "礼包", "图标", "面板"])) {
    issues.push("Economy includes expansion ticket or expansion material concepts, but the asset manifest has no matching carrier.");
  }
  if (/限定装饰|主题装饰|节庆装饰|首购礼包|限定礼包/.test(economyText) && !assetMatchesEntity(assetManifest, "限定装饰", ["主题装饰", "节庆装饰", "首购礼包", "限定礼包", "活动插图", "装扮素材"])) {
    issues.push("Economy includes limited decoration or bundle hooks, but the asset manifest lacks matching carriers.");
  }
  return buildEdgeResult("economy_asset", issues.length === 0, "low", issues, ["asset_manifest_tool", "economy_tool"], [economy.orderCostLoop]);
}

export function checkStoryCopywriting(story: StoryResult, copywriting?: CopywritingPack) {
  const issues: string[] = [];
  const text = normalizeEntity(stringify(collectCopyLines(copywriting).map((line) => ({ target: line.target, text: line.text, relatedEntity: line.relatedEntity, usage: line.usage }))));
  const missingCharacters = story.characterRoster.filter((name) => !text.includes(normalizeEntity(name)));
  const missingAnchors = story.chapterAnchors.filter((anchor) => buildAnchorSearchKeys(anchor).every((key) => !text.includes(key))).slice(0, 3);
  if (!copywriting) issues.push("Copywriting output is missing, so story-copy consistency cannot be checked.");
  if (missingCharacters.length) issues.push(`Copy does not cover core roster names: ${missingCharacters.join(", ")}`);
  if (missingAnchors.length) issues.push(`Copy does not surface key story anchors: ${missingAnchors.join(", ")}`);
  return buildEdgeResult("story_copywriting", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["copywriting_tool", "story_tool"], [...story.characterRoster, ...story.chapterAnchors]);
}

export function checkCharacterCopywriting(characters: CharacterCard[], copywriting?: CopywritingPack) {
  const issues: string[] = [];
  const text = stringify(collectCopyLines(copywriting));
  const missingNames = characters.map((card) => card.name).filter((name) => !text.includes(name));
  if (!copywriting) issues.push("Copywriting output is missing, so character-copy consistency cannot be checked.");
  if (missingNames.length) issues.push(`Character copy does not cover these names: ${missingNames.join(", ")}`);
  return buildEdgeResult("character_copywriting", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["copywriting_tool", "character_tool"], characters.map((card) => card.name));
}

export function checkSceneCopywriting(scene: CreativePack["scene"], copywriting?: CopywritingPack) {
  const issues: string[] = [];
  const problemLocationHints: ConsistencyEdgeResult["problemLocationHints"] = [];
  const hints = collectCopyLines(copywriting).filter((item) => item.surface === "场景提示");
  const normalizedText = normalizeEntity(stringify(hints.map((item) => ({ target: item.target, text: item.text, relatedEntity: item.relatedEntity }))));
  const required = uniqueStrings([...scene.interactiveAreas, ...scene.contentHotspots], 6);
  const missing = required.filter((area) => buildSceneSearchKeys(area).every((variant) => !normalizedText.includes(variant)));
  if (!copywriting) issues.push("Copywriting output is missing, so scene-copy consistency cannot be checked.");
  if (missing.length) issues.push(`Scene hint copy is missing for critical hotspots: ${missing.slice(0, 4).join(", ")}`);
  if (missing.length) {
    problemLocationHints.push({
      toolName: "copywriting_tool",
      confidence: "high",
      reason: "Copy is missing scene hotspots that already exist in the scene layer.",
    });
    problemLocationHints.push({
      toolName: "scene_design_tool",
      confidence: "medium",
      reason: "If copy cannot refer to the scene hotspots consistently, the scene carriers may be named too loosely or inconsistently.",
    });
  }
  return buildEdgeResult(
    "scene_copywriting",
    issues.length === 0,
    issues.length > 1 ? "high" : "medium",
    issues,
    ["copywriting_tool", "scene_design_tool"],
    required,
    problemLocationHints,
  );
}

export function checkUiCopywriting(ui: CreativePack["ui"], copywriting?: CopywritingPack) {
  const issues: string[] = [];
  const buttonText = stringify(copywriting?.buttonLabels ?? []);
  if (!copywriting) issues.push("Copywriting output is missing, so UI-copy consistency cannot be checked.");
  if (ui.orderPanel.length > 0 && !/订单/.test(buttonText)) issues.push("UI contains order carriers but button copy does not reference orders.");
  if (ui.buildModePanel.length > 0 && !/建造|扩建/.test(buttonText)) issues.push("UI contains build carriers but button copy does not reference build or expansion.");
  if (ui.eventEntry.length > 0 && (copywriting?.eventEntryCopy.length ?? 0) === 0) issues.push("UI contains event entry carriers but event entry copy is missing.");
  return buildEdgeResult("ui_copywriting", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["copywriting_tool", "ui_architecture_tool"], [...ui.orderPanel, ...ui.eventEntry]);
}

export function checkAssetCopywriting(assetManifest: AssetManifest, copywriting?: CopywritingPack) {
  const issues: string[] = [];
  const labels = normalizeEntity(stringify((copywriting?.assetLabels ?? []).map((item) => ({ target: item.target, text: item.text, relatedEntity: item.relatedEntity }))));
  const prioritySet = new Set(assetManifest.priorityOrder.slice(0, 4));
  const keyAssets = assetManifest.assetGroups.filter((item) => prioritySet.has(item.assetName)).slice(0, 4);
  const targetAssets = keyAssets.length > 0 ? keyAssets : assetManifest.assetGroups.slice(0, 4);
  const missing = targetAssets.filter((item) => buildAssetSearchKeys(item.assetName).every((key) => !labels.includes(key)));
  if (!copywriting) issues.push("Copywriting output is missing, so asset-copy consistency cannot be checked.");
  if (missing.length) issues.push(`Asset labels do not cover priority assets: ${missing.map((item) => item.assetName).join(", ")}`);
  return buildEdgeResult("asset_copywriting", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["copywriting_tool", "asset_manifest_tool"], targetAssets.map((item) => item.assetName));
}

export function checkEconomyCopywriting(economy: CreativePack["economy"], copywriting?: CopywritingPack) {
  const issues: string[] = [];
  const text = stringify(copywriting);
  const economyText = stringify(economy);
  if (!copywriting) issues.push("Copywriting output is missing, so economy-copy consistency cannot be checked.");
  if (/扩建券/.test(economyText) && !text.includes("扩建券")) issues.push("Economy includes expansion ticket concepts, but copy does not expose the term.");
  if (/限定装饰|主题装饰|节庆装饰/.test(economyText) && !/限定装饰|主题装饰|节庆装饰/.test(text)) issues.push("Economy includes themed decoration concepts, but copy does not expose them.");
  return buildEdgeResult("economy_copywriting", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["copywriting_tool", "economy_tool"], [...economy.coreCurrencies, ...economy.monetizationHooks]);
}

export function checkProposalCopywriting(proposal: GameProposal, copywriting?: CopywritingPack) {
  const issues: string[] = [];
  if (copywriting && /小范围测试|原型/.test(proposal.roundFocus) && collectCopyLines(copywriting).length > 80) issues.push("Copy volume is too heavy for the current prototype scope.");
  return buildEdgeResult("proposal_copywriting", issues.length === 0, "low", issues, ["copywriting_tool"], [proposal.roundFocus]);
}

export function checkGameplayCopywriting(gameplay: CreativePack["gameplay"], copywriting?: CopywritingPack) {
  const issues: string[] = [];
  if (copywriting) {
    const text = stringify(copywriting.taskAndOrderCopy);
    if (gameplay.mainLoop.some((item) => item.includes("订单")) && !text.includes("订单")) issues.push("Gameplay emphasizes an order loop, but order/task copy does not carry it.");
  }
  return buildEdgeResult("gameplay_copywriting", issues.length === 0, "low", issues, ["copywriting_tool"], gameplay.mainLoop);
}

export function checkSystemCopywriting(systems: CreativePack["systems"], copywriting?: CopywritingPack) {
  const issues: string[] = [];
  if (copywriting) {
    const text = stringify(copywriting);
    if (systems.eventSystem.includes("活动") && !text.includes("活动")) issues.push("Systems include events, but copy has no event carriers.");
  }
  return buildEdgeResult("system_copywriting", issues.length === 0, "low", issues, ["copywriting_tool"], [systems.eventSystem]);
}

export function collectLayoutTargets(html5Preparation?: Html5PreparationPackage) {
  if (!html5Preparation?.layoutConfig) return new Set<string>();
  return new Set(html5Preparation.layoutConfig.scenes.flatMap((scene) => scene.elements.map((element) => element.targetId)));
}

export function collectInteractionTargets(html5Preparation?: Html5PreparationPackage) {
  if (!html5Preparation?.interactionConfig) return new Set<string>();
  return new Set(html5Preparation.interactionConfig.bindings.map((binding) => binding.targetId));
}

export function checkSceneLayout(scene: CreativePack["scene"], html5Preparation?: Html5PreparationPackage) {
  const issues: string[] = [];
  if (!html5Preparation?.layoutConfig) {
    issues.push("layoutConfig is missing.");
    return buildEdgeResult("scene_layout", false, "high", issues, ["layout_tool", "scene_design_tool"]);
  }
  const targetIds = collectLayoutTargets(html5Preparation);
  const missing = [...scene.sceneZones, ...scene.interactiveAreas].filter((item) => !targetIds.has(toLayoutTargetId(item))).slice(0, 6);
  if (missing.length) issues.push(`Scene zones or hotspots are missing from layout: ${missing.join(", ")}`);
  return buildEdgeResult("scene_layout", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["layout_tool", "scene_design_tool"], [...scene.sceneZones, ...scene.interactiveAreas]);
}

export function checkUiLayout(ui: CreativePack["ui"], html5Preparation?: Html5PreparationPackage) {
  const issues: string[] = [];
  if (!html5Preparation?.layoutConfig) {
    issues.push("layoutConfig is missing.");
    return buildEdgeResult("ui_layout", false, "high", issues, ["layout_tool", "ui_architecture_tool"]);
  }
  const targetIds = collectLayoutTargets(html5Preparation);
  const required = [...ui.topBar, ...ui.orderPanel, ...ui.taskPanel, ...ui.eventEntry, ...ui.buildModePanel].slice(0, 18);
  const missing = required.filter((item) => !targetIds.has(toLayoutTargetId(item))).slice(0, 8);
  if (missing.length) issues.push(`UI carriers are missing from layout: ${missing.join(", ")}`);
  return buildEdgeResult("ui_layout", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["layout_tool", "ui_architecture_tool"], required);
}

export function checkCharacterLayout(characters: CharacterCard[], html5Preparation?: Html5PreparationPackage) {
  const issues: string[] = [];
  if (!html5Preparation?.layoutConfig) {
    issues.push("layoutConfig is missing.");
    return buildEdgeResult("character_layout", false, "high", issues, ["layout_tool", "character_tool"]);
  }
  const targetIds = collectLayoutTargets(html5Preparation);
  const missing = characters.map((card) => card.name).filter((name) => !targetIds.has(toLayoutTargetId(name)));
  if (missing.length) issues.push(`Character targets are missing from layout: ${missing.join(", ")}`);
  return buildEdgeResult("character_layout", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["layout_tool", "character_tool"], characters.map((card) => card.name));
}

export function checkSceneInteraction(scene: CreativePack["scene"], html5Preparation?: Html5PreparationPackage) {
  const issues: string[] = [];
  if (!html5Preparation?.interactionConfig) {
    issues.push("interactionConfig is missing.");
    return buildEdgeResult("scene_interaction", false, "high", issues, ["layout_tool", "scene_design_tool"]);
  }
  const targetIds = collectInteractionTargets(html5Preparation);
  const missing = scene.interactiveAreas.filter((item) => !targetIds.has(toLayoutTargetId(item))).slice(0, 6);
  if (missing.length) issues.push(`Scene hotspots are missing interaction bindings: ${missing.join(", ")}`);
  return buildEdgeResult("scene_interaction", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["layout_tool", "scene_design_tool"], scene.interactiveAreas);
}

export function checkUiInteraction(ui: CreativePack["ui"], html5Preparation?: Html5PreparationPackage) {
  const issues: string[] = [];
  if (!html5Preparation?.interactionConfig) {
    issues.push("interactionConfig is missing.");
    return buildEdgeResult("ui_interaction", false, "high", issues, ["layout_tool", "ui_architecture_tool"]);
  }
  const targetIds = collectInteractionTargets(html5Preparation);
  const required = [...ui.orderPanel.slice(0, 2), ...ui.eventEntry.slice(0, 2)];
  const missing = required.filter((item) => !targetIds.has(toLayoutTargetId(item)));
  if (missing.length) issues.push(`UI carriers are missing interaction bindings: ${missing.join(", ")}`);
  return buildEdgeResult("ui_interaction", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["layout_tool", "ui_architecture_tool"], required);
}

export function checkStoryTimeline(story: StoryResult, html5Preparation?: Html5PreparationPackage) {
  const issues: string[] = [];
  if (!html5Preparation?.timelineConfig) {
    issues.push("timelineConfig is missing.");
    return buildEdgeResult("story_timeline", false, "high", issues, ["timeline_tool", "story_tool"]);
  }
  const timelineText = stringify(html5Preparation.timelineConfig);
  const missing = story.chapterAnchors.filter((anchor) => !timelineText.includes(anchor)).slice(0, 4);
  if (missing.length) issues.push(`Story anchors are missing from timeline: ${missing.join(", ")}`);
  return buildEdgeResult("story_timeline", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["timeline_tool", "story_tool"], story.chapterAnchors);
}

export function checkCopywritingTimeline(copywriting?: CopywritingPack, html5Preparation?: Html5PreparationPackage) {
  const issues: string[] = [];
  if (!copywriting) {
    issues.push("Copywriting output is missing.");
    return buildEdgeResult("copywriting_timeline", false, "high", issues, ["timeline_tool", "copywriting_tool"]);
  }
  if (!html5Preparation?.timelineConfig) {
    issues.push("timelineConfig is missing.");
    return buildEdgeResult("copywriting_timeline", false, "high", issues, ["timeline_tool", "copywriting_tool"]);
  }
  const usedCopyIds = new Set(
    html5Preparation.timelineConfig.timelines.flatMap((timeline) =>
      timeline.actions.map((action) => String((action.payload as Record<string, unknown> | undefined)?.copyId ?? "")).filter(Boolean),
    ),
  );
  const required = [...copywriting.eventEntryCopy, ...copywriting.characterLines].slice(0, 8).map((item) => item.id);
  const missing = required.filter((copyId) => !usedCopyIds.has(copyId));
  if (missing.length) issues.push(`Copy items are missing from timeline usage: ${missing.join(", ")}`);
  return buildEdgeResult("copywriting_timeline", issues.length === 0, issues.length > 1 ? "high" : "medium", issues, ["timeline_tool", "copywriting_tool"], required);
}

export function checkLayoutTimeline(html5Preparation?: Html5PreparationPackage) {
  const issues: string[] = [];
  const problemLocationHints: ConsistencyEdgeResult["problemLocationHints"] = [];
  if (!html5Preparation?.layoutConfig || !html5Preparation?.timelineConfig) {
    issues.push("layoutConfig or timelineConfig is missing.");
    return buildEdgeResult("layout_timeline", false, "high", issues, ["timeline_tool", "layout_tool"], [], problemLocationHints);
  }
  const validTargets = new Set([...collectLayoutTargets(html5Preparation), ...collectInteractionTargets(html5Preparation)]);
  const missing = html5Preparation.timelineConfig.timelines
    .flatMap((timeline) => timeline.actions.map((action) => action.targetId))
    .filter((targetId) => !validTargets.has(targetId))
    .slice(0, 8);
  if (missing.length) issues.push(`Timeline references missing targetIds: ${missing.join(", ")}`);
  if (missing.length) {
    problemLocationHints.push({
      toolName: "timeline_tool",
      confidence: "high",
      reason: "Timeline is referencing targetIds that do not exist in the runtime layout or interaction layer.",
    });
    problemLocationHints.push({
      toolName: "layout_tool",
      confidence: "medium",
      reason: "If timeline still points to missing targets after repair, layout may not expose enough canonical runtime targets.",
    });
  }
  return buildEdgeResult(
    "layout_timeline",
    issues.length === 0,
    issues.length > 1 ? "high" : "medium",
    issues,
    ["timeline_tool", "layout_tool"],
    Array.from(validTargets).slice(0, 8),
    problemLocationHints,
  );
}

export function checkLayoutLighting(html5Preparation?: Html5PreparationPackage, story?: StoryResult) {
  const issues: string[] = [];
  if (!html5Preparation?.lightingRenderConfig) {
    issues.push("lightingRenderConfig is missing.");
    return buildEdgeResult("layout_lighting", false, "low", issues, ["timeline_tool"]);
  }
  const hasFestivalTone = Boolean(story && (story.emotionalTone.includes("节") || story.chapterAnchors.some((item) => item.includes("灯会") || item.includes("庆典") || item.includes("节"))));
  if (hasFestivalTone && (html5Preparation.lightingRenderConfig.lights?.length ?? 0) === 0) {
    issues.push("Story tone suggests a highlighted festive scene, but lighting config has no light definitions.");
  }
  return buildEdgeResult("layout_lighting", issues.length === 0, "low", issues, ["timeline_tool"], [...(html5Preparation.lightingRenderConfig.lights?.map((item) => item.lightId) ?? [])]);
}

export function evaluateEdgeFromArtifacts(edgeId: ConsistencyEdgeId, artifacts: ConsistencyArtifacts): ConsistencyEdgeResult | null {
  const genre = artifacts.targetGenre;
  switch (edgeId) {
    case "gameplay_economy":
      return artifacts.gameplay && artifacts.economy ? checkGameplayEconomy({ gameplay: artifacts.gameplay, economy: artifacts.economy } as CreativePack, genre) : null;
    case "gameplay_system":
      return artifacts.gameplay && artifacts.systems ? checkGameplaySystem({ gameplay: artifacts.gameplay, systems: artifacts.systems } as CreativePack, genre) : null;
    case "system_scene":
      return artifacts.systems && artifacts.scene ? checkSystemScene({ systems: artifacts.systems, scene: artifacts.scene } as CreativePack) : null;
    case "scene_ui":
      return artifacts.scene && artifacts.ui ? checkSceneUi({ scene: artifacts.scene, ui: artifacts.ui } as CreativePack) : null;
    case "story_character":
      return artifacts.story && artifacts.characters ? checkStoryCharacter(artifacts.story, artifacts.characters) : null;
    case "proposal_asset":
      return artifacts.proposal && artifacts.assetManifest ? checkProposalAsset(artifacts.proposal, artifacts.assetManifest) : null;
    case "scene_asset":
      return artifacts.scene && artifacts.assetManifest
        ? checkAssetCoverage({ scene: artifacts.scene, assetManifest: artifacts.assetManifest } as CreativePack, "scene")
        : null;
    case "ui_asset":
      return artifacts.ui && artifacts.assetManifest
        ? checkAssetCoverage({ ui: artifacts.ui, assetManifest: artifacts.assetManifest } as CreativePack, "ui")
        : null;
    case "story_asset":
      return artifacts.story && artifacts.assetManifest
        ? checkAssetCoverage({ story: artifacts.story, assetManifest: artifacts.assetManifest } as CreativePack, "story")
        : null;
    case "character_asset":
      return artifacts.characters && artifacts.assetManifest
        ? checkAssetCoverage({ characters: artifacts.characters, assetManifest: artifacts.assetManifest } as CreativePack, "character")
        : null;
    case "proposal_story":
      return artifacts.proposal && artifacts.story ? checkProposalStory(artifacts.proposal, artifacts.story) : null;
    case "proposal_ui":
      return artifacts.proposal && artifacts.ui ? checkProposalUi(artifacts.proposal, artifacts.ui) : null;
    case "economy_asset":
      return artifacts.economy && artifacts.assetManifest ? checkEconomyAsset(artifacts.economy, artifacts.assetManifest) : null;
    case "story_copywriting":
      return artifacts.story && artifacts.copywriting ? checkStoryCopywriting(artifacts.story, artifacts.copywriting) : null;
    case "character_copywriting":
      return artifacts.characters && artifacts.copywriting ? checkCharacterCopywriting(artifacts.characters, artifacts.copywriting) : null;
    case "scene_copywriting":
      return artifacts.scene && artifacts.copywriting ? checkSceneCopywriting(artifacts.scene, artifacts.copywriting) : null;
    case "ui_copywriting":
      return artifacts.ui && artifacts.copywriting ? checkUiCopywriting(artifacts.ui, artifacts.copywriting) : null;
    case "asset_copywriting":
      return artifacts.assetManifest && artifacts.copywriting ? checkAssetCopywriting(artifacts.assetManifest, artifacts.copywriting) : null;
    case "economy_copywriting":
      return artifacts.economy && artifacts.copywriting ? checkEconomyCopywriting(artifacts.economy, artifacts.copywriting) : null;
    case "proposal_copywriting":
      return artifacts.proposal && artifacts.copywriting ? checkProposalCopywriting(artifacts.proposal, artifacts.copywriting) : null;
    case "gameplay_copywriting":
      return artifacts.gameplay && artifacts.copywriting ? checkGameplayCopywriting(artifacts.gameplay, artifacts.copywriting) : null;
    case "system_copywriting":
      return artifacts.systems && artifacts.copywriting ? checkSystemCopywriting(artifacts.systems, artifacts.copywriting) : null;
    case "scene_layout":
      return artifacts.scene && artifacts.html5Preparation ? checkSceneLayout(artifacts.scene, artifacts.html5Preparation) : null;
    case "ui_layout":
      return artifacts.ui && artifacts.html5Preparation ? checkUiLayout(artifacts.ui, artifacts.html5Preparation) : null;
    case "character_layout":
      return artifacts.characters && artifacts.html5Preparation ? checkCharacterLayout(artifacts.characters, artifacts.html5Preparation) : null;
    case "scene_interaction":
      return artifacts.scene && artifacts.html5Preparation ? checkSceneInteraction(artifacts.scene, artifacts.html5Preparation) : null;
    case "ui_interaction":
      return artifacts.ui && artifacts.html5Preparation ? checkUiInteraction(artifacts.ui, artifacts.html5Preparation) : null;
    case "story_timeline":
      return artifacts.story && artifacts.html5Preparation ? checkStoryTimeline(artifacts.story, artifacts.html5Preparation) : null;
    case "copywriting_timeline":
      return artifacts.copywriting && artifacts.html5Preparation ? checkCopywritingTimeline(artifacts.copywriting, artifacts.html5Preparation) : null;
    case "layout_timeline":
      return artifacts.html5Preparation ? checkLayoutTimeline(artifacts.html5Preparation) : null;
    case "layout_lighting":
      return artifacts.html5Preparation ? checkLayoutLighting(artifacts.html5Preparation, artifacts.story ?? undefined) : null;
    default:
      return null;
  }
}

export function buildRepairTask(edge: ConsistencyEdgeResult): RepairTask {
  const reasoning = EDGE_REASONING[edge.edgeId];
  return {
    edgeId: edge.edgeId,
    problemSummary: clampText(uniqueStrings([EDGE_PROBLEM_SUMMARY[edge.edgeId], ...edge.issues], 3).join(" "), 220),
    whyItMatters: clampText(reasoning.why, 260),
    successConditions: clampStringList(reasoning.success.slice(0, 6), 6, 180),
    strictIdentifiers: clampStringList(reasoning.strict, 8, 120),
    candidateTools: edge.involvedTools,
    selectionGuidance: clampStringList(edge.problemLocationHints.map((hint) => `${hint.toolName}: ${hint.reason}`), 8, 220),
    problemLocationHints: edge.problemLocationHints,
  };
}

