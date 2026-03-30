import { getHardGates } from "./rules";
import { EvaluationSchema, type AgentPlan, type ConsistencyCheckResult, type CreativePack, type Evaluation, type GameProposal, type PersonaInput } from "./schemas";
import { runEvaluationTool } from "./agent-tools";
import type { LangfuseObservation } from "@langfuse/tracing";

type EvaluateDebugMeta = {
  runId?: string;
  sessionId?: string;
  iteration?: number;
  phase?: string;
  title?: string;
  langfuseParent?: LangfuseObservation;
};

export async function evaluateProposal(
  persona: PersonaInput,
  proposal: GameProposal,
  creativePack: CreativePack,
  plan?: AgentPlan,
  consistency?: ConsistencyCheckResult | null,
  debugMeta?: EvaluateDebugMeta,
): Promise<Evaluation> {
  const gateResult = getHardGates(persona, proposal, creativePack, consistency);
  const boundedBlockedBy = gateResult.blockedBy.slice(0, 10);
  const result = await runEvaluationTool(
    persona,
    plan,
    proposal,
    creativePack,
    boundedBlockedBy,
    {
      sessionId: debugMeta?.sessionId || "evaluate",
      runId: debugMeta?.runId || `evaluate_${Date.now()}`,
      iteration: debugMeta?.iteration || 1,
      langfuseParent: debugMeta?.langfuseParent,
    },
  );

  result.hardGates = gateResult.hardGates;
  result.blockedBy = boundedBlockedBy;
  result.totalScore = Object.values(result.scores).reduce((sum, value) => sum + value, 0);
  result.decision =
    boundedBlockedBy.length > 0
      ? "修改后复评"
      : result.totalScore >= 85
        ? "优先进入测试"
        : result.totalScore >= 75
          ? "建议进入测试"
          : "修改后复评";

  return EvaluationSchema.parse(result);
}
