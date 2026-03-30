import { z } from "zod";
import type { CreativePack, GameProposal, PersonaInput } from "./schemas";

export const PhaserRendererTypeSchema = z.enum(["WEBGL"]);
export const PhaserScaleModeSchema = z.enum(["FIT", "RESIZE", "ENVELOP"]);
export const PhaserAutoCenterSchema = z.enum(["CENTER_BOTH", "CENTER_HORIZONTALLY", "CENTER_VERTICALLY"]);
export const SceneRoleSchema = z.enum(["boot", "main", "overlay", "modal", "result"]);
export const AssetResourceTypeSchema = z.enum(["image", "atlas", "spritesheet", "audio", "json"]);
export const LayoutAnchorSchema = z.enum(["center", "bottom-center", "top-left", "top-center"]);
export const LayoutGroupSchema = z.enum(["scene", "ui", "character", "effect"]);
export const CopySurfaceUsageSchema = z.enum([
  "pageTitle",
  "panelTitle",
  "buttonLabel",
  "taskText",
  "eventEntry",
  "sceneHint",
  "characterBubble",
  "characterCard",
  "assetLabel",
]);
export const InteractionTriggerSchema = z.enum(["pointerdown", "pointerup", "pointerover", "drag", "sceneEnter"]);
export const InteractionEffectTypeSchema = z.enum(["openPanel", "emitEvent", "toggleState", "startTimeline"]);
export const TimelineActionSchema = z.enum(["show", "hide", "highlight", "playAnimation", "showCopy", "emit"]);
export const PostEffectSchema = z.enum(["bloom", "colorShift", "vignette"]);

export const GameConfigInputSchema = z.object({
  type: PhaserRendererTypeSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  parent: z.string().min(2).max(60),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sceneOrder: z.array(z.string().min(2).max(60)).min(1).max(12),
  scale: z
    .object({
      mode: PhaserScaleModeSchema,
      autoCenter: PhaserAutoCenterSchema,
    })
    .optional(),
  input: z
    .object({
      mouse: z.boolean(),
      touch: z.boolean(),
    })
    .optional(),
  physics: z
    .object({
      system: z.enum(["arcade", "matter", "none"]),
    })
    .optional(),
});

export const SceneDefinitionSchema = z.object({
  sceneId: z.string().min(2).max(60),
  role: SceneRoleSchema,
  preloadAssets: z.array(z.string().min(2).max(80)).min(1).max(60),
  entryState: z.record(z.string(), z.unknown()).optional(),
  createTargets: z.array(z.string().min(2).max(80)).min(1).max(80),
  updatePolicy: z.object({
    hasPerFrameUpdate: z.boolean(),
    needsTimers: z.boolean(),
    needsAnimations: z.boolean(),
  }),
});

export const AssetResourceSchema = z.object({
  assetId: z.string().min(2).max(80),
  assetType: AssetResourceTypeSchema,
  url: z.string().min(4).max(240),
  sceneScope: z.array(z.string().min(2).max(60)).min(1).max(12),
  phaserKey: z.string().min(2).max(80),
  logicalType: z.string().min(2).max(40),
  framePrefix: z.string().min(1).max(40).optional(),
  meta: z
    .object({
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      backgroundRequirement: z.string().min(2).max(80).optional(),
      sourceDependencies: z.array(z.string().min(2).max(80)).max(8).optional(),
    })
    .optional(),
});

export const AssetManifestInputSchema = z.object({
  visualStyle: z.string().min(6).max(240),
  exportRules: z.array(z.string().min(4).max(160)).min(1).max(12),
  assets: z.array(AssetResourceSchema).min(1).max(60),
  priorityOrder: z.array(z.string().min(2).max(80)).min(1).max(20),
});

export const LayoutElementSchema = z.object({
  targetId: z.string().min(2).max(80),
  assetId: z.string().min(2).max(80),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  depth: z.number().int().nonnegative(),
  anchor: LayoutAnchorSchema,
  scale: z.number().positive().max(4).optional(),
  visible: z.boolean().optional(),
  interactive: z.boolean().optional(),
  group: LayoutGroupSchema,
});

export const LayoutSceneSchema = z.object({
  sceneId: z.string().min(2).max(60),
  elements: z.array(LayoutElementSchema).min(1).max(160),
});

export const LayoutConfigInputSchema = z.object({
  scenes: z.array(LayoutSceneSchema).min(1).max(12),
});

export const CopywritingItemSchema = z.object({
  copyId: z.string().min(2).max(80),
  targetId: z.string().min(2).max(80),
  sceneId: z.string().min(2).max(60),
  usage: CopySurfaceUsageSchema,
  text: z.string().min(1).max(120),
  speakerId: z.string().min(2).max(40).optional(),
  styleToken: z.string().min(2).max(40).optional(),
  relatedEntity: z.string().min(2).max(80).optional(),
});

export const CopywritingConfigInputSchema = z.object({
  items: z.array(CopywritingItemSchema).min(1).max(160),
});

export const TimelineActionItemSchema = z.object({
  targetId: z.string().min(2).max(80),
  action: TimelineActionSchema,
  atMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const TimelineEventSchema = z.object({
  eventId: z.string().min(2).max(80),
  sceneId: z.string().min(2).max(60),
  actions: z.array(TimelineActionItemSchema).min(1).max(24),
});

export const TimelineConfigInputSchema = z.object({
  timelines: z.array(TimelineEventSchema).min(1).max(24),
});

export const InteractionBindingSchema = z.object({
  targetId: z.string().min(2).max(80),
  sceneId: z.string().min(2).max(60),
  trigger: InteractionTriggerSchema,
  effect: z.object({
    type: InteractionEffectTypeSchema,
    value: z.string().min(2).max(80),
  }),
});

export const InteractionConfigInputSchema = z.object({
  bindings: z.array(InteractionBindingSchema).min(1).max(80),
});

export const LightConfigSchema = z.object({
  lightId: z.string().min(2).max(60),
  sceneId: z.string().min(2).max(60),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  radius: z.number().int().positive(),
  intensity: z.number().positive().max(4),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const PostEffectConfigSchema = z.object({
  sceneId: z.string().min(2).max(60),
  effect: PostEffectSchema,
  strength: z.number().positive().max(4),
});

export const PipelineBindingSchema = z.object({
  sceneId: z.string().min(2).max(60),
  pipelineKey: z.string().min(2).max(60),
  targets: z.array(z.string().min(2).max(80)).min(1).max(20),
});

export const LightingRenderConfigInputSchema = z.object({
  lights: z.array(LightConfigSchema).max(16).optional(),
  postFx: z.array(PostEffectConfigSchema).max(16).optional(),
  pipelines: z.array(PipelineBindingSchema).max(16).optional(),
});

export const Html5PreparationPackageSchema = z.object({
  gameConfig: GameConfigInputSchema,
  sceneDefinitions: z.array(SceneDefinitionSchema).min(1).max(12),
  assetManifest: AssetManifestInputSchema,
  copywritingConfig: CopywritingConfigInputSchema,
  interactionConfig: InteractionConfigInputSchema,
  layoutConfig: LayoutConfigInputSchema.optional(),
  timelineConfig: TimelineConfigInputSchema.optional(),
  lightingRenderConfig: LightingRenderConfigInputSchema.optional(),
});

export type GameConfigInput = z.infer<typeof GameConfigInputSchema>;
export type SceneDefinition = z.infer<typeof SceneDefinitionSchema>;
export type AssetManifestInput = z.infer<typeof AssetManifestInputSchema>;
export type LayoutConfigInput = z.infer<typeof LayoutConfigInputSchema>;
export type CopywritingConfigInput = z.infer<typeof CopywritingConfigInputSchema>;
export type TimelineConfigInput = z.infer<typeof TimelineConfigInputSchema>;
export type InteractionConfigInput = z.infer<typeof InteractionConfigInputSchema>;
export type LightingRenderConfigInput = z.infer<typeof LightingRenderConfigInputSchema>;
export type Html5PreparationPackage = z.infer<typeof Html5PreparationPackageSchema>;

const PAGE_SCENE_ID = "main_market_scene";
const HUD_SCENE_ID = "hud_overlay";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function makeId(prefix: string, value: string) {
  return `${prefix}_${slugify(value) || "item"}`;
}

function makeTargetId(value: string) {
  return makeId("target", value);
}

function normalizeLookup(value: string) {
  return slugify(value);
}

type CanonicalTargetEntry = {
  raw: string;
  targetId: string;
  aliases: string[];
};

function buildTargetAliases(raw: string) {
  const aliases = new Set<string>();
  const normalized = normalizeLookup(raw);
  if (normalized) aliases.add(normalized);

  if (raw.includes("确认") && (raw.includes("建造") || raw.includes("扩建"))) {
    aliases.add("build_confirm_button");
    aliases.add("confirm_build_button");
    aliases.add("build_mode_confirm_button");
    aliases.add("expansion_confirm_button");
  }

  if (raw.includes("建造")) {
    aliases.add("build_button");
    aliases.add("build_mode_button");
    aliases.add("build_entry");
  }

  if (raw.includes("扩建")) {
    aliases.add("expansion_button");
    aliases.add("expand_button");
    aliases.add("expansion_entry");
  }

  if (raw.includes("订单")) {
    aliases.add("order_board");
    aliases.add("order_board_panel");
    aliases.add("order_claim_button");
    aliases.add("order_entry_button");
  }

  if (raw.includes("任务")) {
    aliases.add("task_panel");
    aliases.add("new_player_task");
    aliases.add("task_entry");
  }

  if (raw.includes("活动")) {
    aliases.add("event_entry");
    aliases.add("event_card");
    aliases.add("festival_event_card");
    aliases.add("activity_entry");
  }

  if (raw.includes("商店")) {
    aliases.add("shop_entry");
    aliases.add("shop_button");
  }

  if (raw.includes("气泡")) {
    aliases.add(`${normalized.replace(/_+气泡$/u, "")}_bubble`);
  }

  if (raw.includes("角色卡")) {
    aliases.add(`${normalized.replace(/_+角色卡.*$/u, "")}_card`);
  }

  return [...aliases].map((item) => normalizeLookup(item)).filter(Boolean);
}

function collectCanonicalTargets(creativePack: CreativePack): CanonicalTargetEntry[] {
  const values = [
    ...creativePack.scene.sceneZones,
    ...creativePack.scene.interactiveAreas,
    ...creativePack.ui.topBar,
    ...creativePack.ui.orderPanel,
    ...creativePack.ui.taskPanel,
    ...creativePack.ui.shopEntry,
    ...creativePack.ui.eventEntry,
    ...creativePack.ui.buildModePanel,
    ...creativePack.characters.map((item) => item.name),
    ...((creativePack.copywriting?.characterLines ?? []).map((item) => item.target).filter((item) => item.includes("气泡"))),
    ...((creativePack.copywriting?.characterCardCopy ?? []).map((item) => item.target).filter((item) => item.includes("角色卡"))),
  ].filter(Boolean);

  const entries = new Map<string, CanonicalTargetEntry>();
  for (const raw of values) {
    const targetId = makeTargetId(raw);
    if (entries.has(targetId)) continue;
    entries.set(targetId, {
      raw,
      targetId,
      aliases: buildTargetAliases(raw),
    });
  }
  return [...entries.values()];
}

function resolveCanonicalTargetId(
  value: string,
  creativePack: CreativePack,
  validTargetIds?: Set<string>,
) {
  const defaultTargetId = makeTargetId(value);
  const normalized = normalizeLookup(value);
  const canonicalTargets = collectCanonicalTargets(creativePack).filter((entry) => !validTargetIds || validTargetIds.has(entry.targetId));

  const exact = canonicalTargets.find(
    (entry) => entry.targetId === defaultTargetId || entry.aliases.includes(normalized),
  );
  if (exact) return exact.targetId;

  const fuzzy = canonicalTargets.find(
    (entry) =>
      entry.aliases.some((alias) => alias.includes(normalized) || normalized.includes(alias)) ||
      normalizeLookup(entry.raw).includes(normalized) ||
      normalized.includes(normalizeLookup(entry.raw)),
  );
  if (fuzzy) return fuzzy.targetId;

  if (!validTargetIds || validTargetIds.has(defaultTargetId)) return defaultTargetId;

  return defaultTargetId;
}

function collectLayoutTargetIds(layoutConfig?: LayoutConfigInput) {
  return new Set(layoutConfig?.scenes.flatMap((scene) => scene.elements.map((element) => element.targetId)) ?? []);
}

function collectInteractionTargetIds(interactionConfig?: InteractionConfigInput) {
  return new Set(interactionConfig?.bindings.map((binding) => binding.targetId) ?? []);
}

function ensureTimelineTargetId(
  targetId: string,
  creativePack: CreativePack,
  validTargetIds: Set<string>,
  fallbackRaw?: string,
) {
  if (validTargetIds.has(targetId)) return targetId;

  const preferredRaw = targetId.replace(/^target_/u, "").replace(/_/g, " ");
  const resolvedPreferred = resolveCanonicalTargetId(preferredRaw, creativePack, validTargetIds);
  if (validTargetIds.has(resolvedPreferred)) return resolvedPreferred;

  if (fallbackRaw) {
    const fallbackTargetId = resolveCanonicalTargetId(fallbackRaw, creativePack, validTargetIds);
    if (validTargetIds.has(fallbackTargetId)) return fallbackTargetId;
  }

  return validTargetIds.values().next().value ?? targetId;
}

function inferAssetResourceType(assetType: string): z.infer<typeof AssetResourceTypeSchema> {
  if (assetType.includes("图集")) return "atlas";
  if (assetType.includes("音频")) return "audio";
  if (assetType.includes("精灵表")) return "spritesheet";
  if (assetType.includes("JSON")) return "json";
  return "image";
}

function inferLogicalType(assetType: string) {
  if (assetType.includes("角色")) return "character";
  if (assetType.includes("建筑")) return "building";
  if (assetType.includes("场景")) return "scene-object";
  if (assetType.includes("图标")) return "ui-icon";
  if (assetType.includes("面板")) return "ui-panel";
  if (assetType.includes("活动")) return "event-art";
  return "decoration";
}

function makePlaceholderAssetUrl(assetId: string) {
  return `/generated-assets/${assetId}.png`;
}

function inferCreateTargets(creativePack: CreativePack) {
  return [
    ...creativePack.scene.sceneZones.map((item) => makeTargetId(item)),
    ...creativePack.scene.interactiveAreas.map((item) => makeTargetId(item)),
    ...creativePack.ui.orderPanel.map((item) => makeTargetId(item)),
    ...creativePack.ui.eventEntry.map((item) => makeTargetId(item)),
    ...creativePack.characters.map((item) => makeTargetId(item.name)),
  ].slice(0, 60);
}

function mapCopyUsage(surface: string): z.infer<typeof CopySurfaceUsageSchema> {
  switch (surface) {
    case "页面标题":
      return "pageTitle";
    case "面板标题":
      return "panelTitle";
    case "按钮文案":
      return "buttonLabel";
    case "任务订单":
      return "taskText";
    case "活动入口":
      return "eventEntry";
    case "场景提示":
      return "sceneHint";
    case "角色台词":
      return "characterBubble";
    case "角色卡文案":
      return "characterCard";
    default:
      return "assetLabel";
  }
}

export function deriveGameConfigInput(brief: PersonaInput, proposal: GameProposal): GameConfigInput {
  return GameConfigInputSchema.parse({
    type: "WEBGL",
    width: brief.targetPlatform === "PC" ? 1600 : 1334,
    height: brief.targetPlatform === "PC" ? 900 : 750,
    parent: "game-root",
    backgroundColor: "#24303A",
    sceneOrder: ["boot_scene", PAGE_SCENE_ID, HUD_SCENE_ID],
    scale: { mode: "FIT", autoCenter: "CENTER_BOTH" },
    input: { mouse: true, touch: true },
    physics: { system: "none" },
  });
}

export function deriveAssetManifestInput(creativePack: CreativePack): AssetManifestInput {
  return AssetManifestInputSchema.parse({
    visualStyle: creativePack.assetManifest.visualStyle,
    exportRules: creativePack.assetManifest.exportRules,
    priorityOrder: creativePack.assetManifest.priorityOrder,
    assets: creativePack.assetManifest.assetGroups.map((item) => {
      const assetId = makeId("asset", item.assetName);
      return {
        assetId,
        assetType: inferAssetResourceType(item.assetType),
        url: makePlaceholderAssetUrl(assetId),
        sceneScope: [PAGE_SCENE_ID, HUD_SCENE_ID],
        phaserKey: assetId,
        logicalType: inferLogicalType(item.assetType),
        meta: {
          backgroundRequirement: item.backgroundRequirement,
          sourceDependencies: item.sourceDependencies,
        },
      };
    }),
  });
}

export function deriveSceneDefinitions(
  brief: PersonaInput,
  proposal: GameProposal,
  creativePack: CreativePack,
  assetManifest: AssetManifestInput,
): SceneDefinition[] {
  const mainPreloadAssets = creativePack.assetManifest.priorityOrder.slice(0, 12).map((item) => makeId("asset", item));
  const overlayPreloadAssets = assetManifest.assets
    .filter((item) => item.logicalType === "ui-panel" || item.logicalType === "ui-icon")
    .slice(0, 8)
    .map((item) => item.assetId);

  return z.array(SceneDefinitionSchema).parse([
    {
      sceneId: "boot_scene",
      role: "boot",
      preloadAssets: ["core_bootstrap"],
      createTargets: ["boot_loader"],
      updatePolicy: { hasPerFrameUpdate: false, needsTimers: false, needsAnimations: false },
    },
    {
      sceneId: PAGE_SCENE_ID,
      role: "main",
      preloadAssets: mainPreloadAssets.length > 0 ? mainPreloadAssets : [assetManifest.assets[0].assetId],
      entryState: {
        projectCode: brief.projectCode,
        prototypeScope: proposal.prototypeScope,
        roundFocus: proposal.roundFocus,
      },
      createTargets: inferCreateTargets(creativePack),
      updatePolicy: { hasPerFrameUpdate: true, needsTimers: true, needsAnimations: true },
    },
    {
      sceneId: HUD_SCENE_ID,
      role: "overlay",
      preloadAssets: overlayPreloadAssets.length > 0 ? overlayPreloadAssets : [assetManifest.assets[0].assetId],
      createTargets: [...creativePack.ui.topBar.map((item) => makeTargetId(item)), ...creativePack.ui.taskPanel.slice(0, 2).map((item) => makeTargetId(item))],
      updatePolicy: { hasPerFrameUpdate: false, needsTimers: true, needsAnimations: true },
    },
  ]);
}

export function deriveCopywritingConfig(creativePack: CreativePack): CopywritingConfigInput {
  return CopywritingConfigInputSchema.parse({
    items: [
      ...(creativePack.copywriting?.pageTitles ?? []),
      ...(creativePack.copywriting?.panelTitles ?? []),
      ...(creativePack.copywriting?.buttonLabels ?? []),
      ...(creativePack.copywriting?.taskAndOrderCopy ?? []),
      ...(creativePack.copywriting?.eventEntryCopy ?? []),
      ...(creativePack.copywriting?.sceneHints ?? []),
      ...(creativePack.copywriting?.characterLines ?? []),
      ...(creativePack.copywriting?.characterCardCopy ?? []),
      ...(creativePack.copywriting?.assetLabels ?? []),
    ].map((item) => ({
      copyId: item.id,
      targetId: resolveCanonicalTargetId(item.target, creativePack),
      sceneId: PAGE_SCENE_ID,
      usage: mapCopyUsage(item.surface),
      text: item.text,
      speakerId: item.surface === "角色台词" ? item.relatedEntity : undefined,
      styleToken: item.tone,
      relatedEntity: item.relatedEntity,
    })),
  });
}

export function deriveInteractionBindings(creativePack: CreativePack): InteractionConfigInput {
  const bindings = [
    ...creativePack.scene.interactiveAreas.map((item) => ({
      targetId: resolveCanonicalTargetId(item, creativePack),
      sceneId: PAGE_SCENE_ID,
      trigger: "pointerdown" as const,
      effect: {
        type: item.includes("活动") ? ("openPanel" as const) : item.includes("扩建") || item.includes("建造") ? ("toggleState" as const) : ("emitEvent" as const),
        value: item.includes("活动") ? "open_event_panel" : item.includes("扩建") || item.includes("建造") ? "enter_build_mode" : makeId("event", item),
      },
    })),
    ...creativePack.ui.eventEntry.map((item) => ({
      targetId: resolveCanonicalTargetId(item, creativePack),
      sceneId: HUD_SCENE_ID,
      trigger: "pointerdown" as const,
      effect: {
        type: "openPanel" as const,
        value: resolveCanonicalTargetId(item, creativePack),
      },
    })),
    ...creativePack.ui.orderPanel.slice(0, 2).map((item) => ({
      targetId: resolveCanonicalTargetId(item, creativePack),
      sceneId: HUD_SCENE_ID,
      trigger: "pointerdown" as const,
      effect: {
        type: "emitEvent" as const,
        value: "open_order_board",
      },
    })),
  ];

  return InteractionConfigInputSchema.parse({ bindings });
}

function findAssetByLogicalType(assetManifest: AssetManifestInput, logicalType: string) {
  return assetManifest.assets.find((item) => item.logicalType === logicalType)?.assetId ?? assetManifest.assets[0]?.assetId;
}

function findCharacterAssetId(characterName: string, assetManifest: AssetManifestInput) {
  const normalized = normalizeLookup(characterName);
  const exact = assetManifest.assets.find(
    (item) => item.logicalType === "character" && (item.meta?.sourceDependencies ?? []).some((dep) => normalizeLookup(dep).includes(normalized)),
  );
  return exact?.assetId ?? findAssetByLogicalType(assetManifest, "character");
}

export function deriveLayoutConfig(creativePack: CreativePack, assetManifest: AssetManifestInput): LayoutConfigInput {
  const sceneAsset = findAssetByLogicalType(assetManifest, "scene-object") ?? assetManifest.assets[0].assetId;
  const buildingAsset = findAssetByLogicalType(assetManifest, "building") ?? sceneAsset;
  const uiPanelAsset = findAssetByLogicalType(assetManifest, "ui-panel") ?? assetManifest.assets[0].assetId;
  const uiIconAsset = findAssetByLogicalType(assetManifest, "ui-icon") ?? uiPanelAsset;
    const copyTargets = Array.from(
      new Set(
        [
          ...(creativePack.copywriting?.buttonLabels ?? []).map((item) => item.target),
          ...(creativePack.copywriting?.taskAndOrderCopy ?? []).map((item) => item.target),
          ...(creativePack.copywriting?.eventEntryCopy ?? []).map((item) => item.target),
          ...(creativePack.copywriting?.sceneHints ?? []).map((item) => item.target),
          ...(creativePack.copywriting?.characterLines ?? []).map((item) => item.target),
          ...(creativePack.copywriting?.characterCardCopy ?? []).map((item) => item.target),
        ].filter(Boolean),
      ),
    );

  const sceneElements = [
    ...creativePack.scene.sceneZones.map((item, index) => ({
      targetId: resolveCanonicalTargetId(item, creativePack),
      assetId: sceneAsset,
      x: 180 + index * 220,
      y: 430 + (index % 2) * 36,
      depth: 10 + index,
      anchor: "bottom-center" as const,
      visible: true,
      interactive: false,
      group: "scene" as const,
    })),
    ...creativePack.scene.interactiveAreas.map((item, index) => ({
      targetId: resolveCanonicalTargetId(item, creativePack),
      assetId: item.includes("扩建") || item.includes("建造") ? buildingAsset : sceneAsset,
      x: 160 + (index % 4) * 180,
      y: 240 + Math.floor(index / 4) * 90,
      depth: 30 + index,
      anchor: "center" as const,
      visible: true,
      interactive: true,
      group: "scene" as const,
    })),
    ...creativePack.characters.map((card, index) => ({
      targetId: resolveCanonicalTargetId(card.name, creativePack),
      assetId: findCharacterAssetId(card.name, assetManifest) ?? assetManifest.assets[0].assetId,
      x: 760 + index * 120,
      y: 370 + (index % 2) * 28,
      depth: 70 + index,
      anchor: "bottom-center" as const,
      visible: true,
      interactive: true,
      group: "character" as const,
    })),
    ...copyTargets
      .filter((target) => target.includes("气泡"))
      .map((target, index) => ({
        targetId: resolveCanonicalTargetId(target, creativePack),
        assetId: uiPanelAsset ?? assetManifest.assets[0].assetId,
        x: 760 + (index % 3) * 120,
        y: 180 + Math.floor(index / 3) * 60,
        depth: 120 + index,
        anchor: "top-center" as const,
        visible: true,
        interactive: false,
        group: "effect" as const,
      })),
  ];

  const uiEntries = [
    ...creativePack.ui.topBar,
    ...creativePack.ui.orderPanel,
    ...creativePack.ui.taskPanel,
    ...creativePack.ui.shopEntry,
    ...creativePack.ui.eventEntry,
    ...creativePack.ui.buildModePanel,
  ];

  const hudElements = uiEntries.map((item, index) => ({
    targetId: resolveCanonicalTargetId(item, creativePack),
    assetId: item.includes("按钮") || item.includes("入口") ? uiIconAsset ?? assetManifest.assets[0].assetId : uiPanelAsset ?? assetManifest.assets[0].assetId,
    x: 80 + (index % 4) * 300,
    y: 64 + Math.floor(index / 4) * 84,
    depth: 100 + index,
    anchor: "top-left" as const,
    visible: true,
    interactive: true,
    group: "ui" as const,
  }));

  const supplementalHudTargets = copyTargets
    .filter(
      (target) =>
        !sceneElements.some((element) => element.targetId === resolveCanonicalTargetId(target, creativePack)) &&
        !hudElements.some((element) => element.targetId === resolveCanonicalTargetId(target, creativePack)),
    )
    .map((target, index) => ({
      targetId: resolveCanonicalTargetId(target, creativePack),
      assetId: uiPanelAsset ?? assetManifest.assets[0].assetId,
      x: 140 + (index % 4) * 280,
      y: 420 + Math.floor(index / 4) * 70,
      depth: 140 + index,
      anchor: "top-left" as const,
      visible: true,
      interactive: false,
      group: "ui" as const,
    }));

  return LayoutConfigInputSchema.parse({
    scenes: [
      { sceneId: PAGE_SCENE_ID, elements: sceneElements },
      { sceneId: HUD_SCENE_ID, elements: [...hudElements, ...supplementalHudTargets] },
    ],
  });
}

export function deriveTimelineConfig(
  creativePack: CreativePack,
  copywritingConfig: CopywritingConfigInput,
  interactionConfig: InteractionConfigInput,
  layoutConfig?: LayoutConfigInput,
): TimelineConfigInput {
  const validTargetIds = new Set([
    ...collectLayoutTargetIds(layoutConfig),
    ...collectInteractionTargetIds(interactionConfig),
  ]);
  const timelines: TimelineConfigInput["timelines"] = creativePack.story.chapterAnchors.slice(0, 4).map((anchor, index) => {
    const matchingCopy = copywritingConfig.items
      .filter((item) => item.relatedEntity === anchor || item.text.includes(anchor))
      .slice(0, 3);

    return {
      eventId: makeId("timeline", anchor),
      sceneId: PAGE_SCENE_ID,
      actions: [
        ...matchingCopy.map((item, copyIndex) => ({
          targetId: ensureTimelineTargetId(item.targetId, creativePack, validTargetIds, item.relatedEntity),
          action: "showCopy" as const,
          atMs: copyIndex * 800,
          durationMs: 2600,
          payload: { copyId: item.copyId, anchor },
        })),
        {
          targetId: ensureTimelineTargetId(
            interactionConfig.bindings[index % interactionConfig.bindings.length]?.targetId ?? makeTargetId(creativePack.scene.interactiveAreas[0] ?? "main"),
            creativePack,
            validTargetIds,
            creativePack.scene.interactiveAreas[0] ?? "main",
          ),
          action: "highlight" as const,
          atMs: 300,
          durationMs: 2200,
          payload: { relatedAnchor: anchor },
        },
      ],
    };
  });

  const coveredCopyIds = new Set(
    timelines.flatMap((timeline) =>
      timeline.actions.map((action) => String((action.payload as Record<string, unknown> | undefined)?.copyId ?? "")).filter(Boolean),
    ),
  );
  const supplementalCopies = [...copywritingConfig.items]
    .filter((item) => ["eventEntry", "characterBubble", "taskText", "sceneHint"].includes(item.usage))
    .filter((item) => !coveredCopyIds.has(item.copyId))
    .sort((a, b) => {
      const aPriority = a.usage === "characterBubble" || a.usage === "eventEntry" ? 0 : 1;
      const bPriority = b.usage === "characterBubble" || b.usage === "eventEntry" ? 0 : 1;
      return aPriority - bPriority;
    });

  if (supplementalCopies.length > 0) {
    for (let index = 0; index < supplementalCopies.length; index += 12) {
      const chunk = supplementalCopies.slice(index, index + 12);
      timelines.push({
        eventId: index === 0 ? "timeline_runtime_guidance" : `timeline_runtime_guidance_${index / 12 + 1}`,
        sceneId: PAGE_SCENE_ID,
        actions: chunk.map((item, chunkIndex) => ({
          targetId: ensureTimelineTargetId(item.targetId, creativePack, validTargetIds, item.relatedEntity),
          action: "showCopy" as const,
          atMs: chunkIndex * 700,
          durationMs: 2400,
          payload: {
            copyId: item.copyId,
            relatedEntity: item.relatedEntity,
          },
        })),
      });
    }
  }

  if (timelines.length === 0) {
    timelines.push({
      eventId: "timeline_bootstrap",
      sceneId: PAGE_SCENE_ID,
      actions: [
        {
          targetId: ensureTimelineTargetId(interactionConfig.bindings[0]?.targetId ?? "target_main_entry", creativePack, validTargetIds, creativePack.scene.interactiveAreas[0] ?? "main"),
          action: "show" as const,
          atMs: 0,
          durationMs: 1800,
          payload: { reason: "bootstrap" },
        },
      ],
    });
  }

  return TimelineConfigInputSchema.parse({ timelines });
}

export function deriveLightingRenderConfig(creativePack: CreativePack): LightingRenderConfigInput {
  const hasFestivalTone =
    creativePack.story.emotionalTone.includes("节") ||
    creativePack.story.chapterAnchors.some((item) => item.includes("灯会") || item.includes("庆典") || item.includes("节"));

  return LightingRenderConfigInputSchema.parse({
    lights: [
      {
        lightId: "main_focus",
        sceneId: PAGE_SCENE_ID,
        x: 760,
        y: 240,
        radius: hasFestivalTone ? 260 : 180,
        intensity: hasFestivalTone ? 1.1 : 0.8,
        color: hasFestivalTone ? "#FFD27A" : "#F6E8C3",
      },
    ],
    postFx: [
      {
        sceneId: PAGE_SCENE_ID,
        effect: hasFestivalTone ? "bloom" : "colorShift",
        strength: hasFestivalTone ? 1.2 : 0.6,
      },
    ],
  });
}

export function deriveHtml5RuntimeProjection(
  brief: PersonaInput,
  proposal: GameProposal,
  creativePack: CreativePack,
): Omit<Html5PreparationPackage, "gameConfig"> & { gameConfig: GameConfigInput } {
  const gameConfig = deriveGameConfigInput(brief, proposal);
  const assetManifest = deriveAssetManifestInput(creativePack);
  const sceneDefinitions = deriveSceneDefinitions(brief, proposal, creativePack, assetManifest);
  const copywritingConfig = deriveCopywritingConfig(creativePack);
  const interactionConfig = deriveInteractionBindings(creativePack);
  const layoutConfig = deriveLayoutConfig(creativePack, assetManifest);
  const timelineConfig = deriveTimelineConfig(creativePack, copywritingConfig, interactionConfig, layoutConfig);
  const lightingRenderConfig = deriveLightingRenderConfig(creativePack);

  return {
    gameConfig,
    sceneDefinitions,
    assetManifest,
    copywritingConfig,
    interactionConfig,
    layoutConfig,
    timelineConfig,
    lightingRenderConfig,
  };
}

export function buildHtml5PreparationPackage(
  brief: PersonaInput,
  proposal: GameProposal,
  creativePack: CreativePack,
): Html5PreparationPackage {
  return Html5PreparationPackageSchema.parse(deriveHtml5RuntimeProjection(brief, proposal, creativePack));
}
