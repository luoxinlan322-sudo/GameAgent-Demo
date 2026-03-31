import {
  normalizeEntity,
  isPlaceholderEntityName,
  isRoleLikeEntity,
  isBuildLikeEntity,
  extractGenreProfileFromPayload,
  buildEntityIdFromName,
} from "./entity-alignment";

export function validateStageSemanticReadiness(stage: string, value: unknown, requestPayload?: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  if (stage === "story_tool") {
    const storyRecord = value as Record<string, unknown>;
    const roster = Array.isArray(storyRecord.characterRoster)
      ? storyRecord.characterRoster.filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
      : [];
    const chapterAnchorsRaw = Array.isArray(storyRecord.chapterAnchors) ? storyRecord.chapterAnchors : [];
    const chapterAnchors = chapterAnchorsRaw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const text = obj.text ?? obj.name ?? obj.title ?? obj.anchor ?? obj.label ?? obj.content;
          if (typeof text === "string") return text;
          const vals = Object.values(obj).filter((v): v is string => typeof v === "string" && v.length >= 4);
          if (vals.length > 0) return vals[0];
        }
        return "";
      })
      .filter((s) => typeof s === "string" && s.trim().length >= 4);
    const mainPlotBeats = Array.isArray(storyRecord.mainPlotBeats)
      ? storyRecord.mainPlotBeats.filter((item): item is string => typeof item === "string" && item.trim().length >= 4)
      : [];
    if (chapterAnchors.length < 1) {
      throw new Error(`剧情锚点数量不足：chapterAnchors 至少需要 3 条，当前仅 ${chapterAnchors.length} 条。`);
    }
    if (mainPlotBeats.length < 1) {
      throw new Error(`剧情节拍数量不足：mainPlotBeats 至少需要 3 条，当前仅 ${mainPlotBeats.length} 条。`);
    }
    const anchorPool = [
      ...chapterAnchors,
      ...mainPlotBeats,
    ];

    const missingRoleReferences = roster.filter((roleName) => {
      const normalizedRole = normalizeEntity(roleName);
      return !anchorPool.some((anchor) => normalizeEntity(anchor).includes(normalizedRole));
    });

    if (missingRoleReferences.length > 0) {
      console.warn(`[story_tool] 剧情锚点未覆盖角色名单（交由一致性检查修复）：${missingRoleReferences.join("、")}`);
    }
  }

  if (stage === "gameplay_tool") {
    const gameplayRecord = value as Record<string, unknown>;
    const loopEntities = Array.isArray(gameplayRecord.loopEntities)
      ? gameplayRecord.loopEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const placeholderNames = loopEntities
      .map((entity) => ({
        entityId: typeof entity.entityId === "string" ? entity.entityId : "",
        entityName: typeof entity.entityName === "string" ? entity.entityName : "",
      }))
      .filter((entity) => entity.entityName && isPlaceholderEntityName(entity.entityName));
    if (placeholderNames.length > 0) {
      throw new Error(
        `gameplay_tool 使用了占位实体名，必须改成可复用的 runtime 名称：${placeholderNames
          .slice(0, 6)
          .map((entity) => `${entity.entityId}/${entity.entityName}`)
          .join("、")}`,
      );
    }
  }

  if (stage === "character_tool") {
    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const storyRecord =
      requestRecord?.story && typeof requestRecord.story === "object" && !Array.isArray(requestRecord.story)
        ? (requestRecord.story as Record<string, unknown>)
        : undefined;
    const roster = Array.isArray(storyRecord?.characterRoster)
      ? storyRecord.characterRoster.filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
      : [];
    const sourceAnchors = [
      ...(Array.isArray(storyRecord?.chapterAnchors) ? storyRecord.chapterAnchors : []),
      ...(Array.isArray(storyRecord?.mainPlotBeats) ? storyRecord.mainPlotBeats : []),
    ].filter((item): item is string => typeof item === "string" && item.trim().length >= 4);
    const cards = Array.isArray((value as Record<string, unknown>).cards)
      ? ((value as Record<string, unknown>).cards as Array<Record<string, unknown>>)
      : [];

    const missingRoster = roster.filter((name) => !cards.some((card) => card.name === name));
    if (missingRoster.length > 0) {
      throw new Error(`角色资料卡缺少核心角色：${missingRoster.join("、")}`);
    }

    const invalidAnchors: string[] = [];
    for (const card of cards) {
      const cardName = typeof card.name === "string" ? card.name : "";
      const cardAnchors = Array.isArray(card.storyAnchors) ? card.storyAnchors.filter((item): item is string => typeof item === "string") : [];
      const unmatched = cardAnchors.filter((anchor) => {
        const normalizedAnchor = normalizeEntity(anchor);
        return !sourceAnchors.some((sourceAnchor) => {
          const normalizedSource = normalizeEntity(sourceAnchor);
          return normalizedSource === normalizedAnchor || normalizedSource.includes(normalizedAnchor) || normalizedAnchor.includes(normalizedSource);
        });
      });
      if (unmatched.length > 0) {
        invalidAnchors.push(`${cardName || "未知角色"}=>${unmatched.join(" / ")}`);
      }
    }
    if (invalidAnchors.length > 0) {
      throw new Error(`角色卡锚点未对齐 story 原文：${invalidAnchors.join("；")}`);
    }
  }

  if (stage === "copywriting_tool") {
    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const sceneRecord =
      requestRecord?.scene && typeof requestRecord.scene === "object" && !Array.isArray(requestRecord.scene)
        ? (requestRecord.scene as Record<string, unknown>)
        : undefined;
    const interactiveAreas = Array.isArray(sceneRecord?.interactiveAreas)
      ? sceneRecord.interactiveAreas.filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
      : [];
    const sceneHints = Array.isArray((value as Record<string, unknown>).sceneHints)
      ? ((value as Record<string, unknown>).sceneHints as Array<Record<string, unknown>>)
      : [];
    const hintTargets = sceneHints
      .map((item) => (typeof item.target === "string" ? item.target : ""))
      .filter((item) => item.length >= 2);
    const norm = (s: string) => s.replace(/[\s_\-]/g, "").toLowerCase();
    const fuzzyMatch = (a: string, b: string) => {
      const na = norm(a), nb = norm(b);
      return na === nb || na.includes(nb) || nb.includes(na);
    };
    const requiredTargets = interactiveAreas.slice(0, Math.min(6, interactiveAreas.length));
    const missingTargets = requiredTargets.filter((target) => !hintTargets.some((ht) => fuzzyMatch(target, ht)));
    if (missingTargets.length > Math.max(1, Math.floor(requiredTargets.length / 3))) {
      console.warn(`[copywriting_tool] sceneHints 未覆盖关键 interactiveAreas（交由一致性检查修复）：${missingTargets.join("、")}`);
    }
  }
  if (stage === "economy_tool") {
    const economyRecord = value as Record<string, unknown>;
    const genreProfile = extractGenreProfileFromPayload(requestPayload);
    const coreCurrencies = Array.isArray(economyRecord.coreCurrencies)
      ? economyRecord.coreCurrencies.filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
      : [];
    const faucets = Array.isArray(economyRecord.faucets)
      ? economyRecord.faucets.filter((item): item is string => typeof item === "string" && item.trim().length >= 4)
      : [];
    const sinks = Array.isArray(economyRecord.sinks)
      ? economyRecord.sinks.filter((item): item is string => typeof item === "string" && item.trim().length >= 4)
      : [];
    const upgradeThresholds = Array.isArray(economyRecord.upgradeThresholds)
      ? economyRecord.upgradeThresholds.filter((item): item is string => typeof item === "string" && item.trim().length >= 4)
      : [];
    const orderCostLoop = typeof economyRecord.orderCostLoop === "string" ? economyRecord.orderCostLoop.trim() : "";
    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const gameplayRecord =
      requestRecord?.gameplay && typeof requestRecord.gameplay === "object" && !Array.isArray(requestRecord.gameplay)
        ? (requestRecord.gameplay as Record<string, unknown>)
        : undefined;
    const loopEntities = Array.isArray(gameplayRecord?.loopEntities)
      ? gameplayRecord.loopEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const tokenEntities = loopEntities.filter((entity) => entity.entityType === "resource_token");

    if (coreCurrencies.length < 3) {
      throw new Error(`economy_tool coreCurrencies 不足，当前仅有 ${coreCurrencies.length} 项。`);
    }
    if (faucets.length < 3 || sinks.length < 3) {
      throw new Error(`economy_tool 收支定义不足：faucets=${faucets.length}, sinks=${sinks.length}。`);
    }
    if (upgradeThresholds.length < 3) {
      throw new Error(`economy_tool upgradeThresholds 不足，当前仅有 ${upgradeThresholds.length} 项。`);
    }
    if ((!genreProfile || genreProfile.requireOrders) && orderCostLoop.length < 24) {
      throw new Error(`economy_tool orderCostLoop 过短，无法证明完整闭环，当前长度为 ${orderCostLoop.length}。`);
    }

    const allEconomyText = [...coreCurrencies, ...faucets, ...sinks, orderCostLoop].join(" ");
    const missingTokens = tokenEntities.filter((entity) => {
      const entityId = typeof entity.entityId === "string" ? normalizeEntity(entity.entityId) : "";
      const entityName = typeof entity.entityName === "string" ? normalizeEntity(entity.entityName) : "";
      const normalizedEcon = normalizeEntity(allEconomyText);
      return entityName.length > 0 && !normalizedEcon.includes(entityName) && !normalizedEcon.includes(entityId);
    });
    if (missingTokens.length > 0) {
      console.warn(`[economy_tool] 未承载部分资源实体（交由一致性检查修复）：${missingTokens.map((entity) => (typeof entity.entityName === "string" ? entity.entityName : "unknown")).join("、")}`);
    }
  }

  if (stage === "system_design_tool") {
    const systemRecord = value as Record<string, unknown>;
    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const gameplayRecord =
      requestRecord?.gameplay && typeof requestRecord.gameplay === "object" && !Array.isArray(requestRecord.gameplay)
        ? (requestRecord.gameplay as Record<string, unknown>)
        : undefined;
    const loopEntities = Array.isArray(gameplayRecord?.loopEntities)
      ? gameplayRecord.loopEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const systemEntities = Array.isArray(systemRecord.systemEntities)
      ? systemRecord.systemEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const systemToEntityMap = Array.isArray(systemRecord.systemToEntityMap)
      ? systemRecord.systemToEntityMap.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];

    const roleLikeLoopEntities = loopEntities.filter(isRoleLikeEntity);
    const buildLikeLoopEntities = loopEntities.filter(isBuildLikeEntity);
    const roleCarriers = systemEntities.filter(isRoleLikeEntity);
    const buildCarriers = systemEntities.filter(isBuildLikeEntity);

    if (roleLikeLoopEntities.length > 0 && roleCarriers.length === 0) {
      throw new Error("system_design_tool 未暴露 visitor/character carriers，无法承接 gameplay 中的人物或访客互动。");
    }

    if (buildLikeLoopEntities.length > 0 && buildCarriers.length === 0) {
      throw new Error("system_design_tool 未暴露 building/facility carriers，无法承接 gameplay 中的经营或扩建对象。");
    }

    const roleCarrierKeys = new Set(
      roleCarriers.flatMap((entity) => {
        const entityId = typeof entity.entityId === "string" ? normalizeEntity(entity.entityId) : "";
        const entityName = typeof entity.entityName === "string" ? normalizeEntity(entity.entityName) : "";
        return [entityId, entityName].filter(Boolean);
      }),
    );

    const roleMappings = systemToEntityMap.filter((item) => {
      const systemName = typeof item.systemName === "string" ? item.systemName.toLowerCase() : "";
      const responsibility = typeof item.responsibility === "string" ? item.responsibility.toLowerCase() : "";
      const entityIds = Array.isArray(item.entityIds)
        ? item.entityIds.filter((value): value is string => typeof value === "string").map((value) => normalizeEntity(value))
        : [];
      const touchesRoleCarrier = entityIds.some((entityId) => roleCarrierKeys.has(entityId));
      const roleSystemSignal = /(role|interaction|event|social|dialogue|visitor|guest|customer|companion|character)/.test(
        `${systemName} ${responsibility}`,
      );
      return touchesRoleCarrier && roleSystemSignal;
    });

    if (roleLikeLoopEntities.length > 0 && roleCarriers.length > 0 && roleMappings.length === 0) {
      throw new Error("system_design_tool 已有 visitor/character carriers，但 systemToEntityMap 未将它们挂入角色互动、事件或其他 loop-facing system。");
    }
  }

  if (stage === "scene_design_patch_tool") {
    const patchRecord = value as Record<string, unknown>;
    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const systemsRecord =
      requestRecord?.systems && typeof requestRecord.systems === "object" && !Array.isArray(requestRecord.systems)
        ? (requestRecord.systems as Record<string, unknown>)
        : undefined;
    const baselineRecord =
      requestRecord?.currentSceneBaseline && typeof requestRecord.currentSceneBaseline === "object" && !Array.isArray(requestRecord.currentSceneBaseline)
        ? (requestRecord.currentSceneBaseline as Record<string, unknown>)
        : undefined;
    const repairFocusRecord =
      requestRecord?.sceneRepairFocus && typeof requestRecord.sceneRepairFocus === "object" && !Array.isArray(requestRecord.sceneRepairFocus)
        ? (requestRecord.sceneRepairFocus as Record<string, unknown>)
        : undefined;

    const systemEntities = Array.isArray(systemsRecord?.systemEntities)
      ? systemsRecord.systemEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const focusMissingEntities = Array.isArray(repairFocusRecord?.missingEntities)
      ? repairFocusRecord.missingEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const focusMissingSceneEntities = Array.isArray(repairFocusRecord?.missingSceneEntities)
      ? repairFocusRecord.missingSceneEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const focusMissingBuildingDefinitions = Array.isArray(repairFocusRecord?.missingBuildingDefinitions)
      ? repairFocusRecord.missingBuildingDefinitions.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const baselineEntities = Array.isArray(baselineRecord?.sceneEntities)
      ? baselineRecord.sceneEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const baselineZoneMappings = Array.isArray(baselineRecord?.zoneEntityMap)
      ? baselineRecord.zoneEntityMap.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const baselineBuildingDefinitions = Array.isArray(baselineRecord?.buildingDefinitions)
      ? baselineRecord.buildingDefinitions.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const appendSceneEntities = Array.isArray(patchRecord.appendSceneEntities)
      ? patchRecord.appendSceneEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const appendZoneEntityMap = Array.isArray(patchRecord.appendZoneEntityMap)
      ? patchRecord.appendZoneEntityMap.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const appendBuildingDefinitions = Array.isArray(patchRecord.appendBuildingDefinitions)
      ? patchRecord.appendBuildingDefinitions.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];

    const resolveFocusEntity = (focusEntity: Record<string, unknown>) => {
      const focusKeys = [focusEntity.entityId, focusEntity.entityName]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .map((value) => normalizeEntity(value));
      return systemEntities.find((entity) => {
        const entityKeys = [entity.entityId, entity.entityName]
          .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
          .map((value) => normalizeEntity(value));
        return focusKeys.some((key) => entityKeys.some((entityKey) => entityKey === key || entityKey.includes(key) || key.includes(entityKey)));
      });
    };

    const focusSystemEntities = [...focusMissingEntities, ...focusMissingSceneEntities, ...focusMissingBuildingDefinitions]
      .map(resolveFocusEntity)
      .filter((entity): entity is Record<string, unknown> => Boolean(entity));

    const hasSceneEntity = (entity: Record<string, unknown>) => {
      const entityKeys = [entity.entityId, entity.entityName]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .map((value) => normalizeEntity(value));
      return [...baselineEntities, ...appendSceneEntities].some((candidate) => {
        const candidateKeys = [candidate.entityId, candidate.entityName]
          .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
          .map((value) => normalizeEntity(value));
        return entityKeys.some((key) => candidateKeys.some((candidateKey) => candidateKey === key || candidateKey.includes(key) || key.includes(candidateKey)));
      });
    };

    const hasZoneMapping = (entity: Record<string, unknown>) => {
      const entityKeys = [entity.entityId, entity.entityName]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .map((value) => normalizeEntity(value));
      return [...baselineZoneMappings, ...appendZoneEntityMap].some((mapping) => {
        const mappingKeys = Array.isArray(mapping.entityIds)
          ? mapping.entityIds.filter((value): value is string => typeof value === "string").map((value) => normalizeEntity(value))
          : [];
        return entityKeys.some((key) => mappingKeys.includes(key));
      });
    };

    const hasBuildingDefinition = (entity: Record<string, unknown>) => {
      const entityKeys = [entity.entityId, entity.entityName]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .map((value) => normalizeEntity(value));
      return [...baselineBuildingDefinitions, ...appendBuildingDefinitions].some((building) => {
        const buildingKeys = [building.buildingId, building.buildingName, building.slotName]
          .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
          .map((value) => normalizeEntity(value));
        return entityKeys.some((key) => buildingKeys.some((buildingKey) => buildingKey === key || buildingKey.includes(key) || key.includes(buildingKey)));
      });
    };

    const missingSceneEntities = focusSystemEntities.filter((entity) => !hasSceneEntity(entity));
    if (missingSceneEntities.length > 0) {
      console.warn(`[scene_design_patch_tool] 未补入 sceneEntities（交由一致性检查修复）：${missingSceneEntities.map((entity) => String(entity.entityId ?? entity.entityName ?? "unknown")).join("、")}`);
    }

    const missingZoneMappings = focusSystemEntities.filter((entity) => !hasZoneMapping(entity));
    if (missingZoneMappings.length > 0) {
      console.warn(`[scene_design_patch_tool] 未补入 zoneEntityMap（交由一致性检查修复）：${missingZoneMappings.map((entity) => String(entity.entityId ?? entity.entityName ?? "unknown")).join("、")}`);
    }

    const missingBuildingDefinitions = focusSystemEntities.filter((entity) => {
      const entityType = typeof entity.entityType === "string" ? entity.entityType : "";
      return entity.requiresLayout === true && ["building", "facility", "activity_carrier"].includes(entityType) && !hasBuildingDefinition(entity);
    });
    if (missingBuildingDefinitions.length > 0) {
      // 自动生成最小且泛化的 buildingDefinitions 补丁，避免直接抛错终止流程。
      // 生成规则：使用现有 entityId/entityName，slotName 用 `<entityId>_slot`，文本保持通用以便跨场景复用。
      for (const ent of missingBuildingDefinitions) {
        const bId = typeof ent.entityId === "string" && ent.entityId.trim().length >= 2 ? ent.entityId : typeof ent.entityName === "string" ? buildEntityIdFromName(ent.entityName, "building", 0) : `building_unknown`;
        const bName = typeof ent.entityName === "string" ? ent.entityName : String(bId);
        const bType = typeof ent.entityType === "string" ? ent.entityType : "facility";
        const slot = `${bId}_slot`;
        const def: Record<string, unknown> = {
          buildingId: bId,
          buildingName: bName,
          buildingType: bType,
          slotName: slot,
          gameplayPurpose: "支持核心交互与布局",
          upgradeHook: "保留扩展接口",
        };
        // 修改本地数组并同步回 patchRecord，后续校验会读取这些值
        appendBuildingDefinitions.push(def);
        if (!Array.isArray(patchRecord.appendBuildingDefinitions)) patchRecord.appendBuildingDefinitions = [];
        (patchRecord.appendBuildingDefinitions as Array<Record<string, unknown>>).push(def);
      }
    }
  }
}

