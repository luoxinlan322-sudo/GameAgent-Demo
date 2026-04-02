/**
 * Quick streaming observability test — logs events in real-time to verify:
 * 1. AsyncGenerator streaming works (events arrive incrementally)
 * 2. Concurrent batch execution (tools in same batch have overlapping timestamps)
 * 3. Pipeline completes end-to-end
 */
const E2E_TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || "2400000");

async function main() {
  const persona = {
    projectCode: "星野营地",
    targetGenre: "模拟经营",
    targetPlatform: "多端",
    targetMarket: "中国大陆",
    audiencePositioning: "面向喜爱户外露营的休闲玩家。",
    coreFantasy: "在山间星空下经营一座野营地。",
    monetizationModel: "内购",
    benchmarkGames: "小森生活",
    requiredSystems: "营地经营循环、设施搭建、旅人接待",
    versionGoal: "验证首日营地经营循环。",
    projectStage: "小范围测试",
    productionConstraints: "本轮只做小范围测试版本。",
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), E2E_TIMEOUT_MS);
  const startTime = Date.now();

  const response = await fetch("http://127.0.0.1:3000/api/run-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona }),
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    clearTimeout(timeout);
    throw new Error(`HTTP ${response.status} ${await response.text().catch(() => "")}`);
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  const toolTimestamps = {};
  let nodeCount = 0;
  let lastEvent = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      lastEvent = event;

      if (event.type === "heartbeat") continue;

      if (event.type === "node") {
        nodeCount++;
        const marker = event.status === "running" ? "▶" : event.status === "done" ? "✓" : event.status === "fallback" ? "⚠" : "✗";
        console.log(`[${elapsed}s] ${marker} ${event.node} (${event.phase}/${event.title}) — ${(event.summary || "").slice(0, 80)}`);

        // Track tool start/end times for concurrency analysis
        if (event.status === "running") {
          toolTimestamps[event.node] = { start: Date.now() };
        } else if (toolTimestamps[event.node]) {
          toolTimestamps[event.node].end = Date.now();
          toolTimestamps[event.node].duration = toolTimestamps[event.node].end - toolTimestamps[event.node].start;
        }
      } else if (event.type === "stage") {
        console.log(`[${elapsed}s] 📍 STAGE: ${event.stage} — ${event.message}`);
      } else if (event.type === "error") {
        console.log(`[${elapsed}s] ❌ ERROR: ${event.error}`);
      } else {
        console.log(`[${elapsed}s] 📦 ${event.type}`);
      }
    }
  }

  clearTimeout(timeout);

  // Concurrency analysis
  console.log("\n═══ Concurrency Analysis ═══");
  const toolNames = Object.keys(toolTimestamps).filter(k => toolTimestamps[k].start && toolTimestamps[k].end);
  const concurrentPairs = [];
  for (let i = 0; i < toolNames.length; i++) {
    for (let j = i + 1; j < toolNames.length; j++) {
      const a = toolTimestamps[toolNames[i]];
      const b = toolTimestamps[toolNames[j]];
      const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      if (overlap > 500) { // >500ms overlap suggests true concurrency
        concurrentPairs.push({ tools: [toolNames[i], toolNames[j]], overlapMs: overlap });
      }
    }
  }
  if (concurrentPairs.length > 0) {
    console.log("Detected concurrent tool pairs:");
    for (const p of concurrentPairs) {
      console.log(`  ${p.tools.join(" + ")} (${(p.overlapMs / 1000).toFixed(1)}s overlap)`);
    }
  } else {
    console.log("No concurrent tool execution detected.");
  }

  // Tool durations
  console.log("\n═══ Tool Durations ═══");
  for (const name of toolNames.sort((a, b) => (toolTimestamps[a].start || 0) - (toolTimestamps[b].start || 0))) {
    const t = toolTimestamps[name];
    console.log(`  ${name}: ${(t.duration / 1000).toFixed(1)}s`);
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n═══ Summary ═══`);
  console.log(`Total: ${totalElapsed}s, Nodes: ${nodeCount}`);
  console.log(`Final event type: ${lastEvent?.type}, stage: ${lastEvent?.stage || "N/A"}`);

  const success = lastEvent?.type === "stage" && lastEvent?.stage === "done";
  console.log(`Result: ${success ? "✅ PASS" : "❌ FAIL"}`);
  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
