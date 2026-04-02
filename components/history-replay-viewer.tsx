"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "./nav-bar";
import { ResultTabs } from "./result-tabs";
import type { ConsistencyReport, RepairPlan } from "@/lib/agent-consistency-schemas";
import type { Html5PreparationPackage } from "@/lib/html5-render-schemas";
import type {
  AgentPlan,
  CreativePack,
  Evaluation,
  GameProposal,
  PersonaInput,
  ReviewHistoryItem,
  ToolSelection,
} from "@/lib/schemas";

/* ── types ──────────────────────────────────── */

type StageTrace = {
  stage: string;
  label: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  message: string;
};

type Metrics = {
  totalDurationMs?: number;
  nodeCount?: number;
  llmNodeCount?: number;
  fallbackCount?: number;
  errorCount?: number;
  repairCount?: number;
  outputCompleteness?: number;
  runSuccess?: boolean;
};

type RunData = {
  sessionId: string;
  runId: string;
  stage: string;
  persona: PersonaInput;
  currentStep?: string;
  stageTimings?: StageTrace[];
  metrics?: Metrics;
  plan?: AgentPlan;
  toolSelection?: ToolSelection;
  proposal?: GameProposal;
  creativePack?: CreativePack;
  html5Preparation?: Html5PreparationPackage;
  consistencyReport?: ConsistencyReport;
  evaluation?: Evaluation;
  reviewHistory?: ReviewHistoryItem[];
  repairPlan?: RepairPlan;
  updatedAt: string;
  error?: string;
};

/* ── helpers ─────────────────────────────────── */

function formatDuration(ms?: number) {
  if (typeof ms !== "number") return "-";
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)} 分钟`;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} 秒` : `${ms}ms`;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function stageBadge(stage: string) {
  const map: Record<string, { label: string; tone: string }> = {
    done: { label: "完成", tone: "done" },
    error: { label: "异常", tone: "error" },
    generating: { label: "生成中", tone: "active" },
    planning: { label: "规划中", tone: "active" },
    evaluating: { label: "评估中", tone: "active" },
    idle: { label: "空闲", tone: "idle" },
  };
  return map[stage] ?? { label: stage, tone: "idle" };
}

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/* ── list view ───────────────────────────────── */

function HistoryList({ runs, loading }: { runs: RunData[]; loading: boolean }) {
  if (loading) {
    return (
      <section className="panel empty">
        <div className="empty-badge">加载中</div>
        <h2 className="panel-title">正在读取历史记录…</h2>
      </section>
    );
  }

  if (runs.length === 0) {
    return (
      <section className="panel empty">
        <div className="empty-badge">暂无记录</div>
        <h2 className="panel-title">还没有任何历史运行数据</h2>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          在工作台运行一次「生成并评审」后，记录将自动出现在这里。
        </p>
      </section>
    );
  }

  return (
    <div className="hist-run-grid">
      {runs.map((run) => {
        const badge = stageBadge(run.stage);
        const project = run.persona?.projectCode ?? run.runId.slice(-6);
        return (
          <Link
            key={run.runId}
            href={`/history?runId=${run.runId}`}
            className="hist-run-card"
          >
            <div className="hist-run-card-head">
              <span className="hist-run-project">{project}</span>
              <span className={`hist-badge is-${badge.tone}`}>{badge.label}</span>
            </div>
            <div className="hist-run-meta">
              <span>{formatTime(run.updatedAt)}</span>
              {run.metrics?.totalDurationMs != null && (
                <span>耗时 {formatDuration(run.metrics.totalDurationMs)}</span>
              )}
              {run.metrics?.outputCompleteness != null && (
                <span>完整度 {Math.round(run.metrics.outputCompleteness * 100)}%</span>
              )}
            </div>
            <div className="hist-run-id">{run.runId}</div>
          </Link>
        );
      })}
    </div>
  );
}

/* ── detail: execution console tab ───────────── */

function ExecutionConsole({ run }: { run: RunData }) {
  const metrics = run.metrics;
  const stageTimings = run.stageTimings ?? [];
  const consistency = run.consistencyReport;
  const reviewHistory = run.reviewHistory ?? [];

  return (
    <div className="hist-exec">
      {/* Metrics overview */}
      {metrics && (
        <div className="result-metric-grid">
          <div className="result-metric-card">
            <div className="result-metric-label">总耗时</div>
            <div className="result-metric-value">{formatDuration(metrics.totalDurationMs)}</div>
          </div>
          <div className="result-metric-card">
            <div className="result-metric-label">节点数</div>
            <div className="result-metric-value">{metrics.nodeCount ?? "-"}</div>
          </div>
          <div className="result-metric-card">
            <div className="result-metric-label">LLM 调用</div>
            <div className="result-metric-value">{metrics.llmNodeCount ?? "-"}</div>
          </div>
          <div className="result-metric-card">
            <div className="result-metric-label">回退次数</div>
            <div className="result-metric-value">{metrics.fallbackCount ?? 0}</div>
          </div>
          <div className="result-metric-card">
            <div className="result-metric-label">异常次数</div>
            <div className="result-metric-value">{metrics.errorCount ?? 0}</div>
          </div>
          <div className="result-metric-card">
            <div className="result-metric-label">修复轮数</div>
            <div className="result-metric-value">{metrics.repairCount ?? 0}</div>
          </div>
          <div className="result-metric-card">
            <div className="result-metric-label">输出完整度</div>
            <div className="result-metric-value">
              {metrics.outputCompleteness != null
                ? `${Math.round(metrics.outputCompleteness * 100)}%`
                : "-"}
            </div>
          </div>
          <div className="result-metric-card">
            <div className="result-metric-label">运行结果</div>
            <div className="result-metric-value">
              {metrics.runSuccess === true
                ? "✓ 成功"
                : metrics.runSuccess === false
                  ? "✕ 失败"
                  : "-"}
            </div>
          </div>
        </div>
      )}

      {/* Stage timings */}
      {stageTimings.length > 0 && (
        <section className="summary-box section-box">
          <p className="kicker">阶段耗时</p>
          <div className="hist-timing-list">
            {stageTimings.map((item, i) => (
              <div className="hist-timing-row" key={`${item.stage}-${item.label}-${i}`}>
                <span className="hist-timing-label">{item.label}</span>
                <span className="hist-timing-dur">{formatDuration(item.durationMs)}</span>
                <span className="hist-timing-msg">{item.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Consistency report */}
      {consistency && (
        <section className="summary-box section-box">
          <p className="kicker">一致性检查报告</p>
          <div className="status-strip" style={{ marginBottom: 12 }}>
            <span className={`pill${consistency.globalPass ? "" : " pill-warn"}`}>
              全局通过: {consistency.globalPass ? "是" : "否"}
            </span>
            <span className="pill">
              硬失败: {consistency.hardFailures?.length ?? 0}
            </span>
            <span className="pill">
              软警告: {consistency.softWarnings?.length ?? 0}
            </span>
            <span className="pill">
              已通过: {consistency.passedEdges?.length ?? 0}
            </span>
          </div>
          {consistency.summary && (
            <p style={{ color: "var(--muted)", marginBottom: 12 }}>{consistency.summary}</p>
          )}
          {(consistency.hardFailures?.length ?? 0) > 0 && (
            <div className="hist-timing-list">
              {consistency.hardFailures.map((edge) => (
                <div className="hist-timing-row" key={edge.edgeId}>
                  <span className="hist-timing-label pill-warn">{edge.edgeId}</span>
                  <span className="hist-timing-msg">
                    {edge.issues?.join(" / ") ?? ""}
                  </span>
                </div>
              ))}
            </div>
          )}
          {(consistency.softWarnings?.length ?? 0) > 0 && (
            <div className="hist-timing-list" style={{ marginTop: 8 }}>
              {consistency.softWarnings.map((edge) => (
                <div className="hist-timing-row" key={edge.edgeId}>
                  <span className="hist-timing-label" style={{ color: "var(--warning)" }}>{edge.edgeId}</span>
                  <span className="hist-timing-msg">
                    {edge.issues?.join(" / ") ?? ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Review history */}
      {reviewHistory.length > 0 && (
        <section className="summary-box section-box">
          <p className="kicker">评审历史</p>
          <div className="hist-timing-list">
            {reviewHistory.map((item) => (
              <div className="hist-timing-row" key={`review-${item.round}`}>
                <span className="hist-timing-label">第 {item.round} 轮</span>
                <span className="pill">{item.decision}</span>
                <span className="hist-timing-dur">{item.score} 分</span>
                <span className="hist-timing-msg">
                  {item.returned
                    ? `返修：${item.returnReasons?.join("、") ?? ""}`
                    : "未返修"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Repair plan */}
      {run.repairPlan && (
        <section className="summary-box section-box">
          <p className="kicker">修复计划</p>
          <pre className="history-pre">{pretty(run.repairPlan)}</pre>
        </section>
      )}

      {/* Tool selection */}
      {run.toolSelection && (
        <section className="summary-box section-box">
          <p className="kicker">工具选择</p>
          <pre className="history-pre">{pretty(run.toolSelection)}</pre>
        </section>
      )}

      {/* Error */}
      {run.error && (
        <section className="summary-box section-box" style={{ borderColor: "var(--danger)" }}>
          <p className="kicker" style={{ color: "var(--danger)" }}>错误信息</p>
          <pre className="history-pre" style={{ color: "var(--danger)" }}>
            {run.error}
          </pre>
        </section>
      )}
    </div>
  );
}

/* ── detail view ─────────────────────────────── */

type DetailTab = "report" | "console";

function HistoryDetail({ run }: { run: RunData }) {
  const [activeTab, setActiveTab] = useState<DetailTab>("report");
  const project = run.persona?.projectCode ?? run.runId.slice(-6);
  const badge = stageBadge(run.stage);

  return (
    <>
      <div className="hist-detail-head">
        <Link href="/history" className="hist-back-link">
          ← 返回列表
        </Link>
        <div className="hist-detail-title-row">
          <h2 className="panel-title" style={{ margin: 0 }}>
            {project}
          </h2>
          <span className={`hist-badge is-${badge.tone}`}>{badge.label}</span>
          <span className="hist-run-id" style={{ marginLeft: "auto" }}>
            {run.runId}
          </span>
        </div>
        <div className="status-strip">
          <span className="pill">session: {run.sessionId}</span>
          <span className="pill">{formatTime(run.updatedAt)}</span>
          {run.metrics?.totalDurationMs != null && (
            <span className="pill">
              耗时 {formatDuration(run.metrics.totalDurationMs)}
            </span>
          )}
        </div>
      </div>

      <div className="tab-row hist-detail-tabs">
        <button
          type="button"
          className={`tab-button${activeTab === "report" ? " is-active" : ""}`}
          onClick={() => setActiveTab("report")}
        >
          历史报告
        </button>
        <button
          type="button"
          className={`tab-button${activeTab === "console" ? " is-active" : ""}`}
          onClick={() => setActiveTab("console")}
        >
          执行台
        </button>
      </div>

      {activeTab === "report" ? (
        <ResultTabs
          persona={run.persona}
          plan={run.plan ?? null}
          proposal={run.proposal ?? null}
          creativePack={run.creativePack ?? null}
          html5Preparation={run.html5Preparation ?? null}
          evaluation={run.evaluation ?? null}
          reviewHistory={run.reviewHistory ?? []}
        />
      ) : (
        <ExecutionConsole run={run} />
      )}
    </>
  );
}

/* ── main export ─────────────────────────────── */

export function HistoryReplayViewer({ runId }: { runId: string }) {
  const [runs, setRuns] = useState<RunData[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);

  const isDetail = Boolean(runId);

  useEffect(() => {
    let stopped = false;

    async function load() {
      try {
        if (isDetail) {
          const res = await fetch(
            `/api/runs?runId=${encodeURIComponent(runId)}`,
            { cache: "no-store" },
          );
          const json = await res.json();
          if (!stopped) {
            setSelectedRun(json.run || null);
            setLoading(false);
          }
        } else {
          const res = await fetch("/api/runs", { cache: "no-store" });
          const json = await res.json();
          if (!stopped) {
            setRuns(json.runs || []);
            setLoading(false);
          }
        }
      } catch {
        if (!stopped) setLoading(false);
      }
    }

    load();
    return () => {
      stopped = true;
    };
  }, [runId, isDetail]);

  /* ── list view ── */
  if (!isDetail) {
    return (
      <main className="shell">
        <section className="hero hero-minimal">
          <h1>历史回放</h1>
          <NavBar />
        </section>
        <HistoryList runs={runs} loading={loading} />
      </main>
    );
  }

  /* ── detail: loading / not found ── */
  if (loading) {
    return (
      <main className="shell">
        <section className="hero hero-minimal">
          <h1>历史回放</h1>
          <NavBar />
        </section>
        <section className="panel empty">
          <div className="empty-badge">加载中</div>
        </section>
      </main>
    );
  }

  if (!selectedRun) {
    return (
      <main className="shell">
        <section className="hero hero-minimal">
          <h1>历史回放</h1>
          <NavBar />
        </section>
        <section className="panel empty">
          <div className="empty-badge">未找到</div>
          <h2 className="panel-title">Run {runId} 不存在</h2>
          <Link href="/history" style={{ color: "var(--accent)" }}>
            ← 返回历史列表
          </Link>
        </section>
      </main>
    );
  }

  /* ── detail: render ── */
  return (
    <main className="shell">
      <section className="hero hero-minimal">
        <h1>历史回放</h1>
        <NavBar />
      </section>
      <HistoryDetail run={selectedRun} />
    </main>
  );
}
