type StageKey = "idle" | "planning" | "generating" | "evaluating" | "done" | "error";

type StageStatusProps = {
  currentStage: StageKey;
  currentStep?: string | null;
  stageTimings?: Array<{ label: string; durationMs?: number; message: string }>;
};

const stages = [
  { key: "planning", title: "\u7406\u89e3\u76ee\u6807", desc: "\u8bc6\u522b\u54c1\u7c7b\u4e0e\u9a8c\u8bc1\u76ee\u6807" },
  { key: "planning-2", title: "\u5236\u5b9a\u8ba1\u5212", desc: "\u786e\u5b9a\u6210\u529f\u6807\u51c6\u4e0e\u98ce\u9669" },
  { key: "planning-3", title: "\u62c6\u5206\u5b50\u4efb\u52a1", desc: "\u62c6\u5230\u7b56\u5212\u3001\u5267\u60c5\u3001\u89d2\u8272\u4e0e\u8d44\u4ea7" },
  { key: "generating", title: "\u8c03\u7528\u6a21\u578b", desc: "\u751f\u6210\u65b9\u6848\u4e0e\u521b\u610f\u5305" },
  { key: "evaluating", title: "\u68c0\u67e5\u7ed3\u679c", desc: "\u8fd0\u884c\u4e00\u81f4\u6027\u68c0\u67e5\u4e0e\u8bc4\u5206" },
  { key: "done", title: "\u51b3\u5b9a\u4e0b\u4e00\u6b65", desc: "\u7ed9\u51fa\u6d4b\u8bd5\u5efa\u8bae\u4e0e\u4ea4\u4ed8\u7269" },
] as const;

export function StageStatus({ currentStage, currentStep, stageTimings = [] }: StageStatusProps) {
  const currentIndex =
    currentStage === "idle"
      ? -1
      : currentStage === "planning"
        ? 2
        : currentStage === "generating"
          ? 3
          : currentStage === "evaluating"
            ? 4
            : currentStage === "done"
              ? 5
              : 0;

  return (
    <section className="panel card status-panel top-stage-panel">
      <div className="panel-head">
        <span className="panel-tag">Agent \u5faa\u73af</span>
        <h2 className="panel-title">执行进度</h2>
      </div>

      <div className="review-note" style={{ marginTop: 0 }}>
        <span className="review-note-label">当前步骤说明</span>
        <p>{currentStep || "\u7b49\u5f85\u5f00\u59cb\u8fd0\u884c"}</p>
      </div>

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

      {stageTimings.length > 0 ? (
        <div className="stage-timing-grid">
          {stageTimings.map((item) => (
            <div className="summary-box section-box" key={item.label}>
              <p className="kicker">{item.label}</p>
              <p style={{ margin: "8px 0 6px" }}>{item.durationMs ?? 0}ms</p>
              <p style={{ margin: 0 }}>{item.message}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
