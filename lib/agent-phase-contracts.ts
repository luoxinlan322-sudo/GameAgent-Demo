import type {
  AssetManifest,
  CharacterCard,
  CopywritingPack,
  EconomyDesign,
  GameProposal,
  GameplayStructure,
  SceneDesign,
  StoryResult,
  SystemDesign,
  ToolName,
  UIInformationArchitecture,
} from "./schemas";
import type {
  Html5PreparationPackage,
  InteractionConfigInput,
  LayoutConfigInput,
  LightingRenderConfigInput,
  SceneDefinition,
  TimelineConfigInput,
} from "./html5-render-schemas";
import { AGENT_PHASES, type AgentPhaseId } from "./agent-execution-config";

export type AgentPhaseArtifacts = {
  gameplay: GameplayStructure | null;
  economy: EconomyDesign | null;
  systems: SystemDesign | null;
  proposal: GameProposal | null;
  scene: SceneDesign | null;
  ui: UIInformationArchitecture | null;
  story: StoryResult | null;
  characterCards: CharacterCard[] | null;
  assetManifest: AssetManifest | null;
  copywriting: CopywritingPack | null;
  sceneDefinitions: SceneDefinition[] | null;
  interactionConfig: InteractionConfigInput | null;
  layoutConfig: LayoutConfigInput | null;
  timelineConfig: TimelineConfigInput | null;
  lightingRenderConfig: LightingRenderConfigInput | null;
  html5Preparation: Html5PreparationPackage | null;
};

export type AgentPhaseContractCheck = {
  phaseId: AgentPhaseId;
  title: string;
  pass: boolean;
  missingArtifacts: string[];
  notes: string[];
  requiredTools: ToolName[];
  html5Targets: string[];
};

type ContractDefinition = {
  phaseId: AgentPhaseId;
  requiredTools: ToolName[];
  html5Targets: string[];
  validate: (artifacts: AgentPhaseArtifacts) => { missingArtifacts: string[]; notes: string[] };
};

const PHASE_CONTRACTS: ContractDefinition[] = [
  {
    phaseId: "foundation",
    requiredTools: ["gameplay_tool", "economy_tool", "system_design_tool", "proposal_tool"],
    html5Targets: ["sceneDefinitions", "copywritingConfig", "assetManifest"],
    validate: (artifacts) => {
      const missingArtifacts: string[] = [];
      const notes: string[] = [];

      if (!artifacts.gameplay) missingArtifacts.push("gameplay");
      if (!artifacts.economy) missingArtifacts.push("economy");
      if (!artifacts.systems) missingArtifacts.push("systems");
      if (!artifacts.proposal) missingArtifacts.push("proposal");

      if (artifacts.gameplay && artifacts.economy) {
        notes.push("Gameplay and economy are ready for downstream HTML5 preparation.");
      }
      if (artifacts.systems && artifacts.proposal) {
        notes.push("Systems and proposal can now constrain scene, story, UI, and asset generation.");
      }

      return { missingArtifacts, notes };
    },
  },
  {
    phaseId: "experience",
    requiredTools: ["scene_design_tool", "ui_architecture_tool", "story_tool", "character_tool"],
    html5Targets: ["layoutConfig", "interactionConfig", "copywritingConfig", "timelineConfig"],
    validate: (artifacts) => {
      const missingArtifacts: string[] = [];
      const notes: string[] = [];

      if (!artifacts.scene) missingArtifacts.push("scene");
      if (!artifacts.ui) missingArtifacts.push("ui");
      if (!artifacts.story) missingArtifacts.push("story");
      if (!artifacts.characterCards || artifacts.characterCards.length === 0) missingArtifacts.push("characterCards");

      if (artifacts.scene && artifacts.ui) {
        notes.push("Scene and UI are ready for layout and interaction derivation.");
      }
      if (artifacts.story && artifacts.characterCards?.length) {
        notes.push("Story and character outputs are ready for timeline and copy layers.");
      }

      return { missingArtifacts, notes };
    },
  },
  {
    phaseId: "rendering",
    requiredTools: ["asset_manifest_tool", "copywriting_tool"],
    html5Targets: ["assetManifest", "copywritingConfig"],
    validate: (artifacts) => {
      const missingArtifacts: string[] = [];
      const notes: string[] = [];

      if (!artifacts.assetManifest) missingArtifacts.push("assetManifest");
      if (!artifacts.copywriting) missingArtifacts.push("copywriting");

      if (artifacts.assetManifest) {
        notes.push(`Asset manifest contains ${artifacts.assetManifest.assetGroups.length} asset definitions.`);
      }
      if (artifacts.copywriting) {
        notes.push("Copy layer is ready for runtime binding.");
      }

      return { missingArtifacts, notes };
    },
  },
  {
    phaseId: "html5_runtime",
    requiredTools: ["layout_tool", "timeline_tool"],
    html5Targets: ["sceneDefinitions", "interactionConfig", "layoutConfig", "timelineConfig", "lightingRenderConfig", "html5Preparation"],
    validate: (artifacts) => {
      const missingArtifacts: string[] = [];
      const notes: string[] = [];

      if (!artifacts.sceneDefinitions || artifacts.sceneDefinitions.length === 0) missingArtifacts.push("sceneDefinitions");
      if (!artifacts.interactionConfig || artifacts.interactionConfig.bindings.length === 0) missingArtifacts.push("interactionConfig");
      if (!artifacts.layoutConfig || artifacts.layoutConfig.scenes.length === 0) missingArtifacts.push("layoutConfig");
      if (!artifacts.timelineConfig || artifacts.timelineConfig.timelines.length === 0) missingArtifacts.push("timelineConfig");
      if (!artifacts.lightingRenderConfig) missingArtifacts.push("lightingRenderConfig");
      if (!artifacts.html5Preparation) missingArtifacts.push("html5Preparation");

      if (artifacts.layoutConfig && artifacts.interactionConfig) {
        notes.push("Layout and interaction bindings have entered the runtime object layer.");
      }
      if (artifacts.timelineConfig) {
        notes.push("Timeline has mapped story and copy into runtime events.");
      }
      if (artifacts.html5Preparation) {
        notes.push("Phaser/WebGL preparation package has been assembled.");
      }

      return { missingArtifacts, notes };
    },
  },
];

export function getPhaseContract(phaseId: AgentPhaseId) {
  return PHASE_CONTRACTS.find((contract) => contract.phaseId === phaseId) ?? null;
}

export function validatePhaseContract(phaseId: AgentPhaseId, artifacts: AgentPhaseArtifacts): AgentPhaseContractCheck | null {
  const contract = getPhaseContract(phaseId);
  const phaseMeta = AGENT_PHASES.find((phase) => phase.id === phaseId);
  if (!contract || !phaseMeta) return null;

  const { missingArtifacts, notes } = contract.validate(artifacts);
  return {
    phaseId,
    title: phaseMeta.title,
    pass: missingArtifacts.length === 0,
    missingArtifacts,
    notes,
    requiredTools: contract.requiredTools,
    html5Targets: contract.html5Targets,
  };
}

export function validateAllPhaseContracts(artifacts: AgentPhaseArtifacts) {
  return PHASE_CONTRACTS.map((contract) => validatePhaseContract(contract.phaseId, artifacts)).filter(Boolean) as AgentPhaseContractCheck[];
}

export function buildPhaseContractSummary(check: AgentPhaseContractCheck) {
  if (check.pass) {
    return `${check.title} passed phase contract validation and can continue.`;
  }

  return `${check.title} failed phase contract validation. Missing: ${check.missingArtifacts.join(", ")}`;
}

export function listPhaseTools(phaseId: AgentPhaseId) {
  return getPhaseContract(phaseId)?.requiredTools ?? [];
}
