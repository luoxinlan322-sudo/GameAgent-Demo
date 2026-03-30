import type { ConsistencyCheckResult, CreativePack, Evaluation, GameProposal, PersonaInput } from "./schemas";

function normalizeBlockedBy(items: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of items) {
    const value = item.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
    if (normalized.length >= 10) break;
  }

  return normalized;
}

export function getHardGates(_brief: PersonaInput, proposal: GameProposal, creativePack: CreativePack, consistency?: ConsistencyCheckResult | null) {
  const loopsClear = creativePack.gameplay.mainLoop.length >= 4 && creativePack.gameplay.clickPath.length >= 3;
  const economyClosedLoop =
    creativePack.economy.coreCurrencies.length >= 3 &&
    creativePack.economy.faucets.length >= 3 &&
    creativePack.economy.sinks.length >= 3 &&
    creativePack.economy.orderCostLoop.length > 24;
  const systemCoverage =
    creativePack.systems.managementSystem.length > 16 &&
    creativePack.systems.expansionSystem.length > 16 &&
    creativePack.systems.missionSystem.length > 16 &&
    creativePack.systems.eventSystem.length > 16 &&
    creativePack.systems.roleInteractionSystem.length > 16 &&
    creativePack.systems.collectionSystem.length > 16;
  const sceneUiReady =
    creativePack.scene.interactiveAreas.length >= 4 &&
    creativePack.scene.buildingSlots.length >= 3 &&
    creativePack.ui.orderPanel.length >= 2 &&
    creativePack.ui.buildModePanel.length >= 2;
  const storyCharacterAligned = consistency ? consistency.storyCharacterAligned : true;
  const assetManifestExecutable =
    creativePack.assetManifest.assetGroups.length >= 5 &&
    creativePack.assetManifest.assetGroups.every((item) => item.backgroundRequirement.length > 0);

  const blockedBy: string[] = [];

  if (!loopsClear) blockedBy.push("玩法结构不清晰，主循环或点击链路不足以支撑 HTML5 原型。");
  if (!economyClosedLoop) blockedBy.push("数值与经济闭环不完整，订单、产出、消耗和升级关系未闭合。");
  if (!systemCoverage) blockedBy.push("系统策划覆盖不足，经营、扩建、任务、活动、角色互动或装扮收集缺失。");
  if (!sceneUiReady) blockedBy.push("场景策划与 UI 架构还不足以直接进入可交互原型。");
  if (!storyCharacterAligned && consistency) blockedBy.push(...consistency.issues);
  if (!assetManifestExecutable) blockedBy.push("资产清单不可执行，缺少足够素材项或背景要求不明确。");
  if (proposal.prototypeScope.length < 16) blockedBy.push("总体策划没有明确原型范围。");

  return {
    hardGates: {
      loopsClear,
      economyClosedLoop,
      systemCoverage,
      sceneUiReady,
      storyCharacterAligned,
      assetManifestExecutable,
    },
    blockedBy: normalizeBlockedBy(blockedBy),
  };
}

export function computeFallbackEvaluation(
  brief: PersonaInput,
  proposal: GameProposal,
  creativePack: CreativePack,
  consistency?: ConsistencyCheckResult | null,
): Evaluation {
  const { hardGates, blockedBy } = getHardGates(brief, proposal, creativePack, consistency);

  const scores = {
    gameplayStructure: Math.min(creativePack.gameplay.mainLoop.length * 3 + 5, 20),
    economyBalance: Math.min(creativePack.economy.coreCurrencies.length * 2 + creativePack.economy.faucets.length + 3, 15),
    systemCoverage: Math.min(creativePack.systems.systemOverview.length > 30 ? 15 : 10, 15),
    sceneUiReadiness: Math.min(creativePack.scene.interactiveAreas.length + creativePack.ui.orderPanel.length + 4, 15),
    storyCharacterConsistency: consistency ? (consistency.storyCharacterAligned ? 10 : Math.max(2, 10 - consistency.issues.length * 2)) : 8,
    assetManifestExecutability: Math.min(creativePack.assetManifest.assetGroups.length + 6, 15),
    smallScaleTestFit: Math.min((brief.projectStage === "小范围测试" ? 10 : 6) + creativePack.gameplay.testFocus.length + 6, 20),
  };

  const totalScore = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const decision =
    blockedBy.length > 0 ? "修改后复评" : totalScore >= 85 ? "优先进入测试" : totalScore >= 75 ? "建议进入测试" : "修改后复评";

  return {
    hardGates,
    blockedBy,
    scores,
    totalScore,
    decision,
    summary:
      blockedBy.length > 0
        ? "当前设计包已形成结构，但仍存在阻塞项，需要主 Agent 继续定向返修。"
        : "当前设计包结构较完整，已经具备进入小范围测试评审的基础。",
    risks: [
      "经营循环在真实原型中的停留时长和点击疲劳仍需验证。",
      "装扮收集和活动包装是否足以支撑连续回访仍需小样本观察。",
    ],
    recommendations: [
      "优先把玩法、经济、场景、UI 装进 HTML5 单主场景原型。",
      "后续再接图片生成、品红背景素材和 Python 抠图流程。",
    ],
  };
}
