# Phaser + WebGL 规范输入说明

本文档用于明确：当本项目后续把 Agent 生成结果送入 `Phaser + WebGL` 时，进入引擎的规范输入到底是什么。

结论先行：`Phaser` 不直接消费“策划案”“图片资料”“剧情文本”本身，而是消费一组结构化运行时输入：

1. `gameConfig`
2. `sceneDefinitions`
3. `assetManifest`
4. `layoutConfig`
5. `copywritingConfig`
6. `timelineConfig`
7. `interactionConfig`
8. 可选 `lightingRenderConfig`

这些输入共同构成：

`结构化配置 + 资源文件 + 场景逻辑 -> Phaser 运行时 -> WebGL 逐帧渲染输出`

## 1. 官方文档对应关系

Phaser 官方文档里的核心入口有三层：

1. `new Phaser.Game(config)`
2. `Scene`
3. `Loader`

官方文档：

- Game 概念：https://docs.phaser.io/phaser/concepts/game
- Scenes 概念：https://docs.phaser.io/phaser/concepts/scenes
- Loader 概念：https://docs.phaser.io/phaser/concepts/loader
- LightPipeline API：https://docs.phaser.io/api-documentation/class/renderer-webgl-pipelines-lightpipeline

对应到本项目时，可以映射为：

| 本项目输入 | Phaser 官方概念 | 作用 |
| --- | --- | --- |
| `gameConfig` | `Phaser.Game(config)` | 定义渲染模式、尺寸、挂载点、场景列表 |
| `sceneDefinitions` | `Scene` | 定义每个页面/场景的加载、创建、更新规则 |
| `assetManifest` | `Loader` 输入 | 定义需要加载哪些图片、图集、音频、JSON |
| `layoutConfig` | `Game Objects` 创建参数 | 决定对象放在哪、层级是多少 |
| `copywritingConfig` | 文本对象/绑定数据 | 决定显示什么文案 |
| `timelineConfig` | 场景事件与时序 | 决定何时显示、持续多久、如何切换 |
| `interactionConfig` | 交互事件绑定 | 决定点击、拖拽、悬停、触发器 |
| `lightingRenderConfig` | WebGL pipeline / lights | 决定光照、shader、后处理 |

## 2. gameConfig

这是进入引擎的第一层输入，对应官方 `new Phaser.Game(config)`。

### 最小必填字段

- `type`
- `width`
- `height`
- `parent`
- `backgroundColor`
- `scene`

### 推荐结构

```ts
type GameConfigInput = {
  type: "WEBGL";
  width: number;
  height: number;
  parent: string;
  backgroundColor: string;
  sceneOrder: string[];
  scale?: {
    mode: "FIT" | "RESIZE" | "ENVELOP";
    autoCenter: "CENTER_BOTH" | "CENTER_HORIZONTALLY" | "CENTER_VERTICALLY";
  };
  input?: {
    mouse: boolean;
    touch: boolean;
  };
  physics?: {
    system: "arcade" | "matter" | "none";
  };
};
```

### Phaser 运行时映射

```ts
const config = {
  type: Phaser.WEBGL,
  width: 1334,
  height: 750,
  parent: "game-root",
  backgroundColor: "#24303A",
  scene: [BootScene, MainScene, OverlayScene],
};
```

## 3. sceneDefinitions

这是第二层输入，对应官方 `Scene` 概念。它描述“有哪些场景”和“场景分别负责什么”。

### 规范要求

每个场景至少需要明确：

- `sceneId`
- `role`
- `preloadAssets`
- `entryState`
- `createTargets`
- `updatePolicy`

### 推荐结构

```ts
type SceneDefinition = {
  sceneId: string;
  role: "boot" | "main" | "overlay" | "modal" | "result";
  preloadAssets: string[];
  entryState?: Record<string, unknown>;
  createTargets: string[];
  updatePolicy: {
    hasPerFrameUpdate: boolean;
    needsTimers: boolean;
    needsAnimations: boolean;
  };
};
```

### 本项目语义

例如模拟经营小游戏里，可以有：

- `boot_scene`
- `market_scene`
- `hud_overlay`
- `event_modal`

## 4. assetManifest

这是第三层输入，对应官方 `Loader` 的资源加载输入。

### 规范要求

每一项资源至少要明确：

- `assetId`
- `assetType`
- `url`
- `sceneScope`

### 推荐结构

```ts
type AssetManifestInput = {
  assets: Array<{
    assetId: string;
    assetType: "image" | "atlas" | "spritesheet" | "audio" | "json";
    url: string;
    sceneScope: string[];
    phaserKey: string;
    framePrefix?: string;
    meta?: {
      logicalType?: string;
      width?: number;
      height?: number;
    };
  }>;
};
```

### Phaser 运行时映射

```ts
this.load.image("building_main_stall", "/assets/buildings/main-stall.png");
this.load.atlas("ui_core", "/assets/ui/core.png", "/assets/ui/core.json");
this.load.json("layout_market_scene", "/data/layout.market-scene.json");
```

## 5. layoutConfig

这层输入不属于 Phaser 官方的一个单独名词，但对应的是 `create()` 中生成 `Game Objects` 时的坐标、层级和锚点参数。

### 规范要求

每个可渲染元素至少要明确：

- `targetId`
- `sceneId`
- `assetId`
- `x`
- `y`
- `depth`

### 推荐结构

```ts
type LayoutConfigInput = {
  scenes: Array<{
    sceneId: string;
    elements: Array<{
      targetId: string;
      assetId: string;
      x: number;
      y: number;
      depth: number;
      anchor: "center" | "bottom-center" | "top-left";
      scale?: number;
      visible?: boolean;
      interactive?: boolean;
      group?: "scene" | "ui" | "character" | "effect";
    }>;
  }>;
};
```

### 作用

这一层决定：

- 图片放哪
- UI 放哪
- 角色站位在哪
- 哪些元素默认显示
- 哪些元素可交互

## 6. copywritingConfig

这层输入不直接来自 Phaser 官方 API，但会映射成 `Text`、`BitmapText`、气泡组件、按钮标签等。

### 规范要求

每条文案至少要明确：

- `copyId`
- `targetId`
- `sceneId`
- `text`
- `usage`

### 推荐结构

```ts
type CopywritingConfigInput = {
  items: Array<{
    copyId: string;
    targetId: string;
    sceneId: string;
    usage: "pageTitle" | "buttonLabel" | "sceneHint" | "characterBubble" | "taskText" | "eventEntry";
    text: string;
    speakerId?: string;
    styleToken?: string;
  }>;
};
```

### 作用

这一层负责把：

- 页面标题
- 按钮文案
- 角色气泡
- 任务提示
- 活动入口标题

绑定到具体场景元素上。

## 7. timelineConfig

这是可执行时序输入，用来决定“何时出现、出现多久、何时隐藏、何时切换状态”。

### 规范要求

每个事件至少要明确：

- `eventId`
- `sceneId`
- `actions`

### 推荐结构

```ts
type TimelineConfigInput = {
  timelines: Array<{
    eventId: string;
    sceneId: string;
    actions: Array<{
      targetId: string;
      action: "show" | "hide" | "highlight" | "playAnimation" | "showCopy" | "emit";
      atMs: number;
      durationMs?: number;
      payload?: Record<string, unknown>;
    }>;
  }>;
};
```

### 作用

例如：

- 角色气泡在 0ms 出现，3500ms 后隐藏
- 订单按钮 500ms 时高亮
- 活动入口 1200ms 时弹出提示

## 8. interactionConfig

这是交互绑定输入，用来定义点击、拖拽、悬停、触发器和对应事件。

### 规范要求

每条交互至少要明确：

- `targetId`
- `trigger`
- `effect`

### 推荐结构

```ts
type InteractionConfigInput = {
  bindings: Array<{
    targetId: string;
    trigger: "pointerdown" | "pointerup" | "pointerover" | "drag" | "sceneEnter";
    effect: {
      type: "openPanel" | "emitEvent" | "toggleState" | "startTimeline";
      value: string;
    };
  }>;
};
```

### Phaser 运行时映射

```ts
button.setInteractive();
button.on("pointerdown", () => this.events.emit("open-order-panel"));
```

## 9. lightingRenderConfig（可选）

如果项目明确使用 `Phaser.WEBGL`，可以增加这一层输入，用于控制灯光、shader 和后处理。

官方参考：

- Phaser LightPipeline：
  https://docs.phaser.io/api-documentation/class/renderer-webgl-pipelines-lightpipeline

### 推荐结构

```ts
type LightingRenderConfigInput = {
  lights?: Array<{
    lightId: string;
    sceneId: string;
    x: number;
    y: number;
    radius: number;
    intensity: number;
    color: string;
  }>;
  postFx?: Array<{
    sceneId: string;
    effect: "bloom" | "colorShift" | "vignette";
    strength: number;
  }>;
  pipelines?: Array<{
    sceneId: string;
    pipelineKey: string;
    targets: string[];
  }>;
};
```

### 适用边界

对于当前小范围测试的 2D 模拟经营原型，建议先使用：

- 局部高亮
- 活动入口发光
- UI 轻量强调

而不要一开始就追求重型光照系统。

## 10. 本项目推荐的最终 Phaser 输入总结构

结合上面 7+1 层，建议主 Agent 最终交给 HTML5 原型工具的数据结构如下：

```ts
type PhaserWebGLProjectInput = {
  gameConfig: GameConfigInput;
  sceneDefinitions: SceneDefinition[];
  assetManifest: AssetManifestInput;
  layoutConfig: LayoutConfigInput;
  copywritingConfig: CopywritingConfigInput;
  timelineConfig: TimelineConfigInput;
  interactionConfig: InteractionConfigInput;
  lightingRenderConfig?: LightingRenderConfigInput;
};
```

## 11. 与当前 Agent 工具链的映射建议

为了让现有 Agent 输出真正能进入 Phaser，建议按下表映射：

| Agent 工具 | 主要产物 | 最终进入 Phaser 的哪层 |
| --- | --- | --- |
| `scene_design_tool` | 场景区域、热区、展示点 | `sceneDefinitions` + `layoutConfig` + `interactionConfig` |
| `ui_architecture_tool` | 面板、按钮、入口结构 | `layoutConfig` + `copywritingConfig` + `interactionConfig` |
| `story_tool` | 章节锚点、活动包装 | `copywritingConfig` + `timelineConfig` |
| `character_tool` | 角色卡、角色职责、角色气泡目标 | `layoutConfig` + `copywritingConfig` + `timelineConfig` |
| `asset_manifest_tool` | 素材清单、资源规格 | `assetManifest` |
| `copywriting_tool` | 页面文案、按钮文案、气泡文案 | `copywritingConfig` |
| 未来 `layout_tool` | 坐标与层级 | `layoutConfig` |
| 未来 `timeline_tool` | 出现时机与持续时长 | `timelineConfig` |

## 12. 最小可落地原则

当前阶段，不建议让 Agent 直接输出 Phaser 代码作为第一步，而是先稳定输出这几份 JSON：

1. `assets.json`
2. `layout.json`
3. `copywriting.json`
4. `timeline.json`
5. `interaction.json`

然后由一个单独的 `html5_prototype_tool` 或运行时适配层，把这些 JSON 装配成 Phaser Scene。

这样更稳，也更利于一致性检查。

## 13. 一句话结论

Phaser + WebGL 的规范输入不是自然语言，而是：

`GameConfig + SceneDefinition + AssetManifest + Layout + Copywriting + Timeline + Interaction + Optional Lighting`

本项目后续如果要把 Agent 结果直接送进 HTML5 原型生成，应优先围绕这套结构设计工具输出，而不是直接从策划案跳代码。
