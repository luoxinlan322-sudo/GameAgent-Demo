# Game Agent 到 HTML5 原型的阶段方案

本文档定义本项目下一阶段的完整实施结构：

1. 现有设计工具如何对齐到 HTML5 渲染输入层
2. 主 Agent 的上下游依赖与并发关系
3. 一致性校验图如何设计
4. reason-based repair 如何落地
5. 分阶段实施与测试策略

## 1. 最终目标

主 Agent 不只生成策划文档，而是生成一套可以继续装配到 `Phaser + WebGL` 的中间层输入。

最终输出应对齐到以下结构：

- `gameConfig`
- `sceneDefinitions`
- `assetManifest`
- `layoutConfig`
- `copywritingConfig`
- `timelineConfig`
- `interactionConfig`
- 可选 `lightingRenderConfig`

## 2. 工具分层

### A. 目标与编排层

- `intent_recognition`
- `planning`
- `tool_selection`
- `verification`
- `repair_planner`

### B. 核心设计层

- `gameplay_tool`
- `economy_tool`
- `system_design_tool`
- `proposal_tool`

### C. 表现与内容层

- `scene_design_tool`
- `ui_architecture_tool`
- `story_tool`
- `character_tool`
- `asset_manifest_tool`
- `copywriting_tool`

### D. HTML5 输入层

- `layout_tool`
- `timeline_tool`

说明：

- `layout_tool` 负责把 scene / ui / character 的设计结果转成坐标、层级、挂载点。
- `timeline_tool` 负责把 story / copywriting / interaction 的触发结果转成出现时机、持续时长、隐藏时机。

## 3. 上下游依赖

### 核心设计层依赖

- `gameplay_tool`: 无依赖
- `economy_tool`: 依赖 `gameplay_tool`
- `system_design_tool`: 依赖 `gameplay_tool`
- `proposal_tool`: 依赖 `gameplay_tool + economy_tool + system_design_tool`

### 表现与内容层依赖

- `scene_design_tool`: 依赖 `proposal_tool + system_design_tool`
- `ui_architecture_tool`: 依赖 `scene_design_tool + system_design_tool`
- `story_tool`: 依赖 `proposal_tool + system_design_tool`
- `character_tool`: 依赖 `story_tool + system_design_tool`
- `asset_manifest_tool`: 依赖 `proposal_tool + economy_tool + scene_design_tool + ui_architecture_tool + story_tool + character_tool`
- `copywriting_tool`: 依赖 `proposal_tool + economy_tool + scene_design_tool + ui_architecture_tool + story_tool + character_tool + asset_manifest_tool`

### HTML5 输入层依赖

- `layout_tool`: 依赖 `scene_design_tool + ui_architecture_tool + character_tool + asset_manifest_tool`
- `timeline_tool`: 依赖 `story_tool + copywriting_tool + ui_architecture_tool + layout_tool`

## 4. 并发关系

### 可并发

- `economy_tool` 与 `system_design_tool`
  - 前提：`gameplay_tool` 已完成
- `scene_design_tool` 与 `story_tool`
  - 前提：`proposal_tool` 与 `system_design_tool` 已完成

### 条件并发

- `ui_architecture_tool`
  - 必须等 `scene_design_tool`
- `character_tool`
  - 必须等 `story_tool`

### 串行尾部工具

- `asset_manifest_tool`
- `copywriting_tool`
- `layout_tool`
- `timeline_tool`

原因：

- 这些工具承接面广，一旦过早运行，后续返修成本高。

## 5. 一致性图结构

### 硬一致性边

- `gameplay -> economy`
- `gameplay -> system`
- `system -> scene`
- `scene -> ui`
- `story -> character`
- `proposal -> asset_manifest`
- `scene -> asset_manifest`
- `ui -> asset_manifest`
- `story -> asset_manifest`
- `character -> asset_manifest`
- `story -> copywriting`
- `character -> copywriting`
- `scene -> copywriting`
- `ui -> copywriting`
- `economy -> copywriting`
- `asset_manifest -> copywriting`
- `scene -> layout`
- `ui -> layout`
- `character -> layout`
- `story -> timeline`
- `copywriting -> timeline`
- `interaction -> timeline`
- `layout -> interaction`

### 软一致性边

- `proposal -> story`
- `proposal -> ui`
- `economy -> asset_manifest`
- `proposal -> copywriting`
- `gameplay -> copywriting`
- `system -> copywriting`
- `layout -> lightingRender`

## 6. 检查器分层

### Rule-based checker

适合：

- 名单集合比对
- 锚点引用存在性
- UI 必填面板存在性
- 资产覆盖率
- layout target 是否存在
- timeline target 是否存在
- interaction target 是否能绑定到 layout / ui

### Semantic checker

适合：

- 系统是否服务玩法
- 场景与 UI 是否服务测试目标
- 剧情、角色、文案调性是否统一
- timeline 节奏是否服务主循环和新手引导

## 7. reason-based repair 结构

### ConsistencyEdgeResult

边检查的标准输出。

### RepairTask

每个失败边聚合成一个更易于主 Agent 理解的返修任务：

- `problemSummary`
- `whyItMatters`
- `successConditions`
- `strictIdentifiers`
- `suggestedTargets`

### RepairPlan

主 Agent 基于 repair tasks 自主选择：

- 修哪些工具
- 为什么先修这些工具
- 修完应该满足什么
- 要复检哪些边

## 8. 生成与返修流程

### 阶段 1：基础生成

- `intent_recognition`
- `planning`
- `tool_selection`
- `gameplay_tool`
- `economy_tool`
- `system_design_tool`
- `proposal_tool`

测试：

- 节点 schema 校验
- UTF-8 CI

### 阶段 2：结构与内容生成

- `scene_design_tool`
- `story_tool`
- `ui_architecture_tool`
- `character_tool`
- `asset_manifest_tool`
- `copywriting_tool`

测试：

- 节点 schema 校验
- 关键依赖字段存在性
- UTF-8 CI

### 阶段 3：HTML5 输入层生成

- `layout_tool`
- `timeline_tool`

测试：

- Phaser 输入 schema 校验
- target / scene / asset binding 完整性

### 阶段 4：一致性图检查

顺序：

1. rule checks
2. semantic checks
3. merge consistency report

测试：

- 边覆盖率
- issue / why / successCondition 结构完整性

### 阶段 5：reason-based repair

顺序：

1. main agent 读取 consistency report
2. 生成 repair tasks
3. 生成 repair plan
4. 只重跑被选中的工具
5. 局部复检受影响边

测试：

- repair targets 是否合理
- 是否避免全量重跑
- 是否能收敛

### 阶段 6：最终总检

- 全图复检
- evaluate
- verification
- 最终输出 HTML5 渲染输入层结果

测试：

- 端到端真实链路
- `/debug` 展示完整性

## 9. 开发约束

- 不允许开发期静态 fallback 掩盖问题
- 节点报错必须显示真实错误类型
- schema 和文案必须保持 UTF-8
- 每阶段结束后必须运行中文编码 CI：
  - `codex_utf8_ci_repair.ps1`
