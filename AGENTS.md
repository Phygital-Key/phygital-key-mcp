# AGENTS.md

Notes for AI coding agents (Claude Code, Codex, Cursor, Copilot and others) and human contributors who change this repository, Phygital Key MCP. Read this before you change code, tests or docs.

> [!NOTE]
> If you are an AI agent **using** the Phygital Key tools (asking a person to approve an action, not editing this code), read [docs/agents.md](docs/agents.md) and the [MCP tools reference](docs/tools.md) instead. The short version: you can ask, you can never approve; send the exact approved request; on `denied`, `expired` or `cancelled`, do not act.

## What this repository is

Phygital Key MCP is one product built on the shared base [Phygital-Key/phygital-key](https://github.com/Phygital-Key/phygital-key). The base holds the engine: the verifier (`phygital-key-verify`), the gate library (`phygital-key-gate`: approval page, keys, standing approvals, receipts, audit log, secure install, signed updates and the shared commands), the spec, the test vectors and the shared docs. The base publishes no programs and no releases.

This repository adds only what is MCP:

- the product's identity (name `Phygital Key MCP`, program `phygital-key-mcp`, id `mcp`, port 7468, repository `Phygital-Key/phygital-key-mcp`, its pinned release keys), as a `Product` in `src/main.rs`;
- the MCP adapter (the base's `Adapter` trait): Streamable HTTP at `/mcp`, the stdio mode, and the connect hints;
- the six MCP tools and the server instructions (`src/mcp.rs`);
- the end-to-end tests, the CI, the release workflow, the container, and the MCP docs.

Everything else (every command but `stdio`, the approval page, the data folder, the secure install) comes from `phygital-key-gate`. `phygital_key_gate::run(&PRODUCT, Mcp)` in `src/main.rs` starts it. Status: pre-audit.

## Layout

```
Cargo.toml                       the product crate: phygital-key-gate and phygital-key-verify from the base, rmcp 3.5, unsafe_code = "forbid"
Cargo.lock                       pins every dependency, including the exact base commit (CI builds with --locked)
release-keys.pem                 the product's pinned release public keys (P-256 PEM); src/main.rs embeds it, release.yml checks the signature against it; empty until scripts/release-key.sh runs
LICENSE, NOTICE                  Apache-2.0, and the credit line "Created by Phygital-Key" (must stay)
README.md                        the product page
CHANGELOG.md, SECURITY.md, CONTRIBUTING.md
AGENTS.md, CLAUDE.md             this file, and the pointer to it
src/main.rs                      PRODUCT (name, bin, id, version, repo, port, about, release keys) and the Mcp adapter
src/mcp.rs                       the six tools, their argument schemas, the `next` texts, INSTRUCTIONS, server info
tests/e2e/run.mjs                124 end-to-end and red-team checks
tests/e2e/browsers.mjs           the approval page in Firefox and WebKit (16 checks)
tests/e2e/abuse.mjs              floods, huge and slow requests, idle connections (16 checks)
tests/e2e/package.json, package-lock.json   pinned MCP SDK and Playwright
packaging/container/Dockerfile   ghcr.io/phygital-key/phygital-key-mcp: distroless cc-debian12:nonroot (pinned by digest), uid 65532, data in /data
packaging/npm/                   build.sh makes the npm packages from a release's archives (the launcher @phygital-key/mcp and one package per target), publish.sh publishes them
.github/workflows/ci.yml         CI on every push to main, every pull request, and when the sync starts it
.github/workflows/release.yml    on a v* tag: test, build 5 targets, attest, sign release.txt and release2.txt (P-256, and ML-DSA-65 once pinned), publish, then npm and the container
.github/workflows/sync-base.yml  daily: move to the base's latest main commit, test, push, start CI
docs/                            the MCP guides only (connect-your-ai, tools, agents, examples, testing) and images/
examples/agent-prompts.md        instructions to paste into an AI agent

Generated from the base's templates (never edit by hand):
install-service.sh               the secure installer for this product
install.sh                       the user install script
tests/secure-install.sh          the CI test of the secure install
scripts/release-key.sh           owner only, once: makes the release key, pins it
scripts/package-manifests.sh     writes the Homebrew, Scoop and winget manifests for a published release

Written after a release by scripts/package-manifests.sh:
bucket/phygital-key-mcp.json     the Scoop manifest
packaging/winget/<version>/      winget manifests
```

## Files made from the base

The five generated files are the base's templates in `crates/phygital-key-gate/assets/` (`install-service.sh`, `install.sh`, `secure-install-test.sh`, `release-key.sh`, `package-manifests.sh`) with two blocks filled in for this product: `# BEGIN PRODUCT` (`P_NAME`, `P_BIN`, `P_ID`, `P_REPO`, `P_PORT`, `P_VERSION`, and `P_PATH=/mcp` in the test) and, in the two installers, `# BEGIN RELEASE KEYS` from `release-keys.pem`. The program writes them:

```bash
cargo build --release --locked
target/release/phygital-key-mcp product-files --out .
```

The CI job `files made from the base are up to date` runs exactly that and fails on `git diff --exit-code`. So:

- Never edit a generated file. Change the template in the base, or the product values in `src/main.rs`, or `release-keys.pem`, then run `product-files` and commit the result.
- After you change `version` in `Cargo.toml`, run `product-files` again: `P_VERSION` comes from it.
- `scripts/release-key.sh` writes `release-keys.pem` and runs `product-files` itself.

## Changing shared behaviour

Anything that is not MCP lives in the base: the approval page, enrollment, keys and key history, standing approvals, revocations, receipts, the audit log, the HTTP guard (host, `Origin`, token), the commands `serve`, `demo`, `enroll`, `token`, `keys`, `verify`, `install-service`, `update` and the rest, the secure install, the signed updates, the verifier and the spec. Change those in [Phygital-Key/phygital-key](https://github.com/Phygital-Key/phygital-key), with its tests and vectors, following its [AGENTS.md](https://github.com/Phygital-Key/phygital-key/blob/main/AGENTS.md). Do not copy base code into this repository to change it here.

A change in the base reaches this product through the sync (next section), or at once if you run `cargo update -p phygital-key-gate -p phygital-key-verify` here.

## How the sync works

`.github/workflows/sync-base.yml` runs every day at 05:23 UTC (and by hand):

1. `cargo update -p phygital-key-gate -p phygital-key-verify` moves `Cargo.lock` to the base's latest `main` commit.
2. It builds the release binary and runs `product-files --out .`. If nothing changed, it stops.
3. It runs `cargo test --locked` and the 124 end-to-end checks.
4. Only if both pass, it commits (`Update the base to <commit>`), pushes to `main`, and starts the full CI (`gh workflow run ci.yml`), which adds every OS, the secure install and the container.

A failing base change is never pushed here: the job stops before the commit.

## Rules that must never break

1. **No tool can approve.** The MCP tools ask, wait, cancel, record a receipt and use a standing approval. Do not add a tool, argument, flag, route or test hook that approves, signs for the person or skips the check.
2. **No LLM in the gate or the approval page, ever.** The page shows the canonical request built by the gate, never text from the agent.
3. **Accepting an elicitation is never an approval.** It only means the client offered the page. Nothing the client returns may change a request's status.
4. **Fail closed.** Unclear, malformed, unknown or out of range is refused. Never normalize text, never accept floats.
5. **Never log or print secrets.** In stdio mode stderr goes to the AI app's logs: no enrollment link, no token there. The access token lives only in `<home>/access-token` (0600).
6. **Keep the generated files generated.** See above.
7. **No new dependencies without asking.** Open an issue first. Licences: Apache-2.0, MIT, BSD or similar.
8. **The release signing key lives only in the GitHub environment secret** `RELEASE_SIGNING_KEY` of the environment `release`, which only a run from a `v*` tag gets. Never put a private key in the repository, a workflow, an issue, a test or a log. Never run `scripts/release-key.sh` (owner only, in the owner's own terminal), never approve a release run, and never push a `v*` tag unless the owner asked: a pushed tag signs and publishes a release.
9. **Keep the credit.** `NOTICE` keeps the line "Created by Phygital-Key". Never write any real person's name anywhere, and add no AI attribution lines to docs, commits or release notes.
10. **Docs in plain words, no em dashes.** Shared topics are documented only in the base; link to them with `https://github.com/Phygital-Key/phygital-key/blob/main/docs/<page>.md`. Relative links here must resolve.

Changing an MCP tool (its name, arguments, results, `next` texts or error texts) also means: update `INSTRUCTIONS` in `src/mcp.rs` if the flow changes, [docs/tools.md](docs/tools.md), [docs/agents.md](docs/agents.md) and [examples/agent-prompts.md](examples/agent-prompts.md), and the end-to-end checks `MCP lists exactly 6 tools, none can approve` and `MCP server names itself phygital-key-mcp with its version`.

## Build and test

```bash
cargo fmt --all --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
```

End-to-end and red-team checks (Node 20+, a release build, Chromium from Playwright):

```bash
cargo build --release --locked
cd tests/e2e && npm ci && npx playwright install chromium
PKA_BIN=../../target/release/phygital-key-mcp node run.mjs
```

It prints one `PASS` or `FAIL` line per check (124 checks) and exits non-zero on any failure. It starts its own gate on port 17468 and the demo service on 17469 (and stdio gates on 17478 and 17488), in a temporary data folder.

`tests/secure-install.sh` runs in CI only (the `secure install` job on Linux and macOS). Do not run it on your own machine: it needs password-less sudo and installs a system service.

Every CI job, the container check and the sync: [docs/testing.md](docs/testing.md).

## Next

- [CONTRIBUTING.md](CONTRIBUTING.md): ground rules and checks.
- [docs/testing.md](docs/testing.md): every test and CI job.
- [The base's AGENTS.md](https://github.com/Phygital-Key/phygital-key/blob/main/AGENTS.md): the engine, the spec and the vectors.
- [SECURITY.md](SECURITY.md): report a security problem privately.
