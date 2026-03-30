import OpenAI from "openai";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  return apiKey
    ? new OpenAI({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
      })
    : null;
}

export function getModelName() {
  return process.env.OPENAI_MODEL || "qwen-plus";
}

export function getBaseURL() {
  return process.env.OPENAI_BASE_URL;
}

export function getProviderExtraBody() {
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const disableThinking = (process.env.QWEN_ENABLE_THINKING || "false").toLowerCase() !== "true";

  if (provider === "qwen") {
    return {
      enable_thinking: !disableThinking ? true : false,
    };
  }

  return undefined;
}
