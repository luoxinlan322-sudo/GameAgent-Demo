import {
  runAssetManifestTool,
  runCharacterTool,
  runEconomyTool,
  runGameplayTool,
  runProposalTool,
  runSceneTool,
  runStoryTool,
  runSystemDesignTool,
  runUiTool,
} from "./agent-tools";
import type { AgentPlan, GenerationResult, PersonaInput } from "./schemas";

export async function generateProposal(persona: PersonaInput, plan: AgentPlan): Promise<GenerationResult> {
  const context = {
    sessionId: "legacy_generate",
    runId: `legacy_generate_${Date.now()}`,
    iteration: 1,
  };

  const gameplay = await runGameplayTool(persona, plan, 1, context);
  const [economy, systems] = await Promise.all([
    runEconomyTool(persona, plan, gameplay, 1, context),
    runSystemDesignTool(persona, plan, gameplay, null, 1, context),
  ]);
  const proposal = await runProposalTool(persona, plan, gameplay, economy, systems, 1, context);
  const [scene, story] = await Promise.all([
    runSceneTool(persona, plan, gameplay, systems, proposal, 1, context),
    runStoryTool(persona, plan, proposal, systems, 1, context),
  ]);
  const [ui, characters] = await Promise.all([
    runUiTool(persona, plan, systems, scene, 1, context),
    runCharacterTool(persona, plan, systems, story, 1, context),
  ]);
  const assetManifest = await runAssetManifestTool(persona, plan, proposal, economy, scene, ui, story, characters, 1, context);

  return {
    proposal,
    creativePack: {
      gameplay,
      economy,
      systems,
      scene,
      ui,
      story,
      characters,
      assetManifest,
    },
  };
}
