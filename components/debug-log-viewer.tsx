"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AGENT_PHASES,
  getExecutionBatches,
  TOOL_EXECUTION_CONFIG,
} from "@/lib/agent-execution-config";
import { getConsistencyEdgeGuide } from "@/lib/consistency-graph";
import type { ConsistencyReport, RepairPlan } from "@/lib/agent-consistency-schemas";
import type { Html5PreparationPackage } from "@/lib/html5-render-schemas";
import type { ConsistencyEdgeId, ReviewHistoryItem, ToolSelection } from "@/lib/schemas";

type DebugLogEntry = {
  id: string;
  stage: string;
  runId?: string;
  sessionId?: string;
  iteration?: number;
  phase?: string;
  title?: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  model: string;
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

type AgentRuntimeMetrics = {
  totalDurationMs: number;
  nodeCount: number;
  llmNodeCount: number;
  fallbackCount: number;
  errorCount: number;
  repairCount: number;
  outputCompleteness: number;
  runSuccess: boolean;
};

type RunSnapshot = {
  sessionId: string;
  runId: string;
  traceId?: string;
  stage: string;
  currentStep?: string;
  updatedAt: string;
  metrics?: AgentRuntimeMetrics;
  consistencyReport?: ConsistencyReport;
  reviewHistory?: ReviewHistoryItem[];
  toolSelection?: ToolSelection;
  repairPlan?: RepairPlan;
  html5Preparation?: Html5PreparationPackage;
};

type RunGroup = {
  runId: string;
  sessionId?: string;
  traceId?: string;
  startedAt: string;
  snapshot?: RunSnapshot;
  logs: DebugLogEntry[];
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
  if (value >= 60_000) return `${(value / 60_000).toFixed(1)}m`;
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

function getNodeLabel(log: DebugLogEntry) {
  return log.title || TOOL_EXECUTION_CONFIG[log.stage as keyof typeof TOOL_EXECUTION_CONFIG]?.title || log.stage;
}

function groupByRun(logs: DebugLogEntry[], runs: RunSnapshot[]) {
  const map = new Map<string, RunGroup>();

  for (const log of logs) {
    const runId = log.runId || `legacy-${log.id}`;
    const current = map.get(runId) ?? {
      runId,
      sessionId: log.sessionId,
      startedAt: log.startedAt,
      logs: [],
    };
    current.logs.push(log);
    if (log.startedAt < current.startedAt) current.startedAt = log.startedAt;
    map.set(runId, current);
  }

  for (const run of runs) {
    const current = map.get(run.runId) ?? {
      runId: run.runId,
      sessionId: run.sessionId,
      startedAt: run.updatedAt,
      logs: [],
    };
    current.snapshot = run;
    current.traceId = run.traceId;
    current.sessionId = current.sessionId || run.sessionId;
    map.set(run.runId, current);
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      logs: [...group.logs].sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    }))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function getIterations(group: RunGroup) {
  return Array.from(
    new Set([
      ...group.logs.map((item) => item.iteration).filter((value): value is number => typeof value === "number"),
      ...(group.snapshot?.reviewHistory ?? []).map((item) => item.round),
    ]),
  ).sort((a, b) => a - b);
}

function getNodeStatus(log: DebugLogEntry) {
  if (log.error) return "error";
  if (log.fallbackUsed) return "fallback";
  if (!log.endedAt) return "running";
  return "done";
}

function summarizeFailure(log: DebugLogEntry) {
  return log.repairHistory?.[0]?.error || log.error || "\u672a\u8bb0\u5f55\u5230\u6821\u9a8c\u5931\u8d25\u539f\u56e0\u3002";
}

function summarizeFallback(log: DebugLogEntry) {
  if (!log.fallbackUsed) return "\u5f53\u524d\u8282\u70b9\u672a\u89e6\u53d1\u56de\u9000\u3002";
  return log.error || log.repairHistory?.[log.repairHistory.length - 1]?.error || "\u8282\u70b9\u81ea\u4fee\u590d\u540e\u4ecd\u672a\u901a\u8fc7\uff0c\u5df2\u89e6\u53d1\u56de\u9000\u3002";
}

function renderList(items: string[]) {
  if (items.length === 0) return <div className="debug-empty">暂无内容。</div>;
  return (
    <ul className="list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function getEdgeTaskMap(report?: ConsistencyReport) {
  return new Map((report?.repairTasks ?? []).map((task) => [task.edgeId, task]));
}

function ArchitecturePanel() {
  return (
    <section className="debug-card debug-card-wide">
      <h2>主 Agent 架构</h2>
      <div className="history-list">
        {AGENT_PHASES.map((phase) => {
          const phaseTools = phase.tools.map((tool) => TOOL_EXECUTION_CONFIG[tool]);
          return (
            <div className="summary-box section-box" key={phase.id}>
              <p className="kicker">
                {phase.title} / {phase.id}
              </p>
              <p>{phase.goal}</p>
              {phaseTools.length > 0 ? (
                <ul className="list">
                  {phaseTools.map((tool) => (
                    <li key={tool.tool}>
                      <strong>{tool.title}</strong>
                      {`\uff1a\u4f9d\u8d56 ${tool.dependsOn.length ? tool.dependsOn.join("\u3001") : "\u65e0"}\uff1b\u8f93\u51fa ${
                        tool.html5Outputs.length ? tool.html5Outputs.join("\u3001") : "\u65e0\u76f4\u63a5 HTML5 \u4ea7\u7269"
                      }\u3002`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>该阶段仅由主 Agent 完成规划与决策。</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MetricsPanel({ metrics, traceId }: { metrics?: AgentRuntimeMetrics; traceId?: string }) {
  if (!metrics) return <div className="debug-empty">当前还没有运行指标。</div>;

  const items = [
    { label: "\u603b\u8017\u65f6", value: formatDuration(metrics.totalDurationMs) },
    { label: "\u5b8c\u6210\u8282\u70b9\u6570", value: String(metrics.nodeCount) },
    { label: "LLM \u8282\u70b9\u6570", value: String(metrics.llmNodeCount) },
    { label: "\u56de\u9000\u6b21\u6570", value: String(metrics.fallbackCount) },
    { label: "\u5f02\u5e38\u6b21\u6570", value: String(metrics.errorCount) },
    { label: "\u8fd4\u4fee\u8f6e\u6570", value: String(metrics.repairCount) },
    { label: "\u8f93\u51fa\u5b8c\u6574\u5ea6", value: `${Math.round(metrics.outputCompleteness * 100)}%` },
    { label: "\u8fd0\u884c\u7ed3\u679c", value: metrics.runSuccess ? "\u901a\u8fc7" : "\u672a\u5b8c\u5168\u901a\u8fc7" },
  ];

  return (
    <section className="debug-card debug-card-wide">
      <h2>运行指标</h2>
      <div className="debug-meta">
        <span>{`Trace ID\uff1a${traceId || "\u672a\u63a5\u5165"}`}</span>
      </div>
      <div className="debug-metric-grid">
        {items.map((item) => (
          <div className="debug-metric-card" key={item.label}>
            <div className="debug-metric-label">{item.label}</div>
            <div className="debug-metric-value">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ToolSelectionPanel({ toolSelection }: { toolSelection?: ToolSelection }) {
  if (!toolSelection) return <div className="debug-empty">当前还没有工具选择结果。</div>;

  let batches: string[][] = [];
  try {
    batches = getExecutionBatches(toolSelection.toolQueue);
  } catch {
    batches = [];
  }

  return (
    <section className="debug-card debug-card-wide">
      <h2>工具选择与并发批次</h2>
      <div className="summary-box section-box">
        <p className="kicker">本轮目标</p>
        <p>{toolSelection.roundGoal}</p>
      </div>
      <div className="proposal-layout">
        <div className="summary-box section-box">
          <p className="kicker">工具队列</p>
          {renderList(toolSelection.toolQueue)}
        </div>
        <div className="summary-box section-box">
          <p className="kicker">调用原因</p>
          {renderList(toolSelection.callReasons)}
        </div>
      </div>
      <div className="summary-box section-box">
        <p className="kicker">并发执行批次</p>
        {batches.length > 0 ? (
          <ul className="list">
            {batches.map((batch, index) => (
              <li key={`${index}-${batch.join("-")}`}>
                {`\u7b2c ${index + 1} \u6279\uff1a${batch.join("\u3001")}`}
              </li>
            ))}
          </ul>
        ) : (
          <p>当前没有批次规划。</p>
        )}
      </div>
      <div className="summary-box section-box">
        <p className="kicker">模型批次提示</p>
        <ul className="list">
          {toolSelection.parallelBatches.map((batch) => (
            <li key={batch.batchName}>
              {`${batch.batchName}\uff1a${batch.tools.join("\u3001")} / ${batch.dependency}`}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ConsistencyReportPanel({ report }: { report?: ConsistencyReport }) {
  if (!report) return <div className="debug-empty">当前还没有一致性报告。</div>;

  return (
    <section className={`consistency-highlight ${report.globalPass ? "is-pass" : "is-fail"}`}>
      <div className="consistency-highlight-head">
        <div>
          <div className="panel-tag">一致性图</div>
          <h3>{report.summary}</h3>
        </div>
        <span className="pill">{report.globalPass ? "\u786c\u8fb9\u5df2\u5168\u90e8\u901a\u8fc7" : "\u4ecd\u6709\u786c\u8fb9\u5931\u8d25"}</span>
      </div>
      <div className="proposal-layout">
        <div className="summary-box section-box">
          <p className="kicker">硬失败边</p>
          {report.hardFailures.length > 0 ? (
            <ul className="list">
              {report.hardFailures.map((edge) => (
                <li key={edge.edgeId}>
                  <strong>{edge.edgeId}</strong>: {edge.issues.join(" / ")}
                </li>
              ))}
            </ul>
          ) : (
            <p>当前没有硬失败边。</p>
          )}
        </div>
        <div className="summary-box section-box">
          <p className="kicker">软警告边</p>
          {report.softWarnings.length > 0 ? (
            <ul className="list">
              {report.softWarnings.map((edge) => (
                <li key={edge.edgeId}>
                  <strong>{edge.edgeId}</strong>: {edge.issues.join(" / ")}
                </li>
              ))}
            </ul>
          ) : (
            <p>当前没有软警告边。</p>
          )}
        </div>
      </div>
      <div className="summary-box section-box">
        <p className="kicker">返修任务</p>
        {report.repairTasks.length > 0 ? (
          <ul className="list">
            {report.repairTasks.map((task) => (
              <li key={task.edgeId}>
                <strong>{task.edgeId}</strong>: {task.problemSummary}
                <div>{`\u5f71\u54cd\u539f\u56e0\uff1a${task.whyItMatters}`}</div>
                <div>{`\u901a\u8fc7\u6761\u4ef6\uff1a${task.successConditions.join(" / ")}`}</div>
                <div>{`\u4e25\u683c\u6807\u8bc6\u7b26\uff1a${task.strictIdentifiers.length ? task.strictIdentifiers.join("\u3001") : "\u65e0"}`}</div>
                <div>{`\u6d89\u53ca\u5de5\u5177\uff1a${task.candidateTools.join("\u3001")}`}</div>
                <div>{`\u9009\u62e9\u4f9d\u636e\uff1a${task.selectionGuidance.length ? task.selectionGuidance.join(" / ") : "\u65e0"}`}</div>
                <div>{`\u95ee\u9898\u4f4d\u7f6e\u63d0\u793a\uff1a${task.problemLocationHints.length ? task.problemLocationHints.map((hint) => `${hint.toolName}(${hint.confidence}): ${hint.reason}`).join(" / ") : "\u65e0"}`}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p>当前没有返修任务。</p>
        )}
      </div>
    </section>
  );
}

function RepairPlanPanel({ repairPlan }: { repairPlan?: RepairPlan }) {
  if (!repairPlan) return <div className="debug-empty">当前还没有返修计划。</div>;

  return (
    <section className="debug-card debug-card-wide">
      <h2>基于原因的返修计划</h2>
      <div className="summary-box section-box">
        <p className="kicker">返修理由</p>
        <p>{repairPlan.rationale}</p>
      </div>
      <div className="history-list">
        {repairPlan.selectedTargets.map((target) => (
          <div className="summary-box section-box" key={target.toolName}>
            <p className="kicker">{target.toolName}</p>
            <p>{target.whyThisTool}</p>
            <p>{`暂不选择其他工具：${target.whyNotOtherTargets}`}</p>
            <p>{`成本权衡：${target.costReasoning}`}</p>
            <p>{`\u9884\u671f\u5f71\u54cd\uff1a${target.expectedImpact.join(" / ")}`}</p>
            <p>{`\u590d\u68c0\u8fb9\uff1a${target.relatedTaskEdges.join("\u3001")}`}</p>
          </div>
        ))}
      </div>
      <div className="proposal-layout">
        <div className="summary-box section-box">
          <p className="kicker">停止条件</p>
          {renderList(repairPlan.stopConditions)}
        </div>
        <div className="summary-box section-box">
          <p className="kicker">本轮复检边</p>
          {renderList(repairPlan.recheckEdges)}
        </div>
      </div>
    </section>
  );
}

function Html5Panel({ html5Preparation }: { html5Preparation?: Html5PreparationPackage }) {
  if (!html5Preparation) return <div className="debug-empty">当前还没有 HTML5 交付包。</div>;

  const sceneCount = html5Preparation.sceneDefinitions.length;
  const assetCount = html5Preparation.assetManifest.assets.length;
  const copyCount = html5Preparation.copywritingConfig.items.length;
  const interactionCount = html5Preparation.interactionConfig.bindings.length;
  const timelineCount = html5Preparation.timelineConfig?.timelines.length ?? 0;

  return (
    <section className="debug-card debug-card-wide">
      <h2>HTML5 交付包</h2>
      <div className="debug-metric-grid">
        <div className="debug-metric-card">
          <div className="debug-metric-label">场景数</div>
          <div className="debug-metric-value">{sceneCount}</div>
        </div>
        <div className="debug-metric-card">
          <div className="debug-metric-label">资源数</div>
          <div className="debug-metric-value">{assetCount}</div>
        </div>
        <div className="debug-metric-card">
          <div className="debug-metric-label">文案条目</div>
          <div className="debug-metric-value">{copyCount}</div>
        </div>
        <div className="debug-metric-card">
          <div className="debug-metric-label">交互绑定</div>
          <div className="debug-metric-value">{interactionCount}</div>
        </div>
        <div className="debug-metric-card">
          <div className="debug-metric-label">时间线事件</div>
          <div className="debug-metric-value">{timelineCount}</div>
        </div>
      </div>
      <div className="proposal-layout">
        <div className="summary-box section-box">
          <p className="kicker">游戏配置</p>
          <pre className="history-pre">{pretty(html5Preparation.gameConfig)}</pre>
        </div>
        <div className="summary-box section-box">
          <p className="kicker">场景定义</p>
          <pre className="history-pre">{pretty(html5Preparation.sceneDefinitions)}</pre>
        </div>
        <div className="summary-box section-box">
          <p className="kicker">布局配置</p>
          <pre className="history-pre">{pretty(html5Preparation.layoutConfig)}</pre>
        </div>
        <div className="summary-box section-box">
          <p className="kicker">时间线配置</p>
          <pre className="history-pre">{pretty(html5Preparation.timelineConfig)}</pre>
        </div>
      </div>
    </section>
  );
}

function ReviewTracePanel({ history, report }: { history: ReviewHistoryItem[]; report?: ConsistencyReport }) {
  const taskMap = getEdgeTaskMap(report);

  return (
    <section className="debug-card debug-card-wide">
      <h2>评审返修轨迹</h2>
      {history.length === 0 ? (
        <div className="debug-empty">当前还没有评审历史。</div>
      ) : (
        <div className="review-trace-list">
          {history.map((item) => (
            <div className="review-round-card" key={`${item.round}-${item.decision}`}>
              <div className="review-round-head">
                <div>
                  <div className="panel-tag">{`\u7b2c ${item.round} \u8f6e`}</div>
                  <h3 className="review-round-title">{item.returned ? "\u9000\u56de\u8fd4\u4fee" : "\u901a\u8fc7\u8bc4\u5ba1"}</h3>
                </div>
                <div className="review-round-meta">
                  <span className="pill">{item.decision}</span>
                  <span className="pill">{`\u5206\u6570 ${item.score}`}</span>
                  <span className="pill">{item.returned ? "\u9700\u8981\u8fd4\u4fee" : "\u5df2\u63a5\u53d7"}</span>
                </div>
              </div>

              {item.repairRationale ? (
                <div className="summary-box section-box">
                  <p className="kicker">返修推理</p>
                  <p>{item.repairRationale}</p>
                </div>
              ) : null}

              {item.returnReasons.length > 0 ? (
                <div className="summary-box section-box">
                  <p className="kicker">退回原因</p>
                  {renderList(item.returnReasons)}
                </div>
              ) : null}

              {item.repairDirections.length > 0 ? (
                <div className="summary-box section-box">
                  <p className="kicker">返修方向</p>
                  {renderList(item.repairDirections)}
                </div>
              ) : null}

              <div className="summary-box section-box">
                <p className="kicker">实际选中的修复工具</p>
                {item.selectedRepairTools.length > 0 ? renderList(item.selectedRepairTools) : <p>本轮没有选择修复工具。</p>}
              </div>

              <div className="review-edge-grid">
                {item.failedEdges.length > 0 ? (
                  item.failedEdges.map((edgeId) => {
                    const guide = taskMap.get(edgeId) ?? getConsistencyEdgeGuide(edgeId as ConsistencyEdgeId);
                    return (
                      <div className="review-edge-card" key={`${item.round}-${edgeId}`}>
                        <div className="review-edge-head">
                          <strong>{edgeId}</strong>
                          <span className="history-meta">失败边</span>
                        </div>
                        <p className="review-edge-summary">{guide.problemSummary}</p>
                        <div className="review-edge-block">
                          <div className="review-edge-label">为什么重要</div>
                          <p>{guide.whyItMatters}</p>
                        </div>
                        <div className="review-edge-block">
                          <div className="review-edge-label">通过条件</div>
                          {renderList(guide.successConditions)}
                        </div>
                        {"strictIdentifiers" in guide && Array.isArray(guide.strictIdentifiers) && guide.strictIdentifiers.length > 0 ? (
                          <div className="review-edge-block">
                            <div className="review-edge-label">严格标识符</div>
                            <p>{guide.strictIdentifiers.join(" / ")}</p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="debug-empty">本轮没有失败边。</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function IterationTimeline({ logs }: { logs: DebugLogEntry[] }) {
  return (
    <div className="debug-stage-list">
      {logs.map((log) => (
        <section className="debug-stage-card" key={log.id}>
          <div className="debug-stage-head">
            <div>
              <div className="debug-stage-title">{getNodeLabel(log)}</div>
              <div className="debug-stage-subtitle">
                {`${log.phase || "\u9636\u6bb5\u672a\u77e5"} / ${log.model}`}
              </div>
            </div>
            <div className="debug-stage-summary">
              <span className="debug-badge">{getNodeStatus(log)}</span>
              <span>{formatDuration(log.durationMs)}</span>
            </div>
          </div>
          <div className="debug-stage-items">
            <div className="debug-stage-item">
              <div className="debug-stage-item-head">
                <strong>首次输出</strong>
                <span className="history-meta">{`\u81ea\u4fee\u6b21\u6570\uff1a${log.repairAttempts ?? 0}`}</span>
              </div>
              <pre>{pretty(log.repairHistory?.[0]?.rawContent ?? log.rawContent ?? log.parsedResult ?? "\u672a\u6355\u83b7\u5230\u8f93\u51fa\u3002")}</pre>
            </div>
            {log.repairHistory?.map((repair) => (
              <div className="debug-stage-item" key={`${log.id}-repair-${repair.attempt}`}>
                <div className="debug-stage-item-head">
                  <strong>{`校验失败 / 第 ${repair.attempt} 次自修`}</strong>
                  <span className="history-meta">节点自修</span>
                </div>
                <p className="debug-stage-item-text">{repair.error}</p>
                <pre>{pretty(repair.normalizedResult ?? repair.rawContent ?? "\u672a\u6355\u83b7\u5230\u89c4\u8303\u5316\u7ed3\u679c\u3002")}</pre>
              </div>
            ))}
            <div className="debug-stage-item">
              <div className="debug-stage-item-head">
                <strong>{log.fallbackUsed ? "最终回退结果" : "最终通过结果"}</strong>
                <span className="history-meta">{log.fallbackUsed ? "已回退" : "通过校验"}</span>
              </div>
              <p className="debug-stage-item-text">{`\u5931\u8d25\u539f\u56e0\uff1a${summarizeFailure(log)}`}</p>
              <p className="debug-stage-item-text">{`\u56de\u9000\u8bf4\u660e\uff1a${summarizeFallback(log)}`}</p>
              <pre>{pretty(log.parsedResult ?? log.rawResponse ?? log.rawContent ?? "\u672a\u6355\u83b7\u5230\u6700\u7ec8\u7ed3\u679c\u3002")}</pre>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function RunPanel({ group }: { group: RunGroup }) {
  const iterations = getIterations(group);
  const [activeIteration, setActiveIteration] = useState<number>(iterations[iterations.length - 1] ?? 1);
  const currentIteration = iterations.includes(activeIteration) ? activeIteration : (iterations[iterations.length - 1] ?? 1);
  const currentLogs = group.logs.filter((log) => (log.iteration ?? 1) === currentIteration);

  return (
    <article className="debug-run-card">
      <div className="debug-run-head">
        <div>
          <div className="panel-tag">Run</div>
          <h2 className="debug-run-title">{group.runId}</h2>
          <p className="debug-subtitle">
            {`\u4f1a\u8bdd\uff1a${group.sessionId || "-"} / \u542f\u52a8\u65f6\u95f4\uff1a${new Date(group.startedAt).toLocaleString("zh-CN")}`}
          </p>
        </div>
        <div className="debug-run-summary">
          <span className="pill">{group.snapshot?.stage || "\u672a\u77e5\u9636\u6bb5"}</span>
          <span className="pill">{group.snapshot?.currentStep || "\u6682\u65e0\u5f53\u524d\u6b65\u9aa4"}</span>
        </div>
      </div>

      <MetricsPanel metrics={group.snapshot?.metrics} traceId={group.traceId} />
      <ToolSelectionPanel toolSelection={group.snapshot?.toolSelection} />
      <ConsistencyReportPanel report={group.snapshot?.consistencyReport} />
      <ReviewTracePanel history={group.snapshot?.reviewHistory ?? []} report={group.snapshot?.consistencyReport} />
      <RepairPlanPanel repairPlan={group.snapshot?.repairPlan} />
      <Html5Panel html5Preparation={group.snapshot?.html5Preparation} />

      {iterations.length > 1 ? (
        <div className="iteration-tabs">
          {iterations.map((iteration) => (
            <button
              key={iteration}
              type="button"
              className={`iteration-tab ${iteration === currentIteration ? "is-active" : ""}`}
              onClick={() => setActiveIteration(iteration)}
            >
              {`\u7b2c ${iteration} \u8f6e`}
            </button>
          ))}
        </div>
      ) : null}

      <IterationTimeline logs={currentLogs} />
    </article>
  );
}

export function DebugLogViewer() {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [runs, setRuns] = useState<RunSnapshot[]>([]);

  useEffect(() => {
    let stopped = false;

    async function load() {
      try {
        const [logsRes, runsRes] = await Promise.all([fetch("/api/debug-logs", { cache: "no-store" }), fetch("/api/runs", { cache: "no-store" })]);
        const logsJson = await logsRes.json();
        const runsJson = await runsRes.json();
        if (!stopped) {
          setLogs(Array.isArray(logsJson.logs) ? logsJson.logs : []);
          setRuns(Array.isArray(runsJson.runs) ? runsJson.runs : []);
        }
      } catch {
        if (!stopped) {
          setLogs([]);
          setRuns([]);
        }
      }
    }

    load();
    const timer = window.setInterval(load, 2500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  const groups = useMemo(() => groupByRun(logs, runs), [logs, runs]);

  return (
    <main className="debug-shell">
      <header className="debug-header debug-header-wide">
        <div>
          <h1 className="debug-title">项目架构与执行控制台</h1>
          <p className="debug-subtitle">
            在一个页面里查看执行阶段、并发批次、一致性图、返修计划与 HTML5 交付包。
          </p>
        </div>
      </header>

      <ArchitecturePanel />

      <section className="debug-stream debug-run-stream">
        {groups.length === 0 ? (
          <div className="debug-empty">当前还没有运行记录，请先从首页发起一次运行。</div>
        ) : (
          groups.map((group) => <RunPanel key={group.runId} group={group} />)
        )}
      </section>
    </main>
  );
}
