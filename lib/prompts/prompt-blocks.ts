import type { GenreFeatureProfile, PersonaInput } from "../schemas";
import type { RepairPlan, RepairAttemptRecord, RepairPlanWithHistory } from "../agent-consistency-schemas";

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
    "8. entityId 使用英文蛇形命名（如 campfire_station）；entityName、描述、文案等面向人的字段必须是中文。",
  ].join("\n");
}

export function productionGradeInstruction(toolName: string, focus: string[]) {
  return [
    `${toolName} production requirements:`,
    "1. Output must be directly usable for HTML5 prototype assembly, engine handoff, asset production, or in-game copy.",
    "2. Every field should be actionable, decomposable, and reusable. Avoid vague high-level planning prose.",
    "3. Keep scope controlled, but do not under-specify. The result should be prototype-complete, not merely minimal.",
    `4. Priority for this tool in this round: ${focus.join("; ")}.`,
    "",
    chineseTermGlossary(),
  ].join("\n");
}

/**
 * Glossary block that maps English prompt terms to their Chinese equivalents.
 * Injected into generation-tool prompts to prevent LLM from echoing English domain terms.
 */
export function chineseTermGlossary() {
  return `
【语言规范】本项目面向中文策划团队，JSON value 中的所有自然语言内容必须使用中文。
常见术语对照（输出时使用右侧中文，禁止直接输出左侧英文原词）：
- order → 订单 / 需求 / 委托
- faucet → 产出 / 收入来源
- sink → 消耗 / 支出
- expansion → 扩建 / 扩展
- decoration → 装饰 / 装扮
- facility → 设施
- building → 建筑
- visitor / NPC → 访客 / 旅人 / NPC角色
- hotspot → 热点区域 / 交互点
- carrier → 载体
- resource token → 资源道具
- upgrade threshold → 升级阈值
- pacing → 节奏控制
- monetization hook → 付费钩子
- feedback → 反馈
- slot → 槽位
- runtime target → 运行时挂载目标
注意：entityId 保持英文蛇形命名不变（如 campfire_station），仅 entityName 和描述类字段使用中文。
`.trim();
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
  const limit = 8000;
  let truncated: string;
  if (json.length > limit) {
    // Smart truncation: preserve tail (often contains assetLabels, characterCardCopy etc.)
    const headSize = Math.floor(limit * 0.55);
    const tailSize = limit - headSize - 60;
    truncated = json.slice(0, headSize) + "\n... (中间截断，保留首尾关键部分) ...\n" + json.slice(-tailSize);
  } else {
    truncated = json;
  }
  return `\nPrevious output baseline (preserve valid content, only patch the failed parts):\n${truncated}\nREPAIR RULE: Do NOT rewrite from scratch. Keep all valid fields from the baseline. Only fix the specific issues described in the Repair checklist.`;
}

export function repairChecklistBlock(repairPlan: RepairPlanWithHistory | RepairPlan | null | undefined, stageGuidance?: string) {
  if (!repairPlan) return "";

  const lines: string[] = ["\n═══ REPAIR CHECKLIST (you MUST fix every item below) ═══"];

  // Inject repair history if available (from RepairPlanWithHistory)
  const planWithHistory = repairPlan as RepairPlanWithHistory;
  if (planWithHistory._repairAttemptHistory && planWithHistory._repairAttemptHistory.length > 0) {
    lines.push(repairHistoryBlock(
      planWithHistory._repairAttemptHistory,
      planWithHistory._currentAttempt ?? planWithHistory._repairAttemptHistory.length + 1,
      planWithHistory._maxAttempts ?? 8,
    ));
  }

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

/**
 * Build a repair history block that shows the LLM what was tried in previous
 * local repair iterations and why those attempts failed.
 * This gives the LLM "repair memory" so it doesn't repeat the same strategy.
 */
export function repairHistoryBlock(
  history: RepairAttemptRecord[],
  currentAttempt: number,
  maxAttempts: number,
) {
  if (!history || history.length === 0) return "";

  const lines: string[] = [];

  // Progressive urgency header
  if (currentAttempt >= 5) {
    lines.push(`\n🚨 CRITICAL: 这是第 ${currentAttempt}/${maxAttempts} 次修复尝试。前 ${history.length} 次均未成功。你必须采用完全不同的修复策略。`);
    lines.push("如果之前的修复只是微调措辞或添加少量内容，这次必须重组结构、重新映射标识符、或从上游依赖中重新提取关键信息。");
  } else if (currentAttempt >= 3) {
    lines.push(`\n⚠ WARNING: 这是第 ${currentAttempt}/${maxAttempts} 次修复尝试。前 ${history.length} 次尝试未解决问题。请换一个不同的修复角度。`);
  }

  lines.push(`\n═══ 修复历史 (已尝试 ${history.length} 次，当前第 ${currentAttempt} 次) ═══`);

  for (const attempt of history.slice(-4)) {  // Show last 4 attempts max
    lines.push(`\n--- 第 ${attempt.attemptNumber} 次修复 [${attempt.repairedTool}] ---`);
    lines.push(`  目标: ${attempt.repairGoal}`);
    lines.push(`  目标边: ${attempt.targetEdges.join(", ")}`);
    if (attempt.changeSummary) {
      lines.push(`  实际修改: ${attempt.changeSummary}`);
    }
    if (attempt.stillFailedEdges.length > 0) {
      lines.push(`  ✗ 修复后仍失败: ${attempt.stillFailedEdges.join(", ")}`);
    }
    if (attempt.remainingIssues.length > 0) {
      for (const issue of attempt.remainingIssues.slice(0, 3)) {
        lines.push(`    - ${issue}`);
      }
    }
  }

  // Extract persistent failure patterns
  const edgeFailCounts = new Map<string, number>();
  for (const attempt of history) {
    for (const edge of attempt.stillFailedEdges) {
      edgeFailCounts.set(edge, (edgeFailCounts.get(edge) || 0) + 1);
    }
  }
  const persistentEdges = [...edgeFailCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([edge, count]) => `${edge}(连续失败${count}次)`);

  if (persistentEdges.length > 0) {
    lines.push(`\n⚠ 顽固失败模式: ${persistentEdges.join(", ")}`);
    lines.push("这些边在多轮修复中持续失败，说明之前的修复策略无效。你必须从根本上改变方法：");
    lines.push("  1. 检查上游输入是否就缺少必要信息（如果是，直接在输出中补充缺失映射）");
    lines.push("  2. 检查 strictIdentifiers 是否被准确逐字使用（不要改写、缩写或替代）");
    lines.push("  3. 检查数组/列表是否包含了所有必需项（不要遗漏，宁多勿少）");
  }

  lines.push("═══ 修复历史结束 ═══");

  return lines.join("\n");
}
