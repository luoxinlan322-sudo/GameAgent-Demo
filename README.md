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
- 自主修缮循环：评估不通过时自动定位问题工具、生成修缮计划、局部重跑
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
感知输入 → 意图识别 → 规划拆解 → 工具选择 → 工具执行 → 阶段契约 → 一致性校验 → 评估 → 修缮/输出
                                       ↑                                              |
                                       └──────── 自主修缮循环（最多 3 轮迭代）─────────┘
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
- **语义层**：调用 LLM 对规则层结果进行补充语义判断

校验失败时，系统自动生成修缮计划并局部重跑受影响的工具链。

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
| LLM 接入 | OpenAI SDK（兼容 Qwen 等 OpenAI 协议模型） |
| Schema 校验 | Zod 4 |
| 可观测性 | Langfuse（链路追踪 + 评估记录） |
| 类型系统 | TypeScript 5.9 strict |
| 目标引擎 | Phaser 3 + WebGL（阶段三接入） |
| 素材生成 | VLM（阶段二接入，计划支持 FLUX/SD3 + ControlNet） |

## 项目结构

```
├── app/                        # Next.js 页面与 API 路由
│   ├── page.tsx                #   主界面：画像输入 + 结果展示
│   ├── api/run-agent/          #   SSE 流式 API（驱动 Agent 流水线）
│   ├── debug/                  #   调试面板
│   └── history/                #   历史记录
├── components/                 # React UI 组件
├── lib/                        # Agent 核心逻辑
│   ├── main-agent.ts           #   主 Agent 编排（状态机 + 迭代循环）
│   ├── agent-tools.ts          #   12 个工具的执行器
│   ├── agent-phase-contracts.ts#   阶段契约定义与验证
│   ├── agent-execution-config.ts#  工具依赖图 + 阶段配置
│   ├── consistency-graph.ts    #   规则层一致性检查
│   ├── consistency-tools.ts    #   语义层一致性检查
│   ├── evaluator.ts            #   LLM 评估器
│   ├── schemas.ts              #   所有工具的输入/输出 Zod Schema
│   ├── html5-render-schemas.ts #   Phaser 运行时配置 Schema
│   ├── prompts.ts              #   Prompt 模板
│   └── qwen-chat.ts            #   LLM 调用 + 结果解析
├── scripts/                    # 测试与运维脚本
│   └── run_agent_e2e_smoke.cjs #   端到端烟雾测试
├── docs/                       # 设计文档
│   ├── phaser_webgl_input_spec.md  # Phaser/WebGL 输入规范
│   └── agent_pipeline_phases.md    # 流水线阶段设计
└── assets/                     # 静态资源（预设画像等）
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

测试会验证完整流水线：12 个工具执行 → 4 个阶段契约通过 → 一致性校验 → 评估完成。

---

## 路线图

- [x] 阶段一：方案生成 Agent（12 工具 + 一致性校验 + 自主修缮 + 评估闭环）
- [x] HTML5 运行时 Schema 对齐（Phaser/WebGL 8 类配置输出）
- [x] 阶段契约验证系统
- [ ] 阶段二：VLM 素材生成（AssetManifest → 角色立绘/场景背景/UI 元素/道具图标）
- [ ] 阶段三：Phaser 引擎自动组装（配置 → 可运行游戏代码）
- [ ] 阶段四：端到端闭环（Prompt → Playable Game + 反馈迭代）

