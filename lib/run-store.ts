import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentRuntimeMetrics } from "./langfuse";
import type { Html5PreparationPackage } from "./html5-render-schemas";
import type { ConsistencyReport, RepairPlan } from "./agent-consistency-schemas";
import type { AgentPlan, CreativePack, Evaluation, GameProposal, PersonaInput, ReviewHistoryItem, ToolSelection } from "./schemas";

export type AgentStage = "idle" | "planning" | "generating" | "evaluating" | "done" | "error";

export type StageTrace = {
  stage: Exclude<AgentStage, "idle">;
  label: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  message: string;
};

export type RunSnapshot = {
  sessionId: string;
  runId: string;
  stage: AgentStage;
  persona: PersonaInput;
  traceId?: string;
  currentStep?: string;
  stageTimings: StageTrace[];
  metrics?: AgentRuntimeMetrics;
  plan?: AgentPlan;
  toolSelection?: ToolSelection;
  proposal?: GameProposal;
  creativePack?: CreativePack;
  html5Preparation?: Html5PreparationPackage;
  consistencyReport?: ConsistencyReport;
  evaluation?: Evaluation;
  reviewHistory?: ReviewHistoryItem[];
  repairPlan?: RepairPlan;
  error?: string;
  updatedAt: string;
};

declare global {
  var __gameAgentRuns__: Map<string, RunSnapshot> | undefined;
}

const STORE_PATH = join(process.cwd(), ".agent-runs.json");

function isCurrentReviewHistoryItem(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { round?: unknown }).round === "number" &&
      typeof (value as { returned?: unknown }).returned === "boolean" &&
      typeof (value as { decision?: unknown }).decision === "string" &&
      typeof (value as { score?: unknown }).score === "number",
  );
}

function isCurrentRunSnapshot(value: unknown): value is RunSnapshot {
  if (!value || typeof value !== "object") return false;

  const candidate = value as {
    runId?: unknown;
    sessionId?: unknown;
    updatedAt?: unknown;
    stage?: unknown;
    persona?: { projectCode?: unknown } | unknown;
    stageTimings?: unknown;
    reviewHistory?: unknown;
  };

  if (typeof candidate.runId !== "string" || typeof candidate.sessionId !== "string" || typeof candidate.updatedAt !== "string" || typeof candidate.stage !== "string") {
    return false;
  }

  const persona = candidate.persona && typeof candidate.persona === "object" ? (candidate.persona as { projectCode?: unknown }) : null;

  if (!persona || typeof persona.projectCode !== "string") {
    return false;
  }

  if (!Array.isArray(candidate.stageTimings)) {
    return false;
  }

  if (candidate.reviewHistory && (!Array.isArray(candidate.reviewHistory) || !candidate.reviewHistory.every(isCurrentReviewHistoryItem))) {
    return false;
  }

  return true;
}

function loadPersistedRuns() {
  try {
    if (!existsSync(STORE_PATH)) {
      return new Map<string, RunSnapshot>();
    }

    const raw = readFileSync(STORE_PATH, "utf8");
    const data = JSON.parse(raw) as unknown;
    const currentRuns = Array.isArray(data) ? data.filter(isCurrentRunSnapshot) : [];
    return new Map(currentRuns.map((item) => [item.runId, item]));
  } catch {
    return new Map<string, RunSnapshot>();
  }
}

function persistRuns(store: Map<string, RunSnapshot>) {
  try {
    writeFileSync(STORE_PATH, JSON.stringify(Array.from(store.values()), null, 2), "utf8");
  } catch {
    // ignore persistence failure for demo mode
  }
}

function getStore() {
  if (!globalThis.__gameAgentRuns__) {
    globalThis.__gameAgentRuns__ = loadPersistedRuns();
  } else {
    const persisted = loadPersistedRuns();
    if (persisted.size > globalThis.__gameAgentRuns__.size) {
      globalThis.__gameAgentRuns__ = persisted;
    }
  }

  return globalThis.__gameAgentRuns__;
}

export function createSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function upsertRun(snapshot: RunSnapshot) {
  const store = getStore();
  store.set(snapshot.runId, snapshot);
  persistRuns(store);
  return snapshot;
}

export function getRun(runId: string) {
  return getStore().get(runId);
}

export function listRuns() {
  return Array.from(getStore().values()).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
