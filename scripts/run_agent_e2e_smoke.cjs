async function main() {
  const persona = {
    projectCode: "Project Harbor",
    targetGenre: "模拟经营",
    targetPlatform: "多端",
    targetMarket: "中国大陆",
    audiencePositioning: "偏女性向与泛休闲用户，偏好低压力经营、装扮与持续回访。",
    coreFantasy: "把旧港小镇经营成有烟火气和节庆氛围的度假据点。",
    monetizationModel: "内购",
    benchmarkGames: "动物餐厅、梦幻家园、开罗经营系列",
    requiredSystems: "经营循环、区域扩建、订单目标、装扮收集、角色互动、活动包装",
    versionGoal: "验证首日经营循环、订单驱动、扩建反馈、装扮收集和活动包装是否成立。",
    projectStage: "小范围测试",
    productionConstraints:
      "本轮只做小范围测试版本，不接重3D资源，不做复杂剧情分支，剧情与角色主要用于活动包装与互动反馈。",
  };

  const response = await fetch("http://127.0.0.1:3000/api/run-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona }),
  });

  if (!response.ok || !response.body) {
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
      if (event.type === "error") {
        throw new Error(`run-agent stream error: ${event.error}`);
      }
    }
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
