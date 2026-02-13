import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HiveConfig } from "../config.js";
import { isCategoryEnabled } from "../config.js";

// Discovery
import { registerCaptureIdea } from "./capture-idea.js";
import { registerEvaluateIdea } from "./evaluate-idea.js";
import { registerListIdeas } from "./list-ideas.js";
import { registerPromoteIdea } from "./promote-idea.js";

// Foundation
import { registerInitProject } from "./init-project.js";
import { registerGetArchitecture } from "./get-architecture.js";
import { registerUpdateArchitecture } from "./update-architecture.js";
import { registerLogDecision } from "./log-decision.js";
import { registerRegisterPattern } from "./register-pattern.js";
import { registerFindPatterns } from "./find-patterns.js";
import { registerListProjects } from "./list-projects.js";
import { registerListPatterns } from "./list-patterns.js";
import { registerRegisterDependency } from "./register-dependency.js";
import { registerCheckDependency } from "./check-dependency.js";

// Validation
import { registerValidateAgainstSpec } from "./validate-against-spec.js";
import { registerValidateCode } from "./validate-code.js";
import { registerCheckProgress } from "./check-progress.js";
import { registerEvaluateFeature } from "./evaluate-feature.js";

// Acceleration
import { registerAddFeature } from "./add-feature.js";
import { registerSnapshotPatterns } from "./snapshot-patterns.js";
import { registerSearchKnowledge } from "./search-knowledge.js";

// Intelligence
import { registerSuggestPatterns } from "./suggest-patterns.js";
import { registerDetectDrift } from "./detect-drift.js";
import { registerSurfaceDecisions } from "./surface-decisions.js";
import { registerCheckStaleness } from "./check-staleness.js";
import { registerScorePatterns } from "./score-patterns.js";

// Cross-Project
import { registerPatternLineage } from "./pattern-lineage.js";
import { registerDecisionGraph } from "./decision-graph.js";
import { registerRegisterAntipattern } from "./register-antipattern.js";
import { registerScoreSimilarity } from "./score-similarity.js";
import { registerGetInsights } from "./get-insights.js";
import { registerCompareProjects } from "./compare-projects.js";

// Build Agent
import { registerPlanBuild } from "./plan-build.js";
import { registerExecuteStep } from "./execute-step.js";
import { registerReviewCheckpoint } from "./review-checkpoint.js";
import { registerResumeBuild } from "./resume-build.js";
import { registerRollbackStep } from "./rollback-step.js";

// Project Management
import { registerAddToBacklog } from "./add-to-backlog.js";
import { registerGetBacklog } from "./get-backlog.js";
import { registerArchiveProject } from "./archive-project.js";

// Revenue
import { registerTrackRevenue } from "./track-revenue.js";
import { registerBuildFromDescription } from "./build-from-description.js";

// Business
import { registerGenerateInvoice } from "./generate-invoice.js";
import { registerFinancialReport } from "./financial-report.js";
import { registerTrackExpense } from "./track-expense.js";
import { registerClientOverview } from "./client-overview.js";

// Workflow
import { registerCaptureWorkflow } from "./capture-workflow.js";
import { registerListWorkflow } from "./list-workflow.js";
import { registerExportWorkflow } from "./export-workflow.js";

/** Register Hive tools on the MCP server, filtered by config categories. */
export function registerAllTools(server: McpServer, config: HiveConfig): void {
  const on = (cat: Parameters<typeof isCategoryEnabled>[1]) =>
    isCategoryEnabled(config, cat);

  if (on("discovery")) {
    registerCaptureIdea(server);
    registerEvaluateIdea(server);
    registerListIdeas(server);
    registerPromoteIdea(server);
  }

  if (on("foundation")) {
    registerInitProject(server);
    registerGetArchitecture(server);
    registerUpdateArchitecture(server);
    registerLogDecision(server);
    registerRegisterPattern(server);
    registerFindPatterns(server);
    registerListProjects(server);
    registerListPatterns(server);
    registerRegisterDependency(server);
    registerCheckDependency(server);
  }

  if (on("validation")) {
    registerValidateAgainstSpec(server);
    registerValidateCode(server);
    registerCheckProgress(server);
    registerEvaluateFeature(server);
  }

  if (on("acceleration")) {
    registerAddFeature(server);
    registerSnapshotPatterns(server);
    registerSearchKnowledge(server);
  }

  if (on("intelligence")) {
    registerSuggestPatterns(server);
    registerDetectDrift(server);
    registerSurfaceDecisions(server);
    registerCheckStaleness(server);
    registerScorePatterns(server);
  }

  if (on("cross-project")) {
    registerPatternLineage(server);
    registerDecisionGraph(server);
    registerRegisterAntipattern(server);
    registerScoreSimilarity(server);
    registerGetInsights(server);
    registerCompareProjects(server);
  }

  if (on("build")) {
    registerPlanBuild(server);
    registerExecuteStep(server);
    registerReviewCheckpoint(server);
    registerResumeBuild(server);
    registerRollbackStep(server);
  }

  if (on("project-management")) {
    registerAddToBacklog(server);
    registerGetBacklog(server);
    registerArchiveProject(server);
  }

  if (on("revenue")) {
    registerTrackRevenue(server);
    registerBuildFromDescription(server);
  }

  if (on("business")) {
    registerGenerateInvoice(server);
    registerFinancialReport(server);
    registerTrackExpense(server);
    registerClientOverview(server);
  }

  if (on("workflow")) {
    registerCaptureWorkflow(server);
    registerListWorkflow(server);
    registerExportWorkflow(server);
  }
}
