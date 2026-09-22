// Bob integration: custom modes (installed once, globally) + an auto-generated hand-off prompt.
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { parseDocument } from "yaml";

const RX = {
  guardian: "^\\.guardian/.*",
  docs: "(^|/)(docs?|documentation)/|(^|/)README[^/]*$|\\.mdx?$|(openapi|swagger)[^/]*\\.(ya?ml|json)$|(^|/)\\.env\\.(example|sample|template)$",
  tests: "(^|/)(tests?|__tests__)/|\\.(test|spec)\\.[cm]?[jt]sx?$|(^|/)test_[^/]*\\.py$|_test\\.py$",
};
for (const v of Object.values(RX)) new RegExp(v); // fail fast on a bad pattern

const q = (p) => `"${p}"`;

export function buildModes(cli) {
  const analyze = `node ${q(cli)} analyze --repo . --json`;
  return [
    {
      slug: "pr-guardian",
      name: "🛡️ PR Guardian (Orchestrator)",
      description: "Reviews the current changes like a committee: blast radius, API/doc drift and tests, then one verdict.",
      roleDefinition: "You lead an autonomous PR review committee. You never review only the diff: you delegate to specialist subagents in parallel, collect their evidence, and publish one verdict with proposed fixes.",
      whenToUse: "Use when the user asks to review a branch, PR or uncommitted changes for impact on the rest of the system.",
      customInstructions: [
        `1. If .guardian/report.json is missing or older than the latest change, run: ${analyze}`,
        "2. Read the architecture and decision docs listed in the report (docsToRead) before anything else.",
        "3. Ask to spawn THREE subagents in parallel, one message, each with a self-contained brief: blast-radius-analyst, api-docs-guardian, test-synthesizer.",
        "4. Wait for all three. If they disagree, run the command that settles it and say who was right.",
        "5. Write .guardian/pr-review-<branch>.md: verdict (BLOCK / REVIEW / OK), blast radius, drift, tests, proposed fix, open decisions for a human.",
        "6. Fixes: prefer a backward-compatible change. Docs and tests go on a NEW branch bob/guardian-fix/<branch>; never push to the author's branch. Production code goes only as .guardian/suggested-fix.patch for a human to apply. If the change contradicts an accepted architecture decision (ADR), draft a superseding ADR instead of editing the old one.",
        "7. Re-run the project's tests and the analyzer on the fix branch. Say 'fixed' only if they pass.",
        "Every finding needs evidence (file:line or command output). Never claim you prevented an outage; say what would have failed before merge. Report measured time, not estimates.",
        "If subagents are not available in this Bob version, run the three analyses one after another in this same task.",
      ].join("\n"),
      groups: ["read", "execute", "todo", "subagent", "mode", ["edit", { fileRegex: RX.guardian, description: "Guardian reports and suggested patches only" }]],
    },
    {
      slug: "blast-radius-analyst",
      name: "💥 Blast Radius Analyst",
      description: "Finds every consumer, doc, config and decision affected by a change. Read-only.",
      roleDefinition: "You are a systems architect. Given a change, you find everything else that depends on what changed: importers, callers, docs, metrics, alerts, configuration and architecture decisions. You read and run analysis commands but never modify files.",
      whenToUse: "Delegated by pr-guardian to compute the impact of a change.",
      customInstructions: `Start from .guardian/report.json (or run: ${analyze}). Verify the top findings by opening the cited file:line. Then read the architecture docs and reason about dependencies a static tool cannot see (runtime config, dashboards, other repos, contracts). Return: affected components, evidence, confidence.`,
      groups: ["read", "execute"],
    },
    {
      slug: "api-docs-guardian",
      name: "📘 API & Docs Guardian",
      description: "Detects drift between code and OpenAPI/docs/config and fixes the documents.",
      roleDefinition: "You keep OpenAPI specs, READMEs, architecture docs and env-var docs truthful. You compare the implementation against its documented contract and fix the documents, never the code.",
      whenToUse: "Delegated by pr-guardian to check documentation and contract drift.",
      customInstructions: `Use the 'stale', 'spec' and 'env' sections of .guardian/report.json (or run: ${analyze}). Prefer additive spec changes. If the change contradicts an accepted ADR, draft a new superseding ADR rather than editing the accepted one. Return the exact files and lines you changed.`,
      groups: ["read", "execute", ["edit", { fileRegex: RX.docs, description: "Docs, specs and env examples only" }]],
    },
    {
      slug: "test-synthesizer",
      name: "🧪 Test Synthesizer",
      description: "Writes and runs the missing tests for the changed behaviour and its consumers.",
      roleDefinition: "You write focused tests using the project's existing test framework and style, cover the changed behaviour and the contract with each affected consumer, run them, and report which fail before and after the fix.",
      whenToUse: "Delegated by pr-guardian to cover changed code and consumer contracts with tests.",
      customInstructions: "Read the 'coverage' and 'touched' sections of .guardian/report.json. Add tests next to the existing ones, following their conventions. Include at least one contract test per affected consumer. Run the project's test command and report the result.",
      groups: ["read", "execute", ["edit", { fileRegex: RX.tests, description: "Test files only" }]],
    },
  ];
}

// Merge into an existing custom_modes.yaml, keeping the user's own modes and comments.
export function installModes({ cli, project }) {
  const file = project ? path.join(project, ".bob", "custom_modes.yaml") : path.join(homedir(), ".bob", "settings", "custom_modes.yaml");
  mkdirSync(path.dirname(file), { recursive: true });
  let backup = null;
  let doc;
  if (existsSync(file)) {
    backup = `${file}.bak-${Date.now()}`;
    copyFileSync(file, backup);
    doc = parseDocument(readFileSync(file, "utf8"));
  } else doc = parseDocument("customModes: []\n");
  if (!doc.get("customModes")) doc.set("customModes", doc.createNode([]));
  const list = doc.get("customModes");
  // Project-local install: Bob runs shell commands with the project root as the working
  // directory, so a relative path (portable after a clone, on any OS) is correct here.
  // Only a global (home-directory) install needs the absolute path, since the tool then
  // lives outside whichever project Bob happens to be working in.
  const cliForModes = project ? path.relative(project, cli).split(path.sep).join("/") : cli;
  const mine = buildModes(cliForModes);
  const replaced = [];
  for (const mode of mine) {
    const idx = list.items.findIndex((it) => it?.get?.("slug") === mode.slug);
    const node = doc.createNode(mode);
    if (idx >= 0) { list.items[idx] = node; replaced.push(mode.slug); } else list.items.push(node);
  }
  writeFileSync(file, String(doc));
  return { file, backup, slugs: mine.map((m) => m.slug), replaced };
}

export function buildPrompt(r, cli) {
  const slug = (r.target.current || "changes").replace(/[^\w.-]+/g, "-");
  const docs = r.docsToRead?.length ? r.docsToRead.map((d) => `- ${d}`).join("\n") : "- (no architecture docs found: infer the architecture from the folder structure)";
  const ext = r.touched.flatMap((t) => t.consumers.filter((c) => c.external));
  return [
    `Review the current changes of this project as if they were a pull request (${r.target.label}).`,
    "",
    "A deterministic analysis already ran. Do not redo it; verify its top findings and go beyond it.",
    `- Risk: ${r.risk} (${r.verdict}). Reasons: ${r.reasons.join("; ")}.`,
    `- ${r.touched.length} file(s) with touched exports, ${ext.length} external consumer file(s), ${r.stale.length} stale value(s), ${r.coverage.uncoveredChanged.length} uncovered changed module(s).`,
    "- Full evidence: .guardian/report.md and .guardian/report.json",
    `- Re-run any time: node ${q(cli)} analyze --repo . --json`,
    "",
    "Steps:",
    "1. Read these architecture / decision / API docs first:",
    docs,
    "2. Spawn three subagents in parallel (I will approve): blast-radius-analyst, api-docs-guardian, test-synthesizer.",
    `3. Write your verdict to .guardian/pr-review-${slug}.md (BLOCK / REVIEW / OK, evidence for every finding).`,
    `4. Propose a backward-compatible fix: docs and tests committed on branch bob/guardian-fix/${slug}; production code only as .guardian/suggested-fix.patch.`,
    "5. Re-run the tests and the analyzer on the fix branch before saying it is fixed.",
    "",
    "If subagents are not available in this version of Bob, do the three analyses one after another in this task.",
  ].join("\n");
}
