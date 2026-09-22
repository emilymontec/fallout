import path from "node:path";

export const P = path.posix;
export const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const norm = (s) => s.replace(/\s+/g, " ").replace(/,\s*$/, "").trim();
export const uniq = (a) => [...new Set(a)];
export const toPosix = (p) => p.replace(/\\/g, "/");
export const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
