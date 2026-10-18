# Changelog

Changes to Phygital Key MCP. Changes to the shared engine (approval page, keys, secure install, updates, verifier) are listed in the [base changelog](https://github.com/Phygital-Key/phygital-key/blob/main/CHANGELOG.md).

## 0.4.0

First release as its own product. Phygital Key MCP continues `phygital-key` 0.3.0: the same six MCP tools, the same approval page and the same approval format (`pka.1`), so the code in services that check approvals needs no change. The shared engine moved to the base repository, [Phygital-Key/phygital-key](https://github.com/Phygital-Key/phygital-key) (renamed from `phygital-key-mcp`), and this repository, `Phygital-Key/phygital-key-mcp`, now holds only the MCP product. Releases (tags `v*`) are built and signed here, in this repository's own `release` environment.

Renamed:

| What | 0.3.0 | 0.4.0 |
|---|---|---|
| Program | `phygital-key` | `phygital-key-mcp` |
| stdio mode | `phygital-key mcp` | `phygital-key-mcp stdio` |
| Print the access token | `phygital-key mcp-token` | `phygital-key-mcp token` |
| Serve without a token | `--open-mcp` | `--no-token` |
| Token file | `<home>/mcp-token` | `<home>/access-token` |
| Data folder | `~/.phygital-key` | `~/.phygital-key-mcp` |
| Environment | `PHYGITAL_KEY_HOME`, `_PORT`, `_BIND`, `_ORIGIN` | `PHYGITAL_KEY_MCP_HOME`, `_PORT`, `_BIND`, `_ORIGIN` |
| MCP server info | name `phygital-key`, title `Phygital Key` | name `phygital-key-mcp`, title `Phygital Key MCP` |
| Container | `ghcr.io/phygital-key/phygital-key` (`PHYGITAL_KEY_HOME=/data`) | `ghcr.io/phygital-key/phygital-key-mcp` (`PHYGITAL_KEY_MCP_HOME=/data`) |
| Homebrew | `phygital-key/tap/phygital-key` | `phygital-key/tap/phygital-key-mcp` |
| Release files | `phygital-key-v0.3.0-<target>.tar.gz` | `phygital-key-mcp-v0.4.0-<target>.tar.gz` |
| Secure install, macOS user | `_phygitalkey` | `_phygitalkeymcp` |
| Secure install, macOS program | `/Library/PhygitalKey/bin/phygital-key` | `/Library/PhygitalKey/mcp/bin/phygital-key-mcp` |
| Secure install, macOS data | `/Library/Application Support/PhygitalKey` | `/Library/Application Support/PhygitalKey/mcp` |
| Secure install, macOS logs | `/Library/Logs/PhygitalKey` | `/Library/Logs/PhygitalKey/mcp` |
| Secure install, launchd labels | `io.phygitalkey.gate`, `io.phygitalkey.update` | `io.phygitalkey.mcp.gate`, `io.phygitalkey.mcp.update` |
| Secure install, Linux user | `phygitalkey` | `phygitalkey-mcp` |
| Secure install, Linux folders | `/usr/lib/phygital-key`, `/var/lib/phygital-key` | `/usr/lib/phygital-key-mcp`, `/var/lib/phygital-key-mcp` |
| Secure install, systemd units | `phygital-key.service`, `phygital-key-update.{service,timer}` | `phygital-key-mcp.service`, `phygital-key-mcp-update.{service,timer}` |
| Admin helper | `phygital-key-admin` | `phygital-key-mcp-admin` |
| Secure installer | `crates/phygital-key/assets/install-service.sh` | `install-service.sh` in this repository |

Also changed:

- The HTTP endpoint's refusals are JSON from the shared guard: a wrong or missing token gives ``{"error":"missing or wrong access token (see `phygital-key-mcp token`)"}`` (401), and a request with a browser `Origin` gives `{"error":"browser requests are not allowed here"}` (403).
- `serve` prints `agent endpoint` instead of `MCP endpoint` for the line that says where to get the token.
- The installers, the secure-install test and the release scripts are generated from the base's templates (`phygital-key-mcp product-files --out .`), and CI fails if they differ.
- A daily workflow (`sync-base.yml`) moves this product to the base's latest commit after the tests and the 108 end-to-end checks pass.

Moving from 0.3.0: nothing is moved for you. The new program uses a new data folder, so it starts with no keys: add your key again with `phygital-key-mcp enroll`, and give services your new key cards (`phygital-key-mcp keys`) and first-key fingerprint. Update your AI apps to the new command (`phygital-key-mcp stdio`) or the new token (`phygital-key-mcp token`). Both versions use port 7468 by default, so stop the 0.3.0 gate first.
