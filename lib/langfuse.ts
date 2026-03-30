import { LangfuseClient } from "@langfuse/client";

export type AgentRuntimeMetrics = {
  totalDurationMs: number;
  nodeCount: number;
  llmNodeCount: number;
  fallbackCount: number;
  errorCount: number;
  repairCount: number;
  outputCompleteness: number;
  runSuccess: boolean;
};

let langfuseClient: LangfuseClient | null | undefined;

export function isLangfuseEnabled() {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

export function getLangfuseClient() {
  if (langfuseClient !== undefined) {
    return langfuseClient;
  }

  if (!isLangfuseEnabled()) {
    langfuseClient = null;
    return langfuseClient;
  }

  langfuseClient = new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
  });

  return langfuseClient;
}

export async function flushLangfuse() {
  const client = getLangfuseClient();
  if (!client) return;
  await client.flush();
}

export function createLangfuseScores(params: {
  traceId?: string;
  runId: string;
  sessionId: string;
  metrics: AgentRuntimeMetrics;
}) {
  const client = getLangfuseClient();
  if (!client || !params.traceId) return;

  const metadata = {
    runId: params.runId,
    sessionId: params.sessionId,
  };

  const score = (name: string, value: number, comment: string) =>
    client.score.create({
      traceId: params.traceId,
      name,
      value,
      comment,
      metadata,
    } as never);

  score("agent_total_duration_ms", params.metrics.totalDurationMs, "单次 Agent 运行总耗时");
  score("agent_node_count", params.metrics.nodeCount, "本次运行完成的节点数");
  score("agent_llm_node_count", params.metrics.llmNodeCount, "本次运行触发的 LLM 节点数");
  score("agent_fallback_count", params.metrics.fallbackCount, "本次运行触发的回退次数");
  score("agent_error_count", params.metrics.errorCount, "本次运行出现的错误次数");
  score("agent_repair_count", params.metrics.repairCount, "本次运行进入修缮规划的次数");
  score("agent_output_completeness", params.metrics.outputCompleteness, "关键输出完成度，范围 0-1");
  score("agent_run_success", params.metrics.runSuccess ? 1 : 0, "本次运行是否成功完成");
}
