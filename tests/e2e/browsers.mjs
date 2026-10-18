// The approval page in Firefox and WebKit (Safari's engine), next to the full
// Chromium run in run.mjs. Each browser gets its own gate and walks the main
// path: enroll a key, confirm it, approve one request (the demo service acts on
// it once), deny another. Any page error or console error (a blocked script,
// a CSP violation) fails the run.
//
// The passkey is Playwright's virtual authenticator (browserContext.credentials),
// which stands in for navigator.credentials in the page. So this checks the
// page, its scripts and styles and the gate in these engines, not each
// browser's own WebAuthn code; run.mjs covers Chromium's.
//
// Usage: PKA_BIN=path/to/phygital-key-mcp node browsers.mjs

import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { firefox, webkit } from "playwright";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BIN = process.env.PKA_BIN || "../../target/release/phygital-key-mcp";
const results = [];
let failed = 0;

function check(name, cond, detail = "") {
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
  if (!cond) failed++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try { await fetch(url); return; } catch { await sleep(100); }
  }
  throw new Error("server did not start: " + url);
}

async function tool(client, name, a) {
  const r = await client.callTool({ name, arguments: a });
  return { ...JSON.parse(r.content?.[0]?.text || "{}"), isError: !!r.isError };
}

async function run(engine, port) {
  const label = engine.name();
  const home = mkdtempSync(join(tmpdir(), `pka-${label}-`));
  const args = (extra = []) => ["--home", home, "--port", String(port), ...extra];
  const GATE = `http://localhost:${port}`;
  const DEMO = `http://localhost:${port + 1}`;
  const gate = spawn(BIN, args(["demo"]), { stdio: ["ignore", "ignore", "pipe"] });
  let gateLog = "";
  gate.stderr.on("data", (d) => { gateLog += d; });
  let browser;
  const problems = [];
  try {
    await waitFor(GATE + "/api/status");
    await waitFor(DEMO + "/");
    browser = await engine.launch();
    const context = await browser.newContext();
    await context.credentials.install();
    const page = await context.newPage();
    page.on("pageerror", (e) => problems.push("page error: " + e.message));
    page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text()); });

    // Enroll and confirm the first key.
    const link = execFileSync(BIN, args(["enroll"])).toString().match(/http\S+#token=\S+/)[0];
    await page.goto(link);
    check(`${label}: token is removed from the address bar`, !page.url().includes("token="));
    await page.fill("#name", `${label} test key`);
    await page.click("#enroll");
    await page.waitForURL(/\/r\//, { timeout: 15000 });
    await page.locator("#actions").waitFor({ state: "visible" });
    await page.click("#approve");
    await page.waitForFunction(() => document.getElementById("title").textContent === "Approved", null, { timeout: 15000 });
    const status = await (await fetch(GATE + "/api/status")).json();
    check(`${label}: first key enrolled and its history checks out`, status.keys.length === 1 && status.history_ok === true);

    // An agent asks; the person approves on the page; the service acts once.
    const token = execFileSync(BIN, args(["token"])).toString().match(/Bearer ([A-Za-z0-9_-]{43})/)[1];
    const mcp = new Client({ name: `${label}-agent`, version: "1.0.0" });
    await mcp.connect(new StreamableHTTPClientTransport(new URL(GATE + "/mcp"), { requestInit: { headers: { Authorization: "Bearer " + token } } }));
    const deploy = { service: "api", env: "production", version: "3.0.0" };
    const req = await tool(mcp, "request_approval", { request: { type: "deploy", params: deploy }, aud: DEMO, level: "high" });
    const waiting = tool(mcp, "get_approval", { id: req.id, wait_seconds: 30 });
    await page.goto(req.approve_url);
    await page.locator("#actions").waitFor({ state: "visible" });
    check(`${label}: page shows the exact request`, (await page.locator("#card").innerText()).includes("production"));
    await page.click("#approve");
    await page.waitForFunction(() => document.getElementById("title").textContent === "Approved", null, { timeout: 15000 });
    const got = await waiting;
    check(`${label}: the agent gets the approval`, got.status === "approved" && typeof got.approval === "string", got.status);
    const act = async () => {
      const res = await fetch(`${DEMO}/deploy`, { method: "POST", headers: { "Content-Type": "application/json", "Phygital-Approval": got.approval }, body: JSON.stringify(deploy) });
      return { status: res.status, body: await res.json() };
    };
    const ok = await act();
    check(`${label}: the service verifies the approval and acts`, ok.status === 200 && ok.body.ok === true, ok.status === 200 ? "" : JSON.stringify(ok.body));
    const again = await act();
    check(`${label}: the same approval is refused the second time`, again.status === 403 && again.body.error === "REPLAYED");

    // Deny.
    const req2 = await tool(mcp, "request_approval", { request: { type: "send_message", params: { to: "a@b.c", text: "hi" } }, aud: DEMO, level: "medium" });
    await page.goto(req2.approve_url);
    await page.locator("#actions").waitFor({ state: "visible" });
    await page.click("#deny");
    const denied = await tool(mcp, "get_approval", { id: req2.id, wait_seconds: 10 });
    check(`${label}: deny reaches the agent, with no approval`, denied.status === "denied" && !denied.approval, denied.status);

    await mcp.close();
    check(`${label}: no page errors and no console errors`, problems.length === 0, problems.join(" | "));
  } catch (e) {
    check(`${label}: no unexpected error`, false, (e.stack || String(e)) + (problems.length ? " | " + problems.join(" | ") : ""));
  } finally {
    if (browser) await browser.close();
    gate.kill();
    rmSync(home, { recursive: true, force: true });
    if (failed) results.push(`${label} gate log:\n${gateLog}`);
  }
}

await run(firefox, 17520);
await run(webkit, 17530);

console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("PASS")).length} passed, ${failed} failed`);
if (failed) process.exit(1);
