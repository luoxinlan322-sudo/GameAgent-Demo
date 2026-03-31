import { zodResponseFormat } from "openai/helpers/zod";
import type OpenAI from "openai";
import { type ZodType } from "zod";
import { startObservation, type LangfuseObservation } from "@langfuse/tracing";
import { createDebugLog, finalizeDebugLog, type DebugLogEntry } from "../debug-log";
import { isLangfuseEnabled } from "../langfuse";
import { normalizeValueForSchema } from "./field-normalizers";
import { cleanupStageSpecificData } from "./stage-cleanup";
import { validateStageSemanticReadiness } from "./stage-validation";

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

export function stageRepairGuidance(stage: string) {
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
  attemptNumber: number;
  repairLimit: number;
}) {
  const sceneDesignAddendum =
    params.stage === "scene_design_tool" || params.stage === "scene_design_patch_tool"
      ? "6. For scene repair, preserve valid carriers and only add the missing runtime entities. Reuse checker-named entityId/entityName values exactly, and fill sceneEntities, zoneEntityMap, and buildingDefinitions together."
      : null;
  const urgency = params.attemptNumber >= params.repairLimit
    ? `⚠ 这是最后一次修复机会（第 ${params.attemptNumber}/${params.repairLimit} 次）。如果这次仍然不通过，工具将被标记为失败。请精确定位错误并修复。`
    : `修复尝试 ${params.attemptNumber}/${params.repairLimit}。`;
  // Truncate rawContent to avoid blowing up the context window
  const truncatedRaw = params.rawContent && params.rawContent.length > 6000
    ? params.rawContent.slice(0, 6000) + "\n... (truncated)"
    : params.rawContent;
  return [
    `你刚才输出的 ${params.schemaName} 未通过校验。${urgency}`,
    "",
    "修复规则：",
    "1. 只返回一个合法 JSON 对象，不要输出任何解释文字。",
    "2. 保持所有字段名不变。",
    "3. 精确修复校验错误指出的问题（缺字段、类型错误、长度不够、枚举不合法等）。不要改变其他已正确的内容。",
    `3.1 ${stageRepairGuidance(params.stage)}`,
    "",
    `校验错误（请逐条解决）：`,
    params.validationError,
    "",
    `上一次输出：`,
    truncatedRaw ?? "无",
    ...(sceneDesignAddendum ? ["", sceneDesignAddendum] : []),
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

function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("超时") || msg.includes("timeout") || msg.includes("econnreset") ||
    msg.includes("econnrefused") || msg.includes("socket hang up") || msg.includes("network") ||
    msg.includes("fetch failed") || msg.includes("aborted");
}

async function callWithTimeoutRetry<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  maxRetries: number,
  stage: string,
): Promise<T> {
  let lastError: Error | null = null;
  for (let retry = 0; retry <= maxRetries; retry += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => reject(new Error("请求超时")), { once: true });
        }),
      ]);
      clearTimeout(timer);
      return result;
    } catch (error) {
      clearTimeout(timer);
      controller.abort();
      const wrapped = error instanceof Error ? error : new Error(String(error));
      lastError = wrapped;
      if (!isTransientError(wrapped) || retry >= maxRetries) {
        throw wrapped;
      }
      const delayMs = Math.min(1000 * Math.pow(2, retry), 15000) + Math.random() * 1000;
      console.warn(`[callWithTimeoutRetry] ${stage} 第 ${retry + 1}/${maxRetries} 次超时重试，等待 ${Math.round(delayMs)}ms…`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError ?? new Error("请求超时");
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
  const maxTimeoutRetries = Number(process.env.LLM_TIMEOUT_RETRIES || "2");

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
        completion = await callWithTimeoutRetry(
          () =>
            createCompletion(client, {
              model,
              messages: currentMessages,
              mode,
              schema: schema as ZodType<unknown>,
              schemaName,
              extraBody,
            }),
          effectiveTimeoutMs,
          maxTimeoutRetries,
          stage,
        );

        const extracted = extractPayloadFromCompletion(mode, completion);
        rawContent = extracted.rawContent;
        const rawJson = extractFirstJsonObject(rawContent);
        normalizedJson = cleanupStageSpecificData(stage, normalizeValueForSchema(schema as ZodType<unknown>, rawJson), requestPayload);
        validateStageSemanticReadiness(stage, normalizedJson, requestPayload);
        const parsed = schema.parse(normalizedJson);
        const messageRecord = extracted.message as unknown as Record<string, unknown> | undefined;
        const reasoningRaw = messageRecord?.reasoning_content ?? messageRecord?.reasoning ?? null;
        const reasoningTrimmed = typeof reasoningRaw === "string" && reasoningRaw.length > 2000
          ? reasoningRaw.slice(0, 2000) + "…(truncated)"
          : reasoningRaw;

        finalizeDebugLog(logEntry, {
          rawContent,
          providerReasoning: reasoningTrimmed,
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
                attemptNumber: attempt + 1,
                repairLimit,
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
