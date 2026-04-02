import { zodResponseFormat } from "openai/helpers/zod";
import type OpenAI from "openai";
import { APIConnectionError, APIConnectionTimeoutError, RateLimitError, InternalServerError } from "openai";
import { type ZodType } from "zod";
import { startObservation, type LangfuseObservation } from "@langfuse/tracing";
import { createDebugLog, finalizeDebugLog, type DebugLogEntry } from "../debug-log";
import { isLangfuseEnabled } from "../langfuse";
import { normalizeValueForSchema } from "./field-normalizers";
import { cleanupStageSpecificData } from "./stage-cleanup";
import { validateStageSemanticReadiness } from "./stage-validation";
import { getRepairGuidance } from "../tool-registry";

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

/**
 * @deprecated Use getRepairGuidance from tool-registry directly.
 * Kept as a thin backward-compatible proxy.
 */
export function stageRepairGuidance(stage: string) {
  return getRepairGuidance(stage);
}

/**
 * Format a Zod / validation error into structured, field-level feedback.
 * Inspired by Claude Code's validateInput → field-level issue pattern.
 */
function formatStructuredValidationError(errorMessage: string): string {
  const lines = errorMessage.split("\n").filter(Boolean);
  const fieldIssues: string[] = [];
  const otherIssues: string[] = [];

  for (const line of lines) {
    if (/at\s+[«"']|path:|\.[\w]+/i.test(line)) {
      fieldIssues.push(`  - ${line.trim()}`);
    } else if (line.trim().length > 0) {
      otherIssues.push(`  - ${line.trim()}`);
    }
  }

  const sections: string[] = [];
  if (fieldIssues.length > 0) {
    sections.push(`字段级错误（共 ${fieldIssues.length} 项，请逐项修复）：\n${fieldIssues.join("\n")}`);
  }
  if (otherIssues.length > 0) {
    sections.push(`其他校验问题：\n${otherIssues.join("\n")}`);
  }
  return sections.length > 0 ? sections.join("\n\n") : errorMessage;
}

/**
 * Detect if repair attempts are stuck in a loop (same error pattern repeating).
 * Inspired by Claude Code's diminishing-returns circuit breaker.
 */
function detectRepairStagnation(repairHistory: Array<{ error: string }>): boolean {
  if (repairHistory.length < 2) return false;
  const lastTwo = repairHistory.slice(-2);
  const sig0 = lastTwo[0].error.slice(0, 200);
  const sig1 = lastTwo[1].error.slice(0, 200);
  return sig0 === sig1;
}

function createRepairPrompt(params: {
  stage: string;
  schemaName: string;
  validationError: string;
  rawContent: string | null;
  attemptNumber: number;
  repairLimit: number;
  repairHistory?: Array<{ error: string }>;
}) {
  const sceneDesignAddendum =
    params.stage === "scene_design_tool" || params.stage === "scene_design_patch_tool"
      ? "6. For scene repair, preserve valid carriers and only add the missing runtime entities. Reuse checker-named entityId/entityName values exactly, and fill sceneEntities, zoneEntityMap, and buildingDefinitions together."
      : null;
  const urgency = params.attemptNumber >= params.repairLimit
    ? `⚠ 这是最后一次修复机会（第 ${params.attemptNumber}/${params.repairLimit} 次）。如果这次仍然不通过，工具将被标记为失败。请精确定位错误并修复。`
    : `修复尝试 ${params.attemptNumber}/${params.repairLimit}。`;

  // Stagnation escalation: if the same error repeats, push the LLM harder (Claude Code pattern)
  const isStagnant = params.repairHistory && detectRepairStagnation(params.repairHistory);
  const stagnationHint = isStagnant
    ? "\n⚠ 上次修复未产生实质变化，相同错误重复出现。请换一种策略：重新审视整个输出结构而非只做局部调整。"
    : "";

  // Truncate rawContent to avoid blowing up the context window (Claude Code maxResultSizeChars)
  const truncatedRaw = params.rawContent && params.rawContent.length > 6000
    ? params.rawContent.slice(0, 6000) + "\n... (truncated)"
    : params.rawContent;

  // Structured error formatting for clearer field-level feedback
  const formattedError = formatStructuredValidationError(params.validationError);

  return [
    `你刚才输出的 ${params.schemaName} 未通过校验。${urgency}${stagnationHint}`,
    "",
    "修复规则：",
    "1. 只返回一个合法 JSON 对象，不要输出任何解释文字。",
    "2. 保持所有字段名不变。",
    "3. 精确修复校验错误指出的问题（缺字段、类型错误、长度不够、枚举不合法等）。不要改变其他已正确的内容。",
    `3.1 ${getRepairGuidance(params.stage)}`,
    "",
    `校验错误（请逐条解决）：`,
    formattedError,
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
  if (error instanceof APIConnectionError || error instanceof APIConnectionTimeoutError) return "network_error";
  if (error instanceof RateLimitError) return "rate_limit";
  if (error instanceof InternalServerError) return "server_error";
  const message = error.message.toLowerCase();
  if (message.includes("超时") || message.includes("timeout")) return "timeout";
  if (message.includes("connection error") || message.includes("econnreset") || message.includes("fetch failed")) return "network_error";
  if (message.includes("json")) return "json_parse_error";
  if (message.includes("zod") || message.includes("invalid") || message.includes("too_small") || message.includes("too_big")) {
    return "schema_validation_error";
  }
  if (message.includes("missing model client")) return "missing_model_client";
  return "node_execution_error";
}

function isTransientError(error: unknown): boolean {
  // OpenAI SDK typed errors: connection failure, timeout, rate limit, server error
  if (error instanceof APIConnectionError || error instanceof APIConnectionTimeoutError) return true;
  if (error instanceof RateLimitError) return true;
  if (error instanceof InternalServerError) return true;

  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("超时") || msg.includes("timeout") || msg.includes("econnreset") ||
    msg.includes("econnrefused") || msg.includes("socket hang up") || msg.includes("network") ||
    msg.includes("fetch failed") || msg.includes("aborted") ||
    msg.includes("connection error") || msg.includes("rate limit") ||
    msg.includes("502") || msg.includes("503") || msg.includes("504");
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
      // Keep a reference to fn() so we can catch its rejection if timeout wins
      const fnPromise = fn();
      const result = await Promise.race([
        fnPromise,
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => {
            // Swallow the dangling fn() rejection to prevent unhandled rejection crash
            fnPromise.catch(() => {});
            reject(new Error("请求超时"));
          }, { once: true });
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
      console.warn(`[callWithTimeoutRetry] ${stage} 第 ${retry + 1}/${maxRetries} 次瞬态错误重试，等待 ${Math.round(delayMs)}ms… (${wrapped.message.slice(0, 120)})`);
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
                repairHistory,
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
