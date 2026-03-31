"use client";

import type { PersonaInput } from "@/lib/schemas";

type PersonaFormProps = {
  persona: PersonaInput;
  isRunning: boolean;
  onChange: (persona: PersonaInput) => void;
  onPreset: (persona: PersonaInput) => void;
  onSubmit: () => void;
};

const simulationPreset: PersonaInput = {
  projectCode: "星野营地",
  targetGenre: "模拟经营",
  targetPlatform: "多端",
  targetMarket: "中国大陆",
  audiencePositioning:
    "面向喜爱户外露营、自然治愈和轻度社交互动的休闲玩家，偏好短时长回合和季节收集驱动的复访节奏。",
  coreFantasy:
    "在山间星空下经营一座野营地，搭建帐篷、篝火料理、星象观测，把荒野山谷打造成旅人向往的治愈目的地。",
  monetizationModel: "内购",
  benchmarkGames: "《小森生活》，《Cozy Grove》，以露营和自然探索为核心的休闲经营产品",
  requiredSystems:
    "营地经营循环，设施搭建与升级，旅人接待与任务，装备与食谱收集，季节活动包装，角色交互",
  versionGoal:
    "产出一套范围可控但内容完整的首日营地经营原型包，覆盖旅人接待、篝火料理、设施升级、季节活动和 HTML5 运行时装配。",
  projectStage: "小范围测试",
  productionConstraints:
    "保持原型范围可控，但不能漏掉运行时承载物。需要覆盖营地经营循环、设施搭建反馈、装备食谱收集、角色交互、季节活动包装，以及 HTML5 装配所需的场景、UI、资产和文案。不接入重 3D 资源，不做竞技对抗系统。",
};

const platformOptions: PersonaInput["targetPlatform"][] = ["iOS", "Android", "\u591a\u7aef"];
const marketOptions: PersonaInput["targetMarket"][] = ["\u4e2d\u56fd\u5927\u9646", "\u6e2f\u6fb3\u53f0", "\u5168\u7403"];
const monetizationOptions: PersonaInput["monetizationModel"][] = ["\u5185\u8d2d", "\u6df7\u5408\u53d8\u73b0", "\u5e7f\u544a"];

function updateField<K extends keyof PersonaInput>(persona: PersonaInput, key: K, value: PersonaInput[K], onChange: (next: PersonaInput) => void) {
  onChange({ ...persona, [key]: value });
}

export function PersonaForm({ persona, isRunning, onChange, onPreset, onSubmit }: PersonaFormProps) {
  return (
    <div className="panel form-panel">
      <div className="panel-head">
        <span className="panel-tag">输入</span>
        <h2 className="panel-title">项目简报</h2>
      </div>

      <div className="field">
        <label htmlFor="simulationPreset">当前测试案例</label>
        <button id="simulationPreset" className="button button-secondary" type="button" onClick={() => onPreset(simulationPreset)}>
          星野营地 / 小范围测试
        </button>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="projectCode">项目代号</label>
          <input id="projectCode" value={persona.projectCode} onChange={(event) => updateField(persona, "projectCode", event.target.value, onChange)} />
        </div>

        <div className="field">
          <label htmlFor="targetGenre">目标品类</label>
          <input id="targetGenre" value={persona.targetGenre} readOnly />
        </div>

        <div className="field">
          <label htmlFor="targetPlatform">目标平台</label>
          <select
            id="targetPlatform"
            value={persona.targetPlatform}
            onChange={(event) => updateField(persona, "targetPlatform", event.target.value as PersonaInput["targetPlatform"], onChange)}
          >
            {platformOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="targetMarket">目标市场</label>
          <select
            id="targetMarket"
            value={persona.targetMarket}
            onChange={(event) => updateField(persona, "targetMarket", event.target.value as PersonaInput["targetMarket"], onChange)}
          >
            {marketOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="monetizationModel">变现模式</label>
          <select
            id="monetizationModel"
            value={persona.monetizationModel}
            onChange={(event) => updateField(persona, "monetizationModel", event.target.value as PersonaInput["monetizationModel"], onChange)}
          >
            {monetizationOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="projectStage">当前阶段</label>
          <input id="projectStage" value={persona.projectStage} readOnly />
        </div>
      </div>

      <div className="field">
        <label htmlFor="audiencePositioning">目标用户与体验场景</label>
        <textarea
          id="audiencePositioning"
          value={persona.audiencePositioning}
          onChange={(event) => updateField(persona, "audiencePositioning", event.target.value, onChange)}
          placeholder="\u4f8b\uff1a\u4f4e\u538b\u529b\u4f11\u95f2\u7ecf\u8425\u73a9\u5bb6\uff0c\u5355\u5c40\u65f6\u957f\u77ed\uff0c\u6709\u5f3a\u56de\u6d41\u52a8\u673a\uff0c\u559c\u6b22\u88c5\u626e\u548c\u4f19\u4f34\u6c1b\u56f4\u3002"
        />
      </div>

      <div className="field">
        <label htmlFor="coreFantasy">核心幻想与世界观钩子</label>
        <textarea
          id="coreFantasy"
          value={persona.coreFantasy}
          onChange={(event) => updateField(persona, "coreFantasy", event.target.value, onChange)}
          placeholder="例：在山间星空下搭帐篷、篝火料理，把荒野营地打造成旅人向往的治愈目的地。"
        />
      </div>

      <div className="field">
        <label htmlFor="benchmarkGames">参考竞品</label>
        <textarea
          id="benchmarkGames"
          value={persona.benchmarkGames}
          onChange={(event) => updateField(persona, "benchmarkGames", event.target.value, onChange)}
          placeholder="\u4f8b\uff1a2-4 \u6b3e\u8986\u76d6\u7ecf\u8425\u3001\u88c5\u626e\u548c\u6d3b\u52a8\u5305\u88c5\u7684\u53c2\u8003\u4ea7\u54c1\u3002"
        />
      </div>

      <div className="field">
        <label htmlFor="requiredSystems">本轮必须覆盖的系统</label>
        <textarea
          id="requiredSystems"
          value={persona.requiredSystems}
          onChange={(event) => updateField(persona, "requiredSystems", event.target.value, onChange)}
          placeholder="\u4f8b\uff1a\u7ecf\u8425\u5faa\u73af\uff0c\u8857\u533a\u6269\u5efa\uff0c\u8ba2\u5355\u76ee\u6807\uff0c\u88c5\u626e\u6536\u96c6\uff0c\u89d2\u8272\u4ea4\u4e92\uff0c\u6d3b\u52a8\u5305\u88c5\u3002"
        />
      </div>

      <div className="field">
        <label htmlFor="versionGoal">本轮目标</label>
        <textarea
          id="versionGoal"
          value={persona.versionGoal}
          onChange={(event) => updateField(persona, "versionGoal", event.target.value, onChange)}
          placeholder="\u4f8b\uff1a\u9a8c\u8bc1\u9996\u65e5\u7ecf\u8425\u5faa\u73af\uff0c\u8ba2\u5355\u52a8\u673a\uff0c\u88c5\u626e\u6536\u96c6\uff0c\u4ee5\u53ca\u8f7b\u91cf\u6d3b\u52a8\u5305\u88c5\u3002"
        />
      </div>

      <div className="field">
        <label htmlFor="productionConstraints">生产与实装约束</label>
        <textarea
          id="productionConstraints"
          value={persona.productionConstraints}
          onChange={(event) => updateField(persona, "productionConstraints", event.target.value, onChange)}
          placeholder="\u4f8b\uff1a\u8303\u56f4\u53ef\u63a7\u4f46\u5185\u5bb9\u5b8c\u6574\uff1b\u5305\u542b HTML5 \u88c5\u914d\u6240\u9700\u7684\u8fd0\u884c\u65f6\u627f\u8f7d\u7269\u3001\u8d44\u4ea7\u548c\u6587\u6848\uff1b\u4e0d\u4f7f\u7528\u91cd 3D \u8d44\u6e90\u3002"
        />
      </div>

      <div className="actions">
        <button className="button button-primary" type="button" onClick={onSubmit} disabled={isRunning}>
          {isRunning ? "\u8fd0\u884c\u4e2d..." : "\u751f\u6210\u5e76\u8bc4\u5ba1"}
        </button>
      </div>
    </div>
  );
}
