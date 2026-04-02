import OpenAI from "openai";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  return apiKey
    ? new OpenAI({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
        // Disable SDK-level timeout & retries — our callWithTimeoutRetry handles these
        // to avoid double-timeout races and dangling promises.
        timeout: 10 * 60 * 1000, // 10 min (match LLM_TIMEOUT_MS default)
        maxRetries: 0,           // no SDK-level retry; our wrapper retries transient errors
      })
    : null;
}

export function getModelName() {
  return process.env.OPENAI_MODEL || "qwen-plus";
}

export function getBaseURL() {
  return process.env.OPENAI_BASE_URL;
}

/**
 * Returns provider-specific extra_body for the OpenAI-compatible API.
 *
 * When `LLM_PROVIDER=qwen` and `QWEN_ENABLE_THINKING=true`:
 *   - If `QWEN_THINKING_STAGES` is unset or `*`, all stages get thinking.
 *   - Otherwise only the comma-separated stage names listed get thinking enabled.
 *
 * @param stage  Optional stage name used to decide per-stage thinking.
 */
export function getProviderExtraBody(stage?: string) {
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const thinkingEnabled = (process.env.QWEN_ENABLE_THINKING || "false").toLowerCase() === "true";

  if (provider === "qwen") {
    let enableThinking = false;

    if (thinkingEnabled) {
      const stagesRaw = (process.env.QWEN_THINKING_STAGES || "*").trim();
      if (stagesRaw === "*" || !stage) {
        enableThinking = true;
      } else {
        const allowedStages = new Set(stagesRaw.split(",").map((s) => s.trim()).filter(Boolean));
        enableThinking = allowedStages.has(stage);
      }
    }

    return { enable_thinking: enableThinking };
  }

  return undefined;
}
