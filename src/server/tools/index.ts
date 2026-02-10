import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCaptureIdea } from "./capture-idea.js";
import { registerEvaluateIdea } from "./evaluate-idea.js";
import { registerListIdeas } from "./list-ideas.js";
import { registerPromoteIdea } from "./promote-idea.js";
import { registerInitProject } from "./init-project.js";
import { registerGetArchitecture } from "./get-architecture.js";
import { registerUpdateArchitecture } from "./update-architecture.js";
import { registerLogDecision } from "./log-decision.js";
import { registerRegisterPattern } from "./register-pattern.js";
import { registerFindPatterns } from "./find-patterns.js";
import { registerRegisterDependency } from "./register-dependency.js";
import { registerCheckDependency } from "./check-dependency.js";
import { registerRegisterApi } from "./register-api.js";
import { registerListProjects } from "./list-projects.js";
import { registerListPatterns } from "./list-patterns.js";
import { registerListStacks } from "./list-stacks.js";
import { registerValidateAgainstSpec } from "./validate-against-spec.js";
import { registerValidateCode } from "./validate-code.js";
import { registerCheckProgress } from "./check-progress.js";
import { registerEvaluateFeature } from "./evaluate-feature.js";
import { registerScaffoldProject } from "./scaffold-project.js";
import { registerAddFeature } from "./add-feature.js";
import { registerSnapshotPatterns } from "./snapshot-patterns.js";
import { registerSearchKnowledge } from "./search-knowledge.js";
import { registerSuggestPatterns } from "./suggest-patterns.js";
import { registerDetectDrift } from "./detect-drift.js";
import { registerSurfaceDecisions } from "./surface-decisions.js";
import { registerCheckStaleness } from "./check-staleness.js";
import { registerScorePatterns } from "./score-patterns.js";
import { registerPatternLineage } from "./pattern-lineage.js";
import { registerDecisionGraph } from "./decision-graph.js";
import { registerRegisterAntipattern } from "./register-antipattern.js";
import { registerScoreSimilarity } from "./score-similarity.js";
import { registerGetInsights } from "./get-insights.js";
import { registerCompareProjects } from "./compare-projects.js";
import { registerSuggestStack } from "./suggest-stack.js";
import { registerPlanBuild } from "./plan-build.js";
import { registerExecuteStep } from "./execute-step.js";
import { registerReviewCheckpoint } from "./review-checkpoint.js";
import { registerResumeBuild } from "./resume-build.js";
import { registerRollbackStep } from "./rollback-step.js";

/** Register all Phase 0 (Discovery) tools on the server. */
export function registerPhase0(server: McpServer): void {
  registerCaptureIdea(server);
  registerEvaluateIdea(server);
  registerListIdeas(server);
  registerPromoteIdea(server);
}

/** Register all Phase 1 (Foundation) tools on the server. */
export function registerPhase1(server: McpServer): void {
  registerInitProject(server);
  registerGetArchitecture(server);
  registerUpdateArchitecture(server);
  registerLogDecision(server);
  registerRegisterPattern(server);
  registerFindPatterns(server);
  registerRegisterDependency(server);
  registerCheckDependency(server);
  registerRegisterApi(server);
  registerListProjects(server);
  registerListPatterns(server);
  registerListStacks(server);
}

/** Register all Phase 2 (Validation) tools on the server. */
export function registerPhase2(server: McpServer): void {
  registerValidateAgainstSpec(server);
  registerValidateCode(server);
  registerCheckProgress(server);
  registerEvaluateFeature(server);
}

/** Register all Phase 3 (Acceleration) tools on the server. */
export function registerPhase3(server: McpServer): void {
  registerScaffoldProject(server);
  registerAddFeature(server);
  registerSnapshotPatterns(server);
  registerSearchKnowledge(server);
}

/** Register all Phase 4 (Intelligence) tools on the server. */
export function registerPhase4(server: McpServer): void {
  registerSuggestPatterns(server);
  registerDetectDrift(server);
  registerSurfaceDecisions(server);
  registerCheckStaleness(server);
  registerScorePatterns(server);
}

/** Register all Phase 5 (Cross-Project Intelligence) tools on the server. */
export function registerPhase5(server: McpServer): void {
  registerPatternLineage(server);
  registerDecisionGraph(server);
  registerRegisterAntipattern(server);
  registerScoreSimilarity(server);
  registerGetInsights(server);
  registerCompareProjects(server);
  registerSuggestStack(server);
}

/** Register all Phase 6 (Autonomous Build Agent) tools on the server. */
export function registerPhase6(server: McpServer): void {
  registerPlanBuild(server);
  registerExecuteStep(server);
  registerReviewCheckpoint(server);
  registerResumeBuild(server);
  registerRollbackStep(server);
}
