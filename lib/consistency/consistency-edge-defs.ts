import type {
  ConsistencyEdgeId,
  GameProposal,
  GameplayStructure,
  EconomyDesign,
  SystemDesign,
  SceneDesign,
  UIInformationArchitecture,
  StoryResult,
  CharacterCard,
  AssetManifest,
  CopywritingPack,
} from "../schemas";
import type { Html5PreparationPackage } from "../html5-render-schemas";
import { ALL_CONSISTENCY_EDGES } from "../agent-execution-config";

export type EdgeReasoning = {
  why: string;
  success: string[];
  strict: string[];
};

export type ConsistencyArtifacts = {
  targetGenre?: string;
  proposal?: GameProposal | null;
  gameplay?: GameplayStructure | null;
  economy?: EconomyDesign | null;
  systems?: SystemDesign | null;
  scene?: SceneDesign | null;
  ui?: UIInformationArchitecture | null;
  story?: StoryResult | null;
  characters?: CharacterCard[] | null;
  assetManifest?: AssetManifest | null;
  copywriting?: CopywritingPack | null;
  html5Preparation?: Html5PreparationPackage | null;
};

export const EDGE_REASONING: Record<ConsistencyEdgeId, EdgeReasoning> = {
  gameplay_economy: { why: "Core loop actions must be backed by rewards, costs, and upgrade progression.", success: ["Loop actions map to economy faucets or sinks.", "Order, upgrade, and decoration progression form a closed loop.", "Failure and recovery do not contradict economy penalties."], strict: ["order", "upgrade", "decoration"] },
  gameplay_system: { why: "Systems should support the core loop rather than sit beside it as disconnected features.", success: ["Loop entities are covered by systems or system-to-entity mappings.", "Expansion, tasks, events, and role interaction connect back to the loop."], strict: ["entityId"] },
  system_scene: { why: "Systems must have scene carriers or the player cannot discover and use them in the runtime prototype.", success: ["Entities that require layout are represented in scene zones, hotspot maps, or building definitions.", "Expansion, event, and role interaction systems have visible scene carriers."], strict: ["entityId", "zoneName", "buildingId"] },
  scene_ui: { why: "Scene hotspots without UI carriers break the interaction path.", success: ["Order, build, and event scene carriers map to UI panels or entries.", "Build mode has a complete panel carrier."], strict: ["buildModePanel"] },
  story_character: { why: "Story and character outputs anchor copy, assets, and interaction. If they diverge, downstream layers drift.", success: ["Story roster names match character cards.", "Character anchors reference valid story anchors or beats.", "Core character cards are referenced by the story roster.", "Character cards contain stable entity identifiers."], strict: ["name", "entityId", "chapterAnchors", "characterRoster"] },
  proposal_asset: { why: "Asset planning must match prototype scope and required entities.", success: ["Required asset-backed entities exist in the manifest.", "The asset manifest stays inside prototype scope."], strict: ["priorityOrder", "entityId", "assetName"] },
  scene_asset: { why: "Scene carriers without assets cannot reach the HTML5 runtime layer.", success: ["Scene zones and hotspots have asset coverage.", "Building definitions have asset coverage."], strict: ["sceneZones", "interactiveAreas", "contentHotspots", "buildingId"] },
  ui_asset: { why: "UI structures without icons, panels, or supporting assets cannot be rendered or tested.", success: ["Order, build, and event UI carriers are backed by UI assets.", "Critical UI entries are represented in the asset manifest."], strict: ["UI图标", "UI面板"] },
  story_asset: { why: "Story anchors need visual carriers to appear in the prototype.", success: ["Key story anchors map to event or art assets."], strict: ["chapterAnchors"] },
  character_asset: { why: "Character cards without portrait or card carriers cannot enter layout or copy layers properly.", success: ["Every core character has asset support.", "Character entities that require assets are represented in the manifest."], strict: ["name", "entityId", "角色立绘"] },
  proposal_story: { why: "Overall product scope and narrative packaging should point in the same direction.", success: ["Story weight and tone fit prototype scope."], strict: [] },
  proposal_ui: { why: "UI weight must match prototype scope.", success: ["UI scope is proportional to the current prototype stage."], strict: [] },
  economy_asset: { why: "Economy hooks such as coupons or themed decorations need visible carriers.", success: ["Economy hooks have supporting asset carriers.", "Decoration and bundle concepts are reflected in the manifest."], strict: ["coupon", "decoration"] },
  story_copywriting: { why: "Story anchors and cast must surface in copy or players cannot perceive narrative progression.", success: ["Core roster names are covered by copy.", "Key chapter anchors or beats are reflected in copy."], strict: ["characterRoster", "chapterAnchors"] },
  character_copywriting: { why: "Character cards without copy coverage leave the cast invisible to the player.", success: ["Every core character has at least one visible copy carrier."], strict: ["name"] },
  scene_copywriting: { why: "Hotspots need guidance copy so players can discover interactions.", success: ["Critical hotspots or content points are covered by scene hints or entry copy."], strict: ["interactiveAreas", "contentHotspots"] },
  ui_copywriting: { why: "UI carriers without copy cannot explain actions.", success: ["Order, build, and event UI entries have matching copy."], strict: ["targetId"] },
  asset_copywriting: { why: "Asset naming and visible labels should align.", success: ["Priority assets have matching labels or copy references."], strict: ["assetName"] },
  economy_copywriting: { why: "Economy terms need visible labels or CTAs to be testable by users.", success: ["Economy hooks and currencies are covered by copy."], strict: ["currency", "coupon", "decoration"] },
  proposal_copywriting: { why: "Copy volume and tone should stay inside prototype scope.", success: ["Copy remains proportional to the prototype stage and round goal."], strict: [] },
  gameplay_copywriting: { why: "Loop goals should be reflected in orders, tasks, or CTA copy.", success: ["Main loop actions are represented in order or task copy."], strict: [] },
  system_copywriting: { why: "System terminology should be understandable at the copy layer.", success: ["System concepts are visible through copy, tasks, and entries."], strict: [] },
  scene_layout: { why: "Scene carriers must exist in layout or the runtime has no renderable target.", success: ["Scene zones and interactive areas are represented in layout targets.", "Key scene carriers have layout positions."], strict: ["sceneZones", "interactiveAreas", "targetId"] },
  ui_layout: { why: "UI carriers must exist in layout for runtime composition.", success: ["Order, task, event, and build carriers are represented in layout."], strict: ["topBar", "orderPanel", "taskPanel", "eventEntry", "buildModePanel"] },
  character_layout: { why: "Characters need render targets in layout to appear as cards, portraits, or scene actors.", success: ["Core character targets exist in layout."], strict: ["name", "targetId"] },
  scene_interaction: { why: "Scene hotspots without interaction bindings are visible but inert.", success: ["Critical scene hotspots have interaction bindings."], strict: ["interactiveAreas", "targetId"] },
  ui_interaction: { why: "UI entries without bindings cannot trigger panels or flows.", success: ["Critical UI carriers have interaction bindings."], strict: ["targetId"] },
  story_timeline: { why: "Story anchors need timeline events to show up at the right moment.", success: ["Key anchors or beats are referenced by timeline events."], strict: ["chapterAnchors", "eventId"] },
  copywriting_timeline: { why: "Copy needs timeline scheduling to appear at the right moment.", success: ["Key copy items are referenced in timeline actions."], strict: ["copyId", "targetId"] },
  layout_timeline: { why: "Timeline targets must point to real layout or interaction targets.", success: ["All timeline targetIds exist in layout or interaction bindings."], strict: ["targetId"] },
  layout_lighting: { why: "Lighting and post effects should align with runtime layout and scene tone.", success: ["Lighting exists when the narrative tone calls for a highlighted scene mood."], strict: ["sceneId"] },
};

export const EDGE_PROBLEM_SUMMARY: Record<ConsistencyEdgeId, string> = {
  gameplay_economy: "Gameplay and economy are not aligned.",
  gameplay_system: "Gameplay entities are not fully carried by systems.",
  system_scene: "System carriers are missing from the scene layer.",
  scene_ui: "Scene and UI carriers are not aligned.",
  story_character: "Story and character outputs are not aligned.",
  proposal_asset: "Proposal scope and asset planning are not aligned.",
  scene_asset: "Scene carriers are missing asset coverage.",
  ui_asset: "UI carriers are missing asset coverage.",
  story_asset: "Story anchors are missing asset coverage.",
  character_asset: "Character outputs are missing asset coverage.",
  proposal_story: "Proposal and story tone are not aligned.",
  proposal_ui: "Proposal scope and UI scope are not aligned.",
  economy_asset: "Economy hooks are missing asset coverage.",
  story_copywriting: "Story anchors are not reflected in copy.",
  character_copywriting: "Character outputs are not reflected in copy.",
  scene_copywriting: "Scene hotspots are not reflected in copy.",
  ui_copywriting: "UI structures are not reflected in copy.",
  asset_copywriting: "Asset labels are not reflected in copy.",
  economy_copywriting: "Economy hooks are not reflected in copy.",
  proposal_copywriting: "Proposal scope is not reflected in copy.",
  gameplay_copywriting: "Gameplay goals are not reflected in copy.",
  system_copywriting: "System concepts are not reflected in copy.",
  scene_layout: "Scene carriers are missing from layout.",
  ui_layout: "UI carriers are missing from layout.",
  character_layout: "Character carriers are missing from layout.",
  scene_interaction: "Scene hotspots are missing interaction bindings.",
  ui_interaction: "UI entries are missing interaction bindings.",
  story_timeline: "Story anchors are missing from timeline.",
  copywriting_timeline: "Copy items are missing from timeline.",
  layout_timeline: "Timeline references missing targets.",
  layout_lighting: "Layout and lighting are not aligned.",
};

export function getSpec(edgeId: ConsistencyEdgeId) {
  return ALL_CONSISTENCY_EDGES.find((edge) => edge.edgeId === edgeId)!;
}

export function getConsistencyEdgeGuide(edgeId: ConsistencyEdgeId) {
  const reasoning = EDGE_REASONING[edgeId];
  return {
    edgeId,
    problemSummary: EDGE_PROBLEM_SUMMARY[edgeId],
    whyItMatters: reasoning.why,
    successConditions: reasoning.success,
    strictIdentifiers: reasoning.strict,
  };
}
