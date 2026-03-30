const fs = require("fs");
const path = require("path");
const ts = require("typescript");

require.extensions[".ts"] = function registerTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
    fileName: filename,
  });
  module._compile(compiled.outputText, filename);
};

const projectRoot = path.resolve(__dirname, "..");
const {
  buildHtml5PreparationPackage,
} = require(path.join(projectRoot, "lib", "html5-render-schemas.ts"));
const {
  validateAllPhaseContracts,
} = require(path.join(projectRoot, "lib", "agent-phase-contracts.ts"));
const {
  buildRuleConsistencyGraph,
  mergeConsistencyReports,
} = require(path.join(projectRoot, "lib", "consistency-graph.ts"));

const brief = {
  projectCode: "Project Harbor",
  targetGenre: "模拟经营",
  targetPlatform: "多端",
  targetMarket: "中国大陆",
  audiencePositioning: "偏女性向与泛休闲用户，偏好低压力经营、装扮与持续回访。",
  coreFantasy: "把旧港小镇经营成有烟火气和节庆氛围的度假据点。",
  monetizationModel: "内购",
  benchmarkGames: "动物餐厅、梦幻家园、开罗经营系列",
  requiredSystems: "经营循环、区域扩建、订单目标、装扮收集、角色互动、活动包装",
  versionGoal: "验证首日经营循环、订单驱动、扩建反馈、装扮收集和活动包装是否成立。",
  projectStage: "小范围测试",
  productionConstraints:
    "本轮只做小范围测试版本，不接重3D资源，不做复杂剧情分支，剧情与角色主要用于活动包装与互动反馈。",
};

const proposal = {
  solutionName: "Project Harbor 小范围测试总览",
  projectPositioning: "面向中国大陆市场的轻量模拟经营原型，服务泛休闲与女性向用户。",
  designThesis: "以订单、扩建、装扮和轻剧情活动形成可回访的低压力经营体验。",
  prototypeScope: "单主场景、三块扩建区域、订单系统、角色互动、轻活动包装、可执行资产清单。",
  keyValidationMetrics: ["订单完成率", "扩建触发率", "活动入口触达率", "装扮点击率", "次日回访意愿"],
  majorRisks: ["经济闭环可能不够清晰", "场景与 UI 入口关系可能不足", "剧情角色可能与页面表达脱节"],
  roundFocus: "验证订单驱动、扩建反馈、装扮收集和节庆活动包装是否支撑小范围测试。",
};

const gameplay = {
  oneSentenceLoop: "接单 -> 完成经营动作 -> 收益结算 -> 扩建/装扮 -> 解锁更高价值订单。",
  mainLoop: ["查看当前订单", "执行经营动作", "收取收益反馈", "完成订单推进目标", "用收益扩建或装扮"],
  subLoops: ["装扮收集循环", "角色互动循环", "节庆活动循环"],
  clickPath: ["点击订单板查看订单", "点击摊位完成经营", "点击收益气泡收取奖励", "点击空地进入扩建", "点击角色触发互动"],
  feedbackRhythm: ["3 秒内出现收益反馈", "每 2 至 3 个订单出现一次扩建或装扮推进", "每次回访都有一个明显推进点"],
  failRecover: ["订单失败只降低结算效率", "资源不足时引导切换替代订单", "扩建不足时发放短任务补资源"],
  testFocus: ["首轮经营循环是否顺畅", "订单板与场景点击链路是否自然", "扩建与装扮反馈是否足够驱动回访"],
};

const economy = {
  coreCurrencies: ["金币", "扩建券", "主题装饰票"],
  faucets: ["完成订单获得金币", "活动签到获得扩建券", "节庆任务奖励主题装饰票"],
  sinks: ["摊位升级消耗金币和扩建券", "区域扩建消耗金币", "主题装饰兑换消耗装饰票"],
  orderCostLoop: "玩家完成订单获得金币与扩建券，金币用于基础扩建与经营升级，扩建后开放高收益订单并反向提升金币产出。",
  upgradeThresholds: ["完成首批订单后开放一级扩建", "经营等级 3 级后开放第二摊位升级", "主题装饰收集达到 3 件后开放节庆区域强化"],
  decorationUnlocks: ["节庆摊位皮肤由主题装饰票解锁", "限定摆件通过活动积分与扩建券组合兑换"],
  monetizationHooks: ["新手扩建礼包", "限定装饰礼包"],
  pacingControls: ["早期订单奖励高于维护成本", "扩建券投放与节庆任务同步出现", "装饰票主要通过活动与收集目标投放"],
};

const systems = {
  systemOverview: "经营系统驱动日常循环，扩建系统承担中期目标，任务和活动强化回访，角色互动与装扮收集承担情绪价值。",
  managementSystem: "围绕订单接取、摊位经营、收益回收和店铺运营展开。",
  expansionSystem: "主场景分区域扩建，每次扩建都带来新坑位、新订单和新装扮位。",
  missionSystem: "由主目标、日常任务和阶段焕新任务组成，用于明确短中期推进方向。",
  eventSystem: "以港镇灯会为主题包装经营目标，提供限时奖励与兑换内容。",
  roleInteractionSystem: "角色通过驻留、触发小事件、给出订单偏好和装扮反馈参与系统。",
  collectionSystem: "围绕装饰、角色关系节点和主题套装形成收集目标。",
  socialLightSystem: "仅保留轻量展示和空间分享，不做重社交对抗。",
};

const scene = {
  sceneConcept: "以旧港小镇中央码头为主场景，围绕订单、扩建、节庆展示和角色互动形成紧凑经营动线。",
  sceneZones: ["中央订单区", "左侧摊位扩建区", "右侧活动布置区", "角色互动休息区"],
  interactiveAreas: ["公告板订单热区", "空地建造热区", "节庆海报活动热区", "角色对话停留热区"],
  buildingSlots: ["中央摊位主坑位", "左侧扩建坑位 A", "左侧扩建坑位 B", "右侧装饰摆件坑位"],
  navigationFlow: ["进入场景先看订单区", "完成订单后移动到扩建区", "活动开放时查看节庆热区", "角色出现时返回互动休息区"],
  stateTransitions: ["订单完成后刷新扩建提示", "扩建完成后解锁新订单", "活动开始后点亮节庆热区", "角色互动后触发奖励提示"],
  contentHotspots: ["节庆海报墙", "限定装饰展示台", "角色休息长椅"],
};

const ui = {
  topBar: ["金币与扩建券显示", "等级与经验进度", "主题装饰票显示"],
  orderPanel: ["当前订单列表", "订单刷新入口", "订单完成状态"],
  taskPanel: ["阶段目标追踪", "新手引导任务", "焕新阶段任务"],
  shopEntry: ["装扮商店入口", "限定礼包入口"],
  eventEntry: ["港镇灯会入口", "活动兑换入口"],
  buildModePanel: ["空地高亮", "可建造列表", "建造消耗提示", "确认按钮"],
  feedbackLayer: ["收益飞字", "订单完成弹层", "扩建完成动画提示", "角色互动气泡"],
};

const story = {
  storyPositioning: "轻剧情经营包装，用角色关系与节庆目标强化订单与扩建驱动。",
  worldSummary: "海港小镇准备重启旧市集，玩家通过经营餐饮街与节庆活动让街区重新热闹起来。",
  coreConflict: "旧市集人流不足且灯会筹备时间有限，玩家必须平衡订单收益与扩建投入。",
  characterRoster: ["林小渔", "阿树", "陈伯"],
  mainPlotBeats: [
    "林小渔引导玩家接手第一批订单并说明试营业目标",
    "阿树提出灯会装饰计划，希望玩家开放主题摊位",
    "陈伯提醒材料紧张，要求玩家优先完成高收益订单",
  ],
  chapterAnchors: ["中央摊位试营业", "港镇灯会筹备", "仓库补给紧张"],
  emotionalTone: "温暖轻快",
};

const characters = [
  {
    name: "林小渔",
    rolePositioning: "试营业引导员",
    personalityTags: ["热情", "细心", "可靠"],
    backgroundSummary: "从小在港镇长大，希望用试营业让旧市集重新恢复人气。",
    interactionResponsibility: "负责新手引导、订单说明和试营业提醒。",
    collectionValue: "解锁林小渔的好感节点可获得试营业纪念装饰。",
    relatedSystems: ["订单系统", "任务系统"],
    storyAnchors: ["中央摊位试营业"],
    visualKeywords: ["围裙", "木牌", "海风短发"],
  },
  {
    name: "阿树",
    rolePositioning: "节庆装饰策划者",
    personalityTags: ["活泼", "浪漫", "有创意"],
    backgroundSummary: "负责港镇灯会的装饰设计，希望玩家把旧港打造成节庆打卡点。",
    interactionResponsibility: "推动节庆活动、限定装饰和展示位互动。",
    collectionValue: "解锁阿树的节庆故事可获得限定灯会装饰。",
    relatedSystems: ["活动系统", "装扮收集系统"],
    storyAnchors: ["港镇灯会筹备"],
    visualKeywords: ["灯笼", "花束", "节庆披肩"],
  },
  {
    name: "陈伯",
    rolePositioning: "后勤与补给负责人",
    personalityTags: ["稳重", "节俭", "经验丰富"],
    backgroundSummary: "负责仓库补给与经营提醒，帮助玩家控制扩建节奏。",
    interactionResponsibility: "提醒材料短缺、引导优先完成高收益订单。",
    collectionValue: "解锁陈伯的补给建议可获得仓库主题摆件。",
    relatedSystems: ["经济系统", "扩建系统"],
    storyAnchors: ["仓库补给紧张"],
    visualKeywords: ["账本", "旧帽子", "仓库钥匙"],
  },
];

const assetManifest = {
  visualStyle: "清新 2D 手绘模拟经营风，结构清晰，适合小屏点击反馈与节庆氛围展示。",
  exportRules: ["角色与建筑统一导出 PNG", "需要透明效果的单体统一使用品红背景 #FF00FF", "UI 素材保持固定尺寸与命名规则"],
  layeredRules: ["角色立绘独立导出", "建筑与场景物件分层", "UI 图标与 UI 面板独立导出"],
  assetGroups: [
    { assetName: "林小渔角色立绘", assetType: "角色立绘", purpose: "角色互动与角色卡展示", spec: "1536x1536 PNG", ratio: "1:1", layer: "character-main", namingRule: "char_lin_xiaoyu_v1", backgroundRequirement: "品红背景 #FF00FF", sourceDependencies: ["林小渔", "中央摊位试营业"] },
    { assetName: "阿树角色立绘", assetType: "角色立绘", purpose: "角色互动与灯会剧情展示", spec: "1536x1536 PNG", ratio: "1:1", layer: "character-main", namingRule: "char_a_shu_v1", backgroundRequirement: "品红背景 #FF00FF", sourceDependencies: ["阿树", "港镇灯会筹备"] },
    { assetName: "陈伯角色立绘", assetType: "角色立绘", purpose: "角色互动与补给剧情展示", spec: "1536x1536 PNG", ratio: "1:1", layer: "character-main", namingRule: "char_chen_bo_v1", backgroundRequirement: "品红背景 #FF00FF", sourceDependencies: ["陈伯", "仓库补给紧张"] },
    { assetName: "港镇主场景建筑单体", assetType: "建筑单体", purpose: "承载中央订单区与扩建区的主场景展示", spec: "2048x1536 PNG", ratio: "4:3", layer: "scene-main", namingRule: "building_harbor_main_v1", backgroundRequirement: "完整场景底图", sourceDependencies: ["中央订单区", "左侧摊位扩建区", "右侧活动布置区"] },
    { assetName: "订单公告板UI图标", assetType: "UI图标", purpose: "承载公告板订单热区与订单入口按钮", spec: "512x512 PNG", ratio: "1:1", layer: "ui-icon", namingRule: "icon_order_board_v1", backgroundRequirement: "透明或品红背景 #FF00FF", sourceDependencies: ["公告板订单热区", "当前订单列表"] },
    { assetName: "建造模式UI面板", assetType: "UI面板", purpose: "承载空地建造热区、可建造列表与扩建券确认入口", spec: "1600x900 PNG", ratio: "16:9", layer: "ui-panel", namingRule: "panel_build_mode_v1", backgroundRequirement: "透明或品红背景 #FF00FF", sourceDependencies: ["空地建造热区", "空地高亮", "可建造列表", "扩建券"] },
    { assetName: "港镇灯会活动插图", assetType: "活动插图", purpose: "承载港镇灯会筹备剧情锚点与活动入口展示", spec: "1920x1080 PNG", ratio: "16:9", layer: "event-main", namingRule: "event_harbor_festival_v1", backgroundRequirement: "完整活动插图底图", sourceDependencies: ["港镇灯会筹备", "节庆海报活动热区"] },
    { assetName: "限定装饰展示素材", assetType: "装扮素材", purpose: "展示限定装饰、主题装饰票和节庆展示位", spec: "1024x1024 PNG", ratio: "1:1", layer: "decoration-main", namingRule: "decor_limited_festival_v1", backgroundRequirement: "透明或品红背景 #FF00FF", sourceDependencies: ["限定装饰", "主题装饰票", "限定装饰展示台"] },
  ],
  priorityOrder: ["林小渔角色立绘", "港镇主场景建筑单体", "订单公告板UI图标", "建造模式UI面板", "港镇灯会活动插图"],
};

function makeCopy(id, surface, target, text, usage, tone, relatedEntity) {
  return { id, surface, target, text, usage, tone, relatedEntity };
}

const copywriting = {
  pageTitles: [makeCopy("page_main_market", "页面标题", "主经营页", "港镇餐饮街", "主页面左上角标题", "温暖经营", "中央订单区")],
  panelTitles: [
    makeCopy("panel_order_board", "面板标题", "订单公告板", "今日订单", "订单面板标题", "清晰直接", "公告板订单热区"),
    makeCopy("panel_build_mode", "面板标题", "建造面板", "扩建施工", "建造面板标题", "明确执行", "空地建造热区"),
  ],
  buttonLabels: [
    makeCopy("btn_order_claim", "按钮文案", "订单领取按钮", "领取今日订单", "订单入口 CTA", "直接执行", "公告板订单热区"),
    makeCopy("btn_expand_ticket", "按钮文案", "扩建确认按钮", "消耗扩建券开工", "扩建确认 CTA", "明确执行", "扩建券"),
    makeCopy("btn_event_entry", "按钮文案", "港镇灯会入口", "查看灯会筹备", "活动入口 CTA", "节庆引导", "港镇灯会筹备"),
  ],
  taskAndOrderCopy: [
    makeCopy("task_trial_orders", "任务订单", "新手任务", "完成 3 份试营业订单", "阶段目标描述", "引导型", "中央摊位试营业"),
  ],
  eventEntryCopy: [
    makeCopy("event_harbor_festival", "活动入口", "港镇灯会入口", "港镇灯会筹备中", "活动入口主文案", "节庆期待", "港镇灯会筹备"),
  ],
  sceneHints: [
    makeCopy("hint_order_board", "场景提示", "公告板订单热区", "这里可以刷新今日订单", "场景提示", "直接提示", "公告板订单热区"),
    makeCopy("hint_build_slot", "场景提示", "空地建造热区", "在这里使用扩建券扩建摊位", "场景提示", "直接提示", "空地建造热区"),
    makeCopy("hint_event_board", "场景提示", "节庆海报活动热区", "点击查看港镇灯会筹备", "场景提示", "节庆提示", "节庆海报活动热区"),
    makeCopy("hint_character_rest", "场景提示", "角色对话停留热区", "角色会在这里给出经营建议", "场景提示", "温和提示", "角色对话停留热区"),
    makeCopy("hint_hotspot_poster", "场景提示", "节庆海报墙", "这里会展示港镇灯会的活动海报。", "场景热点提示", "节庆展示", "节庆海报墙"),
    makeCopy("hint_hotspot_decor", "场景提示", "限定装饰展示台", "限定装饰会在这里公开展示。", "场景热点提示", "收藏展示", "限定装饰展示台"),
  ],
  characterLines: [
    makeCopy("line_lin_intro", "角色台词", "林小渔气泡", "先把中央摊位试营业的订单接起来吧。", "首次进入主场景时显示", "温和引导", "林小渔"),
    makeCopy("line_ashu_event", "角色台词", "阿树气泡", "港镇灯会筹备就等你把限定装饰摆上去了。", "活动触发时显示", "活泼期待", "阿树"),
    makeCopy("line_chen_supply", "角色台词", "陈伯气泡", "仓库补给紧张，先做高收益订单再扩建。", "资源提醒时显示", "稳重提醒", "陈伯"),
  ],
  characterCardCopy: [
    makeCopy("card_lin_title", "角色卡文案", "林小渔角色卡", "试营业引导员", "角色卡副标题", "温暖可靠", "林小渔"),
    makeCopy("card_ashu_title", "角色卡文案", "阿树角色卡", "灯会装饰策划者", "角色卡副标题", "节庆活力", "阿树"),
    makeCopy("card_chen_title", "角色卡文案", "陈伯角色卡", "补给与后勤顾问", "角色卡副标题", "稳重可信", "陈伯"),
  ],
  assetLabels: [
    makeCopy("asset_expand_ticket", "资产标签", "扩建券图标", "扩建券", "货币图标名称", "系统术语", "扩建券"),
    makeCopy("asset_limited_decor", "资产标签", "限定装饰展示素材", "限定装饰", "展示标签", "节庆收藏", "限定装饰"),
    makeCopy("asset_lin_label", "资产标签", "林小渔角色立绘", "林小渔角色立绘", "角色素材展示名", "角色术语", "林小渔角色立绘"),
    makeCopy("asset_scene_label", "资产标签", "港镇主场景建筑单体", "港镇主场景建筑单体", "主场景素材展示名", "场景术语", "港镇主场景建筑单体"),
    makeCopy("asset_order_board", "资产标签", "订单公告板UI图标", "订单公告板UI图标", "关键 UI 资产展示名", "UI 术语", "订单公告板UI图标"),
    makeCopy("asset_build_panel", "资产标签", "建造模式UI面板", "建造模式UI面板", "关键 UI 面板展示名", "UI 术语", "建造模式UI面板"),
  ],
};

const creativePack = {
  gameplay,
  economy,
  systems,
  scene,
  ui,
  story,
  characters,
  assetManifest,
  copywriting,
};

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const html5Preparation = buildHtml5PreparationPackage(brief, proposal, creativePack);
  const phaseChecks = validateAllPhaseContracts({
    gameplay,
    economy,
    systems,
    proposal,
    scene,
    ui,
    story,
    characterCards: characters,
    assetManifest,
    copywriting,
    sceneDefinitions: html5Preparation.sceneDefinitions,
    interactionConfig: html5Preparation.interactionConfig,
    layoutConfig: html5Preparation.layoutConfig ?? null,
    timelineConfig: html5Preparation.timelineConfig ?? null,
    lightingRenderConfig: html5Preparation.lightingRenderConfig ?? null,
    html5Preparation,
  });

  invariant(phaseChecks.every((check) => check.pass), `Phase contract failed: ${JSON.stringify(phaseChecks, null, 2)}`);

  const ruleEdges = buildRuleConsistencyGraph(proposal, creativePack, html5Preparation);
  const report = mergeConsistencyReports(ruleEdges, []);
  invariant(report.hardFailures.length === 0, `Hard consistency failures found: ${JSON.stringify(report.hardFailures, null, 2)}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        phaseChecks: phaseChecks.map((check) => ({ phaseId: check.phaseId, pass: check.pass })),
        edgeCount: ruleEdges.length,
        hardFailures: report.hardFailures.length,
        softWarnings: report.softWarnings.length,
      },
      null,
      2,
    ),
  );
}

main();
