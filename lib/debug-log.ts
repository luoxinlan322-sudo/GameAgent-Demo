type DebugStage = "plan" | "generate" | "evaluate";

export type DebugLogEntry = {
  id: string;
  stage: DebugStage | string;
  runId?: string;
  sessionId?: string;
  iteration?: number;
  phase?: string;
  title?: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  model: string;
  baseURL?: string;
  requestPayload: unknown;
  rawResponse?: unknown;
  rawContent?: string | null;
  providerReasoning?: unknown;
  parsedResult?: unknown;
  fallbackUsed: boolean;
  error?: string;
  repairAttempts?: number;
  repairHistory?: Array<{
    attempt: number;
    error: string;
    rawContent?: string | null;
    normalizedResult?: unknown;
  }>;
};

declare global {
  var __gameAgentDebugLogs__: DebugLogEntry[] | undefined;
}

const MAX_LOGS = 50;

function getStore() {
  if (!globalThis.__gameAgentDebugLogs__) {
    globalThis.__gameAgentDebugLogs__ = [];
  }

  return globalThis.__gameAgentDebugLogs__;
}

export function createDebugLog(
  stage: DebugStage | string,
  model: string,
  baseURL: string | undefined,
  requestPayload: unknown,
  meta?: {
    runId?: string;
    sessionId?: string;
    iteration?: number;
    phase?: string;
    title?: string;
  },
) {
  const entry: DebugLogEntry = {
    id: `${stage}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stage,
    runId: meta?.runId,
    sessionId: meta?.sessionId,
    iteration: meta?.iteration,
    phase: meta?.phase,
    title: meta?.title,
    startedAt: new Date().toISOString(),
    model,
    baseURL,
    requestPayload,
    fallbackUsed: false,
  };

  const store = getStore();
  store.unshift(entry);
  if (store.length > MAX_LOGS) {
    store.length = MAX_LOGS;
  }

  return entry;
}

export function finalizeDebugLog(entry: DebugLogEntry, updates: Partial<DebugLogEntry>) {
  const endedAt = new Date().toISOString();
  entry.endedAt = endedAt;
  entry.durationMs = new Date(endedAt).getTime() - new Date(entry.startedAt).getTime();
  Object.assign(entry, updates);
}

export function listDebugLogs() {
  return getStore();
}

export function getLatestDebugLog(stage: string, runId?: string, iteration?: number) {
  return getStore().find(
    (entry) =>
      entry.stage === stage &&
      (runId ? entry.runId === runId : true) &&
      (typeof iteration === "number" ? entry.iteration === iteration : true),
  );
}

export function getLatestFinalizedDebugLog(stage: string, runId?: string, iteration?: number) {
  return getStore().find(
    (entry) =>
      entry.stage === stage &&
      Boolean(entry.endedAt) &&
      (runId ? entry.runId === runId : true) &&
      (typeof iteration === "number" ? entry.iteration === iteration : true),
  );
}
