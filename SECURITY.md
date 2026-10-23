# Security

Phygital Key MCP is pre-audit: no outside security firm has reviewed it yet.

## Report a problem

Please report a security problem privately, not in a public issue:

**[Report a vulnerability](https://github.com/Phygital-Key/phygital-key-mcp/security/advisories/new)** (GitHub private vulnerability reporting).

Say what you found, how to reproduce it, and which version you ran (`phygital-key-mcp --version`). If the problem is in the shared engine (the approval page, keys, standing approvals, receipts, the secure install, signed updates or the verifier) and not in the MCP side, you can report it here or in the [base repository](https://github.com/Phygital-Key/phygital-key/security/advisories/new).

We aim to reply within 7 days, and to publish a fix for every confirmed issue. Please keep the problem private until a fixed release is out. If you would like credit, say which name or GitHub account to use.

## Policy and threat model

The security policy, what is in scope, the threat model and the internal reviews are shared by every Phygital Key product and live in the base:

- [Security policy](https://github.com/Phygital-Key/phygital-key/blob/main/SECURITY.md)
- [Threat model](https://github.com/Phygital-Key/phygital-key/blob/main/docs/threat-model.md)
- [Security reviews](https://github.com/Phygital-Key/phygital-key/blob/main/docs/security-reviews.md)

What this repository adds to check: the six MCP tools and their texts (`src/mcp.rs`), the MCP endpoint at `/mcp` and the stdio mode (`src/main.rs`). The tests for them: [testing](docs/testing.md).
