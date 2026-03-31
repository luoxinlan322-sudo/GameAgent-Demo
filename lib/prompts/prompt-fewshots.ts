import { fewShotBlock } from "./prompt-blocks";

export const UI_FEWSHOT = fewShotBlock("UI架构示例", [
  {
    input: "小范围模拟经营原型，含订单、扩建和活动入口。",
    output:
      '{"topBar":["金币与高级软货币","等级与进度","体力或行动点"],"orderPanel":["当前订单列表","订单倒计时"],"taskPanel":["阶段目标","新手引导"],"shopEntry":["商店按钮","首充礼包入口"],"eventEntry":["活动卡片入口","每日签到入口"],"buildModePanel":["空地高亮","可建造列表","花费预览","确认按钮"],"feedbackLayer":["获得飘字","升级弹窗","订单完成提示"]}',
  },
]);

export const ECONOMY_FEWSHOT = fewShotBlock("经济系统示例", [
  {
    input: "含订单循环、扩建、主题装扮和礼包钩子的模拟经营原型。",
    output:
      '{"coreCurrencies":["金币","扩建券","主题装扮兑换券"],"faucets":["完成订单获得金币","活动签到获得扩建券","主题任务获得装扮兑换券"],"sinks":["用金币和扩建券扩建摊位","用兑换券兑换主题装扮","用付费货币购买便利礼包"],"orderCostLoop":"完成订单获得金币和少量扩建券，用金币和扩建券进行摊位扩建和升级，扩建后解锁更高价值订单，提升未来金币收益。","upgradeThresholds":["首批订单完成后解锁1级扩建","经营等级3级时解锁第二次摊位升级","收集3个主题装扮后解锁节日区域强化"],"decorationUnlocks":["节日摊位皮肤通过主题兑换券解锁","限定道具通过活动积分加扩建券兑换"],"monetizationHooks":["新手扩建礼包含扩建券和加速卡","限定装扮礼包含主题道具和活动徽章"],"pacingControls":["前期订单收益高于维护成本","扩建券随里程碑任务一起出现","装扮兑换券主要通过活动和收集目标获得"]}',
  },
]);

export const SCENE_FEWSHOT = fewShotBlock("场景设计示例", [
  {
    input: "单场景港镇模拟经营，含扩建、活动热点和角色交互。",
    output:
      '{"sceneConcept":"紧凑的港口市集街道，在一次短时测试中支持订单、扩建和节日活动节拍。","sceneZones":["中央订单区","左侧扩建区","右侧活动装扮区","角色交互休憩区"],"interactiveAreas":["订单板热点","空地建造热点","节日海报热点","角色对话热点"],"buildingSlots":["主摊位坑位","左侧扩建坑位A","左侧扩建坑位B","右侧装扮坑位"],"navigationFlow":["进入场景首先看到订单区","完成订单后走向扩建区","节日内容解锁后前往活动热点","对话可用时返回角色区"],"stateTransitions":["订单刷新后显示扩建提示","扩建完成后解锁新订单阶段","活动开始后点亮节日热点","角色交互后触发小额奖励提示"],"contentHotspots":["节日海报墙","限定装扮展柜","角色休憩长椅"]}',
  },
]);

export const SCENE_REPAIR_FEWSHOT = fewShotBlock("场景修补示例", [
  {
    input:
      '当前场景基线已包含 sceneEntities=["core_main_shop","event_summer_fair"]，zoneEntityMap=["main_harbor_zone=>core_main_shop|event_summer_fair"]，buildingDefinitions=["building_main_shop"]。修补焦点说缺少载体：resource_coin 和 order_seafood_rice。要求：保留已有有效条目，将缺失载体添加到 sceneEntities，映射到 zoneEntityMap，并补充缺失的 buildingDefinitions，而不是重写整个场景。',
    output:
      '{"sceneConcept":"保持紧凑的港口市集街道作为首日循环的可玩场景。","sceneZones":["main_harbor_zone","left_food_street","right_event_lane"],"interactiveAreas":["订单板热点","金币反馈热点","节日横幅热点"],"buildingSlots":["main_shop_slot_a","order_board_slot_a","reward_display_slot_a"],"navigationFlow":["从主港口区进入","在订单板领取海鲜饭订单","在奖励展示处收取金币反馈","返回活动区参加节日活动"],"stateTransitions":["领取海鲜饭订单后高亮订单板","结算后显示金币奖励载体","活动开启后保持节日横幅激活"],"contentHotspots":["节日海报墙","奖励展示架"],"sceneEntities":[{"entityId":"core_main_shop","entityName":"主摊位","entityType":"building","functionalRole":"核心生产和结算载体","isCore":true,"requiresAsset":true,"requiresLayout":true,"requiresCopy":false,"relatedSystems":["management_system"],"relatedScenes":["main_harbor_zone"]},{"entityId":"event_summer_fair","entityName":"夏日市集","entityType":"activity_carrier","functionalRole":"活动入口载体","isCore":true,"requiresAsset":true,"requiresLayout":true,"requiresCopy":true,"relatedSystems":["event_system"],"relatedScenes":["right_event_lane"]},{"entityId":"resource_coin","entityName":"金币奖励展示","entityType":"facility","functionalRole":"可见经济奖励载体","isCore":true,"requiresAsset":true,"requiresLayout":true,"requiresCopy":true,"relatedSystems":["economy_system"],"relatedScenes":["main_harbor_zone"]},{"entityId":"order_seafood_rice","entityName":"海鲜饭订单板","entityType":"facility","functionalRole":"海鲜饭循环订单领取载体","isCore":true,"requiresAsset":true,"requiresLayout":true,"requiresCopy":true,"relatedSystems":["management_system","mission_system"],"relatedScenes":["main_harbor_zone"]}],"zoneEntityMap":[{"zoneName":"main_harbor_zone","entityIds":["core_main_shop","resource_coin","order_seafood_rice"]},{"zoneName":"right_event_lane","entityIds":["event_summer_fair"]}],"buildingDefinitions":[{"buildingId":"building_main_shop","buildingName":"主摊位","buildingType":"core_building","slotName":"main_shop_slot_a","gameplayPurpose":"完成订单并结算奖励","upgradeHook":"升级柜台解锁更高价值菜品"},{"buildingId":"facility_coin_reward","buildingName":"金币奖励展示","buildingType":"reward_facility","slotName":"reward_display_slot_a","gameplayPurpose":"结算后展示可见金币发放","upgradeHook":"扩展奖励视觉和发放反馈"},{"buildingId":"facility_order_board_seafood_rice","buildingName":"海鲜饭订单板","buildingType":"order_facility","slotName":"order_board_slot_a","gameplayPurpose":"领取和追踪海鲜饭订单循环","upgradeHook":"解锁更多海鲜订单变体"},{"buildingId":"activity_summer_fair_banner","buildingName":"夏日市集横幅","buildingType":"event_facility","slotName":"right_event_lane","gameplayPurpose":"承载活动入口和季节活动奖励","upgradeHook":"解锁额外节日任务和主题装扮"}]}',
  },
]);

export const STORY_FEWSHOT = fewShotBlock("剧情示例", [
  {
    input: "小范围模拟经营测试的轻量剧情包装，须直接对接角色卡和文案。",
    output:
      '{"storyPositioning":"轻量叙事包装，强化订单、扩建和活动动机。","worldSummary":"一座小港镇正在通过美食摊位和即将到来的灯笼节复兴老集市街。","coreConflict":"客流低迷且节日筹备时间紧迫，玩家必须在高利润订单和扩建工作之间权衡。","characterRoster":["林小渔","阿树","陈叔"],"mainPlotBeats":["林小渔引导首批试营业订单，讲解摊位核心目标。","阿树在新区开放后推动一个海洋风格装扮任务。","陈叔警告节日筹备进度落后，要求玩家优先完成高价值订单。"],"chapterAnchors":["中央摊位试营业","新区开放","灯笼节倒计时"],"emotionalTone":"温暖、明快、略带节日感"}',
  },
]);

export const ASSET_FEWSHOT = fewShotBlock("资产清单示例", [
  {
    input: "港镇模拟经营原型，后续对接图片生成和HTML5运行时装配。",
    output:
      '{"visualStyle":"干净的2D手绘经营风格，角色剪影可读性强，紧凑的移动端构图","exportRules":["角色和建筑导出为PNG","需透明提取的资产使用品红背景 #FF00FF","UI素材使用固定尺寸和命名规则"],"layeredRules":["角色立绘单独导出","建筑和场景道具按图层分离","UI图标和UI面板分别导出"],"assetGroups":[{"assetName":"港口市集全景背景","assetType":"场景背景","purpose":"整个可玩场景的大底图，所有建筑坑位和交互热点渲染在此之上","spec":"2560x1440 PNG","ratio":"16:9","layer":"scene-background","namingRule":"bg_harbor_market_v1","backgroundRequirement":"完整场景底图，无需透明通道","sourceDependencies":["场景概念: 紧凑的港口市集街道","场景区域: 中央订单区, 左侧扩建区, 右侧活动装扮区"],"entityIds":["scene_harbor_market"],"runtimeTargets":["scene-root-canvas"],"deliveryScope":"scene"},{"assetName":"林小渔立绘","assetType":"角色立绘","purpose":"角色交互和角色卡展示","spec":"1536x1536 PNG","ratio":"1:1","layer":"character-main","namingRule":"char_lin_xiaoyu_v1","backgroundRequirement":"品红背景 #FF00FF","sourceDependencies":["角色卡: 林小渔","剧情锚点: 中央摊位试营业"],"entityIds":["char_lin_xiaoyu"],"runtimeTargets":["character-dialog-portrait","character-card-display"],"deliveryScope":"character"},{"assetName":"阿树立绘","assetType":"角色立绘","purpose":"角色交互和角色卡展示","spec":"1536x1536 PNG","ratio":"1:1","layer":"character-main","namingRule":"char_a_shu_v1","backgroundRequirement":"品红背景 #FF00FF","sourceDependencies":["角色卡: 阿树","剧情锚点: 新区开放"],"entityIds":["char_a_shu"],"runtimeTargets":["character-dialog-portrait","character-card-display"],"deliveryScope":"character"},{"assetName":"陈叔立绘","assetType":"角色立绘","purpose":"角色交互和角色卡展示","spec":"1536x1536 PNG","ratio":"1:1","layer":"character-main","namingRule":"char_chen_shu_v1","backgroundRequirement":"品红背景 #FF00FF","sourceDependencies":["角色卡: 陈叔","剧情锚点: 灯笼节倒计时"],"entityIds":["char_chen_shu"],"runtimeTargets":["character-dialog-portrait","character-card-display"],"deliveryScope":"character"}],"priorityOrder":["港口市集全景背景","林小渔立绘","阿树立绘","陈叔立绘","中央摊位建筑","订单按钮图标"]}',
  },
]);

export const COPYWRITING_FEWSHOT = fewShotBlock("文案示例", [
  {
    input: "订单、扩建、活动入口和角色对话须对齐场景名、剧情锚点和资产标签。",
    output:
      '{"pageTitles":[{"id":"page_main_market","surface":"页面标题","target":"main_market_page","text":"港口集市街","usage":"左上角页面标题","tone":"经营温暖感","relatedEntity":"中央订单区"}],"panelTitles":[{"id":"panel_order_board","surface":"面板标题","target":"order_board_panel","text":"今日订单","usage":"订单面板标题","tone":"简洁直接","relatedEntity":"订单板热点"}],"buttonLabels":[{"id":"btn_order_claim","surface":"按钮文案","target":"order_claim_button","text":"领取今日订单","usage":"订单入口CTA","tone":"直接行动","relatedEntity":"订单板热点"},{"id":"btn_expand_ticket","surface":"按钮文案","target":"build_confirm_button","text":"使用扩建券","usage":"建造确认CTA","tone":"明确行动","relatedEntity":"扩建券"}],"taskAndOrderCopy":[{"id":"task_first_shift","surface":"任务订单","target":"new_player_task","text":"完成3笔试营业订单","usage":"阶段目标文案","tone":"引导","relatedEntity":"中央摊位试营业"}],"eventEntryCopy":[{"id":"event_lantern_notice","surface":"活动入口","target":"festival_event_card","text":"灯笼节筹备进行中","usage":"活动入口标题","tone":"节日期待感","relatedEntity":"灯笼节倒计时"}],"sceneHints":[{"id":"hint_order_board","surface":"场景提示","target":"order_board_hotspot","text":"在这里刷新和查看今日订单","usage":"悬浮提示","tone":"直接引导","relatedEntity":"订单板热点"}],"characterLines":[{"id":"line_lin_intro","surface":"角色台词","target":"lin_xiaoyu_bubble","text":"我们先从今天的试营业订单开始吧。","usage":"首次进入对话","tone":"温暖引导","relatedEntity":"林小渔"}],"characterCardCopy":[{"id":"card_lin_title","surface":"角色卡文案","target":"lin_xiaoyu_card","text":"试营业引导人","usage":"角色卡副标题","tone":"温暖可靠","relatedEntity":"林小渔"}],"assetLabels":[{"id":"asset_expand_ticket","surface":"资产标签","target":"expansion_ticket_icon","text":"扩建券","usage":"货币图标标签","tone":"系统术语","relatedEntity":"扩建券"}]}',
  },
]);
