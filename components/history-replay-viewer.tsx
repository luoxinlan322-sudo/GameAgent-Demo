"use client";

import { useEffect, useState } from "react";
import type { ConsistencyReport, RepairPlan } from "@/lib/agent-consistency-schemas";
import type { Html5PreparationPackage } from "@/lib/html5-render-schemas";
import type { ReviewHistoryItem, ToolSelection } from "@/lib/schemas";

type StageTrace = {
  stage: string;
  label: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  message: string;
};

type RunData = {
  sessionId: string;
  runId: string;
  stage: string;
  currentStep?: string;
  stageTimings?: StageTrace[];
  plan?: unknown;
  toolSelection?: ToolSelection;
  proposal?: unknown;
  creativePack?: unknown;
  html5Preparation?: Html5PreparationPackage;
  consistencyReport?: ConsistencyReport;
  evaluation?: unknown;
  reviewHistory?: ReviewHistoryItem[];
  repairPlan?: RepairPlan;
  updatedAt: string;
  error?: string;
};

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDuration(value?: number) {
  if (typeof value !== "number") return "-";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

export function HistoryReplayViewer({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunData | null>(null);

  useEffect(() => {
    let stopped = false;

    async function load() {
      if (!runId) {
        setRun(null);
        return;
      }
      const res = await fetch(`/api/runs?runId=${runId}`, { cache: "no-store" });
      const json = await res.json();
      if (!stopped) setRun(json.run || null);
    }

    load();
    return () => {
      stopped = true;
    };
  }, [runId]);

  if (!runId) {
    return (
      <main className="shell">
        <section className="panel empty">
          <h2 className="panel-title">Missing runId</h2>
        </section>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="shell">
        <section className="panel empty">
          <h2 className="panel-title">Run not found</h2>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel card">
        <div className="panel-head">
          <span className="panel-tag">History Replay</span>
          <h1 className="panel-title">{run.runId}</h1>
        </div>

        <div className="status-strip">
          <span className="pill">session: {run.sessionId}</span>
          <span className="pill">stage: {run.stage}</span>
          <span className="pill">currentStep: {run.currentStep || "-"}</span>
          <span className="pill">updatedAt: {run.updatedAt}</span>
        </div>

        <div className="summary-box section-box" style={{ marginBottom: 18 }}>
          <p className="kicker">Stage timings</p>
          {(run.stageTimings || []).length > 0 ? (
            <ul className="list">
              {(run.stageTimings || []).map((item) => (
                <li key={`${item.stage}-${item.label}-${item.startedAt}`}>
                  {item.label}: {formatDuration(item.durationMs)} / {item.message}
                </li>
              ))}
            </ul>
          ) : (
            <p>No stage timing data.</p>
          )}
        </div>

        <div className="history-replay-grid">
          <section className="summary-box section-box">
            <p className="kicker">Plan</p>
            <pre className="history-pre">{pretty(run.plan || null)}</pre>
          </section>
          <section className="summary-box section-box">
            <p className="kicker">Tool selection</p>
            <pre className="history-pre">{pretty(run.toolSelection || null)}</pre>
          </section>
          <section className="summary-box section-box">
            <p className="kicker">Proposal</p>
            <pre className="history-pre">{pretty(run.proposal || null)}</pre>
          </section>
          <section className="summary-box section-box">
            <p className="kicker">Creative pack</p>
            <pre className="history-pre">{pretty(run.creativePack || null)}</pre>
          </section>
          <section className="summary-box section-box">
            <p className="kicker">Consistency report</p>
            <pre className="history-pre">{pretty(run.consistencyReport || null)}</pre>
          </section>
          <section className="summary-box section-box">
            <p className="kicker">Repair plan</p>
            <pre className="history-pre">{pretty(run.repairPlan || null)}</pre>
          </section>
          <section className="summary-box section-box">
            <p className="kicker">Evaluation</p>
            <pre className="history-pre">{pretty(run.evaluation || run.error || null)}</pre>
          </section>
          <section className="summary-box section-box">
            <p className="kicker">Review history</p>
            <pre className="history-pre">{pretty(run.reviewHistory || [])}</pre>
          </section>
          <section className="summary-box section-box">
            <p className="kicker">HTML5 preparation</p>
            <pre className="history-pre">{pretty(run.html5Preparation || null)}</pre>
          </section>
        </div>
      </section>
    </main>
  );
}
