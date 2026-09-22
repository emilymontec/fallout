// Core analysis: given a git repo (any language mix), find what a change can break beyond its diff.
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { repoRoot, resolveTarget, collectChanges, listFiles, ensureLocalExclude } from "./git.mjs";
import * as L from "./lang.mjs";
import { P, esc, uniq } from "./util.mjs";

const CODE = /\.(m|c)?[jt]sx?$|\.py$|\.vue$|\.svelte$|\.html?$/i;
const DOC = /\.(md|mdx|rst|txt)$/i;
const CONF = /\.(ya?ml|json|toml|ini|prisma|sql|graphql|gql)$|(^|\/)\.env[^/]*$/i;
const GENERIC = new Set(["string", "number", "object", "boolean", "function", "undefined", "symbol", "bigint", "default", "true", "false", "null", "None", "True", "False"]);
const STOP = new Set(["name", "type", "data", "value", "text", "date", "time", "code", "path", "size", "title", "body", "status", "slug", "label", "state", "items", "list", "args", "self", "this", "test", "main", "init", "index", "app", "get", "set", "run", "add", "new", "id"]);

export function componentOf(f) {
  const s = f.split("/");
  if (s.length === 1) return "root";
  if (["services", "packages", "apps", "libs", "modules", "projects", "src", "app", "lib", "backend", "frontend", "server", "client"].includes(s[0]) && s.length > 2) return `${s[0]}/${s[1]}`;
  return s[0];
}

const makeReader = (repo) => {
  const cache = new Map();
  return (f) => {
    if (cache.has(f)) return cache.get(f);
    let t = "";
    try { const abs = path.join(repo, f); if (statSync(abs).size <= 1_000_000) t = readFileSync(abs, "utf8").replace(/\r\n/g, "\n"); } catch { /* skip */ }
    cache.set(f, t);
    return t;
  };
};

function consumersOf(file, symbols, importersOf) {
  const direct = new Map();
  const seenBarrel = new Set([file]);
  const queue = [[file, []]];
  while (queue.length) {
    const [cur, barrels] = queue.shift();
    for (const e of importersOf.get(cur) ?? []) {
      const used = e.names === null ? [...symbols] : [...symbols].filter((s) => e.names.has(s));
      if (!used.length) continue;
      if (e.reexport) {
        if (!seenBarrel.has(e.from)) { seenBarrel.add(e.from); queue.push([e.from, [...barrels, e.from]]); }
        continue;
      }
      const prev = direct.get(e.from) ?? { file: e.from, symbols: new Set(), barrels: new Set() };
      used.forEach((s) => prev.symbols.add(s));
      barrels.forEach((b) => prev.barrels.add(b));
      direct.set(e.from, prev);
    }
  }
  return [...direct.values()].map((v) => ({ file: v.file, symbols: [...v.symbols], viaBarrels: [...v.barrels] }));
}

function indirectOf(directFiles, importersOf, levels, exclude) {
  const out = [];
  const seen = new Set([...exclude, ...directFiles]);
  let frontier = directFiles;
  for (let lvl = 2; lvl <= levels; lvl++) {
    const next = [];
    for (const f of frontier)
      for (const e of importersOf.get(f) ?? []) {
        if (seen.has(e.from)) continue;
        seen.add(e.from); next.push(e.from); out.push({ file: e.from, level: lvl, via: f });
      }
    frontier = next;
  }
  return out.slice(0, 60);
}

function reverseClosure(file, importersOf, maxDepth = 4) {
  const seen = new Set([file]);
  let frontier = [file];
  for (let d = 0; d < maxDepth; d++) {
    const next = [];
    for (const f of frontier) for (const e of importersOf.get(f) ?? []) if (!seen.has(e.from)) { seen.add(e.from); next.push(e.from); }
    frontier = next;
  }
  seen.delete(file);
  return seen;
}

function findUsages(name, fileList, exclude, read, cap = 12) {
  const re = new RegExp(`(?<![\\w$])${esc(name)}(?![\\w$])`);
  const out = [];
  for (const f of fileList) {
    if (exclude.has(f)) continue;
    const text = read(f);
    if (!text || !text.includes(name)) continue;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++)
      if (re.test(lines[i])) { out.push({ file: f, line: i + 1, text: lines[i].trim().slice(0, 140) }); if (out.length >= cap) return out; }
  }
  return out;
}

function detectTestCommand(files, read) {
  if (files.includes("package.json")) {
    try {
      const t = JSON.parse(read("package.json")).scripts?.test;
      if (t && !/no test specified/.test(t)) return files.includes("pnpm-lock.yaml") ? "pnpm test" : files.includes("yarn.lock") ? "yarn test" : "npm test";
    } catch { /* ignore */ }
  }
  if (files.some((f) => /(^|\/)manage\.py$/.test(f))) return "python manage.py test";
  if (files.some((f) => /(^|\/)(pytest\.ini|conftest\.py)$/.test(f)) || read("pyproject.toml").includes("pytest")) return "python -m pytest -q";
  return null;
}

export function analyze(repoInput, opts = {}) {
  const repo = repoRoot(repoInput);
  const project = path.basename(repo);
  const depth = opts.depth ?? 2;
  const target = resolveTarget(repo, opts);
  if (opts.writeExclude !== false) ensureLocalExclude(repo);
  const base = { project, repo, generatedAt: new Date().toISOString(), target };
  if (target.mode === "none") return { ...base, skipped: true, risk: "NONE", verdict: "NOTHING TO ANALYZE", reasons: [target.reason] };

  const changes = collectChanges(repo, target);
  if (!changes.length) return { ...base, skipped: true, risk: "NONE", verdict: "NOTHING TO ANALYZE", reasons: ["the diff has no analyzable files"] };

  const files = listFiles(repo);
  const read = makeReader(repo);
  const deleted = changes.filter((c) => c.status === "deleted").map((c) => c.file);
  const S = new Set([...files, ...deleted]);
  const changedSet = new Set(changes.map((c) => c.file));

  // ---- import graph -------------------------------------------------------
  const roots = [""];
  for (const f of files) if (/(^|\/)manage\.py$/.test(f)) { const d = P.dirname(f); if (d !== "." && !roots.includes(d)) roots.push(d); }
  if (files.some((f) => f.startsWith("src/") && f.endsWith(".py")) && !roots.includes("src")) roots.push("src");
  const importersOf = new Map();
  const addEdge = (from, to, names, reexport) => {
    if (from === to) return;
    if (!importersOf.has(to)) importersOf.set(to, []);
    importersOf.get(to).push({ from, names, reexport });
  };
  for (const f of files) {
    const lang = L.langOf(f);
    if (!lang) continue;
    const src = read(f);
    if (!src) continue;
    if (lang === "js") for (const imp of L.jsImports(src)) { const to = L.jsResolve(f, imp.spec, S); if (to) addEdge(f, to, imp.names, imp.reexport); }
    else for (const imp of L.pyImports(src)) for (const r of L.pyResolve(f, imp, S, roots)) addEdge(f, r.to, r.names, f.endsWith("__init__.py"));
  }

  // ---- per changed file: exports, signatures, consumers -------------------
  const breaking = { removedExports: [], signatureChanges: [], removedFields: [], removedRoutes: [] };
  const touched = [];
  const consumerFiles = new Set();
  const textFiles = files.filter((f) => CODE.test(f) || DOC.test(f) || CONF.test(f));
  const codeFiles = files.filter((f) => CODE.test(f));

  for (const c of changes) {
    if (!L.langOf(c.file) || L.isTestFile(c.file)) continue;
    const bx = c.baseSrc ? L.exportsOf(c.file, c.baseSrc) : { names: new Set(), sigs: new Map() };
    const hx = c.headSrc ? L.exportsOf(c.file, c.headSrc) : { names: new Set(), sigs: new Map() };
    const removed = [...bx.names].filter((n) => !hx.names.has(n) && n !== "default");
    const sigChanged = [...bx.sigs].filter(([n, s]) => bx.names.has(n) && hx.sigs.has(n) && hx.sigs.get(n) !== s).map(([n, s]) => ({ symbol: n, before: s, after: hx.sigs.get(n) }));
    // a hunk header only counts when it opens a block (function/class/def), not an unrelated one-liner
    const blockHeaders = c.hunks.filter((h) => /(\{|:|\(|=>)\s*$/.test(h) || /^\s*(async\s+)?(def|class)\b/.test(h));
    const text = [...c.added, ...c.removed, ...blockHeaders].join("\n");
    const symbols = new Set([...removed, ...[...hx.names, ...bx.names].filter((n) => n !== "default" && new RegExp(`(?<![\\w$])${esc(n)}(?![\\w$])`).test(text))]);
    if (!symbols.size) continue;
    const cons = consumersOf(c.file, symbols, importersOf);
    cons.forEach((x) => consumerFiles.add(x.file));
    const comp = componentOf(c.file);
    touched.push({
      file: c.file, component: comp, status: c.status, symbols: [...symbols],
      consumers: cons.map((x) => ({ ...x, component: componentOf(x.file), external: componentOf(x.file) !== comp, isTest: L.isTestFile(x.file) })),
      indirect: indirectOf(cons.map((x) => x.file), importersOf, depth, [c.file]).map((x) => ({ ...x, component: componentOf(x.file) })),
    });
    for (const sym of removed) breaking.removedExports.push({ file: c.file, symbol: sym, deletedFile: c.status === "deleted" });
    for (const s of sigChanged) breaking.signatureChanges.push({ file: c.file, ...s });
  }
  const closureFiles = new Set(consumerFiles);
  for (const t of touched) t.indirect.forEach((i) => closureFiles.add(i.file));

  const usageCap = (name, pool, exclude) => findUsages(name, pool, exclude, read, 8);
  for (const item of [...breaking.removedExports, ...breaking.signatureChanges]) {
    if (STOP.has(item.symbol) || item.symbol.length < 3) continue;
    const excl = new Set([item.file]);
    item.confirmedUsages = usageCap(item.symbol, [...consumerFiles].filter((f) => !excl.has(f)), excl);
    item.possibleUsages = item.confirmedUsages.length ? [] : usageCap(item.symbol, codeFiles.filter((f) => !consumerFiles.has(f)), new Set([...excl, ...changedSet])).slice(0, 4);
  }

  // ---- removed schema fields ---------------------------------------------
  for (const c of changes) {
    if (!/\.(py|prisma)$/.test(c.file) || !c.baseSrc) continue;
    const bf = L.schemaFields(c.file, c.baseSrc), hf = c.headSrc ? L.schemaFields(c.file, c.headSrc) : new Set();
    for (const field of [...bf].filter((x) => !hf.has(x) && x.length >= 4 && !STOP.has(x))) {
      const cons = new Set([...reverseClosure(c.file, importersOf, 3)]);
      const codeHits = findUsages(field, [...cons].filter((f) => CODE.test(f)), new Set([c.file]), read, 8);
      const docHits = findUsages(field, textFiles.filter((f) => !CODE.test(f)), new Set([c.file]), read, 6);
      breaking.removedFields.push({ file: c.file, field, usages: [...codeHits, ...docHits] });
    }
  }

  // ---- stale references to values the change removed ---------------------
  const addedAll = changes.flatMap((c) => c.added).join("\n");
  const cand = new Map();
  for (const c of changes) {
    if (!/\.(m|c)?[jt]sx?$|\.py$|\.ya?ml$|\.json$/.test(c.file)) continue;
    for (const line of c.removed)
      for (const m of line.matchAll(/["'`]([^"'`\s\\]{4,60})["'`]/g)) {
        const lit = m[1];
        if (GENERIC.has(lit) || lit.startsWith(".") || addedAll.includes(lit)) continue;
        cand.set(lit, (cand.get(lit) ?? 0) + 1);
      }
  }
  const score = (l) => (/[_\-:.\d]/.test(l) ? 2 : 0) + (l.length >= 6 ? 1 : 0);
  const literals = [...cand.keys()].sort((a, b) => score(b) - score(a)).slice(0, 12);
  const specs = [];
  for (const f of files) {
    if (!/\.(ya?ml|json)$/i.test(f)) continue;
    const t = read(f);
    if (!t) continue;
    if (/(openapi|swagger)[^/]*\.(ya?ml|json)$/i.test(f) || /^\s*["']?(openapi|swagger)["']?\s*:/m.test(t.slice(0, 4000))) {
      try { const doc = parseYaml(t); if (doc?.paths) specs.push({ file: f, paths: Object.keys(doc.paths) }); } catch { /* not a spec */ }
    }
  }
  const specFiles = new Set(specs.map((s) => s.file));
  const kindOf = (f) => (specFiles.has(f) ? "spec" : L.isTestFile(f) ? "test" : DOC.test(f) ? "doc" : CONF.test(f) ? "config" : "code");
  const stale = [];
  for (const lit of literals) {
    const hits = [];
    for (const f of textFiles) {
      if (changedSet.has(f)) continue;
      const t = read(f);
      if (!t || !t.includes(lit)) continue;
      t.split("\n").forEach((line, i) => { if (line.includes(lit)) hits.push({ file: f, line: i + 1, kind: kindOf(f), inConsumer: consumerFiles.has(f), text: line.trim().slice(0, 140) }); });
      if (hits.length > 40) break;
    }
    if (hits.length) stale.push({ literal: lit, hits });
  }

  // ---- API spec drift (routes vs OpenAPI) --------------------------------
  const routesOf = (lines, file) => lines.flatMap((l) => L.extractRoutes(l).map((r) => ({ ...r, file })));
  const addedRoutes = changes.filter((c) => L.langOf(c.file)).flatMap((c) => routesOf(c.added, c.file));
  const removedRoutesRaw = changes.filter((c) => L.langOf(c.file)).flatMap((c) => routesOf(c.removed, c.file));
  const key = (r) => `${r.method} ${r.path}`;
  const addedKeys = new Set(addedRoutes.map(key));
  const removedRoutes = removedRoutesRaw.filter((r) => !addedKeys.has(key(r)) && !addedRoutes.some((a) => a.path === r.path));
  const specPaths = specs.flatMap((s) => s.paths.map((p) => ({ file: s.file, raw: p, norm: L.normalizeRoute(p) })));
  const matchSpec = (r) => specPaths.find((sp) => sp.norm === r.path || sp.norm.endsWith(r.path));
  const spec = {
    files: specs.map((s) => s.file),
    undocumentedRoutes: specPaths.length ? addedRoutes.filter((r) => !matchSpec(r)) : [],
    removedDocumentedRoutes: removedRoutes.map((r) => ({ ...r, spec: matchSpec(r) })).filter((r) => r.spec).map((r) => ({ method: r.method, path: r.path, file: r.file, specFile: r.spec.file, specPath: r.spec.raw })),
  };
  breaking.removedRoutes = spec.removedDocumentedRoutes;

  // ---- config drift (env vars) -------------------------------------------
  const envFiles = files.filter((f) => /(^|\/)\.env\.(example|sample|template|dist)$/.test(f));
  const envText = [...envFiles, ...files.filter((f) => /(^|\/)README[^/]*$/i.test(f))].map(read).join("\n");
  const removedEnv = new Set(changes.flatMap((c) => c.removed.flatMap(L.extractEnv)));
  const newEnv = uniq(changes.filter((c) => L.langOf(c.file)).flatMap((c) => c.added.flatMap(L.extractEnv))).filter((v) => !removedEnv.has(v));
  const env = { checkedAgainst: envFiles, undocumented: envFiles.length ? newEnv.filter((v) => !envText.includes(v)) : [] };

  // ---- test coverage of the change ---------------------------------------
  const isTestPath = L.isTestFile;
  const testsChanged = changes.filter((c) => isTestPath(c.file)).map((c) => c.file);
  const uncoveredChanged = [];
  for (const t of touched) {
    if (t.status === "deleted") continue;
    const covering = [...reverseClosure(t.file, importersOf, 4)].filter(isTestPath);
    if (!covering.length) uncoveredChanged.push({ file: t.file, symbols: t.symbols });
  }
  const consumersWithoutTests = uniq([...consumerFiles].filter((f) => !isTestPath(f))).filter((f) => ![...reverseClosure(f, importersOf, 3)].some(isTestPath));
  const coverage = { testsChanged, uncoveredChanged, consumersWithoutTests: consumersWithoutTests.slice(0, 15) };

  // ---- optional: run the project's own tests -----------------------------
  let tests = { ran: false };
  if (opts.runTests) {
    const command = detectTestCommand(files, read);
    if (!command) tests = { ran: false, note: "no test command detected" };
    else {
      const r = spawnSync(command, { cwd: repo, shell: true, encoding: "utf8", timeout: (opts.testTimeout ?? 180) * 1000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CI: "1" } });
      const lines = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.split("\n").map((l) => l.trimEnd()).filter(Boolean);
      const bad = lines.filter((l) => /(^|\s)(not ok|✖|FAIL|FAILED|ERROR|Error:|AssertionError|Traceback)/.test(l)).slice(0, 15);
      const tail = bad.length ? bad : lines.slice(-12);
      tests = { ran: true, command, status: r.status, timedOut: r.error?.code === "ETIMEDOUT", passed: r.status === 0, tail };
    }
  }

  // ---- risk ----------------------------------------------------------------
  const reasons = [];
  let level = 0; // 0 low, 1 medium, 2 high
  const bump = (l, why) => { level = Math.max(level, l); reasons.push(why); };
  const ext = touched.flatMap((t) => t.consumers.filter((c) => c.external && !c.isTest));
  const usedRemoved = breaking.removedExports.filter((r) => r.confirmedUsages?.length);
  if (usedRemoved.length) bump(2, `${usedRemoved.length} removed export(s) are still used by consumers`);
  if (breaking.signatureChanges.some((s) => s.confirmedUsages?.length)) bump(2, "function signature changed and callers still use the old one");
  if (breaking.removedFields.some((f) => f.usages.length)) bump(2, "a removed model/schema field is still referenced");
  if (breaking.removedRoutes.length) bump(2, `${breaking.removedRoutes.length} documented API route(s) removed or changed`);
  const staleInCode = stale.filter((s) => s.hits.some((h) => h.kind === "code" && h.inConsumer));
  if (staleInCode.length) bump(2, `values removed by this change (${staleInCode.slice(0, 3).map((s) => `"${s.literal}"`).join(", ")}) are still relied on by consumer code`);
  if (tests.ran && !tests.passed) bump(2, `the project's own test suite fails (${tests.command})`);
  if (ext.length) bump(1, `${uniq(ext.map((c) => c.component)).length} other component(s) depend on what changed`);
  if (stale.some((s) => s.hits.some((h) => ["doc", "spec", "config"].includes(h.kind)))) bump(1, "docs / specs / config still describe values this change removed");
  if (spec.undocumentedRoutes.length) bump(1, `${spec.undocumentedRoutes.length} new API route(s) missing from the OpenAPI spec`);
  if (env.undocumented.length) bump(1, `new environment variable(s) not documented: ${env.undocumented.join(", ")}`);
  if (coverage.uncoveredChanged.length) bump(1, `${coverage.uncoveredChanged.length} changed module(s) have no test that reaches them`);
  if (!reasons.length) reasons.push("no downstream impact detected");
  const risk = ["LOW", "MEDIUM", "HIGH"][level];

  const docsToRead = files.filter((f) => /(^|\/)(README[^/]*|ARCHITECTURE[^/]*|CONTRIBUTING[^/]*)$/i.test(f) || /(^|\/)(adr|adrs|decisions|architecture|docs)\/.*\.(md|mdx)$/i.test(f) || specFiles.has(f)).slice(0, 14);

  return {
    ...base, skipped: false, risk,
    verdict: risk === "HIGH" ? "BLOCK" : risk === "MEDIUM" ? "REVIEW" : "OK",
    reasons,
    counts: { changedFiles: changes.length, code: changes.filter((c) => L.langOf(c.file) && !isTestPath(c.file)).length, tests: testsChanged.length, docs: changes.filter((c) => DOC.test(c.file)).length },
    changed: changes.map((c) => ({ file: c.file, status: c.status, component: componentOf(c.file) })),
    touched, breaking, stale, spec, env, coverage, tests, docsToRead,
  };
}
