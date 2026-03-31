import {
  splitListLikeString,
  cleanStringField,
  cleanStringArrayField,
  cleanObjectArrayField,
  cleanBooleanField,
  cleanEnumField,
} from "./field-normalizers";
import {
  cleanEntityRegistryField,
  normalizeSystemToEntityMapShape,
  buildEntityFromName,
  ensureStringField,
  ensureStringArrayMin,
  ensureObjectArrayMin,
  normalizeAssetType,
  normalizeCharacterRosterItem,
  normalizeEntity,
  buildAnchorSearchKeys,
  buildAssetSearchKeys,
  alignToKnownCandidate,
  buildDefaultCharacterCardFromRoster,
  alignCharacterAnchorsToStory,
  buildEntityIdFromName,
} from "./entity-alignment";

export function cleanupStageSpecificData(stage: string, value: unknown, requestPayload?: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const normalized = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

  if (stage === "planning" && Array.isArray(normalized.taskBreakdown)) {
    normalized.taskBreakdown = normalized.taskBreakdown.map((item) => {
      if (!item || typeof item !== "object") return item;
      const record = { ...(item as Record<string, unknown>) };
      const dependsOnRaw = record.dependsOn;
      const dependsOnList = Array.isArray(dependsOnRaw)
        ? dependsOnRaw
        : typeof dependsOnRaw === "string"
          ? splitListLikeString(dependsOnRaw)
          : [];

      record.dependsOn = dependsOnList
        .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry ?? "").trim()))
        .filter((entry) => entry.length >= 2 && !["无", "无依赖", "none", "n/a", "-", "--"].includes(entry.toLowerCase()));

      return record;
    });
  }

  if (stage === "intent_recognition") {
    cleanStringField(normalized, "taskDefinition", 220);
    cleanStringArrayField(normalized, "successSignals", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "coreConstraints", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "riskHypotheses", { min: 4, max: 120, maxItems: 5 });
    cleanStringArrayField(normalized, "recommendedFlow", { min: 2, max: 60, maxItems: 10 });
  }

  if (stage === "planning") {
    cleanStringField(normalized, "goalUnderstanding", 260);
    cleanStringArrayField(normalized, "successCriteria", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "keyRisks", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "checklist", { min: 4, max: 120, maxItems: 8 });
    cleanStringField(normalized, "nextDecision", 180);
    cleanObjectArrayField(normalized, "parallelPlan", 6, (item) => {
      cleanStringField(item, "batchName", 40);
      cleanStringArrayField(item, "tools", { min: 2, max: 40, maxItems: 6 });
      cleanStringField(item, "reason", 140);
      return item;
    });
    cleanObjectArrayField(normalized, "taskBreakdown", 10, (item) => {
      cleanStringField(item, "step", 40);
      cleanStringField(item, "purpose", 140);
      cleanStringField(item, "output", 140);
      cleanStringArrayField(item, "dependsOn", { min: 2, max: 40, maxItems: 4 });
      return item;
    });
  }

  if (stage === "tool_selection") {
    cleanStringField(normalized, "roundGoal", 180);
    cleanStringArrayField(normalized, "toolQueue", { min: 2, max: 40, maxItems: 9 });
    cleanStringArrayField(normalized, "callReasons", { min: 4, max: 160, maxItems: 9 });
    cleanObjectArrayField(normalized, "parallelBatches", 6, (item) => {
      cleanStringField(item, "batchName", 40);
      cleanStringArrayField(item, "tools", { min: 2, max: 40, maxItems: 5 });
      cleanStringField(item, "dependency", 120);
      return item;
    });
  }

  if (stage === "gameplay_tool") {
    cleanStringField(normalized, "oneSentenceLoop", 180);
    cleanStringArrayField(normalized, "mainLoop", { min: 4, max: 120, maxItems: 7 });
    cleanStringArrayField(normalized, "subLoops", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "clickPath", { min: 4, max: 120, maxItems: 8 });
    cleanStringArrayField(normalized, "feedbackRhythm", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "failRecover", { min: 4, max: 120, maxItems: 5 });
    cleanStringArrayField(normalized, "testFocus", { min: 4, max: 120, maxItems: 6 });
    cleanEntityRegistryField(normalized, "loopEntities", "facility", 16);
    cleanObjectArrayField(normalized, "loopActions", 16, (item) => {
      cleanStringField(item, "actionId", 40);
      cleanStringField(item, "actorEntityId", 40);
      cleanStringField(item, "targetEntityId", 40);
      cleanStringField(item, "outcome", 120);
      return item;
    });
    if (!Array.isArray(normalized.loopEntities) || normalized.loopEntities.length === 0) {
      const loopNames = Array.isArray(normalized.mainLoop)
        ? normalized.mainLoop.filter((item): item is string => typeof item === "string").slice(0, 3)
        : [];
      normalized.loopEntities = loopNames.map((item, index) => buildEntityFromName(item, "facility", index));
    }
  }

  if (stage === "economy_tool") {
    cleanStringField(normalized, "orderCostLoop", 220);
    cleanStringArrayField(normalized, "coreCurrencies", { min: 2, max: 40, maxItems: 6 });
    cleanStringArrayField(normalized, "faucets", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "sinks", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "upgradeThresholds", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "decorationUnlocks", { min: 4, max: 120, maxItems: 5 });
    cleanStringArrayField(normalized, "monetizationHooks", { min: 4, max: 120, maxItems: 5 });
    cleanStringArrayField(normalized, "pacingControls", { min: 4, max: 120, maxItems: 5 });
  }

  if (stage === "system_design_tool") {
    cleanStringField(normalized, "systemOverview", 240);
    cleanStringField(normalized, "managementSystem", 220);
    cleanStringField(normalized, "expansionSystem", 220);
    cleanStringField(normalized, "missionSystem", 220);
    cleanStringField(normalized, "eventSystem", 220);
    cleanStringField(normalized, "roleInteractionSystem", 220);
    cleanStringField(normalized, "collectionSystem", 220);
    cleanStringField(normalized, "socialLightSystem", 220);
    cleanEntityRegistryField(normalized, "systemEntities", "facility", 20);
    normalizeSystemToEntityMapShape(normalized);
    cleanObjectArrayField(normalized, "systemToEntityMap", 16, (item) => {
      cleanStringField(item, "systemName", 40);
      cleanStringArrayField(item, "entityIds", { min: 2, max: 40, maxItems: 8 });
      cleanStringField(item, "responsibility", 120);
      return item;
    });
  }

  if (stage === "proposal_tool") {
    cleanStringField(normalized, "solutionName", 80);
    cleanStringField(normalized, "projectPositioning", 260);
    cleanStringField(normalized, "designThesis", 220);
    cleanStringField(normalized, "prototypeScope", 220);
    cleanStringArrayField(normalized, "keyValidationMetrics", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "majorRisks", { min: 4, max: 120, maxItems: 6 });
    cleanStringField(normalized, "roundFocus", 180);
  }

  if (stage === "scene_design_tool") {
    cleanStringField(normalized, "sceneConcept", 180);
    cleanStringArrayField(normalized, "sceneZones", { min: 4, max: 120, maxItems: 7 });
    cleanStringArrayField(normalized, "interactiveAreas", { min: 4, max: 120, maxItems: 8 });
    cleanStringArrayField(normalized, "buildingSlots", { min: 4, max: 120, maxItems: 8 });
    cleanStringArrayField(normalized, "navigationFlow", { min: 4, max: 120, maxItems: 7 });
    cleanStringArrayField(normalized, "stateTransitions", { min: 4, max: 120, maxItems: 7 });
    cleanStringArrayField(normalized, "contentHotspots", { min: 4, max: 120, maxItems: 6 });
    cleanEntityRegistryField(normalized, "sceneEntities", "scene_hotspot", 20);
    cleanObjectArrayField(normalized, "zoneEntityMap", 16, (item) => {
      cleanStringField(item, "zoneName", 60);
      cleanStringArrayField(item, "entityIds", { min: 2, max: 40, maxItems: 8 });
      return item;
    });
    cleanObjectArrayField(normalized, "buildingDefinitions", 12, (item) => {
      cleanStringField(item, "buildingId", 40);
      cleanStringField(item, "buildingName", 40);
      cleanStringField(item, "buildingType", 40);
      cleanStringField(item, "slotName", 60);
      cleanStringField(item, "gameplayPurpose", 120);
      cleanStringField(item, "upgradeHook", 120);
      if (!item.buildingId && typeof item.buildingName === "string") {
        item.buildingId = buildEntityIdFromName(item.buildingName, "building", 0);
      }
      return item;
    });
  }

  if (stage === "scene_design_patch_tool") {
    cleanStringArrayField(normalized, "preserveEntityIds", { min: 2, max: 40, maxItems: 20 });
    cleanStringArrayField(normalized, "appendSceneZones", { min: 4, max: 120, maxItems: 8 });
    cleanStringArrayField(normalized, "appendInteractiveAreas", { min: 4, max: 120, maxItems: 8 });
    cleanStringArrayField(normalized, "appendBuildingSlots", { min: 4, max: 120, maxItems: 8 });
    cleanStringArrayField(normalized, "appendContentHotspots", { min: 4, max: 120, maxItems: 8 });
    cleanEntityRegistryField(normalized, "appendSceneEntities", "scene_hotspot", 20);
    cleanObjectArrayField(normalized, "appendZoneEntityMap", 16, (item) => {
      cleanStringField(item, "zoneName", 60);
      cleanStringArrayField(item, "entityIds", { min: 2, max: 40, maxItems: 8 });
      return item;
    });
    cleanObjectArrayField(normalized, "appendBuildingDefinitions", 12, (item) => {
      cleanStringField(item, "buildingId", 40);
      cleanStringField(item, "buildingName", 40);
      cleanStringField(item, "buildingType", 40);
      cleanStringField(item, "slotName", 60);
      cleanStringField(item, "gameplayPurpose", 120);
      cleanStringField(item, "upgradeHook", 120);
      if (!item.buildingId && typeof item.buildingName === "string") {
        item.buildingId = buildEntityIdFromName(item.buildingName, "building", 0);
      }
      return item;
    });
  }

  if (stage === "ui_architecture_tool") {
    cleanStringArrayField(normalized, "topBar", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "orderPanel", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "taskPanel", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "shopEntry", { min: 4, max: 120, maxItems: 5 });
    cleanStringArrayField(normalized, "eventEntry", { min: 4, max: 120, maxItems: 5 });
    cleanStringArrayField(normalized, "buildModePanel", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "feedbackLayer", { min: 4, max: 120, maxItems: 6 });
  }

  if (stage === "story_tool") {
    cleanStringField(normalized, "storyPositioning", 120);
    cleanStringField(normalized, "worldSummary", 260);
    cleanStringField(normalized, "coreConflict", 180);
    cleanStringArrayField(normalized, "characterRoster", { min: 2, max: 24, maxItems: 6 });
    if (Array.isArray(normalized.characterRoster)) {
      normalized.characterRoster = normalized.characterRoster
        .map((item) => (typeof item === "string" ? normalizeCharacterRosterItem(item) : ""))
        .filter((item) => item.length >= 2)
        .slice(0, 6);
    }
    ensureStringArrayMin(normalized, "characterRoster", 3, ["林小渔", "阿树", "陈伯"], 24, 6);
    cleanStringArrayField(normalized, "mainPlotBeats", { min: 8, max: 180, maxItems: 6 });
    cleanStringArrayField(normalized, "chapterAnchors", { min: 8, max: 160, maxItems: 6 });
    ensureStringArrayMin(normalized, "mainPlotBeats", 3, ["角色初登场与世界观建立", "核心矛盾爆发与高潮推进", "结局收束与伏笔延伸"], 180, 6);
    ensureStringArrayMin(normalized, "chapterAnchors", 3, ["序章：初到此地", "第一章：站稳脚跟", "第二章：扩展与挑战"], 160, 6);
    cleanStringField(normalized, "emotionalTone", 60);
  }

  if (stage === "character_tool") {
    const storyRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? ((requestPayload as Record<string, unknown>).story as Record<string, unknown> | undefined)
        : undefined;

    cleanObjectArrayField(normalized, "cards", 6, (item) => {
      cleanStringField(item, "entityId", 40);
      cleanStringField(item, "name", 24);
      cleanStringField(item, "characterCategory", 20);
      if ((!item.rolePositioning || String(item.rolePositioning).trim().length < 2) && typeof item.roleType === "string") {
        item.rolePositioning = item.roleType;
      }
      cleanStringField(item, "rolePositioning", 40);
      if ((!Array.isArray(item.personalityTags) || item.personalityTags.length === 0) && Array.isArray(item.personalityTraits)) {
        item.personalityTags = item.personalityTraits;
      }
      cleanStringArrayField(item, "personalityTags", { min: 2, max: 20, maxItems: 5 });
      if ((!item.backgroundSummary || String(item.backgroundSummary).trim().length < 12) && Array.isArray(item.dialogueSnippets)) {
        item.backgroundSummary = String(item.dialogueSnippets[0] ?? "");
      }
      cleanStringField(item, "backgroundSummary", 180);
      if ((!item.interactionResponsibility || String(item.interactionResponsibility).trim().length < 6) && Array.isArray(item.interactionTriggers)) {
        item.interactionResponsibility = (item.interactionTriggers as unknown[]).filter((entry): entry is string => typeof entry === "string").join("；");
      }
      cleanStringField(item, "interactionResponsibility", 140);
      cleanStringField(item, "collectionValue", 140);
      cleanStringArrayField(item, "relatedSystems", { min: 2, max: 40, maxItems: 4 });
      ensureStringArrayMin(item, "relatedSystems", 1, ["核心经营系统"], 40, 4);
      cleanStringArrayField(item, "storyAnchors", { min: 4, max: 80, maxItems: 4 });
      if (storyRecord) {
        const alignedAnchors = alignCharacterAnchorsToStory(
          storyRecord,
          typeof item.name === "string" ? item.name : "",
          Array.isArray(item.storyAnchors) ? item.storyAnchors.filter((entry): entry is string => typeof entry === "string") : [],
        );
        item.storyAnchors = alignedAnchors;
      }
      cleanStringArrayField(item, "visualKeywords", { min: 2, max: 24, maxItems: 8 });
      cleanStringArrayField(item, "spawnContext", { min: 2, max: 60, maxItems: 6 });
      ensureStringArrayMin(item, "spawnContext", 1, ["主场景默认出现"], 60, 6);
      if (!item.entityId && typeof item.name === "string") {
        item.entityId = buildEntityIdFromName(item.name, "character", 0);
      }
      if (!["core", "support", "visitor"].includes(String(item.characterCategory ?? ""))) {
        item.characterCategory = "core";
      }
      return item;
    });
    if (storyRecord && Array.isArray(normalized.cards)) {
      const roster = Array.isArray(storyRecord.characterRoster)
        ? storyRecord.characterRoster.filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
        : [];
      if (roster.length > 0) {
        const unusedCards = [...(normalized.cards as Array<Record<string, unknown>>)];
        const alignedCards = roster.map((rosterName, index) => {
          const matchIndex = unusedCards.findIndex((card) => card.name === rosterName);
          const matched = matchIndex >= 0 ? unusedCards.splice(matchIndex, 1)[0] : unusedCards.shift();
          const card = { ...(matched ?? {}) };
          card.name = rosterName;
          card.entityId = typeof card.entityId === "string" && card.entityId.trim().length >= 2
            ? card.entityId
            : buildEntityIdFromName(rosterName, "character", index);
          if (storyRecord) {
            card.storyAnchors = alignCharacterAnchorsToStory(
              storyRecord,
              rosterName,
              Array.isArray(card.storyAnchors) ? card.storyAnchors.filter((entry): entry is string => typeof entry === "string") : [],
            );
          }
          if (!card.rolePositioning) {
            card.rolePositioning = index === 0 ? "主引导角色" : index === 1 ? "经营陪伴角色" : "活动与装扮角色";
          }
          if (!["core", "support", "visitor"].includes(String(card.characterCategory ?? ""))) {
            card.characterCategory = index < 2 ? "core" : "support";
          }
          return card;
        });
        while (alignedCards.length < roster.length) {
          const rosterName = roster[alignedCards.length];
          alignedCards.push(buildDefaultCharacterCardFromRoster(storyRecord, rosterName, alignedCards.length));
        }
        normalized.cards = alignedCards;
      }
    }
    ensureObjectArrayMin(
      normalized,
      "cards",
      3,
      [
        {
          name: "林澈",
          rolePositioning: "主引导角色",
          personalityTags: ["温和", "可靠", "执行力强"],
          backgroundSummary: "负责带玩家熟悉经营目标、订单循环和首轮扩建节奏。",
          interactionResponsibility: "承担新手引导、阶段目标提示和订单完成反馈。",
          collectionValue: "解锁更多互动台词、主题装扮与成长事件。",
          relatedSystems: ["经营系统", "任务系统", "扩建系统"],
          storyAnchors: ["中央码头开张", "餐饮街试营业"],
          visualKeywords: ["海风短发", "浅蓝围裙", "温暖笑容"],
        },
        {
          name: "周叔",
          rolePositioning: "经营辅助角色",
          personalityTags: ["稳重", "熟练", "务实"],
          backgroundSummary: "熟悉小镇设施与材料流转，负责推动中期扩建和资源补给。",
          interactionResponsibility: "承担扩建提示、资源补给说明和高收益订单解锁。",
          collectionValue: "可解锁限定摊位外观与扩建动画包装。",
          relatedSystems: ["扩建系统", "订单系统", "资源循环"],
          storyAnchors: ["餐饮街试营业", "手作摊主题周"],
          visualKeywords: ["深色工装", "工具腰包", "宽肩轮廓"],
        },
        {
          name: "桃枝",
          rolePositioning: "活动与装扮角色",
          personalityTags: ["活泼", "有创意", "社交感强"],
          backgroundSummary: "负责活动包装与主题装扮，把收集目标和节日氛围接入经营循环。",
          interactionResponsibility: "承担活动入口提示、主题兑换与装扮反馈。",
          collectionValue: "可解锁节日主题装扮与活动限定插图。",
          relatedSystems: ["活动系统", "装扮收集", "角色互动系统"],
          storyAnchors: ["港镇灯会活动", "手作摊主题周"],
          visualKeywords: ["粉橙配色", "灯串饰品", "轻快动作"],
        },
      ],
      6,
    );
    if (Array.isArray(normalized.cards)) {
      normalized.populationSummary = {
        coreCharacterCount: normalized.cards.filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).characterCategory === "core").length,
        supportCharacterCount: normalized.cards.filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).characterCategory === "support").length,
        visitorArchetypeCount: normalized.cards.filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).characterCategory === "visitor").length,
      };
      normalized.entityRegistry = (normalized.cards as Array<Record<string, unknown>>).map((card, index) =>
        buildEntityFromName(
          String(card.name ?? `character_${index + 1}`),
          card.characterCategory === "visitor" ? "visitor" : "character",
          index,
          {
            entityId: typeof card.entityId === "string" ? card.entityId : buildEntityIdFromName(String(card.name ?? `character_${index + 1}`), "character", index),
            functionalRole: typeof card.interactionResponsibility === "string" && card.interactionResponsibility.trim().length >= 4
              ? card.interactionResponsibility
              : `${String(card.name ?? `character_${index + 1}`)} supports role interaction in the prototype.`,
            relatedSystems: Array.isArray(card.relatedSystems) ? card.relatedSystems : [],
          },
        ),
      );
    }
  }

  if (stage === "asset_manifest_tool") {
    cleanStringField(normalized, "visualStyle", 200);
    cleanStringArrayField(normalized, "exportRules", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "layeredRules", { min: 4, max: 120, maxItems: 6 });
    cleanStringArrayField(normalized, "priorityOrder", { min: 2, max: 60, maxItems: 8 });
    cleanObjectArrayField(normalized, "assetGroups", 20, (item) => {
      cleanStringField(item, "assetName", 60);
      item.assetType = normalizeAssetType(item.assetType);
      cleanStringField(item, "assetType", 40);
      cleanStringField(item, "purpose", 120);
      cleanStringField(item, "spec", 80);
      cleanStringField(item, "ratio", 40);
      cleanStringField(item, "layer", 40);
      cleanStringField(item, "namingRule", 80);
      cleanStringField(item, "backgroundRequirement", 80);
      cleanStringArrayField(item, "sourceDependencies", { min: 2, max: 60, maxItems: 5 });
      cleanStringArrayField(item, "entityIds", { min: 2, max: 40, maxItems: 8 });
      cleanStringArrayField(item, "runtimeTargets", { min: 2, max: 80, maxItems: 8 });
      cleanStringField(item, "deliveryScope", 20);
      if (!["scene", "ui", "character", "event", "layout", "timeline"].includes(String(item.deliveryScope ?? ""))) {
        item.deliveryScope = item.assetType === "UI图标" || item.assetType === "UI面板" ? "ui" : item.assetType === "角色立绘" ? "character" : "scene";
      }
      return item;
    });
    if (Array.isArray(normalized.assetGroups)) {
      normalized.entityRegistry = (normalized.assetGroups as Array<Record<string, unknown>>)
        .flatMap((group, index) => {
          const entityIds = Array.isArray(group.entityIds) ? group.entityIds.filter((item): item is string => typeof item === "string" && item.trim().length >= 2) : [];
          if (entityIds.length === 0 && typeof group.assetName === "string") {
            entityIds.push(buildEntityIdFromName(group.assetName, "asset", index));
            group.entityIds = entityIds;
          }
          return entityIds.map((entityId, entityIndex) =>
            buildEntityFromName(entityId, String(group.deliveryScope ?? "scene") === "character" ? "character" : "facility", entityIndex, {
              entityId,
              entityName: entityId,
              functionalRole: typeof group.purpose === "string" ? group.purpose : "Supports runtime asset delivery.",
              requiresAsset: true,
              requiresLayout: ["scene", "character", "layout"].includes(String(group.deliveryScope ?? "scene")),
              requiresCopy: ["ui", "character", "event"].includes(String(group.deliveryScope ?? "scene")),
            }),
          );
        })
        .slice(0, 24);
    }

    const requestRecord =
      requestPayload && typeof requestPayload === "object" && !Array.isArray(requestPayload)
        ? (requestPayload as Record<string, unknown>)
        : undefined;
    const sceneRecord =
      requestRecord?.scene && typeof requestRecord.scene === "object" && !Array.isArray(requestRecord.scene)
        ? (requestRecord.scene as Record<string, unknown>)
        : undefined;
    const sceneEntities = Array.isArray(sceneRecord?.sceneEntities)
      ? sceneRecord.sceneEntities.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const assetGroups = Array.isArray(normalized.assetGroups) ? (normalized.assetGroups as Array<Record<string, unknown>>) : [];

    const assetMatchesUpstreamEntity = (entity: Record<string, unknown>) => {
      const entityKeys = [entity.entityId, entity.entityName]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .map((value) => normalizeEntity(value));
      return assetGroups.some((group) => {
        const groupKeys = [
          ...(Array.isArray(group.entityIds) ? group.entityIds : []),
          ...(Array.isArray(group.sourceDependencies) ? group.sourceDependencies : []),
          ...(Array.isArray(group.runtimeTargets) ? group.runtimeTargets : []),
          typeof group.assetName === "string" ? group.assetName : "",
          typeof group.purpose === "string" ? group.purpose : "",
        ]
          .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
          .map((value) => normalizeEntity(value));
        return entityKeys.some((entityKey) =>
          groupKeys.some((groupKey) => groupKey === entityKey || groupKey.includes(entityKey) || entityKey.includes(groupKey)),
        );
      });
    };

    const requiredSceneAssets = sceneEntities.filter((entity) => entity.requiresAsset === true);
    const missingSceneAssets = requiredSceneAssets.filter((entity) => !assetMatchesUpstreamEntity(entity));
    if (missingSceneAssets.length > 0) {
      throw new Error(
        `asset_manifest_tool 未覆盖这些 requiresAsset 场景实体：${missingSceneAssets
          .slice(0, 6)
          .map((entity) => String(entity.entityId ?? entity.entityName ?? "unknown"))
          .join("、")}`,
      );
    }

    const visibleResourceEntities = requiredSceneAssets.filter((entity) => {
      const entityType = typeof entity.entityType === "string" ? entity.entityType : "";
      const combined = [entity.entityId, entity.entityName, entity.functionalRole, ...(Array.isArray(entity.relatedSystems) ? entity.relatedSystems : [])]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .join(" ");
      return entityType === "resource_token" && /(event|festival|reward|coin|currency|token|voucher|ticket|积分|代币|港币|许可券|奖励)/i.test(combined);
    });

    const missingVisibleResourceAssets = visibleResourceEntities.filter((entity) => {
      const entityKeys = [entity.entityId, entity.entityName]
        .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
        .map((value) => normalizeEntity(value));
      return !assetGroups.some((group) => {
        const deliveryScope = typeof group.deliveryScope === "string" ? group.deliveryScope : "";
        if (!["ui", "event", "scene"].includes(deliveryScope)) return false;
        const groupKeys = [
          ...(Array.isArray(group.entityIds) ? group.entityIds : []),
          ...(Array.isArray(group.sourceDependencies) ? group.sourceDependencies : []),
          ...(Array.isArray(group.runtimeTargets) ? group.runtimeTargets : []),
          typeof group.assetName === "string" ? group.assetName : "",
          typeof group.purpose === "string" ? group.purpose : "",
        ]
          .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
          .map((value) => normalizeEntity(value));
        return entityKeys.some((entityKey) =>
          groupKeys.some((groupKey) => groupKey === entityKey || groupKey.includes(entityKey) || entityKey.includes(groupKey)),
        );
      });
    });

    if (missingVisibleResourceAssets.length > 0) {
      throw new Error(
        `asset_manifest_tool 未为可见资源实体生成明确载体：${missingVisibleResourceAssets
          .slice(0, 6)
          .map((entity) => String(entity.entityId ?? entity.entityName ?? "unknown"))
          .join("、")}`,
      );
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
    const storyRecord =
      requestRecord?.story && typeof requestRecord.story === "object" && !Array.isArray(requestRecord.story)
        ? (requestRecord.story as Record<string, unknown>)
        : undefined;
    const economyRecord =
      requestRecord?.economy && typeof requestRecord.economy === "object" && !Array.isArray(requestRecord.economy)
        ? (requestRecord.economy as Record<string, unknown>)
        : undefined;
    const assetManifestRecord =
      requestRecord?.assetManifest && typeof requestRecord.assetManifest === "object" && !Array.isArray(requestRecord.assetManifest)
        ? (requestRecord.assetManifest as Record<string, unknown>)
        : undefined;
    const characterCards = Array.isArray(requestRecord?.characters)
      ? requestRecord.characters.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      : [];
    const sceneTargets = [
      ...(Array.isArray(sceneRecord?.interactiveAreas) ? sceneRecord.interactiveAreas : []),
      ...(Array.isArray(sceneRecord?.contentHotspots) ? sceneRecord.contentHotspots : []),
    ].filter((item): item is string => typeof item === "string" && item.trim().length >= 2);
    const storyRoster = Array.isArray(storyRecord?.characterRoster)
      ? storyRecord.characterRoster.filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
      : [];
    const storyAnchors = [
      ...(Array.isArray(storyRecord?.chapterAnchors) ? storyRecord.chapterAnchors : []),
      ...(Array.isArray(storyRecord?.mainPlotBeats) ? storyRecord.mainPlotBeats : []),
    ].filter((item): item is string => typeof item === "string" && item.trim().length >= 4);
    const priorityAssets = Array.isArray(assetManifestRecord?.priorityOrder)
      ? assetManifestRecord.priorityOrder.filter((item): item is string => typeof item === "string" && item.trim().length >= 2).slice(0, 6)
      : [];
    const economyTerms = Array.from(
      new Set(
        [
          ...(Array.isArray(economyRecord?.coreCurrencies) ? economyRecord.coreCurrencies : []),
          ...(Array.isArray(economyRecord?.monetizationHooks) ? economyRecord.monetizationHooks : []),
          ...(Array.isArray(economyRecord?.decorationUnlocks) ? economyRecord.decorationUnlocks : []),
        ]
          .filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
          .filter((item) => /(券|币|票|装扮|头像框|礼包|voucher|ticket|coin|currency|bundle|decoration)/i.test(item)),
      ),
    ).slice(0, 8);

    const cleanCopyItem = (item: Record<string, unknown>) => {
      cleanStringField(item, "id", 60);
      cleanStringField(item, "surface", 20);
      cleanStringField(item, "target", 80);
      cleanStringField(item, "text", 140);
      cleanStringField(item, "usage", 80);
      cleanStringField(item, "tone", 40);
      cleanStringField(item, "relatedEntity", 60);
      if (typeof item.target === "string" && sceneTargets.length > 0) {
        item.target = alignToKnownCandidate(item.target, sceneTargets);
      }
      if (typeof item.relatedEntity === "string" && storyAnchors.length > 0) {
        const alignedAnchor = alignToKnownCandidate(item.relatedEntity, storyAnchors);
        if (alignedAnchor && alignedAnchor !== item.relatedEntity && normalizeEntity(alignedAnchor).length >= normalizeEntity(String(item.relatedEntity)).length) {
          item.relatedEntity = alignedAnchor;
        }
      }
      cleanStringField(item, "relatedEntity", 60);
      return item;
    };

    cleanObjectArrayField(normalized, "pageTitles", 8, cleanCopyItem);
    cleanObjectArrayField(normalized, "panelTitles", 12, cleanCopyItem);
    cleanObjectArrayField(normalized, "buttonLabels", 16, cleanCopyItem);
    cleanObjectArrayField(normalized, "taskAndOrderCopy", 16, cleanCopyItem);
    cleanObjectArrayField(normalized, "eventEntryCopy", 12, cleanCopyItem);
    cleanObjectArrayField(normalized, "sceneHints", 16, cleanCopyItem);
    cleanObjectArrayField(normalized, "characterLines", 16, cleanCopyItem);
    cleanObjectArrayField(normalized, "characterCardCopy", 12, cleanCopyItem);
    cleanObjectArrayField(normalized, "assetLabels", 16, cleanCopyItem);

    const pageTitles = Array.isArray(normalized.pageTitles) ? normalized.pageTitles : [];
    const panelTitles = Array.isArray(normalized.panelTitles) ? normalized.panelTitles : [];
    const buttonLabels = Array.isArray(normalized.buttonLabels) ? normalized.buttonLabels : [];
    const taskAndOrderCopy = Array.isArray(normalized.taskAndOrderCopy) ? normalized.taskAndOrderCopy : [];
    const eventEntryCopy = Array.isArray(normalized.eventEntryCopy) ? normalized.eventEntryCopy : [];
    const sceneHintsNormalized = Array.isArray(normalized.sceneHints) ? normalized.sceneHints : [];
    const characterLines = Array.isArray(normalized.characterLines) ? normalized.characterLines : [];
    const characterCardCopy = Array.isArray(normalized.characterCardCopy) ? normalized.characterCardCopy : [];
    const assetLabels = Array.isArray(normalized.assetLabels) ? normalized.assetLabels : [];
    const copyText = normalizeEntity(
      JSON.stringify(
        [
          ...pageTitles,
          ...panelTitles,
          ...buttonLabels,
          ...taskAndOrderCopy,
          ...eventEntryCopy,
          ...sceneHintsNormalized,
          ...characterLines,
          ...characterCardCopy,
          ...assetLabels,
        ],
        null,
        0,
      ),
    );

    const missingRosterNames = storyRoster.filter((name) => !copyText.includes(normalizeEntity(name)));
    if (missingRosterNames.length > Math.max(1, Math.floor(storyRoster.length / 3))) {
      console.warn(`[copywriting_tool] 未覆盖这些核心角色名（交由一致性检查修复）：${missingRosterNames.slice(0, 6).join("、")}`);
    }

    const missingCharacterCards = characterCards
      .map((card) => (typeof card.name === "string" ? card.name.trim() : ""))
      .filter((name) => name.length >= 2)
      .filter((name) => !copyText.includes(normalizeEntity(name)));
    if (missingCharacterCards.length > Math.max(1, Math.floor(characterCards.length / 3))) {
      console.warn(`[copywriting_tool] 未覆盖这些角色资料卡角色（交由一致性检查修复）：${missingCharacterCards.slice(0, 6).join("、")}`);
    }

    const missingStoryAnchors = storyAnchors
      .slice(0, 6)
      .filter((anchor) => buildAnchorSearchKeys(anchor).every((key) => !copyText.includes(key)));
    if (missingStoryAnchors.length > Math.max(1, Math.floor(storyAnchors.length / 3))) {
      console.warn(`[copywriting_tool] 未覆盖这些剧情锚点（交由一致性检查修复）：${missingStoryAnchors.slice(0, 4).join("、")}`);
    }

    const assetLabelText = normalizeEntity(JSON.stringify(assetLabels, null, 0));
    const missingPriorityAssets = priorityAssets.filter((assetName) => buildAssetSearchKeys(assetName).every((key) => !assetLabelText.includes(key) && !copyText.includes(key)));
    if (missingPriorityAssets.length > Math.max(1, Math.floor(priorityAssets.length / 3))) {
      console.warn(`[copywriting_tool] 未覆盖这些优先资产标签（交由一致性检查修复）：${missingPriorityAssets.slice(0, 6).join("、")}`);
    }

    const economyTermMatches = (term: string): boolean => {
      const full = normalizeEntity(term);
      if (full.length >= 2 && copyText.includes(full)) return true;
      // For long compound descriptions, split aggressively into sub-phrases and check matches
      const segments = term
        .split(/[:：、，,；;+\s×x与和或及含需通过]+|\d+[张个次枚份套组]?/)
        .map((s) => normalizeEntity(s.trim()))
        .filter((s) => s.length >= 2);
      if (segments.length <= 1) return false;
      // Consider matched if at least one segment (or a core sub-phrase of a long segment) appears
      return segments.some((seg) => {
        if (copyText.includes(seg)) return true;
        // For long segments (>6 chars), try trimming trailing action verbs and re-check
        if (seg.length > 6) {
          const trimmed = seg.replace(/(兑换|解锁|获取|购买|抽取|合成|升级)$/, "");
          if (trimmed.length >= 2 && trimmed !== seg && copyText.includes(trimmed)) return true;
          // Also try matching the copy text containing a prefix of this segment (≥4 chars)
          for (let len = Math.min(seg.length - 1, 8); len >= 4; len--) {
            if (copyText.includes(seg.slice(0, len))) return true;
          }
        }
        return false;
      });
    };
    const missingEconomyTerms = economyTerms.filter((term) => !economyTermMatches(term));
    if (missingEconomyTerms.length > Math.max(2, Math.ceil(economyTerms.length / 2))) {
      console.warn(`[copywriting_tool] 未显式暴露这些经济词汇或挂点（交由一致性检查修复）：${missingEconomyTerms.slice(0, 6).join("、")}`);
    }
  }

  if (stage === "evaluate") {
    if (!normalized.hardGates || typeof normalized.hardGates !== "object" || Array.isArray(normalized.hardGates)) {
      normalized.hardGates = {};
    }
    const hardGates = normalized.hardGates as Record<string, unknown>;
    hardGates.loopsClear = typeof hardGates.loopsClear === "boolean" ? hardGates.loopsClear : true;
    hardGates.economyClosedLoop = typeof hardGates.economyClosedLoop === "boolean" ? hardGates.economyClosedLoop : true;
    hardGates.systemCoverage = typeof hardGates.systemCoverage === "boolean" ? hardGates.systemCoverage : true;
    hardGates.sceneUiReady = typeof hardGates.sceneUiReady === "boolean" ? hardGates.sceneUiReady : true;
    hardGates.storyCharacterAligned = typeof hardGates.storyCharacterAligned === "boolean" ? hardGates.storyCharacterAligned : true;
    hardGates.assetManifestExecutable = typeof hardGates.assetManifestExecutable === "boolean" ? hardGates.assetManifestExecutable : true;
    cleanStringArrayField(normalized, "blockedBy", { min: 3, max: 180, maxItems: 10 });
    if (Array.isArray(normalized.blockedBy)) {
      normalized.blockedBy = normalized.blockedBy.slice(0, 10);
    }
    cleanStringField(normalized, "summary", 260);
    cleanStringArrayField(normalized, "risks", { min: 4, max: 160, maxItems: 6 });
    cleanStringArrayField(normalized, "recommendations", { min: 4, max: 160, maxItems: 6 });
  }

  if (stage === "verification") {
    cleanStringField(normalized, "summary", 220);
    cleanStringArrayField(normalized, "repairFocus", { min: 4, max: 120, maxItems: 6 });
    cleanStringField(normalized, "recommendedNextStep", 160);
    ensureStringField(normalized, "recommendedNextStep", "进入返修并重新评估。", 8, 160);
  }

  if (stage === "repair_tool") {
    cleanStringField(normalized, "rationale", 220);
    cleanStringArrayField(normalized, "stopConditions", { min: 6, max: 180, maxItems: 6 });
    cleanStringArrayField(normalized, "recheckEdges", { min: 2, max: 80, maxItems: 16 });
    cleanObjectArrayField(normalized, "selectedTargets", 4, (item) => {
      cleanStringField(item, "toolName", 40);
      cleanStringField(item, "whyThisTool", 220);
      cleanStringArrayField(item, "expectedImpact", { min: 4, max: 180, maxItems: 8 });
      cleanStringArrayField(item, "relatedTaskEdges", { min: 2, max: 80, maxItems: 8 });
      return item;
    });
    cleanStringField(normalized, "repairGoal", 160);
    cleanStringField(normalized, "repairInstructions", 260);
    cleanStringArrayField(normalized, "repairTools", { min: 2, max: 40, maxItems: 5 });
    cleanStringArrayField(normalized, "expectedImprovements", { min: 4, max: 120, maxItems: 6 });
    ensureStringArrayMin(
      normalized,
      "stopConditions",
      2,
      ["关键失败边全部通过复检。", "返修输出满足成功条件并可进入下一阶段。"],
      180,
      6,
    );
  }

  if (stage === "semantic_consistency_tool") {
    cleanStringField(normalized, "summary", 220);
    cleanObjectArrayField(normalized, "edges", 16, (item) => {
      cleanStringField(item, "edgeId", 80);
      cleanStringField(item, "sourceTool", 40);
      cleanStringField(item, "targetTool", 40);
      cleanStringArrayField(item, "issues", { min: 4, max: 220, maxItems: 12 });
      cleanStringArrayField(item, "evidence", { min: 2, max: 220, maxItems: 12 });
      cleanStringArrayField(item, "repairSuggestions", { min: 4, max: 220, maxItems: 8 });
        cleanStringArrayField(item, "involvedTools", { min: 2, max: 40, maxItems: 4 });
        if (Array.isArray(item.problemLocationHints)) {
          item.problemLocationHints = item.problemLocationHints.map((hint: Record<string, unknown>) => {
            cleanStringField(hint, "toolName", 40);
            cleanStringField(hint, "reason", 220);
            cleanEnumField(hint, "confidence", ["low", "medium", "high"], "medium");
            return hint;
          });
        }
        return item;
      });
  }

  if (stage === "consistency_repair_planner") {
    cleanStringField(normalized, "rationale", 220);
    cleanStringArrayField(normalized, "stopConditions", { min: 6, max: 180, maxItems: 6 });
    cleanStringArrayField(normalized, "recheckEdges", { min: 2, max: 80, maxItems: 16 });
    cleanObjectArrayField(normalized, "selectedTargets", 4, (item) => {
      cleanStringField(item, "toolName", 40);
      cleanStringField(item, "whyThisTool", 220);
      cleanStringArrayField(item, "expectedImpact", { min: 4, max: 180, maxItems: 8 });
      cleanStringArrayField(item, "relatedTaskEdges", { min: 2, max: 80, maxItems: 8 });
      return item;
    });
    cleanStringField(normalized, "repairGoal", 160);
    cleanStringField(normalized, "repairInstructions", 260);
    cleanStringArrayField(normalized, "repairTools", { min: 2, max: 40, maxItems: 4 });
    cleanStringArrayField(normalized, "expectedImprovements", { min: 4, max: 120, maxItems: 6 });
    ensureStringArrayMin(
      normalized,
      "stopConditions",
      2,
      ["关键失败边全部通过复检。", "返修输出满足成功条件并可进入下一阶段。"],
      180,
      6,
    );
  }

  if (stage === "local_repair_decision_tool") {
    cleanBooleanField(normalized, "shouldRepairNow", false);
    cleanStringField(normalized, "rationale", 260);
    cleanStringField(normalized, "whyTheseTargets", 260);
    cleanStringField(normalized, "whyNotOtherTargets", 260);
    cleanStringField(normalized, "costReasoning", 260);
    cleanStringArrayField(normalized, "successConditions", { min: 6, max: 180, maxItems: 8 });
    cleanStringArrayField(normalized, "expectedImpact", { min: 4, max: 180, maxItems: 8 });
    cleanStringArrayField(normalized, "selectedTargets", { min: 2, max: 40, maxItems: 6 });
    cleanStringArrayField(normalized, "recheckEdges", { min: 2, max: 80, maxItems: 16 });
  }

  return normalized;
}

