import type { GenreFeatureProfile, PersonaInput } from "../schemas";
import type { RepairPlan } from "../agent-consistency-schemas";

export function genreOptionalFieldsBlock(profile?: GenreFeatureProfile | null): string {
  if (!profile) return "";
  const lines: string[] = [];
  if (!profile.requireOrders) {
    lines.push("- orderCostLoop is optional for this genre. Output an empty string if the game has no order loop.");
    lines.push("- orderPanel is optional for this genre. Output an empty array if not applicable.");
  }
  if (!profile.requireDecoration) {
    lines.push("- decorationUnlocks is optional for this genre. Output an empty array if the game has no decoration system.");
  }
  if (!profile.requireManagement) {
    lines.push("- managementSystem is optional for this genre. Output an empty string if not applicable.");
  }
  if (!profile.requireExpansion) {
    lines.push("- expansionSystem is optional for this genre. Output an empty string if not applicable.");
  }
  if (!profile.requireBuildings) {
    lines.push("- buildingSlots and buildingDefinitions are optional for this genre. Output empty arrays if buildings are not part of the core design.");
    lines.push("- buildModePanel is optional for this genre. Output an empty array if not applicable.");
  }
  if (lines.length === 0) return "";
  return "\nGenre-specific field guidance (these fields are optional for the current genre):\n" + lines.join("\n");
}

export function jsonOnlyInstruction(keys: string[]) {
  return [
    "Output contract:",
    "1. Return exactly one valid JSON object.",
    "2. Do not output Markdown, code fences, explanations, notes, or prefixes.",
    `3. The top-level keys must be exactly: ${keys.join(", ")}.`,
    "4. Keep field names unchanged. Do not omit required fields or invent new top-level fields.",
    "5. Keep field types exact. Arrays must stay arrays. Booleans must be true/false.",
    "6. If a field expects an array, split ideas into short items instead of one long sentence.",
    "7. 所有面向玩家或策划的文本内容（描述、名称、解释、文案等）必须使用中文输出。JSON 字段名（key）保持英文不变。",
  ].join("\n");
}

export function productionGradeInstruction(toolName: string, focus: string[]) {
  return [
    `${toolName} production requirements:`,
    "1. Output must be directly usable for HTML5 prototype assembly, engine handoff, asset production, or in-game copy.",
    "2. Every field should be actionable, decomposable, and reusable. Avoid vague high-level planning prose.",
    "3. Keep scope controlled, but do not under-specify. The result should be prototype-complete, not merely minimal.",
    `4. Priority for this tool in this round: ${focus.join("; ")}.`,
  ].join("\n");
}

export function fewShotBlock(title: string, examples: Array<{ input: string; output: string }>) {
  return [
    `${title}:`,
    ...examples.flatMap((example, index) => [`Example ${index + 1} input: ${example.input}`, `Example ${index + 1} output: ${example.output}`]),
    "",
    "⚠ Few-shot boundary: The examples above demonstrate the TARGET FORMAT and FIELD STRUCTURE only. Do NOT copy their specific content, names, quantities, or lengths. Your output should match the current brief — if the brief implies more items, roles, zones, anchors, or labels than the example shows, produce more. If fewer are needed, produce fewer. Treat the example as a schema reference, not a content template.",
  ].join("\n");
}

export function briefBlock(brief: PersonaInput) {
  return `项目简报:
- 项目代号: ${brief.projectCode}
- 品类: ${brief.targetGenre}
- 平台: ${brief.targetPlatform}
- 目标市场: ${brief.targetMarket}
- 受众定位: ${brief.audiencePositioning}
- 核心幻想: ${brief.coreFantasy}
- 变现模式: ${brief.monetizationModel}
- 竞品参考: ${brief.benchmarkGames}
- 必需系统: ${brief.requiredSystems}
- 当前版本目标: ${brief.versionGoal}
- 当前阶段: ${brief.projectStage}
- 生产约束: ${brief.productionConstraints}`;
}

export function repairContextBlock(repairContext?: string) {
  return `Repair context:
${repairContext || "First round. No repair context yet."}`;
}

export function previousOutputBlock(baseline: unknown) {
  if (!baseline) return "";
  const json = JSON.stringify(baseline, null, 2);
  const truncated = json.length > 8000 ? json.slice(0, 8000) + "\n... (truncated)" : json;
  return `\nPrevious output baseline (preserve valid content, only patch the failed parts):\n${truncated}\nREPAIR RULE: Do NOT rewrite from scratch. Keep all valid fields from the baseline. Only fix the specific issues described in the Repair checklist.`;
}

export function repairChecklistBlock(repairPlan: RepairPlan | null | undefined, stageGuidance?: string) {
  if (!repairPlan) return "";

  const lines: string[] = ["\n═══ REPAIR CHECKLIST (you MUST fix every item below) ═══"];

  // Repair goal
  lines.push(`Repair goal: ${repairPlan.repairGoal}`);

  // Per-edge failure details — the most critical part
  if (repairPlan.failedEdgeDetails && repairPlan.failedEdgeDetails.length > 0) {
    for (const edge of repairPlan.failedEdgeDetails) {
      lines.push(`\n--- Failed edge: ${edge.edgeId} ---`);
      for (const issue of edge.issues) {
        lines.push(`  ✗ ${issue}`);
      }
      if (edge.strictIdentifiers.length > 0) {
        lines.push(`  ⚠ MUST include these exact identifiers: ${edge.strictIdentifiers.join(", ")}`);
      }
      if (edge.repairSuggestions.length > 0) {
        lines.push(`  → Fix: ${edge.repairSuggestions.join("; ")}`);
      }
    }
  }

  // Expanded instructions
  if (repairPlan.repairInstructions && repairPlan.repairInstructions.length > 20) {
    lines.push(`\nDetailed instructions:\n${repairPlan.repairInstructions}`);
  }

  // Stage-specific repair guidance (from stageRepairGuidance)
  if (stageGuidance) {
    lines.push(`\n${stageGuidance}`);
  }

  // Stop conditions as checklist
  if (repairPlan.stopConditions.length > 0) {
    lines.push("\nSuccess criteria (all must be met):");
    for (const condition of repairPlan.stopConditions) {
      lines.push(`  ☐ ${condition}`);
    }
  }

  lines.push("═══ END REPAIR CHECKLIST ═══");

  return lines.join("\n");
}

export function jsonBlock(title: string, value: unknown) {
  return `${title}:
${JSON.stringify(value, null, 2)}`;
}
