import { getGenreProfile, type GenreFeatureProfile } from "../schemas";
import {
  normalizeBoolean,
  splitListLikeString,
  truncateText,
  cleanStringField,
  cleanStringArrayField,
  cleanBooleanField,
} from "./field-normalizers";

export function buildEntityIdFromName(name: string, fallbackPrefix: string, index: number) {
  const normalized = normalizeEntity(name);
  return normalized ? normalized.slice(0, 40) : `${fallbackPrefix}_${index + 1}`;
}

export function inferEntityType(item: Record<string, unknown>, fallbackPrefix: string) {
  const rawType = typeof item.entityType === "string" ? item.entityType.trim() : "";
  const allowedTypes = ["character", "visitor", "building", "facility", "scene_hotspot", "ui_entry", "activity_carrier", "resource_token"];
  if (allowedTypes.includes(rawType)) return rawType;

  const entityId = typeof item.entityId === "string" ? item.entityId : "";
  const entityName = typeof item.entityName === "string" ? item.entityName : "";
  const functionalRole = typeof item.functionalRole === "string" ? item.functionalRole : "";
  const relatedSystems = Array.isArray(item.relatedSystems) ? item.relatedSystems.filter((value): value is string => typeof value === "string").join(" ") : "";
  const combined = `${entityId} ${entityName} ${functionalRole} ${relatedSystems}`.toLowerCase();

  if (/(resource|currency|token|coin|gold|point|coupon|ticket|material|energy|stamina)/.test(combined)) return "resource_token";
  if (/(visitor|guest|customer|resident|tourist|villager|npc|companion|role|character|dialogue|favor|affinity|mayor)/.test(combined)) {
    return /visitor|guest|customer|resident|tourist/.test(combined) ? "visitor" : "character";
  }
  if (/(event|festival|banner|booth|fair|season|activity)/.test(combined)) return "activity_carrier";
  if (/(ui|panel|button|entry|icon|hud|tab)/.test(combined)) return "ui_entry";
  if (/(hotspot|trigger|spot|hint|notice|board)/.test(combined)) return "scene_hotspot";
  if (/(building|shop|store|stall|booth|plot|district|house)/.test(combined)) return "building";
  if (/(facility|station|counter|desk|machine|display|slot)/.test(combined)) return "facility";

  return fallbackPrefix;
}

export function isPlaceholderEntityName(value: string) {
  return /^(facility|building|character|visitor|entity|resource|hotspot|shop|plot)_\d+$/i.test(value.trim());
}

export function inferRequiresLayout(entityType: string, item: Record<string, unknown>) {
  const explicit = normalizeBoolean(item.requiresLayout);
  if (typeof explicit === "boolean") {
    if (entityType === "resource_token" && explicit === true) {
      const entityName = typeof item.entityName === "string" ? item.entityName.toLowerCase() : "";
      const functionalRole = typeof item.functionalRole === "string" ? item.functionalRole.toLowerCase() : "";
      const combined = `${entityName} ${functionalRole}`;
      if (!/(world|scene|pickup|ground|display|visible|carrier|board|booth|counter|slot)/.test(combined)) {
        return false;
      }
    }
    return explicit;
  }

  if (entityType === "resource_token" || entityType === "ui_entry") return false;
  return true;
}

export function cleanEntityRegistryItem(item: Record<string, unknown>, fallbackPrefix: string, index: number) {
  cleanStringField(item, "entityName", 60);
  cleanStringField(item, "functionalRole", 140);
  cleanStringArrayField(item, "relatedSystems", { min: 2, max: 40, maxItems: 6 });
  cleanStringArrayField(item, "relatedScenes", { min: 2, max: 60, maxItems: 6 });
  const rawEntityName = typeof item.entityName === "string" ? item.entityName.trim() : "";
  const rawEntityId = typeof item.entityId === "string" ? item.entityId.trim() : "";
  const entityName =
    rawEntityName.length >= 2 && !isPlaceholderEntityName(rawEntityName)
      ? rawEntityName
      : rawEntityId.length >= 2
        ? rawEntityId
        : `${fallbackPrefix}_${index + 1}`;
  item.entityName = entityName;
  const inferredType = inferEntityType(item, fallbackPrefix);
  item.entityType = inferredType;
  item.entityId = typeof item.entityId === "string" && item.entityId.trim().length >= 2 ? item.entityId.trim() : buildEntityIdFromName(entityName, inferredType, index);
  cleanBooleanField(item, "isCore", true);
  cleanBooleanField(item, "requiresAsset", true);
  item.requiresLayout = inferRequiresLayout(inferredType, item);
  cleanBooleanField(item, "requiresCopy", true);
  return item;
}

export function cleanEntityRegistryField(
  record: Record<string, unknown>,
  field: string,
  fallbackPrefix: string,
  maxItems: number,
) {
  const raw = record[field];
  if (!Array.isArray(raw)) return;
  record[field] = raw
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .slice(0, maxItems)
    .map((item, index) => cleanEntityRegistryItem({ ...(item as Record<string, unknown>) }, fallbackPrefix, index));
}

export function normalizeSystemToEntityMapShape(record: Record<string, unknown>) {
  const raw = record.systemToEntityMap;
  if (!raw || Array.isArray(raw) || typeof raw !== "object") return;

  const responsibilityLookup: Record<string, string> = {
    managementSystem: typeof record.managementSystem === "string" ? record.managementSystem : "",
    expansionSystem: typeof record.expansionSystem === "string" ? record.expansionSystem : "",
    missionSystem: typeof record.missionSystem === "string" ? record.missionSystem : "",
    eventSystem: typeof record.eventSystem === "string" ? record.eventSystem : "",
    roleInteractionSystem: typeof record.roleInteractionSystem === "string" ? record.roleInteractionSystem : "",
    collectionSystem: typeof record.collectionSystem === "string" ? record.collectionSystem : "",
    socialLightSystem: typeof record.socialLightSystem === "string" ? record.socialLightSystem : "",
  };

  record.systemToEntityMap = Object.entries(raw as Record<string, unknown>)
    .map(([systemName, entityIds]) => ({
      systemName,
      entityIds: Array.isArray(entityIds)
        ? entityIds.filter((value): value is string => typeof value === "string")
        : typeof entityIds === "string"
          ? [entityIds]
          : [],
      responsibility: responsibilityLookup[systemName] || `${systemName} carrier mapping`,
    }))
    .filter((item) => item.entityIds.length > 0);
}

export function buildEntityFromName(
  entityName: string,
  entityType: string,
  index: number,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    entityId: buildEntityIdFromName(entityName, entityType, index),
    entityName,
    entityType,
    functionalRole: `${entityName} supports the current prototype loop.`,
    isCore: true,
    requiresAsset: true,
    requiresLayout: entityType !== "resource_token",
    requiresCopy: entityType !== "resource_token",
    relatedSystems: [],
    relatedScenes: [],
    ...overrides,
  };
}

export function ensureStringField(record: Record<string, unknown>, field: string, fallback: string, minLength: number, maxLength: number) {
  const current = typeof record[field] === "string" ? record[field] : "";
  if (current.trim().length < minLength) {
    record[field] = truncateText(fallback, maxLength);
  }
}

export function ensureStringArrayMin(
  record: Record<string, unknown>,
  field: string,
  minimum: number,
  fallbackItems: string[],
  maxLength: number,
  maxItems: number,
) {
  const current = Array.isArray(record[field]) ? (record[field] as unknown[]) : [];
  const normalized = current.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  let index = 0;

  while (normalized.length < minimum && index < fallbackItems.length) {
    normalized.push(truncateText(fallbackItems[index], maxLength));
    index += 1;
  }

  record[field] = normalized.slice(0, maxItems);
}

export function ensureObjectArrayMin(
  record: Record<string, unknown>,
  field: string,
  minimum: number,
  fallbackItems: Record<string, unknown>[],
  maxItems: number,
) {
  const current = Array.isArray(record[field]) ? (record[field] as unknown[]) : [];
  const normalized = current.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<string, unknown>[];
  let index = 0;

  while (normalized.length < minimum && index < fallbackItems.length) {
    normalized.push({ ...fallbackItems[index] });
    index += 1;
  }

  record[field] = normalized.slice(0, maxItems);
}

export function normalizeAssetType(value: unknown) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  const compact = text.replace(/\s+/g, "");

  if (["角色立绘", "角色素材", "角色插图", "角色卡面", "角色原画", "人物立绘", "人物素材"].includes(compact)) return "角色立绘";
  if (["场景物件", "场景素材", "场景道具", "环境物件", "环境素材", "场景摆件"].includes(compact)) return "场景物件";
  if (["建筑单体", "建筑素材", "建筑物件", "建筑立绘", "店铺单体", "建筑原画"].includes(compact)) return "建筑单体";
  if (["UI图标", "图标", "ui图标", "按钮图标"].includes(compact.toLowerCase() === compact ? compact : compact)) return "UI图标";
  if (["UI面板", "面板", "ui面板", "界面面板", "UI框体", "弹窗面板"].includes(compact)) return "UI面板";
  if (["活动插图", "活动素材", "活动主视觉", "活动海报", "活动KV", "主题插图"].includes(compact)) return "活动插图";
  if (["装扮素材", "装饰素材", "装饰物件", "装扮物件", "装扮道具", "装饰道具"].includes(compact)) return "装扮素材";

  return text;
}

export function normalizeCharacterRosterItem(value: string) {
  const text = value.trim();
  if (!text) return "";

  const nameMatch = text.match(/"name"\s*:\s*"([^"]+)"/);
  if (nameMatch?.[1]) return nameMatch[1].trim();

  const chineseNameMatch = text.match(/[\u4e00-\u9fa5]{2,6}/g);
  if (chineseNameMatch?.length) {
    return chineseNameMatch[0].trim();
  }

  return text.replace(/^["'\s]+|["'\s]+$/g, "");
}

export function normalizeEntity(value: string) {
  return value
    .replace(/[\s"'`【】（）()、，,:：；!！?？[\]{}]/g, "")
    .replace(/UI/g, "ui")
    .toLowerCase();
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

export function alignToKnownCandidate(value: string, candidates: string[]) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const normalizedValue = normalizeEntity(trimmed);
  let bestMatch = "";
  let bestScore = -1;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeEntity(candidate);
    if (!normalizedCandidate) continue;
    if (normalizedCandidate === normalizedValue) return candidate;

    let score = 0;
    if (normalizedCandidate.includes(normalizedValue) || normalizedValue.includes(normalizedCandidate)) score += 2;
    if (
      normalizedCandidate.includes("角色立绘气泡热区") &&
      (normalizedValue.includes("气泡热区") || normalizedValue.includes("角色热区") || normalizedValue.includes("立绘热区"))
    ) {
      score += 3;
    }
    if (
      normalizedCandidate.includes("装扮按钮热区") &&
      (normalizedValue.includes("装扮按钮") || normalizedValue.includes("装饰按钮") || normalizedValue.includes("图鉴按钮"))
    ) {
      score += 3;
    }
    if (
      normalizedCandidate.includes("节日浮动图标热区") &&
      (normalizedValue.includes("灯会入口") || normalizedValue.includes("活动入口") || normalizedValue.includes("banner入口"))
    ) {
      score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestScore > 0 ? bestMatch : trimmed;
}

export function buildDefaultCharacterCardFromRoster(storyRecord: Record<string, unknown> | undefined, rosterName: string, index: number) {
  const anchorCandidates = alignCharacterAnchorsToStory(storyRecord, rosterName, []);
  return {
    entityId: buildEntityIdFromName(rosterName, "character", index),
    name: rosterName,
    characterCategory: index < 2 ? "core" : "support",
    rolePositioning: index === 0 ? "主引导角色" : index === 1 ? "经营陪伴角色" : "活动与装扮角色",
    personalityTags: index === 0 ? ["温和", "可靠", "主动"] : index === 1 ? ["务实", "稳重", "熟练"] : ["活跃", "亲切", "有创意"],
    backgroundSummary: `${rosterName} 负责承接当前版本的原型内容，并通过互动、事件或目标提示帮助玩家理解经营推进。`,
    interactionResponsibility: `${rosterName} 负责在对应剧情节点提供提示、反馈与互动承接。`,
    collectionValue: `${rosterName} 可解锁额外互动反馈、展示内容或主题化包装。`,
    relatedSystems: ["经营系统", "任务系统", "角色互动系统"],
    storyAnchors: anchorCandidates,
    visualKeywords: index === 0 ? ["清爽配色", "亲和表情", "经营助手"] : index === 1 ? ["实用装束", "稳重姿态", "店务协作"] : ["节庆点缀", "轻快动作", "装饰氛围"],
    spawnContext: ["main_scene", "role_interaction_loop"],
  };
}

export function alignCharacterAnchorsToStory(
  story: Record<string, unknown> | undefined,
  cardName: string,
  rawAnchors: string[],
) {
  const chapterAnchors = (Array.isArray(story?.chapterAnchors) ? story!.chapterAnchors : [])
    .filter((item): item is string => typeof item === "string" && item.trim().length >= 4)
    .map((item) => item.trim());
  const mainPlotBeats = (Array.isArray(story?.mainPlotBeats) ? story!.mainPlotBeats : [])
    .filter((item): item is string => typeof item === "string" && item.trim().length >= 4)
    .map((item) => item.trim());
  const sourceAnchors = [...chapterAnchors, ...mainPlotBeats];

  if (sourceAnchors.length === 0) return rawAnchors;

  const normalizedName = normalizeEntity(cardName);
  const chapterMatchesByName = chapterAnchors.filter((candidate) => normalizeEntity(candidate).includes(normalizedName));
  const beatMatchesByName = mainPlotBeats.filter((candidate) => normalizeEntity(candidate).includes(normalizedName));
  const directMatches = rawAnchors.flatMap((rawAnchor) => {
    const rawKeys = splitListLikeString(rawAnchor).flatMap((item) => [normalizeEntity(item), ...item.split(/[:：]/).map((part) => normalizeEntity(part))]).filter(Boolean);
    return sourceAnchors.filter((candidate) => {
      const normalizedCandidate = normalizeEntity(candidate);
      return rawKeys.some((key) => key && (normalizedCandidate === key || normalizedCandidate.includes(key) || key.includes(normalizedCandidate)));
    });
  });
  const resolved = Array.from(new Set([...directMatches, ...chapterMatchesByName, ...beatMatchesByName]))
    .map((item) => truncateText(item, 80))
    .slice(0, 4);
  if (resolved.length > 0) {
    return resolved;
  }

  return [truncateText(sourceAnchors[0], 80)];
}


export function buildEntitySignalText(item: Record<string, unknown>) {
  const entityId = typeof item.entityId === "string" ? item.entityId : "";
  const entityName = typeof item.entityName === "string" ? item.entityName : "";
  const functionalRole = typeof item.functionalRole === "string" ? item.functionalRole : "";
  const entityType = typeof item.entityType === "string" ? item.entityType : "";
  const relatedSystems = Array.isArray(item.relatedSystems)
    ? item.relatedSystems.filter((value): value is string => typeof value === "string").join(" ")
    : "";
  return `${entityId} ${entityName} ${functionalRole} ${entityType} ${relatedSystems}`.toLowerCase();
}

export function isRoleLikeEntity(item: Record<string, unknown>) {
  const entityType = typeof item.entityType === "string" ? item.entityType : "";
  if (entityType === "visitor" || entityType === "character") return true;
  return /(visitor|guest|customer|resident|tourist|villager|npc|companion|role|character|dialogue|mayor)/.test(
    buildEntitySignalText(item),
  );
}

export function isBuildLikeEntity(item: Record<string, unknown>) {
  const entityType = typeof item.entityType === "string" ? item.entityType : "";
  if (entityType === "building" || entityType === "facility") return true;
  return /(building|facility|shop|store|stall|booth|plot|district|house|counter|station|display|slot)/.test(
    buildEntitySignalText(item),
  );
}

export function extractGenreProfileFromPayload(requestPayload?: unknown): GenreFeatureProfile | null {
  if (!requestPayload || typeof requestPayload !== "object" || Array.isArray(requestPayload)) return null;
  const payload = requestPayload as Record<string, unknown>;
  const brief = payload.brief && typeof payload.brief === "object" && !Array.isArray(payload.brief)
    ? (payload.brief as Record<string, unknown>)
    : null;
  if (!brief || typeof brief.targetGenre !== "string") return null;
  return getGenreProfile(brief.targetGenre);
}

