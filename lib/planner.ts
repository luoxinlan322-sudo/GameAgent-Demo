import { runIntentTool, runPlanningTool } from "./agent-tools";
import type { AgentPlan, PersonaInput } from "./schemas";

export async function createPlan(persona: PersonaInput): Promise<AgentPlan> {
  const context = {
    sessionId: "legacy_plan",
    runId: `legacy_plan_${Date.now()}`,
    iteration: 1,
  };

  const intent = await runIntentTool(persona, context);
  return runPlanningTool(persona, intent, context);
}
