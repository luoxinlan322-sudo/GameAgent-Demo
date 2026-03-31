const E2E_TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || "1200000"); // 20 min default

async function main() {
  const persona = {
    projectCode: "星野营地",
    targetGenre: "模拟经营",
    targetPlatform: "多端",
    targetMarket: "中国大陆",
    audiencePositioning: "面向喜爱户外露营、自然治愈和轻度社交互动的休闲玩家，偏好短时长回合和季节收集驱动的复访节奏。",
    coreFantasy: "在山间星空下经营一座野营地，搭建帐篷、篝火料理、星象观测，把荒野山谷打造成旅人向往的治愈目的地。",
    monetizationModel: "内购",
    benchmarkGames: "小森生活、Cozy Grove、以露营和自然探索为核心的休闲经营产品",
    requiredSystems: "营地经营循环、设施搭建与升级、旅人接待与任务、装备与食谱收集、季节活动包装、角色交互",
    versionGoal: "验证首日营地经营循环、旅人接待驱动、设施升级反馈、装备食谱收集和季节活动包装是否成立。",
    projectStage: "小范围测试",
    productionConstraints:
      "本轮只做小范围测试版本，不接重3D资源，不做复杂剧情分支，剧情与角色主要用于季节活动包装与互动反馈。",
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), E2E_TIMEOUT_MS);

  const response = await fetch("http://127.0.0.1:3000/api/run-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona }),
    signal: controller.signal,
  }).catch((err) => {
    clearTimeout(timeout);
    throw new Error(`run-agent fetch failed: ${err.message}`);
  });

  if (!response.ok || !response.body) {
    clearTimeout(timeout);
    const text = await response.text().catch(() => "");
    throw new Error(`run-agent request failed: ${response.status} ${text}`);
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  const seen = {
    meta: false,
    plan: false,
    generation: false,
    html5Preparation: false,
    evaluation: false,
    consistencyReport: false,
    repairPlan: false,
    phaseContracts: new Set(),
    finalNode: false,
  };
  const fallbacks = [];
  let fatalError = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === "meta") seen.meta = true;
      if (event.type === "plan") seen.plan = true;
      if (event.type === "generation") seen.generation = true;
      if (event.type === "html5_preparation") seen.html5Preparation = true;
      if (event.type === "evaluation") seen.evaluation = true;
      if (event.type === "consistency_report") seen.consistencyReport = true;
      if (event.type === "repair_plan") seen.repairPlan = true;
      if (event.type === "phase_contract") seen.phaseContracts.add(event.contract.phaseId);
      if (event.type === "node" && event.node === "finalize" && event.status === "done") seen.finalNode = true;
      if (event.type === "node" && event.status === "fallback") {
        fallbacks.push({ node: event.node, summary: (event.summary || "").slice(0, 120) });
      }
      if (event.type === "error") {
        fatalError = event.error;
      }
    }
  }

  clearTimeout(timeout);

  // Fatal error means the pipeline itself crashed (not a single tool timeout)
  if (fatalError && !seen.finalNode) {
    throw new Error(`run-agent pipeline fatal error: ${fatalError}`);
  }

  const requiredPhases = ["foundation", "experience", "rendering", "html5_runtime"];
  const missingPhases = requiredPhases.filter((phaseId) => !seen.phaseContracts.has(phaseId));
  if (missingPhases.length > 0) {
    throw new Error(`missing phase contract events: ${missingPhases.join(", ")}`);
  }
  if (!seen.meta || !seen.plan || !seen.generation || !seen.consistencyReport || !seen.evaluation || !seen.html5Preparation || !seen.finalNode) {
    throw new Error(`missing critical events: ${JSON.stringify(seen)}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        phaseContracts: [...seen.phaseContracts],
        sawRepairPlan: seen.repairPlan,
        html5Preparation: seen.html5Preparation,
        evaluation: seen.evaluation,
        fallbackCount: fallbacks.length,
        fallbacks: fallbacks.slice(0, 10),
        fatalError: fatalError || null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
