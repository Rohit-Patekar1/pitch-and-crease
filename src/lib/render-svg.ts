/**
 * Extract <svg> elements from an article body HTML string and render each
 * one to a 1200×675 PNG (Twitter's preferred social-card aspect). Uses
 * @resvg/resvg-js — pure-JS rasterizer, no native deps to install.
 *
 * Output is a list of base64-encoded PNG strings (no data: prefix), one per
 * SVG, in the same order they appear in the body.
 */
import { Resvg } from "@resvg/resvg-js";

export interface RenderedImage {
  /** Base64-encoded PNG, no data: prefix */
  base64: string;
  /** 0-based index of the SVG in the original body */
  index: number;
  /** Optional alt text — usually pulled from a sibling .viz-title or fallback */
  alt: string;
}

const TARGET_WIDTH = 1200;

/** Extract a friendly alt for an SVG by looking at the closest preceding viz-title. */
function findAltForSvg(html: string, svgStart: number): string {
  // Scan backwards from the svg for a `<div class="viz-title">…</div>`
  const before = html.slice(Math.max(0, svgStart - 1500), svgStart);
  const m = before.match(/<div[^>]*viz-title[^>]*>([\s\S]*?)<\/div>/);
  if (m) return cleanText(m[1]).slice(0, 220);
  // Fallback: nearest preceding <h2>
  const h2 = before.match(/<h2[^>]*>([\s\S]*?)<\/h2>/g);
  if (h2 && h2.length > 0) {
    const last = h2[h2.length - 1];
    return cleanText(last.replace(/<[^>]+>/g, "")).slice(0, 220);
  }
  return "Pitch and Crease — visualization";
}

function cleanText(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function renderOneSvg(svgString: string): Buffer {
  // Wrap with a dark background so the social card looks good even if the SVG
  // itself doesn't paint a backdrop.
  const wrapped = wrapSvgWithBackground(svgString);
  const resvg = new Resvg(wrapped, {
    background: "#0b0e14",
    fitTo: { mode: "width", value: TARGET_WIDTH },
    font: { loadSystemFonts: true },
  });
  return resvg.render().asPng();
}

/**
 * Add a dark canvas behind the SVG content so empty negative space matches
 * the site theme rather than coming out white.
 */
function wrapSvgWithBackground(svg: string): string {
  // If the svg has no viewBox we can't easily wrap; just return it.
  const vbMatch = svg.match(/viewBox\s*=\s*"([^"]+)"/);
  if (!vbMatch) return svg;
  const [, vb] = vbMatch;
  const [, , w, h] = vb.split(/\s+/).map(Number);
  if (!w || !h) return svg;
  // Insert a <rect> as the first child of the svg
  const insertAt = svg.indexOf(">", svg.indexOf("<svg")) + 1;
  const bg = `<rect x="0" y="0" width="${w}" height="${h}" fill="#0b0e14"/>`;
  return svg.slice(0, insertAt) + bg + svg.slice(insertAt);
}

/**
 * Public entry point — find every <svg>...</svg> in `html` and render each.
 * Indexes are stable in source order, which matches what Claude refers to in
 * its `twitterImageMap` output.
 */
export function renderSvgsFromHtml(html: string): RenderedImage[] {
  const out: RenderedImage[] = [];
  // Match outermost <svg ...>...</svg>. SVGs can't nest, so the regex is fine.
  const svgRegex = /<svg[\s\S]*?<\/svg>/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = svgRegex.exec(html)) !== null) {
    const svgStr = m[0];
    const start = m.index;
    try {
      const png = renderOneSvg(svgStr);
      out.push({
        base64: png.toString("base64"),
        index: i,
        alt: findAltForSvg(html, start),
      });
    } catch (err) {
      console.warn(`[render-svg] failed to render svg #${i}:`, err);
    }
    i++;
  }
  return out;
}
