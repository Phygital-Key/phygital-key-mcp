# Contributing

Thank you for helping. Phygital Key MCP is free and open source under [Apache-2.0](LICENSE), and contributions are accepted under the same license. Keep the [`NOTICE`](NOTICE) file and its line "Created by Phygital-Key".

## Where a change belongs

| Change | Repository |
|---|---|
| The MCP tools, their texts, the MCP endpoint, the stdio mode, these docs | Here |
| The approval page, keys, standing approvals, receipts, the audit log, the commands, the secure install, updates, the verifier, the spec | The base, [Phygital-Key/phygital-key](https://github.com/Phygital-Key/phygital-key) ([its contributing guide](https://github.com/Phygital-Key/phygital-key/blob/main/CONTRIBUTING.md)) |
| `install.sh`, `install-service.sh`, `tests/secure-install.sh`, `scripts/*.sh` | The base's templates: these files are generated, never edited here |

Read [AGENTS.md](AGENTS.md) first: the layout, the rules that must never break, and how the generated files and the daily sync work.

## Ground rules

- Open an issue before a large change or a new dependency.
- No tool may approve, and no LLM may run in the gate or the approval page.
- Docs in plain words, no em dashes, every command one you ran. Shared topics are documented only in the base.
- Never write any real person's name, and add no AI attribution lines.

## Checks to run

```bash
cargo fmt --all --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
cargo build --release --locked
target/release/phygital-key-mcp product-files --out . && git diff --exit-code
cd tests/e2e && npm ci && npx playwright install chromium && PKA_BIN=../../target/release/phygital-key-mcp node run.mjs
```

The last line runs the 124 end-to-end checks. What each test covers and every CI job: [testing](docs/testing.md).

Security problems go to [SECURITY.md](SECURITY.md), not to a public issue.
