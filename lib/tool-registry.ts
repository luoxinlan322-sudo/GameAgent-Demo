/**
 * Unified Tool Registry — single source of truth for every tool's config,
 * execution logic, repair guidance and state mapping.
 *
 * Inspired by Claude Code's `Tool<Input, Output>` pattern: each tool is
 * a self-contained definition with a uniform interface but custom execute().
 *
 * Benefits:
 * - Adding a new tool = single registry entry (vs editing 4+ files)
 * - createToolExecutors becomes a 3-line loop
 * - Repair guidance co-located with the tool it belongs to
 * - Schema selection, fallback, prompt builder all discoverable in one place
 */
import type { LangfuseObservation } from "@langfuse/tracing";
import type { ToolExecutionConfig } from "./agent-execution-config";
import { buildSceneRepairFocus } from "./consistency-graph";
import type {
  CreativePack,
  GenreFeatureProfile,
  PersonaInput,
  ToolName,
} from "./schemas";
import { getGenreProfile } from "./schemas";
import {
  runGameplayTool,
  runEconomyTool,
  runSystemDesignTool,
  runProposalTool,
  runSceneTool,
  runUiTool,
  runStoryTool,
  runCharacterTool,
  runAssetManifestTool,
  runCopywritingTool,
  runLayoutTool,
  runTimelineTool,
} from "./agent-tools";
import type { MainAgentState } from "./main-agent";

// ─── Unified ToolDefinition type ────────────────────────────────────────────

export type ToolExecuteContext = {
  sessionId: string;
  runId: string;
  iteration: number;
  langfuseParent?: LangfuseObservation;
};

export type ToolDefinition = ToolExecutionConfig & {
  /** Debug phase label for events */
  debugPhase: string;
  /** Debug title for events */
  debugTitle: string;
  /** Per-tool repair guidance injected into repair prompt */
  repairGuidance: string;
  /**
   * Execute the tool: read deps from state, call LLM → write result to state.
   * Returns the produced output (also written to state).
   */
  execute: (
    state: MainAgentState,
    persona: PersonaInput,
    ctx: ToolExecuteContext,
    genreProfile: GenreFeatureProfile | null,
    creativePackBuilder: (state: MainAgentState) => CreativePack | null,
  ) => Promise<unknown>;
};

// ─── Registry ───────────────────────────────────────────────────────────────

function buildCtx(state: MainAgentState, ctx: ToolExecuteContext) {
  return { sessionId: ctx.sessionId, runId: ctx.runId, iteration: state.iterationCount, langfuseParent: ctx.langfuseParent };
}

export const TOOL_REGISTRY: Record<ToolName, ToolDefinition> = {
  gameplay_tool: {
    tool: "gameplay_tool",
    title: "玩法结构工具",
    summary: "Define primary loops, sub-loops, click chains, and feedback rhythm.",
    phase: "foundation",
    dependsOn: [],
    html5Outputs: [],
    concurrentWith: ["economy_tool"],
    debugPhase: "工具",
    debugTitle: "玩法结构工具",
    repairGuidance: [
      "gameplay_tool 修复重点：",
      "- primaryLoop 必须包含完整的核心循环描述（接单→执行→奖励→升级/扩展）。",
      "- subLoops 至少 2 条，覆盖装扮/收集与社交/活动两类子循环。",
      "- clickChain 描述从进入到完成核心操作的完整步骤。",
    ].join("\n"),
    execute: async (state, persona, ctx, _gp) => {
      state.gameplay = await runGameplayTool(persona, state.plan!, state.iterationCount, buildCtx(state, ctx), state.repairPlan, state.gameplay);
      return state.gameplay;
    },
  },

  economy_tool: {
    tool: "economy_tool",
    title: "数值与经济工具",
    summary: "Populate currencies, order-cost loop, upgrade thresholds, and decoration hooks.",
    phase: "foundation",
    dependsOn: ["gameplay_tool"],
    html5Outputs: [],
    concurrentWith: ["system_design_tool"],
    debugPhase: "工具",
    debugTitle: "数值与经济工具",
    repairGuidance: [
      "economy_tool 修复重点：",
      "- coreCurrencies 至少 3 项，并覆盖基础经营货币与扩建/活动进度货币。",
      "- orderCostLoop 必须清楚描述订单产出、资源投入、升级/扩建、收益提升的闭环。",
      "- upgradeThresholds 至少 3 项，且与订单、扩建、装饰解锁相对应。",
    ].join("\n"),
    execute: async (state, persona, ctx, genreProfile) => {
      state.economy = await runEconomyTool(persona, state.plan!, state.gameplay!, state.iterationCount, buildCtx(state, ctx), state.repairPlan, genreProfile, state.economy);
      return state.economy;
    },
  },

  system_design_tool: {
    tool: "system_design_tool",
    title: "系统策划工具",
    summary: "Generate management, expansion, task, event, and character interaction systems.",
    phase: "foundation",
    dependsOn: ["gameplay_tool"],
    html5Outputs: [],
    concurrentWith: ["economy_tool"],
    debugPhase: "工具",
    debugTitle: "系统策划工具",
    repairGuidance: [
      "system_design_tool 修复重点：",
      "- gameplay 中的人物、访客、居民、顾客、陪伴或对话角色，必须在 systemEntities 中稳定暴露为 character 或 visitor carriers。",
      "- systemToEntityMap 必须把这些 people-facing carriers 挂到 roleInteractionSystem、eventSystem、missionSystem 或其他 loop-facing system。",
      "- 纯资源、货币、券、点数不要误标成 building/facility；真正可见的经营载体才使用 building/facility。",
      "- 修复时保留已正确的系统实体，只纠正错类型、漏映射和缺责任说明的问题。",
    ].join("\n"),
    execute: async (state, persona, ctx, genreProfile) => {
      state.systems = await runSystemDesignTool(persona, state.plan!, state.gameplay!, state.economy, state.iterationCount, buildCtx(state, ctx), state.repairPlan, genreProfile, state.systems);
      return state.systems;
    },
  },

  proposal_tool: {
    tool: "proposal_tool",
    title: "总体策划工具",
    summary: "Summarize positioning, prototype scope, validation focus, and project-level risks.",
    phase: "foundation",
    dependsOn: ["gameplay_tool", "economy_tool", "system_design_tool"],
    html5Outputs: [],
    concurrentWith: [],
    debugPhase: "工具",
    debugTitle: "总体策划工具",
    repairGuidance: [
      "proposal_tool 修复重点：",
      "- 只修复结构、字段缺失、字段类型与最小内容要求。",
      "- 保持现有任务目标和命名体系，不要额外扩展设计范围。",
    ].join("\n"),
    execute: async (state, persona, ctx, _gp) => {
      state.proposal = await runProposalTool(persona, state.plan!, state.gameplay!, state.economy!, state.systems!, state.iterationCount, buildCtx(state, ctx), state.repairPlan, state.proposal);
      return state.proposal;
    },
  },

  scene_design_tool: {
    tool: "scene_design_tool",
    title: "场景策划工具",
    summary: "Define scene zones, interactive hotspots, building slots, and navigation flow.",
    phase: "experience",
    dependsOn: ["system_design_tool", "proposal_tool"],
    html5Outputs: ["sceneDefinitions", "layoutConfig", "interactionConfig"],
    concurrentWith: ["story_tool"],
    debugPhase: "工具",
    debugTitle: "场景策划工具",
    repairGuidance: [
      "scene_design_tool 修复重点：",
      "- interactiveAreas、contentHotspots 必须承接活动系统与角色互动系统。",
      "- 场景热区命名要能被 UI、文案、资产清单直接复用。",
      "- navigationFlow 与 stateTransitions 要体现订单完成、扩建完成、活动开放后的变化。",
      "- 如果 repairPlan 点名了缺失热区、公告板、展示点或弹窗名称，必须逐字补进 interactiveAreas 或 contentHotspots。",
    ].join("\n"),
    execute: async (state, persona, ctx, genreProfile) => {
      state.scene = await runSceneTool(persona, state.plan!, state.gameplay!, state.systems!, state.proposal!, state.iterationCount, buildCtx(state, ctx), state.repairPlan, state.scene, buildSceneRepairFocus(state.consistencyReport), genreProfile);
      return state.scene;
    },
  },

  ui_architecture_tool: {
    tool: "ui_architecture_tool",
    title: "UI 架构工具",
    summary: "Define HUD, order/task/event/build panels, and feedback surfaces.",
    phase: "experience",
    dependsOn: ["scene_design_tool", "system_design_tool"],
    html5Outputs: ["layoutConfig", "copywritingConfig", "interactionConfig"],
    concurrentWith: [],
    debugPhase: "工具",
    debugTitle: "UI架构工具",
    repairGuidance: [
      "ui_architecture_tool 修复重点：",
      "- buildModePanel 必须拆成 2 到 4 个离散元素。",
      "- feedbackLayer 必须覆盖订单完成、扩建完成、角色互动或活动触发中的至少 3 类反馈。",
      "- eventEntry 必须对应真实场景活动热区，不能虚构新入口。",
    ].join("\n"),
    execute: async (state, persona, ctx, genreProfile) => {
      state.ui = await runUiTool(persona, state.plan!, state.systems!, state.scene!, state.iterationCount, buildCtx(state, ctx), state.repairPlan, genreProfile, state.ui);
      return state.ui;
    },
  },

  story_tool: {
    tool: "story_tool",
    title: "剧情工具",
    summary: "Define story positioning, world summary, character roster, and chapter anchors.",
    phase: "experience",
    dependsOn: ["proposal_tool", "system_design_tool"],
    html5Outputs: ["copywritingConfig", "timelineConfig"],
    concurrentWith: ["scene_design_tool"],
    debugPhase: "工具",
    debugTitle: "剧情工具",
    repairGuidance: [
      "story_tool 修复重点：",
      "- characterRoster 只能是纯角色名数组。",
      "- 每个角色名都必须在 mainPlotBeats 或 chapterAnchors 中逐字出现。",
      "- chapterAnchors 要可直接复用到角色卡锚点、活动插图和页面文案。",
      "- 配角不能只停留在功能说明层，必须在 chapterAnchors 或 mainPlotBeats 中获得明确事件职责与情感动机。",
      "- 如果上一轮失败是角色卡锚点失效，本轮优先修 story 自身的锚点设计，不要让下游继续发明新事件标题。",
    ].join("\n"),
    execute: async (state, persona, ctx, _gp) => {
      state.story = await runStoryTool(persona, state.plan!, state.proposal!, state.systems!, state.iterationCount, buildCtx(state, ctx), state.repairPlan, state.story);
      return state.story;
    },
  },

  character_tool: {
    tool: "character_tool",
    title: "角色工具",
    summary: "Define character cards, interaction roles, story anchors, and visual keywords.",
    phase: "experience",
    dependsOn: ["story_tool", "system_design_tool"],
    html5Outputs: ["layoutConfig", "copywritingConfig", "timelineConfig"],
    concurrentWith: [],
    debugPhase: "工具",
    debugTitle: "角色工具",
    repairGuidance: [
      "character_tool 修复重点：",
      "- cards 数量必须与 story.characterRoster 一致，name 必须逐字复用。",
      "- characterRoster 里出现的每个角色都必须有资料卡，不能遗漏团团、小桃、阿竹这类具体角色名。",
      "- interactionResponsibility 与 collectionValue 不能写成空泛短词，必须说明职责与可收集收益。",
      "- storyAnchors 只能引用 story.chapterAnchors 或 mainPlotBeats 中已存在的完整锚点句子，绝不能填角色名。",
      "- storyAnchors 优先直接复用 story.chapterAnchors 原句；如果 story 里没有对应锚点，说明应回到 story_tool 修正，而不是在角色卡里自造新标题。",
    ].join("\n"),
    execute: async (state, persona, ctx, _gp) => {
      state.characterCards = await runCharacterTool(persona, state.plan!, state.systems!, state.story!, state.iterationCount, buildCtx(state, ctx), state.repairPlan, state.characterCards);
      return state.characterCards;
    },
  },

  asset_manifest_tool: {
    tool: "asset_manifest_tool",
    title: "资产清单工具",
    summary: "Define production-grade assets, export rules, layer rules, and priority order.",
    phase: "rendering",
    dependsOn: ["proposal_tool", "economy_tool", "scene_design_tool", "ui_architecture_tool", "story_tool", "character_tool"],
    html5Outputs: ["assetManifest", "layoutConfig", "lightingRenderConfig"],
    concurrentWith: [],
    debugPhase: "工具",
    debugTitle: "资产清单工具",
    repairGuidance: [
      "asset_manifest_tool 修复重点：",
      "- 必须覆盖 UI 中真实存在的活动入口、活动卡片、扩建确认面板、订单按钮图标等载体。",
      "- sourceDependencies 必须复用 scene/ui/story/character 中已有的真实名称，不能用抽象词替代。",
      "- 如果 repairPlan 点名缺失某个面板、图标、热点或展示点素材，这一轮必须逐字映射到 assetGroups 中。",
    ].join("\n"),
    execute: async (state, persona, ctx, _gp) => {
      state.assetManifest = await runAssetManifestTool(
        persona, state.plan!, state.proposal!, state.economy!, state.scene!, state.ui!, state.story!, state.characterCards!,
        state.iterationCount, buildCtx(state, ctx), state.repairPlan, state.assetManifest,
      );
      return state.assetManifest;
    },
  },

  copywriting_tool: {
    tool: "copywriting_tool",
    title: "文案工具",
    summary: "Generate page titles, panel titles, button labels, task copy, story-facing lines, and asset labels.",
    phase: "rendering",
    dependsOn: ["proposal_tool", "economy_tool", "scene_design_tool", "ui_architecture_tool", "story_tool", "character_tool", "asset_manifest_tool"],
    html5Outputs: ["copywritingConfig", "timelineConfig"],
    concurrentWith: [],
    debugPhase: "工具",
    debugTitle: "文案工具",
    repairGuidance: [
      "copywriting_tool 修复重点：",
      "- 只能复用现有角色名、场景热区名、UI target、资产名与经济挂点名。",
      "- sceneHints 要优先覆盖关键 interactiveAreas，并补足至少 2 个 contentHotspots；characterLines 要覆盖每个角色；eventEntryCopy 或 taskAndOrderCopy 要覆盖核心 chapterAnchors。",
      "- 关键剧情锚点要在文案里直接体现目标、奖励或情绪，不要只做泛化改写。",
      "- assetLabels 至少覆盖主摊位、订单按钮图标、活动 Banner、关键活动入口载体和每个核心角色展示名称。",
      "- 如果 repairPlan 点名了缺失热区、锚点、角色立绘或关键资产标签，就必须逐条补齐，并在 target 或 relatedEntity 中逐字复用这些名字。",
      "- relatedEntity 必须保持短而稳定；只写角色名、热区名、chapterAnchor、assetName 或 entityId，不要写整句说明。",
      "- 不要发明新的按钮名、活动名、资产名或角色名。",
      "- sceneHints.target 必须直接复用 scene.interactiveAreas 或 scene.contentHotspots 的原始名字，角色名只放在 text 或 relatedEntity 里。",
      "- 如果缺少\"角色立绘气泡热区\"或\"装扮按钮热区\"提示，本轮必须各补 1 条明确引导玩家操作与收益的文案。",
    ].join("\n"),
    execute: async (state, persona, ctx, _gp) => {
      state.copywriting = await runCopywritingTool(
        persona, state.plan!, state.proposal!, state.economy!, state.scene!, state.ui!, state.story!, state.characterCards!, state.assetManifest!,
        state.iterationCount, buildCtx(state, ctx), state.repairPlan, state.copywriting,
      );
      return state.copywriting;
    },
  },

  layout_tool: {
    tool: "layout_tool",
    title: "Layout 工具",
    summary: "Map scene, UI, character, and asset outputs into scene definitions, layout config, and interaction bindings.",
    phase: "html5_runtime",
    dependsOn: ["scene_design_tool", "ui_architecture_tool", "character_tool", "asset_manifest_tool"],
    html5Outputs: ["sceneDefinitions", "layoutConfig", "interactionConfig"],
    concurrentWith: [],
    debugPhase: "工具",
    debugTitle: "Layout 工具",
    repairGuidance: [
      "layout_tool 修复重点：",
      "- layout_tool 是纯推导工具，不调用 LLM。",
      "- 如果布局结果有问题，应先修正上游的场景、UI、角色或资产输出。",
    ].join("\n"),
    execute: async (state, persona, _ctx, _gp, creativePackBuilder) => {
      const creativePack = creativePackBuilder(state);
      if (!state.proposal || !creativePack) {
        throw new Error("layout_tool requires proposal and a complete creative pack.");
      }
      const { layoutConfig, interactionConfig, sceneDefinitions } = runLayoutTool(persona, state.proposal, creativePack);
      state.sceneDefinitions = sceneDefinitions;
      state.interactionConfig = interactionConfig;
      state.layoutConfig = layoutConfig;
      return { layoutConfig, interactionConfig, sceneDefinitions };
    },
  },

  timeline_tool: {
    tool: "timeline_tool",
    title: "Timeline 工具",
    summary: "Map story, copy, interaction, and layout outputs into runtime event sequences and timing payloads.",
    phase: "html5_runtime",
    dependsOn: ["story_tool", "copywriting_tool", "layout_tool"],
    html5Outputs: ["timelineConfig", "lightingRenderConfig"],
    concurrentWith: [],
    debugPhase: "工具",
    debugTitle: "Timeline 工具",
    repairGuidance: [
      "timeline_tool 修复重点：",
      "- timeline_tool 是纯推导工具，不调用 LLM。",
      "- 如果时间线结果有问题，应先修正上游的剧情、文案或布局输出。",
    ].join("\n"),
    execute: async (state, persona, _ctx, _gp, creativePackBuilder) => {
      const creativePack = creativePackBuilder(state);
      if (!state.proposal || !creativePack) {
        throw new Error("timeline_tool requires proposal and a complete creative pack.");
      }
      const { html5Projection, timelineConfig, lightingRenderConfig } = runTimelineTool(persona, state.proposal, creativePack);
      state.timelineConfig = timelineConfig;
      state.lightingRenderConfig = lightingRenderConfig;
      state.html5Preparation = html5Projection;
      return { timelineConfig, lightingRenderConfig, html5Projection };
    },
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Look up a single tool definition by name */
export function getToolDefinition(tool: ToolName): ToolDefinition {
  return TOOL_REGISTRY[tool];
}

/** Get repair guidance for a tool (used by structured-chat repair prompt) */
export function getRepairGuidance(stage: string): string {
  const def = TOOL_REGISTRY[stage as ToolName];
  if (def) return def.repairGuidance;

  // Fallback for non-registry stages (scene_design_patch_tool, etc.)
  if (stage === "scene_design_patch_tool") {
    return [
      "scene_design_patch_tool repair focus:",
      "- Return an additive patch only. Do not rewrite the full scene package.",
      "- Preserve valid baseline carriers and only append missing runtime entities, mappings, and building definitions.",
      "- For each missing entity, verify sceneEntities, zoneEntityMap, and buildingDefinitions together.",
      "- Reuse checker-named entityId, entityName, zoneName, slotName, and buildingId exactly when they are already valid identifiers.",
    ].join("\n");
  }

  return [
    `${stage} 修复重点：`,
    "- 只修复结构、字段缺失、字段类型与最小内容要求。",
    "- 保持现有任务目标和命名体系，不要额外扩展设计范围。",
  ].join("\n");
}

/**
 * Derive a ToolExecutionConfig-compatible view from the registry.
 * This enables backward compatibility with existing code that uses TOOL_EXECUTION_CONFIG.
 */
export function getToolExecutionConfig(tool: ToolName): ToolExecutionConfig {
  const def = TOOL_REGISTRY[tool];
  return {
    tool: def.tool,
    title: def.title,
    summary: def.summary,
    phase: def.phase,
    dependsOn: def.dependsOn,
    html5Outputs: def.html5Outputs,
    concurrentWith: def.concurrentWith,
  };
}

/**
 * Build all tool executors from the registry — replaces hand-written closures.
 * Each executor calls the tool's `execute()` with the proper context.
 */
export function buildToolExecutorsFromRegistry(
  state: MainAgentState,
  persona: PersonaInput,
  ctx: ToolExecuteContext,
  creativePackBuilder: (s: MainAgentState) => CreativePack | null,
): Record<ToolName, () => Promise<unknown>> {
  const genreProfile = getGenreProfile(persona.targetGenre);
  const entries = Object.entries(TOOL_REGISTRY) as [ToolName, ToolDefinition][];
  return Object.fromEntries(
    entries.map(([name, def]) => [
      name,
      () => def.execute(state, persona, ctx, genreProfile, creativePackBuilder),
    ]),
  ) as Record<ToolName, () => Promise<unknown>>;
}
