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
  projectCode: "\u6e2f\u9547\u8ba1\u5212",
  targetGenre: "\u6a21\u62df\u7ecf\u8425",
  targetPlatform: "\u591a\u7aef",
  targetMarket: "\u4e2d\u56fd\u5927\u9646",
  audiencePositioning:
    "\u9762\u5411\u504f\u7231\u4f4e\u538b\u529b\u4f11\u95f2\u7ecf\u8425\u3001\u88c5\u626e\u6536\u96c6\u548c\u77ed\u65f6\u957f\u56de\u6d41\u7684\u73a9\u5bb6\uff0c\u5e0c\u671b\u6709\u7a33\u5b9a\u7684\u590d\u8bbf\u52a8\u673a\u3002",
  coreFantasy:
    "\u901a\u8fc7\u5e97\u94fa\u5347\u7ea7\u3001\u5c45\u6c11\u4ea4\u4e92\u548c\u8857\u533a\u66f4\u65b0\uff0c\u628a\u8001\u6e2f\u9547\u91cd\u5efa\u6210\u6e29\u6696\u53c8\u6709\u98ce\u683c\u7684\u5ea6\u5047\u76ee\u7684\u5730\u3002",
  monetizationModel: "\u5185\u8d2d",
  benchmarkGames: "\u300a\u52a8\u7269\u9910\u5385\u300b\uff0c\u5f00\u7f57\u7cfb\u7ecf\u8425\u6a21\u62df\uff0c\u4ee5\u88c5\u626e\u4e0e\u5bb6\u56ed\u4e3a\u6838\u5fc3\u7684\u4f11\u95f2\u7ecf\u8425\u4ea7\u54c1",
  requiredSystems:
    "\u6838\u5fc3\u7ecf\u8425\u5faa\u73af\uff0c\u8857\u533a\u6269\u5efa\uff0c\u8ba2\u5355\u4e0e\u76ee\u6807\uff0c\u88c5\u626e\u6536\u96c6\uff0c\u89d2\u8272\u4ea4\u4e92\uff0c\u6d3b\u52a8\u5305\u88c5",
  versionGoal:
    "\u4ea7\u51fa\u4e00\u5957\u8303\u56f4\u53ef\u63a7\u4f46\u5185\u5bb9\u5b8c\u6574\u7684\u9996\u65e5\u7ecf\u8425\u539f\u578b\u5305\uff0c\u8986\u76d6\u8ba2\u5355\u52a8\u673a\u3001\u88c5\u626e\u6536\u96c6\u3001\u89d2\u8272\u4ea4\u4e92\u3001\u6d3b\u52a8\u5305\u88c5\u548c HTML5 \u8fd0\u884c\u65f6\u88c5\u914d\u3002",
  projectStage: "\u5c0f\u8303\u56f4\u6d4b\u8bd5",
  productionConstraints:
    "\u4fdd\u6301\u539f\u578b\u8303\u56f4\u53ef\u63a7\uff0c\u4f46\u4e0d\u80fd\u6f0f\u6389\u8fd0\u884c\u65f6\u627f\u8f7d\u7269\u3002\u9700\u8981\u8986\u76d6\u7ecf\u8425\u5faa\u73af\u3001\u6269\u5efa\u53cd\u9988\u3001\u88c5\u626e\u6536\u96c6\u3001\u89d2\u8272\u4ea4\u4e92\u3001\u6d3b\u52a8\u5305\u88c5\uff0c\u4ee5\u53ca HTML5 \u88c5\u914d\u6240\u9700\u7684\u573a\u666f\u3001UI\u3001\u8d44\u4ea7\u548c\u6587\u6848\u3002\u4e0d\u63a5\u5165\u91cd 3D \u8d44\u6e90\uff0c\u4e0d\u505a\u7ade\u6280\u5bf9\u6297\u7cfb\u7edf\u3002",
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
          \u6a21\u62df\u7ecf\u8425 / \u5c0f\u8303\u56f4\u6d4b\u8bd5
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
          placeholder="\u4f8b\uff1a\u901a\u8fc7\u5347\u7ea7\u548c\u8857\u533a\u66f4\u65b0\uff0c\u628a\u8001\u6e2f\u9547\u91cd\u5efa\u6210\u6e29\u6696\u53c8\u6709\u98ce\u683c\u7684\u5ea6\u5047\u5730\u3002"
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
