import { z } from "zod";
import { ConsistencyEdgeIdSchema, ToolNameSchema } from "./schemas";

export const ProblemLocationHintSchema = z.object({
  toolName: ToolNameSchema,
  confidence: z.enum(["low", "medium", "high"]),
  reason: z.string().min(8).max(400),
});

export const ConsistencyEdgeResultSchema = z.object({
  edgeId: ConsistencyEdgeIdSchema,
  sourceTool: ToolNameSchema,
  targetTool: ToolNameSchema,
  level: z.enum(["hard", "soft"]),
  pass: z.boolean(),
  severity: z.enum(["low", "medium", "high"]),
  issues: z.array(z.string().min(4).max(400)).max(12),
  evidence: z.array(z.string().min(2).max(400)).max(12).default([]),
  involvedTools: z.array(ToolNameSchema).min(1).max(4),
  problemLocationHints: z.array(ProblemLocationHintSchema).max(6).default([]),
  repairSuggestions: z.array(z.string().min(4).max(400)).max(8).default([]),
});

export const RepairTaskSchema = z.object({
  edgeId: ConsistencyEdgeIdSchema,
  problemSummary: z.string().min(8).max(400),
  whyItMatters: z.string().min(12).max(400),
  successConditions: z.array(z.string().min(6).max(180)).min(1).max(6),
  strictIdentifiers: z.array(z.string().min(2).max(120)).max(8).default([]),
  candidateTools: z.array(ToolNameSchema).min(1).max(4),
  selectionGuidance: z.array(z.string().min(8).max(400)).max(8).default([]),
  problemLocationHints: z.array(ProblemLocationHintSchema).max(6).default([]),
});

export const ConsistencyReportSchema = z.object({
  hardFailures: z.array(ConsistencyEdgeResultSchema).max(32),
  softWarnings: z.array(ConsistencyEdgeResultSchema).max(32),
  passedEdges: z.array(ConsistencyEdgeResultSchema).max(48),
  repairTasks: z.array(RepairTaskSchema).max(24),
  repairCandidates: z
    .array(
      z.object({
        toolName: ToolNameSchema,
        reasons: z.array(z.string().min(4).max(400)).max(12),
        priority: z.number().int().min(0).max(100),
      }),
    )
    .max(24)
    .default([]),
  affectedTools: z.array(ToolNameSchema).max(12),
  summary: z.string().min(8).max(400),
  globalPass: z.boolean(),
});

export const RepairTargetPlanSchema = z.object({
  toolName: ToolNameSchema,
  whyThisTool: z.string().min(8).max(400),
  whyNotOtherTargets: z.string().min(8).max(400).default("Other involved tools are lower leverage for this local repair."),
  costReasoning: z.string().min(8).max(400).default("This target offers the best local repair leverage with the lowest downstream rewrite cost."),
  expectedImpact: z.array(z.string().min(4).max(180)).min(1).max(8),
  relatedTaskEdges: z.array(ConsistencyEdgeIdSchema).min(1).max(8),
});

export const RepairPlanSchema = z.object({
  rationale: z.string().min(12).max(400),
  selectedTargets: z.array(RepairTargetPlanSchema).min(1).max(4),
  stopConditions: z.array(z.string().min(6).max(180)).min(1).max(6),
  recheckEdges: z.array(ConsistencyEdgeIdSchema).min(1).max(16),
  repairGoal: z.string().min(8).max(400).default("Complete the current consistency repair round."),
  repairInstructions: z.string().min(8).max(400).default("Focus repair on failed edges and prove the issue is resolved during recheck."),
  repairTools: z.array(ToolNameSchema).max(8).default([]),
  expectedImprovements: z.array(z.string().min(4).max(180)).max(12).default([]),
});

export const NodeConsistencyCheckpointSchema = z.object({
  triggerTool: ToolNameSchema,
  availableEdges: z.array(ConsistencyEdgeIdSchema).max(32),
  checkedEdges: z.array(ConsistencyEdgeIdSchema).max(32),
  hardFailureEdges: z.array(ConsistencyEdgeIdSchema).max(32),
  softWarningEdges: z.array(ConsistencyEdgeIdSchema).max(32).default([]),
  localRepairCount: z.number().int().min(0).max(20),
  globalRepairCount: z.number().int().min(0).max(999),
  summary: z.string().min(8).max(400),
});

export const LocalRepairDecisionSchema = z.object({
  shouldRepairNow: z.boolean(),
  rationale: z.string().min(8).max(400),
  successConditions: z.array(z.string().min(6).max(180)).max(8).default([]),
  selectedTargets: z.array(ToolNameSchema).max(6).default([]),
  whyTheseTargets: z.string().min(8).max(400).default("These targets directly address the current failed edges with the best leverage."),
  whyNotOtherTargets: z.string().min(8).max(400).default("Other involved tools are not the lowest-cost or highest-leverage repair targets right now."),
  costReasoning: z.string().min(8).max(400).default("Chosen targets minimize upstream churn while preserving already valid outputs."),
  expectedImpact: z.array(z.string().min(4).max(180)).max(8).default([]),
  recheckEdges: z.array(ConsistencyEdgeIdSchema).max(16).default([]),
});

export const ConsistencySemanticReviewSchema = z.object({
  edges: z.array(ConsistencyEdgeResultSchema).max(24),
  summary: z.string().min(8).max(400),
});

export type ConsistencyEdgeResult = z.infer<typeof ConsistencyEdgeResultSchema>;
export type RepairTask = z.infer<typeof RepairTaskSchema>;
export type ConsistencyReport = z.infer<typeof ConsistencyReportSchema>;
export type RepairPlan = z.infer<typeof RepairPlanSchema>;
export type NodeConsistencyCheckpoint = z.infer<typeof NodeConsistencyCheckpointSchema>;
export type LocalRepairDecision = z.infer<typeof LocalRepairDecisionSchema>;
export type ConsistencySemanticReview = z.infer<typeof ConsistencySemanticReviewSchema>;
export type ProblemLocationHint = z.infer<typeof ProblemLocationHintSchema>;
