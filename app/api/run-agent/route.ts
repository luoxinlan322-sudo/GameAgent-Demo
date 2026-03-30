import { startObservation } from "@langfuse/tracing";
import { ZodError } from "zod";
import type { Html5PreparationPackage } from "@/lib/html5-render-schemas";
import { createLangfuseScores, flushLangfuse, isLangfuseEnabled, type AgentRuntimeMetrics } from "@/lib/langfuse";
import { runMainAgent } from "@/lib/main-agent";
import type { ConsistencyReport } from "@/lib/agent-consistency-schemas";
import { ProjectBriefSchema, type AgentPlan, type CreativePack, type Evaluation, type GameProposal, type PersonaInput, type ReviewHistoryItem } from "@/lib/schemas";
import { createRunId, createSessionId, upsertRun, type StageTrace } from "@/lib/run-store";

type EventPayload =
  | { type: "meta"; sessionId: string; runId: string; traceId?: string; langfuseEnabled: boolean }
  | { type: "stage"; stage: "planning" | "generating" | "evaluating" | "done" | "error"; message: string; stageTimings?: StageTrace[]; currentStep?: string }
  | { type: "node"; node: string; phase: string; title: string; status: "running" | "done" | "fallback" | "error"; iteration: number; summary: string; output?: unknown }
  | { type: "phase_contract"; contract: import("@/lib/agent-phase-contracts").AgentPhaseContractCheck }
  | { type: "plan"; plan: AgentPlan }
  | { type: "generation"; generation: { proposal: GameProposal; creativePack: CreativePack } }
  | { type: "html5_preparation"; html5Preparation: Html5PreparationPackage }
  | { type: "repair_plan"; repairPlan: import("@/lib/agent-consistency-schemas").RepairPlan }
  | { type: "evaluation"; evaluation: Evaluation }
  | { type: "review_history"; history: ReviewHistoryItem[] }
  | { type: "consistency_report"; report: ConsistencyReport }
  | { type: "error"; error: string };

function toEventLine(payload: EventPayload) {
  return `${JSON.stringify(payload)}\n`;
}

function phaseToStage(phase: string): "planning" | "generating" | "evaluating" | "done" {
  if (phase === "感知" || phase === "规划") return "planning";
  if (phase === "工具") return "generating";
  if (phase === "反馈") return "evaluating";
  return "done";
}

function buildMetrics(params: {
  startedAt: number;
  nodeCount: number;
  llmNodeCount: number;
  fallbackCount: number;
  errorCount: number;
  repairCount: number;
  proposal?: GameProposal;
  creativePack?: CreativePack;
  html5Preparation?: Html5PreparationPackage;
  consistencyReport?: ConsistencyReport;
  evaluation?: Evaluation;
  failed: boolean;
}): AgentRuntimeMetrics {
  const readyCount = [params.proposal, params.creativePack, params.html5Preparation, params.evaluation].filter(Boolean).length;
  const consistencyReady = params.consistencyReport ? (params.consistencyReport.globalPass ? 1 : 0.5) : 0;
  const completeness = Number(((readyCount + consistencyReady) / 5).toFixed(2));
  return {
    totalDurationMs: Date.now() - params.startedAt,
    nodeCount: params.nodeCount,
    llmNodeCount: params.llmNodeCount,
    fallbackCount: params.fallbackCount,
    errorCount: params.errorCount,
    repairCount: params.repairCount,
    outputCompleteness: completeness,
    runSuccess: !params.failed && readyCount === 4 && Boolean(params.consistencyReport?.globalPass),
  };
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const payload = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  const sessionId = typeof payload.sessionId === "string" && payload.sessionId ? payload.sessionId : createSessionId();

  let persona: PersonaInput;
  try {
    persona = ProjectBriefSchema.parse(payload.persona) as PersonaInput;
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        {
          error: "项目简报参数校验失败",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    return Response.json({ error: "项目简报解析失败" }, { status: 400 });
  }

  const runId = createRunId();
  const encoder = new TextEncoder();
  const langfuseEnabled = isLangfuseEnabled();
  const rootObservation = langfuseEnabled
    ? startObservation(
        "game-agent-run",
        {
          input: persona,
          metadata: { sessionId, runId, product: "game-agent-demo" },
        },
        { asType: "agent" },
      )
    : null;

  const stream = new ReadableStream({
    async start(controller) {
      let streamClosed = false;
      const push = (payload: EventPayload) => {
        // 在推送到流之前做一次轻量的输出裁剪，避免 downstream 校验因单条字符串过长而失败
        const sanitize = (obj: any) => {
          if (!obj || typeof obj !== "object") return obj;
          try {
            // 如果存在 output.evidence 数组，截断每一项到 220 字符
            if (Array.isArray(obj?.output?.evidence)) {
              obj.output.evidence = obj.output.evidence.map((item: unknown) => {
                if (typeof item === "string" && item.length > 220) return `${item.slice(0, 217)}...`;
                return item;
              });
            }
            // 对于直接的 evidence 字段也处理
            if (Array.isArray(obj?.evidence)) {
              obj.evidence = obj.evidence.map((item: unknown) => {
                if (typeof item === "string" && item.length > 220) return `${item.slice(0, 217)}...`;
                return item;
              });
            }
          } catch {}
        };
        try {
          sanitize(payload);
        } catch {}
        if (streamClosed) return false;
        try {
          controller.enqueue(encoder.encode(toEventLine(payload)));
          return true;
        } catch {
          streamClosed = true;
          return false;
        }
      };
      const stageTimings: StageTrace[] = [];
      const startedAt = Date.now();
      let activeTrace: StageTrace | null = null;
      let currentPlan: AgentPlan | undefined;
      let currentProposal: GameProposal | undefined;
      let currentCreativePack: CreativePack | undefined;
      let currentHtml5Preparation: Html5PreparationPackage | undefined;
      let currentConsistencyReport: ConsistencyReport | undefined;
      let currentEvaluation: Evaluation | undefined;
      let currentReviewHistory: ReviewHistoryItem[] | undefined;
      let currentToolSelection: import("@/lib/schemas").ToolSelection | undefined;
      let currentRepairPlan: import("@/lib/agent-consistency-schemas").RepairPlan | undefined;
      let nodeCount = 0;
      let llmNodeCount = 0;
      let fallbackCount = 0;
      let errorCount = 0;
      let repairCount = 0;
      const activeNodes = new Map<string, { phase: string; title: string }>();

      const beginStage = (stage: "planning" | "generating" | "evaluating" | "done", label: string, message: string) => {
        if (activeTrace && !activeTrace.endedAt) {
          activeTrace.endedAt = new Date().toISOString();
          activeTrace.durationMs = new Date(activeTrace.endedAt).getTime() - new Date(activeTrace.startedAt).getTime();
        }

        if (stage === "done") {
          push({ type: "stage", stage, currentStep: label, message, stageTimings });
          return;
        }

        activeTrace = { stage, label, message, startedAt: new Date().toISOString() };
        stageTimings.push(activeTrace);
        push({ type: "stage", stage, currentStep: label, message, stageTimings: [...stageTimings] });
      };

      const finalizeActiveStage = () => {
        if (activeTrace && !activeTrace.endedAt) {
          activeTrace.endedAt = new Date().toISOString();
          activeTrace.durationMs = new Date(activeTrace.endedAt).getTime() - new Date(activeTrace.startedAt).getTime();
        }
      };

      const currentRunningStep = () => {
        const running = Array.from(activeNodes.values());
        if (running.length === 0) return undefined;
        return running.map((item) => item.title).join(" / ");
      };

      const currentRunningStage = () => {
        const running = Array.from(activeNodes.values());
        if (running.length === 0) return undefined;
        const latest = running[running.length - 1];
        return phaseToStage(latest.phase);
      };

      try {
        push({ type: "meta", sessionId, runId, traceId: rootObservation?.traceId, langfuseEnabled });
        beginStage("planning", "感知输入", "主 Agent 已读取项目简报");

        const state = await runMainAgent({
          sessionId,
          runId,
          persona,
          langfuseParent: rootObservation ?? undefined,
          onEvent(event) {
            if (event.type === "node") {
              if (event.status === "running") {
                activeNodes.set(event.node, { phase: event.phase, title: event.title });
              } else {
                activeNodes.delete(event.node);
              }

              if (event.status !== "running") nodeCount += 1;
              if (
                [
                  "gameplay_tool",
                  "economy_tool",
                  "system_design_tool",
                  "proposal_tool",
                  "scene_design_tool",
                  "ui_architecture_tool",
                  "story_tool",
                  "character_tool",
                  "asset_manifest_tool",
                  "evaluation_tool",
                ].includes(event.node) &&
                event.status !== "running"
              ) {
                llmNodeCount += 1;
              }
              if (event.status === "fallback") fallbackCount += 1;
              if (event.status === "error") errorCount += 1;
              if (event.node === "repair_tool" && event.status !== "running") repairCount += 1;
              if (event.node === "tool_selection" && event.output && typeof event.output === "object") {
                currentToolSelection = event.output as import("@/lib/schemas").ToolSelection;
              }

              const mappedStage = phaseToStage(event.phase);
              if (
                event.status === "running" &&
                mappedStage !== "done" &&
                (!activeTrace || activeTrace.stage !== mappedStage || activeTrace.label !== event.title)
              ) {
                beginStage(mappedStage, event.title, event.summary);
              }

              push(event);

              const snapshotStage = currentRunningStage() ?? (mappedStage === "done" ? "done" : mappedStage);
              const snapshotStep = currentRunningStep() ?? (event.status === "running" ? event.title : activeTrace?.label ?? event.title);

              const metrics = buildMetrics({
                startedAt,
                nodeCount,
                llmNodeCount,
                fallbackCount,
                errorCount,
                repairCount,
                proposal: currentProposal,
                creativePack: currentCreativePack,
                html5Preparation: currentHtml5Preparation,
                consistencyReport: currentConsistencyReport,
                evaluation: currentEvaluation,
                failed: false,
              });

              upsertRun({
                sessionId,
                runId,
                traceId: rootObservation?.traceId,
                stage: snapshotStage,
                persona,
                currentStep: snapshotStep,
                stageTimings: [...stageTimings],
                metrics,
                plan: currentPlan,
                toolSelection: currentToolSelection,
                proposal: currentProposal,
                creativePack: currentCreativePack,
                html5Preparation: currentHtml5Preparation,
                consistencyReport: currentConsistencyReport,
                evaluation: currentEvaluation,
                reviewHistory: currentReviewHistory,
                repairPlan: currentRepairPlan,
                updatedAt: new Date().toISOString(),
              });
            }

            if (event.type === "plan") {
              currentPlan = event.plan;
              push(event);
            }

            if (event.type === "repair_plan") {
              currentRepairPlan = event.repairPlan;
              push(event);
            }

            if (event.type === "phase_contract") {
              push({
                type: "phase_contract",
                contract: event.contract as import("@/lib/agent-phase-contracts").AgentPhaseContractCheck,
              });
            }

            if (event.type === "generation") {
              currentProposal = event.generation.proposal;
              currentCreativePack = event.generation.creativePack;
              currentHtml5Preparation = undefined;
              push(event);
            }

            if (event.type === "html5_preparation") {
              currentHtml5Preparation = event.html5Preparation;
              push(event);
            }

            if (event.type === "evaluation") {
              currentEvaluation = event.evaluation;
              push(event);
            }

            if (event.type === "consistency_report") {
              currentConsistencyReport = event.report;
              push(event);
            }

            if (event.type === "review_history") {
              currentReviewHistory = event.history;
              push(event);
            }
          },
        });

        finalizeActiveStage();
        const metrics = buildMetrics({
          startedAt,
          nodeCount,
          llmNodeCount,
          fallbackCount,
          errorCount,
          repairCount,
          proposal: state.proposal ?? undefined,
          creativePack: state.finalResult?.creativePack ?? undefined,
          html5Preparation: state.finalResult?.html5Preparation ?? undefined,
          consistencyReport: state.finalResult?.consistencyReport ?? undefined,
          evaluation: state.evaluation ?? undefined,
          failed: false,
        });

        upsertRun({
          sessionId,
          runId,
          traceId: rootObservation?.traceId,
          stage: "done",
          persona,
          currentStep: "最终输出",
          stageTimings: [...stageTimings],
          metrics,
          plan: state.plan ?? undefined,
          toolSelection: state.toolSelection ?? undefined,
          proposal: state.proposal ?? undefined,
          creativePack: state.finalResult?.creativePack ?? undefined,
          html5Preparation: state.finalResult?.html5Preparation ?? undefined,
          consistencyReport: state.finalResult?.consistencyReport ?? undefined,
          evaluation: state.evaluation ?? undefined,
          reviewHistory: state.reviewHistory,
          repairPlan: state.repairPlan ?? undefined,
          updatedAt: new Date().toISOString(),
        });

        rootObservation?.updateOtelSpanAttributes({
          output: {
            metrics,
            hasPlan: Boolean(state.plan),
            hasProposal: Boolean(state.proposal),
            hasCreativePack: Boolean(state.finalResult?.creativePack),
            hasHtml5Preparation: Boolean(state.finalResult?.html5Preparation),
            hasEvaluation: Boolean(state.evaluation),
          },
        });
        rootObservation?.end();

        createLangfuseScores({ traceId: rootObservation?.traceId, runId, sessionId, metrics });
        await flushLangfuse();

        push({ type: "stage", stage: "done", message: "主 Agent 已完成执行", currentStep: "最终输出", stageTimings: [...stageTimings] });
      } catch (error) {
        finalizeActiveStage();
        const message = error instanceof Error ? error.message : "运行失败";
        const metrics = buildMetrics({
          startedAt,
          nodeCount,
          llmNodeCount,
          fallbackCount,
          errorCount: errorCount + 1,
          repairCount,
          proposal: currentProposal,
          creativePack: currentCreativePack,
          html5Preparation: currentHtml5Preparation,
          consistencyReport: currentConsistencyReport,
          evaluation: currentEvaluation,
          failed: true,
        });

        upsertRun({
          sessionId,
          runId,
          traceId: rootObservation?.traceId,
          stage: "error",
          persona,
          currentStep: "运行异常",
          stageTimings: [...stageTimings],
          metrics,
          error: message,
          toolSelection: currentToolSelection,
          html5Preparation: currentHtml5Preparation,
          consistencyReport: currentConsistencyReport,
          evaluation: currentEvaluation,
          reviewHistory: currentReviewHistory,
          repairPlan: currentRepairPlan,
          updatedAt: new Date().toISOString(),
        });

        rootObservation?.updateOtelSpanAttributes({ output: { error: message, metrics }, level: "ERROR", statusMessage: message });
        rootObservation?.end();

        createLangfuseScores({ traceId: rootObservation?.traceId, runId, sessionId, metrics });
        await flushLangfuse();

        push({ type: "error", error: message });
        push({ type: "stage", stage: "error", message, currentStep: "运行异常", stageTimings: [...stageTimings] });
      } finally {
        if (!streamClosed) {
          try {
            controller.close();
          } catch {
            streamClosed = true;
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
