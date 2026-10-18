// Abuse tests: a program on this computer (an AI agent, a bad page, malware)
// tries to wear the gate down. The gate only listens on localhost, so this is
// about staying up and staying correct, never about letting anything through.
// Each case runs against a live gate, then checks the gate still answers.
//
// Usage: PKA_BIN=path/to/phygital-key-mcp node abuse.mjs

import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

const BIN = process.env.PKA_BIN || "../../target/release/phygital-key-mcp";
const PORT = 17540;
const GATE = `http://localhost:${PORT}`;
const home = mkdtempSync(join(tmpdir(), "pka-abuse-"));
const args = (extra = []) => ["--home", home, "--port", String(PORT), ...extra];
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

// The gate answers /api/status within `ms`.
async function alive(ms = 2000) {
  try {
    const r = await fetch(GATE + "/api/status", { signal: AbortSignal.timeout(ms) });
    return r.status === 200;
  } catch {
    return false;
  }
}

// Send raw bytes on a new connection; resolve with what came back (or "" on close/timeout).
function raw(bytes, { wait = 3000 } = {}) {
  return new Promise((resolve) => {
    const s = net.connect(PORT, "127.0.0.1");
    let got = "";
    const done = () => { s.destroy(); resolve(got); };
    s.setTimeout(wait, done);
    s.on("data", (d) => { got += d.toString("latin1"); });
    s.on("error", done);
    s.on("close", done);
    s.on("connect", () => s.write(bytes));
  });
}

function rssMb(pid) {
  try {
    return Number(execFileSync("ps", ["-o", "rss=", "-p", String(pid)]).toString().trim()) / 1024;
  } catch {
    return NaN;
  }
}

const gate = spawn(BIN, args(["serve"]), { stdio: ["ignore", "ignore", "pipe"] });
let gateLog = "";
gate.stderr.on("data", (d) => { gateLog += d; });

try {
  await waitFor(GATE + "/api/status");
  const token = execFileSync(BIN, args(["token"])).toString().match(/Bearer ([A-Za-z0-9_-]{43})/)[1];
  const startRss = rssMb(gate.pid);

  // 1. Huge bodies are refused before they are read in full.
  const big = "x".repeat(10 * 1024 * 1024);
  for (const [path, headers] of [
    ["/api/enroll/begin", { "Content-Type": "application/json", Origin: GATE }],
    ["/mcp", { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: "Bearer " + token }],
  ]) {
    let status = 0;
    try { status = (await fetch(GATE + path, { method: "POST", headers, body: big, signal: AbortSignal.timeout(10000) })).status; } catch { status = -1; }
    check(`a 10 MB body to ${path} is refused`, status === 413 || status === 400 || status === -1, String(status));
  }
  check("still answers after huge bodies", await alive());

  // 2. A 10 MB body without the MCP token is refused as unauthorised, not read.
  let noTok = 0;
  try { noTok = (await fetch(GATE + "/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: big, signal: AbortSignal.timeout(10000) })).status; } catch { noTok = -1; }
  check("a 10 MB body without the token is refused", noTok === 401 || noTok === 413 || noTok === -1, String(noTok));

  // 3. Deep JSON nesting and junk JSON to the MCP endpoint.
  const deep = "[".repeat(50000) + "]".repeat(50000);
  const deepRes = await fetch(GATE + "/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: "Bearer " + token }, body: deep });
  check("50,000-deep JSON is refused, not crashed on", deepRes.status >= 400 && deepRes.status < 500, String(deepRes.status));
  check("still answers after deep JSON", await alive());

  // 4. Oversized and malformed headers.
  // hyper (the HTTP server) reads up to about 400 KB of headers, then refuses.
  const hugeHeader = await raw(`GET /api/status HTTP/1.1\r\nHost: localhost:${PORT}\r\nX-Junk: ${"a".repeat(1024 * 1024)}\r\n\r\n`);
  check("a 1 MB header is refused", hugeHeader === "" || /^HTTP\/1\.1 (4\d\d)/.test(hugeHeader), hugeHeader.slice(0, 40));
  const manyHeaders = await raw(`GET /api/status HTTP/1.1\r\nHost: localhost:${PORT}\r\n${Array.from({ length: 2000 }, (_, i) => `X-${i}: 1\r\n`).join("")}\r\n`);
  check("2000 headers are refused", manyHeaders === "" || /^HTTP\/1\.1 4\d\d/.test(manyHeaders), manyHeaders.slice(0, 40));
  const garbage = await raw(Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 37 + 11) % 256)));
  check("random bytes get an error or a closed connection", garbage === "" || /^HTTP\/1\.1 4\d\d/.test(garbage), garbage.slice(0, 40));
  check("still answers after bad headers", await alive());

  // 5. Many idle and slow connections at once (slowloris). The gate must keep answering.
  const held = [];
  for (let i = 0; i < 200; i++) {
    const s = net.connect(PORT, "127.0.0.1");
    s.on("error", () => {});
    if (i % 2) s.on("connect", () => s.write(`GET /api/status HTTP/1.1\r\nHost: localhost:${PORT}\r\nX-Slow: `));
    held.push(s);
  }
  await sleep(1000);
  check("answers while 200 idle or half-sent connections are held", await alive(3000));
  // The gate drops a connection that sends no complete request within 10 s.
  await sleep(12000);
  const stillOpen = held.filter((s) => !s.destroyed && s.readyState === "open").length;
  check("idle and half-sent connections are closed by the gate after 10 s", stillOpen === 0, `${stillOpen} still open`);
  held.forEach((s) => s.destroy());

  // 6. A burst of 2000 requests, 100 at a time.
  let okCount = 0;
  for (let b = 0; b < 20; b++) {
    const rs = await Promise.all(Array.from({ length: 100 }, () => fetch(GATE + "/api/status").then((r) => r.status === 200).catch(() => false)));
    okCount += rs.filter(Boolean).length;
  }
  check("a burst of 2000 status requests all answered", okCount === 2000, String(okCount));

  // 7. Unknown request ids and odd paths.
  const odd = await Promise.all(["/api/r/" + "A".repeat(5000), "/api/r/../../etc/passwd", "/assets/../../Cargo.toml", "/assets/%2e%2e/%2e%2e/Cargo.toml", "/%00"].map((p) => fetch(GATE + p).then((r) => r.status).catch(() => -1)));
  check("long, traversal and NUL paths get 4xx", odd.every((s) => s >= 400 && s < 500), odd.join(","));

  // 8. Memory stays bounded after all of this.
  await sleep(500);
  const endRss = rssMb(gate.pid);
  check("memory stays under 200 MB", endRss < 200, `${startRss.toFixed(0)} MB at start, ${endRss.toFixed(0)} MB at end`);
  check("still answers at the end", await alive());
} catch (e) {
  check("no unexpected error", false, e.stack || String(e));
} finally {
  gate.kill();
  rmSync(home, { recursive: true, force: true });
}

console.log(results.join("\n"));
console.log(`\n${results.length - failed} passed, ${failed} failed`);
if (failed) {
  console.log("\ngate log:\n" + gateLog);
  process.exit(1);
}
