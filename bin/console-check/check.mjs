#!/usr/bin/env node
// Headless-browser smoke test for the experiments platform.
//
//   node bin/console-check/check.mjs <url> [url...]
//
// Loads each URL in headless Chromium (mobile viewport), waits for it to settle,
// and prints any console errors, uncaught page errors, and failed network
// requests. Exits non-zero if any hard error is found — so it doubles as a gate.
//
// Why this exists: server-side checks (curl, build output) miss runtime bugs that
// only surface in the browser (e.g. a JS exception that stops a component from
// rendering). Always run this after a front-end change. See CLAUDE.md.
//
// Requires the playwright-core dep here (run `npm install` in this dir once) and a
// cached Chromium (already present under ~/.cache/ms-playwright from a prior
// Playwright install; this script only locates the binary, it never downloads).

import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function findChromium() {
  const base = path.join(os.homedir(), ".cache", "ms-playwright");
  let dirs = [];
  try {
    dirs = fs.readdirSync(base);
  } catch {
    return null;
  }
  // Prefer full chromium over the headless shell; newest build first.
  const score = (d) => (d.startsWith("chromium-") ? 2 : d.startsWith("chromium_headless_shell-") ? 1 : 0);
  for (const d of dirs.filter((d) => score(d)).sort((a, b) => score(b) - score(a) || b.localeCompare(a))) {
    for (const rel of ["chrome-linux64/chrome", "chrome-linux/chrome", "chrome-linux/headless_shell"]) {
      const p = path.join(base, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error("usage: node check.mjs <url> [url...]");
  process.exit(2);
}

const exe = findChromium();
if (!exe) {
  console.error(
    "No cached Chromium found under ~/.cache/ms-playwright. Install one with:\n" +
      "  npx playwright install chromium"
  );
  process.exit(2);
}

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
let hardErrors = 0;

for (const url of urls) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone-ish
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const badRequests = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
    else if (m.type() === "warning") consoleWarnings.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("requestfailed", (r) => {
    // ERR_ABORTED is a canceled request (e.g. Next.js RSC <Link> prefetches the
    // browser tears down on navigation) — benign noise, not a failure.
    const err = r.failure()?.errorText || "failed";
    if (err.includes("ERR_ABORTED")) return;
    badRequests.push(`${r.url()} (${err})`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) badRequests.push(`${r.status()} ${r.url()}`);
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch (e) {
    pageErrors.push(`navigation failed: ${e.message}`);
  }
  await page.waitForTimeout(1200); // let deferred scripts / fetches run

  const ok = !pageErrors.length && !consoleErrors.length && !badRequests.length;
  console.log(`\n${ok ? "✓" : "✗"} ${url}`);
  if (pageErrors.length) console.log("  page errors:   ", JSON.stringify(pageErrors, null, 2));
  if (consoleErrors.length) console.log("  console.error: ", JSON.stringify(consoleErrors, null, 2));
  if (badRequests.length) console.log("  bad requests:  ", JSON.stringify([...new Set(badRequests)], null, 2));
  if (consoleWarnings.length) console.log("  warnings:      ", JSON.stringify(consoleWarnings, null, 2));
  if (pageErrors.length || consoleErrors.length || badRequests.length) hardErrors++;

  await page.close();
}

await browser.close();
console.log(`\n${hardErrors ? `✗ ${hardErrors} URL(s) had errors` : "✓ all clean"}`);
process.exit(hardErrors ? 1 : 0);
