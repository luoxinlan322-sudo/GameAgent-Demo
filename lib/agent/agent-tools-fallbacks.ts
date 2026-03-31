import type {
  PersonaInput,
  IntentAnalysis,
  AgentPlan,
  ToolSelection,
  ToolName,
  GameProposal,
  GameplayStructure,
  EconomyDesign,
  SystemDesign,
  SceneDesign,
  UIInformationArchitecture,
  StoryResult,
  CharacterCard,
  AssetManifest,
  CopywritingPack,
  ConsistencyEdgeId,
  Evaluation,
  VerificationResult,
} from "../schemas";
import type {
  RepairPlan,
  ConsistencyReport,
} from "../agent-consistency-schemas";

export function repairPlanSelectedTools(repairPlan?: RepairPlan | null): ToolName[] {
  return repairPlan?.selectedTargets.map((item) => item.toolName) ?? [];
}

export function repairPlanContextText(repairPlan?: RepairPlan | null) {
  if (!repairPlan) return "";
  return [
    repairPlan.rationale,
    ...repairPlan.selectedTargets.flatMap((item) => [item.whyThisTool, ...item.expectedImpact]),
    ...repairPlan.stopConditions,
  ]
    .filter(Boolean)
    .join(" ");
}

export function mockIntent(brief: PersonaInput): IntentAnalysis {
  return {
    taskDefinition: `围绕 ${brief.projectCode} 产出一套适合 ${brief.projectStage} 阶段、范围受控但内容完整的原型设计包。`,
    successSignals: [
      "玩法结构能被清晰讲述并映射到 HTML5 原型",
      "经济闭环与订单驱动成立",
      "系统、场景、UI、剧情角色、资产清单之间能对齐",
      "结果可以直接进入原型评审与测试准备",
    ],
    coreConstraints: [brief.targetGenre, brief.targetPlatform, brief.targetMarket, brief.monetizationModel, brief.productionConstraints],
    riskHypotheses: ["玩法结构和经济节奏可能脱节", "场景与 UI 可能没有形成对应关系", "剧情和角色可能只是装饰，没有服务玩法"],
    recommendedFlow: ["感知输入", "意图识别", "规划拆解", "工具选择", "并发执行工具", "一致性检查", "评估验证", "必要时返修"],
  };
}

export function mockPlan(intent: IntentAnalysis): AgentPlan {
  return {
    goalUnderstanding: intent.taskDefinition,
    successCriteria: intent.successSignals,
    keyRisks: intent.riskHypotheses,
    taskBreakdown: [
      { step: "玩法结构", purpose: "先定义主循环和测试焦点", output: "玩法结构", dependsOn: [] },
      { step: "数值经济", purpose: "建立订单、升级和装扮的闭环", output: "数值与经济", dependsOn: ["玩法结构"] },
      { step: "系统策划", purpose: "定义经营、扩建、任务和活动系统", output: "系统策划", dependsOn: ["玩法结构", "数值与经济"] },
      { step: "总体策划", purpose: "总结原型范围和验证指标", output: "总体策划", dependsOn: ["玩法结构", "数值与经济", "系统策划"] },
      { step: "场景与UI", purpose: "落地主场景和界面结构", output: "场景策划、UI架构", dependsOn: ["系统策划", "总体策划"] },
      { step: "剧情与角色", purpose: "提供轻叙事包装与角色互动支撑", output: "剧情方案、角色资料卡", dependsOn: ["总体策划", "系统策划"] },
      { step: "资产清单", purpose: "为图片生成和 HTML5 装配准备素材定义", output: "资产清单", dependsOn: ["场景策划", "UI架构", "剧情方案", "角色资料卡"] },
    ],
    parallelPlan: [
      { batchName: "批次1", tools: ["gameplay_tool"], reason: "先确定主循环与交互骨架" },
      { batchName: "批次2", tools: ["economy_tool", "system_design_tool"], reason: "玩法明确后，可并行推导经济和系统结构" },
      { batchName: "批次3", tools: ["proposal_tool", "scene_design_tool", "story_tool"], reason: "系统明确后，可同步总结总案、场景和剧情包装" },
      { batchName: "批次4", tools: ["ui_architecture_tool", "character_tool"], reason: "场景与剧情稳定后并行完成 UI 与角色卡" },
      { batchName: "批次5", tools: ["asset_manifest_tool"], reason: "最后汇总素材需求清单" },
    ],
    checklist: ["玩法与经济是否闭环", "系统是否覆盖测试重点", "场景与 UI 是否对齐", "剧情与角色是否服务玩法", "资产清单是否可执行"],
    nextDecision: "完成设计包后做一致性检查，再进入评估与返修。",
  };
}

export function inferRepairTools(repairPlan?: RepairPlan | null): ToolName[] {
  const text = repairPlanContextText(repairPlan);
  const selected = new Set<ToolName>(repairPlanSelectedTools(repairPlan));

  if (/(玩法|主循环|点击链路|反馈节奏)/.test(text)) selected.add("gameplay_tool");
  if (/(经济|货币|升级|订单|装扮解锁)/.test(text)) selected.add("economy_tool");
  if (/(系统|扩建|任务|活动|角色互动|装扮收集)/.test(text)) selected.add("system_design_tool");
  if (/(总览|原型范围|验证指标|总体策划)/.test(text)) selected.add("proposal_tool");
  if (/(场景|坑位|动线|建筑布局)/.test(text)) selected.add("scene_design_tool");
  if (/(UI|订单栏|任务栏|商店|活动入口|建造界面)/.test(text)) selected.add("ui_architecture_tool");
  if (/(剧情|锚点|活动包装|世界观)/.test(text)) selected.add("story_tool");
  if (/(角色|资料卡|互动职责|视觉关键词)/.test(text)) selected.add("character_tool");
  if (/(资产|素材|清单|命名|规格|背景要求)/.test(text)) selected.add("asset_manifest_tool");
  if (/(layout|布局|坐标|层级|热区绑定|交互绑定)/i.test(text)) selected.add("layout_tool");
  if (/(timeline|时间线|出场时机|显示时机|事件节奏)/i.test(text)) selected.add("timeline_tool");

  return selected.size > 0 ? [...selected] : ["gameplay_tool", "economy_tool", "system_design_tool", "proposal_tool"];
}

export function mockToolSelection(iteration: number, repairPlan?: RepairPlan | null): ToolSelection {
  const toolQueue: ToolName[] =
    iteration === 1
      ? [
          "gameplay_tool",
          "economy_tool",
          "system_design_tool",
          "proposal_tool",
          "scene_design_tool",
          "story_tool",
          "ui_architecture_tool",
          "character_tool",
          "asset_manifest_tool",
          "layout_tool",
          "timeline_tool",
        ]
      : inferRepairTools(repairPlan);

  const parallelBatches: ToolSelection["parallelBatches"] =
    iteration === 1
      ? [
          { batchName: "批次1", tools: ["gameplay_tool"], dependency: "起始节点" },
          { batchName: "批次2", tools: ["economy_tool", "system_design_tool"], dependency: "依赖 gameplay_tool" },
          { batchName: "批次3", tools: ["proposal_tool", "scene_design_tool", "story_tool"], dependency: "依赖系统骨架" },
          { batchName: "批次4", tools: ["ui_architecture_tool", "character_tool"], dependency: "依赖场景或剧情" },
          { batchName: "批次5", tools: ["asset_manifest_tool"], dependency: "依赖前序全部关键内容" },
          { batchName: "批次6", tools: ["layout_tool", "timeline_tool"], dependency: "依赖素材、文案与上游结构已收敛" },
        ]
      : [{ batchName: "定向返修", tools: toolQueue, dependency: "依赖上一轮已存在的相关上下文" }];

  return {
    roundGoal: iteration === 1 ? "先完成首轮完整设计包" : repairPlan?.rationale || "围绕返修理由做定向修复",
    toolQueue,
    callReasons:
      iteration === 1
        ? [
            "先搭玩法，再补经济和系统，然后收束为总案、场景、UI、剧情、角色与资产清单。",
            "每个工具只负责自己的一段专业输出，最终由主 Agent 汇总和检查。",
          ]
        : [`根据返修点仅重跑必要工具：${toolQueue.join(" -> ")}`],
    parallelBatches,
  };
}

export function mockProposal(brief: PersonaInput): GameProposal {
  return {
    solutionName: `${brief.projectCode} 原型设计总览`,
    projectPositioning: `面向${brief.targetMarket}市场的${brief.targetGenre}项目，服务${brief.audiencePositioning}`,
    designThesis: "以轻量经营循环驱动回访，通过扩建反馈、装扮收集、角色互动和活动包装形成中短期目标。",
    prototypeScope: "单主场景、可扩建区域、订单系统、角色互动、轻剧情事件、角色资料卡、可执行资产清单，以及面向 HTML5 运行时的布局与时间线配置。",
    keyValidationMetrics: ["首日经营循环完成率", "订单重复完成意愿", "扩建反馈满意度", "装扮收集点击率", "活动入口触达率"],
    majorRisks: ["经营循环可能缺少中期驱动力", "场景与 UI 的入口关系可能不够清晰", "剧情角色可能沦为装饰层"],
    roundFocus: brief.versionGoal,
  };
}

export function mockGameplay(): GameplayStructure {
  return {
    oneSentenceLoop: "Claim order -> run shop -> collect rewards -> expand or decorate -> unlock next order and event.",
    mainLoop: ["Review active orders", "Operate shop or facility", "Collect coins and materials", "Finish order settlement", "Spend rewards on expansion or decoration"],
    subLoops: ["Decoration collection loop", "Character interaction loop", "Event task loop"],
    clickPath: ["Open order board", "Tap shop interaction", "Collect reward bubble", "Enter build mode", "Trigger role interaction"],
    feedbackRhythm: ["Visible reward feedback within 3-10 seconds", "Expansion or decoration unlock every 2-3 orders", "Each revisit exposes a new clickable goal"],
    failRecover: ["Failed orders reduce payout instead of wiping progress", "Missing materials reroute player to substitute orders", "Short tasks help fill expansion gaps"],
    testFocus: ["Is the first management loop smooth", "Does the order board map naturally to scene clicks", "Do expansion and decoration create revisit motivation"],
    loopEntities: [
      {
        entityId: "core_order_board",
        entityName: "Order Board",
        entityType: "facility",
        functionalRole: "Refresh and claim orders",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["management_system", "mission_system"],
        relatedScenes: ["main_harbor_zone"],
      },
      {
        entityId: "core_main_shop",
        entityName: "Main Shop",
        entityType: "building",
        functionalRole: "Primary production and service delivery",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: false,
        relatedSystems: ["management_system", "upgrade_system"],
        relatedScenes: ["main_harbor_zone"],
      },
      {
        entityId: "core_expand_slot",
        entityName: "Expansion Plot",
        entityType: "building",
        functionalRole: "Unlock expansion, decoration, and new functions",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["expansion_system", "collection_system"],
        relatedScenes: ["left_food_street", "right_craft_lane"],
      },
      {
        entityId: "core_event_banner",
        entityName: "Event Banner",
        entityType: "activity_carrier",
        functionalRole: "Expose limited-time event entry and rewards",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["event_system"],
        relatedScenes: ["main_harbor_zone"],
      },
    ],
    loopActions: [
      { actionId: "claim_order", actorEntityId: "core_order_board", outcome: "Player claims the next available order" },
      { actionId: "run_shop", actorEntityId: "core_main_shop", targetEntityId: "core_order_board", outcome: "Shop fulfills the order and yields coins plus materials" },
      { actionId: "expand_zone", actorEntityId: "core_expand_slot", targetEntityId: "core_main_shop", outcome: "Expansion unlocks new slots, visuals, and order value" },
      { actionId: "enter_event", actorEntityId: "core_event_banner", targetEntityId: "core_expand_slot", outcome: "Event rewards feed back into expansion and decoration progress" },
    ],
  };
}

export function mockEconomy(): EconomyDesign {
  return {
    coreCurrencies: ["金币", "装扮券", "活动代币", "基础材料"],
    faucets: ["完成订单获得金币", "角色互动掉落装扮券", "活动任务给活动代币", "区域升级解锁基础材料奖励"],
    sinks: ["店铺升级消耗金币和材料", "区域扩建消耗金币", "装扮兑换消耗装扮券", "活动商店消耗活动代币"],
    orderCostLoop: "订单产出金币与材料，金币和材料推动店铺升级；升级后可接更高收益订单；订单完成还会反向解锁装扮与活动入口。",
    upgradeThresholds: ["首小时只开放轻量升级门槛", "第二层区域扩建要求完成前置订单组", "装扮解锁跟随订单星级而不是纯充值"],
    decorationUnlocks: ["完成区域焕新任务解锁装扮位", "达到经营等级后开放主题装扮", "活动代币可兑换限时装饰"],
    monetizationHooks: ["装扮礼包", "成长基金", "活动主题通行证"],
    pacingControls: ["用订单刷新控制节奏", "用区域扩建门槛控制中期推进", "用限时活动控制回访频次"],
  };
}

export function mockSystems(): SystemDesign {
  return {
    systemOverview: "Management handles the daily loop, expansion carries mid-term goals, mission and event systems drive return motivation, and role interaction plus decoration collection deliver emotional value.",
    managementSystem: "The core loop revolves around claiming orders, producing resources, collecting rewards, and operating the main shop.",
    expansionSystem: "Scene zones unlock in stages, and each expansion opens new slots, order variants, and decoration capacity.",
    missionSystem: "Main objectives, daily tasks, and staged renewal goals provide short- and mid-term direction.",
    eventSystem: "Theme events wrap the same management loop with temporary goals and reward exchanges.",
    roleInteractionSystem: "Roles appear in the scene, provide order hints, and reinforce decoration or event progress.",
    collectionSystem: "Decoration sets, event collectibles, and role-related unlocks form the collection layer.",
    socialLightSystem: "Keep only light showcase and snapshot sharing, without heavy multiplayer pressure.",
    systemEntities: [
      {
        entityId: "core_main_shop",
        entityName: "Main Shop",
        entityType: "building",
        functionalRole: "Core carrier of the management loop",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: false,
        relatedSystems: ["management_system", "upgrade_system"],
        relatedScenes: ["main_harbor_zone"],
      },
      {
        entityId: "core_expand_slot",
        entityName: "Expansion Plot",
        entityType: "building",
        functionalRole: "Carries unlocks, upgrades, and decoration placement",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["expansion_system", "collection_system"],
        relatedScenes: ["left_food_street", "right_craft_lane"],
      },
      {
        entityId: "core_event_banner",
        entityName: "Event Banner",
        entityType: "activity_carrier",
        functionalRole: "Carries event entry, rewards, and theme atmosphere",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["event_system"],
        relatedScenes: ["main_harbor_zone"],
      },
      {
        entityId: "core_role_stop",
        entityName: "Role Interaction Spot",
        entityType: "scene_hotspot",
        functionalRole: "Carries role interaction, hints, and stage feedback",
        isCore: true,
        requiresAsset: false,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["role_interaction_system"],
        relatedScenes: ["role_rest_zone"],
      },
    ],
    systemToEntityMap: [
      { systemName: "management_system", entityIds: ["core_main_shop", "core_order_board"], responsibility: "Claim orders, produce, and collect rewards" },
      { systemName: "expansion_system", entityIds: ["core_expand_slot"], responsibility: "Unlock plots, upgrade slots, and open new building use cases" },
      { systemName: "event_system", entityIds: ["core_event_banner"], responsibility: "Expose event entry, event tasks, and staged rewards" },
      { systemName: "role_interaction_system", entityIds: ["core_role_stop"], responsibility: "Expose role presence, hints, and interaction feedback" },
    ],
  };
}

export function mockScene(): SceneDesign {
  return {
    sceneConcept: "A compact harbor town scene expands from the central dock toward left and right feature districts.",
    sceneZones: ["main_harbor_zone", "left_food_street", "right_craft_lane", "backboard_walkway"],
    interactiveAreas: ["order_board_hotspot", "main_shop_counter", "build_expand_entry", "decoration_display_hotspot", "event_notice_hotspot", "role_stop_hotspot"],
    buildingSlots: ["main_shop_slot_a", "main_shop_slot_b", "food_street_slot_a", "craft_lane_slot_a"],
    navigationFlow: ["Open in the harbor hub", "Move from order board to main shop", "Branch into build mode and district upgrades", "Return to the center for role and event interactions"],
    stateTransitions: ["morning_opening", "active_management", "expansion_complete", "event_theme_active"],
    contentHotspots: ["order_board_spot", "main_shop_spot", "expand_glow_spot", "event_notice_spot"],
    sceneEntities: [
      {
        entityId: "core_order_board",
        entityName: "Order Board",
        entityType: "facility",
        functionalRole: "Order refresh and claim entry",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["management_system"],
        relatedScenes: ["main_harbor_zone"],
      },
      {
        entityId: "core_main_shop",
        entityName: "Main Shop",
        entityType: "building",
        functionalRole: "Primary management building",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: false,
        relatedSystems: ["management_system"],
        relatedScenes: ["main_harbor_zone"],
      },
      {
        entityId: "core_expand_slot",
        entityName: "Expansion Plot",
        entityType: "building",
        functionalRole: "Expansion and new building unlock carrier",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["expansion_system"],
        relatedScenes: ["left_food_street", "right_craft_lane"],
      },
      {
        entityId: "core_event_banner",
        entityName: "Event Banner",
        entityType: "activity_carrier",
        functionalRole: "Theme event entry and atmosphere carrier",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["event_system"],
        relatedScenes: ["main_harbor_zone"],
      },
    ],
    zoneEntityMap: [
      { zoneName: "main_harbor_zone", entityIds: ["core_order_board", "core_main_shop", "core_event_banner"] },
      { zoneName: "left_food_street", entityIds: ["core_expand_slot"] },
      { zoneName: "right_craft_lane", entityIds: ["core_expand_slot"] },
      { zoneName: "backboard_walkway", entityIds: ["core_event_banner"] },
    ],
    buildingDefinitions: [
      {
        buildingId: "building_main_shop",
        buildingName: "Main Shop",
        buildingType: "core_building",
        slotName: "main_shop_slot_a",
        gameplayPurpose: "Carries order fulfillment, reward payout, and upgrade progression",
        upgradeHook: "Raises order value and opens new decoration targets",
      },
      {
        buildingId: "building_food_street",
        buildingName: "Food Street Stall",
        buildingType: "expansion_building",
        slotName: "food_street_slot_a",
        gameplayPurpose: "Expands management capacity and supports district events",
        upgradeHook: "Unlocks higher-value orders and district visuals",
      },
      {
        buildingId: "building_craft_lane",
        buildingName: "Craft Lane Booth",
        buildingType: "expansion_building",
        slotName: "craft_lane_slot_a",
        gameplayPurpose: "Supports themed collection, event tasks, and role interactions",
        upgradeHook: "Unlocks themed rewards and collection milestones",
      },
    ],
  };
}

export function mockUi(): UIInformationArchitecture {
  return {
    topBar: ["金币/材料显示", "活动代币显示", "设置入口", "成长进度条"],
    orderPanel: ["当前订单列表", "可刷新订单入口", "订单完成状态", "高收益订单提示"],
    taskPanel: ["主目标追踪", "日常任务列表", "焕新阶段任务", "完成奖励预览"],
    shopEntry: ["常驻商店按钮", "装扮商店入口", "限时礼包入口"],
    eventEntry: ["活动入口按钮", "倒计时角标", "活动兑换商店", "活动任务面板"],
    buildModePanel: ["空地高亮", "可建造项列表", "升级所需资源提示", "确认/取消按钮"],
    feedbackLayer: ["收益飞字", "订单完成弹层", "扩建完成动画提示", "角色互动气泡"],
  };
}

export function mockStory(): StoryResult {
  return {
    storyPositioning: "港镇焕新主题活动包装",
    worldSummary: "玩家接手一座逐渐冷清的旧港小镇，通过经营店铺、修缮街区和吸引居民回流，让这里重新恢复烟火气与节庆氛围。",
    coreConflict: "小镇想恢复活力，但现有设施老旧、客流不足，玩家必须在有限资源下优先修缮关键区域并举办主题活动。",
    characterRoster: ["林汐", "周叔", "桃桃"],
    mainPlotBeats: ["林汐提出第一阶段焕新目标，引导玩家重启中央码头经营。", "周叔推动街区修缮与订单扩充，带出扩建系统。", "桃桃负责活动包装与装扮主题，推动活动入口和收集目标。"],
    chapterAnchors: ["中央码头开张", "餐饮街试营业", "港镇灯会活动", "手作摊主题周"],
    emotionalTone: "温暖、回流、逐步焕新",
  };
}

export function mockCharacters(): CharacterCard[] {
  return [
    {
      entityId: "char_linxi",
      name: "Lin Xi",
      characterCategory: "core",
      rolePositioning: "guide",
      personalityTags: ["warm", "reliable", "practical"],
      backgroundSummary: "Lin Xi introduces the harbor district and guides the player through the first management milestones.",
      interactionResponsibility: "Explains the opening loop, task progress, and early order completion.",
      collectionValue: "Unlocks additional dialogue, themed decorations, and progression milestones.",
      relatedSystems: ["management_system", "mission_system", "expansion_system"],
      storyAnchors: ["main_harbor_opening", "food_street_trial_run"],
      visualKeywords: ["short_hair", "harbor_uniform", "friendly_smile"],
      spawnContext: ["main_harbor_zone", "order_board_hotspot", "role_stop_hotspot"],
    },
    {
      entityId: "char_zhoubo",
      name: "Zhou Bo",
      characterCategory: "support",
      rolePositioning: "expansion_helper",
      personalityTags: ["steady", "skilled", "grounded"],
      backgroundSummary: "Zhou Bo understands the district infrastructure and helps pace expansion and upgrades.",
      interactionResponsibility: "Explains plot unlocks, materials, and higher-value order opportunities.",
      collectionValue: "Unlocks expansion visuals and alternate booth appearances.",
      relatedSystems: ["expansion_system", "management_system"],
      storyAnchors: ["food_street_trial_run", "craft_lane_theme_week"],
      visualKeywords: ["workwear", "tool_bag", "broad_shoulders"],
      spawnContext: ["left_food_street", "build_expand_entry"],
    },
    {
      entityId: "char_taozhi",
      name: "Tao Zhi",
      characterCategory: "core",
      rolePositioning: "event_and_collection_role",
      personalityTags: ["lively", "creative", "social"],
      backgroundSummary: "Tao Zhi drives event wrapping and decoration collection so the prototype feels festive and alive.",
      interactionResponsibility: "Explains event entries, themed rewards, and collection progress.",
      collectionValue: "Unlocks seasonal decoration sets and featured event illustrations.",
      relatedSystems: ["event_system", "collection_system", "role_interaction_system"],
      storyAnchors: ["harbor_lantern_event", "craft_lane_theme_week"],
      visualKeywords: ["pink_palette", "festival_accessories", "light_motion"],
      spawnContext: ["right_craft_lane", "event_notice_hotspot", "role_stop_hotspot"],
    },
  ];
}

export function mockAssets(): AssetManifest {
  return {
    visualStyle: "Clean 2D hand-painted simulation style with warm harbor tones and lightweight HTML5 readability.",
    exportRules: ["Use PNG for core characters and buildings", "Use magenta background #FF00FF for isolated cutout assets", "Keep UI icons and panels exportable as separate files", "Use stable asset naming for runtime mapping"],
    layeredRules: ["Split scene into back, mid, and front layers", "Export character art separately from scene carriers", "Separate building bodies from decoration props", "Group UI buttons and modal panels by usage"],
    assetGroups: [
      {
        assetName: "char_linxi_idle",
        assetType: "角色立绘",
        purpose: "Primary role art for in-scene presence and card view",
        spec: "1024x1024",
        ratio: "1:1",
        layer: "character-main",
        namingRule: "char_<name>_<state>",
        backgroundRequirement: "magenta #FF00FF",
        sourceDependencies: ["Lin Xi", "main_harbor_opening"],
        entityIds: ["char_linxi"],
        runtimeTargets: ["target_Lin_Xi"],
        deliveryScope: "character",
      },
      {
        assetName: "building_main_shop_lv1",
        assetType: "建筑单体",
        purpose: "Core shop building for the management loop",
        spec: "1536x1024",
        ratio: "3:2",
        layer: "building-main",
        namingRule: "building_<name>_<level>",
        backgroundRequirement: "magenta #FF00FF",
        sourceDependencies: ["main_harbor_zone", "management_system"],
        entityIds: ["core_main_shop"],
        runtimeTargets: ["target_main_harbor_zone", "target_main_shop_counter"],
        deliveryScope: "scene",
      },
      {
        assetName: "zone_harbor_scene_bg",
        assetType: "场景背景",
        purpose: "Main harbor scene full background",
        spec: "1920x1080",
        ratio: "16:9",
        layer: "scene-background",
        namingRule: "bg_<zone>_<variant>",
        backgroundRequirement: "opaque full-scene background",
        sourceDependencies: ["main_harbor_zone", "main_shop_spot"],
        entityIds: ["scene_main_harbor"],
        runtimeTargets: ["scene-root-canvas"],
        deliveryScope: "scene",
      },
      {
        assetName: "ui_order_board_icon",
        assetType: "UI图标",
        purpose: "Order board icon and task entry symbol",
        spec: "512x512",
        ratio: "1:1",
        layer: "ui-icon",
        namingRule: "ui_<name>_<variant>",
        backgroundRequirement: "magenta #FF00FF",
        sourceDependencies: ["order_board_hotspot", "management_system"],
        entityIds: ["core_order_board"],
        runtimeTargets: ["target_order_board_hotspot", "target_Open_order_board"],
        deliveryScope: "ui",
      },
      {
        assetName: "event_banner_entry",
        assetType: "活动插图",
        purpose: "Theme event entry carrier and banner art",
        spec: "1600x900",
        ratio: "16:9",
        layer: "event-main",
        namingRule: "event_<name>_<variant>",
        backgroundRequirement: "magenta #FF00FF",
        sourceDependencies: ["harbor_lantern_event", "event_system"],
        entityIds: ["core_event_banner"],
        runtimeTargets: ["target_event_notice_hotspot", "target_Event_entry_button"],
        deliveryScope: "event",
      },
    ],
    priorityOrder: ["building_main_shop_lv1", "ui_order_board_icon", "char_linxi_idle", "event_banner_entry", "zone_harbor_scene_bg"],
    entityRegistry: [
      {
        entityId: "core_order_board",
        entityName: "Order Board",
        entityType: "facility",
        functionalRole: "Order system entry and refresh surface",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["management_system", "mission_system"],
        relatedScenes: ["main_harbor_zone"],
      },
      {
        entityId: "core_main_shop",
        entityName: "Main Shop",
        entityType: "building",
        functionalRole: "Primary management building and reward carrier",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: false,
        relatedSystems: ["management_system"],
        relatedScenes: ["main_harbor_zone"],
      },
      {
        entityId: "core_expand_slot",
        entityName: "Expansion Plot",
        entityType: "building",
        functionalRole: "Expansion and decoration slot carrier",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["expansion_system", "collection_system"],
        relatedScenes: ["left_food_street", "right_craft_lane"],
      },
      {
        entityId: "core_event_banner",
        entityName: "Event Banner",
        entityType: "activity_carrier",
        functionalRole: "Theme event and reward exchange carrier",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["event_system"],
        relatedScenes: ["main_harbor_zone"],
      },
      {
        entityId: "char_linxi",
        entityName: "Lin Xi",
        entityType: "character",
        functionalRole: "Guide role and onboarding voice",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["management_system", "mission_system"],
        relatedScenes: ["main_harbor_zone"],
      },
    ],
  };
}

export function buildDynamicCharacterFallback(story: StoryResult): CharacterCard[] {
  const roster = story.characterRoster.slice(0, 3);
  const anchors = [...story.chapterAnchors, ...story.mainPlotBeats].filter((item, index, list) => item && list.indexOf(item) === index);
  const roleTemplates = [
    {
      rolePositioning: "主引导角色",
      personalityTags: ["温和", "可靠", "执行力强"],
      backgroundSummary: "负责把玩家带入经营目标和空间焕新节奏。",
      interactionResponsibility: "承担新手引导、订单提示和阶段目标提醒。",
      collectionValue: "解锁更多互动台词与主题装饰。",
      relatedSystems: ["经营系统", "任务系统", "扩建系统"],
      visualKeywords: ["海风短发", "浅蓝围裙", "温暖笑容", "港镇工作服"],
    },
    {
      rolePositioning: "经营辅助角色",
      personalityTags: ["稳重", "熟练", "务实"],
      backgroundSummary: "负责支撑街区修缮、材料补给和扩建节奏。",
      interactionResponsibility: "承担扩建提示、材料补给和高收益订单提示。",
      collectionValue: "解锁扩建动画包装与街区主题装饰。",
      relatedSystems: ["扩建系统", "订单系统", "资源循环"],
      visualKeywords: ["深色工装", "工具腰包", "宽肩轮廓", "木质手推车"],
    },
    {
      rolePositioning: "活动与装扮角色",
      personalityTags: ["活泼", "有创意", "社交感强"],
      backgroundSummary: "负责活动包装、节庆氛围和装扮收集目标。",
      interactionResponsibility: "承担活动入口提示、兑换反馈和装扮奖励说明。",
      collectionValue: "解锁节日主题插图与装扮素材。",
      relatedSystems: ["活动系统", "装扮收集", "角色互动系统"],
      visualKeywords: ["粉橙配色", "灯串饰品", "轻快动作", "手账贴纸"],
    },
  ];

  return roster.map((name, index) => ({
    entityId: `char_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_") || `role_${index + 1}`}`,
    name,
    characterCategory: index === 0 ? "core" : index === 1 ? "support" : "visitor",
    ...roleTemplates[Math.min(index, roleTemplates.length - 1)],
    storyAnchors: [anchors[Math.min(index, anchors.length - 1)] || anchors[0] || "中央码头开张"],
    spawnContext: [index === 0 ? "main_harbor_zone" : index === 1 ? "expansion_prompt_zone" : "event_notice_hotspot"],
  }));
}

export function buildDynamicAssetFallback(
  scene: SceneDesign,
  ui: UIInformationArchitecture,
  story: StoryResult,
  characters: CharacterCard[],
): AssetManifest {
  const sceneZone = scene.sceneZones[0] || "中央码头经营区";
  const orderPanel = ui.orderPanel[0] || "订单栏";
  const eventEntry = ui.eventEntry[0] || "活动入口";
  const leadCharacter = characters[0]?.name || story.characterRoster[0] || "林汐";
  const eventCharacter = characters[Math.min(2, characters.length - 1)]?.name || story.characterRoster[Math.min(2, story.characterRoster.length - 1)] || "桃桃";
  const eventAnchor = story.chapterAnchors[Math.min(2, story.chapterAnchors.length - 1)] || story.chapterAnchors[0] || "港镇灯会活动";

  return {
    visualStyle: "温暖明亮的 2D 手绘模拟经营风格，适合 HTML5 轻量原型。",
    exportRules: ["角色与建筑单体统一纯品红背景 #FF00FF", "UI 图标单独导出", "每类素材按功能命名分组", "优先导出 PNG"],
    layeredRules: ["角色立绘分主体与前景装饰层", "主场景按背景/中景/前景分层", "建筑单体与装饰物分层导出", "UI 按栏位和弹窗分组"],
    assetGroups: [
      {
        assetName: `char_${leadCharacter}_idle`,
        assetType: "角色立绘",
        purpose: "首页主场景互动角色",
        spec: "1024x1024",
        ratio: "1:1",
        layer: "角色层",
        namingRule: "char_<name>_<state>",
        backgroundRequirement: "纯品红背景 #FF00FF",
        sourceDependencies: [leadCharacter, story.chapterAnchors[0] || eventAnchor],
        entityIds: [characters[0]?.entityId || "char_lead_role"],
        runtimeTargets: ["target_main_character", `target_${leadCharacter}`],
        deliveryScope: "character",
      },
      {
        assetName: "building_main_shop_lv1",
        assetType: "建筑单体",
        purpose: "主店铺初始形态",
        spec: "1536x1024",
        ratio: "3:2",
        layer: "建筑层",
        namingRule: "building_<name>_<level>",
        backgroundRequirement: "纯品红背景 #FF00FF",
        sourceDependencies: [sceneZone, "经营系统"],
        entityIds: ["core_main_shop"],
        runtimeTargets: ["target_main_harbor_zone", "target_main_shop_counter"],
        deliveryScope: "scene",
      },
      {
        assetName: "zone_main_bg",
        assetType: "场景背景",
        purpose: "主场景全景背景底图",
        spec: "1920x1080",
        ratio: "16:9",
        layer: "scene-background",
        namingRule: "bg_<zone>_<variant>",
        backgroundRequirement: "完整场景底图，无需透明通道",
        sourceDependencies: [sceneZone, "场景策划"],
        entityIds: [`scene_${sceneZone.replace(/\s/g, '_')}`],
        runtimeTargets: ["scene-root-canvas"],
        deliveryScope: "scene",
      },
      {
        assetName: "ui_order_panel",
        assetType: "UI面板",
        purpose: "订单栏",
        spec: "1280x360",
        ratio: "16:4.5",
        layer: "UI层",
        namingRule: "ui_<module>_<type>",
        backgroundRequirement: "纯品红背景 #FF00FF",
        sourceDependencies: [orderPanel, "UI架构"],
        entityIds: ["core_order_board"],
        runtimeTargets: ["target_order_board_hotspot", "target_Open_order_board"],
        deliveryScope: "ui",
      },
      {
        assetName: "ui_event_entry_icon",
        assetType: "UI图标",
        purpose: "活动入口图标",
        spec: "256x256",
        ratio: "1:1",
        layer: "UI层",
        namingRule: "icon_<module>_<state>",
        backgroundRequirement: "纯品红背景 #FF00FF",
        sourceDependencies: [eventEntry, eventAnchor],
        entityIds: ["core_event_banner"],
        runtimeTargets: ["target_event_notice_hotspot", "target_Event_entry_button"],
        deliveryScope: "ui",
      },
      {
        assetName: "event_story_kv",
        assetType: "活动插图",
        purpose: "活动主视觉",
        spec: "1536x1024",
        ratio: "3:2",
        layer: "活动层",
        namingRule: "event_<theme>_<type>",
        backgroundRequirement: "纯品红背景 #FF00FF",
        sourceDependencies: [eventAnchor, eventCharacter],
        entityIds: [characters[Math.min(2, characters.length - 1)]?.entityId || "char_event_role", "core_event_banner"],
        runtimeTargets: ["target_event_notice_hotspot", "target_event_banner"],
        deliveryScope: "event",
      },
      {
        assetName: "decor_theme_set",
        assetType: "装扮素材",
        purpose: "节庆装扮收集物",
        spec: "1024x1024",
        ratio: "1:1",
        layer: "装饰层",
        namingRule: "decor_<theme>_<name>",
        backgroundRequirement: "纯品红背景 #FF00FF",
        sourceDependencies: ["装扮收集", eventAnchor],
        entityIds: ["decor_theme_collection"],
        runtimeTargets: ["target_theme_decor_display"],
        deliveryScope: "scene",
      },
    ],
    priorityOrder: ["主场景背景", "主店铺建筑", "订单栏UI", "角色立绘", "活动主视觉", "装扮素材"],
    entityRegistry: [
      {
        entityId: characters[0]?.entityId || "char_lead_role",
        entityName: leadCharacter,
        entityType: "character",
        functionalRole: "Primary visible role in scene and card view",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: characters[0]?.relatedSystems ?? ["经营系统", "任务系统"],
        relatedScenes: [sceneZone],
      },
      {
        entityId: "core_main_shop",
        entityName: "主店铺",
        entityType: "building",
        functionalRole: "Main business carrier",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: false,
        relatedSystems: ["经营系统", "扩建系统"],
        relatedScenes: [sceneZone],
      },
      {
        entityId: "core_event_banner",
        entityName: eventEntry,
        entityType: "activity_carrier",
        functionalRole: "Event entry carrier",
        isCore: true,
        requiresAsset: true,
        requiresLayout: true,
        requiresCopy: true,
        relatedSystems: ["活动系统"],
        relatedScenes: [sceneZone],
      },
    ],
  };
}

export function buildDynamicCopywritingFallback(
  story: StoryResult,
  characters: CharacterCard[],
  assetManifest: AssetManifest,
): CopywritingPack {
  const leadCharacter = characters[0]?.name || story.characterRoster[0] || "店长";
  const firstAnchor = story.chapterAnchors[0] || story.mainPlotBeats[0] || "海风灯会";
  const firstAsset = assetManifest.assetGroups[0]?.assetName || "订单按钮图标";

  return {
    pageTitles: [
      { id: "page_home_title", surface: "页面标题", target: "主页面", text: "海风小镇", usage: "首页标题", tone: "温暖", relatedEntity: "主页面" },
      { id: "page_event_title", surface: "页面标题", target: "活动页", text: "本周活动", usage: "活动页标题", tone: "活泼", relatedEntity: firstAnchor },
    ],
    panelTitles: [
      { id: "panel_order_title", surface: "面板标题", target: "订单面板", text: "今日订单", usage: "订单面板标题", tone: "清晰", relatedEntity: "订单面板" },
      { id: "panel_task_title", surface: "面板标题", target: "任务面板", text: "阶段任务", usage: "任务面板标题", tone: "清晰", relatedEntity: "任务面板" },
      { id: "panel_build_title", surface: "面板标题", target: "建造面板", text: "建造与扩建", usage: "建造面板标题", tone: "明确", relatedEntity: "建造面板" },
    ],
    buttonLabels: [
      { id: "btn_order_open", surface: "按钮文案", target: "订单入口", text: "查看订单", usage: "订单按钮", tone: "直接", relatedEntity: "订单面板" },
      { id: "btn_build_confirm", surface: "按钮文案", target: "建造确认", text: "确认扩建", usage: "建造确认按钮", tone: "直接", relatedEntity: "扩建系统" },
      { id: "btn_event_open", surface: "按钮文案", target: "活动入口", text: "进入活动", usage: "活动入口按钮", tone: "活泼", relatedEntity: firstAnchor },
      { id: "btn_shop_open", surface: "按钮文案", target: "商店入口", text: "前往商店", usage: "商店入口按钮", tone: "直接", relatedEntity: "商店入口" },
    ],
    taskAndOrderCopy: [
      { id: "task_stage_1", surface: "任务订单", target: "阶段任务", text: "完成 3 笔订单并解锁第一块空地", usage: "阶段任务描述", tone: "激励", relatedEntity: "阶段任务" },
      { id: "order_hint_1", surface: "任务订单", target: "订单提示", text: "先处理高收益订单，再安排扩建资源。", usage: "订单提示文案", tone: "指导", relatedEntity: "订单面板" },
      { id: "order_done_1", surface: "任务订单", target: "订单完成", text: "订单完成，海风值提升。", usage: "订单完成提示", tone: "奖励", relatedEntity: "订单系统" },
    ],
    eventEntryCopy: [
      { id: "event_entry_1", surface: "活动入口", target: "活动入口卡片", text: "海风灯会开启", usage: "活动入口标题", tone: "节庆", relatedEntity: firstAnchor },
      { id: "event_entry_2", surface: "活动入口", target: "活动入口副文案", text: `和${leadCharacter}一起准备本周限定布置。`, usage: "活动入口副标题", tone: "陪伴", relatedEntity: leadCharacter },
    ],
    sceneHints: [
      { id: "scene_hint_1", surface: "场景提示", target: "中央摊位", text: "点击摊位处理当前订单。", usage: "场景热区提示", tone: "指导", relatedEntity: "中央摊位" },
      { id: "scene_hint_2", surface: "场景提示", target: "空地区域", text: "这里可以扩建新的经营空间。", usage: "扩建热区提示", tone: "指导", relatedEntity: "扩建系统" },
      { id: "scene_hint_3", surface: "场景提示", target: "活动海报", text: "本周活动限时开放，记得参与。", usage: "活动热区提示", tone: "提醒", relatedEntity: firstAnchor },
    ],
    characterLines: [
      { id: "char_line_1", surface: "角色台词", target: leadCharacter, text: "今天也要把小镇经营得更热闹。", usage: "主页面气泡台词", tone: "温暖", relatedEntity: leadCharacter },
      { id: "char_line_2", surface: "角色台词", target: leadCharacter, text: "订单准备好了，我们开工吧。", usage: "订单入口气泡台词", tone: "鼓励", relatedEntity: "订单系统" },
      { id: "char_line_3", surface: "角色台词", target: leadCharacter, text: "新装饰摆上去之后，街区气氛更好了。", usage: "装扮解锁气泡台词", tone: "喜悦", relatedEntity: "装扮素材" },
    ],
    characterCardCopy: [
      { id: "char_card_title_1", surface: "角色卡文案", target: leadCharacter, text: leadCharacter, usage: "角色卡标题", tone: "明确", relatedEntity: leadCharacter },
      { id: "char_card_sub_1", surface: "角色卡文案", target: leadCharacter, text: "主页面经营搭档", usage: "角色卡副标题", tone: "温暖", relatedEntity: leadCharacter },
      { id: "char_card_tag_1", surface: "角色卡文案", target: leadCharacter, text: "订单与活动引导者", usage: "角色卡补充说明", tone: "说明", relatedEntity: "订单系统" },
    ],
    assetLabels: [
      { id: "asset_label_1", surface: "资产标签", target: firstAsset, text: "订单入口图标", usage: "资产展示名称", tone: "明确", relatedEntity: firstAsset },
      { id: "asset_label_2", surface: "资产标签", target: "扩建券", text: "扩建券", usage: "经济挂点名称", tone: "直接", relatedEntity: "扩建券" },
      { id: "asset_label_3", surface: "资产标签", target: "限定装饰", text: "限定装饰", usage: "装扮资源名称", tone: "节庆", relatedEntity: "限定装饰" },
    ],
  };
}

export function buildDynamicRepairFallback(verification: VerificationResult, report?: ConsistencyReport | null): RepairPlan {
  const repairTools =
    report?.repairTasks
      .flatMap((item) => item.candidateTools)
      .filter((tool, index, list) => list.indexOf(tool) === index)
      .slice(0, 3) ??
    ["gameplay_tool", "economy_tool", "system_design_tool"];
  const recheckEdges: ConsistencyEdgeId[] =
    report
      ? [...report.hardFailures, ...report.softWarnings]
          .filter((edge) => edge.involvedTools.some((tool) => repairTools.includes(tool)))
          .slice(0, 6)
          .map((edge) => edge.edgeId as ConsistencyEdgeId)
      : ["gameplay_economy", "gameplay_system", "system_scene"];

  return {
    rationale: verification.repairFocus[0] || "收敛当前设计包中的主要一致性问题",
    selectedTargets: repairTools.map((tool) => ({
      toolName: tool,
      whyThisTool: `当前返修优先修复 ${tool} 相关的阻塞边。`,
      whyNotOtherTargets: "这是开发态 fallback 返修计划，优先覆盖当前报告中出现频次最高的工具。",
      costReasoning: "先修与失败边关联度最高的工具，降低一次返修的范围和回归风险。",
      expectedImpact:
        report?.repairTasks
          .filter((item) => item.candidateTools.includes(tool))
          .flatMap((item) => item.successConditions)
          .slice(0, 4) ?? ["减少阻塞项", "提升设计一致性"],
      relatedTaskEdges:
        report?.repairTasks.filter((item) => item.candidateTools.includes(tool)).map((item) => item.edgeId).slice(0, 6) ??
        recheckEdges,
    })),
    stopConditions: ["所有硬一致性边通过", "主要返修理由不再出现", "可以进入最终评估"],
    repairGoal: verification.repairFocus[0] || "收敛当前设计包中的主要一致性问题",
    repairInstructions: "围绕阻塞边做局部返修，优先修复影响范围最大的上游工具，不要全量重跑。",
    repairTools,
    recheckEdges,
    expectedImprovements: report?.repairTasks.flatMap((item) => item.successConditions).slice(0, 6) ?? ["减少阻塞项", "提升设计一致性"],
    failedEdgeDetails: [],
  };
}

export function mockVerification(evaluation: Evaluation): VerificationResult {
  const needsRepair = evaluation.decision === "修改后复评" || evaluation.blockedBy.length > 0;
  return {
    approved: !needsRepair,
    needsRepair,
    summary: needsRepair ? "当前设计包仍有结构性问题，需要定向返修。" : "当前设计包已可进入最终输出。",
    repairFocus: needsRepair ? evaluation.risks.slice(0, 3) : [],
    recommendedNextStep: needsRepair ? "进入返修轮并仅重跑必要工具。" : "结束并进入后续实现讨论。",
  };
}

export function mockRepairPlan(verification: VerificationResult): RepairPlan {
  return {
    rationale: verification.repairFocus[0] || "收敛设计包中的主要问题",
    selectedTargets: [
      {
        toolName: "gameplay_tool",
        whyThisTool: "玩法结构是后续数值、系统和场景对齐的上游。",
        whyNotOtherTargets: "先修玩法结构能减少后续数值与系统返工。",
        costReasoning: "玩法结构变更影响范围最广，但在 mock 计划里优先级最高且最值得先修。",
        expectedImpact: ["清晰化主循环", "为下游工具提供稳定依据"],
        relatedTaskEdges: ["gameplay_economy", "gameplay_system"],
      },
      {
        toolName: "economy_tool",
        whyThisTool: "经济闭环是当前原型可落地性的关键阻塞点。",
        whyNotOtherTargets: "相比直接改场景或文案，先修经济更能解除上游闭环问题。",
        costReasoning: "经济层是最小必要修复点，能直接改善多条承接边。",
        expectedImpact: ["补足订单收益与扩建关系", "提升资产与文案可承接性"],
        relatedTaskEdges: ["gameplay_economy"],
      },
    ],
    stopConditions: ["游戏主循环与经济闭环对齐", "可以进入下一轮全局一致性复检"],
    repairGoal: verification.repairFocus[0] || "收敛设计包中的主要问题",
    repairInstructions: "围绕当前阻塞点做局部返修，优先修补影响最广的上游工具输出。",
    repairTools: ["gameplay_tool", "economy_tool", "system_design_tool", "proposal_tool"],
    recheckEdges: ["gameplay_economy", "gameplay_system", "system_scene", "proposal_asset"],
    expectedImprovements: ["减少阻塞项", "提升设计一致性", "让设计包更适合原型评审与运行时装配"],
    failedEdgeDetails: [],
  };
}
