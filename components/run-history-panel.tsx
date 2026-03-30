"use client";

import { useEffect, useState } from "react";

type RunItem = {
  sessionId: string;
  runId: string;
  stage: string;
  currentStep?: string;
  updatedAt: string;
};

type RunHistoryPanelProps = {
  compact?: boolean;
};

export function RunHistoryPanel({ compact = false }: RunHistoryPanelProps) {
  const [runs, setRuns] = useState<RunItem[]>([]);

  useEffect(() => {
    let stopped = false;

    async function load() {
      try {
        const res = await fetch("/api/runs", { cache: "no-store" });
        const json = await res.json();
        if (!stopped) {
          setRuns(json.runs || []);
        }
      } catch {
        if (!stopped) {
          setRuns([]);
        }
      }
    }

    load();
    const timer = window.setInterval(load, 4000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  if (compact) {
    return (
      <div className="history-compact">
        <div className="history-compact-head">
          <span className="topbar-label">历史回放</span>
          <a className="history-compact-link" href="/history">
            查看全部
          </a>
        </div>
        <div className="history-compact-list">
          {runs.length === 0 ? (
            <span className="history-compact-empty">暂无记录</span>
          ) : (
            runs.slice(0, 3).map((run) => (
              <a className="history-compact-item" href={`/history?runId=${run.runId}`} key={run.runId}>
                <span className="history-compact-run">{run.runId.slice(-6)}</span>
                <span className="pill">{run.stage}</span>
              </a>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="panel card history-panel">
      <div className="panel-head">
        <span className="panel-tag">运行历史</span>
        <h2 className="panel-title">Session / Run 回放</h2>
      </div>

      <div className="history-list">
        {runs.length === 0 ? (
          <div className="summary-box">暂无历史运行记录</div>
        ) : (
          runs.map((run) => (
            <a className="history-item" href={`/history?runId=${run.runId}`} key={run.runId}>
              <div className="history-item-head">
                <strong>{run.runId}</strong>
                <span className="pill">{run.stage}</span>
              </div>
              <div className="history-meta">session: {run.sessionId}</div>
              <div className="history-meta">{run.currentStep || "无步骤说明"}</div>
              <div className="history-meta">{run.updatedAt}</div>
            </a>
          ))
        )}
      </div>
    </section>
  );
}
