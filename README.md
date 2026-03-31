# GameAgent — 端到端 AI 游戏生成系统

> 从一句话需求到可运行的 HTML5 游戏，全链路由 AI Agent 驱动。

## 项目愿景

GameAgent 的终极目标是实现 **"Prompt → Playable Game"** 的端到端闭环：用户只需输入目标人群画像和核心玩法描述，系统自主完成游戏策划、素材生成、引擎集成，最终产出一个可以在浏览器中直接运行的 HTML5 小游戏。

```
用户输入 ──→ 方案生成 Agent ──→ VLM 素材生成 ──→ Phaser 引擎组装 ──→ 可运行游戏
 (画像/玩法)   (当前阶段 ✅)      (规划中)         (规划中)          (最终目标)
```

---

## 系统架构总览

整个系统分为四个阶段，当前已完成第一阶段并为后续阶段预留了结构化接口。

### 阶段一：方案生成（已完成 ✅）

单 Agent 主控架构，12 个专业工具协同生成完整游戏策划方案。

**核心能力：**
- 输入玩家画像与项目简报，自动生成涵盖玩法、经济、系统、场景、UI、剧情、角色、资产、文案、布局、时间线的完整策划包
- 规则层 + 语义层双重一致性校验，基于依赖图而非全量配对
- LLM Evaluator 自动评分，产出结构化决策结论（Reject / Revise / Test / Prioritize）
- **局部一致性循环**：每个工具执行后即刻做局部规则+语义检查，发现问题立刻局部返修，不必等到全量校验
- **全局修缮循环**：评估不通过时自动定位问题工具、生成修缮计划、局部重跑（最多 5 轮迭代）
- **结构化修缮上下文**：RepairPlan 携带 `failedEdgeDetails`（具体失败边的 issues / strictIdentifiers / repairSuggestions），格式化为可执行清单而非原始 JSON，注入工具级修缮指导（`stageRepairGuidance`）
- **超时容错与自动重试**：LLM 调用层指数退避重试（transient error），一致性工具超时降级为仅规则检查，单工具失败不崩溃全流水线
- 阶段契约（Phase Contract）验证，确保每个流水线阶段的产出完整性
- 输出已对齐 Phaser/WebGL 运行时规范，为引擎接入做好数据准备

### 阶段二：VLM 素材生成（规划中）

利用视觉语言模型（VLM）将阶段一的资产清单转化为实际图片素材。

**设计思路：**
- 读取阶段一输出的 `AssetManifest`，逐条生成对应的角色立绘、场景背景、UI 元素、道具图标
- 对每张生成素材执行视觉一致性校验（风格统一、尺寸合规、色彩规范）
- 支持 LoRA / ControlNet 进行风格锁定，确保同一项目内素材风格一致
- 输出符合 `assetManifest.assetGroups` 命名规范的文件，可直接被 Phaser Loader 加载

### 阶段三：Phaser 引擎组装（规划中）

将策划方案 + 生成素材自动组装为可运行的 Phaser 游戏。

**设计思路：**
- 消费阶段一输出的 8 类运行时配置（`gameConfig`、`sceneDefinitions`、`layoutConfig`、`interactionConfig`、`timelineConfig`、`copywritingConfig`、`assetManifest`、`lightingRenderConfig`）
- 自动生成 Phaser Scene 代码，将布局配置映射为 Game Objects 创建参数
- 交互绑定映射为 Phaser 事件系统（点击、拖拽、悬停、触发器）
- 时间线映射为场景事件序列
- WebGL 渲染管线配置（光照、shader、后处理）
- 支持热重载预览，生成后可在浏览器即时查看

### 阶段四：端到端闭环（终极目标）

全链路自动化，从自然语言到可玩游戏的一键生成。

**设计思路：**
- 串联阶段一→二→三的完整流水线
- 加入玩家测试反馈回路：自动采集关键指标 → Agent 分析 → 自主迭代优化
- 支持多轮对话式调整：用户可以用自然语言修改任意环节（"把主角换成猫"、"加一个抽奖系统"）
- 版本管理与 A/B 方案对比

---

## 阶段一技术细节

### Agent 流水线

```
感知输入 → 意图识别 → 规划拆解 → 工具选择 → 工具执行 ─→ 局部一致性循环 ─→ 阶段契约
                                       ↑                    (规则+语义)       ↓
                                       │                        ↓          全局一致性校验
                                       │                   局部返修 ←─ 失败    ↓
                                       │                                    评估
                                       │                                     ↓
                                       └──── 全局修缮循环（最多 5 轮迭代）←─ 不通过
                                                                              ↓ 通过
                                                                           最终输出
```

### 12 个专业工具

按阶段分组，每个工具有明确的依赖关系和 HTML5 输出映射：

| 阶段 | 工具 | 职责 |
|------|------|------|
| **基础设计** | `gameplay_tool` | 主循环、次循环、点击链路、反馈节奏 |
| | `economy_tool` | 货币体系、资源流转、经济公式 |
| | `system_design_tool` | 经营/扩建/任务/活动/角色互动系统 |
| | `proposal_tool` | 总体策划、验证重点 |
| **体验结构** | `scene_design_tool` | 场景布局、交互区、坑位、动线 |
| | `ui_architecture_tool` | 顶栏/订单栏/任务栏/活动入口/面板 |
| | `story_tool` | 世界观、主线剧情、剧情锚点 |
| | `character_tool` | 角色资料卡、系统职责、视觉关键词 |
| **渲染准备** | `asset_manifest_tool` | 素材清单、规格、命名规则 |
| | `copywriting_tool` | 页面标题/按钮文案/场景提示/角色台词 |
| **运行时映射** | `layout_tool` | 场景→可渲染布局 + 交互绑定 |
| | `timeline_tool` | 剧情→运行时时间线事件 |

### 一致性校验系统

采用**依赖图**而非全量配对，包含两层检查：

- **规则层**：基于预定义边的结构化比对（如经济实体是否在场景中有载体）
- **语义层**：调用 LLM 对规则层结果进行补充语义判断（超时自动降级为仅规则检查）

校验分为两个粒度：
- **局部一致性循环**：每个工具执行后立刻检查与该工具相关的依赖边，发现 hard failure 则生成局部修缮计划并重跑（最多 8 轮）
- **全局一致性校验**：所有工具完成后做全量依赖图校验 + LLM 评估

### 修缮上下文工程

修缮质量的关键在于让 LLM 看到**精确的失败上下文**而非模糊的 JSON：

| 机制 | 作用 |
|------|------|
| `failedEdgeDetails` | 每条失败边携带 issues、strictIdentifiers、repairSuggestions |
| `repairChecklistBlock` | 将 RepairPlan 格式化为可执行清单（✗ 问题 / ⚠ 必须包含的标识符 / → 修复建议 / ☐ 成功条件） |
| `stageRepairGuidance` | 注入工具级修缮指导（如"characterRoster 只能是纯角色名数组"） |
| `previousOutputBlock` | 上一轮输出截断保留 8000 字符供参考 |

### 超时容错

| 层级 | 策略 |
|------|------|
| LLM 调用层 | `callWithTimeoutRetry` — 指数退避重试（1s→2s→4s + jitter），默认重试 2 次 |
| 一致性工具层 | 语义检查 / 返修决策超时 → 降级为仅规则检查，管道继续 |
| 工具执行层 | 单工具失败标记为 soft-fail，交由修缮循环处理 |
| 全局层 | 整个管道有独立超时保护，不会无限挂起 |

### HTML5 运行时对齐

阶段一的输出已按 Phaser/WebGL 规范组织，包含 8 类结构化配置：

| 配置 | 对应 Phaser 概念 | 作用 |
|------|-----------------|------|
| `gameConfig` | `Phaser.Game(config)` | 渲染模式、尺寸、场景列表 |
| `sceneDefinitions` | `Scene` | 每个场景的加载/创建/更新规则 |
| `assetManifest` | `Loader` | 图片、图集、音频、JSON 资源清单 |
| `layoutConfig` | `Game Objects` | 对象位置、层级、锚点 |
| `copywritingConfig` | 文本绑定 | 运行时文案数据 |
| `timelineConfig` | 场景事件序列 | 显示时机、持续时间、切换逻辑 |
| `interactionConfig` | 事件绑定 | 点击/拖拽/悬停/触发器 |
| `lightingRenderConfig` | WebGL Pipeline | 光照、shader、后处理 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 + React 19 + Tailwind CSS 4 |
| LLM 接入 | OpenAI SDK（兼容 Qwen3 等 OpenAI 协议模型），支持 per-stage thinking mode |
| Schema 校验 | Zod 4 |
| 可观测性 | Langfuse（链路追踪 + 评估记录） |
| 类型系统 | TypeScript 5.9 strict |
| 目标引擎 | Phaser 3 + WebGL（阶段三接入） |
| 素材生成 | VLM（阶段二接入，计划支持 FLUX/SD3 + ControlNet） |

## 项目结构

```
├── app/                            # Next.js 页面与 API 路由
│   ├── page.tsx                    #   主界面：画像输入 + 结果展示
│   ├── api/run-agent/              #   SSE 流式 API（驱动 Agent 流水线）
│   ├── debug/                      #   调试面板
│   └── history/                    #   历史记录
├── components/                     # React UI 组件
├── lib/                            # Agent 核心逻辑
│   ├── main-agent.ts               #   主 Agent 编排（状态机 + 迭代循环 + 局部/全局修缮）
│   ├── agent-tools.ts              #   12 个工具的执行器
│   ├── agent-phase-contracts.ts    #   阶段契约定义与验证
│   ├── agent-execution-config.ts   #   工具依赖图 + 阶段配置
│   ├── agent-consistency-schemas.ts#   一致性校验 + 修缮计划 Zod Schema
│   ├── agent/                      #   Agent 子模块
│   │   └── agent-tools-fallbacks.ts#     工具降级与 mock 修缮计划
│   ├── consistency/                #   一致性检查子模块
│   │   ├── consistency-checks.ts   #     具体边检查函数
│   │   ├── consistency-edge-defs.ts#     依赖边定义
│   │   └── consistency-graph-core.ts#    图核心逻辑
│   ├── consistency-graph.ts        #   规则层一致性检查（入口）
│   ├── consistency-tools.ts        #   语义层一致性检查 + 修缮决策工具
│   ├── llm/                        #   LLM 调用子模块
│   │   ├── structured-chat.ts      #     结构化 LLM 调用 + 超时重试 + schema 自修复
│   │   ├── field-normalizers.ts    #     字段归一化
│   │   ├── stage-cleanup.ts        #     阶段级输出清洗
│   │   ├── stage-validation.ts     #     阶段级语义就绪校验
│   │   └── entity-alignment.ts     #     实体对齐检查
│   ├── prompts/                    #   Prompt 子模块
│   │   ├── prompt-builders.ts      #     各工具的 prompt 构建函数
│   │   ├── prompt-blocks.ts        #     可复用 prompt 块（repairChecklistBlock 等）
│   │   └── prompt-fewshots.ts      #     Few-shot 示例
│   ├── evaluator.ts                #   LLM 评估器
│   ├── schemas.ts                  #   所有工具的输入/输出 Zod Schema
│   └── html5-render-schemas.ts     #   Phaser 运行时配置 Schema
├── scripts/                        # 测试与运维脚本
│   └── run_agent_e2e_smoke.cjs     #   端到端烟雾测试（含超时容错）
├── docs/                           # 设计文档
│   ├── phaser_webgl_input_spec.md  #   Phaser/WebGL 输入规范
│   └── agent_pipeline_phases.md    #   流水线阶段设计
└── assets/                         # 静态资源（预设画像等）
```

## 快速开始

### 环境要求

- Node.js ≥ 20
- 支持 OpenAI 协议的 LLM API（如 Qwen、DeepSeek、GPT-4o）

### 安装与运行

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 LLM API 地址和密钥

# 开发模式
npm run dev

# 生产构建
npm run build
npm start
```

打开浏览器访问 `http://localhost:3000`，输入项目简报即可启动生成。

### 端到端测试

```bash
# 需要先启动开发服务器
npm run dev

# 在另一个终端运行
node scripts/run_agent_e2e_smoke.cjs
```

测试会验证完整流水线：12 个工具执行 → 局部一致性循环 → 4 个阶段契约通过 → 全局一致性校验 → 评估完成。工具级超时会自动降级处理，不会导致测试失败。

### 关键环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_TIMEOUT_MS` | 600000 | LLM 单次调用超时（ms） |
| `LLM_TIMEOUT_RETRIES` | 2 | 超时后自动重试次数 |
| `QWEN_ENABLE_THINKING` | false | 启用 Qwen3 thinking mode |
| `QWEN_THINKING_STAGES` | — | 指定开启 thinking 的阶段（逗号分隔） |
| `MAX_LOCAL_REPAIR_ITERATIONS` | 8 | 局部修缮最大轮数 |
| `MAX_AGENT_REPAIR_ITERATIONS` | 5 | 全局修缮最大轮数 |

---

## 路线图

- [x] 阶段一：方案生成 Agent（12 工具 + 一致性校验 + 自主修缮 + 评估闭环）
- [x] HTML5 运行时 Schema 对齐（Phaser/WebGL 8 类配置输出）
- [x] 阶段契约验证系统
- [x] 代码架构拆分（lib/llm、lib/prompts、lib/agent、lib/consistency 子模块化）
- [x] 局部一致性循环（每个工具执行后即刻检查+局部返修）
- [x] 修缮上下文工程（failedEdgeDetails + repairChecklistBlock + stageRepairGuidance）
- [x] 超时容错与自动重试（指数退避 + 降级策略）
- [x] Per-stage thinking mode（Qwen3 仅对关键阶段开启深度推理）
- [ ] 阶段二：VLM 素材生成（AssetManifest → 角色立绘/场景背景/UI 元素/道具图标）
- [ ] 阶段三：Phaser 引擎自动组装（配置 → 可运行游戏代码）
- [ ] 阶段四：端到端闭环（Prompt → Playable Game + 反馈迭代）

