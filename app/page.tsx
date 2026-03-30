"use client";

import { useEffect, useState } from "react";
import { PersonaForm } from "@/components/persona-form";
import { ResultTabs } from "@/components/result-tabs";
import type { Html5PreparationPackage } from "@/lib/html5-render-schemas";
import type { AgentPlan, CreativePack, Evaluation, GameProposal, PersonaInput, ReviewHistoryItem } from "@/lib/schemas";

const initialPersona: PersonaInput = {
  projectCode: "港镇计划",
  targetGenre: "模拟经营",
  targetPlatform: "多端",
  targetMarket: "中国大陆",
  audiencePositioning:
    "面向偏爱低压力休闲经营、装扮收集和短时长回流的玩家，希望有稳定的复访动机。",
  coreFantasy:
    "通过店铺升级、居民交互和街区更新，把老港镇重建成温暖又有风格的度假目的地。",
  monetizationModel: "内购",
  benchmarkGames: "《动物餐厅》，开罗系经营模拟，以装扮与家园为核心的休闲经营产品",
  requiredSystems:
    "核心经营循环，街区扩建，订单与目标，装扮收集，角色交互，活动包装",
  versionGoal:
    "产出一套范围可控但内容完整的首日经营原型包，覆盖订单动机、装扮收集、角色交互、活动包装和 HTML5 运行时装配。",
  projectStage: "小范围测试",
  productionConstraints:
    "保持原型范围可控，但不能漏掉运行时承载物。需要覆盖经营循环、扩建反馈、装扮收集、角色交互、活动包装，以及 HTML5 装配所需的场景、UI、资产和文案。不接入重 3D 资源，不做竞技对抗系统。",
};

type RunStage = "idle" | "planning" | "generating" | "evaluating" | "done" | "error";
type NodeStatus = "running" | "done" | "fallback" | "error" | null;

export default function HomePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [persona, setPersona] = useState<PersonaInput>(initialPersona);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [proposal, setProposal] = useState<GameProposal | null>(null);
  const [creativePack, setCreativePack] = useState<CreativePack | null>(null);
  const [html5Preparation, setHtml5Preparation] = useState<Html5PreparationPackage | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState<RunStage>("idle");
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [currentNodeStatus, setCurrentNodeStatus] = useState<NodeStatus>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  async function runLoop() {
    setIsRunning(true);
    setError(null);
    setCurrentStage("planning");
    setCurrentNodeStatus("running");
    setCurrentStep("主 Agent 正在理解项目简报，并起草首轮规划。");
    setPlan(null);
    setProposal(null);
    setCreativePack(null);
    setHtml5Preparation(null);
    setEvaluation(null);
    setReviewHistory([]);
    setElapsedSeconds(0);

    try {
      const response = await fetch("/api/run-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, sessionId }),
      });

      if (!response.ok || !response.body) {
        let message = "运行入口调用失败";
        try {
          const errorPayload = (await response.json()) as {
            error?: string;
            issues?: Array<{ path?: string; message?: string }>;
          };
          if (errorPayload.error) message = errorPayload.error;
          if (errorPayload.issues?.length) {
            message = `${message}\n${errorPayload.issues
              .map((issue) => `${issue.path ?? "参数"}: ${issue.message ?? "不合法"}`)
              .join("\n")}`;
          }
        } catch {
          const raw = await response.text().catch(() => "");
          if (raw) message = raw;
        }
        throw new Error(message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const event = JSON.parse(line) as
            | { type: "meta"; sessionId: string; runId: string }
            | {
                type: "node";
                node: string;
                phase: string;
                title: string;
                status: "running" | "done" | "fallback" | "error";
                iteration: number;
                summary: string;
                output?: unknown;
              }
            | { type: "stage"; stage: RunStage; currentStep?: string }
            | { type: "plan"; plan: AgentPlan }
            | { type: "generation"; generation: { proposal: GameProposal; creativePack: CreativePack } }
            | { type: "html5_preparation"; html5Preparation: Html5PreparationPackage }
            | { type: "evaluation"; evaluation: Evaluation }
            | { type: "review_history"; history: ReviewHistoryItem[] }
            | { type: "error"; error: string };

          if (event.type === "meta") setSessionId(event.sessionId);

          if (event.type === "stage") {
            setCurrentStage(event.stage);
            setCurrentStep(event.currentStep || null);
            if (event.stage === "done") setCurrentNodeStatus("done");
            if (event.stage === "error") setCurrentNodeStatus("error");
          }

          if (event.type === "node") {
            setCurrentNodeStatus(event.status);
            const suffix =
              event.status === "running" ? "running" : event.status === "fallback" ? "fallback" : event.status === "error" ? "error" : "done";
          const statusText =
            event.status === "running"
              ? "运行中"
              : event.status === "fallback"
                ? "已回退"
                : event.status === "error"
                  ? "异常"
                  : "完成";
          setCurrentStep(`${event.title} / 第 ${event.iteration} 轮 / ${statusText}`);

            if (event.phase === "感知输入" || event.phase === "推理规划") setCurrentStage("planning");
            if (event.phase === "工具执行") setCurrentStage("generating");
            if (event.phase === "评审修缮") setCurrentStage("evaluating");
          }

          if (event.type === "plan") setPlan(event.plan);
          if (event.type === "generation") {
            setProposal(event.generation.proposal);
            setCreativePack(event.generation.creativePack);
          }
          if (event.type === "html5_preparation") setHtml5Preparation(event.html5Preparation);
          if (event.type === "evaluation") setEvaluation(event.evaluation);
          if (event.type === "review_history") setReviewHistory(event.history);
          if (event.type === "error") throw new Error(event.error);
        }
      }
    } catch (caughtError) {
      setPlan(null);
      setProposal(null);
      setCreativePack(null);
      setHtml5Preparation(null);
      setEvaluation(null);
      setReviewHistory([]);
      setError(caughtError instanceof Error ? caughtError.message : "运行失败");
      setCurrentStage("error");
      setCurrentNodeStatus("error");
      setCurrentStep("运行失败");
    } finally {
      setIsRunning(false);
    }
  }

  const overlayText =
    currentNodeStatus === "fallback"
      ? "当前节点触发了本地回退结果，但主 Agent 会继续编排后续工具与评审。"
      : currentNodeStatus === "error"
        ? "当前节点执行失败，页面会展示具体错误原因。"
        : "请求正在运行中，主 Agent 可能会经过意图识别、规划、工具选择、并发执行、评审和返修。";

  return (
    <main className="shell">
      <section className="hero hero-minimal">
        <h1>游戏设计生成与评审工作台</h1>
      </section>

      <section className="hero-grid">
        <PersonaForm persona={persona} isRunning={isRunning} onChange={setPersona} onPreset={setPersona} onSubmit={runLoop} />

        <div className="report-stack">
          {plan && proposal && creativePack && evaluation ? (
            <ResultTabs
              persona={persona}
              plan={plan}
              proposal={proposal}
              creativePack={creativePack}
              html5Preparation={html5Preparation}
              evaluation={evaluation}
              reviewHistory={reviewHistory}
            />
          ) : (
            <section className="panel empty">
              <div className="empty-badge">
                {currentStage === "planning"
                  ? "规划中"
                  : currentStage === "generating"
                    ? "工具执行中"
                    : currentStage === "evaluating"
                      ? "检查与评估中"
                      : "等待中"}
              </div>
              <h2 className="panel-title">
                {currentStage === "planning"
                  ? "主 Agent 正在理解目标，建立本轮执行计划。"
                  : currentStage === "generating"
                    ? "主 Agent 正在编排设计工具，合成首稿设计包。"
                    : currentStage === "evaluating"
                      ? "主 Agent 正在运行一致性检查、评估和返修决策。"
                      : "暂无结果"}
              </h2>
            </section>
          )}

          {error ? <div className="panel card error">{error}</div> : null}
        </div>
      </section>

      {isRunning ? (
        <div className="run-overlay" aria-live="polite">
          <div className="run-overlay-card">
            <div className="run-overlay-badge">Agent 运行中</div>
            <h2>{currentStep || "正在处理请求"}</h2>
            <p>{overlayText}</p>
            <div className="run-overlay-timer">{elapsedSeconds}s</div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
