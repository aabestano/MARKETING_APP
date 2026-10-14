import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

type RGB = [number, number, number];

/** WCAG relative luminance and contrast, so token edits cannot slip back under 4.5:1. */
function lin(channel: number) {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function lum(rgb: RGB) {
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

function contrast(a: RGB, b: RGB) {
  const lighter = Math.max(lum(a), lum(b));
  const darker = Math.min(lum(a), lum(b));
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(fg: RGB, bg: RGB, alpha: number): RGB {
  return fg.map((channel, i) => Math.round(channel * alpha + bg[i] * (1 - alpha))) as RGB;
}

function block(css: string, start: string, end: string) {
  const from = css.indexOf(start);
  assert.ok(from >= 0, `missing ${start}`);
  const to = css.indexOf(end, from + start.length);
  assert.ok(to > from, `missing ${end}`);
  const vars: Record<string, RGB> = {};
  for (const match of css.slice(from, to).matchAll(/--([a-z]+-\d+):\s*(\d+)\s+(\d+)\s+(\d+)/g)) {
    vars[match[1]] = [Number(match[2]), Number(match[3]), Number(match[4])];
  }
  return vars;
}

/** Unmapped Tailwind 500 shades used for badge washes. */
const ACCENT_500: Record<string, RGB> = {
  indigo: [99, 102, 241],
  purple: [168, 85, 247],
  fuchsia: [217, 70, 239],
  amber: [245, 158, 11],
  emerald: [16, 185, 129],
  blue: [59, 130, 246],
  red: [239, 68, 68],
};

test("theme text colors clear 4.5:1", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const dark = block(css, ":root,", "\n.light {");
  const light = block(css, "\n.light {", ".light .sidebar-scope");
  const side = block(css, ".light .sidebar-scope", "\nhtml,");

  const atLeast = (ratio: number, label: string) => {
    assert.ok(ratio >= 4.5, `${label} is ${ratio.toFixed(2)}:1`);
  };

  for (const bg of ["slate-800", "slate-900", "slate-950"]) {
    atLeast(contrast(dark["slate-500"], dark[bg]), `dark slate-500 on ${bg}`);
  }
  atLeast(contrast(dark["slate-400"], dark["slate-900"]), "dark placeholder on input");
  atLeast(contrast(light["slate-500"], light["slate-900"]), "light slate-500 on white");
  atLeast(contrast(light["slate-500"], light["slate-950"]), "light slate-500 on canvas");
  atLeast(contrast(light["slate-400"], light["slate-900"]), "light placeholder on input");
  atLeast(contrast(side["slate-500"], side["slate-950"]), "sidebar muted text on navy");
  atLeast(contrast(side["slate-400"], side["slate-950"]), "sidebar step numbers on navy");
  atLeast(contrast(side["emerald-400"], side["slate-950"]), "sidebar emerald text on navy");
  atLeast(contrast(side["blue-400"], side["slate-950"]), "sidebar blue text on navy");

  for (const theme of [
    { name: "dark", tokens: dark, canvas: dark["slate-950"], card: dark["slate-900"] },
    { name: "light", tokens: light, canvas: light["slate-950"], card: light["slate-900"] },
  ]) {
    for (const family of Object.keys(ACCENT_500)) {
      for (const shade of [200, 300, 400]) {
        const fg = theme.tokens[`${family}-${shade}`];
        if (!fg) continue;
        const tint = mix(ACCENT_500[family], theme.card, 0.1);
        atLeast(contrast(fg, tint), `${theme.name} ${family}-${shade} on a 10% wash`);
        atLeast(contrast(fg, theme.canvas), `${theme.name} ${family}-${shade} on canvas`);
      }
    }
  }

  atLeast(contrast(light["red-400"], mix(ACCENT_500.red, light["slate-900"], 0.15)), "light red-400 on a 15% wash");
  atLeast(contrast(dark["red-400"], mix(ACCENT_500.red, dark["slate-900"], 0.15)), "dark red-400 on a 15% wash");

  const white: RGB = [255, 255, 255];
  atLeast(contrast(white, [37, 99, 235]), "white on blue-600");
  atLeast(contrast(white, [29, 78, 216]), "white on blue-700");
  atLeast(contrast(white, [4, 120, 87]), "white on emerald-700");
  atLeast(contrast(white, [6, 95, 70]), "white on emerald-800");
});

test("failing contrast classes were retargeted", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /placeholder:text-slate-400/);
  assert.doesNotMatch(css, /placeholder:text-slate-600/);
  assert.match(css, /bg-blue-600 text-white hover:bg-blue-700/);
  assert.match(css, /bg-emerald-700 text-white hover:bg-emerald-800/);

  const inspect = readFileSync(new URL("../components/IdeaInspect.tsx", import.meta.url), "utf8");
  assert.match(inspect, /text-indigo-300/);
  assert.doesNotMatch(inspect, /text-indigo-100/);

  const studio = readFileSync(new URL("../components/DesignStudio.tsx", import.meta.url), "utf8");
  assert.match(studio, /hover:text-slate-100/);
  assert.doesNotMatch(studio, /hover:text-white/);
});
