import type { Evaluation, ReviewHistoryItem } from "@/lib/schemas";

type EvaluationReportProps = {
  evaluation: Evaluation;
  reviewHistory: ReviewHistoryItem[];
};

const scoreLabels = [
  ["gameplayStructure", "玩法结构完整度", 20],
  ["economyBalance", "数值经济合理性", 15],
  ["systemCoverage", "系统设计覆盖度", 15],
  ["sceneUiReadiness", "场景与 UI 落地度", 15],
  ["storyCharacterConsistency", "剧情角色一致性", 10],
  ["assetManifestExecutability", "资产清单可执行性", 15],
  ["smallScaleTestFit", "原型范围匹配度", 20],
] as const;

export function EvaluationReport({ evaluation, reviewHistory }: EvaluationReportProps) {
  const tone =
    evaluation.decision.includes("拒绝")
      ? "拒绝"
      : evaluation.decision.includes("修改")
        ? "返修"
        : evaluation.decision.includes("优先")
          ? "优先"
          : "进入测试";

  const returnedItems = reviewHistory.filter((item) => item.returned);

  return (
    <section className="result-panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <span className="panel-tag">{"系统评审"}</span>
          <h2 className="panel-title" style={{ marginBottom: 0 }}>
            {"评估结论"}
          </h2>
        </div>
        <div className="decision" data-tone={tone}>
          {evaluation.decision} / {evaluation.totalScore}
        </div>
      </div>

      <div className="review-note">
        <span className="review-note-label">{"评审口径"}</span>
        <p>
          {
            "按当前原型设计包的工程可执行性评审，重点检查玩法、经济、系统、场景、UI、剧情角色与资产清单是否被主 Agent 编排成一套可落地的原型方案。"
          }
        </p>
      </div>

      <div className="section">
        <h3>{"硬门槛"}</h3>
        <div className="status-strip">
          <span className="pill">{"玩法清晰："}{String(evaluation.hardGates.loopsClear)}</span>
          <span className="pill">{"经济闭环："}{String(evaluation.hardGates.economyClosedLoop)}</span>
          <span className="pill">{"系统覆盖："}{String(evaluation.hardGates.systemCoverage)}</span>
          <span className="pill">{"场景/UI 可落地："}{String(evaluation.hardGates.sceneUiReady)}</span>
          <span className="pill">{"剧情角色一致："}{String(evaluation.hardGates.storyCharacterAligned)}</span>
          <span className="pill">{"资产清单可执行："}{String(evaluation.hardGates.assetManifestExecutable)}</span>
        </div>
        {evaluation.blockedBy.length > 0 ? (
          <ul className="list">
            {evaluation.blockedBy.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <div className="summary-box">{"当前无阻塞项。"}</div>
        )}
      </div>

      <div className="section">
        <h3>{"最终通过报告"}</h3>
        <div className="metric-grid">
          {scoreLabels.map(([key, label, max]) => {
            const value = evaluation.scores[key];
            const percentage = (value / max) * 100;
            return (
              <div className="metric" key={key}>
                <div className="metric-head">
                  <span>{label}</span>
                  <strong>
                    {value}/{max}
                  </strong>
                </div>
                <div className="meter">
                  <span style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <div className="section">
          <h3>{"评估摘要与风险"}</h3>
          <div className="summary-box section-box">{evaluation.summary}</div>
          <ul className="list">
            {evaluation.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>

        <div className="section">
          <h3>{"后续建议"}</h3>
          <ul className="list">
            {evaluation.recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="section" style={{ marginTop: 18 }}>
        <h3>{"退回记录"}</h3>
        {returnedItems.length > 0 ? (
          <div className="history-list">
            {returnedItems.map((item) => (
              <div className="summary-box section-box" key={item.round}>
                <p className="kicker">
                  {"第 "}
                  {item.round}
                  {" 轮 / "}
                  {item.decision}
                  {" / "}
                  {item.score}
                  {" 分"}
                </p>
                <p>
                  <strong>{"退回原因"}</strong>
                </p>
                <ul className="list">
                  {item.returnReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p>
                  <strong>{"修缮方向"}</strong>
                </p>
                <ul className="list">
                  {item.repairDirections.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="summary-box">{"本次运行没有触发退回修改。"}</div>
        )}
      </div>
    </section>
  );
}
