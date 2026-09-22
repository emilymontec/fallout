import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ICON = { HIGH: "🔴", MEDIUM: "🟠", LOW: "🟢", NONE: "⚪" };
const id = (s) => "n_" + s.replace(/[^A-Za-z0-9]/g, "_");
const loc = (h) => `\`${h.file}:${h.line}\``;

export function renderMarkdown(r) {
  const m = [];
  m.push(`# Guardian report: ${r.project}`, "");
  if (r.skipped) { m.push(`Nothing to analyze: ${r.reasons[0]}.`); return m.join("\n"); }
  m.push(`**Target:** ${r.target.label} · ${r.counts.changedFiles} changed file(s) (${r.counts.code} source, ${r.counts.tests} test, ${r.counts.docs} doc)`);
  m.push(`**Risk:** ${ICON[r.risk]} ${r.risk} → **${r.verdict}**`, "");
  m.push("Why:", ...r.reasons.map((x) => `- ${x}`), "");

  const b = r.breaking;
  if (b.removedExports.length || b.signatureChanges.length || b.removedFields.length || b.removedRoutes.length) {
    m.push("## Breaking-change signals");
    for (const x of b.removedExports) m.push(`- Removed export \`${x.symbol}\` from \`${x.file}\`${x.deletedFile ? " (file deleted)" : ""}. ${x.confirmedUsages?.length ? "Still used at: " + x.confirmedUsages.slice(0, 4).map(loc).join(", ") : "No usage found."}`);
    for (const x of b.signatureChanges) m.push(`- Signature of \`${x.symbol}\` changed: \`(${x.before})\` → \`(${x.after})\`. ${x.confirmedUsages?.length ? "Callers: " + x.confirmedUsages.slice(0, 4).map(loc).join(", ") : "No callers found in consumers."}`);
    for (const x of b.removedFields) m.push(`- Removed field \`${x.field}\` in \`${x.file}\`. ${x.usages.length ? "Still referenced at: " + x.usages.slice(0, 4).map(loc).join(", ") : "No references found."}`);
    for (const x of b.removedRoutes) m.push(`- Route ${x.method} \`${x.path}\` (\`${x.file}\`) was removed/changed but the spec \`${x.specFile}\` still documents \`${x.specPath}\`.`);
    m.push("");
  }

  m.push("## Blast radius");
  if (!r.touched.length) m.push("No exported code was touched, so no downstream consumers were found.", "");
  const edges = new Map();
  for (const t of r.touched) {
    const ext = t.consumers.filter((c) => c.external);
    const inn = t.consumers.filter((c) => !c.external);
    m.push(`### \`${t.file}\` (${t.component})`, `Touched exports: ${t.symbols.map((s) => `\`${s}\``).join(", ")}`, "");
    if (ext.length) {
      m.push("| Depends on it | Component | Uses | Via |", "| --- | --- | --- | --- |");
      for (const c of ext) {
        m.push(`| \`${c.file}\`${c.isTest ? " (test)" : ""} | ${c.component} | ${c.symbols.map((s) => `\`${s}\``).join(", ")} | ${c.viaBarrels.length ? c.viaBarrels.map((v) => `\`${v}\``).join(", ") : "direct"} |`);
        const k = `${c.component}|${t.component}`;
        edges.set(k, [...new Set([...(edges.get(k) ?? []), ...c.symbols])]);
      }
    } else m.push("No other component imports what changed.");
    if (inn.length) m.push("", `Same component: ${inn.slice(0, 8).map((c) => `\`${c.file}\``).join(", ")}${inn.length > 8 ? ", ..." : ""}`);
    if (t.indirect.length) m.push("", `Second-order (depends on a consumer): ${t.indirect.slice(0, 8).map((c) => `\`${c.file}\``).join(", ")}${t.indirect.length > 8 ? ", ..." : ""}`);
    m.push("");
  }
  if (edges.size) {
    m.push("```mermaid", "graph LR");
    const changedComps = new Set(r.touched.map((t) => t.component));
    for (const [k, syms] of edges) { const [from, to] = k.split("|"); m.push(`  ${id(from)}["${from}"] -->|${syms.slice(0, 2).join(", ")}| ${id(to)}["${to}"]`); }
    for (const c of changedComps) m.push(`  style ${id(c)} fill:#fecaca,stroke:#dc2626`);
    m.push("```", "");
  }

  if (r.stale.length) {
    m.push("## Stale references (values this change removed, still used elsewhere)");
    for (const s of r.stale) {
      const byKind = {};
      for (const h of s.hits) (byKind[h.kind] ??= []).push(h);
      m.push(`- \`${s.literal}\`: ` + Object.entries(byKind).map(([k, hs]) => `${k}: ${hs.slice(0, 3).map(loc).join(", ")}${hs.length > 3 ? ` (+${hs.length - 3})` : ""}`).join(" · "));
    }
    m.push("");
  }
  if (r.spec.files.length) {
    m.push(`## API spec (${r.spec.files.map((f) => `\`${f}\``).join(", ")})`);
    m.push(r.spec.undocumentedRoutes.length ? r.spec.undocumentedRoutes.map((x) => `- New route ${x.method} \`${x.path}\` (\`${x.file}\`) is not in the spec`).join("\n") : "- No undocumented new routes.");
    m.push("");
  }
  if (r.env.undocumented.length) m.push("## Configuration drift", ...r.env.undocumented.map((v) => `- \`${v}\` is read by new code but missing from ${r.env.checkedAgainst.map((f) => `\`${f}\``).join(", ")}`), "");

  m.push("## Test coverage of the change");
  m.push(r.coverage.uncoveredChanged.length ? r.coverage.uncoveredChanged.map((u) => `- No test reaches \`${u.file}\` (${u.symbols.map((s) => `\`${s}\``).join(", ")}). Write one.`).join("\n") : "- Every changed module is reached by at least one test.");
  if (r.coverage.consumersWithoutTests.length) m.push(`- Consumers with no test: ${r.coverage.consumersWithoutTests.slice(0, 8).map((f) => `\`${f}\``).join(", ")}`);
  if (r.tests.ran) m.push("", `### Project tests: \`${r.tests.command}\` → ${r.tests.passed ? "PASS ✅" : r.tests.timedOut ? "TIMEOUT ⏱" : "FAIL ❌"}`, "```", ...r.tests.tail, "```");
  else if (r.tests.note) m.push(`- Tests not run: ${r.tests.note}`);
  m.push("", "---", "_Heuristic static analysis (imports, names, literals). It finds candidates with evidence; it does not prove a break. Run with `--run-tests` to also execute the project's tests._");
  return m.join("\n");
}

export function summaryLine(r) {
  if (r.skipped) return `| ${r.project} | ⚪ - | ${r.reasons[0]} | - | - |`;
  return `| ${r.project} | ${ICON[r.risk]} ${r.risk} | ${r.target.label} | ${r.counts.changedFiles} | ${r.reasons[0]} |`;
}

export function writeReports(r, dir, markdown) {
  mkdirSync(dir, { recursive: true });
  const md = path.join(dir, "report.md"), js = path.join(dir, "report.json");
  writeFileSync(md, markdown);
  writeFileSync(js, JSON.stringify(r, (k, v) => (v instanceof Set ? [...v] : v), 2));
  return { md, js };
}
