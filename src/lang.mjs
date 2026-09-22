// Lightweight, dependency-free source understanding for JS/TS and Python.
// Regex based on purpose: fast, works on any project without a build step.
import { norm, P } from "./util.mjs";

export const langOf = (f) => (/\.(m|c)?[jt]sx?$/.test(f) ? "js" : /\.py$/.test(f) ? "py" : null);
export const isTestFile = (f) =>
  /(^|\/)(tests?|__tests__|spec)\//.test(f) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) || /(^|\/)test_[^/]*\.py$/.test(f) || /_test\.py$/.test(f);

// ---------- exports & signatures ----------
export function jsExports(src) {
  const names = new Set(), sigs = new Map();
  for (const m of src.matchAll(/^\s*export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  if (/^\s*export\s+default\b/m.test(src)) names.add("default");
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g))
    for (const part of m[1].split(",")) {
      const p = part.trim();
      if (p) { const as = p.split(/\s+as\s+/); names.add((as[1] || as[0]).trim()); }
    }
  for (const m of src.matchAll(/(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
  for (const m of src.matchAll(/module\.exports\s*=\s*\{([^}]*)\}/g))
    for (const part of m[1].split(",")) { const k = part.trim().split(/[:\s(]/)[0]; if (k) names.add(k); }
  for (const m of src.matchAll(/(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g)) sigs.set(m[1], norm(m[2]));
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*\*?\s*)?\(([^)]*)\)\s*(?:=>|\{|:)/g)) sigs.set(m[1], norm(m[2]));
  return { names, sigs };
}

export function pyExports(src) {
  const names = new Set(), sigs = new Map();
  for (const m of src.matchAll(/^(?:async[ \t]+)?def[ \t]+([A-Za-z]\w*)[ \t]*\(([^)]*)\)/gm)) { names.add(m[1]); sigs.set(m[1], norm(m[2])); }
  for (const m of src.matchAll(/^class[ \t]+([A-Za-z]\w*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^([A-Z][A-Z0-9_]{2,})[ \t]*=/gm)) names.add(m[1]);
  return { names, sigs };
}

export function exportsOf(file, src) {
  const l = langOf(file);
  return l === "js" ? jsExports(src) : l === "py" ? pyExports(src) : { names: new Set(), sigs: new Map() };
}

// ---------- imports ----------
const isLocalSpec = (s) => s.startsWith(".") || s.startsWith("@/") || s.startsWith("~/");

function jsClause(clause) {
  const names = new Set();
  const braces = clause.match(/\{([^}]*)\}/);
  if (braces)
    for (const p of braces[1].split(",")) {
      const n = p.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (n) names.add(n);
    }
  const rest = clause.replace(/\{[^}]*\}/, "").replace(/\btype\b/, "").replace(/,/g, " ").trim();
  return rest ? null : names; // default or namespace import => depends on the whole module
}

export function jsImports(src) {
  const out = [];
  const add = (spec, names, reexport = false) => { if (isLocalSpec(spec)) out.push({ spec, names, reexport }); };
  for (const m of src.matchAll(/import\s+([^'";]+?)\s+from\s+['"]([^'"]+)['"]/g)) add(m[2], jsClause(m[1]));
  for (const m of src.matchAll(/import\s+['"]([^'"]+)['"]/g)) add(m[1], null);
  for (const m of src.matchAll(/export\s+(\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g))
    add(m[2], m[1].startsWith("*") ? null : jsClause(m[1]), true);
  const spans = [];
  for (const m of src.matchAll(/(?:const|let|var)\s+\{([^}]*)\}\s*=\s*(?:await\s+)?require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    spans.push([m.index, m.index + m[0].length]);
    add(m[2], new Set(m[1].split(",").map((p) => p.trim().split(":")[0].trim()).filter(Boolean)));
  }
  for (const m of src.matchAll(/(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g))
    if (!spans.some(([a, b]) => m.index >= a && m.index < b)) add(m[1], null);
  return out;
}

export function pyImports(src) {
  const out = [];
  for (const m of src.matchAll(/^[ \t]*from[ \t]+(\.*)([\w.]*)[ \t]+import[ \t]+(\([^)]*\)|[^\n#]*)/gm)) {
    const raw = m[3].replace(/[()]/g, " ").replace(/\\\s*\n/g, " ");
    const names = raw.split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    out.push({ dots: m[1].length, mod: m[2], names: names.includes("*") ? null : new Set(names) });
  }
  for (const m of src.matchAll(/^[ \t]*import[ \t]+([\w.,\t ]+)/gm))
    for (const part of m[1].split(",")) {
      const mod = part.trim().split(/\s+as\s+/)[0].trim();
      if (mod) out.push({ dots: 0, mod, names: null });
    }
  for (const m of src.matchAll(/include\(\s*['"]([\w.]+)['"]/g)) out.push({ dots: 0, mod: m[1], names: null });
  return out;
}

const JS_EXT = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];
export function jsResolve(from, spec, S) {
  const base = spec.startsWith(".") ? P.normalize(P.join(P.dirname(from), spec)) : P.normalize("src/" + spec.slice(2));
  const cands = [base, ...JS_EXT.map((e) => base + e), ...JS_EXT.map((e) => `${base}/index${e}`)];
  const stripped = base.replace(/\.(m|c)?jsx?$/, "");
  if (stripped !== base) cands.push(stripped + ".ts", stripped + ".tsx");
  return cands.find((c) => S.has(c)) || null;
}

// returns [{to, names}] for one python import statement
export function pyResolve(from, imp, S, roots) {
  const res = [];
  const modParts = imp.mod ? imp.mod.split(".") : [];
  const tryMod = (parts) => {
    const b = parts.join("/");
    return [`${b}.py`, `${b}/__init__.py`].find((c) => S.has(c)) || null;
  };
  let dirs;
  if (imp.dots > 0) {
    let d = P.dirname(from);
    for (let i = 1; i < imp.dots; i++) d = P.dirname(d);
    dirs = [d === "." ? "" : d];
  } else dirs = roots;
  for (const dir of dirs) {
    const prefix = dir ? dir.split("/") : [];
    if (modParts.length) {
      const hit = tryMod([...prefix, ...modParts]);
      if (hit) res.push({ to: hit, names: imp.names });
    } else if (imp.dots > 0) {
      const init = [...prefix, "__init__.py"].join("/");
      if (S.has(init)) res.push({ to: init, names: imp.names });
    }
    if (imp.names)
      for (const n of imp.names) {
        const sub = tryMod([...prefix, ...modParts, n]);
        if (sub) res.push({ to: sub, names: null });
      }
    if (res.length) break;
  }
  return res;
}

// ---------- schema fields (Django / SQLAlchemy / Prisma) ----------
export function schemaFields(file, src) {
  const out = new Set();
  if (/\.py$/.test(file))
    for (const m of src.matchAll(/^[ \t]+(\w+)[ \t]*(?::[^=\n]+)?=[ \t]*[\w.]*(?:Field|Column|ForeignKey|relationship|mapped_column)\(/gm)) out.add(m[1]);
  if (/\.prisma$/.test(file))
    for (const m of src.matchAll(/^[ \t]+(\w+)[ \t]+[A-Z]\w*[?\[\]]*/gm)) out.add(m[1]);
  return out;
}

// ---------- routes & env vars ----------
export function extractRoutes(line) {
  const r = [];
  const recv = "(?:app|router|server|fastify|route|routes|api_router|\\w+Router|\\w+Routes)";
  for (const m of line.matchAll(new RegExp(`\\b${recv}\\.(get|post|put|patch|delete|all)\\(\\s*['"\`](/[^'"\`]*)['"\`]`, "g"))) r.push({ method: m[1].toUpperCase(), path: m[2] });
  for (const m of line.matchAll(/@[\w.]+\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) r.push({ method: m[1].toUpperCase(), path: m[2] });
  for (const m of line.matchAll(/@[\w.]+\.route\(\s*['"]([^'"]+)['"]/g)) r.push({ method: "ANY", path: m[1] });
  for (const m of line.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*['"`]([^'"`]*)['"`]/g)) r.push({ method: m[1].toUpperCase(), path: m[2] });
  for (const m of line.matchAll(/\b(?:re_)?path\(\s*r?['"]([^'"]*)['"]/g)) r.push({ method: "ANY", path: m[1] });
  return r.map((x) => ({ ...x, path: normalizeRoute(x.path) })).filter((x) => x.path !== "/" && x.path.length > 1);
}

export function normalizeRoute(p) {
  let s = "/" + String(p).split("?")[0];
  s = s.replace(/<[^>]+>/g, "{}").replace(/\{[^}]*\}/g, "{}").replace(/:[A-Za-z_]\w*/g, "{}");
  s = s.replace(/\/+/g, "/");
  return s.length > 1 ? s.replace(/\/$/, "") : s;
}

export function extractEnv(line) {
  const out = [];
  const pats = [
    /process\.env\.([A-Z][A-Z0-9_]+)/g,
    /process\.env\[\s*['"]([A-Z][A-Z0-9_]+)['"]\s*\]/g,
    /os\.environ(?:\.get)?\s*[\[(]\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
    /os\.getenv\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
    /\benv(?:\.\w+)?\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
  ];
  for (const re of pats) for (const m of line.matchAll(re)) out.push(m[1]);
  return out;
}
