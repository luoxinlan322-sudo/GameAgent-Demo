import type { AgentPlan, GameProposal, PersonaInput } from "@/lib/schemas";

type ProposalCardProps = {
  persona: PersonaInput;
  plan: AgentPlan;
  proposal: GameProposal;
};

function renderList(items: string[]) {
  return (
    <ul className="list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function ProposalCard({ persona, plan, proposal }: ProposalCardProps) {
  return (
    <section className="result-panel">
      <div className="status-strip">
        <span className="pill">项目：{persona.projectCode}</span>
        <span className="pill">品类：{persona.targetGenre}</span>
        <span className="pill">平台：{persona.targetPlatform}</span>
        <span className="pill">市场：{persona.targetMarket}</span>
        <span className="pill">阶段：{persona.projectStage}</span>
      </div>

      <div className="panel-head">
        <span className="panel-tag">总体策划</span>
        <h2 className="panel-title">{proposal.solutionName}</h2>
      </div>

      <div className="proposal-overview-grid">
        <div className="summary-box section-box">
          <p className="kicker">项目定位</p>
          <p>{proposal.projectPositioning}</p>
        </div>
        <div className="summary-box section-box">
          <p className="kicker">设计主张</p>
          <p>{proposal.designThesis}</p>
        </div>
      </div>

      <div className="review-note">
        <span className="review-note-label">主 Agent 规划摘要</span>
        <p>{plan.goalUnderstanding}</p>
      </div>

      <div className="proposal-layout">
        <div className="section">
          <div className="summary-box section-box">
            <p className="kicker">01 / 本轮关注点</p>
            <p>{proposal.roundFocus}</p>
          </div>

          <div className="summary-box section-box">
            <p className="kicker">02 / 原型范围</p>
            <p>{proposal.prototypeScope}</p>
          </div>
        </div>

        <div className="section">
          <div className="summary-box section-box">
            <p className="kicker">03 / 关键验证指标</p>
            {renderList(proposal.keyValidationMetrics)}
          </div>

          <div className="summary-box section-box">
            <p className="kicker">04 / 主要风险</p>
            {renderList(proposal.majorRisks)}
          </div>
        </div>
      </div>
    </section>
  );
}
