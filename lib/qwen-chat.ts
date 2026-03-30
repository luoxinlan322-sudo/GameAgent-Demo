import { zodResponseFormat } from "openai/helpers/zod";
import type OpenAI from "openai";
import {
  ZodArray,
  ZodBoolean,
  ZodDefault,
  ZodEnum,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodString,
  type ZodType,
} from "zod";
import { startObservation, type LangfuseObservation } from "@langfuse/tracing";
import { createDebugLog, finalizeDebugLog, type DebugLogEntry } from "./debug-log";
import { isLangfuseEnabled } from "./langfuse";
import { getGenreProfile, type GenreFeatureProfile } from "./schemas";

type ChatRole = "system" | "user" | "assistant";
type StructuredMode = "json_object" | "function_call";

type RunStructuredChatParams<T> = {
  client: OpenAI;
  model: string;
  baseURL?: string;
  schema: ZodType<T>;
  schemaName: string;
  messages: Array<{ role: ChatRole; content: string }>;
  extraBody?: Record<string, unknown>;
  stage: string;
  requestPayload: unknown;
  timeoutMs?: number;
  mode?: StructuredMode;
  maxRepairAttempts?: number;
  debugMeta?: {
    runId?: string;
    sessionId?: string;
    iteration?: number;
    phase?: string;
    title?: string;
    langfuseParent?: LangfuseObservation;
  };
};

type RunStructuredChatResult<T> = {
  parsed: T;
  logEntry: DebugLogEntry;
};

const FUNCTION_CALL_STAGES = new Set([
  "intent_recognition",
  "planning",
  "tool_selection",
  "scene_design_tool",
  "scene_design_patch_tool",
  "ui_architecture_tool",
  "asset_manifest_tool",
  "semantic_consistency_tool",
  "evaluate",
  "verification",
  "repair_tool",
  "consistency_repair_planner",
]);

function extractRawContent(message: unknown) {
  const maybeMessage = message as { content?: unknown } | undefined;
  const content = maybeMessage?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts = content
      .map((item) => {
        const record = item as Record<string, unknown>;
        if (typeof record?.text === "string") {
          return record.text;
        }
        return null;
      })
      .filter(Boolean);

    return textParts.length > 0 ? textParts.join("\n") : JSON.stringify(content);
  }

  return null;
}

function extractFirstJsonObject(rawContent: string | null) {
  if (!rawContent) return {};

  const trimmed = rawContent.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = trimmed.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }
  }

  throw new Error("模型未返回合法 JSON 对象");
}

function unwrapSchema(schema: ZodType<unknown>): ZodType<unknown> {
  let current = schema;

  while (current instanceof ZodOptional || current instanceof ZodDefault || current instanceof ZodNullable) {
    const innerType = (current as unknown as { _def?: { innerType?: ZodType<unknown> } })._def?.innerType;
    if (!innerType) break;
    current = innerType;
  }

  return current;
}

function splitListLikeString(value: string) {
  return value
    .split(/\r?\n|[；;。]|(?<=\S)\s*[-•·]\s*|、|，|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, Math.max(0, maxLength - 1)).trimEnd();
}

function normalizeString(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((item) => normalizeString(item)).join("；");
  if (value === null || value === undefined) return value;
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function normalizeNumber(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return value;
}

function normalizeBoolean(value: unknown): unknown {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["true", "yes", "1", "pass", "approved"].includes(lower)) return true;
    if (["false", "no", "0", "fail", "rejected"].includes(lower)) return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return value;
}

function normalizeValueForSchema(schema: ZodType<unknown>, value: unknown): unknown {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof ZodString) return normalizeString(value);
  if (unwrapped instanceof ZodNumber) return normalizeNumber(value);
  if (unwrapped instanceof ZodBoolean) return normalizeBoolean(value);
  if (unwrapped instanceof ZodEnum) return typeof value === "string" ? value.trim() : normalizeString(value);

  if (unwrapped instanceof ZodArray) {
    const itemSchema = unwrapped.element as unknown as ZodType<unknown>;
    let list: unknown;

    if (Array.isArray(value)) {
      list = value;
    } else if (typeof value === "string" && unwrapSchema(itemSchema) instanceof ZodString) {
      list = splitListLikeString(value);
    } else if (value === undefined || value === null) {
      list = value;
    } else {
      list = [value];
    }

    if (!Array.isArray(list)) return list;
    return list.map((item) => normalizeValueForSchema(itemSchema, item));
  }

  if (unwrapped instanceof ZodObject) {
    const shape = unwrapped.shape;
    const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const normalized: Record<string, unknown> = {};

    for (const [key, childSchema] of Object.entries(shape)) {
      normalized[key] = normalizeValueForSchema(childSchema as ZodType<unknown>, record[key]);
    }

    return normalized;
  }

  return value;
}

function cleanStringArrayField(record: Record<string, unknown>, field: string, options: { min?: number; max?: number; maxItems?: number }) {
  const raw = record[field];
  let list: string[] = [];

  if (Array.isArray(raw)) {
    list = raw.flatMap((item) => (typeof item === "string" ? splitListLikeString(item) : [String(item ?? "").trim()]));
  } else if (typeof raw === "string") {
    list = splitListLikeString(raw);
  }

  const min = options.min ?? 1;
  const max = options.max ?? 120;
  const maxItems = options.maxItems ?? list.length;

  record[field] = list
    .map((item) => truncateText(item, max))
    .map((item) => item.trim())
    .filter((item) => item.length >= min)
    .slice(0, maxItems);
}

function cleanStringField(record: Record<string, unknown>, field: string, maxLength: number) {
  const raw = record[field];
  if (raw === undefined || raw === null) return;
  const normalized = normalizeString(raw);
  if (typeof normalized === "string") {
    record[field] = truncateText(normalized, maxLength);
  }

}

function cleanObjectArrayField(record: Record<string, unknown>, field: string, maxItems: number, itemCleaner: (item: Record<string, unknown>) => Record<string, unknown>) {
  const raw = record[field];
  if (!Array.isArray(raw)) return;
  record[field] = raw
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .slice(0, maxItems)
    .map((item) => itemCleaner({ ...(item as Record<string, unknown>) }));
}

function cleanBooleanField(record: Record<string, unknown>, field: string, fallback = false) {
  const normalized = normalizeBoolean(record[field]);
  record[field] = typeof normalized === "boolean" ? normalized : fallback;
}

function cleanEnumField(
  record: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
  fallback: string,
) {
  const raw = record[field];
  const normalized = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const matched = allowed.find((item) => item.toLowerCase() === normalized);
  record[field] = matched ?? fallback;
}

function buildEntityIdFromName(name: string, fallbackPrefix: string, index: number) {
  const normalized = normalizeEntity(name);
  return normalized ? normalized.slice(0, 40) : `${fallbackPrefix}_${index + 1}`;
}

function inferEntityType(item: Record<string, unknown>, fallbackPrefix: string) {
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

function isPlaceholderEntityName(value: string) {
  return /^(facility|building|character|visitor|entity|resource|hotspot|shop|plot)_\d+$/i.test(value.trim());
}

function inferRequiresLayout(entityType: string, item: Record<string, unknown>) {
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

function cleanEntityRegistryItem(item: Record<string, unknown>, fallbackPrefix: string, index: number) {
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

function cleanEntityRegistryField(
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

function normalizeSystemToEntityMapShape(record: Record<string, unknown>) {
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

function buildEntityFromName(
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

function ensureStringField(record: Record<string, unknown>, field: string, fallback: string, minLength: number, maxLength: number) {
  const current = typeof record[field] === "string" ? record[field] : "";
  if (current.trim().length < minLength) {
    record[field] = truncateText(fallback, maxLength);
  }
}

function ensureStringArrayMin(
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

function ensureObjectArrayMin(
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

function normalizeAssetType(value: unknown) {
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

function normalizeCharacterRosterItem(value: string) {
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

function normalizeEntity(value: string) {
  return value
    .replace(/[\s"'`【】（）()、，,:：；!！?？[\]{}]/g, "")
    .replace(/UI/g, "ui")
    .toLowerCase();
}

function buildAnchorSearchKeys(anchor: string) {
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

function buildAssetSearchKeys(assetName: string) {
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

function alignToKnownCandidate(value: string, candidates: string[]) {
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

function buildDefaultCharacterCardFromRoster(storyRecord: Record<string, unknown> | undefined, rosterName: string, index: number) {
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

function alignCharacterAnchorsToStory(
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

function cleanupStageSpecificData(stage: string, value: unknown, requestPayload?: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const normalized = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

  if (stage === "planning" && Array.isArray(normalized.taskBreakdown)) {
    normalized.taskBreakdown = normalized.taskBreakdown.map((item) => {
      if (!item || typeof item !== "object") return item;
      const record = { ...(item as Record<string, unknown>) };
      const dependsOnRaw = record.dependsOn;
      const dependsOnList = Array.isArray(dependsOnRaw)
        ? dependsOnRaw
        : typeof dependsOnRaw === "string"
          ? splitListLikeString(dependsOnRaw)
          : [];

      record.dependsOn = dependsOnList
        .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry ?? "").trim()))
        .filter((entry) => entry.length >= 2 && !["无", "无依赖", "none", "n/a", "-", "--"].includes(entry.toLowerCase()));

      return record;
    });
  }

  if (stage === "intent_recognition") {
    cleanStringField(normalized, "taskDefinition", 220);
    cleanStringArrayField(normalized, "successSignals", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "coreConstraints", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "riskHypotheses", { min: 4, max: 120, maxItems: 5 });
    cleanStringArrayField(normalized, "recommendedFlow", { min: 2, max: 60, maxItems: 10 });
  }

  if (stage === "planning") {
    cleanStringField(normalized, "goalUnderstanding", 260);
    cleanStringArrayField(normalized, "successCriteria", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "keyRisks", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "checklist", { min: 4, max: 120, maxItems: 8 });
    cleanStringField(normalized, "nextDecision", 180);
    cleanObjectArrayField(normalized, "parallelPlan", 6, (item) => {
      cleanStringField(item, "batchName", 40);
      cleanStringArrayField(item, "tools", { min: 2, max: 40, maxItems: 6 });
      cleanStringField(item, "reason", 140);
      return item;
    });
    cleanObjectArrayField(normalized, "taskBreakdown", 10, (item) => {
      cleanStringField(item, "step", 40);
      cleanStringField(item, "purpose", 140);
      cleanStringField(item, "output", 140);
      cleanStringArrayField(item, "dependsOn", { min: 2, max: 40, maxItems: 4 });
      return item;
    });
  }

  if (stage === "tool_selection") {
    cleanStringField(normalized, "roundGoal", 180);
    cleanStringArrayField(normalized, "toolQueue", { min: 2, max: 40, maxItems: 9 });
    cleanStringArrayField(normalized, "callReasons", { min: 4, max: 160, maxItems: 9 });
    cleanObjectArrayField(normalized, "parallelBatches", 6, (item) => {
      cleanStringField(item, "batchName", 40);
      cleanStringArrayField(item, "tools", { min: 2, max: 40, maxItems: 5 });
      cleanStringField(item, "dependency", 120);
      return item;
    });
  }

  if (stage === "gameplay_tool") {
    cleanStringField(normalized, "oneSentenceLoop", 180);
    cleanStringArrayField(normalized, "mainLoop", { min: 4, max: 120, maxItems: 7 });
    cleanStringArrayField(normalized, "subLoops", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "clickPath", { min: 4, max: 120, maxItems: 8 });
    cleanStringArrayField(normalized, "feedbackRhythm", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "failRecover", { min: 4, max: 120, maxItems: 5 });
    cleanStringArrayField(normalized, "testFocus", { min: 4, max: 120, maxItems: 6 });
    cleanEntityRegistryField(normalized, "loopEntities", "facility", 16);
    cleanObjectArrayField(normalized, "loopActions", 16, (item) => {
      cleanStringField(item, "actionId", 40);
      cleanStringField(item, "actorEntityId", 40);
      cleanStringField(item, "targetEntityId", 40);
      cleanStringField(item, "outcome", 120);
      return item;
    });
    if (!Array.isArray(normalized.loopEntities) || normalized.loopEntities.length === 0) {
      const loopNames = Array.isArray(normalized.mainLoop)
        ? normalized.mainLoop.filter((item): item is string => typeof item === "string").slice(0, 3)
        : [];
      normalized.loopEntities = loopNames.map((item, index) => buildEntityFromName(item, "facility", index));
    }
  }

  if (stage === "economy_tool") {
    cleanStringField(normalized, "orderCostLoop", 220);
    cleanStringArrayField(normalized, "coreCurrencies", { min: 2, max: 40, maxItems: 6 });
    cleanStringArrayField(normalized, "faucets", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "sinks", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "upgradeThresholds", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "decorationUnlocks", { min: 4, max: 120, maxItems: 5 });
    cleanStringArrayField(normalized, "monetizationHooks", { min: 4, max: 120, maxItems: 5 });
    cleanStringArrayField(normalized, "pacingControls", { min: 4, max: 120, maxItems: 5 });
  }

  if (stage === "system_design_tool") {
    cleanStringField(normalized, "systemOverview", 240);
    cleanStringField(normalized, "managementSystem", 220);
    cleanStringField(normalized, "expansionSystem", 220);
    cleanStringField(normalized, "missionSystem", 220);
    cleanStringField(normalized, "eventSystem", 220);
    cleanStringField(normalized, "roleInteractionSystem", 220);
    cleanStringField(normalized, "collectionSystem", 220);
    cleanStringField(normalized, "socialLightSystem", 220);
    cleanEntityRegistryField(normalized, "systemEntities", "facility", 20);
    normalizeSystemToEntityMapShape(normalized);
    cleanObjectArrayField(normalized, "systemToEntityMap", 16, (item) => {
      cleanStringField(item, "systemName", 40);
      cleanStringArrayField(item, "entityIds", { min: 2, max: 40, maxItems: 8 });
      cleanStringField(item, "responsibility", 120);
      return item;
    });
  }

  if (stage === "proposal_tool") {
    cleanStringField(normalized, "solutionName", 80);
    cleanStringField(normalized, "projectPositioning", 260);
    cleanStringField(normalized, "designThesis", 220);
    cleanStringField(normalized, "prototypeScope", 220);
    cleanStringArrayField(normalized, "keyValidationMetrics", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "majorRisks", { min: 4, max: 120, maxItems: 6 });
    cleanStringField(normalized, "roundFocus", 180);
  }

  if (stage === "scene_design_tool") {
    cleanStringField(normalized, "sceneConcept", 180);
    cleanStringArrayField(normalized, "sceneZones", { min: 4, max: 120, maxItems: 7 });
    cleanStringArrayField(normalized, "interactiveAreas", { min: 4, max: 120, maxItems: 8 });
    cleanStringArrayField(normalized, "buildingSlots", { min: 4, max: 120, maxItems: 8 });
    cleanStringArrayField(normalized, "navigationFlow", { min: 4, max: 120, maxItems: 7 });
    cleanStringArrayField(normalized, "stateTransitions", { min: 4, max: 120, maxItems: 7 });
    cleanStringArrayField(normalized, "contentHotspots", { min: 4, max: 120, maxItems: 6 });
    cleanEntityRegistryField(normalized, "sceneEntities", "scene_hotspot", 20);
    cleanObjectArrayField(normalized, "zoneEntityMap", 16, (item) => {
      cleanStringField(item, "zoneName", 60);
      cleanStringArrayField(item, "entityIds", { min: 2, max: 40, maxItems: 8 });
      return item;
    });
    cleanObjectArrayField(normalized, "buildingDefinitions", 12, (item) => {
      cleanStringField(item, "buildingId", 40);
      cleanStringField(item, "buildingName", 40);
      cleanStringField(item, "buildingType", 40);
      cleanStringField(item, "slotName", 60);
      cleanStringField(item, "gameplayPurpose", 120);
      cleanStringField(item, "upgradeHook", 120);
      if (!item.buildingId && typeof item.buildingName === "string") {
        item.buildingId = buildEntityIdFromName(item.buildingName, "building", 0);
      }
      return item;
    });
  }

  if (stage === "scene_design_patch_tool") {
    cleanStringArrayField(normalized, "preserveEntityIds", { min: 2, max: 40, maxItems: 20 });
    cleanStringArrayField(normalized, "appendSceneZones", { min: 4, max: 120, maxItems: 8 });
    cleanStringArrayField(normalized, "appendInteractiveAreas", { min: 4, max: 120, maxItems: 8 });
    cleanStringArrayField(normalized, "appendBuildingSlots", { min: 4, max: 120, maxItems: 8 });
    cleanStringArrayField(normalized, "appendContentHotspots", { min: 4, max: 120, maxItems: 8 });
    cleanEntityRegistryField(normalized, "appendSceneEntities", "scene_hotspot", 20);
    cleanObjectArrayField(normalized, "appendZoneEntityMap", 16, (item) => {
      cleanStringField(item, "zoneName", 60);
      cleanStringArrayField(item, "entityIds", { min: 2, max: 40, maxItems: 8 });
      return item;
    });
    cleanObjectArrayField(normalized, "appendBuildingDefinitions", 12, (item) => {
      cleanStringField(item, "buildingId", 40);
      cleanStringField(item, "buildingName", 40);
      cleanStringField(item, "buildingType", 40);
      cleanStringField(item, "slotName", 60);
      cleanStringField(item, "gameplayPurpose", 120);
      cleanStringField(item, "upgradeHook", 120);
      if (!item.buildingId && typeof item.buildingName === "string") {
        item.buildingId = buildEntityIdFromName(item.buildingName, "building", 0);
      }
      return item;
    });
  }

  if (stage === "ui_architecture_tool") {
    cleanStringArrayField(normalized, "topBar", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "orderPanel", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "taskPanel", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "shopEntry", { min: 4, max: 120, maxItems: 5 });
    cleanStringArrayField(normalized, "eventEntry", { min: 4, max: 120, maxItems: 5 });
    cleanStringArrayField(normalized, "buildModePanel", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "feedbackLayer", { min: 4, max: 120, maxItems: 6 });
  }

  if (stage === "story_tool") {
    cleanStringField(normalized, "storyPositioning", 120);
    cleanStringField(normalized, "worldSummary", 260);
    cleanStringField(normalized, "coreConflict", 180);
    cleanStringArrayField(normalized, "characterRoster", { min: 2, max: 24, maxItems: 6 });
    if (Array.isArray(normalized.characterRoster)) {
      normalized.characterRoster = normalized.characterRoster
        .map((item) => (typeof item === "string" ? normalizeCharacterRosterItem(item) : ""))
        .filter((item) => item.length >= 2)
        .slice(0, 6);
    }
    ensureStringArrayMin(normalized, "characterRoster", 3, ["林小渔", "阿树", "陈伯"], 24, 6);
    cleanStringArrayField(normalized, "mainPlotBeats", { min: 8, max: 180, maxItems: 6 });
    cleanStringArrayField(normalized, "chapterAnchors", { min: 8, max: 160, maxItems: 6 });
    ensureStringArrayMin(normalized, "mainPlotBeats", 3, ["角色初登场与世界观建立", "核心矛盾爆发与高潮推进", "结局收束与伏笔延伸"], 180, 6);
    ensureStringArrayMin(normalized, "chapterAnchors", 3, ["序章：初到此地", "第一章：站稳脚跟", "第二章：扩展与挑战"], 160, 6);
    cleanStringField(normalized, "emotionalTone", 60);
  }

  if (stage === "character_tool") {
    const storyRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? ((requestPayload as Record<string, unknown>).story as Record<string, unknown> | undefined)
        : undefined;

    cleanObjectArrayField(normalized, "cards", 6, (item) => {
      cleanStringField(item, "entityId", 40);
      cleanStringField(item, "name", 24);
      cleanStringField(item, "characterCategory", 20);
      if ((!item.rolePositioning || String(item.rolePositioning).trim().length < 2) && typeof item.roleType === "string") {
        item.rolePositioning = item.roleType;
      }
      cleanStringField(item, "rolePositioning", 40);
      if ((!Array.isArray(item.personalityTags) || item.personalityTags.length === 0) && Array.isArray(item.personalityTraits)) {
        item.personalityTags = item.personalityTraits;
      }
      cleanStringArrayField(item, "personalityTags", { min: 2, max: 20, maxItems: 5 });
      if ((!item.backgroundSummary || String(item.backgroundSummary).trim().length < 12) && Array.isArray(item.dialogueSnippets)) {
        item.backgroundSummary = String(item.dialogueSnippets[0] ?? "");
      }
      cleanStringField(item, "backgroundSummary", 180);
      if ((!item.interactionResponsibility || String(item.interactionResponsibility).trim().length < 6) && Array.isArray(item.interactionTriggers)) {
        item.interactionResponsibility = (item.interactionTriggers as unknown[]).filter((entry): entry is string => typeof entry === "string").join("；");
      }
      cleanStringField(item, "interactionResponsibility", 140);
      cleanStringField(item, "collectionValue", 140);
      cleanStringArrayField(item, "relatedSystems", { min: 2, max: 40, maxItems: 4 });
      ensureStringArrayMin(item, "relatedSystems", 1, ["核心经营系统"], 40, 4);
      cleanStringArrayField(item, "storyAnchors", { min: 4, max: 80, maxItems: 4 });
      if (storyRecord) {
        const alignedAnchors = alignCharacterAnchorsToStory(
          storyRecord,
          typeof item.name === "string" ? item.name : "",
          Array.isArray(item.storyAnchors) ? item.storyAnchors.filter((entry): entry is string => typeof entry === "string") : [],
        );
        item.storyAnchors = alignedAnchors;
      }
      cleanStringArrayField(item, "visualKeywords", { min: 2, max: 24, maxItems: 8 });
      cleanStringArrayField(item, "spawnContext", { min: 2, max: 60, maxItems: 6 });
      ensureStringArrayMin(item, "spawnContext", 1, ["主场景默认出现"], 60, 6);
      if (!item.entityId && typeof item.name === "string") {
        item.entityId = buildEntityIdFromName(item.name, "character", 0);
      }
      if (!["core", "support", "visitor"].includes(String(item.characterCategory ?? ""))) {
        item.characterCategory = "core";
      }
      return item;
    });
    if (storyRecord && Array.isArray(normalized.cards)) {
      const roster = Array.isArray(storyRecord.characterRoster)
        ? storyRecord.characterRoster.filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
        : [];
      if (roster.length > 0) {
        const unusedCards = [...(normalized.cards as Array<Record<string, unknown>>)];
        const alignedCards = roster.map((rosterName, index) => {
          const matchIndex = unusedCards.findIndex((card) => card.name === rosterName);
          const matched = matchIndex >= 0 ? unusedCards.splice(matchIndex, 1)[0] : unusedCards.shift();
          const card = { ...(matched ?? {}) };
          card.name = rosterName;
          card.entityId = typeof card.entityId === "string" && card.entityId.trim().length >= 2
            ? card.entityId
            : buildEntityIdFromName(rosterName, "character", index);
          if (storyRecord) {
            card.storyAnchors = alignCharacterAnchorsToStory(
              storyRecord,
              rosterName,
              Array.isArray(card.storyAnchors) ? card.storyAnchors.filter((entry): entry is string => typeof entry === "string") : [],
            );
          }
          if (!card.rolePositioning) {
            card.rolePositioning = index === 0 ? "主引导角色" : index === 1 ? "经营陪伴角色" : "活动与装扮角色";
          }
          if (!["core", "support", "visitor"].includes(String(card.characterCategory ?? ""))) {
            card.characterCategory = index < 2 ? "core" : "support";
          }
          return card;
        });
        while (alignedCards.length < roster.length) {
          const rosterName = roster[alignedCards.length];
          alignedCards.push(buildDefaultCharacterCardFromRoster(storyRecord, rosterName, alignedCards.length));
        }
        normalized.cards = alignedCards;
      }
    }
    ensureObjectArrayMin(
      normalized,
      "cards",
      3,
      [
        {
          name: "林澈",
          rolePositioning: "主引导角色",
          personalityTags: ["温和", "可靠", "执行力强"],
          backgroundSummary: "负责带玩家熟悉经营目标、订单循环和首轮扩建节奏。",
          interactionResponsibility: "承担新手引导、阶段目标提示和订单完成反馈。",
          collectionValue: "解锁更多互动台词、主题装扮与成长事件。",
          relatedSystems: ["经营系统", "任务系统", "扩建系统"],
          storyAnchors: ["中央码头开张", "餐饮街试营业"],
          visualKeywords: ["海风短发", "浅蓝围裙", "温暖笑容"],
        },
        {
          name: "周叔",
          rolePositioning: "经营辅助角色",
          personalityTags: ["稳重", "熟练", "务实"],
          backgroundSummary: "熟悉小镇设施与材料流转，负责推动中期扩建和资源补给。",
          interactionResponsibility: "承担扩建提示、资源补给说明和高收益订单解锁。",
          collectionValue: "可解锁限定摊位外观与扩建动画包装。",
          relatedSystems: ["扩建系统", "订单系统", "资源循环"],
          storyAnchors: ["餐饮街试营业", "手作摊主题周"],
          visualKeywords: ["深色工装", "工具腰包", "宽肩轮廓"],
        },
        {
          name: "桃枝",
          rolePositioning: "活动与装扮角色",
          personalityTags: ["活泼", "有创意", "社交感强"],
          backgroundSummary: "负责活动包装与主题装扮，把收集目标和节日氛围接入经营循环。",
          interactionResponsibility: "承担活动入口提示、主题兑换与装扮反馈。",
          collectionValue: "可解锁节日主题装扮与活动限定插图。",
          relatedSystems: ["活动系统", "装扮收集", "角色互动系统"],
          storyAnchors: ["港镇灯会活动", "手作摊主题周"],
          visualKeywords: ["粉橙配色", "灯串饰品", "轻快动作"],
        },
      ],
      6,
    );
    if (Array.isArray(normalized.cards)) {
      normalized.populationSummary = {
        coreCharacterCount: normalized.cards.filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).characterCategory === "core").length,
        supportCharacterCount: normalized.cards.filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).characterCategory === "support").length,
        visitorArchetypeCount: normalized.cards.filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).characterCategory === "visitor").length,
      };
      normalized.entityRegistry = (normalized.cards as Array<Record<string, unknown>>).map((card, index) =>
        buildEntityFromName(
          String(card.name ?? `character_${index + 1}`),
          card.characterCategory === "visitor" ? "visitor" : "character",
          index,
          {
            entityId: typeof card.entityId === "string" ? card.entityId : buildEntityIdFromName(String(card.name ?? `character_${index + 1}`), "character", index),
            functionalRole: typeof card.interactionResponsibility === "string" && card.interactionResponsibility.trim().length >= 4
              ? card.interactionResponsibility
              : `${String(card.name ?? `character_${index + 1}`)} supports role interaction in the prototype.`,
            relatedSystems: Array.isArray(card.relatedSystems) ? card.relatedSystems : [],
          },
        ),
      );
    }
  }

  if (stage === "asset_manifest_tool") {
    cleanStringField(normalized, "visualStyle", 200);
    cleanStringArrayField(normalized, "exportRules", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "layeredRules", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "priorityOrder", { min: 2, max: 60, maxItems: 8 });
    cleanObjectArrayField(normalized, "assetGroups", 20, (item) => {
      cleanStringField(item, "assetName", 60);
      item.assetType = normalizeAssetType(item.assetType);
      cleanStringField(item, "assetType", 40);
      cleanStringField(item, "purpose", 120);
      cleanStringField(item, "spec", 80);
      cleanStringField(item, "ratio", 40);
      cleanStringField(item, "layer", 40);
      cleanStringField(item, "namingRule", 80);
      cleanStringField(item, "backgroundRequirement", 80);
      cleanStringArrayField(item, "sourceDependencies", { min: 2, max: 60, maxItems: 5 });
      cleanStringArrayField(item, "entityIds", { min: 2, max: 40, maxItems: 8 });
      cleanStringArrayField(item, "runtimeTargets", { min: 2, max: 80, maxItems: 8 });
      cleanStringField(item, "deliveryScope", 20);
      if (!["scene", "ui", "character", "event", "layout", "timeline"].includes(String(item.deliveryScope ?? ""))) {
        item.deliveryScope = item.assetType === "UI图标" || item.assetType === "UI面板" ? "ui" : item.assetType === "角色立绘" ? "character" : "scene";
      }
      return item;
    });
    if (Array.isArray(normalized.assetGroups)) {
      normalized.entityRegistry = (normalized.assetGroups as Array<Record<string, unknown>>)
        .flatMap((group, index) => {
          const entityIds = Array.isArray(group.entityIds) ? group.entityIds.filter((item): item is string => typeof item === "string" && item.trim().length >= 2) : [];
          if (entityIds.length === 0 && typeof group.assetName === "string") {
            entityIds.push(buildEntityIdFromName(group.assetName, "asset", index));
            group.entityIds = entityIds;
          }
          return entityIds.map((entityId, entityIndex) =>
            buildEntityFromName(entityId, String(group.deliveryScope ?? "scene") === "character" ? "character" : "facility", entityIndex, {
              entityId,
              entityName: entityId,
              functionalRole: typeof group.purpose === "string" ? group.purpose : "Supports runtime asset delivery.",
              requiresAsset: true,
              requiresLayout: ["scene", "character", "layout"].includes(String(group.deliveryScope ?? "scene")),
              requiresCopy: ["ui", "character", "event"].includes(String(group.deliveryScope ?? "scene")),
            }),
          );
        })
        .slice(0, 24);
    }

    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const sceneRecord =
      requestRecord?.scene && typeof requestRecord.scene === "object" && !Array.isArray(requestRecord.scene)
        ? (requestRecord.scene as Record<string, unknown>)
        : undefined;
    const sceneEntities = Array.isArray(sceneRecord?.sceneEntities)
      ? sceneRecord.sceneEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const assetGroups = Array.isArray(normalized.assetGroups) ? (normalized.assetGroups as Array<Record<string, unknown>>) : [];

    const assetMatchesUpstreamEntity = (entity: Record<string, unknown>) => {
      const entityKeys = [entity.entityId, entity.entityName]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .map((value) => normalizeEntity(value));
      return assetGroups.some((group) => {
        const groupKeys = [
          ...(Array.isArray(group.entityIds) ? group.entityIds : []),
          ...(Array.isArray(group.sourceDependencies) ? group.sourceDependencies : []),
          ...(Array.isArray(group.runtimeTargets) ? group.runtimeTargets : []),
          typeof group.assetName === "string" ? group.assetName : "",
          typeof group.purpose === "string" ? group.purpose : "",
        ]
          .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
          .map((value) => normalizeEntity(value));
        return entityKeys.some((entityKey) =>
          groupKeys.some((groupKey) => groupKey === entityKey || groupKey.includes(entityKey) || entityKey.includes(groupKey)),
        );
      });
    };

    const requiredSceneAssets = sceneEntities.filter((entity) => entity.requiresAsset === true);
    const missingSceneAssets = requiredSceneAssets.filter((entity) => !assetMatchesUpstreamEntity(entity));
    if (missingSceneAssets.length > 0) {
      throw new Error(
        `asset_manifest_tool 未覆盖这些 requiresAsset 场景实体：${missingSceneAssets
          .slice(0, 6)
          .map((entity) => String(entity.entityId ?? entity.entityName ?? "unknown"))
          .join("、")}`,
      );
    }

    const visibleResourceEntities = requiredSceneAssets.filter((entity) => {
      const entityType = typeof entity.entityType === "string" ? entity.entityType : "";
      const combined = [entity.entityId, entity.entityName, entity.functionalRole, ...(Array.isArray(entity.relatedSystems) ? entity.relatedSystems : [])]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .join(" ");
      return entityType === "resource_token" && /(event|festival|reward|coin|currency|token|voucher|ticket|积分|代币|港币|许可券|奖励)/i.test(combined);
    });

    const missingVisibleResourceAssets = visibleResourceEntities.filter((entity) => {
      const entityKeys = [entity.entityId, entity.entityName]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .map((value) => normalizeEntity(value));
      return !assetGroups.some((group) => {
        const deliveryScope = typeof group.deliveryScope === "string" ? group.deliveryScope : "";
        if (!["ui", "event", "scene"].includes(deliveryScope)) return false;
        const groupKeys = [
          ...(Array.isArray(group.entityIds) ? group.entityIds : []),
          ...(Array.isArray(group.sourceDependencies) ? group.sourceDependencies : []),
          ...(Array.isArray(group.runtimeTargets) ? group.runtimeTargets : []),
          typeof group.assetName === "string" ? group.assetName : "",
          typeof group.purpose === "string" ? group.purpose : "",
        ]
          .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
          .map((value) => normalizeEntity(value));
        return entityKeys.some((entityKey) =>
          groupKeys.some((groupKey) => groupKey === entityKey || groupKey.includes(entityKey) || entityKey.includes(groupKey)),
        );
      });
    });

    if (missingVisibleResourceAssets.length > 0) {
      throw new Error(
        `asset_manifest_tool 未为可见资源实体生成明确载体：${missingVisibleResourceAssets
          .slice(0, 6)
          .map((entity) => String(entity.entityId ?? entity.entityName ?? "unknown"))
          .join("、")}`,
      );
    }
  }

  if (stage === "copywriting_tool") {
    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const sceneRecord =
      requestRecord?.scene && typeof requestRecord.scene === "object" && !Array.isArray(requestRecord.scene)
        ? (requestRecord.scene as Record<string, unknown>)
        : undefined;
    const storyRecord =
      requestRecord?.story && typeof requestRecord.story === "object" && !Array.isArray(requestRecord.story)
        ? (requestRecord.story as Record<string, unknown>)
        : undefined;
    const economyRecord =
      requestRecord?.economy && typeof requestRecord.economy === "object" && !Array.isArray(requestRecord.economy)
        ? (requestRecord.economy as Record<string, unknown>)
        : undefined;
    const assetManifestRecord =
      requestRecord?.assetManifest && typeof requestRecord.assetManifest === "object" && !Array.isArray(requestRecord.assetManifest)
        ? (requestRecord.assetManifest as Record<string, unknown>)
        : undefined;
    const characterCards = Array.isArray(requestRecord?.characters)
      ? requestRecord.characters.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const sceneTargets = [
      ...(Array.isArray(sceneRecord?.interactiveAreas) ? sceneRecord.interactiveAreas : []),
      ...(Array.isArray(sceneRecord?.contentHotspots) ? sceneRecord.contentHotspots : []),
    ].filter((item): item is string => typeof item === "string" && item.trim().length >= 2);
    const storyRoster = Array.isArray(storyRecord?.characterRoster)
      ? storyRecord.characterRoster.filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
      : [];
    const storyAnchors = [
      ...(Array.isArray(storyRecord?.chapterAnchors) ? storyRecord.chapterAnchors : []),
      ...(Array.isArray(storyRecord?.mainPlotBeats) ? storyRecord.mainPlotBeats : []),
    ].filter((item): item is string => typeof item === "string" && item.trim().length >= 4);
    const priorityAssets = Array.isArray(assetManifestRecord?.priorityOrder)
      ? assetManifestRecord.priorityOrder.filter((item): item is string => typeof item === "string" && item.trim().length >= 2).slice(0, 6)
      : [];
    const economyTerms = Array.from(
      new Set(
        [
          ...(Array.isArray(economyRecord?.coreCurrencies) ? economyRecord.coreCurrencies : []),
          ...(Array.isArray(economyRecord?.monetizationHooks) ? economyRecord.monetizationHooks : []),
          ...(Array.isArray(economyRecord?.decorationUnlocks) ? economyRecord.decorationUnlocks : []),
        ]
          .filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
          .filter((item) => /(券|币|票|装扮|头像框|礼包|voucher|ticket|coin|currency|bundle|decoration)/i.test(item)),
      ),
    ).slice(0, 8);

    const cleanCopyItem = (item: Record<string, unknown>) => {
      cleanStringField(item, "id", 60);
      cleanStringField(item, "surface", 20);
      cleanStringField(item, "target", 80);
      cleanStringField(item, "text", 140);
      cleanStringField(item, "usage", 80);
      cleanStringField(item, "tone", 40);
      cleanStringField(item, "relatedEntity", 60);
      if (typeof item.target === "string" && sceneTargets.length > 0) {
        item.target = alignToKnownCandidate(item.target, sceneTargets);
      }
      if (typeof item.relatedEntity === "string" && storyAnchors.length > 0) {
        const alignedAnchor = alignToKnownCandidate(item.relatedEntity, storyAnchors);
        if (alignedAnchor && alignedAnchor !== item.relatedEntity && normalizeEntity(alignedAnchor).length >= normalizeEntity(String(item.relatedEntity)).length) {
          item.relatedEntity = alignedAnchor;
        }
      }
      cleanStringField(item, "relatedEntity", 60);
      return item;
    };

    cleanObjectArrayField(normalized, "pageTitles", 8, cleanCopyItem);
    cleanObjectArrayField(normalized, "panelTitles", 12, cleanCopyItem);
    cleanObjectArrayField(normalized, "buttonLabels", 16, cleanCopyItem);
    cleanObjectArrayField(normalized, "taskAndOrderCopy", 16, cleanCopyItem);
    cleanObjectArrayField(normalized, "eventEntryCopy", 12, cleanCopyItem);
    cleanObjectArrayField(normalized, "sceneHints", 16, cleanCopyItem);
    cleanObjectArrayField(normalized, "characterLines", 16, cleanCopyItem);
    cleanObjectArrayField(normalized, "characterCardCopy", 12, cleanCopyItem);
    cleanObjectArrayField(normalized, "assetLabels", 16, cleanCopyItem);

    const pageTitles = Array.isArray(normalized.pageTitles) ? normalized.pageTitles : [];
    const panelTitles = Array.isArray(normalized.panelTitles) ? normalized.panelTitles : [];
    const buttonLabels = Array.isArray(normalized.buttonLabels) ? normalized.buttonLabels : [];
    const taskAndOrderCopy = Array.isArray(normalized.taskAndOrderCopy) ? normalized.taskAndOrderCopy : [];
    const eventEntryCopy = Array.isArray(normalized.eventEntryCopy) ? normalized.eventEntryCopy : [];
    const sceneHintsNormalized = Array.isArray(normalized.sceneHints) ? normalized.sceneHints : [];
    const characterLines = Array.isArray(normalized.characterLines) ? normalized.characterLines : [];
    const characterCardCopy = Array.isArray(normalized.characterCardCopy) ? normalized.characterCardCopy : [];
    const assetLabels = Array.isArray(normalized.assetLabels) ? normalized.assetLabels : [];
    const copyText = normalizeEntity(
      JSON.stringify(
        [
          ...pageTitles,
          ...panelTitles,
          ...buttonLabels,
          ...taskAndOrderCopy,
          ...eventEntryCopy,
          ...sceneHintsNormalized,
          ...characterLines,
          ...characterCardCopy,
          ...assetLabels,
        ],
        null,
        0,
      ),
    );

    const missingRosterNames = storyRoster.filter((name) => !copyText.includes(normalizeEntity(name)));
    if (missingRosterNames.length > Math.max(1, Math.floor(storyRoster.length / 3))) {
      console.warn(`[copywriting_tool] 未覆盖这些核心角色名（交由一致性检查修复）：${missingRosterNames.slice(0, 6).join("、")}`);
    }

    const missingCharacterCards = characterCards
      .map((card) => (typeof card.name === "string" ? card.name.trim() : ""))
      .filter((name) => name.length >= 2)
      .filter((name) => !copyText.includes(normalizeEntity(name)));
    if (missingCharacterCards.length > Math.max(1, Math.floor(characterCards.length / 3))) {
      console.warn(`[copywriting_tool] 未覆盖这些角色资料卡角色（交由一致性检查修复）：${missingCharacterCards.slice(0, 6).join("、")}`);
    }

    const missingStoryAnchors = storyAnchors
      .slice(0, 6)
      .filter((anchor) => buildAnchorSearchKeys(anchor).every((key) => !copyText.includes(key)));
    if (missingStoryAnchors.length > Math.max(1, Math.floor(storyAnchors.length / 3))) {
      console.warn(`[copywriting_tool] 未覆盖这些剧情锚点（交由一致性检查修复）：${missingStoryAnchors.slice(0, 4).join("、")}`);
    }

    const assetLabelText = normalizeEntity(JSON.stringify(assetLabels, null, 0));
    const missingPriorityAssets = priorityAssets.filter((assetName) => buildAssetSearchKeys(assetName).every((key) => !assetLabelText.includes(key) && !copyText.includes(key)));
    if (missingPriorityAssets.length > Math.max(1, Math.floor(priorityAssets.length / 3))) {
      console.warn(`[copywriting_tool] 未覆盖这些优先资产标签（交由一致性检查修复）：${missingPriorityAssets.slice(0, 6).join("、")}`);
    }

    const economyTermMatches = (term: string): boolean => {
      const full = normalizeEntity(term);
      if (full.length >= 2 && copyText.includes(full)) return true;
      // For long compound descriptions, split aggressively into sub-phrases and check matches
      const segments = term
        .split(/[:：、，,；;+\s×x与和或及含需通过]+|\d+[张个次枚份套组]?/)
        .map((s) => normalizeEntity(s.trim()))
        .filter((s) => s.length >= 2);
      if (segments.length <= 1) return false;
      // Consider matched if at least one segment (or a core sub-phrase of a long segment) appears
      return segments.some((seg) => {
        if (copyText.includes(seg)) return true;
        // For long segments (>6 chars), try trimming trailing action verbs and re-check
        if (seg.length > 6) {
          const trimmed = seg.replace(/(兑换|解锁|获取|购买|抽取|合成|升级)$/, "");
          if (trimmed.length >= 2 && trimmed !== seg && copyText.includes(trimmed)) return true;
          // Also try matching the copy text containing a prefix of this segment (≥4 chars)
          for (let len = Math.min(seg.length - 1, 8); len >= 4; len--) {
            if (copyText.includes(seg.slice(0, len))) return true;
          }
        }
        return false;
      });
    };
    const missingEconomyTerms = economyTerms.filter((term) => !economyTermMatches(term));
    if (missingEconomyTerms.length > Math.max(2, Math.ceil(economyTerms.length / 2))) {
      console.warn(`[copywriting_tool] 未显式暴露这些经济词汇或挂点（交由一致性检查修复）：${missingEconomyTerms.slice(0, 6).join("、")}`);
    }
  }

  if (stage === "evaluate") {
    if (!normalized.hardGates || typeof normalized.hardGates !== "object" || Array.isArray(normalized.hardGates)) {
      normalized.hardGates = {};
    }
    const hardGates = normalized.hardGates as Record<string, unknown>;
    hardGates.loopsClear = typeof hardGates.loopsClear === "boolean" ? hardGates.loopsClear : true;
    hardGates.economyClosedLoop = typeof hardGates.economyClosedLoop === "boolean" ? hardGates.economyClosedLoop : true;
    hardGates.systemCoverage = typeof hardGates.systemCoverage === "boolean" ? hardGates.systemCoverage : true;
    hardGates.sceneUiReady = typeof hardGates.sceneUiReady === "boolean" ? hardGates.sceneUiReady : true;
    hardGates.storyCharacterAligned = typeof hardGates.storyCharacterAligned === "boolean" ? hardGates.storyCharacterAligned : true;
    hardGates.assetManifestExecutable = typeof hardGates.assetManifestExecutable === "boolean" ? hardGates.assetManifestExecutable : true;
    cleanStringArrayField(normalized, "blockedBy", { min: 3, max: 180, maxItems: 10 });
    if (Array.isArray(normalized.blockedBy)) {
      normalized.blockedBy = normalized.blockedBy.slice(0, 10);
    }
    cleanStringField(normalized, "summary", 260);
    cleanStringArrayField(normalized, "risks", { min: 4, max: 160, maxItems: 6 });
    cleanStringArrayField(normalized, "recommendations", { min: 4, max: 160, maxItems: 6 });
  }

  if (stage === "verification") {
    cleanStringField(normalized, "summary", 220);
    cleanStringArrayField(normalized, "repairFocus", { min: 4, max: 120, maxItems: 6 });
    cleanStringField(normalized, "recommendedNextStep", 160);
    ensureStringField(normalized, "recommendedNextStep", "进入返修并重新评估。", 8, 160);
  }

  if (stage === "repair_tool") {
    cleanStringField(normalized, "rationale", 220);
    cleanStringArrayField(normalized, "stopConditions", { min: 6, max: 180, maxItems: 6 });
    cleanStringArrayField(normalized, "recheckEdges", { min: 2, max: 80, maxItems: 16 });
    cleanObjectArrayField(normalized, "selectedTargets", 4, (item) => {
      cleanStringField(item, "toolName", 40);
      cleanStringField(item, "whyThisTool", 220);
      cleanStringArrayField(item, "expectedImpact", { min: 4, max: 180, maxItems: 8 });
      cleanStringArrayField(item, "relatedTaskEdges", { min: 2, max: 80, maxItems: 8 });
      return item;
    });
    cleanStringField(normalized, "repairGoal", 160);
    cleanStringField(normalized, "repairInstructions", 260);
    cleanStringArrayField(normalized, "repairTools", { min: 2, max: 40, maxItems: 5 });
    cleanStringArrayField(normalized, "expectedImprovements", { min: 4, max: 120, maxItems: 6 });
    ensureStringArrayMin(
      normalized,
      "stopConditions",
      2,
      ["关键失败边全部通过复检。", "返修输出满足成功条件并可进入下一阶段。"],
      180,
      6,
    );
  }

  if (stage === "semantic_consistency_tool") {
    cleanStringField(normalized, "summary", 220);
    cleanObjectArrayField(normalized, "edges", 16, (item) => {
      cleanStringField(item, "edgeId", 80);
      cleanStringField(item, "sourceTool", 40);
      cleanStringField(item, "targetTool", 40);
      cleanStringArrayField(item, "issues", { min: 4, max: 220, maxItems: 12 });
      cleanStringArrayField(item, "evidence", { min: 2, max: 220, maxItems: 12 });
      cleanStringArrayField(item, "repairSuggestions", { min: 4, max: 220, maxItems: 8 });
        cleanStringArrayField(item, "involvedTools", { min: 2, max: 40, maxItems: 4 });
        if (Array.isArray(item.problemLocationHints)) {
          item.problemLocationHints = item.problemLocationHints.map((hint: Record<string, unknown>) => {
            cleanStringField(hint, "toolName", 40);
            cleanStringField(hint, "reason", 220);
            cleanEnumField(hint, "confidence", ["low", "medium", "high"], "medium");
            return hint;
          });
        }
        return item;
      });
  }

  if (stage === "consistency_repair_planner") {
    cleanStringField(normalized, "rationale", 220);
    cleanStringArrayField(normalized, "stopConditions", { min: 6, max: 180, maxItems: 6 });
    cleanStringArrayField(normalized, "recheckEdges", { min: 2, max: 80, maxItems: 16 });
    cleanObjectArrayField(normalized, "selectedTargets", 4, (item) => {
      cleanStringField(item, "toolName", 40);
      cleanStringField(item, "whyThisTool", 220);
      cleanStringArrayField(item, "expectedImpact", { min: 4, max: 180, maxItems: 8 });
      cleanStringArrayField(item, "relatedTaskEdges", { min: 2, max: 80, maxItems: 8 });
      return item;
    });
    cleanStringField(normalized, "repairGoal", 160);
    cleanStringField(normalized, "repairInstructions", 260);
    cleanStringArrayField(normalized, "repairTools", { min: 2, max: 40, maxItems: 4 });
    cleanStringArrayField(normalized, "expectedImprovements", { min: 4, max: 120, maxItems: 6 });
    ensureStringArrayMin(
      normalized,
      "stopConditions",
      2,
      ["关键失败边全部通过复检。", "返修输出满足成功条件并可进入下一阶段。"],
      180,
      6,
    );
  }

  if (stage === "local_repair_decision_tool") {
    cleanBooleanField(normalized, "shouldRepairNow", false);
    cleanStringField(normalized, "rationale", 260);
    cleanStringField(normalized, "whyTheseTargets", 260);
    cleanStringField(normalized, "whyNotOtherTargets", 260);
    cleanStringField(normalized, "costReasoning", 260);
    cleanStringArrayField(normalized, "successConditions", { min: 6, max: 180, maxItems: 8 });
    cleanStringArrayField(normalized, "expectedImpact", { min: 4, max: 180, maxItems: 8 });
    cleanStringArrayField(normalized, "selectedTargets", { min: 2, max: 40, maxItems: 6 });
    cleanStringArrayField(normalized, "recheckEdges", { min: 2, max: 80, maxItems: 16 });
  }

  return normalized;
}

function buildEntitySignalText(item: Record<string, unknown>) {
  const entityId = typeof item.entityId === "string" ? item.entityId : "";
  const entityName = typeof item.entityName === "string" ? item.entityName : "";
  const functionalRole = typeof item.functionalRole === "string" ? item.functionalRole : "";
  const entityType = typeof item.entityType === "string" ? item.entityType : "";
  const relatedSystems = Array.isArray(item.relatedSystems)
    ? item.relatedSystems.filter((value): value is string => typeof value === "string").join(" ")
    : "";
  return `${entityId} ${entityName} ${functionalRole} ${entityType} ${relatedSystems}`.toLowerCase();
}

function isRoleLikeEntity(item: Record<string, unknown>) {
  const entityType = typeof item.entityType === "string" ? item.entityType : "";
  if (entityType === "visitor" || entityType === "character") return true;
  return /(visitor|guest|customer|resident|tourist|villager|npc|companion|role|character|dialogue|mayor)/.test(
    buildEntitySignalText(item),
  );
}

function isBuildLikeEntity(item: Record<string, unknown>) {
  const entityType = typeof item.entityType === "string" ? item.entityType : "";
  if (entityType === "building" || entityType === "facility") return true;
  return /(building|facility|shop|store|stall|booth|plot|district|house|counter|station|display|slot)/.test(
    buildEntitySignalText(item),
  );
}

function extractGenreProfileFromPayload(requestPayload?: unknown): GenreFeatureProfile | null {
  if (!requestPayload || typeof requestPayload !== "object" || Array.isArray(requestPayload)) return null;
  const payload = requestPayload as Record<string, unknown>;
  const brief = payload.brief && typeof payload.brief === "object" && !Array.isArray(payload.brief)
    ? (payload.brief as Record<string, unknown>)
    : null;
  if (!brief || typeof brief.targetGenre !== "string") return null;
  return getGenreProfile(brief.targetGenre);
}

function validateStageSemanticReadiness(stage: string, value: unknown, requestPayload?: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  if (stage === "story_tool") {
    const storyRecord = value as Record<string, unknown>;
    const roster = Array.isArray(storyRecord.characterRoster)
      ? storyRecord.characterRoster.filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
      : [];
    const chapterAnchorsRaw = Array.isArray(storyRecord.chapterAnchors) ? storyRecord.chapterAnchors : [];
    const chapterAnchors = chapterAnchorsRaw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const text = obj.text ?? obj.name ?? obj.title ?? obj.anchor ?? obj.label ?? obj.content;
          if (typeof text === "string") return text;
          const vals = Object.values(obj).filter((v): v is string => typeof v === "string" && v.length >= 4);
          if (vals.length > 0) return vals[0];
        }
        return "";
      })
      .filter((s) => typeof s === "string" && s.trim().length >= 4);
    const mainPlotBeats = Array.isArray(storyRecord.mainPlotBeats)
      ? storyRecord.mainPlotBeats.filter((item): item is string => typeof item === "string" && item.trim().length >= 4)
      : [];
    if (chapterAnchors.length < 1) {
      throw new Error(`剧情锚点数量不足：chapterAnchors 至少需要 3 条，当前仅 ${chapterAnchors.length} 条。`);
    }
    if (mainPlotBeats.length < 1) {
      throw new Error(`剧情节拍数量不足：mainPlotBeats 至少需要 3 条，当前仅 ${mainPlotBeats.length} 条。`);
    }
    const anchorPool = [
      ...chapterAnchors,
      ...mainPlotBeats,
    ];

    const missingRoleReferences = roster.filter((roleName) => {
      const normalizedRole = normalizeEntity(roleName);
      return !anchorPool.some((anchor) => normalizeEntity(anchor).includes(normalizedRole));
    });

    if (missingRoleReferences.length > 0) {
      console.warn(`[story_tool] 剧情锚点未覆盖角色名单（交由一致性检查修复）：${missingRoleReferences.join("、")}`);
    }
  }

  if (stage === "gameplay_tool") {
    const gameplayRecord = value as Record<string, unknown>;
    const loopEntities = Array.isArray(gameplayRecord.loopEntities)
      ? gameplayRecord.loopEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const placeholderNames = loopEntities
      .map((entity) => ({
        entityId: typeof entity.entityId === "string" ? entity.entityId : "",
        entityName: typeof entity.entityName === "string" ? entity.entityName : "",
      }))
      .filter((entity) => entity.entityName && isPlaceholderEntityName(entity.entityName));
    if (placeholderNames.length > 0) {
      throw new Error(
        `gameplay_tool 使用了占位实体名，必须改成可复用的 runtime 名称：${placeholderNames
          .slice(0, 6)
          .map((entity) => `${entity.entityId}/${entity.entityName}`)
          .join("、")}`,
      );
    }
  }

  if (stage === "character_tool") {
    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const storyRecord =
      requestRecord?.story && typeof requestRecord.story === "object" && !Array.isArray(requestRecord.story)
        ? (requestRecord.story as Record<string, unknown>)
        : undefined;
    const roster = Array.isArray(storyRecord?.characterRoster)
      ? storyRecord.characterRoster.filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
      : [];
    const sourceAnchors = [
      ...(Array.isArray(storyRecord?.chapterAnchors) ? storyRecord.chapterAnchors : []),
      ...(Array.isArray(storyRecord?.mainPlotBeats) ? storyRecord.mainPlotBeats : []),
    ].filter((item): item is string => typeof item === "string" && item.trim().length >= 4);
    const cards = Array.isArray((value as Record<string, unknown>).cards)
      ? ((value as Record<string, unknown>).cards as Array<Record<string, unknown>>)
      : [];

    const missingRoster = roster.filter((name) => !cards.some((card) => card.name === name));
    if (missingRoster.length > 0) {
      throw new Error(`角色资料卡缺少核心角色：${missingRoster.join("、")}`);
    }

    const invalidAnchors: string[] = [];
    for (const card of cards) {
      const cardName = typeof card.name === "string" ? card.name : "";
      const cardAnchors = Array.isArray(card.storyAnchors) ? card.storyAnchors.filter((item): item is string => typeof item === "string") : [];
      const unmatched = cardAnchors.filter((anchor) => {
        const normalizedAnchor = normalizeEntity(anchor);
        return !sourceAnchors.some((sourceAnchor) => {
          const normalizedSource = normalizeEntity(sourceAnchor);
          return normalizedSource === normalizedAnchor || normalizedSource.includes(normalizedAnchor) || normalizedAnchor.includes(normalizedSource);
        });
      });
      if (unmatched.length > 0) {
        invalidAnchors.push(`${cardName || "未知角色"}=>${unmatched.join(" / ")}`);
      }
    }
    if (invalidAnchors.length > 0) {
      throw new Error(`角色卡锚点未对齐 story 原文：${invalidAnchors.join("；")}`);
    }
  }

  if (stage === "copywriting_tool") {
    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const sceneRecord =
      requestRecord?.scene && typeof requestRecord.scene === "object" && !Array.isArray(requestRecord.scene)
        ? (requestRecord.scene as Record<string, unknown>)
        : undefined;
    const interactiveAreas = Array.isArray(sceneRecord?.interactiveAreas)
      ? sceneRecord.interactiveAreas.filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
      : [];
    const sceneHints = Array.isArray((value as Record<string, unknown>).sceneHints)
      ? ((value as Record<string, unknown>).sceneHints as Array<Record<string, unknown>>)
      : [];
    const hintTargets = sceneHints
      .map((item) => (typeof item.target === "string" ? item.target : ""))
      .filter((item) => item.length >= 2);
    const norm = (s: string) => s.replace(/[\s_\-]/g, "").toLowerCase();
    const fuzzyMatch = (a: string, b: string) => {
      const na = norm(a), nb = norm(b);
      return na === nb || na.includes(nb) || nb.includes(na);
    };
    const requiredTargets = interactiveAreas.slice(0, Math.min(6, interactiveAreas.length));
    const missingTargets = requiredTargets.filter((target) => !hintTargets.some((ht) => fuzzyMatch(target, ht)));
    if (missingTargets.length > Math.max(1, Math.floor(requiredTargets.length / 3))) {
      console.warn(`[copywriting_tool] sceneHints 未覆盖关键 interactiveAreas（交由一致性检查修复）：${missingTargets.join("、")}`);
    }
  }
  if (stage === "economy_tool") {
    const economyRecord = value as Record<string, unknown>;
    const genreProfile = extractGenreProfileFromPayload(requestPayload);
    const coreCurrencies = Array.isArray(economyRecord.coreCurrencies)
      ? economyRecord.coreCurrencies.filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
      : [];
    const faucets = Array.isArray(economyRecord.faucets)
      ? economyRecord.faucets.filter((item): item is string => typeof item === "string" && item.trim().length >= 4)
      : [];
    const sinks = Array.isArray(economyRecord.sinks)
      ? economyRecord.sinks.filter((item): item is string => typeof item === "string" && item.trim().length >= 4)
      : [];
    const upgradeThresholds = Array.isArray(economyRecord.upgradeThresholds)
      ? economyRecord.upgradeThresholds.filter((item): item is string => typeof item === "string" && item.trim().length >= 4)
      : [];
    const orderCostLoop = typeof economyRecord.orderCostLoop === "string" ? economyRecord.orderCostLoop.trim() : "";
    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const gameplayRecord =
      requestRecord?.gameplay && typeof requestRecord.gameplay === "object" && !Array.isArray(requestRecord.gameplay)
        ? (requestRecord.gameplay as Record<string, unknown>)
        : undefined;
    const loopEntities = Array.isArray(gameplayRecord?.loopEntities)
      ? gameplayRecord.loopEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const tokenEntities = loopEntities.filter((entity) => entity.entityType === "resource_token");

    if (coreCurrencies.length < 3) {
      throw new Error(`economy_tool coreCurrencies 不足，当前仅有 ${coreCurrencies.length} 项。`);
    }
    if (faucets.length < 3 || sinks.length < 3) {
      throw new Error(`economy_tool 收支定义不足：faucets=${faucets.length}, sinks=${sinks.length}。`);
    }
    if (upgradeThresholds.length < 3) {
      throw new Error(`economy_tool upgradeThresholds 不足，当前仅有 ${upgradeThresholds.length} 项。`);
    }
    if ((!genreProfile || genreProfile.requireOrders) && orderCostLoop.length < 24) {
      throw new Error(`economy_tool orderCostLoop 过短，无法证明完整闭环，当前长度为 ${orderCostLoop.length}。`);
    }

    const allEconomyText = [...coreCurrencies, ...faucets, ...sinks, orderCostLoop].join(" ");
    const missingTokens = tokenEntities.filter((entity) => {
      const entityId = typeof entity.entityId === "string" ? normalizeEntity(entity.entityId) : "";
      const entityName = typeof entity.entityName === "string" ? normalizeEntity(entity.entityName) : "";
      const normalizedEcon = normalizeEntity(allEconomyText);
      return entityName.length > 0 && !normalizedEcon.includes(entityName) && !normalizedEcon.includes(entityId);
    });
    if (missingTokens.length > 0) {
      console.warn(`[economy_tool] 未承载部分资源实体（交由一致性检查修复）：${missingTokens.map((entity) => (typeof entity.entityName === "string" ? entity.entityName : "unknown")).join("、")}`);
    }
  }

  if (stage === "system_design_tool") {
    const systemRecord = value as Record<string, unknown>;
    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const gameplayRecord =
      requestRecord?.gameplay && typeof requestRecord.gameplay === "object" && !Array.isArray(requestRecord.gameplay)
        ? (requestRecord.gameplay as Record<string, unknown>)
        : undefined;
    const loopEntities = Array.isArray(gameplayRecord?.loopEntities)
      ? gameplayRecord.loopEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const systemEntities = Array.isArray(systemRecord.systemEntities)
      ? systemRecord.systemEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const systemToEntityMap = Array.isArray(systemRecord.systemToEntityMap)
      ? systemRecord.systemToEntityMap.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];

    const roleLikeLoopEntities = loopEntities.filter(isRoleLikeEntity);
    const buildLikeLoopEntities = loopEntities.filter(isBuildLikeEntity);
    const roleCarriers = systemEntities.filter(isRoleLikeEntity);
    const buildCarriers = systemEntities.filter(isBuildLikeEntity);

    if (roleLikeLoopEntities.length > 0 && roleCarriers.length === 0) {
      throw new Error("system_design_tool 未暴露 visitor/character carriers，无法承接 gameplay 中的人物或访客互动。");
    }

    if (buildLikeLoopEntities.length > 0 && buildCarriers.length === 0) {
      throw new Error("system_design_tool 未暴露 building/facility carriers，无法承接 gameplay 中的经营或扩建对象。");
    }

    const roleCarrierKeys = new Set(
      roleCarriers.flatMap((entity) => {
        const entityId = typeof entity.entityId === "string" ? normalizeEntity(entity.entityId) : "";
        const entityName = typeof entity.entityName === "string" ? normalizeEntity(entity.entityName) : "";
        return [entityId, entityName].filter(Boolean);
      }),
    );

    const roleMappings = systemToEntityMap.filter((item) => {
      const systemName = typeof item.systemName === "string" ? item.systemName.toLowerCase() : "";
      const responsibility = typeof item.responsibility === "string" ? item.responsibility.toLowerCase() : "";
      const entityIds = Array.isArray(item.entityIds)
        ? item.entityIds.filter((value): value is string => typeof value === "string").map((value) => normalizeEntity(value))
        : [];
      const touchesRoleCarrier = entityIds.some((entityId) => roleCarrierKeys.has(entityId));
      const roleSystemSignal = /(role|interaction|event|social|dialogue|visitor|guest|customer|companion|character)/.test(
        `${systemName} ${responsibility}`,
      );
      return touchesRoleCarrier && roleSystemSignal;
    });

    if (roleLikeLoopEntities.length > 0 && roleCarriers.length > 0 && roleMappings.length === 0) {
      throw new Error("system_design_tool 已有 visitor/character carriers，但 systemToEntityMap 未将它们挂入角色互动、事件或其他 loop-facing system。");
    }
  }

  if (stage === "scene_design_patch_tool") {
    const patchRecord = value as Record<string, unknown>;
    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const systemsRecord =
      requestRecord?.systems && typeof requestRecord.systems === "object" && !Array.isArray(requestRecord.systems)
        ? (requestRecord.systems as Record<string, unknown>)
        : undefined;
    const baselineRecord =
      requestRecord?.currentSceneBaseline && typeof requestRecord.currentSceneBaseline === "object" && !Array.isArray(requestRecord.currentSceneBaseline)
        ? (requestRecord.currentSceneBaseline as Record<string, unknown>)
        : undefined;
    const repairFocusRecord =
      requestRecord?.sceneRepairFocus && typeof requestRecord.sceneRepairFocus === "object" && !Array.isArray(requestRecord.sceneRepairFocus)
        ? (requestRecord.sceneRepairFocus as Record<string, unknown>)
        : undefined;

    const systemEntities = Array.isArray(systemsRecord?.systemEntities)
      ? systemsRecord.systemEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const focusMissingEntities = Array.isArray(repairFocusRecord?.missingEntities)
      ? repairFocusRecord.missingEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const focusMissingSceneEntities = Array.isArray(repairFocusRecord?.missingSceneEntities)
      ? repairFocusRecord.missingSceneEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const focusMissingBuildingDefinitions = Array.isArray(repairFocusRecord?.missingBuildingDefinitions)
      ? repairFocusRecord.missingBuildingDefinitions.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const baselineEntities = Array.isArray(baselineRecord?.sceneEntities)
      ? baselineRecord.sceneEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const baselineZoneMappings = Array.isArray(baselineRecord?.zoneEntityMap)
      ? baselineRecord.zoneEntityMap.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const baselineBuildingDefinitions = Array.isArray(baselineRecord?.buildingDefinitions)
      ? baselineRecord.buildingDefinitions.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const appendSceneEntities = Array.isArray(patchRecord.appendSceneEntities)
      ? patchRecord.appendSceneEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const appendZoneEntityMap = Array.isArray(patchRecord.appendZoneEntityMap)
      ? patchRecord.appendZoneEntityMap.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const appendBuildingDefinitions = Array.isArray(patchRecord.appendBuildingDefinitions)
      ? patchRecord.appendBuildingDefinitions.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];

    const resolveFocusEntity = (focusEntity: Record<string, unknown>) => {
      const focusKeys = [focusEntity.entityId, focusEntity.entityName]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .map((value) => normalizeEntity(value));
      return systemEntities.find((entity) => {
        const entityKeys = [entity.entityId, entity.entityName]
          .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
          .map((value) => normalizeEntity(value));
        return focusKeys.some((key) => entityKeys.some((entityKey) => entityKey === key || entityKey.includes(key) || key.includes(entityKey)));
      });
    };

    const focusSystemEntities = [...focusMissingEntities, ...focusMissingSceneEntities, ...focusMissingBuildingDefinitions]
      .map(resolveFocusEntity)
      .filter((entity): entity is Record<string, unknown> => Boolean(entity));

    const hasSceneEntity = (entity: Record<string, unknown>) => {
      const entityKeys = [entity.entityId, entity.entityName]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .map((value) => normalizeEntity(value));
      return [...baselineEntities, ...appendSceneEntities].some((candidate) => {
        const candidateKeys = [candidate.entityId, candidate.entityName]
          .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
          .map((value) => normalizeEntity(value));
        return entityKeys.some((key) => candidateKeys.some((candidateKey) => candidateKey === key || candidateKey.includes(key) || key.includes(candidateKey)));
      });
    };

    const hasZoneMapping = (entity: Record<string, unknown>) => {
      const entityKeys = [entity.entityId, entity.entityName]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .map((value) => normalizeEntity(value));
      return [...baselineZoneMappings, ...appendZoneEntityMap].some((mapping) => {
        const mappingKeys = Array.isArray(mapping.entityIds)
          ? mapping.entityIds.filter((value): value is string => typeof value === "string").map((value) => normalizeEntity(value))
          : [];
        return entityKeys.some((key) => mappingKeys.includes(key));
      });
    };

    const hasBuildingDefinition = (entity: Record<string, unknown>) => {
      const entityKeys = [entity.entityId, entity.entityName]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .map((value) => normalizeEntity(value));
      return [...baselineBuildingDefinitions, ...appendBuildingDefinitions].some((building) => {
        const buildingKeys = [building.buildingId, building.buildingName, building.slotName]
          .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
          .map((value) => normalizeEntity(value));
        return entityKeys.some((key) => buildingKeys.some((buildingKey) => buildingKey === key || buildingKey.includes(key) || key.includes(buildingKey)));
      });
    };

    const missingSceneEntities = focusSystemEntities.filter((entity) => !hasSceneEntity(entity));
    if (missingSceneEntities.length > 0) {
      console.warn(`[scene_design_patch_tool] 未补入 sceneEntities（交由一致性检查修复）：${missingSceneEntities.map((entity) => String(entity.entityId ?? entity.entityName ?? "unknown")).join("、")}`);
    }

    const missingZoneMappings = focusSystemEntities.filter((entity) => !hasZoneMapping(entity));
    if (missingZoneMappings.length > 0) {
      console.warn(`[scene_design_patch_tool] 未补入 zoneEntityMap（交由一致性检查修复）：${missingZoneMappings.map((entity) => String(entity.entityId ?? entity.entityName ?? "unknown")).join("、")}`);
    }

    const missingBuildingDefinitions = focusSystemEntities.filter((entity) => {
      const entityType = typeof entity.entityType === "string" ? entity.entityType : "";
      return entity.requiresLayout === true && ["building", "facility", "activity_carrier"].includes(entityType) && !hasBuildingDefinition(entity);
    });
    if (missingBuildingDefinitions.length > 0) {
      // 自动生成最小且泛化的 buildingDefinitions 补丁，避免直接抛错终止流程。
      // 生成规则：使用现有 entityId/entityName，slotName 用 `<entityId>_slot`，文本保持通用以便跨场景复用。
      for (const ent of missingBuildingDefinitions) {
        const bId = typeof ent.entityId === "string" && ent.entityId.trim().length >= 2 ? ent.entityId : typeof ent.entityName === "string" ? buildEntityIdFromName(ent.entityName, "building", 0) : `building_unknown`;
        const bName = typeof ent.entityName === "string" ? ent.entityName : String(bId);
        const bType = typeof ent.entityType === "string" ? ent.entityType : "facility";
        const slot = `${bId}_slot`;
        const def: Record<string, unknown> = {
          buildingId: bId,
          buildingName: bName,
          buildingType: bType,
          slotName: slot,
          gameplayPurpose: "支持核心交互与布局",
          upgradeHook: "保留扩展接口",
        };
        // 修改本地数组并同步回 patchRecord，后续校验会读取这些值
        appendBuildingDefinitions.push(def);
        if (!Array.isArray(patchRecord.appendBuildingDefinitions)) patchRecord.appendBuildingDefinitions = [];
        (patchRecord.appendBuildingDefinitions as Array<Record<string, unknown>>).push(def);
      }
    }
  }
}

function createLangfuseGeneration(params: RunStructuredChatParams<unknown>) {
  if (!isLangfuseEnabled()) return null;

  const attributes = {
    input: params.requestPayload,
    model: params.model,
    metadata: {
      stage: params.stage,
      phase: params.debugMeta?.phase,
      title: params.debugMeta?.title,
      runId: params.debugMeta?.runId,
      sessionId: params.debugMeta?.sessionId,
      iteration: params.debugMeta?.iteration,
      schemaName: params.schemaName,
    },
  };

  if (params.debugMeta?.langfuseParent) {
    return params.debugMeta.langfuseParent.startObservation(
      params.debugMeta.title || params.stage,
      attributes,
      { asType: "generation" },
    );
  }

  if (params.debugMeta?.runId) {
    return startObservation(params.debugMeta.title || params.stage, attributes, { asType: "generation" });
  }

  return null;
}

function stageRepairGuidance(stage: string) {
  switch (stage) {
    case "economy_tool":
      return [
        "economy_tool 修复重点：",
        "- coreCurrencies 至少 3 项，并覆盖基础经营货币与扩建/活动进度货币。",
        "- orderCostLoop 必须清楚描述订单产出、资源投入、升级/扩建、收益提升的闭环。",
        "- upgradeThresholds 至少 3 项，且与订单、扩建、装饰解锁相对应。",
      ].join("\n");
    case "system_design_tool":
      return [
        "system_design_tool 修复重点：",
        "- gameplay 中的人物、访客、居民、顾客、陪伴或对话角色，必须在 systemEntities 中稳定暴露为 character 或 visitor carriers。",
        "- systemToEntityMap 必须把这些 people-facing carriers 挂到 roleInteractionSystem、eventSystem、missionSystem 或其他 loop-facing system。",
        "- 纯资源、货币、券、点数不要误标成 building/facility；真正可见的经营载体才使用 building/facility。",
        "- 修复时保留已正确的系统实体，只纠正错类型、漏映射和缺责任说明的问题。",
      ].join("\n");
    case "scene_design_tool":
      return [
        "scene_design_tool 修复重点：",
        "- interactiveAreas、contentHotspots 必须承接活动系统与角色互动系统。",
        "- 场景热区命名要能被 UI、文案、资产清单直接复用。",
        "- navigationFlow 与 stateTransitions 要体现订单完成、扩建完成、活动开放后的变化。",
        "- 如果 repairPlan 点名了缺失热区、公告板、展示点或弹窗名称，必须逐字补进 interactiveAreas 或 contentHotspots。",
      ].join("\n");
    case "scene_design_patch_tool":
      return [
        "scene_design_patch_tool repair focus:",
        "- Return an additive patch only. Do not rewrite the full scene package.",
        "- Preserve valid baseline carriers and only append missing runtime entities, mappings, and building definitions.",
        "- For each missing entity, verify sceneEntities, zoneEntityMap, and buildingDefinitions together.",
        "- Reuse checker-named entityId, entityName, zoneName, slotName, and buildingId exactly when they are already valid identifiers.",
      ].join("\n");
    case "ui_architecture_tool":
      return [
        "ui_architecture_tool 修复重点：",
        "- buildModePanel 必须拆成 2 到 4 个离散元素。",
        "- feedbackLayer 必须覆盖订单完成、扩建完成、角色互动或活动触发中的至少 3 类反馈。",
        "- eventEntry 必须对应真实场景活动热区，不能虚构新入口。",
      ].join("\n");
    case "story_tool":
      return [
        "story_tool 修复重点：",
        "- characterRoster 只能是纯角色名数组。",
        "- 每个角色名都必须在 mainPlotBeats 或 chapterAnchors 中逐字出现。",
        "- chapterAnchors 要可直接复用到角色卡锚点、活动插图和页面文案。",
        "- 配角不能只停留在功能说明层，必须在 chapterAnchors 或 mainPlotBeats 中获得明确事件职责与情感动机。",
        "- 如果上一轮失败是角色卡锚点失效，本轮优先修 story 自身的锚点设计，不要让下游继续发明新事件标题。",
      ].join("\n");
    case "character_tool":
      return [
        "character_tool 修复重点：",
        "- cards 数量必须与 story.characterRoster 一致，name 必须逐字复用。",
        "- characterRoster 里出现的每个角色都必须有资料卡，不能遗漏团团、小桃、阿竹这类具体角色名。",
        "- interactionResponsibility 与 collectionValue 不能写成空泛短词，必须说明职责与可收集收益。",
        "- storyAnchors 只能引用 story.chapterAnchors 或 mainPlotBeats 中已存在的完整锚点句子，绝不能填角色名。",
        "- storyAnchors 优先直接复用 story.chapterAnchors 原句；如果 story 里没有对应锚点，说明应回到 story_tool 修正，而不是在角色卡里自造新标题。",
      ].join("\n");
    case "copywriting_tool":
      return [
        "copywriting_tool 修复重点：",
        "- 只能复用现有角色名、场景热区名、UI target、资产名与经济挂点名。",
        "- sceneHints 要优先覆盖关键 interactiveAreas，并补足至少 2 个 contentHotspots；characterLines 要覆盖每个角色；eventEntryCopy 或 taskAndOrderCopy 要覆盖核心 chapterAnchors。",
        "- 关键剧情锚点要在文案里直接体现目标、奖励或情绪，不要只做泛化改写。",
        "- assetLabels 至少覆盖主摊位、订单按钮图标、活动 Banner、关键活动入口载体和每个核心角色展示名称。",
        "- 如果 repairPlan 点名了缺失热区、锚点、角色立绘或关键资产标签，就必须逐条补齐，并在 target 或 relatedEntity 中逐字复用这些名字。",
        "- relatedEntity 必须保持短而稳定；只写角色名、热区名、chapterAnchor、assetName 或 entityId，不要写整句说明。",
        "- 不要发明新的按钮名、活动名、资产名或角色名。",
        "- sceneHints.target 必须直接复用 scene.interactiveAreas 或 scene.contentHotspots 的原始名字，角色名只放在 text 或 relatedEntity 里。",
        "- 如果缺少“角色立绘气泡热区”或“装扮按钮热区”提示，本轮必须各补 1 条明确引导玩家操作与收益的文案。",
      ].join("\n");
    case "asset_manifest_tool":
      return [
        "asset_manifest_tool 修复重点：",
        "- 必须覆盖 UI 中真实存在的活动入口、活动卡片、扩建确认面板、订单按钮图标等载体。",
        "- sourceDependencies 必须复用 scene/ui/story/character 中已有的真实名称，不能用抽象词替代。",
        "- 如果 repairPlan 点名缺失某个面板、图标、热点或展示点素材，这一轮必须逐字映射到 assetGroups 中。",
      ].join("\n");
    default:
      return [
        `${stage} 修复重点：`,
        "- 只修复结构、字段缺失、字段类型与最小内容要求。",
        "- 保持现有任务目标和命名体系，不要额外扩展设计范围。",
      ].join("\n");
  }
}

function createRepairPrompt(params: {
  stage: string;
  schemaName: string;
  validationError: string;
  rawContent: string | null;
}) {
  const sceneDesignAddendum =
    params.stage === "scene_design_tool" || params.stage === "scene_design_patch_tool"
      ? "6. For scene repair, preserve valid carriers and only add the missing runtime entities. Reuse checker-named entityId/entityName values exactly, and fill sceneEntities, zoneEntityMap, and buildingDefinitions together."
      : null;
  return [
    `你刚才输出的 ${params.schemaName} 未通过校验，请只修复结构和字段，不要改变任务目标。`,
    "要求：",
    "1. 只返回一个合法 JSON 对象。",
    "2. 保持字段名不变。",
    "3. 只修复缺字段、类型错误、长度不够、枚举不合法等问题。",
    `3.1 ${stageRepairGuidance(params.stage)}`,
    `4. 校验错误摘要：${params.validationError}`,
    `5. 上一次输出：${params.rawContent ?? "无"}`,
    ...(sceneDesignAddendum ? [sceneDesignAddendum] : []),
  ].join("\n");
}

function countSelfRepairs(repairHistory: NonNullable<DebugLogEntry["repairHistory"]>, repairLimit: number) {
  return Math.min(repairHistory.length, repairLimit);
}

function classifyStructuredError(error: Error) {
  const message = error.message.toLowerCase();
  if (message.includes("超时") || message.includes("timeout")) return "timeout";
  if (message.includes("json")) return "json_parse_error";
  if (message.includes("zod") || message.includes("invalid") || message.includes("too_small") || message.includes("too_big")) {
    return "schema_validation_error";
  }
  if (message.includes("missing model client")) return "missing_model_client";
  return "node_execution_error";
}

async function createCompletion(
  client: OpenAI,
  params: {
    model: string;
    messages: Array<{ role: ChatRole; content: string }>;
    mode: StructuredMode;
    schema: ZodType<unknown>;
    schemaName: string;
    extraBody?: Record<string, unknown>;
  },
): Promise<{
  choices: Array<{
    message?: {
      content?: unknown;
      tool_calls?: Array<{ function?: { arguments?: string } }>;
      reasoning_content?: unknown;
      reasoning?: unknown;
    };
  }>;
  usage?: Record<string, number>;
}> {
  if (params.mode === "function_call") {
    return (await client.chat.completions.create({
      model: params.model,
      messages: params.messages,
      tools: [
        {
          type: "function",
          function: {
            name: params.schemaName,
            description: `Return a structured object for ${params.schemaName}`,
            parameters: zodResponseFormat(params.schema, params.schemaName).json_schema.schema,
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: params.schemaName },
      },
      ...(params.extraBody ? { extra_body: params.extraBody } : {}),
    })) as {
      choices: Array<{
        message?: {
          content?: unknown;
          tool_calls?: Array<{ function?: { arguments?: string } }>;
          reasoning_content?: unknown;
          reasoning?: unknown;
        };
      }>;
      usage?: Record<string, number>;
    };
  }

  return (await client.chat.completions.create({
    model: params.model,
    messages: params.messages,
    response_format: {
      type: "json_object",
    },
    ...(params.extraBody ? { extra_body: params.extraBody } : {}),
  })) as {
    choices: Array<{
      message?: {
        content?: unknown;
        tool_calls?: Array<{ function?: { arguments?: string } }>;
        reasoning_content?: unknown;
        reasoning?: unknown;
      };
    }>;
    usage?: Record<string, number>;
  };
}

function extractPayloadFromCompletion(
  mode: StructuredMode,
  completion: {
    choices: Array<{
      message?: {
        content?: unknown;
        tool_calls?: Array<{ function?: { arguments?: string } }>;
        reasoning_content?: unknown;
        reasoning?: unknown;
      };
    }>;
    usage?: Record<string, number>;
  },
) {
  const message = completion.choices[0]?.message;

  if (mode === "function_call") {
    const toolCall = (message as { tool_calls?: Array<{ function?: { arguments?: string } }> } | undefined)?.tool_calls?.[0];
    const rawContent = toolCall?.function?.arguments ?? null;
    return { message, rawContent };
  }

  return { message, rawContent: extractRawContent(message) };
}

export async function runStructuredChat<T>(params: RunStructuredChatParams<T>): Promise<RunStructuredChatResult<T>> {
  const {
    client,
    model,
    baseURL,
    schema,
    schemaName,
    messages,
    extraBody,
    stage,
    requestPayload,
    debugMeta,
  } = params;

  const effectiveTimeoutMs =
    params.timeoutMs ??
    (stage === "proposal_tool"
      ? Number(process.env.PROPOSAL_TOOL_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS || "600000")
      : Number(process.env.LLM_TIMEOUT_MS || "600000"));

  const repairLimit = params.maxRepairAttempts ?? Number(process.env.MAX_NODE_REPAIR_ATTEMPTS || "2");
  const mode = params.mode ?? (FUNCTION_CALL_STAGES.has(stage) ? "function_call" : "json_object");

  let currentMessages: Array<{ role: ChatRole; content: string }> = [
    {
      role: "system",
      content:
        `You must return valid structured output only. 输出必须是合法的结构化结果，不要输出额外解释。Schema name: ${schemaName}.`,
    },
    ...messages,
  ];

  const logEntry = createDebugLog(stage, model, baseURL, requestPayload, debugMeta);
  const generation = createLangfuseGeneration(params);
  const repairHistory: NonNullable<DebugLogEntry["repairHistory"]> = [];

  try {
    for (let attempt = 0; attempt <= repairLimit; attempt += 1) {
      let completion: Awaited<ReturnType<typeof createCompletion>>;
      let rawContent: string | null = null;
      let normalizedJson: unknown = undefined;

      try {
        completion = await Promise.race([
          createCompletion(client, {
            model,
            messages: currentMessages,
            mode,
            schema: schema as ZodType<unknown>,
            schemaName,
            extraBody,
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("请求超时")), effectiveTimeoutMs)),
        ]);

        const extracted = extractPayloadFromCompletion(mode, completion);
        rawContent = extracted.rawContent;
        const rawJson = extractFirstJsonObject(rawContent);
        normalizedJson = cleanupStageSpecificData(stage, normalizeValueForSchema(schema as ZodType<unknown>, rawJson), requestPayload);
        validateStageSemanticReadiness(stage, normalizedJson, requestPayload);
        const parsed = schema.parse(normalizedJson);
        const messageRecord = extracted.message as unknown as Record<string, unknown> | undefined;

        finalizeDebugLog(logEntry, {
          rawResponse: completion,
          rawContent,
          providerReasoning: messageRecord?.reasoning_content ?? messageRecord?.reasoning ?? null,
          parsedResult: parsed,
          fallbackUsed: false,
          repairAttempts: countSelfRepairs(repairHistory, repairLimit),
          repairHistory,
        });

        generation?.updateOtelSpanAttributes({
          output: parsed,
          metadata: {
            durationMs: logEntry.durationMs,
            stage,
            repairAttempts: countSelfRepairs(repairHistory, repairLimit),
            mode,
          },
          usageDetails: (completion as { usage?: Record<string, number> }).usage,
        });
        generation?.end();

        return { parsed, logEntry };
      } catch (attemptError) {
        const wrappedError = attemptError instanceof Error ? attemptError : new Error("未知错误");
        repairHistory.push({
          attempt: attempt + 1,
          error: wrappedError.message,
          rawContent,
          normalizedResult: normalizedJson,
        });

        if (attempt >= repairLimit) {
          throw wrappedError;
        }

        currentMessages = [
          currentMessages[0],
          ...messages,
          {
            role: "assistant",
            content: rawContent || JSON.stringify(normalizedJson ?? {}, null, 2),
          },
            {
              role: "user",
              content: createRepairPrompt({
                stage,
                schemaName,
                validationError: wrappedError.message,
                rawContent,
              }),
            },
        ];
      }
    }

    throw new Error("未知结构化执行错误");
  } catch (error) {
    const wrappedError = error instanceof Error ? error : new Error("未知错误");
    finalizeDebugLog(logEntry, {
      error: `[${classifyStructuredError(wrappedError)}] ${wrappedError.message}`,
      fallbackUsed: false,
      repairAttempts: countSelfRepairs(repairHistory, repairLimit),
      repairHistory,
    });

    generation?.updateOtelSpanAttributes({
        output: { error: wrappedError.message, errorType: classifyStructuredError(wrappedError), repairHistory },
        level: "ERROR",
        statusMessage: wrappedError.message,
        metadata: {
          durationMs: logEntry.durationMs,
          stage,
          errorType: classifyStructuredError(wrappedError),
          repairAttempts: countSelfRepairs(repairHistory, repairLimit),
          mode,
        },
      });
    generation?.end();

    Object.assign(wrappedError, { logEntry });
    throw wrappedError;
  }
}
