/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script, run outside the app */
/**
 * Accessibility sweep for the review harness: axe-core (WCAG 2.2 A/AA rules) plus a keyboard walk
 * that tabs through each page and flags focus stops with no visible focus style or no accessible name.
 * Reuses the fixture session from review.cjs.
 *
 *   NODE_PATH=<dir with playwright + axe-core> node tests/visual/a11y.cjs [route,...]
 */
const fs = require("node:fs");
const { chromium } = require("playwright");
const { setup, BASE, runStep } = require("./review.cjs");

const ROUTES = (process.argv[2] || "/dashboard,/pos,/orders,/orders/o-1").split(",");
const WIDTH = Number(process.env.REVIEW_WIDTH || 1440);
const TABS = Number(process.env.REVIEW_TABS || 40);
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, ignoreHTTPSErrors: true, reducedMotion: "reduce" });
  await setup(context);
  const page = await context.newPage();
  let problems = 0;
  for (const route of ROUTES) {
    const [pathOnly, step] = route.split("#");
    await page.goto(BASE + pathOnly, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    if (step) await runStep(page, step, WIDTH);
    await page.addScriptTag({ content: axeSource });
    const axe = await page.evaluate(async () =>
      (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations
        .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) })));
    const stops = [];
    await page.locator("body").click({ position: { x: 1, y: 1 } }).catch(() => undefined);
    for (let i = 0; i < TABS; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const visible = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none");
        if (el.tagName.toLowerCase() === "nextjs-portal") return null; // dev overlay
        const name = el.getAttribute("aria-label") || (el.labels && el.labels[0]?.textContent?.trim()) || el.textContent?.trim().slice(0, 40) || el.getAttribute("placeholder") || el.getAttribute("title") || "";
        const r = el.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), name, visible, small: r.width < 24 || r.height < 24 };
      });
      if (info) stops.push(info);
    }
    const noRing = stops.filter((s) => !s.visible);
    const noName = stops.filter((s) => !s.name);
    console.log(`\n${route} @${WIDTH}: axe ${axe.length} · ${stops.length} tab stops · ${noRing.length} without focus style · ${noName.length} unnamed`);
    for (const v of axe) console.log(`  axe ${v.impact} ${v.id}: ${v.help} → ${v.nodes.join(" | ")}`);
    for (const s of noRing.slice(0, 8)) console.log(`  no focus style: <${s.tag}> ${s.name}`);
    for (const s of noName.slice(0, 8)) console.log(`  unnamed: <${s.tag}>`);
    problems += axe.length + noRing.length + noName.length;
  }
  await browser.close();
  process.exitCode = problems ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
