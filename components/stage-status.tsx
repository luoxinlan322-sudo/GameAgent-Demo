export type StageKey = "idle" | "planning" | "generating" | "evaluating" | "done" | "error";

export type NodeInfo = {
  node: string;
  title: string;
  status: "running" | "done" | "fallback" | "error";
  iteration: number;
};

export type StageTimingItem = {
  label: string;
  durationMs?: number;
  message: string;
};

type StageStatusProps = {
  currentStage: StageKey;
  currentStep?: string | null;
  stageTimings?: StageTimingItem[];
  nodeStatuses?: Map<string, NodeInfo>;
  elapsedSeconds?: number;
};

const stages = [
  { key: "planning", title: "理解目标", desc: "识别品类与验证目标" },
  { key: "planning-2", title: "制定计划", desc: "确定成功标准与风险" },
  { key: "planning-3", title: "拆分子任务", desc: "拆到策划、剧情、角色与资产" },
  { key: "generating", title: "调用模型", desc: "生成方案与创意包" },
  { key: "evaluating", title: "检查结果", desc: "运行一致性检查与评分" },
  { key: "done", title: "决定下一步", desc: "给出测试建议与交付物" },
] as const;

function formatDuration(ms?: number) {
  if (typeof ms !== "number") return "...";
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

const statusIcon: Record<NodeInfo["status"], string> = {
  running: "●",
  done: "✓",
  fallback: "⚠",
  error: "✕",
};

export function StageStatus({ currentStage, currentStep, stageTimings = [], nodeStatuses, elapsedSeconds }: StageStatusProps) {
  const currentIndex =
    currentStage === "idle"
      ? -1
      : currentStage === "planning"
        ? 2
        : currentStage === "generating"
          ? 3
          : currentStage === "evaluating"
            ? 4
            : currentStage === "done" || currentStage === "error"
              ? 5
              : 0;

  const nodes = nodeStatuses ? Array.from(nodeStatuses.values()) : [];
  const isActive = currentStage !== "idle" && currentStage !== "done" && currentStage !== "error";

  return (
    <section className="panel card status-panel top-stage-panel">
      <div className="stage-panel-head">
        <div>
          <span className="panel-tag">{isActive ? "Agent 运行中" : currentStage === "done" ? "运行完成" : currentStage === "error" ? "运行异常" : "Agent 循环"}</span>
          <h2 className="panel-title">执行进度</h2>
        </div>
        {typeof elapsedSeconds === "number" && (
          <div className={`elapsed-timer${isActive ? " is-active" : ""}`}>
            {formatElapsed(elapsedSeconds)}
          </div>
        )}
      </div>

      {currentStep && (
        <div className="review-note" style={{ marginTop: 0 }}>
          <span className="review-note-label">当前步骤</span>
          <p>{currentStep}</p>
        </div>
      )}

      <div className="stage-grid">
        {stages.map((stage, index) => {
          const active = index <= currentIndex;
          const current = index === currentIndex;
          return (
            <div className={`stage-card${active ? " is-active" : ""}${current ? " is-current" : ""}`} key={stage.key}>
              <div className="stage-index">0{index + 1}</div>
              <div>
                <div className="stage-title">{stage.title}</div>
                <div className="stage-desc">{stage.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {nodes.length > 0 && (
        <div className="node-grid">
          {nodes.map((node) => (
            <div key={node.node} className={`node-chip is-${node.status}`}>
              <span className="node-chip-icon">{statusIcon[node.status]}</span>
              <span className="node-chip-label">{node.title}</span>
              {node.iteration > 1 && <span className="node-chip-iter">R{node.iteration}</span>}
            </div>
          ))}
        </div>
      )}

      {stageTimings.length > 0 && (
        <div className="stage-timing-strip">
          {stageTimings.map((item) => (
            <span className="stage-timing-chip" key={item.label}>
              {item.label} <strong>{formatDuration(item.durationMs)}</strong>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
