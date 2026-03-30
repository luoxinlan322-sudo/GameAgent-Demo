# Game Agent Phase Plan

## Goal
Turn the current Game Agent into a phased, testable pipeline that:

1. Produces game design outputs.
2. Maps those outputs into Phaser/WebGL-facing runtime inputs.
3. Runs consistency checks on a dependency graph instead of full pairwise comparison.
4. Uses reason-based repair so the main agent understands why to repair and what success looks like.

## Phase Overview

### Phase 1. HTML5 Runtime Contract
Align the project around a deterministic runtime target.

Outputs:
- `gameConfig`
- `sceneDefinitions`
- `assetManifest`
- `layoutConfig`
- `copywritingConfig`
- `timelineConfig`
- `interactionConfig`
- optional `lightingRenderConfig`

Files:
- `docs/phaser_webgl_input_spec.md`
- `lib/html5-render-schemas.ts`

Exit criteria:
- TypeScript schemas compile.
- Runtime package builder returns a valid `Html5PreparationPackage`.

### Phase 2. Tool Output Alignment
Align existing production tools to the HTML5 runtime contract.

Tool groups:
- Foundation:
  - `gameplay_tool`
  - `economy_tool`
  - `system_design_tool`
  - `proposal_tool`
- Experience:
  - `scene_design_tool`
  - `ui_architecture_tool`
  - `story_tool`
  - `character_tool`
- Rendering:
  - `asset_manifest_tool`
  - `copywriting_tool`
- HTML5 runtime:
  - `layout_tool`
  - `timeline_tool`

Exit criteria:
- Upstream tool outputs can be projected into HTML5 runtime schemas without ad-hoc static fallback.
- Layout and timeline dependencies are explicit.

### Phase 3. Consistency Graph
Replace ad-hoc checks with a graph of real dependency edges.

Hard edges:
- `gameplay -> economy`
- `gameplay -> system`
- `system -> scene`
- `scene -> ui`
- `story -> character`
- `proposal -> asset_manifest`
- `scene -> asset_manifest`
- `ui -> asset_manifest`
- `story -> asset_manifest`
- `character -> asset_manifest`
- `story -> copywriting`
- `character -> copywriting`
- `scene -> copywriting`
- `ui -> copywriting`
- `economy -> copywriting`
- `asset_manifest -> copywriting`
- `scene -> layout`
- `ui -> layout`
- `character -> layout`
- `scene -> interaction`
- `ui -> interaction`
- `story -> timeline`
- `copywriting -> timeline`
- `layout -> timeline`

Soft edges:
- `proposal -> story`
- `proposal -> ui`
- `economy -> asset_manifest`
- `proposal -> copywriting`
- `gameplay -> copywriting`
- `system -> copywriting`
- `layout -> lighting`

Exit criteria:
- Edge results are normalized under one schema.
- Rule and semantic checks can be merged into one consistency report.

### Phase 4. Reason-Based Repair
The main agent repairs by understanding reasons and success conditions, not by blindly copying patch instructions.

Core structures:
- `ConsistencyEdgeResult`
- `RepairTask`
- `ConsistencyReport`
- `RepairPlan`

Repair logic:
1. Generate all required tool outputs for the current phase.
2. Run consistency graph checks.
3. Convert failures into `RepairTask` objects:
   - `problemSummary`
   - `whyItMatters`
   - `successConditions`
   - `strictIdentifiers`
   - `suggestedTargets`
4. Let the main agent choose the most leveraged repair targets.
5. Re-run only affected tools.
6. Re-check only affected edges.
7. When all hard edges pass, run final evaluation and verification.

Exit criteria:
- Repair plan is reason-based.
- Rechecks are localized.
- Final pass produces a complete HTML5 preparation package.

## Upstream / Downstream Dependencies

### Foundation
- `gameplay_tool`
  - upstream: none
  - downstream: `economy_tool`, `system_design_tool`, `proposal_tool`, `copywriting_tool`
- `economy_tool`
  - upstream: `gameplay_tool`
  - downstream: `proposal_tool`, `asset_manifest_tool`, `copywriting_tool`
- `system_design_tool`
  - upstream: `gameplay_tool`
  - downstream: `proposal_tool`, `scene_design_tool`, `story_tool`, `copywriting_tool`
- `proposal_tool`
  - upstream: `gameplay_tool`, `economy_tool`, `system_design_tool`
  - downstream: `scene_design_tool`, `story_tool`, `asset_manifest_tool`, `copywriting_tool`

### Experience
- `scene_design_tool`
  - upstream: `system_design_tool`, `proposal_tool`
  - downstream: `ui_architecture_tool`, `asset_manifest_tool`, `copywriting_tool`, `layout_tool`
- `ui_architecture_tool`
  - upstream: `scene_design_tool`, `system_design_tool`
  - downstream: `asset_manifest_tool`, `copywriting_tool`, `layout_tool`
- `story_tool`
  - upstream: `proposal_tool`, `system_design_tool`
  - downstream: `character_tool`, `asset_manifest_tool`, `copywriting_tool`, `timeline_tool`
- `character_tool`
  - upstream: `story_tool`, `system_design_tool`
  - downstream: `asset_manifest_tool`, `copywriting_tool`, `layout_tool`

### Rendering
- `asset_manifest_tool`
  - upstream: `proposal_tool`, `economy_tool`, `scene_design_tool`, `ui_architecture_tool`, `story_tool`, `character_tool`
  - downstream: `copywriting_tool`, `layout_tool`, `lightingRenderConfig`
- `copywriting_tool`
  - upstream: `proposal_tool`, `economy_tool`, `scene_design_tool`, `ui_architecture_tool`, `story_tool`, `character_tool`, `asset_manifest_tool`
  - downstream: `timeline_tool`

### HTML5 Runtime
- `layout_tool`
  - upstream: `scene_design_tool`, `ui_architecture_tool`, `character_tool`, `asset_manifest_tool`
  - downstream: `timeline_tool`
- `timeline_tool`
  - upstream: `story_tool`, `copywriting_tool`, `layout_tool`
  - downstream: final HTML5 runtime package

## Recommended Concurrency

### First full generation
1. Batch 1:
   - `gameplay_tool`
2. Batch 2:
   - `economy_tool`
   - `system_design_tool`
3. Batch 3:
   - `proposal_tool`
   - `scene_design_tool`
   - `story_tool`
4. Batch 4:
   - `ui_architecture_tool`
   - `character_tool`
5. Batch 5:
   - `asset_manifest_tool`
6. Batch 6:
   - `copywriting_tool`
   - `layout_tool`
7. Batch 7:
   - `timeline_tool`

### Repair runs
Do not full-rerun by default.

Repair policy:
- Prefer repairing the smallest upstream set that unlocks the most failing edges.
- If both `story -> character` and `character -> asset_manifest` fail, prefer `character_tool` first.
- If a runtime edge fails because upstream content is missing, repair upstream first before re-running `layout_tool` or `timeline_tool`.

## Testing Strategy By Phase

### Phase 1 test
- Run TypeScript build.
- Validate the HTML5 package schema.

### Phase 2 test
- Run one generation pass.
- Confirm every required tool output can project into runtime-facing schemas.

### Phase 3 test
- Run graph checks on a complete generation package.
- Confirm failures are attached to real edges and tools.

### Phase 4 test
- Run a complete end-to-end generation -> consistency -> repair -> recheck -> evaluation cycle.
- Confirm:
  - no hidden static fallback
  - repair targets are selected by the main agent
  - final package contains HTML5 runtime outputs
