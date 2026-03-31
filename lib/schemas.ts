import { z } from "zod";

// ─── Genre Feature Profile ────────────────────────────────────────────────
export type GenreFeatureProfile = {
  /** Buildings/facilities are a core scene mechanic */
  requireBuildings: boolean;
  /** Orders/recipes drive the economy loop */
  requireOrders: boolean;
  /** Decoration/customization is a core mechanic */
  requireDecoration: boolean;
  /** Expansion/building system is a core mechanic */
  requireExpansion: boolean;
  /** Management subsystems (management, collection, social) are core */
  requireManagement: boolean;
};

export function getGenreProfile(targetGenre: string): GenreFeatureProfile {
  switch (targetGenre) {
    case "模拟经营":
      return { requireBuildings: true, requireOrders: true, requireDecoration: true, requireExpansion: true, requireManagement: true };
    case "放置养成":
      return { requireBuildings: false, requireOrders: false, requireDecoration: true, requireExpansion: true, requireManagement: false };
    case "塔防":
      return { requireBuildings: true, requireOrders: false, requireDecoration: false, requireExpansion: true, requireManagement: false };
    case "SLG":
      return { requireBuildings: true, requireOrders: false, requireDecoration: false, requireExpansion: true, requireManagement: false };
    case "MMORPG":
      return { requireBuildings: false, requireOrders: false, requireDecoration: true, requireExpansion: false, requireManagement: false };
    default:
      // 卡牌RPG, 开放世界RPG, Roguelike, 三消休闲, 射击竞技
      return { requireBuildings: false, requireOrders: false, requireDecoration: false, requireExpansion: false, requireManagement: false };
  }
}

export const MANAGEMENT_SIM_PROFILE: GenreFeatureProfile = getGenreProfile("模拟经营");

// ─── Base constants ───────────────────────────────────────────────────────
export const targetGenres = [
  "SLG",
  "卡牌RPG",
  "开放世界RPG",
  "Roguelike",
  "塔防",
  "模拟经营",
  "放置养成",
  "三消休闲",
  "射击竞技",
  "MMORPG",
] as const;

export const targetPlatforms = ["iOS", "Android", "PC", "主机", "多端"] as const;
export const targetMarkets = ["中国大陆", "港澳台", "日韩", "欧美", "全球"] as const;
export const monetizationModels = ["内购", "广告", "混合变现", "买断制", "订阅制"] as const;
export const projectStages = ["概念验证", "原型设计", "立项评审", "小范围测试"] as const;

export const ProjectBriefSchema = z.object({
  projectCode: z.string().min(2).max(40),
  targetGenre: z.enum(targetGenres),
  targetPlatform: z.enum(targetPlatforms),
  targetMarket: z.enum(targetMarkets),
  audiencePositioning: z.string().min(6).max(160),
  coreFantasy: z.string().min(8).max(200),
  monetizationModel: z.enum(monetizationModels),
  benchmarkGames: z.string().min(4).max(240),
  requiredSystems: z.string().min(6).max(240),
  versionGoal: z.string().min(8).max(220),
  projectStage: z.enum(projectStages),
  productionConstraints: z.string().min(6).max(260),
});

export const IntentAnalysisSchema = z.object({
  taskDefinition: z.string().min(12).max(220),
  successSignals: z.array(z.string().min(4).max(120)).min(3).max(6),
  coreConstraints: z.array(z.string().min(4).max(120)).min(3).max(6),
  riskHypotheses: z.array(z.string().min(4).max(120)).min(2).max(5),
  recommendedFlow: z.array(z.string().min(2).max(60)).min(5).max(10),
});

export const PlanSchema = z.object({
  goalUnderstanding: z.string().min(20).max(260),
  successCriteria: z.array(z.string().min(4).max(120)).min(3).max(6),
  keyRisks: z.array(z.string().min(4).max(120)).min(2).max(6),
  taskBreakdown: z
    .array(
      z.object({
        step: z.string().min(2).max(40),
        purpose: z.string().min(4).max(140),
        output: z.string().min(4).max(140),
        dependsOn: z.array(z.string().min(2).max(40)).max(4).default([]),
      }),
    )
    .min(5)
    .max(12),
  parallelPlan: z
    .array(
      z.object({
        batchName: z.string().min(2).max(40),
        tools: z.array(z.string().min(2).max(40)).min(1).max(6),
        reason: z.string().min(6).max(140),
      }),
    )
    .min(2)
    .max(6),
  checklist: z.array(z.string().min(4).max(120)).min(4).max(8),
  nextDecision: z.string().min(10).max(180),
});

export const ToolNameSchema = z.enum([
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
]);

export const ConsistencyEdgeIdSchema = z.enum([
  "gameplay_economy",
  "gameplay_system",
  "system_scene",
  "scene_ui",
  "story_character",
  "proposal_asset",
  "scene_asset",
  "ui_asset",
  "story_asset",
  "character_asset",
  "proposal_story",
  "proposal_ui",
  "economy_asset",
  "story_copywriting",
  "character_copywriting",
  "scene_copywriting",
  "ui_copywriting",
  "asset_copywriting",
  "economy_copywriting",
  "proposal_copywriting",
  "gameplay_copywriting",
  "system_copywriting",
  "scene_layout",
  "ui_layout",
  "character_layout",
  "scene_interaction",
  "ui_interaction",
  "story_timeline",
  "copywriting_timeline",
  "layout_timeline",
  "layout_lighting",
]);

export const ToolSelectionSchema = z.object({
  roundGoal: z.string().min(8).max(180),
  toolQueue: z.array(ToolNameSchema).min(1).max(12),
  callReasons: z.array(z.string().min(4).max(160)).min(1).max(12),
  parallelBatches: z
    .array(
      z.object({
        batchName: z.string().min(2).max(40),
        tools: z.array(ToolNameSchema).min(1).max(6),
        dependency: z.string().min(4).max(120),
      }),
    )
    .min(1)
    .max(7),
});

export const ProposalSchema = z.object({
  solutionName: z.string().min(3).max(80),
  projectPositioning: z.string().min(20).max(260),
  designThesis: z.string().min(20).max(220),
  prototypeScope: z.string().min(12).max(220),
  keyValidationMetrics: z.array(z.string().min(4).max(120)).min(3).max(6),
  majorRisks: z.array(z.string().min(4).max(120)).min(2).max(6),
  roundFocus: z.string().min(10).max(180),
});

export const EntityTypeSchema = z.enum([
  "character",
  "visitor",
  "building",
  "facility",
  "scene_hotspot",
  "ui_entry",
  "activity_carrier",
  "resource_token",
]);

export const EntityRegistryItemSchema = z.object({
  entityId: z.string().min(2).max(40),
  entityName: z.string().min(2).max(60),
  entityType: EntityTypeSchema,
  functionalRole: z.string().min(4).max(140),
  isCore: z.boolean(),
  requiresAsset: z.boolean(),
  requiresLayout: z.boolean(),
  requiresCopy: z.boolean(),
  relatedSystems: z.array(z.string().min(2).max(40)).max(6).default([]),
  relatedScenes: z.array(z.string().min(2).max(60)).max(6).default([]),
});

export const GameplayStructureSchema = z.object({
  oneSentenceLoop: z.string().min(12).max(180),
  mainLoop: z.array(z.string().min(4).max(120)).min(4).max(7),
  subLoops: z.array(z.string().min(4).max(120)).min(2).max(6),
  clickPath: z.array(z.string().min(4).max(120)).min(3).max(8),
  feedbackRhythm: z.array(z.string().min(4).max(120)).min(3).max(6),
  failRecover: z.array(z.string().min(4).max(120)).min(2).max(5),
  testFocus: z.array(z.string().min(4).max(120)).min(3).max(6),
  loopEntities: z.array(EntityRegistryItemSchema).min(3).max(16),
  loopActions: z
    .array(
      z.object({
        actionId: z.string().min(2).max(40),
        actorEntityId: z.string().min(2).max(40),
        targetEntityId: z.string().min(2).max(40).optional(),
        outcome: z.string().min(4).max(120),
      }),
    )
    .min(3)
    .max(16),
});

export const EconomyDesignSchema = z.object({
  coreCurrencies: z.array(z.string().min(2).max(60)).min(2).max(6),
  faucets: z.array(z.string().min(4).max(200)).min(3).max(6),
  sinks: z.array(z.string().min(4).max(200)).min(3).max(6),
  orderCostLoop: z.string().min(12).max(500),
  upgradeThresholds: z.array(z.string().min(4).max(200)).min(3).max(6),
  decorationUnlocks: z.array(z.string().min(4).max(200)).min(2).max(5),
  monetizationHooks: z.array(z.string().min(4).max(200)).min(2).max(5),
  pacingControls: z.array(z.string().min(4).max(200)).min(2).max(5),
});

/** Genre-conditional economy schema factory. Management sim profile returns the original strict schema. */
export function createEconomyDesignSchema(profile: GenreFeatureProfile) {
  return z.object({
    coreCurrencies: z.array(z.string().min(2).max(60)).min(2).max(6),
    faucets: z.array(z.string().min(4).max(200)).min(3).max(6),
    sinks: z.array(z.string().min(4).max(200)).min(3).max(6),
    orderCostLoop: profile.requireOrders
      ? z.string().min(12).max(500)
      : z.string().max(500).default(""),
    upgradeThresholds: z.array(z.string().min(4).max(200)).min(3).max(6),
    decorationUnlocks: profile.requireDecoration
      ? z.array(z.string().min(4).max(200)).min(2).max(5)
      : z.array(z.string().min(4).max(200)).max(5).default([]),
    monetizationHooks: z.array(z.string().min(4).max(200)).min(2).max(5),
    pacingControls: z.array(z.string().min(4).max(200)).min(2).max(5),
  });
}

export const SystemDesignSchema = z.object({
  systemOverview: z.string().min(20).max(240),
  managementSystem: z.string().min(12).max(220),
  expansionSystem: z.string().min(12).max(220),
  missionSystem: z.string().min(12).max(220),
  eventSystem: z.string().min(12).max(220),
  roleInteractionSystem: z.string().min(12).max(220),
  collectionSystem: z.string().min(12).max(220),
  socialLightSystem: z.string().min(12).max(220),
  systemEntities: z.array(EntityRegistryItemSchema).min(4).max(20),
  systemToEntityMap: z
    .array(
      z.object({
        systemName: z.string().min(2).max(40),
        entityIds: z.array(z.string().min(2).max(40)).min(1).max(8),
        responsibility: z.string().min(4).max(120),
      }),
    )
    .min(3)
    .max(16),
});

/** Genre-conditional system design schema factory. */
export function createSystemDesignSchema(profile: GenreFeatureProfile) {
  return z.object({
    systemOverview: z.string().min(20).max(240),
    managementSystem: profile.requireManagement
      ? z.string().min(12).max(220)
      : z.string().max(220).default(""),
    expansionSystem: profile.requireExpansion
      ? z.string().min(12).max(220)
      : z.string().max(220).default(""),
    missionSystem: z.string().min(12).max(220),
    eventSystem: z.string().min(12).max(220),
    roleInteractionSystem: z.string().min(12).max(220),
    collectionSystem: z.string().min(12).max(220),
    socialLightSystem: z.string().min(12).max(220),
    systemEntities: z.array(EntityRegistryItemSchema).min(4).max(20),
    systemToEntityMap: z
      .array(
        z.object({
          systemName: z.string().min(2).max(40),
          entityIds: z.array(z.string().min(2).max(40)).min(1).max(8),
          responsibility: z.string().min(4).max(120),
        }),
      )
      .min(3)
      .max(16),
  });
}

export const SceneDesignSchema = z.object({
  sceneConcept: z.string().min(12).max(180),
  sceneZones: z.array(z.string().min(4).max(120)).min(3).max(7),
  interactiveAreas: z.array(z.string().min(4).max(120)).min(3).max(8),
  buildingSlots: z.array(z.string().min(4).max(120)).min(3).max(8),
  navigationFlow: z.array(z.string().min(4).max(120)).min(3).max(7),
  stateTransitions: z.array(z.string().min(4).max(120)).min(3).max(7),
  contentHotspots: z.array(z.string().min(4).max(120)).min(2).max(6),
  sceneEntities: z.array(EntityRegistryItemSchema).min(4).max(20),
  zoneEntityMap: z.array(
    z.object({
      zoneName: z.string().min(2).max(60),
      entityIds: z.array(z.string().min(2).max(40)).min(1).max(8),
    }),
  ).min(3).max(16),
  buildingDefinitions: z.array(
    z.object({
      buildingId: z.string().min(2).max(40),
      buildingName: z.string().min(2).max(40),
      buildingType: z.string().min(2).max(40),
      slotName: z.string().min(2).max(60),
      gameplayPurpose: z.string().min(4).max(120),
      upgradeHook: z.string().min(4).max(120),
    }),
  ).min(2).max(12),
});

/** Genre-conditional scene design schema factory. */
export function createSceneDesignSchema(profile: GenreFeatureProfile) {
  return z.object({
    sceneConcept: z.string().min(12).max(180),
    sceneZones: z.array(z.string().min(4).max(120)).min(3).max(7),
    interactiveAreas: z.array(z.string().min(4).max(120)).min(3).max(8),
    buildingSlots: profile.requireBuildings
      ? z.array(z.string().min(4).max(120)).min(3).max(8)
      : z.array(z.string().min(4).max(120)).max(8).default([]),
    navigationFlow: z.array(z.string().min(4).max(120)).min(3).max(7),
    stateTransitions: z.array(z.string().min(4).max(120)).min(3).max(7),
    contentHotspots: z.array(z.string().min(4).max(120)).min(2).max(6),
    sceneEntities: z.array(EntityRegistryItemSchema).min(4).max(20),
    zoneEntityMap: z.array(
      z.object({
        zoneName: z.string().min(2).max(60),
        entityIds: z.array(z.string().min(2).max(40)).min(1).max(8),
      }),
    ).min(3).max(16),
    buildingDefinitions: profile.requireBuildings
      ? z.array(BuildingDefinitionSchema).min(2).max(12)
      : z.array(BuildingDefinitionSchema).max(12).default([]),
  });
}

export const SceneZoneEntityMapItemSchema = z.object({
  zoneName: z.string().min(2).max(60),
  entityIds: z.array(z.string().min(2).max(40)).min(1).max(8),
});

export const BuildingDefinitionSchema = z.object({
  buildingId: z.string().min(2).max(40),
  buildingName: z.string().min(2).max(40),
  buildingType: z.string().min(2).max(40),
  slotName: z.string().min(2).max(60),
  gameplayPurpose: z.string().min(4).max(120),
  upgradeHook: z.string().min(4).max(120),
});

export const SceneRepairPatchSchema = z.object({
  preserveEntityIds: z.array(z.string().min(2).max(40)).max(24).default([]),
  appendSceneZones: z.array(z.string().min(4).max(120)).max(4).default([]),
  appendInteractiveAreas: z.array(z.string().min(4).max(120)).max(6).default([]),
  appendBuildingSlots: z.array(z.string().min(4).max(120)).max(6).default([]),
  appendContentHotspots: z.array(z.string().min(4).max(120)).max(6).default([]),
  appendSceneEntities: z.array(EntityRegistryItemSchema).max(8).default([]),
  appendZoneEntityMap: z.array(SceneZoneEntityMapItemSchema).max(8).default([]),
  appendBuildingDefinitions: z.array(BuildingDefinitionSchema).max(8).default([]),
});

export const UIInformationArchitectureSchema = z.object({
  topBar: z.array(z.string().min(4).max(120)).min(2).max(6),
  orderPanel: z.array(z.string().min(4).max(120)).min(2).max(6),
  taskPanel: z.array(z.string().min(4).max(120)).min(2).max(6),
  shopEntry: z.array(z.string().min(4).max(120)).min(2).max(5),
  eventEntry: z.array(z.string().min(4).max(120)).min(2).max(5),
  buildModePanel: z.array(z.string().min(4).max(120)).min(2).max(6),
  feedbackLayer: z.array(z.string().min(4).max(120)).min(2).max(6),
});

/** Genre-conditional UI information architecture schema factory. */
export function createUIInformationArchitectureSchema(profile: GenreFeatureProfile) {
  return z.object({
    topBar: z.array(z.string().min(4).max(120)).min(2).max(6),
    orderPanel: profile.requireOrders
      ? z.array(z.string().min(4).max(120)).min(2).max(6)
      : z.array(z.string().min(4).max(120)).max(6).default([]),
    taskPanel: z.array(z.string().min(4).max(120)).min(2).max(6),
    shopEntry: z.array(z.string().min(4).max(120)).min(2).max(5),
    eventEntry: z.array(z.string().min(4).max(120)).min(2).max(5),
    buildModePanel: profile.requireBuildings
      ? z.array(z.string().min(4).max(120)).min(2).max(6)
      : z.array(z.string().min(4).max(120)).max(6).default([]),
    feedbackLayer: z.array(z.string().min(4).max(120)).min(2).max(6),
  });
}

export const StorySchema = z.object({
  storyPositioning: z.string().min(8).max(120),
  worldSummary: z.string().min(20).max(260),
  coreConflict: z.string().min(12).max(180),
  characterRoster: z.array(z.string().min(2).max(24)).min(3).max(6),
  mainPlotBeats: z.array(z.string().min(8).max(180)).min(3).max(6),
  chapterAnchors: z.array(z.string().min(8).max(160)).min(3).max(6),
  emotionalTone: z.string().min(4).max(60),
});

export const CharacterCardSchema = z.object({
  entityId: z.string().min(2).max(40),
  name: z.string().min(2).max(24),
  characterCategory: z.enum(["core", "support", "visitor"]),
  rolePositioning: z.string().min(2).max(40),
  personalityTags: z.array(z.string().min(2).max(20)).min(2).max(5),
  backgroundSummary: z.string().min(12).max(180),
  interactionResponsibility: z.string().min(6).max(140),
  collectionValue: z.string().min(6).max(140),
  relatedSystems: z.array(z.string().min(2).max(40)).min(1).max(4),
  storyAnchors: z.array(z.string().min(4).max(80)).min(1).max(4),
  visualKeywords: z.array(z.string().min(2).max(24)).min(3).max(8),
  spawnContext: z.array(z.string().min(2).max(60)).min(1).max(6).optional(),
});

export const CharacterListSchema = z.object({
  cards: z.array(CharacterCardSchema).min(3).max(6),
  populationSummary: z.object({
    coreCharacterCount: z.number().int().min(1).max(12),
    supportCharacterCount: z.number().int().min(0).max(20),
    visitorArchetypeCount: z.number().int().min(0).max(20),
  }),
  entityRegistry: z.array(EntityRegistryItemSchema).min(3).max(24),
});

export const AssetTypeSchema = z.enum([
  "角色立绘",
  "场景背景",
  "场景物件",
  "建筑单体",
  "UI图标",
  "UI面板",
  "活动插图",
  "装扮素材",
]);

export const AssetItemSchema = z.object({
  assetName: z.string().min(2).max(60),
  assetType: AssetTypeSchema,
  purpose: z.string().min(6).max(120),
  spec: z.string().min(4).max(80),
  ratio: z.string().min(2).max(40),
  layer: z.string().min(2).max(40),
  namingRule: z.string().min(4).max(80),
  backgroundRequirement: z.string().min(4).max(80),
  sourceDependencies: z.array(z.string().min(2).max(60)).min(1).max(5),
  entityIds: z.array(z.string().min(2).max(40)).min(1).max(8),
  runtimeTargets: z.array(z.string().min(2).max(80)).min(1).max(8),
  deliveryScope: z.enum(["scene", "ui", "character", "event", "layout", "timeline"]),
});

export const AssetManifestSchema = z.object({
  visualStyle: z.string().min(12).max(200),
  exportRules: z.array(z.string().min(4).max(120)).min(3).max(6),
  layeredRules: z.array(z.string().min(4).max(120)).min(3).max(6),
  assetGroups: z.array(AssetItemSchema).min(5).max(20),
  priorityOrder: z.array(z.string().min(2).max(60)).min(3).max(8),
  entityRegistry: z.array(EntityRegistryItemSchema).min(4).max(24),
});

export const CopyLineSchema = z.object({
  id: z.string().min(3).max(80),
  surface: z.enum([
    "页面标题",
    "面板标题",
    "按钮文案",
    "任务订单",
    "活动入口",
    "场景提示",
    "角色台词",
    "角色卡文案",
    "资产标签",
  ]),
  target: z.string().min(2).max(60),
  text: z.string().min(2).max(80),
  usage: z.string().min(4).max(140),
  tone: z.string().min(2).max(40),
  relatedEntity: z.string().min(2).max(60),
});

export const CopywritingPackSchema = z.object({
  pageTitles: z.array(CopyLineSchema).min(1).max(8),
  panelTitles: z.array(CopyLineSchema).min(1).max(10),
  buttonLabels: z.array(CopyLineSchema).min(1).max(16),
  taskAndOrderCopy: z.array(CopyLineSchema).min(1).max(12),
  eventEntryCopy: z.array(CopyLineSchema).min(1).max(8),
  sceneHints: z.array(CopyLineSchema).min(1).max(12),
  characterLines: z.array(CopyLineSchema).min(1).max(16),
  characterCardCopy: z.array(CopyLineSchema).min(1).max(12),
  assetLabels: z.array(CopyLineSchema).min(1).max(16),
});

export const CreativePackSchema = z.object({
  gameplay: GameplayStructureSchema,
  economy: EconomyDesignSchema,
  systems: SystemDesignSchema,
  scene: SceneDesignSchema,
  ui: UIInformationArchitectureSchema,
  story: StorySchema,
  characters: z.array(CharacterCardSchema).min(3).max(6),
  assetManifest: AssetManifestSchema,
  copywriting: CopywritingPackSchema.optional(),
});

export const GenerationResultSchema = z.object({
  proposal: ProposalSchema,
  creativePack: CreativePackSchema,
});

export const ConsistencyCheckSchema = z.object({
  pass: z.boolean(),
  gameplayEconomyAligned: z.boolean(),
  systemsSceneAligned: z.boolean(),
  sceneUIAligned: z.boolean(),
  storyCharacterAligned: z.boolean(),
  assetManifestAligned: z.boolean(),
  issues: z.array(z.string().min(4).max(180)).max(12),
  repairSuggestions: z.array(z.string().min(4).max(180)).max(8),
});

export const EvaluationSchema = z.object({
  hardGates: z.object({
    loopsClear: z.boolean(),
    economyClosedLoop: z.boolean(),
    systemCoverage: z.boolean(),
    sceneUiReady: z.boolean(),
    storyCharacterAligned: z.boolean(),
    assetManifestExecutable: z.boolean(),
  }),
  blockedBy: z.array(z.string().min(3).max(180)).max(10),
  scores: z.object({
    gameplayStructure: z.number().int().min(0).max(20),
    economyBalance: z.number().int().min(0).max(15),
    systemCoverage: z.number().int().min(0).max(15),
    sceneUiReadiness: z.number().int().min(0).max(15),
    storyCharacterConsistency: z.number().int().min(0).max(10),
    assetManifestExecutability: z.number().int().min(0).max(15),
    smallScaleTestFit: z.number().int().min(0).max(20),
  }),
  totalScore: z.number().int().min(0).max(110),
  decision: z.enum([
    "拒绝进入测试",
    "修改后复评",
    "建议进入测试",
    "优先进入测试",
  ]),
  summary: z.string().min(20).max(260),
  risks: z.array(z.string().min(4).max(160)).min(2).max(6),
  recommendations: z.array(z.string().min(4).max(160)).min(2).max(6),
});

export const VerificationSchema = z.object({
  approved: z.boolean(),
  needsRepair: z.boolean(),
  summary: z.string().min(12).max(220),
  repairFocus: z.array(z.string().min(4).max(120)).max(6),
  recommendedNextStep: z.string().min(8).max(160),
});

export const RepairPlanSchema = z.object({
  repairGoal: z.string().min(8).max(160),
  repairInstructions: z.string().min(12).max(260),
  repairTools: z.array(ToolNameSchema).min(1).max(8),
  recheckEdges: z.array(ConsistencyEdgeIdSchema).min(1).max(16),
  expectedImprovements: z.array(z.string().min(4).max(180)).min(1).max(12),
});

export const ReviewHistoryItemSchema = z.object({
  round: z.number().int().min(1).max(3),
  returned: z.boolean(),
  decision: z.string().min(2).max(40),
  score: z.number().int().min(0).max(110),
  returnReasons: z.array(z.string().min(4).max(180)).max(12),
  repairDirections: z.array(z.string().min(4).max(180)).max(10),
  failedEdges: z.array(ConsistencyEdgeIdSchema).max(16).default([]),
  selectedRepairTools: z.array(ToolNameSchema).max(8).default([]),
  repairRationale: z.string().min(0).max(260).default(""),
});

export const ConsistencyEdgeResultSchema = z.object({
  edgeId: z.string().min(3).max(80),
  sourceTool: z.string().min(3).max(40),
  targetTool: z.string().min(3).max(40),
  level: z.enum(["hard", "soft"]),
  pass: z.boolean(),
  severity: z.enum(["low", "medium", "high"]),
  issues: z.array(z.string().min(4).max(220)).max(12),
  repairSuggestions: z.array(z.string().min(4).max(220)).max(8),
  involvedTools: z.array(ToolNameSchema).max(4),
  problemLocationHints: z
    .array(
      z.object({
        toolName: ToolNameSchema,
        confidence: z.enum(["low", "medium", "high"]),
        reason: z.string().min(8).max(220),
      }),
    )
    .max(6)
    .default([]),
});

export const ConsistencyReportSchema = z.object({
  hardFailures: z.array(ConsistencyEdgeResultSchema).max(24),
  softWarnings: z.array(ConsistencyEdgeResultSchema).max(24),
  passedEdges: z.array(ConsistencyEdgeResultSchema).max(32),
  affectedTools: z.array(ToolNameSchema).max(10),
  repairCandidates: z
    .array(
      z.object({
        toolName: ToolNameSchema,
        reasons: z.array(z.string().min(4).max(220)).min(1).max(12),
        priority: z.number().int().min(1).max(100),
      }),
    )
    .max(10),
  summary: z.string().min(8).max(260),
  globalPass: z.boolean(),
});

export const ConsistencySemanticReviewSchema = z.object({
  edges: z.array(ConsistencyEdgeResultSchema).max(24),
  summary: z.string().min(8).max(220),
});

export const PlanRequestSchema = z.object({
  persona: ProjectBriefSchema,
});

export const GenerateRequestSchema = z.object({
  persona: ProjectBriefSchema,
  plan: PlanSchema.optional(),
});

export const EvaluateRequestSchema = z.object({
  persona: ProjectBriefSchema,
  plan: PlanSchema.optional(),
  proposal: ProposalSchema,
  creativePack: CreativePackSchema.optional(),
});

export type ProjectBriefInput = z.infer<typeof ProjectBriefSchema>;
export type PersonaInput = ProjectBriefInput;
export type IntentAnalysis = z.infer<typeof IntentAnalysisSchema>;
export type AgentPlan = z.infer<typeof PlanSchema>;
export type ToolName = z.infer<typeof ToolNameSchema>;
export type ConsistencyEdgeId = z.infer<typeof ConsistencyEdgeIdSchema>;
export type ToolSelection = z.infer<typeof ToolSelectionSchema>;
export type GameProposal = z.infer<typeof ProposalSchema>;
export type EntityRegistryItem = z.infer<typeof EntityRegistryItemSchema>;
export type GameplayStructure = z.infer<typeof GameplayStructureSchema>;
export type EconomyDesign = z.infer<typeof EconomyDesignSchema>;
export type SystemDesign = z.infer<typeof SystemDesignSchema>;
export type SceneDesign = z.infer<typeof SceneDesignSchema>;
export type SceneRepairPatch = z.infer<typeof SceneRepairPatchSchema>;
export type UIInformationArchitecture = z.infer<typeof UIInformationArchitectureSchema>;
export type StoryResult = z.infer<typeof StorySchema>;
export type CharacterCard = z.infer<typeof CharacterCardSchema>;
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
export type CopyLine = z.infer<typeof CopyLineSchema>;
export type CopywritingPack = z.infer<typeof CopywritingPackSchema>;
export type CreativePack = z.infer<typeof CreativePackSchema>;
export type GenerationResult = z.infer<typeof GenerationResultSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
export type VerificationResult = z.infer<typeof VerificationSchema>;
export type RepairPlan = z.infer<typeof RepairPlanSchema>;
export type ConsistencyCheckResult = z.infer<typeof ConsistencyCheckSchema>;
export type ReviewHistoryItem = z.infer<typeof ReviewHistoryItemSchema>;
export type ConsistencyEdgeResult = z.infer<typeof ConsistencyEdgeResultSchema>;
export type ConsistencyReport = z.infer<typeof ConsistencyReportSchema>;
export type ConsistencySemanticReview = z.infer<typeof ConsistencySemanticReviewSchema>;
