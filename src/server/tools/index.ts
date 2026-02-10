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
import { registerDeploy } from "./deploy.js";
import { registerCheckHealth } from "./check-health.js";
import { registerGetErrors } from "./get-errors.js";
import { registerGetUsage } from "./get-usage.js";
import { registerAddToBacklog } from "./add-to-backlog.js";
import { registerGetBacklog } from "./get-backlog.js";
import { registerArchiveProject } from "./archive-project.js";
import { registerFleetStatus } from "./fleet-status.js";
import { registerFleetScanDeps } from "./fleet-scan-deps.js";
import { registerFleetUpdatePattern } from "./fleet-update-pattern.js";
import { registerFleetCosts } from "./fleet-costs.js";
import { registerWhatsNext } from "./whats-next.js";
import { registerRetrospective } from "./retrospective.js";
import { registerKnowledgeGaps } from "./knowledge-gaps.js";
import { registerPatternHealth } from "./pattern-health.js";
import { registerEstimate } from "./estimate.js";
import { registerIdeaPipeline } from "./idea-pipeline.js";
import { registerTrackRevenue } from "./track-revenue.js";
import { registerFleetRevenue } from "./fleet-revenue.js";
import { registerMaintenanceRun } from "./maintenance-run.js";
import { registerBuildFromDescription } from "./build-from-description.js";
import { registerExportKnowledge } from "./export-knowledge.js";
import { registerAutonomyStatus } from "./autonomy-status.js";
import { registerSelfAudit } from "./self-audit.js";
import { registerProposeTool } from "./propose-tool.js";
import { registerEvolve } from "./evolve.js";
import { registerRollbackEvolution } from "./rollback-evolution.js";
import { registerEvolutionHistory } from "./evolution-history.js";
import { registerRevenueDashboard } from "./revenue-dashboard.js";
import { registerPricingAnalysis } from "./pricing-analysis.js";
import { registerGrowthSignals } from "./growth-signals.js";
import { registerRunExperiment } from "./run-experiment.js";
import { registerFinancialSummary } from "./financial-summary.js";
import { registerGenerateLaunch } from "./generate-launch.js";
import { registerGenerateContent } from "./generate-content.js";
import { registerMarketingDashboard } from "./marketing-dashboard.js";
import { registerDraftCampaign } from "./draft-campaign.js";
import { registerAutoChangelog } from "./auto-changelog.js";
import { registerGenerateInvoice } from "./generate-invoice.js";
import { registerFinancialReport } from "./financial-report.js";
import { registerGenerateContract } from "./generate-contract.js";
import { registerComplianceScan } from "./compliance-scan.js";
import { registerTrackExpense } from "./track-expense.js";
import { registerClientOverview } from "./client-overview.js";
import { registerPackagePattern } from "./package-pattern.js";
import { registerPackageStack } from "./package-stack.js";
import { registerMarketplaceDashboard } from "./marketplace-dashboard.js";
import { registerMeshConnect } from "./mesh-connect.js";
import { registerMeshShare } from "./mesh-share.js";
import { registerMeshInsights } from "./mesh-insights.js";
import { registerMeshDelegate } from "./mesh-delegate.js";
import { registerMeshReputation } from "./mesh-reputation.js";

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

/** Register all Phase 7 (Product Lifecycle) tools on the server. */
export function registerPhase7(server: McpServer): void {
  registerDeploy(server);
  registerCheckHealth(server);
  registerGetErrors(server);
  registerGetUsage(server);
  registerAddToBacklog(server);
  registerGetBacklog(server);
  registerArchiveProject(server);
}

/** Register all Phase 8 (Fleet Management) tools on the server. */
export function registerPhase8(server: McpServer): void {
  registerFleetStatus(server);
  registerFleetScanDeps(server);
  registerFleetUpdatePattern(server);
  registerFleetCosts(server);
  registerWhatsNext(server);
}

/** Register all Phase 9 (Self-Improving Hive) tools on the server. */
export function registerPhase9(server: McpServer): void {
  registerRetrospective(server);
  registerKnowledgeGaps(server);
  registerPatternHealth(server);
  registerEstimate(server);
}

/** Register all Phase 10 (Sovereign Builder OS) tools on the server. */
export function registerPhase10(server: McpServer): void {
  registerIdeaPipeline(server);
  registerTrackRevenue(server);
  registerFleetRevenue(server);
  registerMaintenanceRun(server);
  registerBuildFromDescription(server);
  registerExportKnowledge(server);
  registerAutonomyStatus(server);
}

/** Register all Phase 11 (Self-Replicating Hive) tools on the server. */
export function registerPhase11(server: McpServer): void {
  registerSelfAudit(server);
  registerProposeTool(server);
  registerEvolve(server);
  registerRollbackEvolution(server);
  registerEvolutionHistory(server);
}

/** Register all Phase 12 (Revenue Engine) tools on the server. */
export function registerPhase12(server: McpServer): void {
  registerRevenueDashboard(server);
  registerPricingAnalysis(server);
  registerGrowthSignals(server);
  registerRunExperiment(server);
  registerFinancialSummary(server);
}

/** Register all Phase 13 (Content & Marketing Engine) tools on the server. */
export function registerPhase13(server: McpServer): void {
  registerGenerateLaunch(server);
  registerGenerateContent(server);
  registerMarketingDashboard(server);
  registerDraftCampaign(server);
  registerAutoChangelog(server);
}

/** Register all Phase 14 (Business Operations) tools on the server. */
export function registerPhase14(server: McpServer): void {
  registerGenerateInvoice(server);
  registerFinancialReport(server);
  registerGenerateContract(server);
  registerComplianceScan(server);
  registerTrackExpense(server);
  registerClientOverview(server);
}

/** Register all Phase 15 (Knowledge Marketplace) tools on the server. */
export function registerPhase15(server: McpServer): void {
  registerPackagePattern(server);
  registerPackageStack(server);
  registerMarketplaceDashboard(server);
  // hive_export_knowledge is enhanced in Phase 15 but registered in Phase 10
}

/** Register all Phase 16 (Hive Mesh) tools on the server. */
export function registerPhase16(server: McpServer): void {
  registerMeshConnect(server);
  registerMeshShare(server);
  registerMeshInsights(server);
  registerMeshDelegate(server);
  registerMeshReputation(server);
}
