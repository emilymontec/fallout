#!/usr/bin/env node
import { readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "../src/analyze.mjs";
import { renderMarkdown, summaryLine, writeReports } from "../src/report.mjs";
import { installModes, buildPrompt } from "../src/modes.mjs";
import { isGitRepo, repoRoot } from "../src/git.mjs";
import { stamp } from "../src/util.mjs";

const CLI = fileURLToPath(import.meta.url);
const HOME = path.resolve(path.dirname(CLI), "..");
const BOOL = new Set(["json", "working", "run-tests", "copy", "quiet", "help"]);

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { o._.push(a); continue; }
    const k = a.slice(2);
    o[k] = BOOL.has(k) ? true : argv[++i];
  }
  return o;
}
const opts = parseArgs(process.argv.slice(3));
const cmd = process.argv[2];
const toOpts = (o) => ({ base: o.base, working: o.working, last: o.last ? parseInt(o.last, 10) : undefined, runTests: o["run-tests"], depth: o.depth ? parseInt(o.depth, 10) : 2 });

const HELP = `guardian: blast-radius & architecture guardian for pull requests (built for IBM Bob)

  guardian analyze [--repo DIR] [--base BRANCH | --working | --last N] [--run-tests] [--json]
      Analyze one project. With no flags it decides by itself what to compare.
  guardian scan DIR [--depth 2] [--run-tests]
      Analyze every git project inside DIR and write one summary table.
  guardian prompt [--repo DIR] [--copy]
      Analyze + generate the ready-to-paste prompt for IBM Bob.
  guardian install-modes [--project DIR]
      Install the Bob modes (once, globally; or into one project).`;

function copyToClipboard(text) {
  const c = process.platform === "win32" ? ["clip"] : process.platform === "darwin" ? ["pbcopy"] : ["xclip", "-selection", "clipboard"];
  const r = spawnSync(c[0], c.slice(1), { input: text });
  return !r.error && r.status === 0;
}

function findRepos(dir, depth) {
  const out = [];
  const walk = (d, lvl) => {
    if (existsSync(path.join(d, ".git"))) { out.push(d); return; }
    if (lvl >= depth) return;
    let entries = [];
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) if (e.isDirectory() && !e.name.startsWith(".") && !["node_modules", "vendor", "dist", "build", "__pycache__"].includes(e.name)) walk(path.join(d, e.name), lvl + 1);
  };
  walk(path.resolve(dir), 0);
  return out;
}

function runOne(repoArg, o, outDir) {
  const repo = path.resolve(repoArg || ".");
  if (!isGitRepo(repo)) throw new Error(`${repo} is not inside a git repository (run 'git init' and make a commit first)`);
  const root = repoRoot(repo);
  const r = analyze(root, { ...toOpts(o), writeExclude: !outDir });
  const md = renderMarkdown(r);
  const files = writeReports(r, outDir ?? path.join(root, ".guardian"), md);
  return { r, md, files, root };
}

try {
  if (!cmd || cmd === "help" || opts.help) console.log(HELP);
  else if (cmd === "analyze") {
    const { r, md, files } = runOne(opts.repo, opts);
    console.log(opts.json ? JSON.stringify(r, (k, v) => (v instanceof Set ? [...v] : v), 2) : md);
    console.error(`\n[guardian] wrote ${files.md} and ${files.js}`);
  } else if (cmd === "scan") {
    const dir = opts._[0];
    if (!dir) throw new Error("usage: guardian scan <folder-with-your-projects>");
    const repos = findRepos(dir, opts.depth ? parseInt(opts.depth, 10) : 2);
    if (!repos.length) throw new Error(`no git projects found under ${dir} (depth ${opts.depth ?? 2})`);
    const out = path.join(HOME, "reports", `scan-${stamp()}`);
    mkdirSync(out, { recursive: true });
    const rows = [], failed = [];
    for (const repo of repos) {
      try {
        const name = path.basename(repo);
        const { r, files } = runOne(repo, opts, path.join(out, name));
        rows.push({ r, files });
        console.error(`[guardian] ${name}: ${r.risk}`);
      } catch (e) { failed.push(`${path.basename(repo)}: ${e.message}`); }
    }
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };
    rows.sort((a, b) => order[a.r.risk] - order[b.r.risk]);
    const md = ["# Guardian scan", "", `Folder: \`${path.resolve(dir)}\` · ${repos.length} project(s)`, "", "| Project | Risk | Compared | Files | Main reason |", "| --- | --- | --- | --- | --- |", ...rows.map((x) => summaryLine(x.r)), ""];
    if (failed.length) md.push("## Could not analyze", ...failed.map((f) => `- ${f}`), "");
    md.push("Detailed report per project: `<project>/report.md` in this folder.");
    writeFileSync(path.join(out, "summary.md"), md.join("\n"));
    console.log(md.join("\n"));
    console.error(`\n[guardian] summary: ${path.join(out, "summary.md")}`);
  } else if (cmd === "prompt") {
    const { r, root } = runOne(opts.repo, opts);
    if (r.skipped) throw new Error(`nothing to review: ${r.reasons[0]}`);
    const prompt = buildPrompt(r, CLI);
    writeFileSync(path.join(root, ".guardian", "bob-prompt.md"), prompt);
    console.log(prompt);
    console.error(`\n[guardian] saved ${path.join(root, ".guardian", "bob-prompt.md")}${opts.copy ? (copyToClipboard(prompt) ? " · copied to clipboard" : " · could not copy automatically") : ""}`);
    console.error(`[guardian] now open ${root} in IBM Bob, choose mode "PR Guardian" and paste the prompt.`);
  } else if (cmd === "install-modes") {
    const res = installModes({ cli: CLI, project: opts.project ? path.resolve(opts.project) : null });
    console.log(`Installed ${res.slugs.length} Bob modes in ${res.file}${res.replaced.length ? ` (updated: ${res.replaced.join(", ")})` : ""}${res.backup ? `\nBackup of your previous file: ${res.backup}` : ""}\nRestart the Bob window if the modes do not appear.`);
  } else throw new Error(`unknown command '${cmd}'\n\n${HELP}`);
} catch (e) {
  console.error(`[guardian] ${e.message}`);
  process.exitCode = 1;
}
