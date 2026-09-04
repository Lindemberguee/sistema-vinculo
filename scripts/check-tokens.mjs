/**
 * Design-token guard. Fails if a page/feature file uses a raw hex colour or an
 * arbitrary `text-[<number>...]` size — those belong to tokens (globals.css) and
 * the named type scale (`text-ui`, `text-num`, …).
 *
 * Allowed to use raw values:
 *  - components/ui/**      (the primitive layer defines the tokens' usage)
 *  - blocks/**             (tenant theming: inline `style={{ background: accent }}`)
 *  - style-guide/**        (shows the raw values on purpose)
 *  - **\/*.test.ts(x)      (fixtures)
 *
 * Run: node scripts/check-tokens.mjs   (exit 1 on any violation)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["apps/web/src/app", "apps/web/src/components"];
const ALLOW = [
  /[\\/]components[\\/]ui[\\/]/,
  /[\\/]blocks[\\/]/,
  /[\\/]style-guide[\\/]/,
  /[\\/]email-builder[\\/]/, // renders e-mail HTML (not Tailwind) — hex is correct there
  /[\\/]app[\\/]api[\\/]/, // route handlers return raw HTML/JSON strings
  /\.test\.tsx?$/,
];
/** A line carrying this marker is exempt (e.g. a third-party brand colour). */
const INLINE_ALLOW = /tokens-allow/;

const HEX = /#[0-9a-fA-F]{6}\b/g;
const TEXT_ARBITRARY = /\btext-\[[0-9]/g;

/** @type {{file:string, line:number, kind:string, text:string}[]} */
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.tsx?$/.test(name)) continue;
    if (ALLOW.some((re) => re.test(p))) continue;
    const lines = readFileSync(p, "utf8").split("\n");
    lines.forEach((ln, i) => {
      if (INLINE_ALLOW.test(ln)) return;
      for (const [re, kind] of [
        [HEX, "raw hex"],
        [TEXT_ARBITRARY, "arbitrary text size"],
      ]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(ln))) hits.push({ file: relative(process.cwd(), p), line: i + 1, kind, text: m[0] });
      }
    });
  }
}

for (const r of ROOTS) walk(r);

if (hits.length === 0) {
  console.log("check-tokens: clean ✓");
  process.exit(0);
}

console.error(`check-tokens: ${hits.length} violation(s)\n`);
for (const h of hits) console.error(`  ${h.file}:${h.line}  [${h.kind}]  ${h.text}`);
console.error(
  "\nUse a token (globals.css @theme) or the named scale (text-ui/text-num/…).\n" +
    "If a value genuinely must be inline (tenant accent), move that code under blocks/.",
);
process.exit(1);
