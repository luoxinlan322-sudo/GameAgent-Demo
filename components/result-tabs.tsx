"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { Html5PreparationPackage } from "@/lib/html5-render-schemas";
import type { AgentPlan, CopyLine, CreativePack, Evaluation, GameProposal, PersonaInput, ReviewHistoryItem } from "@/lib/schemas";
import { EvaluationReport } from "./evaluation-report";
import { ProposalCard } from "./proposal-card";
import { CharacterCarousel, StoryBoard } from "./story-character-board";

type ResultTabsProps = {
  persona: PersonaInput;
  plan: AgentPlan;
  proposal: GameProposal;
  creativePack: CreativePack;
  html5Preparation: Html5PreparationPackage | null;
  evaluation: Evaluation;
  reviewHistory: ReviewHistoryItem[];
};

const tabLabels = {
  proposal: "总体策划",
  gameplay: "玩法结构",
  economy: "数值经济",
  systems: "系统策划",
  scene: "场景策划",
  ui: "UI 架构",
  story: "剧情方案",
  characters: "角色资料卡",
  assets: "资产清单",
  copywriting: "页面文案",
  layout: "布局配置",
  timeline: "时间线配置",
  interaction: "交互渲染",
  evaluation: "评估",
} as const;

type TabKey = keyof typeof tabLabels;

const tabs: TabKey[] = [
  "proposal",
  "gameplay",
  "economy",
  "systems",
  "scene",
  "ui",
  "story",
  "characters",
  "assets",
  "copywriting",
  "layout",
  "timeline",
  "interaction",
  "evaluation",
];

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="result-panel">
      <div className="panel-head">
        <span className="panel-tag">{title}</span>
        <h2 className="panel-title">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function TextSection({ title, body }: { title: string; body: string }) {
  return (
    <div className="summary-box section-box">
      <p className="kicker">{title}</p>
      <p>{body}</p>
    </div>
  );
}

function ListSection({ title, items, emptyText }: { title: string; items: string[]; emptyText?: string }) {
  return (
    <div className="summary-box section-box">
      <p className="kicker">{title}</p>
      {items.length > 0 ? (
        <ul className="list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText ?? "本轮未产出该组内容。"}</p>
      )}
    </div>
  );
}

function CopySection({ title, items }: { title: string; items: CopyLine[] }) {
  return (
    <div className="summary-box section-box">
      <p className="kicker">{title}</p>
      {items.length > 0 ? (
        <ul className="list">
          {items.map((item) => (
            <li key={`${item.id}-${item.target}`}>
              <strong>{item.target}</strong>: {item.text}
            </li>
          ))}
        </ul>
      ) : (
        <p>{"本轮未产出该组文案。"}</p>
      )}
    </div>
  );
}

function JsonSection({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="summary-box section-box">
      <p className="kicker">{title}</p>
      <pre className="history-pre">{pretty(value)}</pre>
    </div>
  );
}

function MetricStrip({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="result-metric-grid">
      {items.map((item) => (
        <div className="result-metric-card" key={item.label}>
          <div className="result-metric-label">{item.label}</div>
          <div className="result-metric-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ResultTabs({ persona, plan, proposal, creativePack, html5Preparation, evaluation, reviewHistory }: ResultTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("proposal");

  const layoutSceneCount = html5Preparation?.layoutConfig?.scenes.length ?? 0;
  const layoutElementCount = html5Preparation?.layoutConfig?.scenes.reduce((sum, scene) => sum + scene.elements.length, 0) ?? 0;
  const timelineCount = html5Preparation?.timelineConfig?.timelines.length ?? 0;
  const timelineActionCount = html5Preparation?.timelineConfig?.timelines.reduce((sum, timeline) => sum + timeline.actions.length, 0) ?? 0;
  const interactionCount = html5Preparation?.interactionConfig?.bindings.length ?? 0;
  const renderLightCount = html5Preparation?.lightingRenderConfig?.lights?.length ?? 0;
  const renderFxCount = html5Preparation?.lightingRenderConfig?.postFx?.length ?? 0;

  return (
    <section className="panel card result-tab-shell">
      <div className="tab-row result-tab-row">
        {tabs.map((tab) => (
          <button key={tab} type="button" className={`tab-button${activeTab === tab ? " is-active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {activeTab === "proposal" ? <ProposalCard persona={persona} plan={plan} proposal={proposal} /> : null}

      {activeTab === "gameplay" ? (
        <SectionCard title={tabLabels.gameplay}>
          <TextSection title="一句话循环" body={creativePack.gameplay.oneSentenceLoop} />
          <div className="proposal-layout">
            <ListSection title="主循环" items={creativePack.gameplay.mainLoop} />
            <ListSection title="次循环" items={creativePack.gameplay.subLoops} />
            <ListSection title="点击链路" items={creativePack.gameplay.clickPath} />
            <ListSection title="反馈节奏" items={creativePack.gameplay.feedbackRhythm} />
            <ListSection title="失败与恢复" items={creativePack.gameplay.failRecover} />
            <ListSection title="测试重点" items={creativePack.gameplay.testFocus} />
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "economy" ? (
        <SectionCard title={tabLabels.economy}>
          <div className="proposal-layout">
            <ListSection title="核心货币" items={creativePack.economy.coreCurrencies} />
            <ListSection title="产出来源" items={creativePack.economy.faucets} />
            <ListSection title="消耗去向" items={creativePack.economy.sinks} />
            <TextSection title="订单闭环" body={creativePack.economy.orderCostLoop} />
            <ListSection title="升级门槛" items={creativePack.economy.upgradeThresholds} />
            <ListSection title="装扮解锁" items={creativePack.economy.decorationUnlocks} />
            <ListSection title="商业化挂点" items={creativePack.economy.monetizationHooks} />
            <ListSection title="节奏控制" items={creativePack.economy.pacingControls} />
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "systems" ? (
        <SectionCard title={tabLabels.systems}>
          <TextSection title="系统总览" body={creativePack.systems.systemOverview} />
          <div className="proposal-layout">
            <TextSection title="经营系统" body={creativePack.systems.managementSystem} />
            <TextSection title="扩建系统" body={creativePack.systems.expansionSystem} />
            <TextSection title="任务系统" body={creativePack.systems.missionSystem} />
            <TextSection title="活动系统" body={creativePack.systems.eventSystem} />
            <TextSection title="角色交互系统" body={creativePack.systems.roleInteractionSystem} />
            <TextSection title="收集系统" body={creativePack.systems.collectionSystem} />
            <TextSection title="轻社交展示" body={creativePack.systems.socialLightSystem} />
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "scene" ? (
        <SectionCard title={tabLabels.scene}>
          <TextSection title="场景概念" body={creativePack.scene.sceneConcept} />
          <div className="proposal-layout">
            <ListSection title="场景分区" items={creativePack.scene.sceneZones} />
            <ListSection title="可交互区域" items={creativePack.scene.interactiveAreas} />
            <ListSection title="建筑坑位" items={creativePack.scene.buildingSlots} />
            <ListSection title="动线设计" items={creativePack.scene.navigationFlow} />
            <ListSection title="状态变化" items={creativePack.scene.stateTransitions} />
            <ListSection title="内容热点" items={creativePack.scene.contentHotspots} />
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "ui" ? (
        <SectionCard title={tabLabels.ui}>
          <div className="proposal-layout">
            <ListSection title="顶栏" items={creativePack.ui.topBar} />
            <ListSection title="订单栏" items={creativePack.ui.orderPanel} />
            <ListSection title="任务栏" items={creativePack.ui.taskPanel} />
            <ListSection title="商店入口" items={creativePack.ui.shopEntry} />
            <ListSection title="活动入口" items={creativePack.ui.eventEntry} />
            <ListSection title="建造面板" items={creativePack.ui.buildModePanel} />
            <ListSection title="反馈层" items={creativePack.ui.feedbackLayer} />
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "story" ? <StoryBoard story={creativePack.story} /> : null}
      {activeTab === "characters" ? <CharacterCarousel cards={creativePack.characters} /> : null}

      {activeTab === "assets" ? (
        <SectionCard title={tabLabels.assets}>
          <TextSection title="视觉风格" body={creativePack.assetManifest.visualStyle} />
          <div className="proposal-layout">
            <ListSection title="导出规则" items={creativePack.assetManifest.exportRules} />
            <ListSection title="图层规则" items={creativePack.assetManifest.layeredRules} />
            <ListSection title="优先级" items={creativePack.assetManifest.priorityOrder} />
          </div>
          <div className="history-list result-history-list">
            {creativePack.assetManifest.assetGroups.map((asset) => (
              <div className="summary-box section-box" key={`${asset.assetType}-${asset.assetName}`}>
                <p className="kicker">
                  {asset.assetName} / {asset.assetType}
                </p>
                <p>
                  {"用途："}
                  {asset.purpose}
                </p>
                <p>
                  {"规格："}
                  {asset.spec}
                  {" / 比例："}
                  {asset.ratio}
                  {" / 图层："}
                  {asset.layer}
                </p>
                <p>
                  {"命名规则："}
                  {asset.namingRule}
                </p>
                <p>
                  {"背景要求："}
                  {asset.backgroundRequirement}
                </p>
                <p>
                  {"依赖来源："}
                  {asset.sourceDependencies.join(" / ")}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "copywriting" ? (
        <SectionCard title={tabLabels.copywriting}>
          <div className="proposal-layout">
            <CopySection title="页面标题" items={creativePack.copywriting?.pageTitles ?? []} />
            <CopySection title="面板标题" items={creativePack.copywriting?.panelTitles ?? []} />
            <CopySection title="按钮文案" items={creativePack.copywriting?.buttonLabels ?? []} />
            <CopySection title="任务与订单文案" items={creativePack.copywriting?.taskAndOrderCopy ?? []} />
            <CopySection title="活动入口文案" items={creativePack.copywriting?.eventEntryCopy ?? []} />
            <CopySection title="场景提示文案" items={creativePack.copywriting?.sceneHints ?? []} />
            <CopySection title="角色台词" items={creativePack.copywriting?.characterLines ?? []} />
            <CopySection title="角色卡文案" items={creativePack.copywriting?.characterCardCopy ?? []} />
            <CopySection title="资产标签" items={creativePack.copywriting?.assetLabels ?? []} />
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "layout" ? (
        <SectionCard title={tabLabels.layout}>
          <MetricStrip
            items={[
              { label: "场景数", value: layoutSceneCount },
              { label: "布局元素数", value: layoutElementCount },
              { label: "SceneDefinitions", value: html5Preparation?.sceneDefinitions.length ?? 0 },
            ]}
          />
          <div className="proposal-layout">
            <JsonSection title="LayoutConfig" value={html5Preparation?.layoutConfig ?? null} />
            <JsonSection title="场景定义" value={html5Preparation?.sceneDefinitions ?? null} />
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "timeline" ? (
        <SectionCard title={tabLabels.timeline}>
          <MetricStrip
            items={[
              { label: "时间线数", value: timelineCount },
              { label: "动作数", value: timelineActionCount },
            ]}
          />
          <JsonSection title="时间线配置" value={html5Preparation?.timelineConfig ?? null} />
        </SectionCard>
      ) : null}

      {activeTab === "interaction" ? (
        <SectionCard title={tabLabels.interaction}>
          <MetricStrip
            items={[
              { label: "交互绑定数", value: interactionCount },
              { label: "灯光数", value: renderLightCount },
              { label: "后处理数", value: renderFxCount },
            ]}
          />
          <div className="proposal-layout">
            <JsonSection title="交互配置" value={html5Preparation?.interactionConfig ?? null} />
            <JsonSection title="灯光与渲染配置" value={html5Preparation?.lightingRenderConfig ?? null} />
            <JsonSection title="游戏配置" value={html5Preparation?.gameConfig ?? null} />
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "evaluation" ? <EvaluationReport evaluation={evaluation} reviewHistory={reviewHistory} /> : null}
    </section>
  );
}
