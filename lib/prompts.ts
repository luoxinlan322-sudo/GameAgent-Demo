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
} from "./schemas";
import type { RepairPlan } from "./agent-consistency-schemas";

function genreOptionalFieldsBlock(profile?: GenreFeatureProfile | null): string {
  if (!profile) return "";
  const lines: string[] = [];
  if (!profile.requireOrders) {
    lines.push("- orderCostLoop is optional for this genre. Output an empty string if the game has no order loop.");
    lines.push("- orderPanel is optional for this genre. Output an empty array if not applicable.");
  }
  if (!profile.requireDecoration) {
    lines.push("- decorationUnlocks is optional for this genre. Output an empty array if the game has no decoration system.");
  }
  if (!profile.requireManagement) {
    lines.push("- managementSystem is optional for this genre. Output an empty string if not applicable.");
  }
  if (!profile.requireExpansion) {
    lines.push("- expansionSystem is optional for this genre. Output an empty string if not applicable.");
  }
  if (!profile.requireBuildings) {
    lines.push("- buildingSlots and buildingDefinitions are optional for this genre. Output empty arrays if buildings are not part of the core design.");
    lines.push("- buildModePanel is optional for this genre. Output an empty array if not applicable.");
  }
  if (lines.length === 0) return "";
  return "\nGenre-specific field guidance (these fields are optional for the current genre):\n" + lines.join("\n");
}

function jsonOnlyInstruction(keys: string[]) {
  return [
    "Output contract:",
    "1. Return exactly one valid JSON object.",
    "2. Do not output Markdown, code fences, explanations, notes, or prefixes.",
    `3. The top-level keys must be exactly: ${keys.join(", ")}.`,
    "4. Keep field names unchanged. Do not omit required fields or invent new top-level fields.",
    "5. Keep field types exact. Arrays must stay arrays. Booleans must be true/false.",
    "6. If a field expects an array, split ideas into short items instead of one long sentence.",
    "7. 所有面向玩家或策划的文本内容（描述、名称、解释、文案等）必须使用中文输出。JSON 字段名（key）保持英文不变。",
  ].join("\n");
}

function productionGradeInstruction(toolName: string, focus: string[]) {
  return [
    `${toolName} production requirements:`,
    "1. Output must be directly usable for HTML5 prototype assembly, engine handoff, asset production, or in-game copy.",
    "2. Every field should be actionable, decomposable, and reusable. Avoid vague high-level planning prose.",
    "3. Keep scope controlled, but do not under-specify. The result should be prototype-complete, not merely minimal.",
    `4. Priority for this tool in this round: ${focus.join("; ")}.`,
  ].join("\n");
}

function fewShotBlock(title: string, examples: Array<{ input: string; output: string }>) {
  return [
    `${title}:`,
    ...examples.flatMap((example, index) => [`Example ${index + 1} input: ${example.input}`, `Example ${index + 1} output: ${example.output}`]),
  ].join("\n");
}

function briefBlock(brief: PersonaInput) {
  return `项目简报:
- 项目代号: ${brief.projectCode}
- 品类: ${brief.targetGenre}
- 平台: ${brief.targetPlatform}
- 目标市场: ${brief.targetMarket}
- 受众定位: ${brief.audiencePositioning}
- 核心幻想: ${brief.coreFantasy}
- 变现模式: ${brief.monetizationModel}
- 竞品参考: ${brief.benchmarkGames}
- 必需系统: ${brief.requiredSystems}
- 当前版本目标: ${brief.versionGoal}
- 当前阶段: ${brief.projectStage}
- 生产约束: ${brief.productionConstraints}`;
}

function repairContextBlock(repairContext?: string) {
  return `Repair context:
${repairContext || "First round. No repair context yet."}`;
}

function jsonBlock(title: string, value: unknown) {
  return `${title}:
${JSON.stringify(value, null, 2)}`;
}

const UI_FEWSHOT = fewShotBlock("UI架构示例", [
  {
    input: "小范围模拟经营原型，含订单、扩建和活动入口。",
    output:
      '{"topBar":["金币与高级软货币","等级与进度","体力或行动点"],"orderPanel":["当前订单列表","订单倒计时"],"taskPanel":["阶段目标","新手引导"],"shopEntry":["商店按钮","首充礼包入口"],"eventEntry":["活动卡片入口","每日签到入口"],"buildModePanel":["空地高亮","可建造列表","花费预览","确认按钮"],"feedbackLayer":["获得飘字","升级弹窗","订单完成提示"]}',
  },
]);

const ECONOMY_FEWSHOT = fewShotBlock("经济系统示例", [
  {
    input: "含订单循环、扩建、主题装扮和礼包钩子的模拟经营原型。",
    output:
      '{"coreCurrencies":["金币","扩建券","主题装扮兑换券"],"faucets":["完成订单获得金币","活动签到获得扩建券","主题任务获得装扮兑换券"],"sinks":["用金币和扩建券扩建摊位","用兑换券兑换主题装扮","用付费货币购买便利礼包"],"orderCostLoop":"完成订单获得金币和少量扩建券，用金币和扩建券进行摊位扩建和升级，扩建后解锁更高价值订单，提升未来金币收益。","upgradeThresholds":["首批订单完成后解锁1级扩建","经营等级3级时解锁第二次摊位升级","收集3个主题装扮后解锁节日区域强化"],"decorationUnlocks":["节日摊位皮肤通过主题兑换券解锁","限定道具通过活动积分加扩建券兑换"],"monetizationHooks":["新手扩建礼包含扩建券和加速卡","限定装扮礼包含主题道具和活动徽章"],"pacingControls":["前期订单收益高于维护成本","扩建券随里程碑任务一起出现","装扮兑换券主要通过活动和收集目标获得"]}',
  },
]);

const SCENE_FEWSHOT = fewShotBlock("场景设计示例", [
  {
    input: "单场景港镇模拟经营，含扩建、活动热点和角色交互。",
    output:
      '{"sceneConcept":"紧凑的港口市集街道，在一次短时测试中支持订单、扩建和节日活动节拍。","sceneZones":["中央订单区","左侧扩建区","右侧活动装扮区","角色交互休憩区"],"interactiveAreas":["订单板热点","空地建造热点","节日海报热点","角色对话热点"],"buildingSlots":["主摊位坑位","左侧扩建坑位A","左侧扩建坑位B","右侧装扮坑位"],"navigationFlow":["进入场景首先看到订单区","完成订单后走向扩建区","节日内容解锁后前往活动热点","对话可用时返回角色区"],"stateTransitions":["订单刷新后显示扩建提示","扩建完成后解锁新订单阶段","活动开始后点亮节日热点","角色交互后触发小额奖励提示"],"contentHotspots":["节日海报墙","限定装扮展柜","角色休憩长椅"]}',
  },
]);

const SCENE_REPAIR_FEWSHOT = fewShotBlock("场景修补示例", [
  {
    input:
      '当前场景基线已包含 sceneEntities=["core_main_shop","event_summer_fair"]，zoneEntityMap=["main_harbor_zone=>core_main_shop|event_summer_fair"]，buildingDefinitions=["building_main_shop"]。修补焦点说缺少载体：resource_coin 和 order_seafood_rice。要求：保留已有有效条目，将缺失载体添加到 sceneEntities，映射到 zoneEntityMap，并补充缺失的 buildingDefinitions，而不是重写整个场景。',
    output:
      '{"sceneConcept":"保持紧凑的港口市集街道作为首日循环的可玩场景。","sceneZones":["main_harbor_zone","left_food_street","right_event_lane"],"interactiveAreas":["订单板热点","金币反馈热点","节日横幅热点"],"buildingSlots":["main_shop_slot_a","order_board_slot_a","reward_display_slot_a"],"navigationFlow":["从主港口区进入","在订单板领取海鲜饭订单","在奖励展示处收取金币反馈","返回活动区参加节日活动"],"stateTransitions":["领取海鲜饭订单后高亮订单板","结算后显示金币奖励载体","活动开启后保持节日横幅激活"],"contentHotspots":["节日海报墙","奖励展示架"],"sceneEntities":[{"entityId":"core_main_shop","entityName":"主摊位","entityType":"building","functionalRole":"核心生产和结算载体","isCore":true,"requiresAsset":true,"requiresLayout":true,"requiresCopy":false,"relatedSystems":["management_system"],"relatedScenes":["main_harbor_zone"]},{"entityId":"event_summer_fair","entityName":"夏日市集","entityType":"activity_carrier","functionalRole":"活动入口载体","isCore":true,"requiresAsset":true,"requiresLayout":true,"requiresCopy":true,"relatedSystems":["event_system"],"relatedScenes":["right_event_lane"]},{"entityId":"resource_coin","entityName":"金币奖励展示","entityType":"facility","functionalRole":"可见经济奖励载体","isCore":true,"requiresAsset":true,"requiresLayout":true,"requiresCopy":true,"relatedSystems":["economy_system"],"relatedScenes":["main_harbor_zone"]},{"entityId":"order_seafood_rice","entityName":"海鲜饭订单板","entityType":"facility","functionalRole":"海鲜饭循环订单领取载体","isCore":true,"requiresAsset":true,"requiresLayout":true,"requiresCopy":true,"relatedSystems":["management_system","mission_system"],"relatedScenes":["main_harbor_zone"]}],"zoneEntityMap":[{"zoneName":"main_harbor_zone","entityIds":["core_main_shop","resource_coin","order_seafood_rice"]},{"zoneName":"right_event_lane","entityIds":["event_summer_fair"]}],"buildingDefinitions":[{"buildingId":"building_main_shop","buildingName":"主摊位","buildingType":"core_building","slotName":"main_shop_slot_a","gameplayPurpose":"完成订单并结算奖励","upgradeHook":"升级柜台解锁更高价值菜品"},{"buildingId":"facility_coin_reward","buildingName":"金币奖励展示","buildingType":"reward_facility","slotName":"reward_display_slot_a","gameplayPurpose":"结算后展示可见金币发放","upgradeHook":"扩展奖励视觉和发放反馈"},{"buildingId":"facility_order_board_seafood_rice","buildingName":"海鲜饭订单板","buildingType":"order_facility","slotName":"order_board_slot_a","gameplayPurpose":"领取和追踪海鲜饭订单循环","upgradeHook":"解锁更多海鲜订单变体"},{"buildingId":"activity_summer_fair_banner","buildingName":"夏日市集横幅","buildingType":"event_facility","slotName":"right_event_lane","gameplayPurpose":"承载活动入口和季节活动奖励","upgradeHook":"解锁额外节日任务和主题装扮"}]}',
  },
]);

const STORY_FEWSHOT = fewShotBlock("剧情示例", [
  {
    input: "小范围模拟经营测试的轻量剧情包装，须直接对接角色卡和文案。",
    output:
      '{"storyPositioning":"轻量叙事包装，强化订单、扩建和活动动机。","worldSummary":"一座小港镇正在通过美食摊位和即将到来的灯笼节复兴老集市街。","coreConflict":"客流低迷且节日筹备时间紧迫，玩家必须在高利润订单和扩建工作之间权衡。","characterRoster":["林小渔","阿树","陈叔"],"mainPlotBeats":["林小渔引导首批试营业订单，讲解摊位核心目标。","阿树在新区开放后推动一个海洋风格装扮任务。","陈叔警告节日筹备进度落后，要求玩家优先完成高价值订单。"],"chapterAnchors":["中央摊位试营业","新区开放","灯笼节倒计时"],"emotionalTone":"温暖、明快、略带节日感"}',
  },
]);

const ASSET_FEWSHOT = fewShotBlock("资产清单示例", [
  {
    input: "港镇模拟经营原型，后续对接图片生成和HTML5运行时装配。",
    output:
      '{"visualStyle":"干净的2D手绘经营风格，角色剪影可读性强，紧凑的移动端构图","exportRules":["角色和建筑导出为PNG","需透明提取的资产使用品红背景 #FF00FF","UI素材使用固定尺寸和命名规则"],"layeredRules":["角色立绘单独导出","建筑和场景道具按图层分离","UI图标和UI面板分别导出"],"assetGroups":[{"assetName":"林小渔立绘","assetType":"角色立绘","purpose":"角色交互和角色卡展示","spec":"1536x1536 PNG","ratio":"1:1","layer":"character-main","namingRule":"char_lin_xiaoyu_v1","backgroundRequirement":"品红背景 #FF00FF","sourceDependencies":["角色卡: 林小渔","剧情锚点: 中央摊位试营业"]},{"assetName":"阿树立绘","assetType":"角色立绘","purpose":"角色交互和角色卡展示","spec":"1536x1536 PNG","ratio":"1:1","layer":"character-main","namingRule":"char_a_shu_v1","backgroundRequirement":"品红背景 #FF00FF","sourceDependencies":["角色卡: 阿树","剧情锚点: 新区开放"]},{"assetName":"陈叔立绘","assetType":"角色立绘","purpose":"角色交互和角色卡展示","spec":"1536x1536 PNG","ratio":"1:1","layer":"character-main","namingRule":"char_chen_shu_v1","backgroundRequirement":"品红背景 #FF00FF","sourceDependencies":["角色卡: 陈叔","剧情锚点: 灯笼节倒计时"]}],"priorityOrder":["林小渔立绘","阿树立绘","陈叔立绘","中央摊位建筑","订单按钮图标"]}',
  },
]);

const COPYWRITING_FEWSHOT = fewShotBlock("文案示例", [
  {
    input: "订单、扩建、活动入口和角色对话须对齐场景名、剧情锚点和资产标签。",
    output:
      '{"pageTitles":[{"id":"page_main_market","surface":"页面标题","target":"main_market_page","text":"港口集市街","usage":"左上角页面标题","tone":"经营温暖感","relatedEntity":"中央订单区"}],"panelTitles":[{"id":"panel_order_board","surface":"面板标题","target":"order_board_panel","text":"今日订单","usage":"订单面板标题","tone":"简洁直接","relatedEntity":"订单板热点"}],"buttonLabels":[{"id":"btn_order_claim","surface":"按钮文案","target":"order_claim_button","text":"领取今日订单","usage":"订单入口CTA","tone":"直接行动","relatedEntity":"订单板热点"},{"id":"btn_expand_ticket","surface":"按钮文案","target":"build_confirm_button","text":"使用扩建券","usage":"建造确认CTA","tone":"明确行动","relatedEntity":"扩建券"}],"taskAndOrderCopy":[{"id":"task_first_shift","surface":"任务订单","target":"new_player_task","text":"完成3笔试营业订单","usage":"阶段目标文案","tone":"引导","relatedEntity":"中央摊位试营业"}],"eventEntryCopy":[{"id":"event_lantern_notice","surface":"活动入口","target":"festival_event_card","text":"灯笼节筹备进行中","usage":"活动入口标题","tone":"节日期待感","relatedEntity":"灯笼节倒计时"}],"sceneHints":[{"id":"hint_order_board","surface":"场景提示","target":"order_board_hotspot","text":"在这里刷新和查看今日订单","usage":"悬浮提示","tone":"直接引导","relatedEntity":"订单板热点"}],"characterLines":[{"id":"line_lin_intro","surface":"角色台词","target":"lin_xiaoyu_bubble","text":"我们先从今天的试营业订单开始吧。","usage":"首次进入对话","tone":"温暖引导","relatedEntity":"林小渔"}],"characterCardCopy":[{"id":"card_lin_title","surface":"角色卡文案","target":"lin_xiaoyu_card","text":"试营业引导人","usage":"角色卡副标题","tone":"温暖可靠","relatedEntity":"林小渔"}],"assetLabels":[{"id":"asset_expand_ticket","surface":"资产标签","target":"expansion_ticket_icon","text":"扩建券","usage":"货币图标标签","tone":"系统术语","relatedEntity":"扩建券"}]}',
  },
]);

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

export function buildGameplayToolPrompt(brief: PersonaInput, plan: AgentPlan, iteration: number, repairPlan?: RepairPlan | null) {
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
${jsonBlock("Repair plan", repairPlan ?? null)}
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
${jsonBlock("Repair plan", repairPlan ?? null)}
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
${jsonBlock("Repair plan", repairPlan ?? null)}
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
${jsonBlock("Repair plan", repairPlan ?? null)}
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
${jsonBlock("Repair plan", repairPlan ?? null)}
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
${jsonBlock("Repair plan", repairPlan ?? null)}
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
) {
  return `
You are story_tool. Output a light narrative package that directly supports runtime beats, copywriting, and character cards.
${jsonOnlyInstruction(["storyPositioning", "worldSummary", "coreConflict", "characterRoster", "mainPlotBeats", "chapterAnchors", "emotionalTone"])}
${productionGradeInstruction("story_tool", ["provide clean role anchors for character cards", "keep chapter anchors reusable in copywriting and timeline", "do not drift into long-form branching narrative"])}
${STORY_FEWSHOT}

Requirements:
- characterRoster must be a pure array of role names only.
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
${jsonBlock("Repair plan", repairPlan ?? null)}
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
) {
  return `
You are character_tool. Output structured character cards that map directly to story anchors, interaction responsibilities, and visual production.
${jsonOnlyInstruction(["cards", "populationSummary", "entityRegistry"])}
${productionGradeInstruction("character_tool", ["cover every core role from the story roster", "map each role to interaction responsibility and visual keywords", "keep storyAnchors aligned to chapterAnchors or mainPlotBeats", "separate core roles, support roles, and visitor-style roles when relevant"])}

Requirements:
- Return at least 3 cards when the story contains 3 or more named roles.
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
${jsonBlock("Repair plan", repairPlan ?? null)}
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
) {
  return `
You are asset_manifest_tool. Output an executable asset manifest for image generation and HTML5 assembly.
${jsonOnlyInstruction(["visualStyle", "exportRules", "layeredRules", "assetGroups", "priorityOrder", "entityRegistry"])}
${productionGradeInstruction("asset_manifest_tool", ["map assets to concrete runtime carriers", "cover key scene, UI, role, and event needs", "stay inside current prototype scope", "bind every critical runtime asset back to entity IDs and runtime targets"])}
${ASSET_FEWSHOT}

Requirements:
- assetType must be one of: 角色立绘, 场景物件, 建筑单体, UI图标, UI面板, 活动插图, 装扮素材.
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
${jsonBlock("Repair plan", repairPlan ?? null)}
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
${jsonBlock("Repair plan", repairPlan ?? null)}
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
