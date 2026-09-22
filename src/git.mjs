// Everything that talks to git. All paths returned are repo-relative and use "/" on every OS
// (git already prints them that way), which is what keeps Windows and Linux results identical.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, appendFileSync, statSync } from "node:fs";
import path from "node:path";

export function git(repo, args, opts = {}) {
  try {
    return execFileSync("git", ["-c", "core.quotepath=false", "-C", repo, ...args], {
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    if (opts.allowFail) return "";
    throw new Error(`git ${args.join(" ")}: ${String(e.stderr || e.message).trim()}`);
  }
}

export const isGitRepo = (dir) => git(dir, ["rev-parse", "--is-inside-work-tree"], { allowFail: true }).trim() === "true";
export const repoRoot = (dir) => path.resolve(git(dir, ["rev-parse", "--show-toplevel"]).trim());

const refExists = (repo, ref) => git(repo, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { allowFail: true }).trim() !== "";

export function detectDefaultBranch(repo) {
  const remote = git(repo, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], { allowFail: true }).trim();
  if (remote) {
    const local = remote.replace(/^origin\//, "");
    return refExists(repo, local) ? local : remote;
  }
  for (const b of ["main", "master", "develop", "dev", "trunk"]) if (refExists(repo, b)) return b;
  return null;
}

const HIDDEN = /^\.guardian\//;

export function workingChanges(repo) {
  const out = git(repo, ["status", "--porcelain=v1", "-uall"], { allowFail: true });
  return out.split("\n").filter(Boolean).map((l) => {
    const status = l.slice(0, 2).trim();
    let file = l.slice(3);
    if (file.includes(" -> ")) file = file.split(" -> ")[1];
    return { status, file };
  }).filter((c) => !HIDDEN.test(c.file));
}

const hasDiff = (repo, base) => git(repo, ["diff", "--name-only", base, "HEAD"], { allowFail: true }).trim() !== "";

// Decides what to analyze, with no input from the user:
//   feature branch -> vs default branch | dirty tree -> uncommitted changes | else last commit.
export function resolveTarget(repo, o = {}) {
  const current = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"], { allowFail: true }).trim();
  const commits = parseInt(git(repo, ["rev-list", "--count", "HEAD"], { allowFail: true }).trim() || "0", 10);
  if (!commits) return { mode: "none", reason: "repository has no commits yet" };
  const def = detectDefaultBranch(repo);
  const dirty = workingChanges(repo).length > 0;

  const range = (base, label) => {
    const mb = git(repo, ["merge-base", base, "HEAD"], { allowFail: true }).trim() || base;
    return { mode: "range", base, mergeBase: mb, label, current, defaultBranch: def };
  };
  const working = () => ({ mode: "working", label: `uncommitted changes on ${current}`, current, defaultBranch: def });

  if (o.base) return range(o.base, `${current} vs ${o.base}`);
  if (o.working) return dirty ? working() : { mode: "none", reason: "no uncommitted changes" };
  if (o.last) return range(`HEAD~${o.last}`, `last ${o.last} commit(s)`);

  if (def && current && current !== def && current !== "HEAD") {
    const t = range(def, `${current} vs ${def}`);
    if (hasDiff(repo, t.mergeBase)) return t;
  }
  if (dirty) return working();
  if (commits >= 2) return range("HEAD~1", "last commit");
  return { mode: "none", reason: "nothing to compare (clean tree and a single commit)" };
}

export const NOISE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Pipfile\.lock|composer\.lock)$|\.min\.(js|css)$|\.map$|\.(png|jpe?g|gif|svg|ico|pdf|zip|woff2?|ttf|mp4)$|(^|\/)(node_modules|vendor|dist|build|\.next|__pycache__|\.venv|venv)\//i;

export function collectChanges(repo, t) {
  const baseRef = t.mode === "range" ? t.mergeBase : "HEAD";
  const diffArgs = t.mode === "range" ? ["diff", "-U0", "--no-renames", t.mergeBase, "HEAD"] : ["diff", "-U0", "--no-renames", "HEAD"];
  const diff = git(repo, diffArgs);
  const byFile = new Map();
  let cur = null, inHunk = false;
  for (const line of diff.split("\n")) {
    const m = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (m) { cur = { file: m[2], added: [], removed: [], hunks: [] }; byFile.set(cur.file, cur); inHunk = false; continue; }
    if (!cur) continue;
    if (line.startsWith("@@")) { inHunk = true; cur.hunks.push(line.replace(/^@@[^@]*@@\s?/, "")); continue; }
    if (!inHunk) continue;
    if (line.startsWith("+")) cur.added.push(line.slice(1));
    else if (line.startsWith("-")) cur.removed.push(line.slice(1));
  }
  if (t.mode === "working") {
    for (const c of workingChanges(repo)) {
      if (c.status !== "??" || byFile.has(c.file)) continue;
      const abs = path.join(repo, c.file);
      let text = "";
      try { if (statSync(abs).size < 1_000_000) text = readFileSync(abs, "utf8").replace(/\r\n/g, "\n"); } catch { /* unreadable */ }
      byFile.set(c.file, { file: c.file, added: text.split("\n"), removed: [], hunks: [] });
    }
  }
  const out = [];
  for (const c of byFile.values()) {
    if (NOISE.test(c.file) || HIDDEN.test(c.file)) continue;
    const abs = path.join(repo, c.file);
    const headSrc = existsSync(abs) ? safeRead(abs) : null;
    const baseSrc = git(repo, ["show", `${baseRef}:${c.file}`], { allowFail: true }) || null;
    c.status = headSrc === null ? "deleted" : baseSrc === null ? "added" : "modified";
    c.headSrc = headSrc;
    c.baseSrc = baseSrc;
    out.push(c);
  }
  return out;
}

function safeRead(abs) {
  try { return statSync(abs).size > 1_000_000 ? "" : readFileSync(abs, "utf8").replace(/\r\n/g, "\n"); } catch { return null; }
}

export function listFiles(repo) {
  const all = git(repo, ["ls-files", "-co", "--exclude-standard"]).split("\n").filter(Boolean);
  return [...new Set(all)].filter((f) => !NOISE.test(f) && !HIDDEN.test(f) && existsSync(path.join(repo, f)));
}

// Keeps our output folder out of git status without touching the project's tracked files.
export function ensureLocalExclude(repo) {
  const rel = git(repo, ["rev-parse", "--git-path", "info/exclude"], { allowFail: true }).trim();
  if (!rel) return;
  const file = path.resolve(repo, rel);
  try {
    const cur = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (!/^\.guardian\/?$/m.test(cur)) appendFileSync(file, `${cur && !cur.endsWith("\n") ? "\n" : ""}.guardian/\n`);
  } catch { /* best effort */ }
}
